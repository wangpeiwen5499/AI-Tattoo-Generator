import { expect, it } from 'vitest';

import { createStudioLibrary } from '../public/try-on-lab/library.mjs';

// A narrow transactional IDB double: committed data survives new connections;
// requests succeed before commit, and aborted writes never reach the database.
function database(seed?: { version: number; pending?: any[] }) {
  const stores = new Map<string, Map<string, any>>();
  let version = seed?.version || 0;
  if (seed) {
    stores.set(
      'pending',
      new Map((seed.pending || []).map((row) => [row.id, structuredClone(row)]))
    );
  }
  const control = {
    abortNext: false,
    holdCommit: false,
    commit: () => {},
  };
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore(name: string) {
      if (stores.has(name))
        throw new DOMException('Store already exists', 'ConstraintError');
      stores.set(name, new Map());
    },
    close() {},
    transaction(name: string, mode: string) {
      if (!stores.has(name))
        throw new DOMException('Store does not exist', 'NotFoundError');
      const working = new Map(stores.get(name));
      let pending = 0;
      let scheduled = false;
      let aborted = false;
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
            getAll: () =>
              request(() => structuredClone([...working.values()])),
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
          req.error = new DOMException(
            'Version is older than current database',
            'VersionError'
          );
          req.onerror?.();
          return;
        }
        if (requestedVersion > version) {
          req.onupgradeneeded?.({
            oldVersion: version,
            newVersion: requestedVersion,
          });
          version = requestedVersion;
        }
        req.onsuccess?.();
      });
      return req;
    },
  };
  return { indexedDB, control };
}

const image = () => new Blob(['pixels'], { type: 'image/png' });
const snapshot = (id: string, overrides: Record<string, any> = {}) => ({
  id,
  resolution: '2K',
  original: image(),
  draft: image(),
  prompt: 'fern',
  ...overrides,
});

it('persists pending comparison snapshots across instances without any listing API', async () => {
  const { indexedDB } = database();
  const library = createStudioLibrary({ indexedDB });
  await library.savePending(snapshot('op-1'));
  const restored = await createStudioLibrary({ indexedDB }).getPending('op-1');
  expect(restored.prompt).toBe('fern');
  expect(await restored.original.text()).toBe('pixels');
  // The drafts store is resume-only: the design library, try-on history and
  // any balance live in the account service, never here.
  expect((library as any).listDesigns).toBeUndefined();
  expect((library as any).listHistory).toBeUndefined();
  expect((library as any).saveDesign).toBeUndefined();
  expect((library as any).saveHistory).toBeUndefined();
});

it('deletes a pending snapshot by id and tolerates missing entries', async () => {
  const { indexedDB } = database();
  const library = createStudioLibrary({ indexedDB });
  await library.savePending(snapshot('op-1'));
  await library.deletePending('op-1');
  expect(await library.getPending('op-1')).toBeUndefined();
  await expect(library.deletePending('missing')).resolves.toBeUndefined();
});

it('rejects unsafe formats, image URLs and invalid metadata', async () => {
  const { indexedDB } = database();
  const library = createStudioLibrary({ indexedDB });
  await expect(
    library.savePending(
      snapshot('bad-url', { original: 'https://x/y.png' } as any)
    )
  ).rejects.toThrow(/image/);
  await expect(
    library.savePending(
      snapshot('bad-type', { draft: new Blob(['x'], { type: 'text/plain' }) })
    )
  ).rejects.toThrow(/PNG, JPEG, or WebP/);
  await expect(
    library.savePending(snapshot('no-id', { id: undefined } as any))
  ).rejects.toThrow(/id/);
  await expect(library.getPending(42 as any)).rejects.toThrow(/id/);
});

it('keeps aborted writes out of the store and surfaces quota errors', async () => {
  const { indexedDB, control } = database();
  const library = createStudioLibrary({ indexedDB });
  await library.savePending(snapshot('op-1'));
  control.abortNext = true;
  await expect(library.savePending(snapshot('op-2'))).rejects.toThrow();
  const reopened = createStudioLibrary({ indexedDB });
  expect(await reopened.getPending('op-2')).toBeUndefined();
  expect(await reopened.getPending('op-1')).toBeDefined();
});

it('fails closed when browser storage is unavailable', async () => {
  const library = createStudioLibrary({ indexedDB: undefined as any });
  await expect(library.savePending(snapshot('op-1'))).rejects.toThrow(
    /unavailable/i
  );
});

it('upgrades an existing store additively without dropping pending snapshots', async () => {
  const legacy = database({ version: 1, pending: [snapshot('kept')] });
  const library = createStudioLibrary(legacy);
  expect(await library.getPending('kept')).toBeDefined();
  await library.savePending(snapshot('fresh'));
  expect(await library.getPending('fresh')).toBeDefined();
  expect(await library.getPending('kept')).toBeDefined();
});
