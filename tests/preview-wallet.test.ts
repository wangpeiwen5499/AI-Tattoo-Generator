import { expect, it } from 'vitest';

async function wallet() {
  const { createPreviewWallet } =
    await import('../public/try-on-lab/wallet.mjs');
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  return {
    createPreviewWallet,
    storage,
    account: createPreviewWallet({ storage }),
  };
}
it('keeps the one-time three-credit test grant across page sessions and holds cost before generation', async () => {
  const { account, storage, createPreviewWallet } = await wallet();
  expect(account.snapshot()).toMatchObject({ balance: 3, available: 3 });
  account.reserve('design-a', 1);
  expect(account.snapshot()).toMatchObject({
    balance: 3,
    available: 2,
    reserved: 1,
  });
  expect(createPreviewWallet({ storage }).snapshot()).toMatchObject({
    balance: 3,
    available: 2,
  });
});
it('settles success only once and releases failed operations without touching other credits', async () => {
  const { account } = await wallet();
  account.reserve('design-a', 1);
  account.confirm('design-a');
  account.confirm('design-a');
  expect(account.snapshot().balance).toBe(2);
  account.reserve('render-b', 2);
  account.release('render-b');
  expect(account.snapshot()).toMatchObject({ balance: 2, available: 2 });
  expect(() => account.reserve('render-c', 3)).toThrow();
});
it('fails closed on unavailable storage instead of granting a fresh free balance', async () => {
  const { createPreviewWallet } = await wallet();
  expect(() =>
    createPreviewWallet({
      storage: {
        getItem() {
          throw new Error('denied');
        },
        setItem() {},
      },
    })
  ).toThrow();
});
it('prevents a second tab from overwriting the only recoverable pending task', async () => {
  const { account, storage, createPreviewWallet } = await wallet();
  account.reserve('pending-a', 1);
  const second = createPreviewWallet({ storage });
  expect(() => second.reserve('pending-b', 1)).toThrow();
  expect(second.snapshot()).toMatchObject({ available: 2, reserved: 1 });
});
