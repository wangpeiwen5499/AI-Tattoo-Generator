import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { LegalPolicyZh } from '@/shared/blocks/common/legal-policy-zh';
import { getMetadata } from '@/shared/lib/seo';

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return getMetadata({
    title:
      locale === 'zh' ? '隐私政策 — TattooVis' : 'Privacy Policy — TattooVis',
    description:
      locale === 'zh'
        ? 'TattooVis 如何使用 Google 登录信息、上传照片及提示词来验证账户身份和生成纹身预览。'
        : 'How TattooVis uses Google Sign-In information, uploaded photos and prompts for account authentication and tattoo previews.',
    canonicalUrl: '/privacy-policy',
  })({ params });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (locale === 'zh') return <LegalPolicyZh kind="privacy" />;

  return (
    <section className="py-24 md:py-36">
      <div className="container">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Last updated: November 2, 2026
          </p>

          <div className="text-muted-foreground [&_h2]:text-foreground mt-8 space-y-6 text-sm leading-relaxed [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold">
            <p>
              This Privacy Policy explains how TattooVis (&quot;we&quot;)
              collects, uses, and protects your information when you use our
              website and AI tattoo preview service (the &quot;Service&quot;).
            </p>

            <section>
              <h2>1. Information We Collect</h2>
              <ul className="ml-5 list-disc space-y-1">
                <li>
                  <strong className="text-foreground">Account:</strong> your
                  email address, name and, when provided by Google Sign-In, your
                  profile image and Google account identifier. Authentication is
                  handled by Better Auth.
                </li>
                <li>
                  <strong className="text-foreground">Photos & prompts:</strong>{' '}
                  the body photo you upload and the text description of your
                  tattoo idea.
                </li>
                <li>
                  <strong className="text-foreground">Generated images:</strong>{' '}
                  the AI-produced tattoo previews returned to you.
                </li>
                <li>
                  <strong className="text-foreground">
                    Payment information:
                  </strong>{' '}
                  handled by Waffo (our payment provider). We do not store your
                  card details.
                </li>
                <li>
                  <strong className="text-foreground">Usage data:</strong> basic
                  technical data (browser, device) used to operate the Service.
                </li>
              </ul>
            </section>

            <section>
              <h2>2. How We Use Information</h2>
              <p>
                To provide the Service (generate tattoo previews), process
                payments, maintain your generation history, prevent abuse and
                prohibited content, and improve the Service.
              </p>
            </section>

            <section>
              <h2>Google Sign-In and Google User Data</h2>
              <p>
                Google Sign-In is optional and is used only to authenticate you,
                create or link your TattooVis account, and maintain your
                signed-in session. We use basic identity information such as
                your email, name, profile image and account identifier. This
                integration does not request access to Gmail, Google Drive or
                Google Photos. Signing in does not import body photos from your
                Google account.
              </p>
              <p>
                We do not send Google identity information or OAuth tokens to
                KIE for image generation, and do not use Google user data to
                train or fine-tune AI models. Photos and prompts you explicitly
                submit to the tattoo tool are processed separately as described
                below. TattooVis does not use Google APIs to generate AI
                non-consensual intimate imagery (AI NCII).
              </p>
              <p>
                You can revoke Google access in your Google Account settings.
                Revoking access does not by itself delete your TattooVis account
                or saved images; contact support@tattoovis.ink to request
                deletion.
              </p>
            </section>

            <section>
              <h2>3. AI Processing</h2>
              <p>
                To generate previews, your uploaded photo and prompt are sent to
                our AI provider (Kie.ai, routing to OpenAI image models), which
                produces the preview images. Do not upload photos or describe
                ideas you do not have rights to or that contain sensitive
                personal information. Use only photos of consenting adults.
                Nudification, sexually explicit edits and AI-generated
                non-consensual intimate imagery are prohibited by our{' '}
                <Link href="/acceptable-use">Acceptable Use Policy</Link>.
              </p>
            </section>

            <section>
              <h2>4. Third-Party Services</h2>
              <ul className="ml-5 list-disc space-y-1">
                <li>
                  <strong className="text-foreground">Better Auth</strong> —
                  user authentication.
                </li>
                <li>
                  <strong className="text-foreground">Google</strong> — optional
                  Google Sign-In for account authentication, separate from image
                  generation.
                </li>
                <li>
                  <strong className="text-foreground">Supabase</strong> —
                  database for accounts, projects, and payments.
                </li>
                <li>
                  <strong className="text-foreground">Cloudflare R2</strong> —
                  storage for your uploaded photos and generated images.
                </li>
                <li>
                  <strong className="text-foreground">Kie.ai / OpenAI</strong> —
                  AI image generation.
                </li>
                <li>
                  <strong className="text-foreground">Waffo</strong> — payment
                  processing as Merchant of Record (handles taxes and
                  compliance).
                </li>
              </ul>
              <p>
                Each provider processes data under its own privacy policy and
                applicable law.
              </p>
            </section>

            <section>
              <h2>5. Data Storage & Retention</h2>
              <p>
                Your photos, prompts, and generated images are stored so you can
                view your history. They are kept while your account is active
                and deleted when you request account deletion.
              </p>
              <p>
                Uploaded photos and generated images are served through
                shareable image links. Anyone who obtains a link may be able to
                view that image. Avoid sensitive photos and do not share image
                links without the subject&apos;s consent.
              </p>
            </section>

            <section>
              <h2>6. Cookies</h2>
              <p>
                Necessary authentication cookies keep you signed in. Optional
                Google Analytics 4 loads only after you choose Accept analytics.
                It uses _ga cookies to measure basic page visits and engagement.
                We send only generalized page paths, without URL queries,
                fragments, photos, prompts, email addresses or account
                identifiers. Google also processes browser and device details
                and pseudonymous analytics identifiers. We do not enable
                advertising features.
              </p>
              <p>
                Your versioned cookie preference is saved in this browser.
                Choose Cookie settings in the footer at any time to change it.
                Choosing Only necessary stops future analytics collection and
                removes accessible _ga cookies without signing you out or
                discarding your current studio draft. Withdrawal does not erase
                analytics data previously collected by Google. Browser or
                network restrictions may also prevent analytics from loading.
              </p>
            </section>

            <section>
              <h2>7. Your Rights</h2>
              <p>
                You may request access to, export of, or deletion of your data
                at any time. Contact us at{' '}
                <a href="mailto:support@tattoovis.ink">support@tattoovis.ink</a>
                .
              </p>
            </section>

            <section>
              <h2>8. Children</h2>
              <p>
                The Service is not intended for anyone under 13. Do not use the
                Service if you are under 13.
              </p>
            </section>

            <section>
              <h2>9. Changes</h2>
              <p>
                We may update this policy. The &quot;Last updated&quot; date
                above reflects the latest revision.
              </p>
            </section>

            <section>
              <h2>10. Contact</h2>
              <p>
                Questions about this policy? Email{' '}
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
