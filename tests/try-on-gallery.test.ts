// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createStudioGallery } from '../public/try-on-lab/gallery.mjs';

const image = new Blob(['pixels'], { type: 'image/png' });
const design = {
  id: 'rose',
  name: '<img src=x onerror=alert(1)>',
  prompt: '<script>bad()</script>',
  source: 'upload',
  createdAt: 1000,
  image,
};
const history = {
  id: 'result',
  resolution: '4K',
  createdAt: 2000,
  image,
  original: image,
  draft: image,
  prompt: 'rose',
};
let library: any;
let urls: number;
const NativeURL = URL;
const click = async (label: string) => {
  const button = [...document.querySelectorAll('button')].find(
    (item) => item.textContent === label
  );
  expect(button, label).toBeTruthy();
  button!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  document.body.replaceChildren();
  urls = 0;
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static createObjectURL = vi.fn(() => `blob:test-${++urls}`);
      static revokeObjectURL = vi.fn();
    }
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  library = {
    listDesigns: vi.fn(async () => [design]),
    listHistory: vi.fn(async () => [history]),
    deleteDesign: vi.fn(async () => {}),
    deleteHistory: vi.fn(async () => {}),
  };
});
afterEach(() => {
  delete (HTMLDialogElement.prototype as any).showModal;
  delete (HTMLDialogElement.prototype as any).close;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('shows a labelled dialog, plain text metadata, keyboard tabs and Escape close', async () => {
  const gallery = createStudioGallery({ library, locale: 'en' });
  await gallery.open();
  const dialog = document.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  expect(
    document.getElementById(dialog.getAttribute('aria-labelledby')!)
      ?.textContent
  ).toContain('library');
  expect(dialog.textContent).toContain(design.name);
  expect(dialog.querySelector('script')).toBeNull();
  expect(dialog.querySelector('img')?.getAttribute('src')).toBe('blob:test-1');
  const tab = dialog.querySelector('[role=tab]')!;
  tab.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(dialog.querySelector('[aria-selected=true]')?.textContent).toBe(
    'History'
  );
  expect(dialog.textContent).toContain('4K');
  dialog.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  expect(dialog.open).toBe(false);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-2');
});

it('closes before opening a design or complete historical snapshot', async () => {
  const onUseDesign = vi.fn(async (record) => {
    expect(document.querySelector('dialog')!.open).toBe(false);
    expect(record).toBe(design);
  });
  const onOpenHistory = vi.fn(async (record) => {
    expect(document.querySelector('dialog')!.open).toBe(false);
    expect(record.original).toBe(image);
    expect(record.draft).toBe(image);
  });
  const gallery = createStudioGallery({
    library,
    onUseDesign,
    onOpenHistory,
    locale: 'en',
  });
  await gallery.open();
  await click('Use design');
  expect(onUseDesign).toHaveBeenCalledOnce();
  await gallery.open('history');
  await click('Open result');
  expect(onOpenHistory).toHaveBeenCalledOnce();
});

it('guards use, prompt reuse and deletion while busy', async () => {
  let busy = true;
  const onUseDesign = vi.fn();
  const onReusePrompt = vi.fn();
  const gallery = createStudioGallery({
    library,
    onUseDesign,
    onReusePrompt,
    isBusy: () => busy,
    locale: 'en',
  });
  await gallery.open();
  await click('Use design');
  await click('Reuse prompt');
  await click('Delete');
  expect(onUseDesign).not.toHaveBeenCalled();
  expect(onReusePrompt).not.toHaveBeenCalled();
  expect(library.deleteDesign).not.toHaveBeenCalled();
  expect(document.querySelector('.gallery-status')?.textContent).toContain(
    'Wait'
  );
  busy = false;
  await click('Reuse prompt');
  expect(onReusePrompt).toHaveBeenCalledWith(design.prompt);
});

it('requires a second delete click, preserves records on failure and reports errors', async () => {
  library.deleteDesign.mockRejectedValue(new Error('Quota trouble'));
  const gallery = createStudioGallery({ library, locale: 'en' });
  await gallery.open();
  await click('Delete');
  expect(library.deleteDesign).not.toHaveBeenCalled();
  await click('Confirm delete');
  expect(library.deleteDesign).toHaveBeenCalledWith('rose');
  expect(document.querySelector('.gallery-status')?.textContent).toContain(
    'Quota trouble'
  );
  expect(document.querySelector('.gallery-card')).not.toBeNull();
});

it('revokes thumbnails on refresh and ignores a load completing after close', async () => {
  const gallery = createStudioGallery({ library, locale: 'en' });
  await gallery.open();
  await gallery.refresh();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  let finish: any;
  library.listDesigns.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const loading = gallery.refresh();
  gallery.close();
  finish([design]);
  await loading;
  expect(document.querySelector('.gallery-grid')?.children).toHaveLength(0);
  expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
});

it('shows actionable empty and unavailable storage states without saved claims', async () => {
  library.listDesigns.mockResolvedValue([]);
  const gallery = createStudioGallery({ library, locale: 'en' });
  await gallery.open();
  expect(
    document.querySelector('.gallery-status')?.textContent?.toLowerCase()
  ).toContain('upload');
  library.listDesigns.mockRejectedValue(new Error('Storage unavailable'));
  await gallery.refresh();
  expect(document.querySelector('.gallery-status')?.textContent).toContain(
    'Storage unavailable'
  );
  expect(document.querySelector('.gallery-status')?.textContent).toContain(
    'download'
  );
});

it('allows downloads while busy and keeps their URLs alive until the browser can consume them', async () => {
  vi.useFakeTimers();
  let downloaded: HTMLAnchorElement | undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloaded = this;
  });
  const gallery = createStudioGallery({
    library,
    isBusy: () => true,
    locale: 'en',
  });
  await gallery.open();
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent === 'Download')!
    .click();
  expect(downloaded?.href).toBe('blob:test-2');
  expect(downloaded?.download).toBe('tattoovis-design-rose.png');
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:test-2');
  gallery.close();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  await vi.advanceTimersByTimeAsync(30000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-2');
});

it('does not replace a post-delete storage failure with a success status', async () => {
  const gallery = createStudioGallery({ library, locale: 'en' });
  await gallery.open();
  library.listDesigns.mockRejectedValue(
    new Error('Browser storage disconnected')
  );
  await click('Delete');
  await click('Confirm delete');
  expect(document.querySelector('.gallery-status')?.textContent).toContain(
    'Browser storage disconnected'
  );
});
