'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';

import { Lightbox } from './lightbox';

const examples = [
  [
    'traditional-arm',
    'Traditional rose on the upper arm',
    '手臂上的传统玫瑰纹身',
    '50% 40%',
  ],
  [
    'snake-calf',
    'Fine-line snake on the calf',
    '小腿上的细线蛇纹身',
    '50% 45%',
  ],
  [
    'wolf-chest',
    'Geometric wolf on the chest',
    '胸前的几何狼头纹身',
    '50% 40%',
  ],
  ['moth-back', 'Blackwork moth on the back', '背部的黑灰飞蛾纹身', '50% 40%'],
  [
    'patchwork-thigh',
    'Colorful patchwork on the thigh',
    '大腿上的彩色拼贴纹身',
    '50% 45%',
  ],
];
export function HeroResults() {
  const zh = useLocale() === 'zh';
  const [index, setIndex] = useState<number | null>(null);
  const images = examples.map(([id, en, cn]) => ({
    url: `/imgs/hero-results/${id}.webp`,
    alt: zh ? cn : en,
  }));
  return (
    <div className="hero-results mx-auto mt-8 max-w-6xl px-4 sm:px-6">
      <p className="text-muted-foreground mb-4 text-center text-sm">
        {zh
          ? '使用 TattooVis 生成的真实试戴效果'
          : 'Real try-on results created with TattooVis'}
      </p>
      <div className="hero-results-strip">
        {images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            className="hero-result"
            aria-label={`${zh ? '放大查看' : 'Enlarge'}: ${img.alt}`}
            onClick={() => setIndex(i)}
          >
            <Image
              src={img.url}
              alt={img.alt}
              width={480}
              height={640}
              sizes="(max-width: 640px) 65vw, (max-width: 1024px) 28vw, 220px"
              style={{ objectPosition: examples[i][3] }}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
      <Lightbox
        images={images}
        index={index}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
        labels={{
          close: zh ? '关闭' : 'Close',
          description: zh
            ? '网站真实生成效果，按左右方向键切换，按 Escape 关闭。'
            : 'Real generated examples. Use arrow keys to browse and Escape to close.',
        }}
      />
    </div>
  );
}
