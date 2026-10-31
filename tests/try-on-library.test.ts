import { expect, it } from 'vitest';

import { createStudioLibrary } from '../public/try-on-lab/library.mjs';

// A narrow transactional IDB double: committed data survives new connections;
// requests succeed before commit, and aborted writes never reach the database.
function database(seed?: { version: number; designs?: any[]; history?: any[] }) {
  const stores = new Map<string, Map<string, any>>();
  let version = seed?.version || 0;
  if (seed) {
    stores.set('designs', new Map((seed.designs || []).map((row) => [row.id, structuredClone(row)])));
    stores.set('history', new Map((seed.history || []).map((row) => [row.id, structuredClone(row)])));
  }
  const control = { abortNext: false, holdCommit: false, commit: () => {} };
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore(name: string) {
      if (stores.has(name)) throw new DOMException('Store already exists', 'ConstraintError');
      stores.set(name, new Map());
    },
    close() {},
    transaction(name: string, mode: string) {
      if (!stores.has(name)) throw new DOMException('Store does not exist', 'NotFoundError');
      const working = new Map(stores.get(name));
      let pending = 0;
      let aborted = false;
      let scheduled = false;
      const tx: any = {
        error: null,
        abort() {
          if (aborted) return;
          aborted = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore() {
          const request = (action: () => any) => {
            pending++;
            const req: any = {};
            queueMicrotask(() => {
              if (aborted) return;
              req.result = action();
              req.onsuccess?.();
              pending--;
              finish();
            });
            return req;
          };
          return {
            get: (id: string) =>
              request(() => structuredClone(working.get(id))),
            getAll: () => request(() => structuredClone([...working.values()])),
            count: () => request(() => working.size),
            put: (value: any) =>
              request(() => {
                working.set(value.id, structuredClone(value));
                return value.id;
              }),
            delete: (id: string) => request(() => working.delete(id)),
          };
        },
      };
      const finish = () => {
        if (pending || scheduled || aborted) return;
        scheduled = true;
        const commit = () => {
          if (aborted) return;
          if (control.abortNext) {
            control.abortNext = false;
            tx.error = new DOMException(
              'Browser quota exceeded',
              'QuotaExceededError'
            );
            tx.abort();
          } else {
            if (mode === 'readwrite') stores.set(name, working);
            tx.oncomplete?.();
          }
        };
        if (control.holdCommit) control.commit = commit;
        else queueMicrotask(commit);
      };
      return tx;
    },
  };
  const indexedDB: any = {
    open(_name: string, requestedVersion: number) {
      const req: any = {};
      queueMicrotask(() => {
        req.result = db;
        if (requestedVersion < version) {
          req.error = new DOMException('Version is older than current database', 'VersionError');
          req.onerror?.();
          return;
        }
        if (requestedVersion > version) {
          req.onupgradeneeded?.({ oldVersion: version, newVersion: requestedVersion });
          version = requestedVersion;
        }
        req.onsuccess?.();
      });
      return req;
    },
  };
  return { indexedDB, control };
}

const png = () => new Blob(['pixels'], { type: 'image/png' });
const design = (id = 'one', createdAt = 10) => ({
  id,
  createdAt,
  name: '<b>Rose</b>',
  prompt: 'rose',
  source: 'generated',
  image: png(),
});

it('persists images across adapter instances and lists newest first', async () => {
  const { indexedDB } = database();
  const library = createStudioLibrary({ indexedDB });
  await library.saveDesign(design());
  await library.saveDesign(design('two', 20));
  const rows = await createStudioLibrary({ indexedDB }).listDesigns();
  expect(rows.map((row: any) => row.id)).toEqual(['two', 'one']);
  expect(await rows[1].image.text()).toBe('pixels');
  expect(rows[1].name).toBe('<b>Rose</b>');
});

it('upserts a task ID without duplicates and preserves its creation date', async () => {
  const library = createStudioLibrary(database());
  await library.saveDesign(design());
  await library.saveDesign({
    ...design(),
    createdAt: undefined,
    name: 'Updated',
  });
  const rows = await library.listDesigns();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: 'one', name: 'Updated', createdAt: 10 });
});

it('keeps historical snapshots when their source design is deleted', async () => {
  const { indexedDB } = database();
  const library = createStudioLibrary({ indexedDB });
  await library.saveDesign(design());
  const saved = await library.saveHistory({
    designId: 'one',
    resolution: '4K',
    image: png(),
    original: png(),
    draft: png(),
  });
  expect(saved.id).toBeTruthy();
  expect(saved.createdAt).toBeGreaterThan(0);
  await library.deleteDesign('one');
  expect(await library.listDesigns()).toEqual([]);
  const rows = await createStudioLibrary({ indexedDB }).listHistory();
  expect(await rows[0].original.text()).toBe('pixels');
  await library.deleteHistory(saved.id);
  expect(await library.listHistory()).toEqual([]);
});

it('waits for commit and surfaces quota errors without reporting saved data', async () => {
  const { indexedDB, control } = database();
  const library = createStudioLibrary({ indexedDB });
  control.holdCommit = true;
  let settled = false;
  const pending = library.saveDesign(design()).then(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(settled).toBe(false);
  control.commit();
  await pending;
  control.holdCommit = false;
  control.abortNext = true;
  await expect(library.saveDesign(design('failed'))).rejects.toMatchObject({
    name: 'QuotaExceededError',
  });
  expect((await library.listDesigns()).map((row: any) => row.id)).toEqual([
    'one',
  ]);
  await library.saveDesign(design('retry'));
  expect(await library.listDesigns()).toHaveLength(2);
});

it('rejects unavailable and failed storage instead of claiming a volatile save', async () => {
  await expect(
    createStudioLibrary({ indexedDB: undefined }).saveDesign(design())
  ).rejects.toThrow();
  const indexedDB: any = {
    open() {
      throw new DOMException('Blocked', 'SecurityError');
    },
  };
  await expect(
    createStudioLibrary({ indexedDB }).listHistory()
  ).rejects.toMatchObject({ name: 'SecurityError' });
});

it('rejects unsafe formats, image URLs, oversize images, and invalid metadata', async () => {
  const library = createStudioLibrary(database());
  await expect(
    library.saveDesign({ ...design(), image: 'https://example.com/a.png' })
  ).rejects.toThrow();
  await expect(
    library.saveDesign({
      ...design(),
      image: new Blob(['<svg/>'], { type: 'image/svg+xml' }),
    })
  ).rejects.toThrow();
  await expect(
    library.saveDesign({
      ...design(),
      image: new Blob([new Uint8Array(48 * 1024 * 1024 + 1)], {
        type: 'image/png',
      }),
    })
  ).rejects.toThrow();
  await expect(
    library.saveDesign({ ...design(), source: 'remote' })
  ).rejects.toThrow();
  await expect(
    library.saveHistory({ resolution: '8K', image: png() })
  ).rejects.toThrow();
});

it('refuses a full library without silently evicting images and allows an existing ID update', async () => {
  const library = createStudioLibrary(database());
  for (let i = 0; i < 100; i++) await library.saveDesign(design(`id-${i}`));
  await expect(library.saveDesign(design('overflow'))).rejects.toThrow(/100/);
  await library.saveDesign({ ...design('id-0'), name: 'Replacement' });
  expect(await library.listDesigns()).toHaveLength(100);
});

const pendingRecord = (id = 'operation-one') => ({ id, resolution: '4K', original: png(), draft: png(), prompt: 'rose', designId: 'one', createdAt: 123 });

it('persists pending comparison snapshots across reopen without exposing unfinished history', async () => {
  const { indexedDB } = database();
  const library = createStudioLibrary({ indexedDB });
  const saved = await library.savePending(pendingRecord());
  expect(saved).toMatchObject({ id: 'operation-one', resolution: '4K', createdAt: 123, designId: 'one', prompt: 'rose' });
  expect(saved).not.toHaveProperty('image');
  const reopened = createStudioLibrary({ indexedDB });
  const record = await reopened.getPending('operation-one');
  expect(await record.original.text()).toBe('pixels');
  expect(await record.draft.text()).toBe('pixels');
  expect(await reopened.listHistory()).toEqual([]);
  await reopened.savePending({ ...pendingRecord(), createdAt: undefined, prompt: 'updated' });
  expect(await reopened.getPending('operation-one')).toMatchObject({ createdAt: 123, prompt: 'updated' });
  await reopened.deletePending('operation-one');
  expect(await reopened.getPending('operation-one')).toBeUndefined();
});

it('upgrades a populated version-one library additively for pending snapshots', async () => {
  const originalHistory = { id: 'old-result', resolution: '2K', image: png(), createdAt: 5 };
  const { indexedDB } = database({ version: 1, designs: [design()], history: [originalHistory] });
  const library = createStudioLibrary({ indexedDB });
  await library.savePending(pendingRecord());
  expect(await library.listDesigns()).toHaveLength(1);
  const history = await library.listHistory();
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({ id: 'old-result', resolution: '2K' });
  expect(await history[0].image.text()).toBe('pixels');
  expect(await library.getPending('operation-one')).toMatchObject({ resolution: '4K' });
});

it('requires pending IDs, both real snapshots, and valid resolution', async () => {
  const library = createStudioLibrary(database());
  await expect(library.savePending({ ...pendingRecord(), id: undefined })).rejects.toThrow();
  await expect(library.savePending({ ...pendingRecord(), original: undefined })).rejects.toThrow();
  await expect(library.savePending({ ...pendingRecord(), draft: 'https://example.com/image' })).rejects.toThrow();
  await expect(library.savePending({ ...pendingRecord(), resolution: '8K' })).rejects.toThrow();
  await expect(library.getPending('')).rejects.toThrow();
});

it('commit-gates pending saves and retains prior snapshots when an update aborts', async () => {
  const { indexedDB, control } = database();
  const library = createStudioLibrary({ indexedDB });
  control.holdCommit = true;
  let settled = false;
  const saving = library.savePending(pendingRecord()).then(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(settled).toBe(false);
  control.commit();
  await saving;
  control.holdCommit = false;
  control.abortNext = true;
  await expect(library.savePending({ ...pendingRecord(), prompt: 'should not persist' })).rejects.toMatchObject({ name: 'QuotaExceededError' });
  expect(await library.getPending('operation-one')).toMatchObject({ prompt: 'rose' });
});
