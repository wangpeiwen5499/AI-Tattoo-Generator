'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { authClient } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { safeAuthCallback } from '@/shared/lib/auth-callback';

export function PasswordRecovery({
  mode,
  token = '',
  invalid = false,
  callbackUrl = '/studio',
}: {
  mode: 'request' | 'reset';
  token?: string;
  invalid?: boolean;
  callbackUrl?: string;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const destination = safeAuthCallback(callbackUrl, locale);
  const signInUrl = `/sign-in?callbackUrl=${encodeURIComponent(destination)}`;
  const badLink = mode === 'reset' && (invalid || !token);

  useEffect(() => {
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || badLink || cooldown > 0) return;
    setError('');
    if (mode === 'reset') {
      if (password !== confirmation) {
        setError(t('password_mismatch'));
        return;
      }
      if (password.length < 8 || password.length > 128) {
        setError(t('password_length'));
        return;
      }
    }
    setBusy(true);
    try {
      const result =
        mode === 'request'
          ? await authClient.requestPasswordReset({
              email: email.trim(),
              redirectTo: new URL(
                safeAuthCallback(
                  `/reset-password?callbackUrl=${encodeURIComponent(destination)}`,
                  locale
                ),
                window.location.origin
              ).toString(),
            })
          : await authClient.resetPassword({ token, newPassword: password });
      if (result.error) {
        setError(mode === 'reset' ? t('reset_invalid') : t('reset_failed'));
        return;
      }
      setSuccess(true);
      if (mode === 'request') setCooldown(60);
    } catch {
      setError(t('reset_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-card mx-auto w-full max-w-md rounded-xl border p-6 shadow-sm">
      <h1 className="text-xl font-semibold">
        {t(mode === 'request' ? 'forgot_password' : 'reset_password')}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {t(mode === 'request' ? 'forgot_description' : 'reset_description')}
      </p>
      {badLink ? (
        <div className="mt-6 space-y-4">
          <p role="alert" className="text-sm">
            {t('reset_invalid')}
          </p>
          <Link
            href={`/forgot-password?callbackUrl=${encodeURIComponent(destination)}`}
            className="text-primary text-sm underline"
          >
            {t('send_reset_link')}
          </Link>
        </div>
      ) : success && mode === 'reset' ? (
        <p role="status" className="mt-6 text-sm leading-relaxed">
          {t('reset_success')}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-5">
          {mode === 'request' ? (
            <div className="space-y-2">
              <Label htmlFor="recovery-email">{t('email_title')}</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSuccess(false);
                }}
                required
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('new_password')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-muted-foreground text-xs">
                  {t('password_length')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirmation">
                  {t('confirm_password')}
                </Label>
                <Input
                  id="reset-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          {success && (
            <p role="status" className="text-sm leading-relaxed">
              {t('reset_link_sent')}
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button
            className="w-full"
            type="submit"
            disabled={busy || cooldown > 0}
          >
            {cooldown > 0
              ? `${cooldown}s`
              : t(mode === 'request' ? 'send_reset_link' : 'reset_password')}
          </Button>
        </form>
      )}
      <Link
        href={signInUrl}
        className="text-muted-foreground mt-6 block text-center text-sm underline"
      >
        {t('back_to_sign_in')}
      </Link>
    </section>
  );
}
