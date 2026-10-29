import { getSignUser } from '@/shared/models/user';

export async function requireGenerationUser(): Promise<
  | {
      user: NonNullable<Awaited<ReturnType<typeof getSignUser>>>;
      response?: never;
    }
  | { user?: never; response: Response }
> {
  const user = await getSignUser();
  if (!user?.id)
    return {
      response: Response.json(
        {
          error: 'Sign in to generate with your own photo.',
          code: 'SIGN_IN_REQUIRED',
        },
        { status: 401 }
      ),
    };
  if (!user.emailVerified)
    return {
      response: Response.json(
        {
          error: 'Verify your email before using credits.',
          code: 'EMAIL_VERIFICATION_REQUIRED',
        },
        { status: 403 }
      ),
    };
  return { user };
}
