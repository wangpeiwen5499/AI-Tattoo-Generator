// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const source = readFileSync('public/try-on-lab/index.html', 'utf8');

it('hides all studio content before runtime mode is known, using inline first-paint CSS', () => {
  document.documentElement.innerHTML = source;
  expect(document.title).toBe('TattooVis');
  expect(document.body.dataset.runtimeReady).toBe('false');
  expect(getComputedStyle(document.querySelector('main')!).display).toBe(
    'none'
  );
  expect(getComputedStyle(document.querySelector('header')!).display).toBe(
    'none'
  );
  expect(document.getElementById('studio-bootstrap')?.hidden).toBe(false);
  expect(
    document.querySelector('.studio-bootstrap-reload')?.getAttribute('href')
  ).toBe('');
  const firstPaintCSS = source.indexOf('body[data-runtime-ready=');
  expect(firstPaintCSS).toBeGreaterThan(0);
  expect(firstPaintCSS).toBeLessThan(source.indexOf('href="./studio.css"'));
});

it.each(['en', 'zh'])(
  'selects the %s loading language before any network request',
  (locale) => {
    document.documentElement.innerHTML = source;
    history.replaceState({}, '', `?lang=${locale}`);
    const inline = document.querySelector('head script')!;
    new Function(inline.textContent || '')();
    const english = document.querySelector('.studio-boot-en')!;
    const chinese = document.querySelector('.studio-boot-zh')!;
    expect(document.documentElement.lang).toBe(
      locale === 'en' ? 'en' : 'zh-CN'
    );
    expect(
      getComputedStyle(locale === 'en' ? english : chinese).display
    ).not.toBe('none');
    expect(getComputedStyle(locale === 'en' ? chinese : english).display).toBe(
      'none'
    );
  }
);

