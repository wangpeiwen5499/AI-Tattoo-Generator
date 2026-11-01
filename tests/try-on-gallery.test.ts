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
  imageUrl: '/api/studio?asset=rose-image',
};
let library: any;
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
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static createObjectURL = vi.fn(() => 'blob:test-1');
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
    account: true,
    listDesigns: vi.fn(async () => [design]),
    deleteDesign: vi.fn(async () => {}),
  };
});
afterEach(() => {
  delete (HTMLDialogElement.prototype as any).showModal;
  delete (HTMLDialogElement.prototype as any).close;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('is a design picker: titled dialog, plain text metadata, no history tab', async () => {
  const gallery = createStudioGallery({ library, locale: 'en' });
  await gallery.open();
  const dialog = document.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  expect(
    document.getElementById(dialog.getAttribute('aria-labelledby')!)
      ?.textContent
  ).toBe('Choose a design');
  // Full browsing lives on the standalone pages, not inside the editor.
  expect(dialog.querySelector('[role=tab]')).toBeNull();
  const browse = dialog.querySelector('a.gallery-note') as HTMLAnchorElement;
  expect(browse.getAttribute('href')).toBe('/designs');
  expect(browse.textContent).toContain('Browse all designs');
  expect(dialog.textContent).toContain(design.name);
  expect(dialog.querySelector('script')).toBeNull();
  // Account records use authenticated asset URLs, not object URLs.
  expect(dialog.querySelector('img')?.getAttribute('src')).toBe(
    design.imageUrl
  );
  dialog.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  expect(dialog.open).toBe(false);
});

it('closes before handing the chosen design to the editor', async () => {
  const onUseDesign = vi.fn(async (record) => {
    expect(document.querySelector('dialog')!.open).toBe(false);
    expect(record).toBe(design);
  });
  const gallery = createStudioGallery({ library, onUseDesign, locale: 'en' });
  await gallery.open();
  await click('Use design');
  expect(onUseDesign).toHaveBeenCalledOnce();
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
});

it('shows actionable empty and account-unavailable states', async () => {
  library.listDesigns.mockResolvedValue([]);
  const gallery = createStudioGallery({ library, locale: 'en' });
  await gallery.open();
  expect(
    document.querySelector('.gallery-status')?.textContent?.toLowerCase()
  ).toContain('no saved designs');
  library.listDesigns.mockRejectedValue(new Error('Sign in required'));
  await gallery.refresh();
  expect(document.querySelector('.gallery-status')?.textContent).toContain(
    'Sign in required'
  );
  expect(document.querySelector('.gallery-status')?.textContent).toContain(
    'Sign in or retry'
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
  const blobDesign = { ...design, image, imageUrl: undefined };
  library.listDesigns.mockResolvedValue([blobDesign]);
  const gallery = createStudioGallery({
    library,
    isBusy: () => true,
    locale: 'en',
  });
  await gallery.open();
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent === 'Download')!
    .click();
  expect(downloaded?.href).toBe('blob:test-1');
  expect(downloaded?.download).toBe('tattoovis-design-rose.png');
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:test-1');
  gallery.close();
  await vi.advanceTimersByTimeAsync(30000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
});

it('does not replace a post-delete storage failure with a success status', async () => {
  const gallery = createStudioGallery({ library, locale: 'en' });
  await gallery.open();
  library.listDesigns.mockRejectedValue(
    new Error('Account storage disconnected')
  );
  await click('Delete');
  await click('Confirm delete');
  expect(document.querySelector('.gallery-status')?.textContent).toContain(
    'Account storage disconnected'
  );
});
