'use client';

import { useEffect, useRef, useState } from 'react';
import type { useStudio } from '@/hooks/use-studio';
import {
  studioAssetUrl,
  studioClient,
  type StudioRecord,
} from '@/lib/studio-client';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';

import { StepHelp, StepHint } from './studio-guidance';

const button =
  'min-h-11 rounded-xl border border-border px-4 py-3 text-base transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40';
export function StudioAccount({
  studio,
  locale,
  onSignIn,
}: {
  studio: ReturnType<typeof useStudio>;
  locale: string;
  onSignIn?: () => void;
}) {
  const zh = locale === 'zh';
  const caps = studio.capabilities;
  const notice = useRef<HTMLDivElement>(null);
  const signIn = useRef(onSignIn);
  useEffect(() => {
    signIn.current = onSignIn;
  }, [onSignIn]);
  useEffect(() => {
    if (studio.gate === 401)
      toast.info(
        zh
          ? '请登录后继续，当前设置会保留。'
          : 'Sign in to continue. Your setup will be kept.',
        {
          id: 'studio-sign-in',
          action: {
            label: zh ? '登录' : 'Sign in',
            onClick: () => signIn.current?.(),
          },
        }
      );
  }, [studio.gate, zh]);
  useEffect(() => {
    if (
      (studio.gate && studio.gate !== 401) ||
      (studio.error && studio.gate !== 401)
    )
      notice.current?.scrollIntoView?.({ block: 'center' });
  }, [studio.gate, studio.error]);
  if (
    (!studio.error || studio.gate === 401) &&
    !studio.busy &&
    !studio.pending &&
    (!studio.gate || studio.gate === 401) &&
    (!caps || caps.configured)
  )
    return null;
  return (
    <div
      ref={notice}
      className="mb-6 flex flex-wrap items-center justify-between gap-4 border-y py-5 text-base"
    >
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
      {((studio.error && studio.gate !== 401) || studio.busy) && (
        <p role="status" className="text-primary w-full">
          {studio.busy
            ? zh
              ? `正在处理${studio.phase === 'uploading' ? '图片上传' : studio.task?.kind === 'design' ? '纹身图案' : '真实试戴'}… 任务提交后可离开页面，回来后继续查看。`
              : `${studio.phase === 'uploading' ? 'Preparing images' : studio.task?.kind === 'design' ? 'Generating your design' : 'Preparing your try-on'}… Once submitted, your task continues if you leave this page.`
            : studio.error}
        </p>
      )}
      {studio.gate && studio.gate !== 401 && (
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
  current = false,
  showHint = false,
  onDismissHint = () => {},
  onGenerate,
}: {
  current?: boolean;
  showHint?: boolean;
  onDismissHint?: () => void;
  onGenerate?: () => void;
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
    <div id="studio-design-step" className="border-b pb-6">
      <p className="text-primary text-sm">02 / {zh ? '图案' : 'DESIGN'}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <h2 className="text-2xl">
          {zh ? '选择或创作图案' : 'Choose or create a design'}
        </h2>
        <StepHelp label={zh ? '图案说明' : 'About designs'}>
          {zh
            ? '生成成功后自动保存到账户。上传图案、保存和复用、手动摆放免费。建议使用透明PNG或白底图案。'
            : 'New designs are saved automatically. Reusing designs and manual placement are free. Upload a transparent PNG or a design on white for best results.'}
        </StepHelp>
      </div>
      {showHint && (
        <StepHint locale={locale} onDismiss={onDismissHint}>
          {zh
            ? '上传图案、描述一个新想法，或选择账户中的图案。任选一种即可。'
            : 'Upload a design, describe a new idea, or choose a saved design. Pick whichever works for you.'}
        </StepHint>
      )}
      <div
        className={`mt-4 grid grid-cols-2 gap-2 ${current ? 'studio-current-group' : ''}`}
      >
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
        className={`${button} border-primary text-primary mt-3 w-full ${current && prompt.trim() ? 'studio-current-action' : ''}`}
        disabled={busy || !prompt.trim() || !!studio.pending}
        onClick={() => {
          if (onGenerate) onGenerate();
          else studio.generate(prompt);
        }}
      >
        {zh ? '生成纹身图案 · 1 credit' : 'Generate design · 1 credit'}
      </button>
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
  current = false,
  showHint = false,
  onDismissHint = () => {},
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
  current?: boolean;
  showHint?: boolean;
  onDismissHint?: () => void;
}) {
  const zh = locale === 'zh';
  const cost = resolution === '4K' ? 3 : resolution === '2K' ? 2 : 1;
  return (
    <div id="studio-result-step" className="studio-render-actions">
      <p className="text-primary text-sm">
        04 / {zh ? '真实结果' : 'REAL RESULT'}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <h2 className="text-2xl">
          {zh ? '让图案融入皮肤' : 'Make it feel real'}
        </h2>
        <StepHelp label={zh ? '真实试戴说明' : 'About real try-ons'}>
          {zh
            ? 'AI参考你在照片上的摆放生成一张真实试戴。点击生成即确认当前摆放并扣费；明确生成失败会退回本次积分。AI可能改变细节，请对比原图检查。'
            : 'AI uses your placement to generate one realistic try-on. Generating confirms your placement and charges the displayed credits. Confirmed generation failures return this operation’s credits. Compare with the original to check altered details.'}
        </StepHelp>
      </div>
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
        className={`${button} border-primary bg-primary text-primary-foreground mt-4 w-full ${current ? 'studio-current-action' : ''}`}
        disabled={!ready || busy || pending}
        onClick={onRender}
      >
        {zh
          ? `生成真实试戴 · ${cost} credit${cost > 1 ? 's' : ''}`
          : `Generate real try-on · ${cost} credit${cost > 1 ? 's' : ''}`}
      </button>
      <p className="text-muted-foreground mt-3 text-sm">
        {zh
          ? '单张试戴，设计生成另行计费。'
          : 'One try-on. Design generation is charged separately.'}
      </p>
      {showHint && (
        <StepHint locale={locale} onDismiss={onDismissHint}>
          {hasResult
            ? zh
              ? '结果已保存。对比原图、手动摆放和AI结果，或下载图片。'
              : 'Your result is saved. Compare the original, placement and AI result, or download it.'
            : zh
              ? '确认照片上的位置和大小后，点击生成。只会按按钮所示消耗本次积分。'
              : 'Happy with the placement? Generate one try-on for the credits shown on the button.'}
        </StepHint>
      )}
      {hasResult && (
        <button
          className={`${button} mt-4 w-full ${current ? 'studio-current-action' : ''}`}
          onClick={onDownload}
        >
          {zh ? '下载 AI 结果' : 'Download AI result'}
        </button>
      )}
    </div>
  );
}
