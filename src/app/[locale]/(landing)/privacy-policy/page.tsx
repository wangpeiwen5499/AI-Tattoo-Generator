import { setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';

export const revalidate = 86400;

export const generateMetadata = getMetadata({
  title: 'Privacy Policy — AI Tattoo Generator',
  description: 'How AI Tattoo Generator collects, uses, and protects your information.',
  canonicalUrl: '/privacy-policy',
});

export default async function PrivacyPage({
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
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: July 31, 2026
          </p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
            <p>
              This Privacy Policy explains how AI Tattoo Generator (&quot;we&quot;) collects, uses,
              and protects your information when you use our website and AI tattoo preview service
              (the &quot;Service&quot;).
            </p>

            <section>
              <h2>1. Information We Collect</h2>
              <ul className="ml-5 list-disc space-y-1">
                <li>
                  <strong className="text-foreground">Account:</strong> your email address,
                  collected via our authentication provider when you sign in with email or
                  social login.
                </li>
                <li>
                  <strong className="text-foreground">Photos & prompts:</strong> the body photo
                  you upload and the text description of your tattoo idea.
                </li>
                <li>
                  <strong className="text-foreground">Generated images:</strong> the AI-produced
                  tattoo previews returned to you.
                </li>
                <li>
                  <strong className="text-foreground">Payment information:</strong> handled by
                  Waffo (our payment provider). We do not store your card details.
                </li>
                <li>
                  <strong className="text-foreground">Usage data:</strong> basic technical data
                  (browser, device) used to operate the Service.
                </li>
              </ul>
            </section>

            <section>
              <h2>2. How We Use Information</h2>
              <p>
                To provide the Service (generate tattoo previews), process payments, maintain
                your generation history, prevent abuse and prohibited content, and improve the
                Service.
              </p>
            </section>

            <section>
              <h2>3. AI Processing</h2>
              <p>
                To generate previews, your uploaded photo and prompt are sent to our AI provider
                (Kie.ai, routing to OpenAI image models), which produces the preview images. Do
                not upload photos or describe ideas you do not have rights to or that contain
                sensitive personal information.
              </p>
            </section>

            <section>
              <h2>4. Third-Party Services</h2>
              <ul className="ml-5 list-disc space-y-1">
                <li>
                  <strong className="text-foreground">Better Auth</strong> — user authentication.
                </li>
                <li>
                  <strong className="text-foreground">Supabase</strong> — database for accounts,
                  projects, and payments.
                </li>
                <li>
                  <strong className="text-foreground">Cloudflare R2</strong> — storage for your
                  uploaded photos and generated images.
                </li>
                <li>
                  <strong className="text-foreground">Kie.ai / OpenAI</strong> — AI image
                  generation.
                </li>
                <li>
                  <strong className="text-foreground">Waffo</strong> — payment processing as
                  Merchant of Record (handles taxes and compliance).
                </li>
              </ul>
              <p>
                Each provider processes data under its own privacy policy and applicable law.
              </p>
            </section>

            <section>
              <h2>5. Data Storage & Retention</h2>
              <p>
                Your photos, prompts, and generated images are stored so you can view your
                history. They are kept while your account is active and deleted when you request
                account deletion.
              </p>
            </section>

            <section>
              <h2>6. Cookies</h2>
              <p>
                We use only essential authentication cookies to keep you signed in. We do not
                use advertising or tracking cookies.
              </p>
            </section>

            <section>
              <h2>7. Your Rights</h2>
              <p>
                You may request access to, export of, or deletion of your data at any time.
                Contact us at{' '}
                <a href="mailto:support@tattoovis.ink">support@tattoovis.ink</a>.
              </p>
            </section>

            <section>
              <h2>8. Children</h2>
              <p>
                The Service is not intended for anyone under 13. Do not use the Service if you
                are under 13.
              </p>
            </section>

            <section>
              <h2>9. Changes</h2>
              <p>
                We may update this policy. The &quot;Last updated&quot; date above reflects the
                latest revision.
              </p>
            </section>

            <section>
              <h2>10. Contact</h2>
              <p>
                Questions about this policy? Email{' '}
                <a href="mailto:support@tattoovis.ink">support@tattoovis.ink</a>.
              </p>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}
