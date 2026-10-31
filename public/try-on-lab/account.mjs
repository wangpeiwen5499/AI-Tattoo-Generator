/** The account service is authoritative for balances, jobs and saved images. */
export async function detectStudioRuntime(fetcher = globalThis.fetch) {
  const preview = await fetcher('/api/preview/try-on', { cache: 'no-store' });
  if (!preview.ok && preview.status !== 404)
    throw new Error('Could not determine studio mode.');
  if (preview.status !== 404)
    return { account: false, api: '/api/preview/try-on' };
  const response = await fetcher('/api/studio', { cache: 'no-store' });
  if (!response.ok)
    throw new Error('Studio is unavailable. Please reload to try again.');
  const capabilities = await response.json();
  if (capabilities.mode !== 'account')
    throw new Error('Invalid studio capabilities.');
  return { account: true, api: '/api/studio', capabilities };
}

/** @param {{fetcher?: typeof fetch, pendingLibrary?: {savePending: (input: any) => Promise<any>, getPending: (id: string) => Promise<any>, deletePending: (id: string) => Promise<any>}, api?: string}} [options] */
export function createAccountLibrary({
  fetcher = globalThis.fetch,
  pendingLibrary,
  api = '/api/studio',
} = {}) {
  async function request(query, options = {}) {
    const response = await fetcher(`${api}?${query}`, {
      cache: 'no-store',
      ...options,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw Object.assign(
        new Error(data.error || 'Could not access your account library.'),
        { status: response.status }
      );
    }
    return response.json();
  }
  async function hydrate(record) {
    const fields = ['image', 'original', 'draft'];
    const value = {
      ...record,
      assetId: record.image,
      createdAt:
        typeof record.createdAt === 'number'
          ? record.createdAt
          : new Date(record.createdAt).getTime(),
    };
    await Promise.all(
      fields.map(async (field) => {
        if (!record[field]) return;
        const response = await fetcher(
          `${api}?asset=${encodeURIComponent(record[field])}`,
          { cache: 'no-store' }
        );
        if (!response.ok)
          throw new Error('Could not load a saved image. Please retry.');
        value[field] = await response.blob();
      })
    );
    return value;
  }
  async function list(collection) {
    const { records } = await request(`collection=${collection}`);
    return records.map((record) => ({
      ...record,
      assetId: record.image,
      imageUrl: `${api}?asset=${encodeURIComponent(record.image)}`,
      createdAt:
        typeof record.createdAt === 'number'
          ? record.createdAt
          : new Date(record.createdAt).getTime(),
    }));
  }
  async function resolve(collection, input) {
    const { records } = await request(`collection=${collection}`);
    const operationId =
      input.operationId || input.id?.replace(/^(design|tryon)-/, '');
    const record = records.find(
      (record) => record.operationId === operationId || record.id === input.id
    );
    if (!record)
      throw new Error(
        'Your saved result is still being prepared. Resume the task to retry.'
      );
    return hydrate(record);
  }
  return {
    account: true,
    loadRecord: hydrate,
    listDesigns: () => list('designs'),
    listHistory: () => list('history'),
    async saveDesign(input) {
      if (input.source === 'generated') return resolve('designs', input);
      const form = new FormData();
      for (const key of ['name', 'prompt', 'source'])
        form.set(key, input[key] || '');
      form.set('image', input.image, 'design.png');
      const { record } = await request('mode=save-design', {
        method: 'POST',
        body: form,
      });
      return hydrate(record);
    },
    saveHistory: (input) => resolve('history', input),
    deleteDesign: (id) =>
      request(`collection=designs&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    deleteHistory: (id) =>
      request(`collection=history&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    // Convenience snapshots cannot block paid submissions or finished server saves.
    savePending: (input) =>
      pendingLibrary?.savePending(input).catch(() => undefined),
    getPending: (id) => pendingLibrary?.getPending(id).catch(() => undefined),
    deletePending: (id) =>
      pendingLibrary?.deletePending(id).catch(() => undefined),
  };
}

export function createAccountWallet(
  capabilities,
  { locale = 'en', navigate = (url) => globalThis.location.assign(url) } = {}
) {
  let current = capabilities;
  const base = locale === 'zh' ? '/zh' : '';
  function requireAccess(cost = 0) {
    let path;
    if (!current.signedIn) path = '/sign-in';
    else if (!current.verified) path = '/verify-email?callbackUrl=/generate';
    else if (Number(current.credits) < cost) path = '/pricing';
    if (path) {
      navigate(`${base}${path}`);
      throw new Error(
        locale === 'zh'
          ? '请先登录、验证邮箱并确保积分充足。'
          : 'Sign in, verify your email and ensure you have enough credits.'
      );
    }
  }
  return {
    update: (value) => {
      current = value;
    },
    snapshot: () => ({
      balance: Number(current.credits) || 0,
      available: Number(current.credits) || 0,
      reserved: 0,
      reservations: [],
    }),
    reserve: (_id, cost) => requireAccess(cost),
    requireAccess,
    confirm(_id) {},
    release(_id) {},
    hasReservation: () => false,
  };
}
