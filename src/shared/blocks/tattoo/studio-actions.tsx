'use client';

import { useEffect, useRef, useState } from 'react';
import type { useStudio } from '@/hooks/use-studio';
import {
  studioAssetUrl,
  studioClient,
  type StudioRecord,
} from '@/lib/studio-client';
import { Check, Expand, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';

import { Lightbox } from './lightbox';
import { OperationStatus } from './operation-status';
import { StepHelp } from './studio-guidance';

const button =
  'app-action min-h-11 rounded-xl border border-border px-4 py-3 text-base transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40';
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
  const [reconnecting, setReconnecting] = useState(false);
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
    (!studio.pending || studio.busy) &&
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
      {(studio.error || studio.gate === 503) &&
        studio.gate !== 401 &&
        !studio.busy && (
          <p role="status" className="text-primary w-full">
            {studio.error ||
              (zh
                ? '暂时无法读取账户，请重试。'
                : 'Could not read your account. Please retry.')}
            <button
              type="button"
              className={`${button} ml-3`}
              disabled={reconnecting}
              onClick={async () => {
                setReconnecting(true);
                try {
                  await studio.refresh();
                } catch {
                  toast.error(
                    zh
                      ? '连接失败，请稍后重试。'
                      : 'Connection failed. Please retry shortly.'
                  );
                } finally {
                  setReconnecting(false);
                }
              }}
            >
              {zh ? '重试连接' : 'Retry connection'}
            </button>
          </p>
        )}
      {studio.gate && studio.gate !== 401 && studio.gate !== 503 && (
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
  onGenerate,
  activeOperation,
  selectedId,
  phase,
}: {
  current?: boolean;
  showHint?: boolean;
  onDismissHint?: () => void;
  onGenerate?: () => void;
  activeOperation?: 'design' | 'render';
  selectedId?: string;
  phase?: string;
  locale: string;
  prompt: string;
  setPrompt: (value: string) => void;
  onUpload: () => void;
  onPick: (record: StudioRecord) => Promise<void>;
  studio: ReturnType<typeof useStudio>;
  busy: boolean;
}) {
  const zh = locale === 'zh';
  const working = busy && activeOperation === 'design';
  const [libraryPage, setLibraryPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [open, setOpen] = useState(false),
    [records, setRecords] = useState<StudioRecord[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    if (!open || !studio.capabilities?.signedIn) return;
    const abort = new AbortController();
    studioClient
      .collection('designs', abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) {
          setRecords(value.records);
          setLibraryLoading(false);
        }
      })
      .catch((reason) => {
        if (!abort.signal.aborted) {
          setError(reason.message);
          setLibraryLoading(false);
        }
      });
    return () => abort.abort();
  }, [open, studio.capabilities?.signedIn, studio.result, retry]);
  return (
    <div
      id="studio-design-step"
      className="border-b pb-6"
      data-library-open={open || undefined}
    >
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
      <div
        className={`studio-design-sources mt-3 grid grid-cols-3 gap-2 ${current ? 'studio-current-group' : ''}`}
      >
        <button className={button} disabled={busy} onClick={onUpload}>
          {zh ? '上传图案' : 'Upload design'}
        </button>
        <button
          className={button}
          disabled={busy}
          aria-expanded={open}
          onClick={() => {
            if (studio.access()) {
              if (!open) {
                setLibraryLoading(true);
                setError('');
              }
              setOpen(!open);
            }
          }}
        >
          {zh ? '已保存图案' : 'Saved designs'}
        </button>
        <button
          className={button}
          disabled={busy}
          aria-pressed={!open}
          onClick={() => setOpen(false)}
        >
          {zh ? '生成新图案' : 'New design'}
        </button>
      </div>
      <div hidden={open}>
        <label className="mt-4 block text-base" htmlFor="studio-prompt">
          {zh ? '或描述一个新图案' : 'Or describe a new design'}
        </label>
        <textarea
          id="studio-prompt"
          value={prompt}
          maxLength={1000}
          rows={4}
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
          aria-busy={working}
          disabled={busy || !prompt.trim() || !!studio.pending}
          onClick={() => {
            if (onGenerate) onGenerate();
            else studio.generate(prompt);
          }}
        >
          {working && (
            <Loader2
              aria-hidden="true"
              className="mr-2 inline size-4 animate-spin motion-reduce:animate-none"
            />
          )}
          {working
            ? zh
              ? '正在生成纹身图案…'
              : 'Generating design…'
            : zh
              ? '生成纹身图案 · 1 积分'
              : 'Generate design · 1 credit'}
        </button>
        {working && (
          <OperationStatus locale={locale} phase={phase || studio.phase} />
        )}
      </div>
      {open && (
        <div className="mt-4 rounded-xl border p-3">
          <p className="mb-3">
            {zh ? '选择账户中的图案' : 'Choose from your account'}
          </p>
          {error && (
            <div>
              <p role="alert">{error}</p>
              <button
                type="button"
                className={button}
                onClick={() => {
                  setLibraryLoading(true);
                  setError('');
                  setRetry((value) => value + 1);
                }}
              >
                {zh ? '重试' : 'Retry'}
              </button>
            </div>
          )}
          {libraryLoading && (
            <OperationStatus locale={locale} phase="processing" />
          )}
          {!libraryLoading && !error && !records.length && (
            <p className="text-muted-foreground">
              {zh ? '暂无保存的图案。' : 'No saved designs yet.'}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {records
              .slice(libraryPage * 4, libraryPage * 4 + 4)
              .map((record, offset) => {
                const index = libraryPage * 4 + offset;
                return (
                  <div key={record.id} className="relative">
                    <button
                      aria-label={`${zh ? '选择图案' : 'Select design'} ${index + 1}`}
                      aria-pressed={selectedId === record.id}
                      className={`saved-design-choice bg-card w-full rounded-xl border p-2 ${selectedId === record.id ? 'border-primary ring-primary ring-2' : ''}`}
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
                        alt={
                          zh
                            ? `保存的纹身图案 ${index + 1}`
                            : `Saved tattoo design ${index + 1}`
                        }
                        loading="lazy"
                        className="h-28 w-full rounded object-contain"
                      />
                      {selectedId === record.id && (
                        <Check
                          aria-hidden="true"
                          className="bg-primary text-primary-foreground absolute top-2 left-2 size-5 rounded-full p-1"
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`${zh ? '放大图案' : 'Enlarge design'} ${index + 1}`}
                      className="app-action bg-background absolute right-1 bottom-1 rounded-full border p-2"
                      onClick={() => setPreview(index)}
                    >
                      <Expand className="size-4" />
                    </button>
                  </div>
                );
              })}
          </div>
          {records.length > 4 && (
            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
              <button
                className={button}
                disabled={libraryPage === 0}
                onClick={() => setLibraryPage((p) => p - 1)}
              >
                {zh ? '上一页' : 'Previous'}
              </button>
              <span>
                {libraryPage + 1} / {Math.ceil(records.length / 4)}
              </span>
              <button
                className={button}
                disabled={(libraryPage + 1) * 4 >= records.length}
                onClick={() => setLibraryPage((p) => p + 1)}
              >
                {zh ? '下一页' : 'Next'}
              </button>
            </div>
          )}
        </div>
      )}
      <Lightbox
        images={records.map((record, i) => ({
          url: studioAssetUrl(record.image),
          alt: zh ? `保存的纹身图案 ${i + 1}` : `Saved tattoo design ${i + 1}`,
        }))}
        index={preview}
        onIndexChange={setPreview}
        onClose={() => setPreview(null)}
      />
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
  downloading = false,
  current = false,
  activeOperation,
  phase = '',
}: {
  activeOperation?: 'design' | 'render';
  phase?: string;
  locale: string;
  resolution: string;
  setResolution: (value: string) => void;
  onRender: () => void;
  busy: boolean;
  ready: boolean;
  pending: boolean;
  hasResult: boolean;
  onDownload: () => void;
  downloading?: boolean;
  current?: boolean;
  showHint?: boolean;
  onDismissHint?: () => void;
}) {
  const zh = locale === 'zh';
  const working = busy && activeOperation === 'render';
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
              {value} · {i + 1} {zh ? '积分' : `credit${i ? 's' : ''}`}
            </option>
          ))}
        </select>
      </label>
      <button
        className={`${button} border-primary bg-primary text-primary-foreground mt-4 w-full ${current ? 'studio-current-action' : ''}`}
        aria-busy={working}
        disabled={!ready || busy || pending}
        onClick={onRender}
      >
        {working && (
          <Loader2
            aria-hidden="true"
            className="mr-2 inline size-4 animate-spin motion-reduce:animate-none"
          />
        )}
        {working
          ? zh
            ? phase === 'uploading' || phase === 'submitting'
              ? '正在准备真实试戴…'
              : phase === 'loading'
                ? '正在保存并打开结果…'
                : '正在生成真实试戴…'
            : phase === 'uploading' || phase === 'submitting'
              ? 'Preparing try-on…'
              : phase === 'loading'
                ? 'Opening saved result…'
                : 'Generating try-on…'
          : zh
            ? `生成真实试戴 · ${cost} 积分`
            : `Generate real try-on · ${cost} credit${cost > 1 ? 's' : ''}`}
      </button>
      {working && <OperationStatus locale={locale} phase={phase} />}
      <p className="text-muted-foreground mt-3 text-sm">
        {zh
          ? '单张试戴，设计生成另行计费。'
          : 'One try-on. Design generation is charged separately.'}
      </p>
      {hasResult && (
        <button
          className={`${button} mt-4 w-full ${current ? 'studio-current-action' : ''}`}
          disabled={downloading}
          aria-busy={downloading}
          onClick={onDownload}
        >
          {downloading && (
            <Loader2
              aria-hidden="true"
              className="mr-2 inline size-4 animate-spin"
            />
          )}
          {downloading
            ? zh
              ? '正在准备下载…'
              : 'Preparing download…'
            : zh
              ? '下载 AI 结果'
              : 'Download AI result'}
        </button>
      )}
    </div>
  );
}
