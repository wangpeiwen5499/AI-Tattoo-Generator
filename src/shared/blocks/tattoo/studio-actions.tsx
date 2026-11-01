'use client';

import { useEffect, useRef, useState } from 'react';
import type { useStudio } from '@/hooks/use-studio';
import {
  studioAssetUrl,
  studioClient,
  type StudioRecord,
} from '@/lib/studio-client';

import { Link } from '@/core/i18n/navigation';

const button =
  'min-h-11 rounded-xl border border-border px-4 py-3 text-base transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40';
export function StudioAccount({
  studio,
  locale,
}: {
  studio: ReturnType<typeof useStudio>;
  locale: string;
}) {
  const zh = locale === 'zh';
  const caps = studio.capabilities;
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (studio.gate || studio.error)
      notice.current?.scrollIntoView?.({ block: 'center' });
  }, [studio.gate, studio.error]);
  return (
    <div
      ref={notice}
      className="mb-6 flex flex-wrap items-center justify-between gap-4 border-y py-5 text-base"
    >
      <p>
        {!caps
          ? zh
            ? '正在连接账户…'
            : 'Connecting to your account…'
          : caps.signedIn
            ? `${caps.credits} credits`
            : zh
              ? '注册并验证邮箱，获赠 3 credits'
              : 'Sign up and verify your email for 3 free credits'}
      </p>
      <div className="text-primary flex flex-wrap gap-5">
        <Link href="/designs">{zh ? '我的图案' : 'My designs'}</Link>
        <Link href="/history">{zh ? '试戴历史' : 'History'}</Link>
        <Link
          href={caps?.signedIn ? '/pricing' : '/sign-up?callbackUrl=%2Fstudio'}
        >
          {caps?.signedIn
            ? zh
              ? '购买积分'
              : 'Get credits'
            : zh
              ? '注册 / 登录'
              : 'Create account / sign in'}
        </Link>
      </div>
      {!caps?.configured && caps && (
        <p className="text-muted-foreground w-full">
          {zh
            ? 'AI 服务暂时无法连接，免费摆放仍可使用，请稍后刷新。'
            : 'AI service is currently unavailable. Free placement still works; please refresh shortly.'}
        </p>
      )}
      {studio.pending && !studio.busy && (
        <div className="border-primary/30 w-full rounded-xl border p-4">
          <p>
            {zh
              ? '账户中有一项任务。可返回查看进度，无需重复生成。'
              : 'Your account has a saved task. Resume it without submitting again.'}
          </p>
          <button className={`${button} mt-3`} onClick={studio.resume}>
            {zh ? '查看任务进度' : 'Resume task'}
          </button>
        </div>
      )}
      {(studio.error || studio.busy) && (
        <p role="status" className="text-primary w-full">
          {studio.busy
            ? zh
              ? `正在处理${studio.phase === 'uploading' ? '图片上传' : studio.task?.kind === 'design' ? '纹身图案' : '真实试戴'}… 任务提交后可离开页面，回来后继续查看。`
              : `${studio.phase === 'uploading' ? 'Preparing images' : studio.task?.kind === 'design' ? 'Generating your design' : 'Preparing your try-on'}… Once submitted, your task continues if you leave this page.`
            : studio.error}
        </p>
      )}
      {studio.gate && (
        <div className="border-primary/30 w-full rounded-xl border p-4">
          <p>
            {studio.gate === 401
              ? zh
                ? '请先登录，注册并验证邮箱可获赠 3 credits。'
                : 'Sign in to continue. New accounts receive 3 credits after email verification.'
              : studio.gate === 403
                ? zh
                  ? '请先验证邮箱再生成图片。'
                  : 'Verify your email before generating images.'
                : zh
                  ? '积分不足，请购买积分后继续。'
                  : 'You need more credits to continue.'}
          </p>
          <Link
            className="text-primary mt-3 inline-block underline"
            href={
              studio.gate === 401
                ? '/sign-in?callbackUrl=%2Fstudio'
                : studio.gate === 403
                  ? '/verify-email?callbackUrl=%2Fstudio'
                  : '/pricing'
            }
          >
            {studio.gate === 402
              ? zh
                ? '查看积分包'
                : 'View credit packs'
              : zh
                ? '继续'
                : 'Continue'}
          </Link>
        </div>
      )}
    </div>
  );
}

export function StudioDesigns({
  locale,
  prompt,
  setPrompt,
  onUpload,
  onPick,
  studio,
  busy,
}: {
  locale: string;
  prompt: string;
  setPrompt: (value: string) => void;
  onUpload: () => void;
  onPick: (record: StudioRecord) => Promise<void>;
  studio: ReturnType<typeof useStudio>;
  busy: boolean;
}) {
  const zh = locale === 'zh';
  const [open, setOpen] = useState(false),
    [records, setRecords] = useState<StudioRecord[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    if (!open || !studio.capabilities?.signedIn) return;
    const abort = new AbortController();
    studioClient
      .collection('designs', abort.signal)
      .then((value) => setRecords(value.records))
      .catch((reason) => {
        if (!abort.signal.aborted) setError(reason.message);
      });
    return () => abort.abort();
  }, [open, studio.capabilities?.signedIn, studio.result]);
  return (
    <div className="border-b pb-6">
      <p className="text-primary text-sm">02 / {zh ? '图案' : 'DESIGN'}</p>
      <h2 className="mt-2 text-2xl">
        {zh ? '选择或创作图案' : 'Choose or create a design'}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className={button} disabled={busy} onClick={onUpload}>
          {zh ? '上传图案' : 'Upload design'}
        </button>
        <button
          className={button}
          disabled={busy}
          aria-expanded={open}
          onClick={() => {
            if (studio.access()) setOpen(!open);
          }}
        >
          {zh ? '已保存图案' : 'Saved designs'}
        </button>
      </div>
      <label className="mt-5 block text-base" htmlFor="studio-prompt">
        {zh ? '或描述一个新图案' : 'Or describe a new design'}
      </label>
      <textarea
        id="studio-prompt"
        value={prompt}
        maxLength={1000}
        rows={5}
        disabled={busy}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          zh
            ? '例如：黑灰几何狼头，精细线条，白色背景'
            : 'A geometric wolf, black and grey ink, fine lines on white'
        }
        className="bg-background mt-2 w-full rounded-xl border p-4 text-base leading-7"
      />
      <button
        className={`${button} border-primary text-primary mt-3 w-full`}
        disabled={busy || !prompt.trim() || !!studio.pending}
        onClick={() => studio.generate(prompt)}
      >
        {zh ? '生成纹身图案 · 1 credit' : 'Generate design · 1 credit'}
      </button>
      <p className="text-muted-foreground mt-3 text-sm leading-6">
        {zh
          ? '生成成功后自动保存。复用已有图案和手动摆放免费。'
          : 'New designs are saved automatically. Reusing designs and manual placement are free.'}
      </p>
      {open && (
        <div className="mt-4 rounded-xl border p-3">
          <p className="mb-3">
            {zh ? '选择账户中的图案' : 'Choose from your account'}
          </p>
          {error && <p role="alert">{error}</p>}
          {!records.length && (
            <p className="text-muted-foreground">
              {zh ? '暂无保存的图案。' : 'No saved designs yet.'}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {records.map((record) => (
              <button
                key={record.id}
                className="bg-card rounded-lg border p-2 text-left"
                disabled={busy}
                onClick={() => {
                  void onPick(record)
                    .then(() => setOpen(false))
                    .catch((reason) => setError(reason.message));
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={studioAssetUrl(record.image)}
                  alt={record.name || record.prompt || 'Tattoo design'}
                  loading="lazy"
                  className="h-24 w-full rounded object-contain"
                />
                <span className="mt-2 line-clamp-2 block text-sm">
                  {record.prompt ||
                    record.name ||
                    (zh ? '纹身图案' : 'Tattoo design')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StudioRender({
  locale,
  resolution,
  setResolution,
  onRender,
  busy,
  ready,
  pending,
  hasResult,
  onDownload,
}: {
  locale: string;
  resolution: string;
  setResolution: (value: string) => void;
  onRender: () => void;
  busy: boolean;
  ready: boolean;
  pending: boolean;
  hasResult: boolean;
  onDownload: () => void;
}) {
  const zh = locale === 'zh';
  const cost = resolution === '4K' ? 3 : resolution === '2K' ? 2 : 1;
  return (
    <div>
      <p className="text-primary text-sm">
        03 / {zh ? '确认与生成' : 'PLACE & TRY ON'}
      </p>
      <h2 className="mt-2 text-2xl">
        {zh ? '让图案融入皮肤' : 'Make it feel real'}
      </h2>
      <p className="text-muted-foreground mt-3 text-base leading-7">
        {zh
          ? '先在照片上确认位置、大小和角度。AI 将参考你的摆放，生成一张真实试戴效果。'
          : 'Confirm placement, size and angle on your photo. AI uses your placement to create one realistic tattoo try-on.'}
      </p>
      <label className="mt-4 block">
        {zh ? '结果分辨率' : 'Result resolution'}
        <select
          aria-label={zh ? '结果分辨率' : 'Result resolution'}
          value={resolution}
          disabled={busy}
          onChange={(e) => setResolution(e.target.value)}
          className="bg-background mt-2 w-full rounded-xl border p-3"
        >
          {['1K', '2K', '4K'].map((value, i) => (
            <option key={value} value={value}>
              {value} · {i + 1} credit{i ? 's' : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        className={`${button} border-primary bg-primary text-primary-foreground mt-4 w-full`}
        disabled={!ready || busy || pending}
        onClick={onRender}
      >
        {zh
          ? `生成真实试戴 · ${cost} credit${cost > 1 ? 's' : ''}`
          : `Generate real try-on · ${cost} credit${cost > 1 ? 's' : ''}`}
      </button>
      <p className="text-muted-foreground mt-3 text-sm leading-6">
        {zh
          ? '确认提交时扣费，明确生成失败自动退回本次积分；不会重复生成四个部位。'
          : 'Credits are charged on submission and returned on confirmed generation failure. Each task creates one try-on.'}
      </p>
      {hasResult && (
        <button className={`${button} mt-4 w-full`} onClick={onDownload}>
          {zh ? '下载 AI 结果' : 'Download AI result'}
        </button>
      )}
    </div>
  );
}
