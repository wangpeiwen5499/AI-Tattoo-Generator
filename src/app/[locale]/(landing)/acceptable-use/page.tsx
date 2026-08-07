import { setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';

export const revalidate = 86400;

export const generateMetadata = getMetadata({
  title: 'Acceptable Use Policy — AI Tattoo Generator',
  description: 'Content guidelines and prohibited uses of AI Tattoo Generator.',
  canonicalUrl: '/acceptable-use',
});

export default async function AcceptableUsePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <section className="py-24 md:py-36">
      <div className="container">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Acceptable Use Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: July 31, 2026
          </p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
            <p>
              This Acceptable Use Policy describes what you may and may not do with AI Tattoo
              Generator (&quot;the Service&quot;). Violating this policy may result in account
              suspension or termination.
            </p>

            <section>
              <h2>Prohibited Content</h2>
              <p>
                You may <strong className="text-foreground">not</strong> upload, prompt, or
                generate any of the following:
              </p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Sexually explicit, pornographic, or Not Safe For Work (NSFW) content;</li>
                <li>
                  Any depiction of a person under 18 in a nude, partially nude, sexual, or
                  suggestive context;
                </li>
                <li>Child sexual abuse material (CSAM) — this is reported to authorities;</li>
                <li>Hate speech, discrimination, or content that demeans or attacks any group;</li>
                <li>
                  Realistic violence, gore, torture, or depiction of illegal acts against
                  persons or animals;
                </li>
                <li>
                  Content that infringes another person&apos;s copyright, trademark, or right
                  of publicity (including generating images of celebrities or public figures
                  without authorization);
                </li>
                <li>Defamation, harassment, stalking, or threats;</li>
                <li>Personal information of others without their consent;</li>
                <li>Spam, phishing, malware, or fraudulent content.</li>
              </ul>
            </section>

            <section>
              <h2>Prohibited Uses</h2>
              <p>You may not:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Use automated tools (bots, scripts) to access or abuse the Service;</li>
                <li>Attempt to bypass rate limits, credits, or payment requirements;</li>
                <li>
                  Reverse engineer, decompile, or extract the AI models or algorithms used by
                  the Service;
                </li>
                <li>Resell, redistribute, or white-label the Service without written permission;</li>
                <li>Use the Service to build competing products or train other AI models.</li>
              </ul>
            </section>

            <section>
              <h2>Enforcement</h2>
              <p>
                We may review content you submit or generate to enforce this policy. Violations
                may result in:
              </p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Removal of prohibited content;</li>
                <li>Temporary or permanent account suspension;</li>
                <li>Termination without refund of unused credits;</li>
                <li>Reporting illegal content to appropriate authorities.</li>
              </ul>
            </section>

            <section>
              <h2>Reporting</h2>
              <p>
                To report a violation, email{' '}
                <a href="mailto:support@tattoovis.ink">support@tattoovis.ink</a>. We review all
                reports and take appropriate action.
              </p>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}
