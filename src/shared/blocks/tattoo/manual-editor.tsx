'use client';

import { useEffect, useRef, useState } from 'react';
import {
  canvasBlob,
  loadDesign,
  loadPhoto,
  loadSample,
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

const button =
  'rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 disabled:cursor-not-allowed';

export function ManualEditor({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [design, setDesign] = useState<HTMLImageElement | null>(null);
  const [placement, setPlacement] = useState(defaultPlacement);
  const [original, setOriginal] = useState(false);
  const [menu, setMenu] = useState(false);
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
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
  const update = (p: Placement) => setPlacement(constrainPlacement(p));

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
      if (ctx) drawManual(ctx, photo, design, placement, original);
    }
  }, [photo, design, placement, original, view]);
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
    if (!file) return;
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
      }
      setPlacement(defaultPlacement());
      setOriginal(false);
      setMenu(false);
      setInk(false);
    });
  }
  async function download() {
    if (!photo || !design) return;
    try {
      const out = document.createElement('canvas');
      out.width = photo.width;
      out.height = photo.height;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      drawManual(ctx, photo, design, placement);
      const url = URL.createObjectURL(await canvasBlob(out));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'tattoovis-manual-preview.png';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(t('Download failed. Please try again.', '下载失败，请重试。'));
    }
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
    if (!photo || !design || original) return;
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
    if (!design || original) return;
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
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-label={t('Photo editor', '照片编辑器')}
          className="min-w-0"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                className={button}
                aria-pressed={!original}
                disabled={!photo}
                onClick={() => setOriginal(false)}
              >
                {t('Edit placement', '编辑位置')}
              </button>
              <button
                className={button}
                aria-pressed={original}
                disabled={!photo}
                onClick={() => setOriginal(true)}
              >
                {t('Original', '原图')}
              </button>
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
                {g && !original && (
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
          <div className="border-b pb-6">
            <p className="text-primary text-sm">02 / {t('DESIGN', '图案')}</p>
            <h2 className="mt-2 text-2xl">
              {t('Bring a design you love', '放上你喜欢的图案')}
            </h2>
            <p className="text-muted-foreground mt-3 leading-7">
              {t(
                'A transparent PNG or a design on white works best. White blends into the photo.',
                '推荐透明 PNG 或白底图案，白色会融入照片背景。'
              )}
            </p>
            <button
              className={`${button} mt-4 w-full`}
              disabled={busy || !photo}
              onClick={() => designInput.current?.click()}
            >
              {design
                ? t('Change design', '更换图案')
                : t('Upload design', '上传图案')}
            </button>
          </div>
          <div>
            <p className="text-primary text-sm">
              03 / {t('PLACE & SAVE', '摆放与保存')}
            </p>
            <h2 className="mt-2 text-2xl">
              {t('Make it feel like you', '找到适合自己的位置')}
            </h2>
            <p className="text-muted-foreground mt-3 leading-7">
              {t(
                'Explore placement for free. This is a manual overlay, not an AI-rendered tattoo.',
                '免费探索位置、大小和角度。这是手动叠放预览，不是 AI 真实融合效果。'
              )}
            </p>
            <button
              className={`${button} border-primary bg-primary text-primary-foreground mt-4 w-full`}
              disabled={!photo || !design || busy}
              onClick={() => void download()}
            >
              {t('Download preview', '下载预览')}
            </button>
          </div>
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
              'No sign-in or credits required. Images stay in this tab and are not uploaded. Leaving or refreshing clears your work — download first. PNG / JPEG / WebP · up to 20 MB. Photo previews are resized to a maximum 2560px long edge.',
              '无需登录、不消耗积分。图片仅保留在当前页面内存，不上传。离开或刷新会清空，请先下载。支持 PNG / JPEG / WebP，最大 20MB。预览照片长边最大 2560px。'
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
                {[false, true].map((value) => (
                  <button
                    key={String(value)}
                    className={`${button} ${original === value ? 'border-primary text-primary' : ''}`}
                    onClick={() => setOriginal(value)}
                  >
                    {value
                      ? t('Original', '原图')
                      : t('Manual preview', '手动预览')}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  className={button}
                  disabled={!design}
                  onClick={() => void download()}
                >
                  {t('Download preview', '下载预览')}
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
