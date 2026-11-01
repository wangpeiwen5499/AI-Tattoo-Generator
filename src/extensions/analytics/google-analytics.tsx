import React, { ReactNode } from 'react';

import { AnalyticsConfigs, AnalyticsProvider } from '.';
import { GoogleAnalyticsConsent } from './google-consent';

export interface GoogleAnalyticsConfigs extends AnalyticsConfigs {
  gaId: string;
}
/** A single consent-controlled Google tag; no GA script is rendered on the server. */
export class GoogleAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'google-analytics';
  constructor(public configs: GoogleAnalyticsConfigs) {}
  getBodyScripts(): ReactNode {
    return <GoogleAnalyticsConsent gaId={this.configs.gaId} />;
  }
}
