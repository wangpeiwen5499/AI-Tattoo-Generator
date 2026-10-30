import { expect, it } from 'vitest';

import { applyTattooResolutionsUpgrade } from '../scripts/lib/tattoo-resolutions-upgrade';
import { createTestDatabase } from './database';

it('adds legacy 1K/one-credit snapshots without changing old balances and preserves future 4K values on rerun', async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.exec(
      `ALTER TABLE tattoo_project DROP COLUMN resolution, DROP COLUMN credits_cost; INSERT INTO "user"(id,name,email) VALUES ('legacy-owner','Owner','legacy@example.com'); INSERT INTO tattoo_project(id,user_id,prompt,body_photo_key,body_photo_url,updated_at) VALUES ('old','legacy-owner','Wolf','uploads/old.png','https://example.com/old.png',now()); INSERT INTO credit(id,user_id,transaction_no,transaction_type,credits,remaining_credits,status,updated_at) VALUES ('grant','legacy-owner','original-gift','grant',3,3,'active',now());`
    );
    await applyTattooResolutionsUpgrade(database, 'public');
    await applyTattooResolutionsUpgrade(database, 'public');
    expect(
      (await client.query('SELECT resolution,credits_cost FROM tattoo_project'))
        .rows
    ).toEqual([{ resolution: '1K', credits_cost: 1 }]);
    expect(
      (await client.query('SELECT remaining_credits FROM credit')).rows
    ).toEqual([{ remaining_credits: 3 }]);
    await client.exec(
      "UPDATE tattoo_project SET resolution='4K',credits_cost=3"
    );
    await applyTattooResolutionsUpgrade(database, 'public');
    expect(
      (await client.query('SELECT resolution,credits_cost FROM tattoo_project'))
        .rows
    ).toEqual([{ resolution: '4K', credits_cost: 3 }]);
  } finally {
    await client.close();
  }
});
