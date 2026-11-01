/** In-editor design picker. Full browsing lives on the /designs and
 * /history pages; this dialog only chooses a design to place. */
const COPY = {
  en: {
    title: 'Choose a design',
    close: 'Close',
    loading: 'Loading your designs…',
    emptyDesigns:
      'No saved designs yet. Upload or generate a design, then save it to your library.',
    loadError: 'Could not load your account library. Sign in or retry.',
    error: 'The action could not be completed. Retry or download your image.',
    busy: 'Wait for the current generation to finish before using or deleting library items.',
    use: 'Use design',
    reuse: 'Reuse prompt',
    download: 'Download',
    delete: 'Delete',
    confirm: 'Confirm delete',
    deleting: 'Deleting…',
    deleted: 'Deleted. Historical results are kept independently.',
    source: { generated: 'AI generated', upload: 'Uploaded', sample: 'Sample' },
    local: 'Saved to your account. Available across devices.',
  },
  zh: {
    title: '选择图案',
    close: '关闭',
    loading: '正在读取账户图案…',
    emptyDesigns: '还没有收藏的图案。上传或生成图案后，它会保存到你的账户图库。',
    loadError: '无法读取账户图库，请登录或重试。',
    error: '操作未完成，请重试，或先下载图片保留副本。',
    busy: '请等待当前生成完成，再使用或删除图库中的内容。',
    use: '使用图案',
    reuse: '复用提示词',
    download: '下载',
    delete: '删除',
    confirm: '确认删除',
    deleting: '正在删除…',
    deleted: '已删除。历史试戴结果会独立保留。',
    source: { generated: 'AI 生成', upload: '上传图案', sample: '示例图案' },
    local: '保存到账户，可跨设备查看。',
  },
};

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = String(content);
  return node;
}

/** @param {{library: any, onUseDesign?: (record: any) => any, onReusePrompt?: (prompt: string) => any, isBusy?: () => boolean, locale?: string}} options */
export function createStudioGallery({
  library,
  onUseDesign,
  onReusePrompt,
  isBusy = () => false,
  locale = 'zh',
}) {
  const english = locale.startsWith('en');
  const copy = COPY[english ? 'en' : 'zh'];
  const id = `studio-gallery-${globalThis.crypto.randomUUID()}`;
  const dialog = element('dialog', 'studio-gallery');
  const header = element('div', 'gallery-header');
  const title = element('h2', '', copy.title);
  title.id = `${id}-title`;
  dialog.setAttribute('aria-labelledby', title.id);
  const closeButton = button(copy.close, close);
  header.append(title, closeButton);
  const status = element('p', 'gallery-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const grid = element('div', 'gallery-grid');
  grid.id = `${id}-panel`;
  const note = element('p', 'gallery-note', copy.local);
  const browse = element(
    'a',
    'gallery-note',
    english ? 'Browse all designs and history' : '浏览全部图案与试戴历史'
  );
  browse.href = `${english ? '' : '/zh'}/designs`;
  let generation = 0;
  let visible = false;
  const thumbnailURLs = new Set();
  dialog.append(header, note, browse, status, grid);
  document.body.append(dialog);
  dialog.addEventListener('close', cleanup);
  dialog.addEventListener('cancel', () => {
    cleanup();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  function button(label, action, primary = false) {
    const node = element(
      'button',
      `button ${primary ? 'primary' : 'secondary'}`,
      label
    );
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function releaseThumbnails() {
    for (const url of thumbnailURLs) URL.revokeObjectURL(url);
    thumbnailURLs.clear();
    grid.replaceChildren();
  }

  function cleanup() {
    visible = false;
    generation++;
    releaseThumbnails();
  }

  function close() {
    cleanup();
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }

  function show() {
    visible = true;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
  }

  function error(message, reason) {
    const detail = reason instanceof Error ? reason.message : '';
    status.textContent = detail ? `${message} ${detail}` : message;
  }

  function guard() {
    if (!isBusy()) return true;
    status.textContent = copy.busy;
    return false;
  }

  async function use(callback, value) {
    if (!guard() || !callback) return;
    close();
    try {
      await callback(
        library.loadRecord && typeof value === 'object'
          ? await library.loadRecord(value)
          : value
      );
    } catch (reason) {
      show();
      error(copy.error, reason);
    }
  }

  async function download(record) {
    try {
      if (library.loadRecord) record = await library.loadRecord(record);
      const url = URL.createObjectURL(record.image);
      const anchor = element('a');
      anchor.href = url;
      const extension =
        record.image.type === 'image/jpeg'
          ? 'jpg'
          : record.image.type === 'image/webp'
            ? 'webp'
            : 'png';
      anchor.download = `tattoovis-design-${String(
        record.id
      )
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 80)}.${extension}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Downloads may consume the object URL after the click event completes.
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (reason) {
      error(copy.error, reason);
    }
  }

  function card(record) {
    const node = element('article', 'gallery-card');
    const thumbnail = element('img', 'gallery-thumbnail');
    const url = record.imageUrl || URL.createObjectURL(record.image);
    if (!record.imageUrl) thumbnailURLs.add(url);
    thumbnail.src = url;
    thumbnail.alt = record.name;
    thumbnail.loading = 'lazy';
    const name = element('h3', '', record.name);
    const date = new Date(record.createdAt).toLocaleString(
      locale.startsWith('en') ? 'en-US' : 'zh-CN'
    );
    const meta = element(
      'p',
      'gallery-meta',
      `${copy.source[record.source] || ''} · ${date}`
    );
    node.append(thumbnail, name, meta);
    if (record.prompt)
      node.append(element('p', 'gallery-prompt', record.prompt));
    const actions = element('div', 'gallery-actions');
    if (onUseDesign)
      actions.append(button(copy.use, () => use(onUseDesign, record), true));
    if (record.prompt && onReusePrompt)
      actions.append(
        button(copy.reuse, () => use(onReusePrompt, record.prompt))
      );
    actions.append(button(copy.download, () => download(record)));
    let confirmed = false;
    let deleting = false;
    const remove = button(copy.delete, async () => {
      if (!guard() || deleting) return;
      if (!confirmed) {
        confirmed = true;
        remove.textContent = copy.confirm;
        return;
      }
      deleting = true;
      remove.disabled = true;
      remove.textContent = copy.deleting;
      try {
        await library.deleteDesign(record.id);
        if (visible && (await refresh())) status.textContent = copy.deleted;
      } catch (reason) {
        if (visible) error(copy.error, reason);
      } finally {
        deleting = false;
        confirmed = false;
        remove.disabled = false;
        remove.textContent = copy.delete;
      }
    });
    actions.append(remove);
    node.append(actions);
    return node;
  }

  async function refresh() {
    if (!visible) return;
    const request = ++generation;
    releaseThumbnails();
    status.textContent = copy.loading;
    grid.setAttribute('aria-busy', 'true');
    try {
      const records = await library.listDesigns();
      if (!visible || generation !== request) return;
      for (const record of records) grid.append(card(record));
      status.textContent = records.length ? '' : copy.emptyDesigns;
      return true;
    } catch (reason) {
      if (!visible || generation !== request) return;
      releaseThumbnails();
      error(copy.loadError, reason);
      return false;
    } finally {
      if (generation === request) grid.removeAttribute('aria-busy');
    }
  }

  async function open() {
    show();
    await refresh();
  }

  return { open, refresh, close };
}
