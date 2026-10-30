import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import {
  BrandLogo,
  Copyright,
  LocaleSelector,
  ThemeToggler,
} from '@/shared/blocks/common';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { NavItem } from '@/shared/types/blocks/common';
import { Footer as FooterType } from '@/shared/types/blocks/landing';

export function Footer({ footer }: { footer: FooterType }) {
  return (
    <footer
      id={footer.id}
      className={`bg-card/60 border-t py-7 sm:py-9 ${footer.className || ''} overflow-x-hidden`}
      // overflow-x-hidden防止-footer-撑出水平滚动条
    >
      <div className="mx-auto w-full max-w-6xl space-y-5 overflow-x-hidden px-4">
        <div className="grid min-w-0 gap-6 md:grid-cols-5 md:gap-12">
          <div className="min-w-0 space-y-3 break-words md:col-span-3">
            {footer.brand ? (
              <div className="[&_img]:h-10 [&_img]:w-10 [&_img]:rounded-xl [&_img]:bg-white [&_img]:object-contain [&_img]:p-1">
                <BrandLogo
                  brand={{
                    ...footer.brand,
                    logo: {
                      ...footer.brand.logo,
                      src: envConfigs.app_favicon,
                      width: 40,
                      height: 40,
                    },
                  }}
                />
              </div>
            ) : null}

            {footer.brand?.description ? (
              <p
                className="text-muted-foreground max-w-sm text-sm leading-relaxed break-words"
                dangerouslySetInnerHTML={{ __html: footer.brand.description }}
              />
            ) : null}
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-6 md:col-span-2">
            {footer.nav?.items.map((item, idx) => (
              <div key={idx} className="min-w-0 space-y-2 text-sm break-words">
                <span className="block font-medium break-words">
                  {item.title}
                </span>

                <div className="flex min-w-0 flex-col gap-2">
                  {item.children?.map((subItem, iidx) => (
                    <Link
                      key={iidx}
                      href={subItem.url || ''}
                      target={subItem.target || ''}
                      className="text-muted-foreground hover:text-primary block break-words duration-150"
                    >
                      <span className="break-words">{subItem.title || ''}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          aria-hidden
          className="h-px min-w-0 [background-image:linear-gradient(90deg,var(--color-foreground)_1px,transparent_1px)] bg-[length:6px_1px] bg-repeat-x opacity-25"
        />
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-3">
          {footer.copyright ? (
            <p
              className="text-muted-foreground text-sm text-balance break-words"
              dangerouslySetInnerHTML={{ __html: footer.copyright }}
            />
          ) : footer.brand ? (
            <Copyright brand={footer.brand} />
          ) : null}

          <div className="min-w-0 flex-1"></div>

          {footer.agreement ? (
            <div className="flex min-w-0 flex-wrap items-center gap-4">
              {footer.agreement?.items.map((item: NavItem, index: number) => (
                <Link
                  key={index}
                  href={item.url || ''}
                  target={item.target || ''}
                  className="text-muted-foreground hover:text-primary block text-xs break-words underline duration-150"
                >
                  {item.title || ''}
                </Link>
              ))}
            </div>
          ) : null}

          {footer.social ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {footer.social?.items.map((item: NavItem, index) => (
                <Link
                  key={index}
                  href={item.url || ''}
                  target={item.target || ''}
                  className="text-muted-foreground hover:text-primary bg-background block cursor-pointer rounded-full p-2 duration-150"
                  aria-label={item.title || 'Social media link'}
                >
                  {item.icon && (
                    <SmartIcon name={item.icon as string} size={20} />
                  )}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            {footer.show_theme !== false ? (
              <ThemeToggler type="toggle" />
            ) : null}
            {footer.show_locale !== false ? (
              <LocaleSelector type="button" />
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
