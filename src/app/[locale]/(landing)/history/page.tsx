import { accountStudioAllowed } from '@/server/studio/policy';
import { studioCollection } from '@/server/studio/service';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { setRequestLocale } from 'next-intl/server';

import { db } from '@/core/db';
import { Link } from '@/core/i18n/navigation';
import { studioJob } from '@/config/db/schema';
import { DeleteRecordButton } from '@/shared/blocks/tattoo/account-library-pages';
import { getMetadata } from '@/shared/lib/seo';
import { getUserInfo } from '@/shared/models/user';

export const dynamic = 'force-dynamic';

export const generateMetadata = getMetadata({
  title: 'Try-on History — TattooVis',
  description:
    'Your saved AI tattoo try-ons with resolution, time and task status.',
  canonicalUrl: '/history',
  noIndex: true,
});

const JOB_LABELS: Record<string, { zh: string; en: string; tone: string }> = {
  queued: { zh: '排队中', en: 'Queued', tone: 'muted' },
  submitting: { zh: '提交中', en: 'Submitting', tone: 'muted' },
  running: { zh: '生成中', en: 'Running', tone: 'progress' },
  storing: { zh: '保存中', en: 'Saving', tone: 'progress' },
  review_required: {
    zh: '需人工复核',
    en: 'Needs review',
    tone: 'warn',
  },
  failed: {
    zh: '已失败（积分已退回）',
    en: 'Failed (credits returned)',
    tone: 'bad',
  },
};

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const zh = locale === 'zh';

  if (!accountStudioAllowed()) {
    return <AccountHistoryUnavailable locale={locale} />;
  }

  const user = await getUserInfo().catch(() => undefined);

  if (!user) {
    return (
      <main className="pt-28 pb-20">
        <div className="container max-w-3xl">
          <p className="text-primary mb-4 text-sm">
            {zh ? '试戴历史' : 'TRY-ON HISTORY'}
          </p>
          <h1 className="text-4xl font-medium">
            {zh ? '试戴历史' : 'Try-on History'}
          </h1>
          <Link
            href="/history/archive"
            className="text-primary mt-4 inline-block text-sm underline"
          >
            {zh ? '较早的试戴记录' : 'Earlier try-on results'}
          </Link>
          <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-8">
            {zh
              ? '登录后即可查看保存在账户中的单张试戴结果。'
              : 'Sign in to view the single-image try-ons saved to your account.'}
          </p>
          <div className="mt-8">
            <Link
              href="/sign-in?callbackUrl=/history"
              className="bg-primary text-primary-foreground inline-flex rounded-full px-7 py-3 text-sm font-medium"
            >
              {zh ? '登录' : 'Sign in'}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  let unavailable: string | null = null;
  let records: Awaited<ReturnType<typeof studioCollection>> = [];
  let jobs: (typeof studioJob.$inferSelect)[] = [];
  {
    try {
      [records, jobs] = await Promise.all([
        studioCollection(user.id, 'history'),
        db()
          .select()
          .from(studioJob)
          .where(
            and(
              eq(studioJob.userId, user.id),
              or(
                inArray(studioJob.state, [
                  'queued',
                  'submitting',
                  'running',
                  'storing',
                  'review_required',
                ]),
                and(eq(studioJob.state, 'failed'), eq(studioJob.refunded, true))
              )
            )
          )
          .orderBy(desc(studioJob.createdAt))
          .limit(20),
      ]);
    } catch {
      unavailable = zh
        ? '暂时无法读取账户历史，请稍后刷新重试。'
        : 'Could not load your account history right now. Retry shortly.';
    }
  }

  return (
    <main className="pt-28 pb-20">
      <div className="container">
        <p className="text-primary mb-4 text-sm">
          {zh ? '试戴历史' : 'TRY-ON HISTORY'}
        </p>
        <h1 className="text-4xl font-medium">
          {zh ? '试戴历史' : 'Try-on History'}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-8">
          {zh
            ? '每次试戴生成一张结果，成功后自动保存在这里；生成中的任务会显示状态，失败会退回积分。'
            : 'Each try-on produces one image, saved here automatically on success. In-progress tasks show their status; failures return their credits.'}
        </p>
        {unavailable ? (
          <p
            className="bg-muted text-muted-foreground mt-8 rounded-xl border p-5"
            role="note"
          >
            {unavailable}
          </p>
        ) : (
          <>
            {jobs.length > 0 && (
              <ul className="mt-8 space-y-3">
                {jobs.map((job) => {
                  const label = JOB_LABELS[job.state] ?? {
                    zh: job.state,
                    en: job.state,
                    tone: 'muted',
                  };
                  return (
                    <li
                      key={job.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                        label.tone === 'bad'
                          ? 'border-destructive/40'
                          : label.tone === 'warn'
                            ? 'border-primary/40'
                            : ''
                      }`}
                    >
                      <span className="text-sm">
                        {job.kind === 'design'
                          ? zh
                            ? '设计生成'
                            : 'Design generation'
                          : zh
                            ? '单张试戴'
                            : 'Single try-on'}
                        {' · '}
                        {job.resolution} ·{' '}
                        {new Date(job.createdAt).toLocaleString(
                          zh ? 'zh-CN' : 'en-US'
                        )}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          label.tone === 'bad'
                            ? 'text-destructive'
                            : label.tone === 'progress'
                              ? 'text-primary'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {label[zh ? 'zh' : 'en']}
                      </span>
                    </li>
                  );
                })}
                <li>
                  <Link
                    href="/studio"
                    className="text-primary text-sm underline underline-offset-4"
                  >
                    {zh
                      ? '回到工作室查看任务进度'
                      : 'Open the studio to follow task progress'}
                  </Link>
                </li>
              </ul>
            )}
            {records.length === 0 ? (
              <p className="bg-muted text-muted-foreground mt-8 rounded-xl border p-5">
                {zh
                  ? '还没有保存的试戴结果。完成一次生成后，结果会自动出现在这里。'
                  : 'No saved try-ons yet. Results appear here automatically after a successful generation.'}
              </p>
            ) : (
              <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {records.map((record) => (
                  <li
                    key={record.id}
                    className="bg-card flex flex-col rounded-2xl border p-4"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/studio?asset=${encodeURIComponent(record.image)}`}
                      alt={zh ? '试戴结果' : 'Try-on result'}
                      className="bg-muted h-56 w-full rounded-xl object-contain"
                      loading="lazy"
                    />
                    <h2 className="mt-4 font-medium">
                      {zh ? '试戴结果' : 'Try-on result'} · {record.resolution}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {new Date(record.createdAt).toLocaleString(
                        zh ? 'zh-CN' : 'en-US'
                      )}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                      <Link
                        href={`/studio?history=${record.id}`}
                        className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-full px-5 text-sm font-medium"
                      >
                        {zh ? '查看对比' : 'View comparison'}
                      </Link>
                      <a
                        href={`/api/studio?asset=${encodeURIComponent(record.image)}`}
                        download
                        className="inline-flex min-h-11 items-center rounded-full border px-5 text-sm"
                      >
                        {zh ? '下载' : 'Download'}
                      </a>
                      <DeleteRecordButton
                        collection="history"
                        id={record.id}
                        label={zh ? '删除' : 'Delete'}
                        confirmLabel={zh ? '确认删除' : 'Confirm'}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function AccountHistoryUnavailable({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  return (
    <main className="pt-28 pb-20">
      <div className="container max-w-3xl">
        <p className="text-primary mb-4 text-sm">
          {zh ? '试戴历史' : 'TRY-ON HISTORY'}
        </p>
        <h1 className="text-4xl font-medium">
          {zh ? '试戴历史' : 'Try-on History'}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-8">
          {zh
            ? '当前环境未启用账户历史：需要为预发配置隔离的数据库与存储（PREVIEW_STUDIO_ISOLATED）。配置完成前不会回退到浏览器本地保存。'
            : 'The account history is not enabled in this environment: an isolated Preview database and storage must be configured first (PREVIEW_STUDIO_ISOLATED). There is no fallback to browser-local storage.'}
        </p>
      </div>
    </main>
  );
}
