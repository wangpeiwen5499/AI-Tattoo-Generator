import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — AI Tattoo Generator',
  description: 'The permitted and prohibited uses of our AI image generation service.',
}

export default function AcceptableUsePage() {
  const supportEmail = process.env.SUPPORT_EMAIL
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">Acceptable Use Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: July 31, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
        <p>
          This Acceptable Use Policy governs your use of the AI image generation features of
          AI Tattoo Generator (the &quot;Service&quot;). It complements our{' '}
          <a href="/terms">Terms of Service</a>.
        </p>

        <section>
          <h2>1. Prohibited Content</h2>
          <p>You may <strong className="text-foreground">not</strong> use the Service to generate any of the following:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Sexually explicit, pornographic, or otherwise NSFW content;</li>
            <li>Any person under the age of 18 in a nude, sexual, or suggestive context, including AI-generated depictions of minors;</li>
            <li>Hate speech, slurs, or content that promotes discrimination or violence against any protected group;</li>
            <li>Realistic depictions of violence, gore, self-harm, or illegal acts;</li>
            <li>Content that infringes the copyright, trademark, or other intellectual property of others;</li>
            <li>Depictions of real, identifiable people without their consent;</li>
            <li>Defamation, harassment, bullying, or threats against any person;</li>
            <li>Content intended to facilitate fraud or any illegal activity.</li>
          </ul>
        </section>

        <section>
          <h2>2. Strict Prohibition of NSFW &amp; Sexually Explicit Content</h2>
          <p>
            <strong className="text-foreground">Sexually explicit and NSFW content is strictly prohibited.</strong> The Service is designed for tattoo visualization and will not generate sexual or explicit imagery. Any attempt to generate such content may be refused and can result in immediate account termination, without refund.
          </p>
        </section>

        <section>
          <h2>3. Enforcement &amp; Moderation</h2>
          <p>We may review prompts and generated outputs, apply automated content moderation, and refuse to generate any content that may violate this policy. We reserve the right to suspend or terminate accounts and remove content for violations, in our discretion.</p>
        </section>

        <section>
          <h2>4. Reporting Violations</h2>
          <p>If you encounter content that you believe violates this policy, please report it to us. {supportEmail ? <>Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</> : 'Contact our support team.'}</p>
        </section>

        <section>
          <h2>5. Consequences of Violation</h2>
          <p>Violating this policy may result in content removal, suspension, or permanent termination of your account, without refund, as further described in our <a href="/terms">Terms of Service</a>.</p>
        </section>

        <section>
          <h2>6. Contact</h2>
          <p>Questions about this policy? {supportEmail ? <>Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</> : 'Contact our support team.'}</p>
        </section>
      </div>
    </article>
  )
}
