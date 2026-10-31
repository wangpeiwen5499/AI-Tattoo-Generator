// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it } from 'vitest';

import { createStudioI18n } from '../public/try-on-lab/i18n.mjs';

beforeEach(() => {
  document.documentElement.innerHTML = readFileSync(
    'public/try-on-lab/index.html',
    'utf8'
  );
  history.replaceState({}, '', '/try-on-lab/');
});

it('uses Chinese by default and English only when requested', () => {
  expect(createStudioI18n().t('我的图案')).toBe('我的图案');
  history.replaceState({}, '', '?lang=en');
  const i18n = createStudioI18n();
  expect(i18n.t('我的图案')).toBe('My designs');
  i18n.apply();
  expect(document.documentElement.lang).toBe('en');
  expect(document.title).toBe('TattooVis · Try-on Studio Preview');
  expect(document.getElementById('nav-history')?.textContent).toBe(
    'Try-on history'
  );
});

it('translates explicit labels and attributes while preserving input and saved names', () => {
  const prompt = document.getElementById('prompt') as HTMLTextAreaElement;
  prompt.value = '我的图案 <script>stays a prompt</script>';
  const name = document.getElementById('design-name')!;
  name.removeAttribute('data-i18n');
  name.textContent = '我的图案';
  const arbitrary = document.createElement('p');
  arbitrary.textContent = '我的图案';
  document.body.append(arbitrary);
  createStudioI18n('en').apply();
  expect(prompt.value).toBe('我的图案 <script>stays a prompt</script>');
  expect(prompt.placeholder).toContain('Subject');
  expect(name.textContent).toBe('我的图案');
  expect(arbitrary.textContent).toBe('我的图案');
  expect(
    document.getElementById('stage')?.getAttribute('aria-label')
  ).toContain('Drag');
  expect(
    document.querySelector('#authorization-summary span')?.textContent
  ).toBe('Complete before generating');
  expect(document.querySelector('#flip-design kbd')?.textContent).toBe('F');
  expect(document.getElementById('ink-value')?.textContent).toBe('85%');
});

it('translates core rates, balances, progress, placement and readiness templates', () => {
  const { t } = createStudioI18n('en');
  expect(t('可用测试积分 3 credits · 预留 1')).toBe(
    'Available test credits: 3 · Reserved: 1'
  );
  expect(t('生成真实试戴效果 · 3 测试 credits')).toBe(
    'Generate try-on · 3 test credits'
  );
  expect(t('4K · 3 测试 credits')).toBe('4K · 3 test credits');
  expect(t('大小 120% · 旋转 -30° · 深浅 85%')).toBe(
    'Size 120% · Rotation -30° · Ink 85%'
  );
  expect(t('还需完成：上传部位照片；补充测试积分。')).toBe(
    'Still needed: upload a body photo; add test credits.'
  );
  expect(
    t('已准备好。成功后结算 2 测试 credits，失败释放预留。不使用网站真实积分。')
  ).toBe(
    'Ready. 2 test credits are charged on success; failed tasks release the reservation. Your website credits are not used.'
  );
  expect(t('正在创作图案…')).toBe('Creating your design…');
  expect(t('已经是English / 未知用户内容')).toBe(
    '已经是English / 未知用户内容'
  );
});

it('can restore static Chinese labels without overwriting user input', () => {
  const input = document.getElementById('prompt') as HTMLTextAreaElement;
  input.value = 'dragon';
  createStudioI18n('en').apply();
  createStudioI18n('zh').apply();
  expect(document.documentElement.lang).toBe('zh-CN');
  expect(document.getElementById('nav-designs')?.textContent).toBe('我的图案');
  expect(input.value).toBe('dragon');
});

it('covers all explicitly marked static text and preserves status details safely', () => {
  const { t, apply } = createStudioI18n('en');
  apply();
  for (const node of document.querySelectorAll('[data-i18n]')) {
    expect(node.textContent, node.getAttribute('data-i18n')!).not.toMatch(
      /[\u3400-\u9fff]/
    );
  }
  expect(
    t('正在生成单张真实试戴…\n可离开此页，回来后输入测试口令并点击继续查看。')
  ).toContain('resume the saved task');
  expect(
    t(
      '图案已生成，但浏览器保存失败：Quota exceeded。请先下载图案，稍后可免费重试保存。 本次未结算测试积分。'
    )
  ).toContain('No test credits were charged');
});
