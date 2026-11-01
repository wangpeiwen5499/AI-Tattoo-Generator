'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import { useAppContext } from '@/shared/contexts/app';
import { useMediaQuery } from '@/shared/hooks/use-media-query';

import { SignInForm } from './sign-in-form';

export function SignModal({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const t = useTranslations('common.sign');
  const { isShowSignModal, setIsShowSignModal } = useAppContext();

  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return (
      <Dialog open={isShowSignModal} onOpenChange={setIsShowSignModal}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl p-6 sm:max-w-[425px] sm:p-8">
          <DialogHeader className="sr-only">
            <DialogTitle>{t('sign_in_title')}</DialogTitle>
            <DialogDescription>{t('sign_in_description')}</DialogDescription>
          </DialogHeader>
          <SignInForm callbackUrl={callbackUrl} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isShowSignModal} onOpenChange={setIsShowSignModal}>
      <DrawerContent className="max-h-[94dvh] overflow-y-auto">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{t('sign_in_title')}</DrawerTitle>
          <DrawerDescription>{t('sign_in_description')}</DrawerDescription>
        </DrawerHeader>
        <SignInForm callbackUrl={callbackUrl} className="px-6 pt-4" />
        <DrawerFooter className="pt-4">
          <DrawerClose asChild>
            <Button variant="outline">{t('cancel_title')}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
