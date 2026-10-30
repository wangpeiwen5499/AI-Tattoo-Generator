import { expect, it } from 'vitest';

import { applyPaymentRefundsUpgrade } from '../scripts/lib/payment-refunds-upgrade';
import { createTestDatabase } from './database';

it('adds the refund ledger twice without modifying old orders or users', async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.exec(
      `ALTER TABLE "order" DROP COLUMN refund_info; INSERT INTO "user"(id,name,email) VALUES ('migration-owner','Owner','migration@example.com'); INSERT INTO "order"(id,order_no,user_id,status,amount,currency,payment_provider,checkout_info,updated_at) VALUES ('migration-order','migration-order','migration-owner','paid',1499,'USD','waffo','{}',now());`
    );
    await applyPaymentRefundsUpgrade(database, 'public');
    await applyPaymentRefundsUpgrade(database, 'public');
    expect(
      (await client.query('SELECT status,amount,refund_info FROM "order"')).rows
    ).toEqual([{ status: 'paid', amount: 1499, refund_info: null }]);
  } finally {
    await client.close();
  }
});
