import { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';

import { isProductPreview } from '@/config/preview/product';
import { PreviewSiteNavigation } from '@/shared/blocks/tattoo/preview-site-navigation';
import {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import { Footer, Header } from '@/themes/default/blocks';

export default async function LandingLayout({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: HeaderType;
  footer: FooterType;
}) {
  return (
    <div className="h-screen w-screen">
      {isProductPreview() ? (
        <PreviewSiteNavigation locale={await getLocale()} />
      ) : (
        <Header header={header} />
      )}
      {children}
      <Footer footer={footer} />
    </div>
  );
}
