'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudio } from '@/hooks/use-studio';
import {
  canvasBlob,
  loadDesign,
  loadPhoto,
  loadSample,
  photoCanvas,
} from '@/lib/manual-images';
import {
  constrainPlacement,
  defaultPlacement,
  drawManual,
  geometryFor,
  pointOnPhoto,
  transformGesture,
  type Placement,
  type Point,
} from '@/lib/manual-placement';
import { studioClient, type StudioRecord } from '@/lib/studio-client';
import {
  assetImage,
  imageBlob,
  photoBlob,
  placementRegion,
} from '@/lib/studio-images';

import { StudioAccount, StudioDesigns, StudioRender } from './studio-actions';

const button =
  'rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 disabled:cursor-not-allowed';

export function ManualEditor({
  locale,
  initialDesignId,
  initialHistoryId,
}: {
  locale: string;
  initialDesignId?: string;
  initialHistoryId?: string;
}) {
  const zh = locale === 'zh';
  const t = useCallback((en: string, cn: string) => (zh ? cn : en), [zh]);
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [design, setDesign] = useState<HTMLImageElement | null>(null);
  const [placement, setPlacement] = useState(defaultPlacement);
  const [original, setOriginal] = useState(false);
  const [menu, setMenu] = useState(false);
  const [ink, setInk] = useState(false);
  const [loading, setBusy] = useState(!!initialDesignId || !!initialHistoryId);
  const studio = useStudio();
  const [loadedResult, setLoadedResult] = useState<typeof studio.result>(null);
  const busy =
    loading ||
    studio.busy ||
    (!!studio.result && studio.result !== loadedResult);
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('1K');
  const [designRecord, setDesignRecord] = useState<StudioRecord | null>(null);
  const [aiSelected, setAiSelected] = useState(false);
  const [renderResult, setRenderResult] = useState<{
    raw: HTMLImageElement;
    original: HTMLCanvasElement;
    draft: HTMLCanvasElement;
  } | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const designInput = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const pointers = useRef(new Map<number, Point>());
  const drag = useRef<{
    mode: string;
    points: Point[];
    placement: Placement;
  } | null>(null);
  const viewerPointers = useRef(new Map<number, Point>());
  const viewerDrag = useRef<{
    points: Point[];
    zoom: number;
    pan: Point;
  } | null>(null);
  const update = (p: Placement) => {
    if (busy) return;
    setPlacement(constrainPlacement(p));
    setAiSelected(false);
  };

  async function pickDesign(record: StudioRecord) {
    await run(async () => {
      const ticket = revision.current;
      const image = await assetImage(record.image);
      if (ticket !== revision.current) return;
      setDesign(image);
      setDesignRecord(record);
      setPrompt(record.prompt || '');
      setPlacement(defaultPlacement());
      setOriginal(false);
      setAiSelected(false);
      setRenderResult(null);
    });
  }
  useEffect(() => {
    if (!studio.result) return;
    let cancelled = false;
    const ticket = ++revision.current;
    const { kind, record } = studio.result;
    (async () => {
      if (kind === 'design') {
        const image = await assetImage(record.image);
        if (cancelled || ticket !== revision.current) return;
        setDesign(image);
        setDesignRecord(record);
        setPrompt(record.prompt || '');
        setPlacement(defaultPlacement());
        setOriginal(false);
        setAiSelected(false);
        setRenderResult(null);
      } else if (record.original && record.draft) {
        const [raw, original, draft, savedDesign] = await Promise.all([
          assetImage(record.image),
          assetImage(record.original),
          assetImage(record.draft),
          record.designAsset
            ? assetImage(record.designAsset)
            : Promise.resolve(null),
        ]);
        if (cancelled || ticket !== revision.current) return;
        const originalCanvas = photoCanvas(original);
        setPhoto(originalCanvas);
        if (savedDesign) {
          setDesign(savedDesign);
          setDesignRecord((previous) =>
            previous?.image === record.designAsset ? previous : null
          );
        }
        if (record.placement) setPlacement(record.placement);
        setRenderResult({
          raw,
          original: originalCanvas,
          draft: photoCanvas(draft),
        });
        setAiSelected(true);
        setOriginal(false);
      }
    })()
      .catch(() => {
        if (!cancelled && ticket === revision.current)
          setError(
            t(
              'Your result is saved. Open My designs or History to load it again.',
              '结果已保存，请前往我的图案或历史记录重新查看。'
            )
          );
      })
      .finally(() => {
        if (!cancelled && ticket === revision.current) {
          setLoadedResult(studio.result);
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [studio.result, t]);
  useEffect(() => {
    if (!initialDesignId && !initialHistoryId) return;
    let cancelled = false;
    const ticket = ++revision.current;
    (async () => {
      const { records } = await studioClient.collection(
        initialDesignId ? 'designs' : 'history'
      );
      const record = records.find(
        (record) => record.id === (initialDesignId || initialHistoryId)
      );
      if (!record)
        throw new Error(t('Saved image not found.', '未找到该保存记录。'));
      if (initialDesignId) {
        const image = await assetImage(record.image);
        if (cancelled || ticket !== revision.current) return;
        setDesign(image);
        setDesignRecord(record);
        setPrompt(record.prompt || '');
      } else if (record.original && record.draft) {
        const [raw, original, draft, savedDesign] = await Promise.all([
          assetImage(record.image),
          assetImage(record.original),
          assetImage(record.draft),
          record.designAsset
            ? assetImage(record.designAsset)
            : Promise.resolve(null),
        ]);
        if (cancelled || ticket !== revision.current) return;
        const originalCanvas = photoCanvas(original);
        setPhoto(originalCanvas);
        if (savedDesign) setDesign(savedDesign);
        if (record.placement) setPlacement(record.placement);
        setRenderResult({
          raw,
          original: originalCanvas,
          draft: photoCanvas(draft),
        });
        setAiSelected(true);
        setView(true);
      }
    })()
      .catch((reason) => {
        if (!cancelled && ticket === revision.current) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled && ticket === revision.current) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialDesignId, initialHistoryId, t]);

  useEffect(
    () => () => {
      revision.current++;
    },
    []
  );
  useEffect(() => {
    for (const el of [canvas.current, viewer.current]) {
      if (!el || !photo) continue;
      el.width = photo.width;
      el.height = photo.height;
      const ctx = el.getContext('2d');
      if (ctx) {
        if (renderResult && (el === viewer.current || aiSelected)) {
          const source = original
            ? renderResult.original
            : aiSelected
              ? renderResult.raw
              : renderResult.draft;
          el.width =
            source instanceof HTMLImageElement
              ? source.naturalWidth
              : source.width;
          el.height =
            source instanceof HTMLImageElement
              ? source.naturalHeight
              : source.height;
          ctx.drawImage(source, 0, 0);
        } else drawManual(ctx, photo, design, placement, original);
      }
    }
  }, [photo, design, placement, original, view, aiSelected, renderResult]);
  useEffect(() => {
    if (!view) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [view]);

  async function run(task: () => Promise<void>) {
    const id = ++revision.current;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch {
      if (id === revision.current)
        setError(
          t(
            'Could not open this image. Use PNG, JPEG or WebP, up to 20 MB and 40 megapixels.',
            '无法打开图片。请使用 PNG、JPEG 或 WebP，大小不超过 20MB、4000 万像素。'
          )
        );
    } finally {
      if (id === revision.current) setBusy(false);
    }
  }
  function choose(file: File | undefined, kind: 'photo' | 'design') {
    if (!file || busy) return;
    void run(async () => {
      const id = revision.current;
      if (kind === 'photo') {
        const image = await loadPhoto(file);
        if (id !== revision.current) return;
        setPhoto(image);
      } else {
        const image = await loadDesign(file);
        if (id !== revision.current) return;
        setDesign(image);
        setDesignRecord(null);
        if (studio.capabilities?.signedIn && studio.capabilities.verified) {
          try {
            const saved = await studioClient.saveDesign(
              await imageBlob(image),
              prompt
            );
            if (id === revision.current) setDesignRecord(saved);
          } catch {
            setError(
              t(
                'Design is ready locally, but could not be saved yet. Retry when generating your try-on.',
                '图案已准备好，但暂未保存到账户。提交真实试戴时会重试保存。'
              )
            );
          }
        }
      }
      setPlacement(defaultPlacement());
      setOriginal(false);
      setMenu(false);
      setInk(false);
      setRenderResult(null);
      setAiSelected(false);
    });
  }
  async function download() {
    if (!renderResult) return;
    try {
      const out = document.createElement('canvas');
      out.width = renderResult.raw.naturalWidth;
      out.height = renderResult.raw.naturalHeight;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(renderResult.raw, 0, 0);
      const url = URL.createObjectURL(await canvasBlob(out));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'tattoovis-ai-try-on.png';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(t('Download failed. Please try again.', '下载失败，请重试。'));
    }
  }
  function renderTryOn() {
    if (!photo || !design || busy) return;
    const currentPhoto = photo,
      currentDesign = design,
      currentPlacement = { ...placement };
    studio.render(
      async (signal) => {
        const guide = document.createElement('canvas');
        guide.width = currentPhoto.width;
        guide.height = currentPhoto.height;
        const ctx = guide.getContext('2d');
        if (!ctx) throw new Error('Could not prepare placement');
        drawManual(ctx, currentPhoto, currentDesign, currentPlacement);
        const record =
          designRecord ||
          (await studioClient.saveDesign(
            await imageBlob(currentDesign),
            prompt,
            signal
          ));
        setDesignRecord(record);
        const photoAsset = await studioClient.upload(
          await photoBlob(currentPhoto),
          signal
        );
        const guideAsset = await studioClient.upload(
          await photoBlob(guide),
          signal
        );
        return {
          photo: photoAsset,
          design: record.image,
          designId: record.id,
          guide: guideAsset,
          region: placementRegion(
            currentPlacement,
            currentPhoto,
            currentDesign
          ),
          placement: currentPlacement,
          prompt,
        };
      },
      resolution,
      resolution === '4K' ? 3 : resolution === '2K' ? 2 : 1
    );
  }
  const g =
    photo && design
      ? geometryFor(
          placement,
          photo,
          design.naturalWidth / design.naturalHeight
        )
      : null;
  function point(e: React.PointerEvent, outside = false) {
    if (outside && canvas.current) {
      const rect = canvas.current.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    }
    return photo && canvas.current
      ? pointOnPhoto(
          { x: e.clientX, y: e.clientY },
          canvas.current.getBoundingClientRect(),
          photo
        )
      : null;
  }
  function down(e: React.PointerEvent, mode = 'move') {
    if (!photo || !design || original || aiSelected || busy) return;
    const p = point(e, mode !== 'move');
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, p);
    drag.current = { mode, points: [...pointers.current.values()], placement };
  }
  function move(e: React.PointerEvent) {
    if (!photo || !drag.current || !pointers.current.has(e.pointerId)) return;
    const p = point(e, true);
    if (!p) return;
    pointers.current.set(e.pointerId, p);
    const current = [...pointers.current.values()],
      start = drag.current;
    if (current.length >= 2 && start.points.length >= 2) {
      update(transformGesture(start.points, current, start.placement, photo));
      return;
    }
    const a = start.points[0],
      base = start.placement;
    const ax = (a.x - base.px) * photo.width,
      ay = (a.y - base.py) * photo.height;
    const bx = (p.x - base.px) * photo.width,
      by = (p.y - base.py) * photo.height;
    if (start.mode === 'resize')
      update({
        ...base,
        scale:
          (base.scale * Math.hypot(bx, by)) / Math.max(1, Math.hypot(ax, ay)),
      });
    else if (start.mode === 'rotate')
      update({
        ...base,
        rotation:
          base.rotation +
          ((Math.atan2(by, bx) - Math.atan2(ay, ax)) * 180) / Math.PI,
      });
    else update({ ...base, px: base.px + p.x - a.x, py: base.py + p.y - a.y });
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    drag.current = pointers.current.size
      ? { mode: 'move', points: [...pointers.current.values()], placement }
      : null;
  }
  function handleKey(e: React.KeyboardEvent) {
    if (!design || original || aiSelected || busy) return;
    const p = { ...placement };
    switch (e.key) {
      case 'ArrowLeft':
        p.px -= 0.01;
        break;
      case 'ArrowRight':
        p.px += 0.01;
        break;
      case 'ArrowUp':
        p.py -= 0.01;
        break;
      case 'ArrowDown':
        p.py += 0.01;
        break;
      case '+':
      case '=':
        p.scale *= 1.05;
        break;
      case '-':
        p.scale /= 1.05;
        break;
      case 'r':
        p.rotation += 5;
        break;
      case 'f':
        p.flipped = !p.flipped;
        break;
      case '[':
        p.opacity -= 0.05;
        break;
      case ']':
        p.opacity += 0.05;
        break;
      case 'Delete':
        setDesign(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    update(p);
  }
  const handleStyle =
    'absolute flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-md touch-none';

  return (
    <div className="mt-10 pb-16">
      <StudioAccount studio={studio} locale={locale} />
      {loading && (
        <p role="status" className="text-primary mb-4">
          {t('Opening your images…', '正在打开图片…')}
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-label={t('Photo editor', '照片编辑器')}
          className="min-w-0"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                className={button}
                aria-pressed={!original && !aiSelected}
                disabled={!photo}
                onClick={() => {
                  setOriginal(false);
                  setAiSelected(false);
                }}
              >
                {t('Edit placement', '编辑位置')}
              </button>
              <button
                className={button}
                aria-pressed={original}
                disabled={!photo}
                onClick={() => {
                  setOriginal(true);
                  setAiSelected(false);
                }}
              >
                {t('Original', '原图')}
              </button>
              {renderResult && (
                <button
                  className={`${button} border-primary text-primary`}
                  aria-pressed={aiSelected}
                  onClick={() => {
                    setAiSelected(true);
                    setOriginal(false);
                  }}
                >
                  {t('AI result', 'AI 结果')}
                </button>
              )}
            </div>
            <button
              className={button}
              disabled={!photo}
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                setView(true);
              }}
            >
              {t('Enlarge & compare', '放大与对比')}
            </button>
          </div>
          <div className="border-border bg-muted/40 flex min-h-96 items-center justify-center overflow-hidden rounded-2xl border p-6 sm:p-10">
            {photo ? (
              <div
                className="relative mx-auto w-full"
                style={{
                  maxWidth: `min(100%, ${(660 * photo.width) / photo.height}px)`,
                }}
              >
                <canvas
                  ref={canvas}
                  tabIndex={0}
                  aria-label={t(
                    'Tattoo placement. Arrow keys move, plus or minus resize, R rotates, F flips, brackets adjust ink.',
                    '纹身摆放。方向键移动，加减号缩放，R旋转，F翻转，方括号调整深浅。'
                  )}
                  className="focus-visible:outline-primary block h-auto w-full touch-none outline-offset-4 focus-visible:outline-2"
                  onKeyDown={handleKey}
                  onPointerDown={(e) => down(e)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu(!menu);
                  }}
                />
                {g && !original && !aiSelected && !busy && (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute border border-white shadow-[0_0_0_1px_#6755d9]"
                      style={{
                        left: `${placement.px * 100}%`,
                        top: `${placement.py * 100}%`,
                        width: `${(g.width / photo.width) * 100}%`,
                        height: `${(g.height / photo.height) * 100}%`,
                        transform: `translate(-50%,-50%) rotate(${placement.rotation}deg)`,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute"
                      style={{
                        left: `${placement.px * 100}%`,
                        top: `${placement.py * 100}%`,
                        width: `${(g.width / photo.width) * 100}%`,
                        height: `${(g.height / photo.height) * 100}%`,
                        transform: `translate(-50%,-50%) rotate(${placement.rotation}deg)`,
                      }}
                    >
                      <button
                        aria-label={t('Drag to resize', '拖动缩放')}
                        className={`${handleStyle} pointer-events-auto -right-5 -bottom-5 cursor-nwse-resize`}
                        onPointerDown={(e) => down(e, 'resize')}
                        onPointerMove={move}
                        onPointerUp={up}
                        onPointerCancel={up}
                      >
                        ↗
                      </button>
                      <button
                        aria-label={t('Drag to rotate', '拖动旋转')}
                        className={`${handleStyle} pointer-events-auto -top-12 left-1/2 -translate-x-1/2 cursor-grab`}
                        onPointerDown={(e) => down(e, 'rotate')}
                        onPointerMove={move}
                        onPointerUp={up}
                        onPointerCancel={up}
                      >
                        ↻
                      </button>
                    </div>
                    <div className="absolute top-3 left-3 flex gap-2">
                      <button
                        className={button}
                        aria-expanded={ink}
                        onClick={() => {
                          setInk(!ink);
                          setMenu(false);
                        }}
                      >
                        {t('Ink', '深浅')} {Math.round(placement.opacity * 100)}
                        %
                      </button>
                      <button
                        className={button}
                        aria-label={t('Placement options', '摆放选项')}
                        aria-expanded={menu}
                        onClick={() => {
                          setMenu(!menu);
                          setInk(false);
                        }}
                      >
                        •••
                      </button>
                    </div>
                    {ink && (
                      <label className="bg-background absolute top-20 left-3 rounded-xl border p-4 shadow-lg">
                        {t('Ink intensity', '纹身深浅')}
                        <input
                          aria-label={t('Ink intensity', '纹身深浅')}
                          className="accent-primary mt-3 block w-40"
                          type="range"
                          min="5"
                          max="100"
                          value={Math.round(placement.opacity * 100)}
                          onChange={(e) =>
                            update({
                              ...placement,
                              opacity: Number(e.target.value) / 100,
                            })
                          }
                        />
                      </label>
                    )}
                    {menu && (
                      <div className="bg-background absolute top-20 left-3 grid gap-1 rounded-xl border p-2 shadow-lg">
                        {[
                          [
                            t('Flip horizontally', '水平翻转'),
                            () =>
                              update({
                                ...placement,
                                flipped: !placement.flipped,
                              }),
                          ],
                          [
                            t('Reset placement', '重置摆放'),
                            () => setPlacement(defaultPlacement()),
                          ],
                          [
                            t('Remove design', '移除图案'),
                            () => setDesign(null),
                          ],
                        ].map(([label, action]) => (
                          <button
                            key={String(label)}
                            className="hover:bg-muted rounded-lg px-4 py-3 text-left"
                            onClick={() => {
                              (action as () => void)();
                              setMenu(false);
                            }}
                          >
                            {String(label)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="max-w-sm py-16 text-center">
                <p className="text-2xl">
                  {t('Your photo. Your placement.', '你的照片，你来决定位置。')}
                </p>
                <p className="text-muted-foreground mt-4 leading-7">
                  {t(
                    'A close-up of an arm, shoulder or leg works beautifully. Start with a clear photo of visible skin.',
                    '手臂、肩膀或小腿的局部照片都可以。从一张皮肤清晰可见的照片开始。'
                  )}
                </p>
                <button
                  className={`${button} mt-6`}
                  disabled={busy}
                  onClick={() => photoInput.current?.click()}
                >
                  {t('Choose photo', '选择照片')}
                </button>
              </div>
            )}
          </div>
          {photo && !design && (
            <button
              className={`${button} border-primary text-primary mt-4 w-full`}
              disabled={busy}
              onClick={() => designInput.current?.click()}
            >
              {t('Next: add your tattoo design', '下一步：添加纹身图案')}
            </button>
          )}
          <p className="text-muted-foreground mt-4 text-base leading-7">
            {design
              ? t(
                  'Drag the design to move it. Use ↗ to resize and ↻ to rotate, or pinch and twist with two fingers. Ink and ••• are on your photo.',
                  '拖动图案移动位置；拖动 ↗ 缩放、↻ 旋转，手机可双指缩放和旋转。深浅和更多操作就在照片上。'
                )
              : t(
                  'Add a design after choosing your photo. You can change either image at any time.',
                  '选择照片后添加图案。两张图片都可以随时更换。'
                )}
          </p>
        </section>
        <aside className="space-y-7 lg:pt-1">
          <div className="border-b pb-6">
            <p className="text-primary text-sm">01 / {t('PHOTO', '照片')}</p>
            <h2 className="mt-2 text-2xl">
              {t('Start with your skin', '从你的照片开始')}
            </h2>
            <p className="text-muted-foreground mt-3 leading-7">
              {t(
                'Use a photo of yourself or a consenting adult. Keep the area you want to tattoo visible.',
                '请使用本人或已同意的成年人的照片，确保想纹身的位置清晰可见。'
              )}
            </p>
            <button
              className={`${button} mt-4 w-full`}
              disabled={busy}
              onClick={() => photoInput.current?.click()}
            >
              {photo
                ? t('Change photo', '更换照片')
                : t('Upload photo', '上传照片')}
            </button>
          </div>
          <StudioDesigns
            locale={locale}
            prompt={prompt}
            setPrompt={setPrompt}
            onUpload={() => designInput.current?.click()}
            onPick={pickDesign}
            studio={studio}
            busy={busy}
          />
          {design && (
            <div className="rounded-xl border p-4">
              <p className="text-muted-foreground mb-3 text-sm">
                {t('Selected design', '当前图案')}
              </p>
              <DesignPreview image={design} />
              {designRecord && (
                <p className="text-primary mt-3 text-sm">
                  {t(
                    'Saved to your account · reusable for free',
                    '已保存到账户 · 免费复用'
                  )}
                </p>
              )}
            </div>
          )}
          <StudioRender
            locale={locale}
            resolution={resolution}
            setResolution={setResolution}
            onRender={renderTryOn}
            busy={busy}
            ready={!!photo && !!design}
            pending={!!studio.pending}
            hasResult={!!renderResult}
            onDownload={() => void download()}
          />
          <button
            className={`${button} w-full`}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const id = revision.current;
                const result = await loadSample();
                if (id !== revision.current) return;
                setPhoto(result.photo);
                setDesign(result.design);
                setDesignRecord(null);
                setRenderResult(null);
                setAiSelected(false);
                setPlacement({
                  ...defaultPlacement(),
                  px: 0.37,
                  py: 0.28,
                  scale: 0.45,
                });
                setOriginal(false);
              })
            }
          >
            {busy
              ? t('Opening image…', '正在打开图片…')
              : t('Try sample', '试用示例')}
          </button>
          <p className="text-muted-foreground text-sm leading-6">
            {t(
              'Manual placement is free. Design generation costs 1 credit; each real try-on costs 1 / 2 / 3 credits at 1K / 2K / 4K. Images are uploaded when you save a design or submit a try-on. Generated designs and results are saved to your account. Unsaved placement edits clear when you leave or refresh. PNG / JPEG / WebP · up to 20 MB.',
              '手动摆放免费；新设计 1 credit，单张真实试戴 1K / 2K / 4K 为 1 / 2 / 3 credits。保存设计或提交试戴时会上传图片；生成的设计和结果自动保存到账户。未提交的摆放编辑在离开或刷新后清空。支持 PNG / JPEG / WebP，最大 20MB。'
            )}
          </p>
        </aside>
      </div>
      <input
        ref={photoInput}
        aria-label={t('Photo file', '照片文件')}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          choose(e.target.files?.[0], 'photo');
          e.target.value = '';
        }}
      />
      <input
        ref={designInput}
        aria-label={t('Design file', '图案文件')}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          choose(e.target.files?.[0], 'design');
          e.target.value = '';
        }}
      />
      {error && (
        <p role="alert" className="text-destructive mt-4">
          {error}
        </p>
      )}
      {view && (
        <dialog
          ref={dialog}
          aria-label={t('Fullscreen comparison', '全屏对比')}
          className="bg-background text-foreground fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none p-0 backdrop:bg-black/70"
          onCancel={() => setView(false)}
        >
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-8">
              <div className="flex gap-2">
                {(['original', 'manual', 'ai'] as const).map((value) => (
                  <button
                    key={value}
                    className={`${button} ${(value === 'original' ? original : value === 'ai' ? aiSelected : !original && !aiSelected) ? 'border-primary text-primary' : ''}`}
                    disabled={value === 'ai' && !renderResult}
                    onClick={() => {
                      setOriginal(value === 'original');
                      setAiSelected(value === 'ai');
                    }}
                  >
                    {value === 'original'
                      ? t('Original', '原图')
                      : value === 'ai'
                        ? t('AI result', 'AI 结果')
                        : t('Manual placement', '手动摆放')}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  className={button}
                  disabled={!renderResult}
                  onClick={() => void download()}
                >
                  {t('Download AI result', '下载 AI 结果')}
                </button>
                <button className={button} onClick={() => setView(false)}>
                  {t('Close', '关闭')}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 px-4 py-3">
              <label className="flex items-center gap-3">
                {t('Zoom', '缩放')}
                <input
                  aria-label={t('Zoom', '缩放')}
                  type="range"
                  min="1"
                  max="5"
                  step=".05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="accent-primary w-32"
                />
                {Math.round(zoom * 100)}%
              </label>
              <button
                className={button}
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                {t('Fit', '适应窗口')}
              </button>
            </div>
            <div
              className="bg-muted/40 relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                viewerPointers.current.set(e.pointerId, {
                  x: e.clientX,
                  y: e.clientY,
                });
                viewerDrag.current = {
                  points: [...viewerPointers.current.values()],
                  zoom,
                  pan,
                };
              }}
              onPointerMove={(e) => {
                if (
                  !viewerPointers.current.has(e.pointerId) ||
                  !viewerDrag.current
                )
                  return;
                viewerPointers.current.set(e.pointerId, {
                  x: e.clientX,
                  y: e.clientY,
                });
                const points = [...viewerPointers.current.values()],
                  start = viewerDrag.current;
                if (points.length >= 2 && start.points.length >= 2) {
                  const distance = (ps: Point[]) =>
                    Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y);
                  setZoom(
                    Math.min(
                      5,
                      Math.max(
                        1,
                        (start.zoom * distance(points)) /
                          Math.max(1, distance(start.points))
                      )
                    )
                  );
                }
                setPan({
                  x: start.pan.x + points[0].x - start.points[0].x,
                  y: start.pan.y + points[0].y - start.points[0].y,
                });
              }}
              onPointerUp={(e) => {
                viewerPointers.current.delete(e.pointerId);
                viewerDrag.current = viewerPointers.current.size
                  ? { points: [...viewerPointers.current.values()], zoom, pan }
                  : null;
              }}
              onPointerCancel={() => {
                viewerPointers.current.clear();
                viewerDrag.current = null;
              }}
              onWheel={(e) =>
                setZoom((value) =>
                  Math.min(5, Math.max(1, value - e.deltaY * 0.002))
                )
              }
            >
              <canvas
                ref={viewer}
                className="block h-full w-full object-contain"
                style={{
                  transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
                }}
              />
            </div>
            <p className="text-muted-foreground px-4 py-2 text-center text-sm">
              {t(
                'Drag to inspect. Pinch or scroll to zoom. Switching images keeps the same view.',
                '拖动查看细节，双指或滚轮缩放。切换图片保留相同查看位置。'
              )}
            </p>
          </div>
        </dialog>
      )}
    </div>
  );
}

function DesignPreview({ image }: { image: HTMLImageElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 320;
    canvas.height = Math.min(
      400,
      (320 * image.naturalHeight) / image.naturalWidth
    );
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
  }, [image]);
  return (
    <canvas
      ref={ref}
      className="mx-auto max-h-48 max-w-full rounded-lg bg-white object-contain"
      aria-label="Selected tattoo design"
    />
  );
}
