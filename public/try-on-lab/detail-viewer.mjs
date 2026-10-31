/** Read-only viewer: comparison never changes placement or calls the provider. */
export function createDetailViewer(getSources) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('detail-dialog'),
    viewport = $('detail-viewport'),
    image = $('detail-image');
  let sources = {},
    selected = 'raw',
    zoom = 1,
    baseWidth = 1,
    baseHeight = 1;
  let previousOverflow = '';
  const points = new Map();
  let gesture = null;
  let maxZoom = 5;
  function sourceSize(source) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }
  function centering(atZoom) {
    const source = sources[selected];
    const height =
      baseWidth *
      atZoom *
      (source ? source.height / source.width : baseHeight / baseWidth);
    return {
      x: Math.max(0, (viewport.clientWidth - baseWidth * atZoom) / 2),
      y: Math.max(0, (viewport.clientHeight - height) / 2),
    };
  }
  function size() {
    image.style.width = `${baseWidth * zoom}px`;
    const source = sources[selected];
    image.style.height = `${baseWidth * zoom * (source ? source.height / source.width : baseHeight / baseWidth)}px`;
    $('detail-zoom').value = String(Math.round(zoom * 100));
    $('detail-zoom-value').textContent = `${Math.round(zoom * 100)}%`;
  }
  function setZoom(
    value,
    x = viewport.clientWidth / 2,
    y = viewport.clientHeight / 2
  ) {
    const old = zoom;
    const before = centering(old);
    const left = (viewport.scrollLeft + x - before.x) / old,
      top = (viewport.scrollTop + y - before.y) / old;
    zoom = Math.max(1, Math.min(maxZoom, value));
    size();
    const after = centering(zoom);
    viewport.scrollLeft = left * zoom - x + after.x;
    viewport.scrollTop = top * zoom - y + after.y;
  }
  function select(view) {
    if (!sources[view]) return;
    selected = view;
    image.src = sources[view].url;
    image.alt = { original: '原图', draft: '手动叠放纹身', raw: 'AI 生成结果' }[
      view
    ];
    $('detail-download').textContent =
      `↓ 下载${{ original: '原图', draft: '手动叠放', raw: 'AI 结果' }[view]}`;
    size();
    for (const button of document.querySelectorAll('[data-detail-view]'))
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.detailView === selected)
      );
  }
  for (const button of document.querySelectorAll('[data-detail-view]'))
    button.onclick = () => select(button.dataset.detailView);
  $('detail-close').onclick = () => dialog.close();
  $('detail-download').onclick = () => {
    const link = document.createElement('a');
    link.href = sources[selected].url;
    link.download = `tattoovis-${selected}.png`;
    link.click();
  };
  $('detail-zoom').addEventListener('input', () =>
    setZoom(Number($('detail-zoom').value) / 100)
  );
  $('detail-fit').onclick = () => {
    setZoom(1);
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  };
  $('detail-native').onclick = () =>
    setZoom(sources[selected].width / baseWidth);
  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      setZoom(
        zoom * Math.exp(-event.deltaY * 0.002),
        event.clientX - bounds.left,
        event.clientY - bounds.top
      );
    },
    { passive: false }
  );
  function begin() {
    const p = [...points.values()];
    gesture = {
      points: p,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
      zoom,
    };
  }
  viewport.onpointerdown = (event) => {
    if (points.size >= 2) return;
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    begin();
  };
  viewport.onpointermove = (event) => {
    if (!gesture || !points.has(event.pointerId)) return;
    event.preventDefault();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = [...points.values()],
      start = gesture.points;
    if (current.length === 2 && start.length === 2) {
      const distance = (p) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      const ratio = distance(current) / Math.max(1, distance(start));
      const bounds = viewport.getBoundingClientRect();
      const sx = (start[0].x + start[1].x) / 2 - bounds.left;
      const sy = (start[0].y + start[1].y) / 2 - bounds.top;
      const before = centering(gesture.zoom);
      zoom = Math.max(1, Math.min(maxZoom, gesture.zoom * ratio));
      size();
      const after = centering(zoom);
      viewport.scrollLeft =
        ((gesture.left + sx - before.x) * zoom) / gesture.zoom -
        ((current[0].x + current[1].x) / 2 - bounds.left) +
        after.x;
      viewport.scrollTop =
        ((gesture.top + sy - before.y) * zoom) / gesture.zoom -
        ((current[0].y + current[1].y) / 2 - bounds.top) +
        after.y;
    } else {
      viewport.scrollLeft = gesture.left - current[0].x + start[0].x;
      viewport.scrollTop = gesture.top - current[0].y + start[0].y;
    }
  };
  function end(event) {
    points.delete(event.pointerId);
    if (points.size) begin();
    else gesture = null;
  }
  viewport.onpointerup = end;
  viewport.onlostpointercapture = (event) => {
    if (points.has(event.pointerId)) end(event);
  };
  viewport.onpointercancel = () => {
    points.clear();
    gesture = null;
  };
  dialog.addEventListener('close', () => {
    points.clear();
    gesture = null;
    document.body.style.overflow = previousOverflow;
    image.removeAttribute('src');
    sources = {};
  });
  return {
    open(view = 'raw') {
      if (dialog.open) return;
      const input = getSources();
      if (!input.raw) return;
      for (const [key, source] of Object.entries(input)) {
        if (!source) continue;
        let raster = source;
        if (!(source instanceof HTMLCanvasElement)) {
          raster = document.createElement('canvas');
          const dimensions = sourceSize(source);
          raster.width = dimensions.width;
          raster.height = dimensions.height;
          raster.getContext('2d').drawImage(source, 0, 0);
        }
        const url = raster.toDataURL('image/png');
        sources[key] = { url, ...sourceSize(source) };
      }
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const original = sources.original || sources.raw;
      // Portrait photos deserve a focused viewer, not a full-width empty stage.
      const availableHeight = Math.max(240, window.innerHeight * 0.92 - 210);
      dialog.style.width = `${Math.min(window.innerWidth * 0.96, Math.max(740, (availableHeight * original.width) / original.height + 48))}px`;
      dialog.showModal();
      for (const button of document.querySelectorAll('[data-detail-view]'))
        button.disabled = !sources[button.dataset.detailView];
      const tallestAspect = Math.max(
        ...Object.values(sources).map((source) => source.height / source.width)
      );
      const ratio = Math.min(
        (viewport.clientWidth || 800) / original.width,
        (viewport.clientHeight || 600) / (original.width * tallestAspect),
        1
      );
      baseWidth = original.width * ratio;
      baseHeight = original.height * ratio;
      maxZoom = Math.max(
        5,
        ...Object.values(sources).map((source) => source.width / baseWidth)
      );
      $('detail-zoom').max = String(Math.ceil(maxZoom * 100));
      zoom = 1;
      size();
      select(sources[view] ? view : 'raw');
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
      const mismatch =
        Math.abs(
          sources.raw.width / sources.raw.height -
            original.width / original.height
        ) > 0.035;
      $('detail-hint').textContent = mismatch
        ? 'AI 结果改变了画面比例，已完整显示且未拉伸；与原图无法严格逐点对齐。'
        : '拖动查看局部，滚轮或双指缩放；切换图片会保留缩放和查看位置。';
    },
  };
}
