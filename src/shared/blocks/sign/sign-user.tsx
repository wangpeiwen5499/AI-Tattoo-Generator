'use client';

import { useEffect, useRef, useState } from 'react';
import { Fragment } from 'react/jsx-runtime';
import { Coins, LayoutDashboard, Loader2, LogOut, User } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { signOut, useSession } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';
import { User as UserType } from '@/shared/models/user';
import { NavItem, UserNav } from '@/shared/types/blocks/common';

import { SmartIcon } from '../common/smart-icon';
import { SignModal } from './sign-modal';

export function SignUser({
  isScrolled,
  signButtonSize = 'sm',
  userNav,
}: {
  isScrolled?: boolean;
  signButtonSize?: 'default' | 'sm' | 'lg' | 'icon';
  userNav?: UserNav;
}) {
  const t = useTranslations('common.sign');
  const zh = useLocale() === 'zh';
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // get app context values
  const {
    configs,
    fetchConfigs,
    setIsShowSignModal,
    isCheckSign,
    setIsCheckSign,
    user,
    setUser,
    fetchUserInfo,
    fetchUserCredits,
    showOneTap,
  } = useAppContext();
  useEffect(() => {
    const refresh = () => void fetchUserCredits();
    window.addEventListener('studio-credits-changed', refresh);
    return () => window.removeEventListener('studio-credits-changed', refresh);
  }, [fetchUserCredits]);

  // get session
  const { data: session, isPending } = useSession();

  // one tap initialized
  const oneTapInitialized = useRef(false);

  // set is check sign
  useEffect(() => {
    setIsCheckSign(isPending);
  }, [isPending]);

  // show one tap if not initialized
  useEffect(() => {
    if (!isPending && !Object.values(configs).length) {
      fetchConfigs();
    }

    if (
      configs &&
      configs.google_client_id &&
      configs.google_one_tap_enabled === 'true' &&
      !session &&
      !isPending &&
      !oneTapInitialized.current
    ) {
      oneTapInitialized.current = true;
      showOneTap(configs);
    }
  }, [configs, session, isPending]);

  // set user
  useEffect(() => {
    const sessionUser = session?.user;
    const currentUserId = user?.id;
    const sessionUserId = sessionUser?.id;

    if (sessionUser && sessionUserId !== currentUserId) {
      setUser(sessionUser as UserType);
      fetchUserInfo();
    } else if (!sessionUser && currentUserId) {
      setUser(null);
    }
  }, [session?.user?.id, user?.id]);

  return (
    <>
      {isCheckSign || !mounted ? (
        <div>
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : user ? (
        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="rounded-full border px-3 py-2 text-sm whitespace-nowrap"
            aria-label={zh ? '积分余额与购买' : 'Credit balance and packs'}
          >
            {user.credits?.remainingCredits ?? '…'} credits
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full p-0"
              >
                <Avatar>
                  <AvatarImage src={user.image || ''} alt={user.name || ''} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {userNav?.show_name && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      className="w-full cursor-pointer"
                      href="/settings/profile"
                    >
                      <User />
                      {user.name}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {userNav?.show_credits && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      className="w-full cursor-pointer"
                      href="/settings/credits"
                    >
                      <Coins />
                      {t('credits_title', {
                        credits: user.credits?.remainingCredits || 0,
                      })}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {userNav?.items?.map((item: NavItem, idx: number) => (
                <Fragment key={idx}>
                  <DropdownMenuItem asChild>
                    <Link
                      className="w-full cursor-pointer"
                      href={item.url || ''}
                      target={item.target || '_self'}
                    >
                      {item.icon && (
                        <SmartIcon
                          name={item.icon as string}
                          className="h-4 w-4"
                        />
                      )}
                      {item.title}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </Fragment>
              ))}

              {user.isAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link className="w-full cursor-pointer" href="/admin">
                      <LayoutDashboard />
                      {t('admin_title')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {userNav?.show_sign_out && (
                <DropdownMenuItem
                  className="w-full cursor-pointer"
                  onClick={() =>
                    signOut({
                      fetchOptions: {
                        onSuccess: () => {
                          router.push('/');
                        },
                      },
                    })
                  }
                >
                  <LogOut />
                  <span>{t('sign_out_title')}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
          <Button
            type="button"
            size={signButtonSize}
            className={cn(
              'border-foreground/10 ml-4 h-11 cursor-pointer rounded-full px-6 ring-0',
              isScrolled && 'lg:hidden'
            )}
            onClick={() => setIsShowSignModal(true)}
          >
            <span>{t('sign_in_title')}</span>
          </Button>
          <SignModal />
        </div>
      )}
    </>
  );
}
