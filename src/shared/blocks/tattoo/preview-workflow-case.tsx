'use client';

import { useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';

import { studioUrl } from '@/config/preview/product';

import { CASE_ASSET_ROOT, CASE_PROMPT } from './case-study-data';

const PRESET = { x: 41, y: 78, width: 11, rotation: 0 };
const clamp = (n: number, low: number, high: number) =>
  Math.min(high, Math.max(low, n));
const buttonClass =
  'rounded-full border px-5 py-2.5 text-sm disabled:opacity-40';

export function PreviewWorkflowCase({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  const [stage, setStage] = useState<
    'photo' | 'design' | 'placement' | 'result'
  >('photo');
  const [position, setPosition] = useState(PRESET);
  const photoRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    mode: 'move' | 'resize' | 'rotate';
    clientX: number;
    clientY: number;
    position: typeof PRESET;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    angle: number;
  } | null>(null);
  const ready = stage === 'placement' || stage === 'result';

  function start(
    event: PointerEvent<HTMLButtonElement>,
    mode: 'move' | 'resize' | 'rotate'
  ) {
    const rect = photoRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const centerX = rect.left + (rect.width * position.x) / 100;
    const centerY = rect.top + (rect.height * position.y) / 100;
    gesture.current = {
      mode,
      clientX: event.clientX,
      clientY: event.clientY,
      position,
      width: rect.width,
      height: rect.height,
      centerX,
      centerY,
      angle:
        (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) /
        Math.PI,
    };
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = ((event.clientX - g.clientX) / g.width) * 100;
    const dy = ((event.clientY - g.clientY) / g.height) * 100;
    if (g.mode === 'move')
      setPosition({
        ...g.position,
        x: clamp(g.position.x + dx, 5, 95),
        y: clamp(g.position.y + dy, 8, 92),
      });
    else if (g.mode === 'rotate') {
      const angle =
        (Math.atan2(event.clientY - g.centerY, event.clientX - g.centerX) *
          180) /
        Math.PI;
      setPosition({
        ...g.position,
        rotation: ((g.position.rotation + angle - g.angle + 540) % 360) - 180,
      });
    } else
      setPosition({
        ...g.position,
        width: clamp(g.position.width + dx, 5, 30),
      });
  }
  function reset() {
    setPosition({ ...PRESET });
    setStage('placement');
  }

  return (
    <section
      id="tattoo-case"
      aria-labelledby="preview-case-title"
      className="mx-auto max-w-6xl scroll-mt-24"
    >
      <header className="mb-8">
        <p className="text-primary mb-3 text-xs tracking-widest">
          {zh
            ? '免费互动案例 / 无 AI 请求'
            : 'FREE INTERACTIVE EXAMPLE / NO AI REQUESTS'}
        </p>
        <h2
          id="preview-case-title"
          className="text-2xl font-medium sm:text-3xl"
        >
          {zh
            ? '从设计到自由定位，体验单张试戴流程'
            : 'From design to placement. Explore one try-on.'}
        </h2>
        <p className="text-muted-foreground mt-4 text-sm leading-7">
          {zh
            ? '选择示例照片、查看真实设计，在照片上拖动和缩放，再浏览一张已保存的固定 AI 结果。此案例不使用积分，不调用 AI。'
            : 'Choose the sample, reveal its real design, move and resize it, then explore one saved fixed AI result. This example uses no credits and makes no AI requests.'}
        </p>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-7">
          <article className="rounded-xl border p-5">
            <h3 className="mb-4 font-medium">
              {zh ? '1 / 选择示例原图' : '1 / Choose the original photo'}
            </h3>
            <div className="flex items-center gap-5">
              <Image
                unoptimized
                src={`${CASE_ASSET_ROOT}/before.webp`}
                alt={
                  zh
                    ? '未加纹身的示例原图'
                    : 'Original sample photo without tattoos'
                }
                width={75}
                height={100}
                className="rounded-lg"
              />
              <div>
                <p className="text-muted-foreground mb-3 text-sm">
                  {zh
                    ? '光线均匀，目标部位清晰可见。'
                    : 'Even light, with the intended area visible.'}
                </p>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    setStage('design');
                    setPosition({ ...PRESET });
                  }}
                >
                  {zh ? '使用此示例照片' : 'Use this sample photo'}
                </button>
              </div>
            </div>
          </article>
          <article className="rounded-xl border p-5">
            <h3 className="mb-4 font-medium">
              {zh
                ? '2 / 查看提示词与已保存设计'
                : '2 / Reveal the prompt and saved design'}
            </h3>
            <button
              type="button"
              className={buttonClass}
              disabled={stage === 'photo'}
              onClick={() => setStage('placement')}
            >
              {zh ? '展示已保存设计' : 'Reveal saved design'}
            </button>
            {ready && (
              <div className="mt-5">
                <Image
                  unoptimized
                  src={`${CASE_ASSET_ROOT}/design.webp`}
                  alt={
                    zh
                      ? '已保存的几何狼头纹身设计'
                      : 'Saved geometric wolf tattoo design'
                  }
                  width={144}
                  height={144}
                  className="mx-auto rounded-lg"
                />
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm">
                    {zh ? '查看真实案例提示词' : 'Read the real example prompt'}
                  </summary>
                  <p
                    lang="en"
                    className="text-muted-foreground mt-3 text-xs leading-6"
                  >
                    {CASE_PROMPT}
                  </p>
                </details>
              </div>
            )}
          </article>
          <article className="rounded-xl border p-5">
            <h3 className="mb-4 font-medium">
              {zh ? '3 / 自由拖动和缩放图案' : '3 / Move and resize the design'}
            </h3>
            <p className="text-muted-foreground text-sm leading-7">
              {zh
                ? '拖动图案移动，右下角圆点缩放，上方圆点旋转。键盘方向键移动，+ / − 缩放，R 旋转。初始位置为小腿。'
                : 'Drag the design to move it, the bottom-right handle to resize, and the top handle to rotate. Keyboard: arrows to move, + / − to resize, R to rotate. The initial preset is on the calf.'}
            </p>
            <div className="sr-only">
              {(
                [
                  ['x', zh ? '水平位置' : 'Horizontal position', 5, 95],
                  ['y', zh ? '垂直位置' : 'Vertical position', 8, 92],
                  ['width', zh ? '图案大小' : 'Design size', 5, 30],
                  ['rotation', zh ? '旋转角度' : 'Rotation', -180, 180],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} className="text-xs">
                  {label}
                  <input
                    aria-label={label}
                    type="range"
                    min={min}
                    max={max}
                    value={position[key]}
                    disabled={!ready}
                    onChange={(event) =>
                      setPosition({
                        ...position,
                        [key]: Number(event.target.value),
                      })
                    }
                    className="mt-3 block w-full"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={!ready}
              className={`${buttonClass} mt-5`}
              onClick={reset}
            >
              {zh ? '恢复小腿预设' : 'Reset calf preset'}
            </button>
          </article>
          <article className="rounded-xl border p-5">
            <h3 className="mb-4 font-medium">
              {zh
                ? '4 / 查看固定示例 AI 结果'
                : '4 / View the fixed example AI result'}
            </h3>
            <p className="text-muted-foreground mb-4 text-sm leading-7">
              {zh
                ? '这张已保存的 AI 图片对应案例原来的小腿预设，不对应你刚才编辑的位置。自定义位置的真实生成，请进入工作室。'
                : 'This saved AI image matches the original calf preset. It does not reflect your edited placement. Open the studio to render your own placement.'}
            </p>
            <button
              type="button"
              disabled={!ready}
              className={buttonClass}
              onClick={() => setStage('result')}
            >
              {zh ? '查看固定示例AI结果' : 'View fixed example AI result'}
            </button>
          </article>
        </div>
        <div className="lg:sticky lg:top-24">
          <p
            role="status"
            className="bg-muted mb-3 rounded-lg px-4 py-3 text-xs leading-6"
          >
            {stage === 'result'
              ? zh
                ? '已保存的固定 AI 结果 · 原始小腿位置，并非你编辑后的布局'
                : 'Saved fixed AI result · Original calf placement, not your edited layout'
              : zh
                ? '仅布局叠图 · 自由移动不会运行 AI，也不是最终皮肤融合效果'
                : 'Layout overlay only · Moving does not run AI or show the final skin blend'}
          </p>
          {stage === 'result' ? (
            <Image
              unoptimized
              src={`${CASE_ASSET_ROOT}/calf.webp`}
              alt={
                zh ? '已保存的小腿 AI 示例结果' : 'Saved AI calf example result'
              }
              width={900}
              height={1200}
              className="max-h-[720px] w-full rounded-xl object-contain"
            />
          ) : (
            <div
              ref={photoRef}
              data-testid="workflow-placement-photo"
              className="relative mx-auto w-full max-w-[540px] overflow-hidden rounded-xl"
            >
              <Image
                unoptimized
                src={`${CASE_ASSET_ROOT}/before.webp`}
                alt={
                  zh ? '自由定位示例照片' : 'Sample photo for free placement'
                }
                width={900}
                height={1200}
                className="block h-auto w-full"
                draggable={false}
              />
              {ready && (
                <>
                  <button
                    type="button"
                    aria-label={zh ? '移动纹身图案' : 'Move tattoo design'}
                    onPointerDown={(e) => start(e, 'move')}
                    onPointerMove={move}
                    onPointerUp={() => {
                      gesture.current = null;
                    }}
                    onPointerCancel={() => {
                      gesture.current = null;
                    }}
                    onKeyDown={(event) => {
                      const delta = (
                        {
                          ArrowLeft: [-1, 0],
                          ArrowRight: [1, 0],
                          ArrowUp: [0, -1],
                          ArrowDown: [0, 1],
                        } as Record<string, number[]>
                      )[event.key];
                      if (delta) {
                        event.preventDefault();
                        setPosition({
                          ...position,
                          x: clamp(position.x + delta[0], 5, 95),
                          y: clamp(position.y + delta[1], 8, 92),
                        });
                      } else if (
                        ['+', '=', '-', 'r', 'R'].includes(event.key)
                      ) {
                        event.preventDefault();
                        if (event.key.toLowerCase() === 'r')
                          setPosition({
                            ...position,
                            rotation: ((position.rotation + 195) % 360) - 180,
                          });
                        else
                          setPosition({
                            ...position,
                            width: clamp(
                              position.width + (event.key === '-' ? -1 : 1),
                              5,
                              30
                            ),
                          });
                      }
                    }}
                    className="absolute cursor-move touch-none border border-dashed border-emerald-500 bg-transparent focus-visible:outline-2 focus-visible:outline-emerald-500"
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      width: `${position.width}%`,
                      height: `${(position.width * 14) / 11}%`,
                      transform: `translate(-50%, -50%) rotate(${position.rotation}deg)`,
                    }}
                  >
                    <Image
                      unoptimized
                      src={`${CASE_ASSET_ROOT}/design.webp`}
                      alt=""
                      width={640}
                      height={640}
                      draggable={false}
                      className="pointer-events-none h-full w-full mix-blend-multiply"
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={zh ? '缩放纹身图案' : 'Resize tattoo design'}
                    onPointerDown={(e) => start(e, 'resize')}
                    onPointerMove={move}
                    onPointerUp={() => {
                      gesture.current = null;
                    }}
                    onPointerCancel={() => {
                      gesture.current = null;
                    }}
                    className="absolute size-7 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-emerald-600 shadow-md"
                    style={{
                      left: `${position.x + position.width / 2}%`,
                      top: `${position.y + (position.width * 7) / 11}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'ArrowLeft' ||
                        event.key === 'ArrowRight'
                      ) {
                        event.preventDefault();
                        setPosition({
                          ...position,
                          width: clamp(
                            position.width +
                              (event.key === 'ArrowRight' ? 1 : -1),
                            5,
                            30
                          ),
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label={zh ? '旋转纹身图案' : 'Rotate tattoo design'}
                    onPointerDown={(e) => start(e, 'rotate')}
                    onPointerMove={move}
                    onPointerUp={() => {
                      gesture.current = null;
                    }}
                    onPointerCancel={() => {
                      gesture.current = null;
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'ArrowRight' ||
                        event.key === 'ArrowLeft'
                      ) {
                        event.preventDefault();
                        setPosition({
                          ...position,
                          rotation:
                            ((position.rotation +
                              (event.key === 'ArrowRight' ? 15 : -15) +
                              540) %
                              360) -
                            180,
                        });
                      }
                    }}
                    className="absolute size-7 cursor-grab touch-none rounded-full border-2 border-white bg-emerald-600 text-xs text-white shadow-md"
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y - (position.width * 7) / 11 - 3}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    ↻
                  </button>
                </>
              )}
            </div>
          )}
          {stage === 'result' && (
            <button
              type="button"
              className={`${buttonClass} mt-4`}
              onClick={() => setStage('placement')}
            >
              {zh ? '返回编辑布局' : 'Return to your layout'}
            </button>
          )}
          <a
            href={studioUrl(undefined, locale)}
            className="bg-primary text-primary-foreground mt-5 inline-flex rounded-full px-6 py-3 text-sm font-medium"
          >
            {zh
              ? '进入工作室生成你的位置效果'
              : 'Render your placement in the studio'}
          </a>
        </div>
      </div>
    </section>
  );
}
