'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';

import { studioUrl } from '@/config/preview/product';

import { GUNDAM_CASE_ROOT, GUNDAM_DESIGN_NOTE } from './case-study-data';
import { Lightbox } from './lightbox';

const buttonClass =
  'mt-4 inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2.5 text-sm transition-colors enabled:hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40';

/** A saved, button-only example. Editing belongs to the separate studio. */
export function PreviewWorkflowCase({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  const [step, setStep] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const finished = step === 4;
  const placed = step >= 3 && !finished;
  const instructions = zh
    ? [
        '点击“选择这张照片”，从清晰可见的皮肤开始。',
        '照片已选好。点击“查看上传的图案”，查看用户上传的高达设计。',
        '图案已准备好。点击“套用示例位置”，查看固定的肱二头肌摆放。',
        '摆放已确认。点击“查看真实 AI 结果”，对比保存的单张试戴效果。',
        '四步已完成。可以对比原图，也可以进入工作室用自己的照片试戴。',
      ]
    : [
        'Choose the sample photo to begin with clearly visible skin.',
        'Photo selected. Reveal the uploaded Gundam design used for this example.',
        'Design ready. Apply the preset placement to see it on the biceps.',
        'Placement confirmed. View the real saved AI result for this example.',
        'You have finished all four steps. Compare the original or try your own photo in the studio.',
      ];
  const labels = zh
    ? ['选择照片', '查看图案', '确认位置', '真实效果']
    : ['Choose photo', 'View design', 'Confirm placement', 'Real result'];
  const images = [
    {
      url: `${GUNDAM_CASE_ROOT}/before.webp`,
      alt: zh
        ? '案例原图：弯曲手臂、没有纹身的上身照'
        : 'Original sample photo: flexed bare upper arm without tattoos',
    },
    {
      url: `${GUNDAM_CASE_ROOT}/design.webp`,
      alt: zh ? '已上传的高达纹身图案' : 'Uploaded Gundam tattoo design',
    },
    {
      url: `${GUNDAM_CASE_ROOT}/result.webp`,
      alt: zh ? '保存的 AI 肱二头肌试戴结果' : 'Saved AI biceps try-on result',
    },
  ];
  return (
    <section
      id="tattoo-case"
      aria-labelledby="preview-case-title"
      className="tattoo-section tattoo-section-muted scroll-mt-24"
    >
      <div className="tattoo-container">
        <header className="mb-8 max-w-3xl">
          <p className="tattoo-eyebrow">
            {zh
              ? '免费互动案例 · 点击体验'
              : 'FREE INTERACTIVE EXAMPLE · CLICK TO EXPLORE'}
          </p>
          <h2 id="preview-case-title" className="tattoo-heading">
            {zh
              ? '四次点击，走完一次纹身试戴'
              : 'Four clicks. One complete tattoo try-on.'}
          </h2>
          <p className="tattoo-section-body">
            {zh
              ? '跟随固定案例，了解照片、图案、位置和单张真实效果如何衔接。只需点击按钮，无需拖动，不消耗积分或调用 AI。'
              : 'Follow a saved example from photo to design, placement and one realistic result. Just click the buttons—no dragging, credits or AI requests.'}
          </p>
        </header>
        <ol
          className="mb-5 grid grid-cols-4 gap-2"
          aria-label={zh ? '案例步骤' : 'Example steps'}
        >
          {labels.map((label, i) => (
            <li
              key={label}
              aria-current={Math.min(step, 3) === i ? 'step' : undefined}
              className={`border-t-2 pt-3 text-xs sm:text-sm ${step > i ? 'border-primary text-primary' : Math.min(step, 3) === i ? 'border-primary font-medium' : 'text-muted-foreground border-border'}`}
            >
              <span className="mr-2">0{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <p
          className="bg-card mb-6 rounded-xl border px-5 py-4 text-sm leading-6"
          role="status"
          aria-live="polite"
        >
          {instructions[step]}
        </p>
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div>
            <button
              type="button"
              ref={opener}
              onClick={() => setLightbox(finished ? 2 : 0)}
              className="bg-card relative block w-full overflow-hidden rounded-2xl border"
              aria-label={zh ? '放大案例照片' : 'Enlarge example photo'}
            >
              <Image
                unoptimized
                src={images[finished ? 2 : 0].url}
                alt={images[finished ? 2 : 0].alt}
                width={1086}
                height={1448}
                draggable={false}
                className="pointer-events-none h-auto w-full"
              />
              {placed && (
                <Image
                  unoptimized
                  src={images[1].url}
                  alt={
                    zh
                      ? '固定示例位置的手动叠放'
                      : 'Manual overlay at the fixed example position'
                  }
                  width={1254}
                  height={1254}
                  draggable={false}
                  className="pointer-events-none absolute mix-blend-multiply"
                  style={{
                    left: '19.5%',
                    top: '33%',
                    width: '27%',
                    height: '20.3%',
                    transform: 'rotate(8deg)',
                  }}
                />
              )}
              <span className="absolute top-4 right-4 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-800">
                {zh ? '点击放大' : 'Click to enlarge'}
              </span>
            </button>
            <p className="text-muted-foreground mt-4 text-xs leading-6">
              {finished
                ? zh
                  ? '这是真实保存的 AI 试戴结果。实际生成效果可能不同。'
                  : 'This is the real saved AI try-on result. New generations may differ.'
                : placed
                  ? zh
                    ? '这里是固定位置的手动叠放，下一步才是 AI 真实渲染。'
                    : 'This is a fixed manual overlay. The next step shows realistic AI rendering.'
                  : zh
                    ? '示例照片只用于演示。工作室支持你自己的局部或侧面照片。'
                    : 'This sample demonstrates the workflow. The studio also accepts your own close-up or side-view photos.'}
            </p>
          </div>
          <div className="space-y-4">
            <article className="bg-card rounded-xl border p-5">
              <h3 className="font-medium">1 / {labels[0]}</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {zh
                  ? '先选择没有纹身的原始照片。'
                  : 'Start with the original photo before the tattoo.'}
              </p>
              <button
                type="button"
                className={buttonClass}
                disabled={step !== 0}
                onClick={() => setStep(1)}
              >
                {step > 0
                  ? zh
                    ? '照片已选好'
                    : 'Photo selected'
                  : zh
                    ? '选择这张照片'
                    : 'Use this sample photo'}
              </button>
            </article>
            <article className="bg-card rounded-xl border p-5">
              <h3 className="font-medium">2 / {labels[1]}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {zh
                  ? GUNDAM_DESIGN_NOTE.zh
                  : GUNDAM_DESIGN_NOTE.en}
              </p>
              <button
                type="button"
                className={buttonClass}
                disabled={step !== 1}
                onClick={() => setStep(2)}
              >
                {step >= 2
                  ? zh
                    ? '图案已展示'
                    : 'Design revealed'
                  : zh
                    ? '查看上传的图案'
                    : 'Reveal uploaded design'}
              </button>
              {step >= 2 && (
                <button
                  type="button"
                  className="mt-4 block"
                  onClick={() => setLightbox(1)}
                  aria-label={zh ? '放大纹身图案' : 'Enlarge tattoo design'}
                >
                  <Image
                    unoptimized
                    src={images[1].url}
                    alt={images[1].alt}
                    width={100}
                    height={100}
                    className="rounded-lg border bg-white"
                  />
                </button>
              )}
            </article>
            <article className="bg-card rounded-xl border p-5">
              <h3 className="font-medium">3 / {labels[2]}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {zh
                  ? '案例使用固定的肱二头肌位置，点击即可确认。真实自由移动、缩放和旋转在工作室中体验。'
                  : 'This guided example uses a fixed biceps placement. Free movement, resizing and rotation are available in the studio.'}
              </p>
              <button
                type="button"
                className={buttonClass}
                disabled={step !== 2}
                onClick={() => setStep(3)}
              >
                {step >= 3
                  ? zh
                    ? '示例位置已确认'
                    : 'Placement confirmed'
                  : zh
                    ? '套用示例位置'
                    : 'Apply preset placement'}
              </button>
            </article>
            <article className="bg-card rounded-xl border p-5">
              <h3 className="font-medium">4 / {labels[3]}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {zh
                  ? '查看该设计在相同示例位置上的一张已保存 AI 图片。'
                  : 'View one saved AI image of this design at the same preset location.'}
              </p>
              <button
                type="button"
                className={`${buttonClass} bg-primary text-primary-foreground enabled:hover:bg-primary/90`}
                disabled={step !== 3}
                onClick={() => setStep(4)}
              >
                {zh ? '查看真实 AI 结果' : 'View saved AI result'}
              </button>
            </article>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            className={buttonClass}
            onClick={() => setStep(0)}
          >
            {zh ? '重新体验案例' : 'Restart example'}
          </button>
          <a
            href={studioUrl(undefined, locale)}
            className={`${buttonClass} bg-primary text-primary-foreground`}
          >
            {zh ? '用自己的照片进入工作室' : 'Try your own photo in the studio'}
          </a>
        </div>
        <Lightbox
          images={images}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndexChange={setLightbox}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          labels={{
            close: zh ? '关闭' : 'Close',
            description: zh ? '保存的真实案例图片' : 'Saved real example images',
          }}
        />
      </div>
    </section>
  );
}
