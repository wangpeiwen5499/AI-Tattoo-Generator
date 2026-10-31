// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { PreviewWorkflowCase } from '@/shared/blocks/tattoo/preview-workflow-case';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each(['en', 'zh'])(
  'guides the %s example through four button actions without editing or provider calls',
  (locale) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const zh = locale === 'zh';
    render(<PreviewWorkflowCase locale={locale} />);
    const reveal = screen.getByRole('button', {
      name: zh ? '查看已生成图案' : 'Reveal saved design',
    }) as HTMLButtonElement;
    const place = screen.getByRole('button', {
      name: zh ? '套用示例位置' : 'Apply preset placement',
    }) as HTMLButtonElement;
    const result = screen.getByRole('button', {
      name: zh ? '查看真实 AI 结果' : 'View saved AI result',
    }) as HTMLButtonElement;
    expect(reveal.disabled).toBe(true);
    expect(place.disabled).toBe(true);
    expect(result.disabled).toBe(true);
    fireEvent.click(
      screen.getByRole('button', {
        name: zh ? '选择这张照片' : 'Use this sample photo',
      })
    );
    expect(reveal.disabled).toBe(false);
    fireEvent.click(reveal);
    expect(screen.getByRole('status').textContent).toContain(
      zh ? '套用示例位置' : 'Apply the preset placement'
    );
    expect(
      screen
        .getByAltText(
          zh ? '已保存的几何狼头纹身设计' : 'Saved geometric wolf tattoo design'
        )
        .getAttribute('src')
    ).toContain('/design.webp');
    fireEvent.click(place);
    expect(
      screen.getByAltText(
        zh
          ? '固定示例位置的手动叠放'
          : 'Manual overlay at the fixed example position'
      )
    ).toBeTruthy();
    fireEvent.click(result);
    expect(
      screen
        .getByAltText(
          zh ? '保存的 AI 小腿试戴结果' : 'Saved AI calf example result'
        )
        .getAttribute('src')
    ).toContain('/calf.webp');
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
    expect(
      screen.queryByRole('button', {
        name: /Move tattoo|Resize tattoo|Rotate tattoo/,
      })
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', {
        name: zh ? '重新体验案例' : 'Restart example',
      })
    );
    expect(reveal.disabled).toBe(true);
  }
);
