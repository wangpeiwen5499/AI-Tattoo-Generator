import { expect, it } from 'vitest';

import { applyTattooBackgroundUpgrade } from '../scripts/lib/tattoo-background-upgrade';
import { createTestDatabase } from './database';

it('adds workflow metadata idempotently without changing old tasks or credit balances', async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.exec(
      `ALTER TABLE tattoo_job DROP COLUMN workflow_run_id, DROP COLUMN workflow_checked_at; INSERT INTO "user"(id,name,email) VALUES ('background-owner','Owner','background@example.com'); INSERT INTO tattoo_project(id,user_id,prompt,body_photo_key,body_photo_url,updated_at) VALUES ('background-project','background-owner','Wolf','key','https://files.example/photo.png',now()); INSERT INTO tattoo_job(project_id,user_id,request_id,expires_at) VALUES ('background-project','background-owner','request',now()+interval '20 minutes');`
    );
    await applyTattooBackgroundUpgrade(database, 'public');
    await applyTattooBackgroundUpgrade(database, 'public');
    expect(
      (
        await client.query(
          'SELECT project_id,stage,workflow_run_id,workflow_checked_at FROM tattoo_job'
        )
      ).rows
    ).toEqual([
      {
        project_id: 'background-project',
        stage: 'design',
        workflow_run_id: null,
        workflow_checked_at: null,
      },
    ]);
    expect(
      (await client.query('SELECT count(*)::int AS count FROM credit')).rows
    ).toEqual([{ count: 0 }]);
  } finally {
    await client.close();
  }
});
