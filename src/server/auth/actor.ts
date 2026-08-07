/**
 * 统一身份：登录用 better-auth user，未登录用 guest_id cookie。
 */
import { cookies } from 'next/headers';
import { getSignUser } from '@/shared/models/user';

export type Actor =
  | { type: 'user'; id: string }
  | { type: 'guest'; id: string };

/** 获取当前请求身份：登录用户 / 游客 cookie / null */
export async function getActor(): Promise<Actor | null> {
  const user = await getSignUser();
  if (user?.id) return { type: 'user', id: user.id };

  const cookieStore = await cookies();
  const guestId = cookieStore.get('guest_id')?.value;
  if (guestId) return { type: 'guest', id: guestId };

  return null;
}
