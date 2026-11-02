import { studioCollectionPage } from '@/server/studio/library';
import { accountStudioAllowed } from '@/server/studio/policy';
import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import {
  DeleteRecordButton,
  LocalDate,
  RenameRecordButton,
} from '@/shared/blocks/tattoo/account-library-pages';
import { LibraryImage } from '@/shared/blocks/tattoo/library-image';
import { LibraryNavigation } from '@/shared/blocks/tattoo/library-navigation';
import { getMetadata } from '@/shared/lib/seo';
import { getUserInfo } from '@/shared/models/user';

export const dynamic = 'force-dynamic';

export const generateMetadata = getMetadata({
  title: 'My Designs — TattooVis',
  description:
    'Your saved tattoo designs: reuse them in the studio, download them, or remove them.',
  canonicalUrl: '/designs',
  noIndex: true,
});

const SOURCE_LABELS = {
  generated: { zh: 'AI 生成', en: 'AI generated' },
  uploaded: { zh: '上传', en: 'Uploaded' },
  sample: { zh: '示例', en: 'Sample' },
} as const;

export default async function DesignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; q?: string; source?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const zh = locale === 'zh';

  if (!accountStudioAllowed()) {
    return <AccountLibraryUnavailable locale={locale} kind="designs" />;
  }

  let user;
  try {
    user = await getUserInfo();
  } catch {
    return (
      <main className="container pt-28 pb-20">
        <h1 className="text-4xl font-medium">
          {zh ? '账户暂时不可用' : 'Account temporarily unavailable'}
        </h1>
        <p className="mt-5" role="alert">
          {zh
            ? '无法验证账户，请刷新页面重试。'
            : 'Could not verify your account. Refresh this page to retry.'}
        </p>
        <Link href="/designs" className="mt-5 inline-block underline">
          {zh ? '重试' : 'Retry'}
        </Link>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="pt-28 pb-20">
        <div className="container max-w-3xl">
          <h1 className="text-4xl font-medium">
            {zh ? '我的图案' : 'My Designs'}
          </h1>
          <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-8">
            {zh
              ? '登录后即可查看保存在账户中的设计，并在任意设备上复用。'
              : 'Sign in to view the designs saved to your account and reuse them on any device.'}
          </p>
          <div className="mt-8">
            <Link
              href="/sign-in?callbackUrl=/designs"
              className="app-action app-action-primary bg-primary text-primary-foreground inline-flex rounded-full px-7 py-3 text-sm font-medium"
            >
              {zh ? '登录' : 'Sign in'}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  let unavailable: string | null = null;
  const query = (await searchParams) || {};
  let listing: Awaited<ReturnType<typeof studioCollectionPage>> = {
    records: [],
    total: 0,
    page: 1,
    pages: 1,
    q: query.q || '',
    source: query.source || '',
  };
  let records: typeof listing.records = [];
  try {
    listing = await studioCollectionPage(user.id, 'designs', query);
    records = listing.records;
  } catch {
    unavailable = zh
      ? '暂时无法读取账户图库，请稍后刷新重试。'
      : 'Could not load your account library right now. Retry shortly.';
  }

  return (
    <main className="pt-28 pb-20">
      <div className="container">
        <h1 className="text-4xl font-medium">
          {zh ? '我的图案' : 'My Designs'}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-8">
          {zh
            ? '保存到账户的设计可跨设备复用：在工作室继续摆放，或下载留存。'
            : 'Designs saved to your account are reusable across devices: keep placing them in the studio or download a copy.'}
        </p>
        {!unavailable && (
          <LibraryNavigation kind="designs" locale={locale} listing={listing} />
        )}
        {unavailable ? (
          <p
            className="bg-muted text-muted-foreground mt-8 rounded-xl border p-5"
            role="note"
          >
            {unavailable}
          </p>
        ) : records.length === 0 &&
          (listing.q || listing.source) ? null : records.length === 0 ? (
          <p className="bg-muted text-muted-foreground mt-8 rounded-xl border p-5">
            {zh
              ? '还没有保存的图案。上传或生成一个设计后，它会自动出现在这里。'
              : 'No saved designs yet. Upload or generate a design and it will appear here.'}
          </p>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((record) => (
              <li
                key={record.id}
                className="bg-card flex flex-col rounded-2xl border p-4"
              >
                <LibraryImage
                  src={`/api/studio?asset=${encodeURIComponent(record.image)}`}
                  alt={record.name || (zh ? '保存的图案' : 'Saved design')}
                  className="bg-muted h-48 w-full rounded-xl object-contain"
                />
                <h2 className="mt-4 font-medium">
                  {record.name ||
                    record.prompt?.slice(0, 60) ||
                    (zh ? '未命名图案' : 'Untitled design')}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {SOURCE_LABELS[
                    (record.source as keyof typeof SOURCE_LABELS) || 'uploaded'
                  ]?.[zh ? 'zh' : 'en'] ?? record.source}
                  {' · '}
                  <LocalDate value={new Date(record.createdAt).toISOString()} />
                </p>
                {record.prompt ? (
                  <p
                    className="text-muted-foreground mt-3 line-clamp-3 text-sm leading-6"
                    lang="en"
                  >
                    {record.prompt}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                  <Link
                    href={`/studio?design=${record.id}`}
                    className="app-action app-action-primary bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-full px-5 text-sm font-medium"
                  >
                    {zh ? '在工作室使用' : 'Use in studio'}
                  </Link>
                  <a
                    href={`/api/studio?asset=${encodeURIComponent(record.image)}`}
                    download
                    className="app-action inline-flex min-h-11 items-center rounded-full border px-5 text-sm"
                  >
                    {zh ? '下载' : 'Download'}
                  </a>
                  <RenameRecordButton
                    collection="designs"
                    id={record.id}
                    name={
                      record.name ||
                      record.prompt?.slice(0, 60) ||
                      (zh ? '未命名记录' : 'Untitled record')
                    }
                  />
                  <DeleteRecordButton
                    collection="designs"
                    id={record.id}
                    label={zh ? '删除' : 'Delete'}
                    confirmLabel={zh ? '确认删除' : 'Confirm'}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function AccountLibraryUnavailable({
  locale,
  kind,
}: {
  locale: string;
  kind: 'designs' | 'history';
}) {
  const zh = locale === 'zh';
  return (
    <main className="pt-28 pb-20">
      <div className="container max-w-3xl">
        <h1 className="text-4xl font-medium">
          {kind === 'designs'
            ? zh
              ? '我的图案'
              : 'My Designs'
            : zh
              ? '试戴历史'
              : 'Try-on History'}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-8">
          {zh
            ? '当前环境未启用账户图库：需要为预发配置隔离的数据库与存储（PREVIEW_STUDIO_ISOLATED）。配置完成前不会回退到浏览器本地保存。'
            : 'The account library is not enabled in this environment: an isolated Preview database and storage must be configured first (PREVIEW_STUDIO_ISOLATED). There is no fallback to browser-local storage.'}
        </p>
      </div>
    </main>
  );
}
