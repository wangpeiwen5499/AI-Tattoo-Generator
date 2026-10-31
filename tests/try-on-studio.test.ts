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
function slider(id: string, value: number) {
  element(id).value = String(value);
  element(id).oninput();
}
async function renderResult() {
  element('access-token').value = 'a'.repeat(32);
  element('consent').checked = true;
  element('consent').dispatchEvent(new Event('input'));
  await element('render').onclick();
}

it('makes uploaded designs immediately editable without selecting a region or making paid requests', () => {
  expect(element('scale').disabled).toBe(false);
  expect(element('select-region')).toBeNull();
  pointer('down', 400, 600);
  pointer('move', 480, 660);
  pointer('up', 480, 660);
  expect(Number(element('placement-x').value)).toBeCloseTo(60);
  expect(Number(element('placement-y').value)).toBeCloseTo(55);
  expect(requests).toHaveLength(0);
});

it('supports two-finger scale and rotation, then continues dragging after one finger lifts', () => {
  pointer('down', 360, 600, 1);
  pointer('down', 440, 600, 2);
  pointer('move', 400, 520, 1);
  pointer('move', 400, 680, 2);
  expect(Number(element('scale').value)).toBeCloseTo(200);
  expect(Number(element('rotation').value)).toBeCloseTo(90);
  pointer('up', 400, 680, 2);
  pointer('move', 440, 520, 1);
  pointer('up', 440, 520, 1);
  expect(Number(element('placement-x').value)).toBeCloseTo(55);
  expect(requests).toHaveLength(0);
});

it('preserves placement across original comparison and sends the latest automatic region on explicit render', async () => {
  slider('placement-x', 70);
  slider('rotation', 35);
  (
    document.querySelector('[data-view="original"]') as HTMLButtonElement
  ).click();
  (document.querySelector('[data-view="draft"]') as HTMLButtonElement).click();
  expect(Number(element('placement-x').value)).toBe(70);
  expect(Number(element('rotation').value)).toBe(35);
  await renderResult();
  const renders = requests.filter((r) => r.mode === 'render');
  expect(renders).toHaveLength(1);
  expect(renders[0].data.region.x).toBeGreaterThan(0.2);
  expect(element('inspect-result').hidden).toBe(false);
});

it('compares three sources at the same detail zoom and keeps editing transforms on closing', async () => {
  slider('rotation', 30);
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
  expect(Number(element('rotation').value)).toBe(30);
  slider('opacity', 70);
  expect(element('inspect-result').hidden).toBe(true);
});

it('removes a design and prevents rendering until a new design is selected', () => {
  element('remove-design').click();
  expect(element('scale').disabled).toBe(true);
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
  expect(element('placement-x').value).toBe('50');
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
  slider('placement-x', 75);
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
