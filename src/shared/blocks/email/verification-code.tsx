interface VerificationCodeProps {
  code: string;
  title?: string;
  description?: string;
  ctaText?: string;
}

export function VerificationCode({
  code,
  title = 'Verify Your Email',
  description = 'Use the verification code below to verify your email address.',
}: VerificationCodeProps) {
  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '480px',
        margin: '0 auto',
        padding: '32px 24px',
        backgroundColor: '#ffffff',
      }}
    >
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: '#09090b',
          margin: '0 0 8px',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: '16px',
          color: '#71717a',
          lineHeight: 1.6,
          margin: '0 0 24px',
        }}
      >
        {description}
      </p>
      <div
        style={{
          display: 'inline-block',
          backgroundColor: '#f4f4f5',
          padding: '16px 40px',
          borderRadius: '12px',
          fontSize: '32px',
          fontWeight: 700,
          color: '#18181b',
          letterSpacing: '6px',
          textAlign: 'center',
          fontFamily: 'monospace',
        }}
      >
        {code}
      </div>
      <p
        style={{
          fontSize: '13px',
          color: '#a1a1aa',
          margin: '24px 0 0',
          lineHeight: 1.5,
        }}
      >
        If you didn&apos;t create an account with AI Tattoo Generator, you can
        safely ignore this email.
      </p>
    </div>
  );
}
