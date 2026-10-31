import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { getMetadata } from '@/shared/lib/seo';

export const revalidate = 86400;

export const generateMetadata = getMetadata({
  title: 'Terms of Service — AI Tattoo Generator',
  description: 'The terms governing your use of AI Tattoo Generator.',
  canonicalUrl: '/terms-of-service',
});

export default async function TermsPage({
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
          <h1 className="text-3xl font-bold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Last updated: October 31, 2026
          </p>

          <div className="text-muted-foreground [&_h2]:text-foreground mt-8 space-y-6 text-sm leading-relaxed [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold">
            <section>
              <h2>1. Acceptance of Terms</h2>
              <p>
                By accessing or using AI Tattoo Generator (the
                &quot;Service&quot;), you agree to these Terms of Service. If
                you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2>2. The Service</h2>
              <p>
                The Service uses artificial intelligence to generate tattoo
                preview images on photos you provide. Previews are for personal
                visualization and entertainment only. They are{' '}
                <strong className="text-foreground">not</strong> professional
                tattoo advice, medical advice, or a guarantee of any real tattoo
                result. Consult a licensed tattoo artist before getting any
                tattoo.
              </p>
            </section>

            <section>
              <h2>3. Accounts</h2>
              <p>
                You create an account via our authentication provider. You are
                responsible for keeping your account secure and for activity
                under your account.
              </p>
            </section>

            <section>
              <h2>4. Credits & Payment</h2>
              <p>
                Credit packs cost $4.99 for 5 credits, $14.99 for 20 credits, or
                $29.99 for 50 credits. Generating one 1K tattoo design costs 1
                credit. Each single-image try-on costs 1 credit at 1K, 2 credits
                at 2K, or 3 credits at 4K. Uploading, manually positioning,
                saving and reusing designs are free. Image quantities depend on
                how you use your credits; a pack does not include a fixed number
                of designs or body previews. New accounts receive a one-time
                gift of 3 credits, usable after email verification. Visitors can
                explore the saved example free. Credits never expire; existing
                balances are unchanged.
              </p>
              <p className="mt-3">
                Credits are reserved by a debit when a generation is accepted.
                Confirmed generation failures restore that operation&apos;s
                credits once; an uncertain provider submission requires support
                review before another attempt. Closing the page does not cancel
                a task. Completed designs and try-ons are saved to your account.
              </p>
              <p className="mt-3">
                Payments are processed by Waffo. Contact support@tattoovis.ink
                with your order number for a refund review under the applicable
                purchase terms and law. After a completed full refund, only that
                order&apos;s remaining unused credits are recovered. Credits
                already used, welcome gifts and other orders&apos; balances are
                not deducted. Partial refunds are handled manually. These
                recovery rules do not by themselves determine refund
                eligibility.
              </p>
            </section>

            <section>
              <h2>5. AI-Generated Content Disclaimer</h2>
              <p>
                AI-generated images may be imperfect, unexpected, or inaccurate.
                We do not guarantee any specific result. You use generated
                content at your own discretion.
              </p>
            </section>

            <section>
              <h2>6. Your Content & Responsibilities</h2>
              <p>
                You confirm you have the rights to any photo you upload and that
                your prompts comply with our{' '}
                <Link href="/acceptable-use">Acceptable Use Policy</Link>. You
                grant us a limited license to process your content solely to
                provide the Service.
              </p>
            </section>

            <section>
              <h2>7. Prohibited Conduct</h2>
              <p>
                You may <strong className="text-foreground">not</strong> use the
                Service to generate any prohibited content, including but not
                limited to:
              </p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Sexually explicit, pornographic, or NSFW content;</li>
                <li>
                  Any person under 18 in a nude, sexual, or suggestive context;
                </li>
                <li>
                  Hate speech, discrimination, or content demeaning protected
                  groups;
                </li>
                <li>Realistic violence, gore, or illegal acts;</li>
                <li>
                  Content that infringes another person&apos;s copyright,
                  trademark, or likeness;
                </li>
                <li>Defamation, harassment, or threats.</li>
              </ul>
              <p>
                See our{' '}
                <Link href="/acceptable-use">Acceptable Use Policy</Link> for
                the full list. Violations may result in immediate account
                termination, without refund, and content removal.
              </p>
            </section>

            <section>
              <h2>8. Intellectual Property</h2>
              <p>
                You retain rights to the photos you upload. Generated previews
                are provided for your personal, non-commercial use unless you
                have separate rights to the underlying content.
              </p>
            </section>

            <section>
              <h2>9. Disclaimers & Limitation of Liability</h2>
              <p>
                The Service is provided &quot;as is&quot; without warranties. To
                the maximum extent permitted by law, we are not liable for any
                indirect or consequential damages arising from the Service. Our
                total liability is limited to the amount you paid in the
                preceding 12 months.
              </p>
            </section>

            <section>
              <h2>10. Termination</h2>
              <p>
                We may suspend or terminate your account for violations of these
                Terms or the Acceptable Use Policy.
              </p>
            </section>

            <section>
              <h2>11. Changes</h2>
              <p>
                We may update these Terms. Continued use after changes
                constitutes acceptance.
              </p>
            </section>

            <section>
              <h2>12. Contact</h2>
              <p>
                Questions? Email{' '}
                <a href="mailto:support@tattoovis.ink">support@tattoovis.ink</a>
                .
              </p>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}
