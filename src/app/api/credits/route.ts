import { getRemainingCredits } from '@/shared/models/credit';
import { getSignUser } from '@/shared/models/user';

export const dynamic = 'force-dynamic';
export async function GET(): Promise<Response> {
  const user = await getSignUser();
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!user?.id)
    return Response.json({ credits: 0, authenticated: false }, { headers });
  if (!user.emailVerified)
    return Response.json(
      { credits: 0, authenticated: true, verificationRequired: true },
      { headers }
    );
  try {
    return Response.json(
      { credits: await getRemainingCredits(user.id), authenticated: true },
      { headers }
    );
  } catch {
    return Response.json(
      { error: 'Failed to fetch credits' },
      { status: 500, headers }
    );
  }
}
