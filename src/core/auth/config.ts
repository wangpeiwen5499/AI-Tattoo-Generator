import { claimRegistrationAttempt } from '@/server/db/guest-queries';
import { APIError } from 'better-auth/api';
import { emailOTP, genericOAuth, oneTap } from 'better-auth/plugins';
import { getLocale } from 'next-intl/server';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import {
  getCookieFromCtx,
  getHeaderValue,
  guessLocaleFromAcceptLanguage,
} from '@/shared/lib/cookie';
import { getUuid } from '@/shared/lib/hash';
import { getClientIp } from '@/shared/lib/ip';
import { grantRoleForNewUser } from '@/shared/services/rbac';

import { getClerkNativeConfig, getClerkOAuthConfig } from './clerk';
import { clerkSessionBridge } from './clerk-bridge';
import { createAuthDatabase } from './trial-adapter';

// Static auth options - NO database connection
// This ensures zero database calls during build time
const authOptions = {
  appName: envConfigs.app_name,
  baseURL: envConfigs.auth_url,
  secret: envConfigs.auth_secret,
  trustedOrigins: envConfigs.app_url ? [envConfigs.app_url] : [],
  user: {
    // Allow persisting custom columns on user table.
    // Without this, better-auth may ignore extra properties during create/update.
    additionalFields: {
      utmSource: {
        type: 'string' as const,
        // Not user-editable input; we set it internally.
        input: false,
        required: false,
        defaultValue: '',
      },
      ip: {
        type: 'string' as const,
        input: false,
        required: false,
        defaultValue: '',
      },
      locale: {
        type: 'string' as const,
        input: false,
        required: false,
        defaultValue: '',
      },
    },
  },
  advanced: {
    database: {
      generateId: () => getUuid(),
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  logger: {
    verboseLogging: false,
    // Disable all logs during build and production
    disabled: true,
  },
};

// get auth options with configs
export async function getAuthOptions(configs: Record<string, string>) {
  return {
    ...authOptions,
    // Add database connection only when actually needed (runtime)
    database: envConfigs.database_url
      ? createAuthDatabase(
          db(),
          getDatabaseProvider(envConfigs.database_provider)
        )
      : null,
    databaseHooks: {
      user: {
        create: {
          before: async (user: any, ctx: any) => {
            const forwardedIp =
              getHeaderValue(ctx, 'cf-connecting-ip') ||
              getHeaderValue(ctx, 'x-real-ip') ||
              getHeaderValue(ctx, 'x-forwarded-for')?.split(',')[0]?.trim();
            const signupIp =
              forwardedIp ||
              (await getClientIp().catch(() => 'unknown')) ||
              'unknown';
            if ((await claimRegistrationAttempt(signupIp)) < 0)
              throw new APIError('TOO_MANY_REQUESTS', {
                message:
                  'Daily account creation limit reached. Please try again tomorrow.',
              });
            try {
              const ip = await getClientIp();
              if (ip) {
                user.ip = ip;
              }

              // Prefer NEXT_LOCALE cookie (next-intl). Fallback to accept-language.
              const localeFromCookie = getCookieFromCtx(ctx, 'NEXT_LOCALE');

              const localeFromHeader = guessLocaleFromAcceptLanguage(
                getHeaderValue(ctx, 'accept-language')
              );

              const locale =
                (localeFromCookie || localeFromHeader || (await getLocale())) ??
                '';

              if (locale && typeof locale === 'string') {
                user.locale = locale.slice(0, 20);
              }

              // Only set on first creation; never overwrite later.
              if (user?.utmSource) return { data: user };

              const raw = getCookieFromCtx(ctx, 'utm_source');
              if (!raw || typeof raw !== 'string') return { data: user };

              // Keep it small & safe.
              const decoded = decodeURIComponent(raw).trim();
              const sanitized = decoded
                .replace(/[^\w\-.:]/g, '') // allow a-zA-Z0-9_ - . :
                .slice(0, 100);

              if (sanitized) {
                user.utmSource = sanitized;
              }
            } catch {
              // best-effort only
            }
            return { data: user };
          },
          after: async (user: any) => {
            try {
              if (!user.id) {
                throw new Error('user id is required');
              }

              // grant role for new user
              await grantRoleForNewUser(user);
            } catch (e) {
              console.log('grant role for new user failed', e);
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: configs.email_auth_enabled !== 'false',
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({
        user,
        url,
      }: {
        user: { email: string };
        url: string;
      }) {
        if (!configs.resend_api_key || !configs.resend_sender_email)
          throw new APIError('SERVICE_UNAVAILABLE', {
            message: 'Password recovery is temporarily unavailable.',
          });
        const { getEmailService } = await import('@/shared/services/email');
        const { PasswordResetEmail } =
          await import('@/shared/blocks/email/password-reset');
        const result = await (
          await getEmailService(configs)
        ).sendEmail({
          to: user.email,
          subject: 'Reset your password — TattooVis',
          text: `Reset your TattooVis password using this link (valid for 30 minutes):\n${url}\n\nIf you did not request this, ignore this email.`,
          react: PasswordResetEmail({ url }),
        });
        if (!result.success)
          throw new APIError('SERVICE_UNAVAILABLE', {
            message:
              'Unable to send password reset email. Please try again later.',
          });
      },
    },
    emailVerification: { autoSignInAfterVerification: true },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      customRules: {
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
        '/reset-password': { window: 60, max: 5 },
      },
    },
    socialProviders: await getSocialProviders(configs),
    plugins: await getAuthPlugins(configs),
  };
}

// get social providers with configs
export async function getSocialProviders(configs: Record<string, string>) {
  const providers: any = {};

  // google auth
  if (configs.google_client_id && configs.google_client_secret) {
    providers.google = {
      clientId: configs.google_client_id,
      clientSecret: configs.google_client_secret,
    };
  }

  // github auth
  if (configs.github_client_id && configs.github_client_secret) {
    providers.github = {
      clientId: configs.github_client_id,
      clientSecret: configs.github_client_secret,
    };
  }

  return providers;
}

// convert database provider to better-auth database provider
export function getDatabaseProvider(
  provider: string
): 'sqlite' | 'pg' | 'mysql' {
  switch (provider) {
    case 'sqlite':
      return 'sqlite';
    case 'postgresql':
      return 'pg';
    case 'mysql':
      return 'mysql';
    default:
      throw new Error(
        `Unsupported database provider for auth: ${envConfigs.database_provider}`
      );
  }
}

// get auth plugins based on configs
async function getAuthPlugins(configs: Record<string, string>) {
  const plugins: Array<
    | ReturnType<typeof oneTap>
    | ReturnType<typeof emailOTP>
    | ReturnType<typeof genericOAuth>
    | ReturnType<typeof clerkSessionBridge>
  > = [];

  const nativeClerk = getClerkNativeConfig();
  if (nativeClerk) plugins.push(clerkSessionBridge(nativeClerk));

  const clerk = getClerkOAuthConfig();
  if (clerk) plugins.push(genericOAuth({ config: [clerk] }));

  // Google One Tap
  if (configs.google_client_id && configs.google_one_tap_enabled === 'true') {
    plugins.push(oneTap());
  }

  // Email Verification — only if email service is configured
  const resendApiKey = configs.resend_api_key;
  const senderEmail = configs.resend_sender_email;

  {
    plugins.push(
      emailOTP({
        sendVerificationOnSignUp: true,
        disableSignUp: true,
        storeOTP: 'hashed',
        allowedAttempts: 5,
        rateLimit: { window: 60, max: 3 },
        async sendVerificationOTP({ email, otp, type }) {
          // Only send verification email for sign-up; skip for sign-in
          if (type !== 'email-verification') {
            throw new APIError('BAD_REQUEST', {
              message: 'Use email and password to sign in.',
            });
          }
          if (!resendApiKey || !senderEmail)
            throw new APIError('SERVICE_UNAVAILABLE', {
              message:
                'Email verification is temporarily unavailable. Please try again later.',
            });

          // Dynamically import email service to avoid build-time issues
          const { getEmailService } = await import('@/shared/services/email');
          const { VerificationCode } =
            await import('@/shared/blocks/email/verification-code');

          const emailService = await getEmailService(configs);

          if (!emailService.getProvider('resend'))
            throw new APIError('SERVICE_UNAVAILABLE', {
              message: 'Email verification is temporarily unavailable.',
            });

          const result = await emailService.sendEmail({
            to: email,
            subject: 'Verify your email — AI Tattoo Generator',
            react: VerificationCode({
              code: otp,
              title: 'Verify Your Email',
              description:
                'Use the verification code below to activate your AI Tattoo Generator account.',
              ctaText: otp,
            }),
          });
          if (!result.success)
            throw new APIError('SERVICE_UNAVAILABLE', {
              message:
                'Unable to send verification email. Please try again later.',
            });
        },
      })
    );
  }

  return plugins;
}
