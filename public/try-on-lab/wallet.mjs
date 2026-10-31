/** Browser-only simulation. Never reads or writes the website credit ledger. */
/** @param {{storage?: Pick<Storage, 'getItem' | 'setItem'>}} [options] */
export function createPreviewWallet({
  storage = globalThis.localStorage,
} = {}) {
  const key = 'tattoovis-preview-wallet-v1';
  function load() {
    const raw = storage.getItem(key);
    if (!raw) {
      const first = { version: 1, balance: 3, holds: {}, settled: [] };
      storage.setItem(key, JSON.stringify(first));
      return first;
    }
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      !Number.isSafeInteger(value.balance) ||
      value.balance < 0 ||
      !value.holds ||
      typeof value.holds !== 'object' ||
      Array.isArray(value.holds) ||
      !Array.isArray(value.settled) ||
      !value.settled.every((id) => typeof id === 'string') ||
      !Object.values(value.holds).every((cost) => [1, 2, 3].includes(cost))
    )
      throw new Error(
        '测试积分记录无法读取，请先导出图案；不会使用正式账户积分。'
      );
    if (
      Object.values(value.holds).reduce((sum, cost) => sum + cost, 0) >
      value.balance
    )
      throw new Error('测试积分记录不一致。');
    return value;
  }
  const save = (value) => storage.setItem(key, JSON.stringify(value));
  load();
  return {
    snapshot() {
      const value = load();
      const reserved = Object.values(value.holds).reduce(
        (sum, cost) => sum + cost,
        0
      );
      return {
        balance: value.balance,
        available: value.balance - reserved,
        reserved,
        reservations: Object.keys(value.holds),
      };
    },
    reserve(id, cost) {
      if (
        typeof id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,180}$/.test(id) ||
        ![1, 2, 3].includes(cost)
      )
        throw new Error('无效的测试积分操作。');
      const value = load();
      if (value.settled.includes(id)) return;
      if (Object.hasOwn(value.holds, id)) {
        if (value.holds[id] !== cost)
          throw new Error('任务费用与预留记录不一致。');
        return;
      }
      if (Object.keys(value.holds).length)
        throw new Error('当前有待完成的测试任务，请先继续查看或处理预留记录。');
      const reserved = Object.values(value.holds).reduce(
        (sum, amount) => sum + amount,
        0
      );
      if (value.balance - reserved < cost)
        throw new Error(
          '测试积分不足。可免费补充测试积分，正式站上线后由价格页购买。'
        );
      Object.defineProperty(value.holds, id, {
        value: cost,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      save(value);
    },
    confirm(id) {
      const value = load();
      if (value.settled.includes(id)) return;
      if (!Object.hasOwn(value.holds, id))
        throw new Error('没有对应的测试积分预留记录。');
      value.balance -= value.holds[id];
      delete value.holds[id];
      value.settled.push(id);
      save(value);
    },
    release(id) {
      const value = load();
      delete value.holds[id];
      save(value);
    },
    hasReservation(id) {
      return Object.hasOwn(load().holds, id);
    },
    grant(amount = 10) {
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 50)
        throw new Error('无效的测试积分数量。');
      const value = load();
      if (value.balance + amount > 1000)
        throw new Error('测试积分已足够，请先使用现有额度。');
      value.balance += amount;
      save(value);
    },
  };
}
export function previewCreditCost(kind, resolution = '1K') {
  if (kind === 'design') return 1;
  if (kind !== 'render' || !['1K', '2K', '4K'].includes(resolution))
    throw new Error('请选择有效的试戴分辨率。');
  return { '1K': 1, '2K': 2, '4K': 3 }[resolution];
}
