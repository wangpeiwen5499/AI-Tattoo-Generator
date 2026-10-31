// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let accountRecords: any[] = [];
let serverPending: any[] = [];
let statusReply: any = null;
const element = (id: string) => document.getElementById(id) as any;
let requests: { mode: string | null; data: any }[];
const saved = vi.hoisted(() => ({
  designs: [] as any[],
  history: [] as any[],
  failDesign: false,
  pending: new Map<string, any>(),
}));
vi.mock('../public/try-on-lab/library.mjs', () => ({
  createStudioLibrary: () => ({
    listDesigns: async () => saved.designs,
    listHistory: async () => saved.history,
    savePending: async (record: any) => {
      saved.pending.set(record.id, record);
      return record;
    },
    getPending: async (id: string) => saved.pending.get(id),
    deletePending: async (id: string) => {
      saved.pending.delete(id);
    },
    saveDesign: async (record: any) => {
      if (saved.failDesign) throw new Error('quota');
      saved.designs = saved.designs.filter((item) => item.id !== record.id);
      saved.designs.push(record);
      return record;
    },
    saveHistory: async (record: any) => {
      saved.history = saved.history.filter((item) => item.id !== record.id);
      saved.history.push(record);
      return record;
    },
    deleteDesign: async (id: string) => {
      saved.designs = saved.designs.filter((item) => item.id !== id);
    },
    deleteHistory: async (id: string) => {
      saved.history = saved.history.filter((item) => item.id !== id);
    },
  }),
}));

beforeEach(async () => {
  vi.resetModules();
  document.documentElement.innerHTML = readFileSync(
    'public/try-on-lab/index.html',
    'utf8'
  );
  sessionStorage.clear();
  localStorage.clear();
  saved.designs = [];
  saved.history = [];
  saved.failDesign = false;
  saved.pending.clear();
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
  accountRecords = [];
  serverPending = [];
  statusReply = null;
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true)
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: any) => {
      const url = new URL(input, 'https://local');
      const mode = url.searchParams.get('mode');
      if (url.pathname === '/api/preview/try-on')
        return new Response('', { status: 404 });
      if (url.searchParams.has('collection'))
        return new Response(JSON.stringify({ records: accountRecords }));
      if (!options?.method && !url.searchParams.has('asset'))
        return new Response(
          JSON.stringify({
            mode: 'account',
            configured: true,
            signedIn: true,
            verified: true,
            userId: 'account-a',
            credits: 20,
            pending: serverPending,
          }),
          {
            headers: { 'content-type': 'application/json' },
          }
        );
      const data =
        typeof options.body === 'string' ? JSON.parse(options.body) : null;
      requests.push({ mode, data });
      if (mode === 'design')
        accountRecords.push({
          id: 'saved-design',
          operationId: data.operationId,
          image: 'result',
          prompt: data.prompt,
          name: 'Generated',
          source: 'generated',
          createdAt: Date.now(),
        });
      if (mode === 'render')
        accountRecords.push({
          id: 'saved-result',
          operationId: data.operationId,
          image: 'result',
          original: 'photo',
          draft: 'guide',
          resolution: data.resolution,
          createdAt: Date.now(),
        });
      if (url.searchParams.has('asset'))
        return new Response(new Blob(['image']));
      return new Response(
        JSON.stringify(
          mode === 'upload'
            ? { asset: 'asset' }
            : mode === 'render' || mode === 'design'
              ? { task: 'task' }
              : statusReply || { state: 'success', asset: 'result' }
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

it('uses account credits and explicit production copy without constructing a test wallet', () => {
  expect(localStorage.getItem('tattoovis-preview-wallet-v1')).toBeNull();
  expect(element('grant-test-credits').hidden).toBe(true);
  expect(document.querySelector('.test-config')?.hasAttribute('hidden')).toBe(
    true
  );
  expect(element('credit-balance').textContent).toContain('20');
  expect(element('credit-balance').textContent).not.toContain('测试');
  expect(document.querySelector('footer')?.textContent).not.toContain(
    'Preview'
  );
  expect(document.querySelector('.site-account')?.getAttribute('href')).toBe(
    '/zh/settings/profile'
  );
});

it('submits a design operation ID and resolves the server saved design without uploading twice', async () => {
  element('prompt').value = 'A tiny fern tattoo';
  element('prompt').dispatchEvent(new Event('input'));
  await element('generate-design').onclick();
  const submitted = requests.find((item) => item.mode === 'design')!;
  expect(submitted.data.operationId).toMatch(/^[a-f0-9-]{36}$/);
  expect(requests.filter((item) => item.mode === 'upload')).toHaveLength(0);
  expect(element('save-design').disabled).toBe(true);
  expect(localStorage.getItem('tattoovis-preview-wallet-v1')).toBeNull();
});

it('includes operation ID and prompt in paid rendering and saves no duplicate result', async () => {
  await element('render').onclick();
  const submitted = requests.find((item) => item.mode === 'render')!;
  expect(submitted.data.operationId).toMatch(/^[a-f0-9-]{36}$/);
  expect(submitted.data).toHaveProperty('prompt');
  expect(element('save-result').disabled).toBe(true);
  expect(saved.history).toHaveLength(0);
});

it('resumes a server pending job from another device without local test authorization', async () => {
  serverPending.push({
    task: 'cross-device-task',
    kind: 'design',
    operationId: 'remote-operation',
    prompt: 'fern',
  });
  accountRecords.push({
    id: 'remote-design',
    operationId: 'remote-operation',
    image: 'result',
    name: 'Fern',
    prompt: 'fern',
    source: 'generated',
    createdAt: Date.now(),
  });
  await element('check-configuration').onclick();
  expect(element('resume-task').hidden).toBe(false);
  await element('resume-task').onclick();
  expect(requests.find((item) => item.mode === 'status')?.data.task).toBe(
    'cross-device-task'
  );
  expect(element('save-design').disabled).toBe(true);
  expect(element('access-token').value).toBe('');
});

it('reuses the owned asset of a saved design when rendering with its design ID', async () => {
  accountRecords.push({
    id: 'existing-design',
    image: 'existing-owned-asset',
    name: 'Saved fern',
    prompt: 'fern',
    source: 'upload',
    createdAt: Date.now(),
  });
  await element('open-design-library').onclick();
  const use = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === '使用图案'
  )!;
  use.click();
  await waitFor(() =>
    expect(element('design-name').textContent).toBe('Saved fern')
  );
  await element('render').onclick();
  const submitted = requests.find((item) => item.mode === 'render')!;
  expect(submitted.data.design).toBe('existing-owned-asset');
  expect(submitted.data.designId).toBe('existing-design');
  expect(requests.filter((item) => item.mode === 'upload')).toHaveLength(2);
});

it('retains ambiguous tasks without claiming a refund or polling forever', async () => {
  statusReply = {
    state: 'review_required',
    error: 'Submission under review. Credit held; contact support.',
  };
  element('prompt').value = 'A tiny fern tattoo';
  await element('generate-design').onclick();
  expect(requests.filter((item) => item.mode === 'status')).toHaveLength(1);
  expect(element('status').textContent).toContain('Credit held');
  expect(element('resume-task').hidden).toBe(false);
  expect(element('status').textContent).not.toContain('退回');
});

it('still resumes authoritative pending work when browser storage is blocked', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
  serverPending.push({
    task: 'server-task',
    kind: 'design',
    operationId: 'remote-op',
    prompt: 'fern',
  });
  accountRecords.push({
    id: 'remote',
    operationId: 'remote-op',
    image: 'result',
    name: 'Fern',
    prompt: 'fern',
    source: 'generated',
    createdAt: Date.now(),
  });
  await element('check-configuration').onclick();
  expect(element('resume-task').hidden).toBe(false);
  await element('resume-task').onclick();
  expect(requests.find((item) => item.mode === 'status')?.data.task).toBe(
    'server-task'
  );
  expect(element('save-design').disabled).toBe(true);
});
