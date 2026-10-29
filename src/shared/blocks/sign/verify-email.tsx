'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { authClient } from '@/core/auth/client';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { safeAuthCallback } from '@/shared/lib/auth-callback';

export function VerifyEmail({
  initialEmail = '',
  callbackUrl = '/generate',
  alreadySent = false,
}: {
  initialEmail?: string;
  callbackUrl?: string;
  alreadySent?: boolean;
}) {
  const t = useTranslations('common.funnel');
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(alreadySent);
  const [cooldown, setCooldown] = useState(alreadySent ? 60 : 0);
  const [busy, setBusy] = useState(false);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  useEffect(() => {
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, []);

  async function sendCode() {
    if (busy || cooldown > 0 || !validEmail) return;
    setBusy(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: 'email-verification',
      });
      if (result.error) {
        toast.error(result.error.message || t('sendFailed'));
        return;
      }
      setSent(true);
      setCooldown(60);
      toast.success(t('codeSent'));
    } catch {
      toast.error(t('sendFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !validEmail || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      const result = await authClient.emailOtp.verifyEmail({
        email: email.trim(),
        otp: code,
      });
      if (result.error) {
        toast.error(result.error.message || t('verificationFailed'));
        return;
      }
      await authClient
        .getSession({ query: { disableCookieCache: true } })
        .catch(() => null);
      toast.success(t('verified'));
      router.replace(safeAuthCallback(callbackUrl, locale));
      router.refresh();
    } catch {
      toast.error(t('verificationFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card mx-auto w-full max-w-md rounded-xl border p-6 shadow-sm">
      <h1 className="text-xl font-semibold">{t('verifyPageTitle')}</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {t('verifyPageDescription')}
      </p>
      <form onSubmit={verify} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="verification-email">{t('emailLabel')}</Label>
          <Input
            id="verification-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy || cooldown > 0 || !validEmail}
          onClick={sendCode}
        >
          {cooldown > 0
            ? t('resendWait', { seconds: cooldown })
            : sent
              ? t('resendCode')
              : t('sendCode')}
        </Button>
        <div className="space-y-2">
          <Label htmlFor="verification-code">{t('codeLabel')}</Label>
          <Input
            id="verification-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            required
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={busy || !validEmail || !/^\d{6}$/.test(code)}
        >
          {t('verifyCode')}
        </Button>
      </form>
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        {t('oneTimeNote')}
      </p>
    </div>
  );
}
