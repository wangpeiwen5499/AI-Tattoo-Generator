import { createDetailViewer } from './detail-viewer.mjs';
import {
  hitPlacement,
  placementGeometry,
  placementRegion,
  pointInPhoto,
  transformGesture,
} from './geometry.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('stage'),
  ctx = canvas.getContext('2d');
const api = '/api/preview/try-on';
const editorSession = crypto.randomUUID();
const state = {
  photo: null,
  design: null,
  designSource: null,
  raw: null,
  composite: null,
  region: null,
  flipped: false,
  view: 'draft',
  width: 1200,
  height: 900,
  scale: 1,
  rotation: 0,
  opacity: 0.85,
  px: 0.5,
  py: 0.5,
  busy: false,
  activity: null,
  configured: false,
  checking: false,
  photoAsset: null,
  designAsset: null,
  gesture: null,
  polling: false,
  revision: 0,
  resultMatches: false,
};
const editingContext = () => `${editorSession}:${state.revision}`;

function status(message, error = false) {
  $('status').textContent = message;
  $('status').dataset.error = String(error);
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('图片无法读取，请换一张 PNG、JPG 或 WebP。'));
    image.src = url;
  });
}
function constrain(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function update() {
  for (const id of [
    'photo',
    'design',
    'sample-photo',
    'sample-design',
    'access-token',
    'consent',
    'prompt',
    'upload-photo',
    'choose-photo',
    'choose-design',
  ])
    $(id).disabled = state.busy;
  const placed = !!(state.photo && state.design);
  for (const id of ['flip-design', 'remove-design'])
    $(id).disabled = !placed || state.busy;
  $('flip-design').setAttribute('aria-checked', String(state.flipped));
  $('inspect-result').hidden = !state.raw;
  $('inspect-result').disabled = state.busy;
  $('fit-design').disabled = !placed || state.busy;
  const access =
    state.configured &&
    $('access-token').value.length >= 24 &&
    $('consent').checked;
  $('generate-design').disabled =
    !access || state.busy || $('prompt').value.trim().length < 3;
  $('render').disabled = !placed || !access || state.busy;
  $('render').textContent =
    state.busy && state.activity === 'render'
      ? '正在生成真实效果…'
      : '生成真实试戴效果';
  $('generate-design').textContent =
    state.busy && state.activity === 'design' ? '正在创作图案…' : '生成新图案';
  document
    .querySelector('.photo-workspace')
    .setAttribute('aria-busy', String(state.busy));
  const missing = [];
  if (!state.photo) missing.push('上传部位照片');
  if (!state.design) missing.push('选择纹身图案');
  if (!state.configured) missing.push('完成 Preview 测试服务配置');
  if ($('access-token').value.length < 24)
    missing.push('在本页输入至少 24 个字符的测试访问口令');
  if (!$('consent').checked) missing.push('勾选同意调用 KIE');
  $('render-requirements').textContent = state.busy
    ? '正在处理测试任务，请勿重复提交。'
    : missing.length
      ? `还需完成：${missing.join('；')}。`
      : '已准备好。点击后将调用一次 KIE 单张试戴生成，不扣网站积分。';
  $('check-configuration').disabled = state.busy || state.checking;

  $('download').hidden = !(state.photo || state.raw);
  $('download').disabled = state.busy;
  $('download').textContent =
    `↓ 下载${{ draft: '手动预览', original: '原图', raw: 'AI 结果', composite: '融合结果' }[state.view]}`;
  const step = !state.photo ? 1 : !state.design ? 2 : 3;
  for (const item of document.querySelectorAll('[data-step]')) {
    const current =
      Number(item.dataset.step) ===
      (state.raw || (state.busy && state.activity !== 'design')
        ? 4
        : state.busy
          ? 2
          : step);
    if (current) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
    item.dataset.done = String(
      Number(item.dataset.step) < (state.raw ? 5 : step)
    );
  }
  const guidance = state.busy
    ? state.activity === 'design'
      ? [
          '正在创作你的纹身图案',
          '无需重复提交。图案准备好后，就可以在照片上拖动摆放。',
        ]
      : [
          '正在生成真实效果',
          '无需再次点击。结果返回后可对比原图、手动叠放和 AI 效果。',
        ]
    : state.raw
      ? [
          '生成完成，放大对比一下',
          '点击「三图对比」检查位置和皮肤细节，确认满意后下载 AI 结果。返回编辑并调整摆放将清除本次对比，请先保存。',
        ]
      : step === 1
        ? [
            '先上传一张部位照片',
            '让想纹身的位置清晰可见，局部和侧面照片都可以。也可先用示例体验。',
          ]
        : step === 2
          ? [
              '接下来，选一个纹身图案',
              '上传已有图案，或点击狼头示例。想要新的设计？填写主题、风格和构图后生成。',
            ]
          : [
              '在照片上摆放到你想纹的位置',
              '拖动图案移动；右下角缩放，上方旋转；点击「深浅」调节浓淡。手机可双指缩放旋转。满意后点击「生成真实试戴效果」。',
            ];
  $('workflow-title').textContent = guidance[0];
  $('workflow-description').textContent = guidance[1];
  if (!placed || state.busy || state.view !== 'draft') closeInk(false);
  $('ink-opacity').value = String(Math.round(state.opacity * 100));
  $('ink-value').textContent = `${Math.round(state.opacity * 100)}%`;
  $('authorization-summary').querySelector('span').textContent = access
    ? '已准备好'
    : '展开完成授权';
  $('empty').hidden = !!(state.photo || state.raw);
  canvas.dataset.placement = JSON.stringify({
    px: state.px,
    py: state.py,
    scale: state.scale,
    rotation: state.rotation,
    opacity: state.opacity,
    flipped: state.flipped,
  });
  $('placement-status').textContent = placed
    ? `大小 ${Math.round(state.scale * 100)}% · 旋转 ${Math.round(state.rotation)}° · 深浅 ${Math.round(state.opacity * 100)}%`
    : '';
  if (!placed || state.busy || state.view !== 'draft') closeTattooMenu(false);
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.view === state.view)
    );
    if (['raw', 'composite'].includes(button.dataset.view))
      button.hidden = !state[button.dataset.view];
  }
  $('view-caption').textContent =
    state.view === 'raw'
      ? 'KIE 返回的原始图片'
      : state.view === 'composite'
        ? 'AI 结果在纹身附近局部融合，其他位置保留原图'
        : state.view === 'original'
          ? '你上传的照片（不显示纹身）'
          : '本地叠图，尚未进行 AI 渲染';
  canvas.className = state.view === 'draft' && state.design ? 'moving' : '';
  const dimensions = viewDimensions();
  canvas.style.maxWidth = `${((innerWidth < 760 ? 560 : 760) * dimensions.width) / dimensions.height}px`;
}
function geometry() {
  return placementGeometry(
    state,
    state.design.width / state.design.height,
    state.width,
    state.height
  );
}
function draft(context) {
  if (!state.design || !state.photo) return;
  const g = geometry();
  context.save();
  context.translate(g.cx, g.cy);
  context.rotate((g.rotation * Math.PI) / 180);
  if (state.flipped) context.scale(-1, 1);
  context.globalAlpha = state.opacity;
  context.globalCompositeOperation = 'multiply';
  context.drawImage(
    state.design,
    -g.width / 2,
    -g.height / 2,
    g.width,
    g.height
  );
  context.restore();
}
function handles() {
  if (!state.design) return;
  const g = geometry();
  const unit = state.width / Math.max(canvas.getBoundingClientRect().width, 1);
  const angle = (g.rotation * Math.PI) / 180;
  const project = (x, y) => ({
    x: g.cx + x * Math.cos(angle) - y * Math.sin(angle),
    y: g.cy + x * Math.sin(angle) + y * Math.cos(angle),
  });
  return {
    g,
    unit,
    resize: project(g.width / 2 + 14 * unit, g.height / 2 + 14 * unit),
    opacity: project(-g.width / 2 - 30 * unit, -g.height / 2),
    rotate: project(0, -g.height / 2 - 30 * unit),
  };
}
function drawHandles() {
  const h = handles();
  if (!h) return;
  ctx.save();
  ctx.translate(h.g.cx, h.g.cy);
  ctx.rotate((h.g.rotation * Math.PI) / 180);
  ctx.strokeStyle = '#7160ed';
  ctx.lineWidth = 2 * h.unit;
  ctx.strokeRect(-h.g.width / 2, -h.g.height / 2, h.g.width, h.g.height);
  ctx.beginPath();
  ctx.moveTo(0, -h.g.height / 2);
  ctx.lineTo(0, -h.g.height / 2 - 30 * h.unit);
  ctx.stroke();
  ctx.restore();
  for (const [point, label] of [
    [h.resize, '↔'],
    [h.rotate, '↻'],
    [h.opacity, '◐'],
  ]) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 8 * h.unit, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#7160ed';
    ctx.lineWidth = 2 * h.unit;
    ctx.stroke();
    ctx.fillStyle = '#6355df';
    ctx.font = `${12 * h.unit}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, point.x, point.y);
  }
  ctx.fillStyle = '#6355df';
  ctx.font = `${11 * h.unit}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('深浅', h.opacity.x - 12 * h.unit, h.opacity.y);
}
function invalidateResult() {
  closeTattooMenu(false);
  state.revision += 1;
  state.resultMatches = false;
  state.raw = null;
  state.composite = null;
  state.region = null;
  $('result-info').hidden = true;
  state.view = 'draft';
}
function edited() {
  state.scale = constrain(state.scale, 0.2, 3);
  state.rotation = ((((state.rotation + 180) % 360) + 360) % 360) - 180;
  state.px = constrain(state.px, 0, 1);
  state.py = constrain(state.py, 0, 1);
  invalidateResult();
  draw();
}
function makeCanvas(width = state.width, height = state.height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}
function referenceCanvas() {
  const image = makeCanvas();
  const context = image.getContext('2d');
  context.drawImage(state.photo, 0, 0, state.width, state.height);
  draft(context);
  return image;
}
function viewDimensions() {
  return state.view === 'raw' && state.raw
    ? { width: state.raw.naturalWidth, height: state.raw.naturalHeight }
    : { width: state.width, height: state.height };
}
function draw() {
  const dimensions = viewDimensions();
  if (
    canvas.width !== dimensions.width ||
    canvas.height !== dimensions.height
  ) {
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const image =
    state.view === 'raw'
      ? state.raw
      : state.view === 'composite'
        ? state.composite
        : state.photo;
  if (image) ctx.drawImage(image, 0, 0, dimensions.width, dimensions.height);
  if (state.view === 'draft' && state.photo) {
    draft(ctx);
    drawHandles();
  }
  update();
}
function setView(view) {
  if (['draft', 'original'].includes(view) && !state.photo) return;
  if (['raw', 'composite'].includes(view) && !state[view]) return;
  state.view = view;
  draw();
}
function fitDesign() {
  state.scale = 1;
  state.rotation = 0;
  state.px = 0.5;
  state.py = 0.5;
  state.flipped = false;
  invalidateResult();
  state.view = 'draft';
  draw();
}
async function setPhoto(image, sample = false) {
  invalidateResult();
  const working = makeCanvas();
  let sw = image.naturalWidth || image.width,
    sh = image.naturalHeight || image.height,
    sx = 0,
    sy = 0;
  if (sample) {
    sx = sw * 0.24;
    sy = sh * 0.17;
    sw *= 0.25;
    sh *= 0.38;
  }
  const ratio = Math.min(1, 1800 / Math.max(sw, sh));
  working.width = Math.round(sw * ratio);
  working.height = Math.round(sh * ratio);
  working
    .getContext('2d')
    .drawImage(image, sx, sy, sw, sh, 0, 0, working.width, working.height);
  state.photo = working;
  state.width = working.width;
  state.height = working.height;
  state.region = null;
  state.raw = null;
  state.composite = null;
  state.photoAsset = null;
  state.scale = 1;
  state.rotation = 0;
  state.px = 0.5;
  state.py = 0.5;
  state.flipped = false;
  pointers.clear();
  state.gesture = null;
  state.view = 'draft';
  $('result-info').hidden = true;
  $('photo-hint').textContent =
    '拖动图案移动 · 右下角缩放 · 上方旋转 · 点击或上下拖动「深浅」调浓淡。长按 / 右键可翻转、重置和移除。';
  status('照片已准备好。选择纹身图案，即可直接在原图上调整。');
  draw();
}
async function setDesign(image, name, asset = null) {
  const working = makeCanvas(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height
  );
  const context = working.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, working.width, working.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const brightness = Math.min(
      pixels.data[i],
      pixels.data[i + 1],
      pixels.data[i + 2]
    );
    if (brightness > 180) pixels.data[i + 3] *= (255 - brightness) / 75;
  }
  context.putImageData(pixels, 0, 0);
  state.design = working;
  state.designSource = image;
  state.designAsset = asset;
  $('design-thumb').src = working.toDataURL();
  $('design-thumb').hidden = false;
  $('design-name').textContent = name;
  state.raw = null;
  state.composite = null;
  fitDesign();
}
async function fileImage(file) {
  if (
    !file ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('请选择 10MB 以内的 PNG、JPG 或 WebP 图片。');
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
for (const [button, input] of [
  ['upload-photo', 'photo'],
  ['choose-photo', 'photo'],
  ['choose-design', 'design'],
])
  $(button).onclick = () => {
    if (!state.busy) $(input).click();
  };
$('photo').addEventListener('change', async (event) => {
  if (!event.target.files?.length) return;
  try {
    if (state.busy) return;
    const image = await fileImage(event.target.files[0]);
    if (state.busy) return;
    await setPhoto(image);
  } catch (error) {
    status(error.message, true);
  }
  event.target.value = '';
});
$('design').addEventListener('change', async (event) => {
  if (!event.target.files?.length) return;
  try {
    if (state.busy) return;
    const image = await fileImage(event.target.files[0]);
    if (state.busy) return;
    await setDesign(image, '上传的纹身设计');
  } catch (error) {
    status(error.message, true);
  }
  event.target.value = '';
});
$('sample-photo').onclick = async () => {
  if (state.busy) return;
  try {
    const image = await loadImage('/imgs/cases/geometric-wolf/before.webp');
    if (!state.busy) await setPhoto(image, true);
  } catch (error) {
    status(error.message, true);
  }
};
$('sample-design').onclick = async () => {
  if (state.busy) return;
  try {
    const image = await loadImage('/imgs/cases/geometric-wolf/design.webp');
    if (!state.busy) await setDesign(image, '几何狼头示例');
  } catch (error) {
    status(error.message, true);
  }
};
$('fit-design').onclick = () => {
  if (!state.busy) {
    fitDesign();
    canvas.focus({ preventScroll: true });
  }
};
$('flip-design').onclick = () => {
  if (state.busy) return;
  state.flipped = !state.flipped;
  edited();
  canvas.focus({ preventScroll: true });
};
$('remove-design').onclick = () => {
  if (state.busy) return;
  state.design = null;
  state.designSource = null;
  state.designAsset = null;
  pointers.clear();
  state.gesture = null;
  $('design-thumb').hidden = true;
  $('design-thumb').removeAttribute('src');
  $('design-name').textContent = '还没有选择图案';
  invalidateResult();
  draw();
  canvas.focus({ preventScroll: true });
};
for (const button of document.querySelectorAll('[data-view]'))
  button.onclick = () => {
    if (!state.busy) setView(button.dataset.view);
  };
let longPressTimer = null;
function closeInk(focus = true) {
  if ($('ink-popover').hidden) return;
  $('ink-popover').hidden = true;
  if (focus) canvas.focus({ preventScroll: true });
}
function openInk(clientX, clientY) {
  if (state.busy || !state.design || state.view !== 'draft') return;
  closeTattooMenu(false);
  const shell = $('canvas-shell').getBoundingClientRect();
  const popover = $('ink-popover');
  popover.style.left = `${Math.max(8, Math.min(clientX - shell.left, shell.width - 232))}px`;
  popover.style.top = `${Math.max(8, Math.min(clientY - shell.top + 20, shell.height - 146))}px`;
  popover.hidden = false;
  $('ink-opacity').focus({ preventScroll: true });
}
$('ink-close').onclick = () => closeInk();
$('ink-popover').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeInk();
  }
});
$('ink-opacity').addEventListener('input', () => {
  if (state.busy || !state.design || state.view !== 'draft') return;
  state.opacity = constrain(Number($('ink-opacity').value) / 100, 0.2, 1);
  edited();
});
function cancelLongPress() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}
function closeTattooMenu(focus = true) {
  const menu = $('tattoo-menu');
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  if (focus) canvas.focus({ preventScroll: true });
}
function openTattooMenu(clientX, clientY) {
  if (state.busy || !state.design || !state.photo || state.view !== 'draft')
    return;
  cancelLongPress();
  closeInk(false);
  const menu = $('tattoo-menu'),
    shell = $('canvas-shell').getBoundingClientRect();
  menu.hidden = false;
  menu.style.left = `${Math.max(8, Math.min(clientX - shell.left, shell.width - 206))}px`;
  menu.style.top = `${Math.max(8, Math.min(clientY - shell.top, shell.height - 150))}px`;
  menu.querySelector('button').focus({ preventScroll: true });
}
canvas.oncontextmenu = (event) => {
  if (state.busy || !state.design || !state.photo || state.view !== 'draft')
    return;
  if (!hitPlacement(photoPoint(event), geometry(), state.width, state.height))
    return;
  event.preventDefault();
  state.gesture = null;
  pointers.clear();
  openTattooMenu(event.clientX, event.clientY);
};
$('tattoo-menu').addEventListener('keydown', (event) => {
  const items = [...$('tattoo-menu').querySelectorAll('button')];
  const index = items.indexOf(document.activeElement);
  if (event.key === 'Escape') {
    event.preventDefault();
    closeTattooMenu();
    return;
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
            items.length;
    items[next].focus();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!$('tattoo-menu').contains(event.target)) closeTattooMenu(false);
  if (!$('ink-popover').contains(event.target)) closeInk(false);
});
const pointers = new Map();
function photoPoint(event) {
  const b = canvas.getBoundingClientRect();
  return pointInPhoto(
    { x: event.clientX, y: event.clientY },
    { x: b.left, y: b.top, width: b.width, height: b.height }
  );
}
function beginGesture(mode = 'move') {
  const points = [...pointers.values()];
  state.gesture = {
    mode: points.length >= 2 ? 'pinch' : mode,
    points: points.slice(0, 2),
    placement: {
      px: state.px,
      py: state.py,
      scale: state.scale,
      rotation: state.rotation,
      opacity: state.opacity,
    },
  };
}
canvas.onpointerdown = (event) => {
  if (
    !state.photo ||
    !state.design ||
    state.busy ||
    state.view !== 'draft' ||
    pointers.size >= 2
  )
    return;
  const point = photoPoint(event),
    h = handles();
  const near = (p) =>
    Math.hypot(point.x * state.width - p.x, point.y * state.height - p.y) <=
    22 * h.unit;
  const centerDistance = Math.hypot(
    point.x * state.width - h.g.cx,
    point.y * state.height - h.g.cy
  );
  const central =
    centerDistance <=
    Math.min(12 * h.unit, h.g.width * 0.35, h.g.height * 0.35);
  const mode = central
    ? 'move'
    : near(h.rotate)
      ? 'rotate'
      : near(h.resize)
        ? 'resize'
        : near(h.opacity) ||
            (Math.abs(point.y * state.height - h.opacity.y) <= 18 * h.unit &&
              point.x * state.width >= h.opacity.x - 55 * h.unit &&
              point.x * state.width <= h.opacity.x)
          ? 'opacity'
          : 'move';
  if (
    !pointers.size &&
    mode === 'move' &&
    !hitPlacement(point, h.g, state.width, state.height)
  )
    return;
  event.preventDefault();
  closeInk(false);
  closeTattooMenu(false);
  cancelLongPress();
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, point);
  beginGesture(mode);
  if (event.pointerType === 'touch' && pointers.size === 1 && mode === 'move') {
    const clientX = event.clientX,
      clientY = event.clientY;
    longPressTimer = setTimeout(() => {
      state.gesture = null;
      pointers.clear();
      openTattooMenu(clientX, clientY);
    }, 550);
  }
};
canvas.onpointermove = (event) => {
  if (!state.gesture || !pointers.has(event.pointerId) || state.busy) return;
  event.preventDefault();
  const point = photoPoint(event);
  const pressStart = state.gesture.points[0];
  if (
    pointers.size > 1 ||
    Math.hypot(
      (point.x - pressStart.x) * canvas.clientWidth,
      (point.y - pressStart.y) * canvas.clientHeight
    ) > 7
  )
    cancelLongPress();
  pointers.set(event.pointerId, point);
  const gesture = state.gesture,
    start = gesture.points[0],
    initial = gesture.placement;
  if (gesture.mode === 'pinch') {
    Object.assign(
      state,
      transformGesture(
        gesture.points,
        [...pointers.values()],
        initial,
        state.width,
        state.height
      )
    );
  } else if (gesture.mode === 'opacity') {
    state.opacity = constrain(
      initial.opacity +
        ((start.y - point.y) * canvas.getBoundingClientRect().height) / 180,
      0.2,
      1
    );
  } else if (gesture.mode === 'move') {
    state.px = initial.px + point.x - start.x;
    state.py = initial.py + point.y - start.y;
  } else {
    const vector = (p) => ({
      x: (p.x - initial.px) * state.width,
      y: (p.y - initial.py) * state.height,
    });
    const a = vector(start),
      b = vector(point);
    if (gesture.mode === 'resize')
      state.scale =
        (initial.scale * Math.hypot(b.x, b.y)) /
        Math.max(1, Math.hypot(a.x, a.y));
    else
      state.rotation =
        initial.rotation +
        ((Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x)) * 180) / Math.PI;
  }
  edited();
};
function endGesture(event) {
  cancelLongPress();
  const gesture = state.gesture;
  if (gesture?.mode === 'opacity' && event.type !== 'lostpointercapture') {
    const first = gesture.points[0],
      point = photoPoint(event);
    const bounds = canvas.getBoundingClientRect();
    if (
      Math.hypot(
        (first.x - point.x) * bounds.width,
        (first.y - point.y) * bounds.height
      ) < 7
    )
      openInk(event.clientX, event.clientY);
  }
  pointers.delete(event.pointerId);
  state.gesture = null;
  if (pointers.size) beginGesture();
  draw();
}
canvas.onpointerup = endGesture;
canvas.onpointercancel = () => {
  cancelLongPress();
  pointers.clear();
  state.gesture = null;
  draw();
};
canvas.onlostpointercapture = (event) => {
  if (pointers.has(event.pointerId)) endGesture(event);
};
canvas.onkeydown = (event) => {
  if (!state.design || state.busy || state.view !== 'draft') return;
  if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    openTattooMenu(
      rect.left + state.px * rect.width,
      rect.top + state.py * rect.height
    );
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    $('remove-design').click();
    return;
  }
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    $('flip-design').click();
    return;
  }
  if (event.key === '0') {
    event.preventDefault();
    fitDesign();
    return;
  }
  const delta = event.shiftKey ? 0.05 : 0.01;
  if (event.key === 'ArrowLeft') state.px -= delta;
  else if (event.key === 'ArrowRight') state.px += delta;
  else if (event.key === 'ArrowUp') state.py -= delta;
  else if (event.key === 'ArrowDown') state.py += delta;
  else if (event.key === '+' || event.key === '=') state.scale += 0.05;
  else if (event.key === '-') state.scale -= 0.05;
  else if (event.key.toLowerCase() === 'r')
    state.rotation += event.shiftKey ? -5 : 5;
  else if (event.key === '[')
    state.opacity = constrain(state.opacity - 0.05, 0.2, 1);
  else if (event.key === ']')
    state.opacity = constrain(state.opacity + 0.05, 0.2, 1);
  else return;
  event.preventDefault();
  edited();
};
for (const id of ['access-token', 'prompt', 'consent'])
  $(id).addEventListener('input', update);
function headers() {
  return { Authorization: `Bearer ${$('access-token').value}` };
}
async function request(mode, data, form = false) {
  const response = await fetch(`${api}?mode=${mode}`, {
    method: 'POST',
    headers: {
      ...headers(),
      ...(!form ? { 'Content-Type': 'application/json' } : {}),
    },
    body: form ? data : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || '测试请求未成功，请检查 KIE 后台，勿反复提交。'
    );
  return result;
}
function imageBlob(image, type = 'image/jpeg') {
  return new Promise((resolve, reject) =>
    image.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片导出失败。'))),
      type,
      0.9
    )
  );
}
async function upload(image) {
  const body = new FormData();
  const source =
    image instanceof HTMLCanvasElement
      ? image
      : (() => {
          const target = makeCanvas(
            image.naturalWidth || image.width,
            image.naturalHeight || image.height
          );
          const context = target.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, target.width, target.height);
          context.drawImage(image, 0, 0);
          return target;
        })();
  const blob = await imageBlob(source);
  if (blob.size > 3 * 1024 * 1024)
    throw new Error('测试参考图片超过 3MB，请使用较小图片。');
  body.set('image', blob, 'test-reference.jpg');
  return (await request('upload', body, true)).asset;
}
async function assetImage(asset) {
  const response = await fetch(`${api}?asset=${encodeURIComponent(asset)}`, {
    headers: headers(),
  });
  if (!response.ok)
    throw new Error('测试结果图片无法读取。请检查 KIE 后台或稍后继续查看。');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function waitForTask(task, kind, context = null) {
  state.polling = true;
  const started = Date.now();
  try {
    while (Date.now() - started < 20 * 60 * 1000) {
      status(
        `${kind === 'design' ? '正在生成独立纹身设计' : '正在生成单张真实试戴'}…\n可离开此页，回来后输入测试口令并点击继续查看。`
      );
      const result = await request('status', { task });
      if (result.failed)
        throw new Error(
          'KIE 返回生成失败。请查看 KIE 测试记录；本页未扣网站积分。'
        );
      if (result.state === 'success') {
        const image = await assetImage(result.asset);
        sessionStorage.removeItem('try-on-lab-task');
        $('resume-task').hidden = true;
        if (kind === 'design') {
          await setDesign(image, 'AI 生成的纹身设计', result.asset);
          status('设计已生成。确认摆放位置后，再生成一张真实效果。');
        } else {
          await showResult(image, context === editingContext());
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error(
      '仍在等待 KIE。保留了任务编号，请稍后继续查看，不要重复生成。'
    );
  } finally {
    state.polling = false;
  }
}
async function showResult(image, matches = false) {
  state.resultMatches = matches && !!state.photo && !!state.design;
  state.composite = null;
  state.raw = image;
  state.view = 'raw';
  $('result-info').hidden = false;
  if (!state.photo) {
    state.width = image.naturalWidth;
    state.height = image.naturalHeight;
    $('result-info').textContent =
      '已找回 AI 原始结果。刷新后需重新上传原图才能重新验证局部合成。';
  } else if (!state.resultMatches || !state.region) {
    $('result-info').textContent =
      '已找回 AI 原始结果，可放大查看。原照片或摆放状态已改变，无法与当前编辑状态对比，未创建局部融合结果。';
  } else if (
    Math.abs(
      image.naturalWidth / image.naturalHeight - state.width / state.height
    ) > 0.035
  ) {
    $('result-info').textContent =
      '模型改变了画面比例。本次只展示 AI 原始结果，没有拉伸或合成到原图。请检查位置和构图。';
  } else {
    const layer = makeCanvas(),
      lc = layer.getContext('2d');
    lc.drawImage(image, 0, 0, state.width, state.height);
    const mask = makeCanvas(),
      mc = mask.getContext('2d'),
      r = state.region;
    const padding = Math.max(
      2,
      Math.min(r.width * state.width, r.height * state.height) * 0.08
    );
    mc.filter = `blur(${padding}px)`;
    mc.fillStyle = '#ffffff';
    mc.fillRect(
      r.x * state.width - padding,
      r.y * state.height - padding,
      r.width * state.width + 2 * padding,
      r.height * state.height + 2 * padding
    );
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(mask, 0, 0);
    state.composite = makeCanvas();
    const cc = state.composite.getContext('2d');
    cc.drawImage(state.photo, 0, 0);
    cc.drawImage(layer, 0, 0);
    $('result-info').textContent =
      `已生成一张 ${image.naturalWidth} × ${image.naturalHeight} 的 AI 结果。“AI 原始结果”用于检查模型表现；“局部融合结果”把纹身范围外换回原图，不代表模型本身没有改动原图。`;
  }
  status('真实试戴结果已返回。请检查图案位置、皮肤融合和照片是否保持。');
  draw();
}
async function billable(kind, action) {
  if (state.busy) return;
  state.busy = true;
  state.activity = kind;
  cancelLongPress();
  closeTattooMenu(false);
  state.gesture = null;
  pointers.clear();
  update();
  try {
    await action();
  } catch (error) {
    status(error.message, true);
  } finally {
    state.busy = false;
    state.activity = null;
    update();
  }
}
$('generate-design').onclick = () =>
  billable('design', async () => {
    status('正在提交一次 KIE 设计生成请求…');
    const result = await request('design', {
      prompt: $('prompt').value.trim(),
    });
    sessionStorage.setItem(
      'try-on-lab-task',
      JSON.stringify({ task: result.task, kind: 'design' })
    );
    $('resume-task').hidden = false;
    await waitForTask(result.task, 'design');
  });
$('render').onclick = () =>
  billable('render', async () => {
    const context = editingContext();
    if (
      !state.photo ||
      !state.design ||
      !state.configured ||
      !$('consent').checked ||
      $('access-token').value.length < 24
    )
      throw new Error('请先上传照片、选择图案并完成测试授权。');
    state.region = placementRegion(geometry(), state.width, state.height);
    status('正在上传测试参考图片到 KIE…');
    const snapshot = referenceCanvas();
    if (!state.photoAsset) state.photoAsset = await upload(state.photo);
    if (!state.designAsset)
      state.designAsset = await upload(state.designSource);
    const guide = await upload(snapshot);
    status('正在提交一次 KIE 单张试戴请求…');
    const result = await request('render', {
      photo: state.photoAsset,
      design: state.designAsset,
      guide,
      region: state.region,
    });
    sessionStorage.setItem(
      'try-on-lab-task',
      JSON.stringify({ task: result.task, kind: 'render', context })
    );
    $('resume-task').hidden = false;
    await waitForTask(result.task, 'render', context);
  });
$('resume-task').onclick = () =>
  billable('resume', async () => {
    if (!state.configured || $('access-token').value.length < 24)
      throw new Error('请输入预览测试访问口令。');
    const saved = JSON.parse(
      sessionStorage.getItem('try-on-lab-task') || 'null'
    );
    if (!saved) throw new Error('当前没有保存的测试任务。');
    await waitForTask(saved.task, saved.kind, saved.context);
  });
$('download').onclick = async () => {
  try {
    let image;
    if (state.view === 'draft') image = referenceCanvas();
    else {
      const dimensions = viewDimensions();
      image = makeCanvas(dimensions.width, dimensions.height);
      const src =
        state.view === 'original'
          ? state.photo
          : state.view === 'raw'
            ? state.raw
            : state.composite;
      if (!src) return;
      image.getContext('2d').drawImage(src, 0, 0, image.width, image.height);
    }
    const url = URL.createObjectURL(await imageBlob(image, 'image/png'));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tattoovis-${state.view}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    status(error.message, true);
  }
};
const detailViewer = createDetailViewer(() => ({
  original: state.resultMatches ? state.photo : null,
  draft: state.resultMatches ? referenceCanvas() : null,
  raw: state.raw,
}));
$('inspect-result').onclick = () => {
  if (!state.busy)
    detailViewer.open(
      state.view === 'original'
        ? 'original'
        : state.view === 'draft'
          ? 'draft'
          : 'raw'
    );
};
canvas.ondblclick = () => {
  if (state.raw && !state.busy && state.view !== 'draft')
    detailViewer.open(state.view === 'original' ? 'original' : 'raw');
};
$('reset').onclick = () => {
  if (state.busy) {
    status('测试任务仍在 KIE 执行。请等待结果，避免重复提交。', true);
    return;
  }
  location.reload();
};
window.addEventListener('resize', update);
async function checkConfiguration() {
  state.checking = true;
  $('configuration').textContent = '正在检查预览环境配置…';
  state.configured = false;
  update();
  try {
    const response = await fetch(api, { cache: 'no-store' });
    if (
      response.redirected ||
      !response.headers.get('content-type')?.includes('application/json')
    )
      throw new Error(
        '测试接口返回了登录页面。请先完成 Vercel 访问验证，再重新检查。'
      );
    const config = await response.json();
    if (!response.ok)
      throw new Error('此部署未启用测试接口，请使用最新 Preview 地址。');
    state.configured = config.configured === true;
    $('configuration').dataset.ready = String(state.configured);
    $('configuration').textContent = state.configured
      ? 'Preview 测试服务已配置。请在上方输入对应的测试访问口令。'
      : `当前部署配置不完整：${Array.isArray(config.missing) && config.missing.length ? config.missing.join('、') : 'KIE_LAB_API_KEY 或 KIE_LAB_ACCESS_TOKEN（至少 24 个字符）'}。请在 Vercel Preview 环境配置后重新部署，旧部署不会自动读取新增变量。`;
  } catch (error) {
    $('configuration').dataset.ready = 'false';
    $('configuration').textContent =
      error.message || '未连接测试服务。请稍后重新检查。';
  } finally {
    state.checking = false;
    update();
  }
}
$('check-configuration').onclick = checkConfiguration;
await checkConfiguration();
$('resume-task').hidden = !sessionStorage.getItem('try-on-lab-task');
draw();
