// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';

import { createStudioI18n } from '../public/try-on-lab/i18n.mjs';
import { STUDIO_BODY_HTML } from '@/shared/blocks/tattoo/studio-markup';

beforeEach(() => {
  document.body.innerHTML = STUDIO_BODY_HTML;
});

it('keeps Chinese content in zh and translates the account studio to English', () => {
  const zh = createStudioI18n('zh', { account: true });
  expect(zh.t('选择图案')).toBe('选择图案');
  expect(
    zh.t('设计与试戴历史保存在你的 TattooVis 账户中，可跨设备查看与复用。')
  ).toBe('设计与试戴历史保存在你的 TattooVis 账户中，可跨设备查看与复用。');

  const en = createStudioI18n('en', { account: true });
  expect(en.t('正在读取账户积分…')).toBe('Loading account credits…');
  expect(en.t('照片与结果保存在你的账户中，不会公开。')).toBe(
    'Photos and results are saved to your account and stay private.'
  );
  expect(
    en.t(
      '生成设计消耗 1 积分；单张试戴按 1K / 2K / 4K 消耗 1 / 2 / 3 积分；上传、摆放、保存与复用免费。'
    )
  ).toContain('A design costs 1 credit');
  expect(en.t('账户服务未就绪，稍后刷新重试')).toContain(
    'account service is not ready'
  );
  expect(en.t('已准备好。成功后结算 2 积分，失败自动退回。')).toBe(
    'Ready. 2 credits settle after success; failures are returned automatically.'
  );
  expect(en.t('可用测试积分 3 credits')).toBe('Available credits: 3');
  expect(en.t('生成真实试戴效果 · 3 测试 credits')).toBe(
    'Generate try-on · 3 credits'
  );
});

it('translates every static label in the account studio without leaking Chinese', () => {
  const { apply } = createStudioI18n('en', { account: true });
  apply();
  const untranslated: string[] = [];
  for (const node of document.querySelectorAll('[data-i18n]')) {
    if (/[\u3400-\u9fff]/.test(node.textContent || ''))
      untranslated.push(node.getAttribute('data-i18n')!);
  }
  expect(untranslated).toEqual([]);
});

it('restores Chinese labels without touching user input', () => {
  const input = document.getElementById('prompt') as HTMLTextAreaElement;
  input.value = 'dragon';
  createStudioI18n('en', { account: true }).apply();
  createStudioI18n('zh', { account: true }).apply();
  expect(document.documentElement.lang).toBe('zh-CN');
  expect(input.value).toBe('dragon');
});
