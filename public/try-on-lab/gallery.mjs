const COPY = {
  en: {
    title: 'My local library',
    close: 'Close library',
    designs: 'Designs',
    history: 'History',
    loading: 'Loading browser library…',
    emptyDesigns:
      'No saved designs yet. Upload or generate a design, then save it to your library.',
    emptyHistory:
      'No saved results yet. Generate a try-on result and save it to history.',
    loadError:
      'Could not load browser storage. Retry, or download your current image to keep a copy.',
    error: 'The action could not be completed. Retry or download your image.',
    busy: 'Wait for the current generation to finish before using or deleting library items.',
    use: 'Use design',
    open: 'Open result',
    reuse: 'Reuse prompt',
    download: 'Download',
    delete: 'Delete',
    confirm: 'Confirm delete',
    deleting: 'Deleting…',
    deleted: 'Deleted. Historical results are kept independently.',
    source: { generated: 'AI generated', upload: 'Uploaded', sample: 'Sample' },
    result: 'Try-on result',
    local:
      'Saved in this browser only. Clearing browser data removes these images.',
  },
  zh: {
    title: '我的本地图案库',
    close: '关闭图案库',
    designs: '图案库',
    history: '试戴历史',
    loading: '正在读取浏览器本地图库…',
    emptyDesigns: '还没有收藏的图案。上传或生成图案后，将它保存到图案库。',
    emptyHistory: '还没有保存的试戴结果。生成试戴效果后，将它保存到历史记录。',
    loadError: '无法读取浏览器存储。请重试，或下载当前图片保留副本。',
    error: '操作未完成，请重试，或先下载图片保留副本。',
    busy: '请等待当前生成完成，再使用或删除图库中的内容。',
    use: '使用图案',
    open: '查看结果',
    reuse: '复用提示词',
    download: '下载',
    delete: '删除',
    confirm: '确认删除',
    deleting: '正在删除…',
    deleted: '已删除。历史试戴结果会独立保留。',
    source: { generated: 'AI 生成', upload: '上传图案', sample: '示例图案' },
    result: '试戴结果',
    local: '仅保存在当前浏览器中，清除浏览器数据会移除这些图片。',
  },
};

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = String(content);
  return node;
}

/** @param {{library: any, onUseDesign?: (record: any) => any, onOpenHistory?: (record: any) => any, onReusePrompt?: (prompt: string) => any, isBusy?: () => boolean, locale?: string}} options */
export function createStudioGallery({
  library,
  onUseDesign,
  onOpenHistory,
  onReusePrompt,
  isBusy = () => false,
  locale = 'zh',
}) {
  const english = locale.startsWith('en');
  const copy = {
    ...COPY[english ? 'en' : 'zh'],
    ...(library.account
      ? {
          title: english ? 'My library' : '我的图库',
          loading: english ? 'Loading account library…' : '正在读取账户图库…',
          local: english
            ? 'Saved to your account. Available across devices.'
            : '保存到账户，可跨设备查看。',
          loadError: english
            ? 'Could not load your account library. Sign in or retry.'
            : '无法读取账户图库，请登录或重试。',
          emptyHistory: english
            ? 'Completed try-ons are saved here automatically.'
            : '成功生成的试戴结果会自动保存在这里。',
        }
      : {}),
  };
  const id = `studio-gallery-${globalThis.crypto.randomUUID()}`;
  const dialog = element('dialog', 'studio-gallery');
  const header = element('div', 'gallery-header');
  const title = element('h2', '', copy.title);
  title.id = `${id}-title`;
  dialog.setAttribute('aria-labelledby', title.id);
  const closeButton = button(copy.close, close);
  header.append(title, closeButton);
  const tabs = element('div', 'gallery-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', copy.title);
  const status = element('p', 'gallery-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const grid = element('div', 'gallery-grid');
  grid.id = `${id}-panel`;
  grid.setAttribute('role', 'tabpanel');
  const note = element('p', 'gallery-note', copy.local);
  let activeTab = 'designs';
  let generation = 0;
  let visible = false;
  const thumbnailURLs = new Set();
  const tabButtons = ['designs', 'history'].map((tab, index) => {
    const node = button(copy[tab], () => open(tab));
    node.id = `${id}-${tab}`;
    node.setAttribute('role', 'tab');
    node.setAttribute('aria-controls', grid.id);
    node.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
        return;
      event.preventDefault();
      const next =
        event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
      tabButtons[next].focus();
      open(next === 0 ? 'designs' : 'history');
    });
    tabs.append(node);
    return node;
  });
  dialog.append(header, tabs, note, status, grid);
  if (library.account) {
    const archive = element(
      'a',
      'gallery-note',
      english ? 'Previous generation history' : '以往生成记录'
    );
    archive.href = `${english ? '' : '/zh'}/history/archive`;
    dialog.append(archive);
  }
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
      anchor.download = `tattoovis-${activeTab === 'designs' ? 'design' : 'result'}-${String(
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

  function card(record, tab) {
    const node = element('article', 'gallery-card');
    const thumbnail = element('img', 'gallery-thumbnail');
    const url = record.imageUrl || URL.createObjectURL(record.image);
    if (!record.imageUrl) thumbnailURLs.add(url);
    thumbnail.src = url;
    thumbnail.alt = tab === 'designs' ? record.name : copy.result;
    thumbnail.loading = 'lazy';
    const name = element(
      'h3',
      '',
      tab === 'designs' ? record.name : `${copy.result} · ${record.resolution}`
    );
    const date = new Date(record.createdAt).toLocaleString(
      locale.startsWith('en') ? 'en-US' : 'zh-CN'
    );
    const meta = element(
      'p',
      'gallery-meta',
      `${tab === 'designs' ? copy.source[record.source] || '' : record.resolution} · ${date}`
    );
    node.append(thumbnail, name, meta);
    if (record.prompt)
      node.append(element('p', 'gallery-prompt', record.prompt));
    const actions = element('div', 'gallery-actions');
    const callback = tab === 'designs' ? onUseDesign : onOpenHistory;
    if (callback)
      actions.append(
        button(
          tab === 'designs' ? copy.use : copy.open,
          () => use(callback, record),
          true
        )
      );
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
        await (tab === 'designs'
          ? library.deleteDesign(record.id)
          : library.deleteHistory(record.id));
        if (visible && activeTab === tab && (await refresh()))
          status.textContent = copy.deleted;
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
    const tab = activeTab;
    releaseThumbnails();
    status.textContent = copy.loading;
    grid.setAttribute('aria-busy', 'true');
    try {
      const records = await (tab === 'designs'
        ? library.listDesigns()
        : library.listHistory());
      if (!visible || generation !== request) return;
      for (const record of records) grid.append(card(record, tab));
      status.textContent = records.length
        ? ''
        : tab === 'designs'
          ? copy.emptyDesigns
          : copy.emptyHistory;
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

  async function open(tab = 'designs') {
    activeTab = tab === 'history' ? 'history' : 'designs';
    for (let i = 0; i < tabButtons.length; i++) {
      const selected = (i === 0 ? 'designs' : 'history') === activeTab;
      tabButtons[i].setAttribute('aria-selected', String(selected));
      tabButtons[i].tabIndex = selected ? 0 : -1;
    }
    grid.setAttribute('aria-labelledby', `${id}-${activeTab}`);
    show();
    await refresh();
  }

  return { open, refresh, close };
}
