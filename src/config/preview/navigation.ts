import { studioUrl } from './product';

export function previewNavigation(locale: string) {
  const zh = locale === 'zh';
  const home = zh ? '/zh' : '/';
  const page = (path: string) => `${zh ? '/zh' : ''}${path}`;
  return {
    home,
    menu: zh ? '菜单' : 'Menu',
    close: zh ? '关闭' : 'Close',
    label: zh ? '主导航' : 'Main navigation',
    links: [
      {
        key: 'features',
        label: zh ? '功能' : 'Features',
        href: `${home}#features`,
      },
      { key: 'blog', label: zh ? '博客' : 'Blog', href: page('/blog') },
      {
        key: 'pricing',
        label: zh ? '价格' : 'Pricing',
        href: page('/pricing'),
      },
      {
        key: 'studio',
        label: zh ? '工作室' : 'Studio',
        href: studioUrl(undefined, locale),
      },
      {
        key: 'history',
        label: zh ? '历史记录' : 'History',
        href: studioUrl('history', locale),
      },
      {
        key: 'designs',
        label: zh ? '我的设计' : 'My Designs',
        href: studioUrl('designs', locale),
      },
    ],
  };
}
