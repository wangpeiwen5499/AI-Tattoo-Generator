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
  'guides the %s Gundam biceps example through four button actions without editing or provider calls',
  (locale) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const zh = locale === 'zh';
    render(<PreviewWorkflowCase locale={locale} />);
    const reveal = screen.getByRole('button', {
      name: zh ? '查看上传的图案' : 'Reveal uploaded design',
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
          zh ? '已上传的高达纹身图案' : 'Uploaded Gundam tattoo design'
        )
        .getAttribute('src')
    ).toContain('gundam-biceps/design.webp');
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
          zh ? '保存的 AI 肱二头肌试戴结果' : 'Saved AI biceps try-on result'
        )
        .getAttribute('src')
    ).toContain('gundam-biceps/result.webp');
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

it('presents the uploaded design honestly instead of a generation prompt', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const { container } = render(<PreviewWorkflowCase locale="en" />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Use this sample photo' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reveal uploaded design' }));
  expect(container.textContent).toContain('uploaded by the user');
  expect(container.textContent).not.toMatch(
    /prompt was used|generated on this site as a design/
  );
  expect(container.textContent).not.toMatch(/wolf|calf/i);
});
