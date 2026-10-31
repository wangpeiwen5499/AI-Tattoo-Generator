const DB_NAME = 'tattoovis-preview-studio-v1';
const MAX_RECORDS = 100;
const MAX_IMAGE_BYTES = 48 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function text(value, field, maxLength, optional = false) {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new TypeError(
      `${field} must be text of at most ${maxLength} characters.`
    );
  }
  return value;
}

function identifier(value, field = 'id') {
  text(value, field, 200);
  if (!value.trim()) throw new TypeError(`${field} must not be empty.`);
  return value;
}

function image(value, field, optional = false) {
  if (optional && value === undefined) return undefined;
  if (!(value instanceof Blob) || !IMAGE_TYPES.has(value.type) || !value.size) {
    throw new TypeError(`${field} must be a PNG, JPEG, or WebP image Blob.`);
  }
  if (value.size > MAX_IMAGE_BYTES)
    throw new RangeError(`${field} exceeds the 48 MiB image limit.`);
  return value;
}

function record(input, store) {
  if (!input || typeof input !== 'object')
    throw new TypeError('A record is required.');
  const value = store === 'pending' ? {} : { image: image(input.image, 'image') };
  if (store === 'pending') value.id = identifier(input.id);
  if (input.id !== undefined) value.id = identifier(input.id);
  if (input.createdAt !== undefined) {
    if (!Number.isFinite(input.createdAt) || input.createdAt < 0)
      throw new TypeError('createdAt must be a timestamp.');
    value.createdAt = input.createdAt;
  }
  if (store === 'designs') {
    value.name = text(input.name, 'name', 200);
    value.prompt = text(input.prompt, 'prompt', 10000);
    if (!['generated', 'upload', 'sample'].includes(input.source))
      throw new TypeError('Invalid design source.');
    value.source = input.source;
  } else {
    if (!['1K', '2K', '4K'].includes(input.resolution))
      throw new TypeError('Invalid result resolution.');
    value.resolution = input.resolution;
    if (input.designId !== undefined)
      value.designId = identifier(input.designId, 'designId');
    if (input.prompt !== undefined)
      value.prompt = text(input.prompt, 'prompt', 10000, true);
    if (store === 'pending' || input.original !== undefined)
      value.original = image(input.original, 'original');
    if (store === 'pending' || input.draft !== undefined)
      value.draft = image(input.draft, 'draft');
  }
  return value;
}

/** Browser-local Blob storage. Every mutation resolves only after IDB commits.
 * Errors intentionally propagate: callers must offer retry or image download.
 * Metadata is plain text; consumers must render it with textContent, never HTML.
 */
export function createStudioLibrary({ indexedDB = globalThis.indexedDB } = {}) {
  let connection;

  function open() {
    if (!indexedDB?.open)
      return Promise.reject(
        new Error(
          'Browser image storage is unavailable. Download your image or retry in a supported browser.'
        )
      );
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        let rejected = false;
        request.onupgradeneeded = () => {
          const db = request.result;
          for (const name of ['designs', 'history', 'pending']) {
            if (!db.objectStoreNames.contains(name))
              db.createObjectStore(name, { keyPath: 'id' });
          }
        };
        request.onerror = () =>
          reject(
            request.error || new Error('Unable to open browser image storage.')
          );
        request.onblocked = () => {
          rejected = true;
          reject(
            new Error(
              'Browser image storage is blocked. Close other studio tabs and retry.'
            )
          );
        };
        request.onsuccess = () => {
          const db = request.result;
          if (rejected) {
            db.close();
            return;
          }
          db.onversionchange = () => {
            db.close();
            connection = undefined;
          };
          db.onclose = () => {
            connection = undefined;
          };
          resolve(db);
        };
      }).catch((error) => {
        connection = undefined;
        throw error;
      });
    }
    return connection;
  }

  async function transaction(storeName, mode, execute) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      let result;
      let failure;
      const fail = (error) => {
        failure = error;
        try {
          tx.abort();
        } catch {
          reject(error);
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          failure ||
            tx.error ||
            new Error('Browser image storage transaction was aborted.')
        );
      tx.onerror = () => {
        failure ||= tx.error;
      };
      try {
        execute(
          tx.objectStore(storeName),
          (value) => {
            result = value;
          },
          fail
        );
      } catch (error) {
        fail(error);
      }
    });
  }

  function list(storeName) {
    return transaction(storeName, 'readonly', (store, done) => {
      const request = store.getAll();
      request.onsuccess = () =>
        done(
          request.result.sort(
            (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)
          )
        );
    });
  }

  async function save(storeName, input) {
    const value = record(input, storeName);
    value.id ||= globalThis.crypto.randomUUID();
    return transaction(storeName, 'readwrite', (store, done, fail) => {
      const existing = store.get(value.id);
      existing.onsuccess = () => {
        const put = () => {
          value.createdAt ??= existing.result?.createdAt ?? Date.now();
          try {
            const request = store.put(value);
            request.onsuccess = () => done(value);
          } catch (error) {
            fail(error);
          }
        };
        if (existing.result) {
          put();
          return;
        }
        const count = store.count();
        count.onsuccess = () => {
          if (count.result >= MAX_RECORDS) {
            fail(
              new Error(
                `This library already has ${MAX_RECORDS} images. Delete an item before saving another.`
              )
            );
          } else put();
        };
      };
    });
  }

  async function remove(storeName, id) {
    identifier(id);
    return transaction(storeName, 'readwrite', (store) => {
      store.delete(id);
    });
  }

  async function get(storeName, id) {
    identifier(id);
    return transaction(storeName, 'readonly', (store, done) => {
      const request = store.get(id);
      request.onsuccess = () => done(request.result);
    });
  }

  return {
    listDesigns: () => list('designs'),
    saveDesign: (value) => save('designs', value),
    deleteDesign: (id) => remove('designs', id),
    listHistory: () => list('history'),
    saveHistory: (value) => save('history', value),
    deleteHistory: (id) => remove('history', id),
    // Pending snapshots are separate from finished history and never shown in
    // the gallery. Their IDs match the operation being resumed after refresh.
    savePending: (value) => save('pending', value),
    getPending: (id) => get('pending', id),
    deletePending: (id) => remove('pending', id),
  };
}
