import { expect, it, vi } from 'vitest';

import { getAnalyticsManagerWithConfigs } from '@/shared/services/analytics';

vi.mock('@/shared/models/config', () => ({ getAllConfigs: vi.fn() }));

it('never injects legacy optional trackers even when old settings remain', () => {
  const manager = getAnalyticsManagerWithConfigs({
    clarity_id: 'legacy-clarity',
    openpanel_client_id: 'legacy-openpanel',
    plausible_domain: 'example.com',
    plausible_src: 'https://example.com/track.js',
    vercel_analytics_enabled: 'true',
  });
  expect(manager.getHeadScripts()).toEqual([]);
  expect(manager.getMetaTags()).toEqual([]);
  expect(manager.getBodyScripts()).toHaveLength(1);
});
