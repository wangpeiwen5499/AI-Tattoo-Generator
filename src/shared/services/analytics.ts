import {
  AnalyticsManager,
  GoogleAnalyticsProvider,
} from '@/extensions/analytics';
import { GA_MEASUREMENT_ID } from '@/extensions/analytics/consent';
import { Configs } from '@/shared/models/config';

/** Only the consent-controlled GA provider is enabled. Legacy settings cannot activate other trackers. */
export function getAnalyticsManagerWithConfigs(_configs: Configs) {
  const analytics = new AnalyticsManager();
  analytics.addProvider(
    new GoogleAnalyticsProvider({ gaId: GA_MEASUREMENT_ID })
  );
  return analytics;
}

export async function getAnalyticsService(
  configs: Configs = {}
): Promise<AnalyticsManager> {
  return getAnalyticsManagerWithConfigs(configs);
}
