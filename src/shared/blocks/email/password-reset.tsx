export function PasswordResetEmail({ url }: { url: string }) {
  return (
    <div
      style={{
        fontFamily: 'Georgia, serif',
        maxWidth: 480,
        margin: '0 auto',
        padding: 32,
        color: '#18181b',
      }}
    >
      <h1>Reset your TattooVis password</h1>
      <p>
        Use the link below to choose a new password. This link expires in 30
        minutes and can only be used once.
      </p>
      <a
        href={url}
        style={{
          display: 'inline-block',
          backgroundColor: '#6554ee',
          color: '#ffffff',
          padding: '14px 24px',
          borderRadius: 8,
        }}
      >
        Reset password
      </a>
      <p>
        If you did not request a password reset, you can ignore this email. Your
        password will stay the same.
      </p>
    </div>
  );
}
