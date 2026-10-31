// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const element = (id: string) => document.getElementById(id) as any;
let requests: { mode: string | null; data: any }[];

beforeEach(async () => {
  vi.resetModules();
  document.documentElement.innerHTML = readFileSync(
    'public/try-on-lab/index.html',
    'utf8'
  );
  sessionStorage.clear();
  const context = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'getImageData')
          return () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) });
        if (key === 'createRadialGradient')
          return () => ({ addColorStop() {} });
        return () => {};
      },
      set: () => true,
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as any
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/png;base64,AA'
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => callback(new Blob(['image']))
  );
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 800;
      naturalHeight = 1200;
      width = 800;
      height = 1200;
      onload: any;
      url = '';
      get src() {
        return this.url;
      }
      set src(value: string) {
        this.url = value;
        queueMicrotask(() => this.onload?.());
      }
    }
  );
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: any) => {
      const url = new URL(input, 'https://local');
      const mode = url.searchParams.get('mode');
      if (!options?.method && !url.searchParams.has('asset'))
        return new Response(JSON.stringify({ configured: true }), {
          headers: { 'content-type': 'application/json' },
        });
      const data =
        typeof options.body === 'string' ? JSON.parse(options.body) : null;
      requests.push({ mode, data });
      if (url.searchParams.has('asset'))
        return new Response(new Blob(['image']));
      return new Response(
        JSON.stringify(
          mode === 'upload'
            ? { asset: 'asset' }
            : mode === 'render'
              ? { task: 'task' }
              : { state: 'success', asset: 'result' }
        )
      );
    })
  );
  const stage = element('stage');
  stage.setPointerCapture = () => {};
  stage.releasePointerCapture = () => {};
  stage.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 800,
    height: 1200,
  });
  await import('../public/try-on-lab/studio.mjs');
  Object.defineProperty(element('photo'), 'files', {
    value: [new File(['photo'], 'photo.png', { type: 'image/png' })],
  });
  element('photo').dispatchEvent(new Event('change'));
  await waitFor(() => expect(element('empty').hidden).toBe(true));
  await element('sample-design').onclick();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function pointer(type: string, x: number, y: number, id = 1) {
  element('stage')[`onpointer${type}`]({
    clientX: x,
    clientY: y,
    pointerId: id,
    preventDefault() {},
  });
}
function placement() {
  return JSON.parse(element('stage').dataset.placement);
}
function key(value: string, shiftKey = false) {
  element('stage').onkeydown({ key: value, shiftKey, preventDefault() {} });
}
function adjustWithKeyboard(id: string, target: number) {
  const property: Record<string, string> = {
    scale: 'scale',
    rotation: 'rotation',
    opacity: 'opacity',
    'placement-x': 'px',
    'placement-y': 'py',
  };
  const multiplier = id === 'rotation' ? 1 : 100;
  for (let attempts = 0; attempts < 300; attempts++) {
    const current = placement()[property[id]] * multiplier;
    if (Math.abs(current - target) < 0.01) return;
    const up = current < target;
    if (id === 'scale') key(up ? '+' : '-');
    else if (id === 'rotation') key('r', !up);
    else if (id === 'opacity') key(up ? ']' : '[');
    else if (id === 'placement-x') key(up ? 'ArrowRight' : 'ArrowLeft');
    else key(up ? 'ArrowDown' : 'ArrowUp');
  }
  throw new Error('Keyboard adjustment did not reach target');
}
async function renderResult() {
  element('access-token').value = 'a'.repeat(32);
  element('consent').checked = true;
  element('consent').dispatchEvent(new Event('input'));
  await element('render').onclick();
}

it('makes uploaded designs immediately editable without selecting a region or making paid requests', () => {
  expect(document.querySelector('.controls input[type="range"]')).toBeNull();
  expect(element('stage').dataset.placement).toBeTruthy();
  expect(element('select-region')).toBeNull();
  pointer('down', 400, 600);
  pointer('move', 480, 660);
  pointer('up', 480, 660);
  expect(placement().px * 100).toBeCloseTo(60);
  expect(placement().py * 100).toBeCloseTo(55);
  expect(requests).toHaveLength(0);
});

it('supports two-finger scale and rotation, then continues dragging after one finger lifts', () => {
  pointer('down', 360, 600, 1);
  pointer('down', 440, 600, 2);
  pointer('move', 400, 520, 1);
  pointer('move', 400, 680, 2);
  expect(placement().scale * 100).toBeCloseTo(200);
  expect(placement().rotation).toBeCloseTo(90);
  pointer('up', 400, 680, 2);
  pointer('move', 440, 520, 1);
  pointer('up', 440, 520, 1);
  expect(placement().px * 100).toBeCloseTo(55);
  expect(requests).toHaveLength(0);
});

it('preserves placement across original comparison and sends the latest automatic region on explicit render', async () => {
  adjustWithKeyboard('placement-x', 70);
  adjustWithKeyboard('rotation', 35);
  (
    document.querySelector('[data-view="original"]') as HTMLButtonElement
  ).click();
  (document.querySelector('[data-view="draft"]') as HTMLButtonElement).click();
  expect(placement().px * 100).toBeCloseTo(70);
  expect(placement().rotation).toBe(35);
  await renderResult();
  const renders = requests.filter((r) => r.mode === 'render');
  expect(renders).toHaveLength(1);
  expect(renders[0].data.region.x).toBeGreaterThan(0.2);
  expect(element('inspect-result').hidden).toBe(false);
});

it('compares three sources at the same detail zoom and keeps editing transforms on closing', async () => {
  adjustWithKeyboard('rotation', 30);
  await renderResult();
  element('inspect-result').click();
  expect(element('detail-dialog').open).toBe(true);
  expect(element('detail-image').src).toMatch(/^data:image\/png/);
  element('detail-zoom').value = '250';
  element('detail-zoom').dispatchEvent(new Event('input'));
  for (const view of ['original', 'draft', 'raw']) {
    (
      document.querySelector(
        `[data-detail-view="${view}"]`
      ) as HTMLButtonElement
    ).click();
    expect(element('detail-zoom').value).toBe('250');
    expect(
      document
        .querySelector(`[data-detail-view="${view}"]`)
        ?.getAttribute('aria-pressed')
    ).toBe('true');
  }
  element('detail-close').click();
  (document.querySelector('[data-view="draft"]') as HTMLButtonElement).click();
  expect(placement().rotation).toBe(30);
  adjustWithKeyboard('opacity', 70);
  expect(element('inspect-result').hidden).toBe(true);
});

it('removes a design and prevents rendering until a new design is selected', () => {
  key('Delete');
  expect(element('flip-design').disabled).toBe(true);
  expect(element('render').disabled).toBe(true);
  expect(element('design-thumb').hidden).toBe(true);
});

it('can enlarge a recovered result even when its local design is no longer available', async () => {
  element('remove-design').click();
  sessionStorage.setItem(
    'try-on-lab-task',
    JSON.stringify({ task: 'saved', kind: 'render' })
  );
  element('access-token').value = 'a'.repeat(32);
  await element('resume-task').onclick();
  expect(element('inspect-result').hidden).toBe(false);
  element('inspect-result').click();
  expect(element('detail-dialog').open).toBe(true);
  expect(
    (document.querySelector('[data-detail-view="draft"]') as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(element('detail-image').src).toMatch(/^data:image\/png/);
});

it('locks placement and rejects duplicate renders during an in-flight upload', async () => {
  let release: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      })
  );
  const pending = renderResult();
  await waitFor(() => expect(element('render').disabled).toBe(true));
  pointer('down', 400, 600);
  pointer('move', 500, 700);
  pointer('up', 500, 700);
  expect(placement().px).toBe(0.5);
  expect(element('flip-design').disabled).toBe(true);
  await element('render').onclick();
  release!(new Response(JSON.stringify({ asset: 'first' })));
  await pending;
  expect(requests.filter((r) => r.mode === 'render')).toHaveLength(1);
});

it('does not compare an older resumed task with a newly edited placement', async () => {
  const normalFetch = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (url, options) => {
    if (String(url).includes('mode=status'))
      throw new Error('Connection interrupted');
    return normalFetch(url, options);
  });
  await renderResult();
  expect(sessionStorage.getItem('try-on-lab-task')).not.toBeNull();
  adjustWithKeyboard('placement-x', 75);
  vi.mocked(fetch).mockImplementation(normalFetch);
  await element('resume-task').onclick();
  element('inspect-result').click();
  expect(element('detail-dialog').open).toBe(true);
  expect(
    (
      document.querySelector(
        '[data-detail-view="original"]'
      ) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  expect(
    (document.querySelector('[data-detail-view="draft"]') as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(
    (document.querySelector('[data-view="composite"]') as HTMLButtonElement)
      .hidden
  ).toBe(true);
});
it('removes the standalone adjustment panel and supports in-photo menu and keyboard operations', () => {
  expect(document.querySelector('.controls input[type="range"]')).toBeNull();
  const stage = element('stage');
  stage.onkeydown({ key: 'F10', shiftKey: true, preventDefault() {} });
  expect(element('tattoo-menu').hidden).toBe(false);
  expect(element('tattoo-menu').contains(element('flip-design'))).toBe(true);
});

it('keeps a small tattoo at the same size when dragging its center on a mobile-sized canvas', () => {
  adjustWithKeyboard('scale', 20);
  element('stage').getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 300,
    height: 450,
  });
  pointer('down', 150, 225);
  pointer('move', 170, 225);
  pointer('up', 170, 225);
  expect(placement().scale * 100).toBeCloseTo(20);
  expect(placement().px * 100).toBeGreaterThan(50);
});

it('adjusts ink opacity by dragging its on-photo handle without moving the tattoo', () => {
  pointer('down', 242, 408);
  pointer('move', 242, 390);
  pointer('up', 242, 390);
  expect(placement().opacity).toBeCloseTo(0.95);
  expect(placement().px).toBe(0.5);
  expect(placement().scale).toBe(1);
  expect(requests).toHaveLength(0);
});
it('opens an on-photo ink slider on a tap and closes it on Escape without paid calls', () => {
  pointer('down', 242, 408);
  pointer('up', 242, 408);
  expect(element('ink-popover').hidden).toBe(false);
  element('ink-opacity').value = '50';
  element('ink-opacity').dispatchEvent(new Event('input'));
  expect(placement().opacity).toBeCloseTo(0.5);
  expect(placement().px).toBe(0.5);
  element('ink-popover').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  expect(element('ink-popover').hidden).toBe(true);
  expect(requests).toHaveLength(0);
});
it('opens the native photo picker from the visible upload action', () => {
  const picker = vi.spyOn(element('photo'), 'click');
  element('choose-photo').click();
  expect(picker).toHaveBeenCalledOnce();
});
it('guides placement, then comparison, and downloads the selected comparison source', async () => {
  expect(element('workflow-title').textContent).toContain('摆放');
  await renderResult();
  expect(element('workflow-title').textContent).toContain('对比');
  element('inspect-result').click();
  (
    document.querySelector('[data-detail-view="original"]') as HTMLButtonElement
  ).click();
  const download = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('tattoovis-original.png');
    });
  element('detail-download').click();
  expect(download).toHaveBeenCalledOnce();
});
it('shows native image pixels even when they exceed five times the fitted size', async () => {
  await renderResult();
  Object.defineProperty(element('detail-viewport'), 'clientWidth', {
    configurable: true,
    value: 100,
  });
  Object.defineProperty(element('detail-viewport'), 'clientHeight', {
    configurable: true,
    value: 100,
  });
  element('inspect-result').click();
  element('detail-native').click();
  expect(element('detail-image').style.width).toBe('800px');
  expect(element('detail-image').style.height).toBe('1200px');
});
it('refits the open comparison when its full-window viewport changes size', async () => {
  await renderResult();
  const viewport = element('detail-viewport');
  Object.defineProperty(viewport, 'clientWidth', {
    configurable: true,
    value: 200,
  });
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: 300,
  });
  element('inspect-result').click();
  expect(parseFloat(element('detail-image').style.width)).toBeCloseTo(200);
  Object.defineProperty(viewport, 'clientWidth', {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: 600,
  });
  window.dispatchEvent(new Event('resize'));
  expect(parseFloat(element('detail-image').style.width)).toBeCloseTo(400);
  expect(element('detail-dialog').style.width).toBe('');
});
it('keeps the photo point under the fingers when pinching a centered portrait comparison', async () => {
  await renderResult();
  const viewport = element('detail-viewport');
  Object.defineProperty(viewport, 'clientWidth', {
    configurable: true,
    value: 100,
  });
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: 100,
  });
  viewport.getBoundingClientRect = () => ({ left: 0, top: 0 });
  viewport.setPointerCapture = () => {};
  element('inspect-result').click();
  const point = (type: string, id: number, x: number) =>
    viewport[`onpointer${type}`]({
      pointerId: id,
      clientX: x,
      clientY: 50,
      preventDefault() {},
    });
  point('down', 1, 40);
  point('down', 2, 60);
  point('move', 1, 30);
  point('move', 2, 70);
  expect(viewport.scrollLeft).toBeCloseTo(100 / 6);
});
it('fits a taller AI result without stretching or cropping when its aspect differs from the original', async () => {
  const viewport = element('detail-viewport');
  Object.defineProperty(viewport, 'clientWidth', {
    configurable: true,
    value: 700,
  });
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: 500,
  });
  const original = document.createElement('canvas');
  original.width = 1200;
  original.height = 800;
  const raw = document.createElement('canvas');
  raw.width = 800;
  raw.height = 1200;
  const { createDetailViewer } =
    await import('../public/try-on-lab/detail-viewer.mjs');
  createDetailViewer(() => ({ original, raw })).open();
  element('detail-fit').click();
  expect(parseFloat(element('detail-image').style.height)).toBeCloseTo(500);
  expect(parseFloat(element('detail-image').style.width)).toBeCloseTo(
    (500 * 2) / 3
  );
});
it('opens the tattoo menu with a touch long press and returns focus on Escape', () => {
  vi.useFakeTimers();
  element('stage').onpointerdown({
    clientX: 400,
    clientY: 600,
    pointerId: 7,
    pointerType: 'touch',
    preventDefault() {},
  });
  vi.advanceTimersByTime(600);
  expect(element('tattoo-menu').hidden).toBe(false);
  element('tattoo-menu').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  expect(element('tattoo-menu').hidden).toBe(true);
  expect(document.activeElement).toBe(element('stage'));
  expect(requests).toHaveLength(0);
});
it('flips and resets directly through keyboard commands without provider requests', () => {
  key('f');
  expect(placement().flipped).toBe(true);
  key('ArrowRight');
  key('r');
  key('0');
  expect(placement()).toMatchObject({
    px: 0.5,
    py: 0.5,
    scale: 1,
    rotation: 0,
    flipped: false,
  });
  expect(requests).toHaveLength(0);
});
