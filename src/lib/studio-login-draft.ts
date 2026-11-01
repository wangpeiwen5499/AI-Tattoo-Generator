import type { Placement } from './manual-placement';

// A short-lived login handoff, not a user library. Tokens isolate browser tabs.
export type StudioLoginDraft = {
  photo: Blob | null;
  design: Blob | null;
  placement: Placement;
  prompt: string;
  resolution: string;
  action: 'design' | 'render';
  expires: number;
};
const ttl = 30 * 60 * 1000;
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('tattoovis-login-handoff', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Draft storage is blocked'));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
) {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      const request = action(tx.objectStore('drafts'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Draft storage failed'));
    });
  } finally {
    db.close();
  }
}
export async function saveLoginDraft(draft: Omit<StudioLoginDraft, 'expires'>) {
  // Remove abandoned handoffs on the next use, without keeping a browsable library.
  await transaction('readwrite', (store) => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const row = cursor.result;
      if (!row) return;
      if (!row.value?.expires || row.value.expires <= Date.now()) row.delete();
      row.continue();
    };
    return cursor;
  });
  const token = crypto.randomUUID();
  await transaction('readwrite', (store) =>
    store.put({ ...draft, expires: Date.now() + ttl }, token)
  );
  return token;
}
export async function readLoginDraft(
  token: string
): Promise<StudioLoginDraft | null> {
  const draft = (await transaction('readonly', (store) => store.get(token))) as
    StudioLoginDraft | undefined;
  if (!draft) return null;
  if (draft.expires <= Date.now()) {
    await removeLoginDraft(token);
    return null;
  }
  return draft;
}
export async function removeLoginDraft(token: string) {
  await transaction('readwrite', (store) => store.delete(token));
}
export function studioLoginUrl(locale: string, token: string) {
  const prefix = locale === 'zh' ? '/zh' : '';
  const callback = `${prefix}/studio?resumeStudio=${encodeURIComponent(token)}`;
  return `${prefix}/sign-in?callbackUrl=${encodeURIComponent(callback)}`;
}
