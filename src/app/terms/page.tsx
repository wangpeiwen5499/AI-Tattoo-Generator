import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — AI Tattoo Generator',
  description: 'The terms governing your use of AI Tattoo Generator.',
}

export default function TermsPage() {
  const supportEmail = process.env.SUPPORT_EMAIL
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: July 31, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using AI Tattoo Generator (the &quot;Service&quot;), you agree to these Terms of Service. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2>2. The Service</h2>
          <p>The Service uses artificial intelligence to generate tattoo preview images on photos you provide. Previews are for personal visualization and entertainment only. They are <strong className="text-foreground">not</strong> professional tattoo advice, medical advice, or a guarantee of any real tattoo result. Consult a licensed tattoo artist before getting any tattoo.</p>
        </section>

        <section>
          <h2>3. Accounts</h2>
          <p>You create an account via our authentication provider. You are responsible for keeping your account secure and for activity under your account.</p>
        </section>

        <section>
          <h2>4. Credits &amp; Payment</h2>
          <p>The Service uses a one-time credit system: $4.99 for 5 previews, $14.99 for 20 previews, and $29.99 for 50 previews. New accounts receive 1 free preview. Credits do not expire. Payments are processed by Waffo as Merchant of Record. All purchases are non-refundable except where required by applicable law.</p>
        </section>

        <section>
          <h2>5. AI-Generated Content Disclaimer</h2>
          <p>AI-generated images may be imperfect, unexpected, or inaccurate. We do not guarantee any specific result. You use generated content at your own discretion.</p>
        </section>

        <section>
          <h2>6. Your Content &amp; Responsibilities</h2>
          <p>You confirm you have the rights to any photo you upload and that your prompts comply with our <a href="/acceptable-use">Acceptable Use Policy</a>. You grant us a limited license to process your content solely to provide the Service.</p>
        </section>

        <section>
          <h2>7. Prohibited Conduct</h2>
          <p>You may <strong className="text-foreground">not</strong> use the Service to generate any prohibited content, including but not limited to:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Sexually explicit, pornographic, or NSFW content;</li>
            <li>Any person under 18 in a nude, sexual, or suggestive context;</li>
            <li>Hate speech, discrimination, or content demeaning protected groups;</li>
            <li>Realistic violence, gore, or illegal acts;</li>
            <li>Content that infringes another person&apos;s copyright, trademark, or likeness;</li>
            <li>Defamation, harassment, or threats.</li>
          </ul>
          <p>See our <a href="/acceptable-use">Acceptable Use Policy</a> for the full list. Violations may result in immediate account termination, without refund, and content removal.</p>
        </section>

        <section>
          <h2>8. Intellectual Property</h2>
          <p>You retain rights to the photos you upload. Generated previews are provided for your personal, non-commercial use unless you have separate rights to the underlying content.</p>
        </section>

        <section>
          <h2>9. Disclaimers &amp; Limitation of Liability</h2>
          <p>The Service is provided &quot;as is&quot; without warranties. To the maximum extent permitted by law, we are not liable for any indirect or consequential damages arising from the Service. Our total liability is limited to the amount you paid in the preceding 12 months.</p>
        </section>

        <section>
          <h2>10. Termination</h2>
          <p>We may suspend or terminate your account for violations of these Terms or the Acceptable Use Policy.</p>
        </section>

        <section>
          <h2>11. Changes</h2>
          <p>We may update these Terms. Continued use after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2>12. Contact</h2>
          <p>Questions? {supportEmail ? <>Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</> : 'Contact our support team.'}</p>
        </section>
      </div>
    </article>
  )
}
