import { expect, it, vi } from 'vitest';

import {
  createAccountLibrary,
  createAccountWallet,
  detectStudioRuntime,
} from '../public/try-on-lab/account.mjs';

it('uses authoritative capabilities and never mutates or grants credits locally', () => {
  const navigate = vi.fn();
  const wallet = createAccountWallet(
    { signedIn: true, verified: true, credits: 3 },
    { navigate }
  );
  wallet.reserve('operation', 2);
  wallet.confirm('operation');
  wallet.release('operation');
  expect(wallet.snapshot().available).toBe(3);
  expect(wallet).not.toHaveProperty('grant');
  wallet.update({ signedIn: true, verified: true, credits: 1 });
  expect(wallet.snapshot().available).toBe(1);
  expect(() => wallet.reserve('operation2', 3)).toThrow();
  expect(navigate).toHaveBeenCalledWith('/pricing');
});

it('directs guests to sign in and unverified members to email verification', () => {
  const navigate = vi.fn();
  const wallet = createAccountWallet(
    { signedIn: false, verified: false, credits: 9 },
    { navigate }
  );
  expect(() => wallet.reserve('operation', 1)).toThrow();
  expect(navigate).toHaveBeenLastCalledWith('/sign-in');
  wallet.update({ signedIn: true, verified: false, credits: 9 });
  expect(() => wallet.reserve('operation', 1)).toThrow();
  expect(navigate).toHaveBeenLastCalledWith(
    '/verify-email?callbackUrl=/generate'
  );
});

it('keeps a configured Preview on its isolated endpoint', async () => {
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify({ configured: true }))
  );
  expect(await detectStudioRuntime(fetcher)).toEqual({
    account: false,
    api: '/api/preview/try-on',
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('does not upload server generated designs or completed history again', async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).includes('asset=')
      ? new Response(new Blob(['png'], { type: 'image/png' }))
      : new Response(
          JSON.stringify({
            records: [
              {
                id: 'owned-record',
                operationId: 'operation',
                image: 'owned-asset',
                createdAt: 123,
              },
            ],
          })
        )
  );
  const library = createAccountLibrary({ fetcher });
  const design = await library.saveDesign({
    id: 'design-operation',
    operationId: 'operation',
    source: 'generated',
  });
  const history = await library.saveHistory({
    id: 'tryon-operation',
    operationId: 'operation',
  });
  expect(design.id).toBe('owned-record');
  expect(history.image).toBeInstanceOf(Blob);
  expect(
    fetcher.mock.calls.every((call) => !String(call[0]).includes('mode='))
  ).toBe(true);
});

it('does not let unavailable browser drafts block account tasks', async () => {
  const pendingLibrary = {
    savePending: vi.fn(async () => {
      throw new Error('quota');
    }),
    getPending: vi.fn(async () => {
      throw new Error('blocked');
    }),
    deletePending: vi.fn(async () => {
      throw new Error('blocked');
    }),
  };
  const library = createAccountLibrary({ pendingLibrary });
  await expect(library.savePending({})).resolves.toBeUndefined();
  await expect(library.getPending('op')).resolves.toBeUndefined();
  await expect(library.deletePending('op')).resolves.toBeUndefined();
});

it('lists only metadata and loads image Blobs on demand', async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).includes('asset=')
      ? new Response(new Blob(['png'], { type: 'image/png' }))
      : new Response(
          JSON.stringify({
            records: [
              {
                id: 'saved',
                image: 'asset',
                original: 'photo',
                createdAt: 123,
              },
            ],
          })
        )
  );
  const library = createAccountLibrary({ fetcher });
  const records = await library.listDesigns();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(records[0].imageUrl).toBe('/api/studio?asset=asset');
  const loaded = await library.loadRecord(records[0]);
  expect(loaded.assetId).toBe('asset');
  expect(loaded.image).toBeInstanceOf(Blob);
  expect(loaded.original).toBeInstanceOf(Blob);
});
