import {
  createAccountLibrary,
  createAccountWallet,
  detectStudioRuntime,
} from './account.mjs';
import { createDetailViewer } from './detail-viewer.mjs';
import { createStudioGallery } from './gallery.mjs';
import {
  hitPlacement,
  placementGeometry,
  placementRegion,
  pointInPhoto,
  transformGesture,
} from './geometry.mjs';
import { createStudioI18n } from './i18n.mjs';
import { createStudioLibrary } from './library.mjs';
import { initStudioNavigation } from './navigation.mjs';
import { createPreviewWallet, previewCreditCost } from './wallet.mjs';

const $ = (id) => document.getElementById(id);
const studioLocale =
  new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
let runtime;
let bootError;
try {
  runtime = await detectStudioRuntime();
} catch (error) {
  bootError = error;
  runtime = {
    account: true,
    api: '/api/studio',
    capabilities: {
      configured: false,
      signedIn: false,
      verified: false,
      credits: 0,
      pending: [],
    },
  };
}
const accountMode = runtime.account;
let accountConfig = runtime.capabilities;
const i18n = createStudioI18n(studioLocale, { account: accountMode });
i18n.apply();
initStudioNavigation({ locale: studioLocale, t: i18n.t });
const canvas = $('stage'),
  ctx = canvas.getContext('2d');
const api = runtime.api;
if (accountMode) {
  $('grant-test-credits').hidden = true;
  document.querySelector('.test-config').hidden = true;
  document.querySelector('.consent').hidden = true;
  const link = document.createElement('a');
  link.className = 'site-nav-link site-account';
  link.href = `${studioLocale === 'zh' ? '/zh' : ''}${accountConfig.signedIn ? '/settings/profile' : '/sign-in'}`;
  link.textContent =
    studioLocale === 'zh'
      ? accountConfig.signedIn
        ? '账户'
        : '登录'
      : accountConfig.signedIn
        ? 'Account'
        : 'Sign in';
  $('site-navigation-links').insertBefore(link, document.querySelector('.site-language'));
  const base = studioLocale === 'zh' ? '/zh' : '';
  document.querySelector('[data-site-path="#features"]').href = `${base || '/'}#features`;
  $('nav-studio').href = '#stage';
  for (const collection of ['history', 'designs']) {
    const previous = $(`nav-${collection}`);
    const anchor = document.createElement('a');
    anchor.id = previous.id;
    anchor.className = previous.className;
    anchor.textContent = previous.textContent;
    anchor.href = `${base}/${collection}`;
    previous.replaceWith(anchor);
  }
}
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
  designId: null,
  designName: '',
  designPrompt: '',
  designOrigin: 'upload',
  designOperationId: null,
  resultId: null,
  resultSaved: false,
  resultResolution: '1K',
  resultOperationId: null,
  comparisonSnapshots: null,
};
const library = accountMode
  ? createAccountLibrary({
      pendingLibrary: accountConfig.userId
        ? createStudioLibrary({
            dbName: `tattoovis-account-drafts-${accountConfig.userId}`,
          })
        : undefined,
    })
  : createStudioLibrary();
const taskKey = accountMode
  ? `tattoovis-account-task-${accountConfig.userId || 'guest'}`
  : 'try-on-lab-task';
let accountTask = null;
// Only signed task references and prompt metadata, never the lab access token.
const taskStorage = {
  getItem(key) {
    key = taskKey;
    if (accountMode) {
      try {
        const value = localStorage.getItem(key) || accountTask;
        const parsed = JSON.parse(value || 'null');
        return parsed?.task && ['design', 'render'].includes(parsed.kind)
          ? value
          : null;
      } catch {
        return accountTask;
      }
    }
    const current = localStorage.getItem(key),
      legacy = sessionStorage.getItem(key);
    if (legacy) sessionStorage.removeItem(key);
    if (current) return current;
    if (legacy) localStorage.setItem(key, legacy);
    return legacy;
  },
  setItem(key, value) {
    key = taskKey;
    if (accountMode) {
      accountTask = value;
      try {
        localStorage.setItem(key, value);
      } catch {
        /* Server jobs remain authoritative. */
      }
      return;
    }
    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
  },
  removeItem(key) {
    key = taskKey;
    if (accountMode) {
      accountTask = null;
      try {
        localStorage.removeItem(key);
      } catch {
        /* Browser drafts are optional. */
      }
      return;
    }
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
function hasPendingTask() {
  try {
    return !!taskStorage.getItem('try-on-lab-task');
  } catch {
    return false;
  }
}

function clearPendingTask(task) {
  const current = JSON.parse(taskStorage.getItem('try-on-lab-task') || 'null');
  if (current?.task === task) taskStorage.removeItem('try-on-lab-task');
  $('resume-task').hidden = !hasPendingTask();
}

let wallet = null,
  walletError = '',
  historySources = null;
try {
  wallet = accountMode
    ? createAccountWallet(accountConfig, { locale: studioLocale })
    : navigator.locks?.request
      ? await navigator.locks.request('tattoovis-preview-test-wallet', () =>
          createPreviewWallet()
        )
      : createPreviewWallet();
} catch (error) {
  walletError = error.message;
}
function testBalance() {
  try {
    return wallet?.snapshot() || null;
  } catch (error) {
    walletError = error.message;
    return null;
  }
}
async function imageFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
const gallery = createStudioGallery({
  library,
  locale: studioLocale,
  isBusy: () => state.busy,
  onUseDesign: async (record) => {
    if (state.busy) return;
    const image = await imageFromBlob(record.image);
    if (state.busy) return;
    await setDesign(image, record.name, accountMode ? record.assetId : null, {
      id: record.id,
      prompt: record.prompt,
      source: record.source,
    });
    $('prompt').value = record.prompt;
    status('已复用保存的图案，不消耗测试积分。');
    $('canvas-shell').scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  },
  onReusePrompt: (prompt) => {
    if (state.busy) return;
    $('prompt').value = prompt;
    $('new-design-panel').hidden = false;
    $('prompt').focus();
    update();
  },
  onOpenHistory: async (record) => {
    if (state.busy) return;
    const [raw, original, draft] = await Promise.all([
      imageFromBlob(record.image),
      record.original ? imageFromBlob(record.original) : null,
      record.draft ? imageFromBlob(record.draft) : null,
    ]);
    historySources = { raw, original, draft };
    detailViewer.open('raw');
  },
});
const editingContext = () => `${editorSession}:${state.revision}`;

function status(message, error = false) {
  $('status').textContent = i18n.t(message);
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
  const balance = testBalance();
  const pending = hasPendingTask();
  $('resume-task').hidden = !pending;
  const renderCost = previewCreditCost('render', $('render-resolution').value);
  $('credit-balance').textContent = balance
    ? `可用测试积分 ${balance.available} credits${balance.reserved ? ` · 预留 ${balance.reserved}` : ''}`
    : `测试积分不可用：${walletError}`;
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
    'new-design',
    'open-design-library',
    'nav-designs',
    'nav-history',
    'render-resolution',
    'grant-test-credits',
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
    (accountMode ||
      ($('access-token').value.length >= 24 && $('consent').checked));
  $('generate-design').disabled =
    !access ||
    state.busy ||
    $('prompt').value.trim().length < 3 ||
    !balance ||
    (!accountMode && balance.available < 1) ||
    pending ||
    balance.reserved > 0;
  $('render').disabled =
    !placed ||
    !access ||
    state.busy ||
    !balance ||
    (!accountMode && balance.available < renderCost) ||
    pending ||
    balance.reserved > 0;
  $('release-orphaned-credit').hidden =
    accountMode || !balance?.reserved || pending || state.busy;
  $('render').textContent =
    state.busy && state.activity === 'render'
      ? '正在生成真实效果…'
      : `生成真实试戴效果 · ${renderCost} 测试 credit${renderCost > 1 ? 's' : ''}`;
  $('generate-design').textContent =
    state.busy && state.activity === 'design'
      ? '正在创作图案…'
      : '生成新图案 · 1 测试 credit';
  $('save-design').hidden = !state.design;
  $('save-design').disabled = state.busy || !!state.designId;
  $('download-design').hidden = !state.design;
  $('download-design').disabled = state.busy;
  $('save-result').hidden = !state.raw;
  $('save-result').disabled = state.busy || state.resultSaved;
  document
    .querySelector('.photo-workspace')
    .setAttribute('aria-busy', String(state.busy));
  const missing = [];
  if (!state.photo) missing.push('上传部位照片');
  if (!state.design) missing.push('选择纹身图案');
  if (!state.configured) missing.push('完成 Preview 测试服务配置');
  if (!accountMode && $('access-token').value.length < 24)
    missing.push('在本页输入至少 24 个字符的测试访问口令');
  if (!accountMode && !$('consent').checked) missing.push('勾选同意调用 KIE');
  if (!balance || balance.available < renderCost) missing.push('补充测试积分');
  if (accountMode && !accountConfig.signedIn)
    missing.push(studioLocale === 'zh' ? '登录账户' : 'Sign in');
  else if (accountMode && !accountConfig.verified)
    missing.push(studioLocale === 'zh' ? '验证邮箱' : 'Verify your email');
  if (pending) missing.push('先继续查看上次测试任务');
  if (balance?.reserved && !pending && !state.busy)
    missing.push('处理未确认的测试任务预留');
  $('render-requirements').textContent = state.busy
    ? '正在处理测试任务，请勿重复提交。'
    : missing.length
      ? `还需完成：${missing.map(i18n.t).join('；')}。`
      : `已准备好。成功后结算 ${renderCost} 测试 credit${renderCost > 1 ? 's' : ''}，失败释放预留。不使用网站真实积分。`;
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
  for (const id of [
    'credit-balance',
    'render',
    'generate-design',
    'render-requirements',
    'workflow-title',
    'workflow-description',
    'placement-status',
    'view-caption',
    'configuration',
    'design-save-status',
    'photo-hint',
    'download',
    'result-info',
  ]) {
    $(id).textContent = i18n.t($(id).textContent);
  }
  const authorization = $('authorization-summary').querySelector('span');
  authorization.textContent = i18n.t(authorization.textContent);
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
  ctx.fillText(i18n.t('深浅'), h.opacity.x - 12 * h.unit, h.opacity.y);
}
function invalidateResult() {
  state.comparisonSnapshots = null;
  closeTattooMenu(false);
  state.revision += 1;
  state.resultMatches = false;
  state.raw = null;
  state.resultId = null;
  state.resultSaved = false;
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
async function setDesign(image, name, asset = null, metadata = {}) {
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
  state.designId = metadata.id || null;
  state.designName = name;
  state.designPrompt = metadata.prompt || '';
  state.designOrigin = metadata.source || 'upload';
  state.designOperationId = metadata.operationId || null;
  $('design-save-status').textContent = state.designId
    ? '已保存 · 复用免费'
    : '可免费保存到当前浏览器';
  $('design-thumb').src = working.toDataURL();
  $('design-thumb').hidden = false;
  $('design-name').textContent = [
    'AI 生成的纹身设计',
    '几何狼头示例',
    '上传的纹身设计',
  ].includes(name)
    ? i18n.t(name)
    : name;
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
    if (!state.busy)
      await setDesign(image, '几何狼头示例', null, { source: 'sample' });
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
  state.designId = null;
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
$('render-resolution').addEventListener('change', update);
$('grant-test-credits').onclick = async () => {
  if (accountMode || state.busy || !wallet) return;
  try {
    await walletMutation('grant', 10);
    status('已免费补充 10 测试积分，不产生购买交易。');
    update();
  } catch (error) {
    status(error.message, true);
  }
};
$('release-orphaned-credit').onclick = async () => {
  if (accountMode || state.busy || hasPendingTask() || !wallet) return;
  if (
    !window.confirm(
      i18n.t(
        '这只释放没有任务编号的本地测试预留，不会取消可能已创建的 KIE 任务。请先检查 KIE 后台，避免重复付费提交。是否继续？'
      )
    )
  )
    return;
  try {
    for (const id of wallet.snapshot().reservations) {
      await walletMutation('release', id);
      await library.deletePending(id);
    }
    status('已释放无任务编号的测试预留。请检查 KIE 后台后再提交。');
    update();
  } catch (error) {
    status(error.message, true);
  }
};
$('new-design').onclick = () => {
  $('new-design-panel').hidden = false;
  $('prompt').focus();
};
$('open-design-library').onclick = () => gallery.open('designs');
$('nav-designs').onclick = (event) => {
  event?.preventDefault();
  if (!state.busy) gallery.open('designs');
};
$('nav-history').onclick = (event) => {
  event?.preventDefault();
  if (!state.busy) gallery.open('history');
};
$('save-design').onclick = async () => {
  if (state.busy || !state.design || state.designId) return;
  const design = state.designSource,
    revision = state.revision;
  $('save-design').disabled = true;
  try {
    const record = await library.saveDesign({
      operationId: state.designOperationId,
      id: state.designOperationId
        ? `design-${state.designOperationId}`
        : crypto.randomUUID(),
      name: state.designName,
      prompt: state.designPrompt,
      source: state.designOrigin,
      image: await sourceBlob(design),
    });
    if (state.revision === revision) {
      state.designId = record.id;
      $('design-save-status').textContent = '已保存到当前浏览器 · 复用免费';
    }
    if (state.designOperationId)
      await completeOperation(state.designOperationId);
    status('图案已免费保存。');
  } catch (error) {
    status(`图案未保存：${error.message}。可以先下载图案。`, true);
  }
  update();
};
$('download-design').onclick = async () => {
  if (!state.designSource) return;
  try {
    await downloadBlob(
      await sourceBlob(state.designSource),
      'tattoovis-design.png'
    );
  } catch (error) {
    status(error.message, true);
  }
};
async function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function sourceBlob(source) {
  if (source instanceof HTMLCanvasElement)
    return imageBlob(source, 'image/png');
  const target = makeCanvas(
    source.naturalWidth || source.width,
    source.naturalHeight || source.height
  );
  target.getContext('2d').drawImage(source, 0, 0);
  return imageBlob(target, 'image/png');
}
async function walletMutation(method, ...args) {
  if (!wallet) throw new Error(walletError || '测试积分不可用。');
  const action = () => wallet[method](...args);
  return navigator.locks?.request
    ? navigator.locks.request('tattoovis-preview-test-wallet', action)
    : action();
}
async function completeOperation(id) {
  if (wallet?.hasReservation(id)) await walletMutation('confirm', id);
  await library.deletePending(id).catch(() => {});
  const pending = JSON.parse(taskStorage.getItem('try-on-lab-task') || 'null');
  if (pending?.operationId === id) {
    taskStorage.removeItem('try-on-lab-task');
    $('resume-task').hidden = true;
  }
  if (accountMode) await refreshAccount().catch(() => {});
}
async function saveCurrentResult(
  id,
  prompt = state.designPrompt,
  designId = state.designId,
  pending = null
) {
  const raw = state.raw,
    matches = state.resultMatches,
    original = state.photo;
  const draft = matches ? referenceCanvas() : null,
    resolution = state.resultResolution;
  return library.saveHistory({
    id,
    operationId: state.resultOperationId,
    resolution,
    prompt,
    ...(designId ? { designId } : {}),
    image: await sourceBlob(raw),
    ...(pending
      ? { original: pending.original, draft: pending.draft }
      : state.comparisonSnapshots
        ? {
            original: await sourceBlob(state.comparisonSnapshots.original),
            draft: await sourceBlob(state.comparisonSnapshots.draft),
          }
        : matches
          ? {
              original: await sourceBlob(original),
              draft: await sourceBlob(draft),
            }
          : {}),
  });
}
$('save-result').onclick = async () => {
  if (state.busy || !state.raw || state.resultSaved) return;
  const revision = state.revision;
  try {
    const saved = await saveCurrentResult(
      state.resultId || crypto.randomUUID()
    );
    if (state.resultOperationId)
      await completeOperation(state.resultOperationId);
    if (state.revision === revision) {
      state.resultId = saved.id;
      state.resultSaved = true;
    }
    status('试戴结果已免费保存到当前浏览器。');
  } catch (error) {
    status(`试戴历史未保存：${error.message}。请先下载结果。`, true);
  }
  update();
};
function headers() {
  return accountMode
    ? {}
    : { Authorization: `Bearer ${$('access-token').value}` };
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
  if (accountMode && ['design', 'render', 'status'].includes(mode))
    await refreshAccount().catch(() => {});
  if (accountMode && [401, 402, 403].includes(response.status))
    location.assign(
      `${studioLocale === 'zh' ? '/zh' : ''}${response.status === 401 ? '/sign-in' : response.status === 402 ? '/pricing' : '/verify-email?callbackUrl=/generate'}`
    );
  if (!response.ok)
    throw Object.assign(
      new Error(
        result.error || '测试请求未成功，请检查 KIE 后台，勿反复提交。'
      ),
      {
        definitelyRejected: [400, 401, 403, 404, 409, 413, 422, 429].includes(
          response.status
        ),
      }
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
async function waitForTask(task, kind, context = null, details = {}) {
  state.polling = true;
  const started = Date.now();
  try {
    while (Date.now() - started < 20 * 60 * 1000) {
      status(
        `${kind === 'design' ? '正在生成独立纹身设计' : '正在生成单张真实试戴'}…\n可离开此页，回来后输入测试口令并点击继续查看。`
      );
      let result;
      try {
        result = await request('status', { task });
      } catch (error) {
        if (error.message === 'Test reference expired') {
          if (details.operationId)
            await walletMutation('release', details.operationId);
          clearPendingTask(task);
        }
        throw error;
      }
      if (accountMode && result.state === 'review_required')
        throw new Error(
          result.error ||
            'Submission is under review. Your credit is held; contact support before generating again.'
        );
      if (result.failed) {
        if (details.operationId)
          await walletMutation('release', details.operationId);
        if (details.operationId)
          await library.deletePending(details.operationId).catch(() => {});
        clearPendingTask(task);
        if (accountMode) await refreshAccount().catch(() => {});
        throw new Error(
          'KIE 返回生成失败，已释放测试积分预留；不扣网站真实积分。'
        );
      }
      if (result.state === 'success') {
        const image = await assetImage(result.asset);
        let saved = false,
          warning = '';
        if (kind === 'design') {
          await setDesign(image, 'AI 生成的纹身设计', result.asset, {
            prompt: details.prompt || '',
            source: 'generated',
            operationId: details.operationId || null,
          });
          try {
            const record = await library.saveDesign({
              operationId: details.operationId,
              id: details.operationId
                ? `design-${details.operationId}`
                : crypto.randomUUID(),
              name: details.prompt?.slice(0, 60) || 'AI 生成的纹身设计',
              prompt: details.prompt || '',
              source: 'generated',
              image: await sourceBlob(image),
            });
            state.designId = record.id;
            saved = true;
            $('design-save-status').textContent = '已自动保存 · 下次复用免费';
          } catch (error) {
            warning = `图案已生成，但浏览器保存失败：${error.message}。请先下载图案，稍后可免费重试保存。`;
          }
        } else {
          const pending = details.operationId
            ? await library.getPending(details.operationId)
            : null;
          state.resultResolution = details.resolution || '1K';
          await showResult(image, context === editingContext());
          state.resultOperationId = details.operationId || null;
          if (pending && !state.resultMatches) {
            state.comparisonSnapshots = {
              raw: image,
              original: await imageFromBlob(pending.original),
              draft: await imageFromBlob(pending.draft),
            };
            $('result-info').textContent =
              '已恢复任务及当时的原图和摆放快照，可继续三图对比。当前编辑内容没有被替换。';
          }
          state.resultId = details.operationId
            ? `tryon-${details.operationId}`
            : crypto.randomUUID();
          try {
            const record = await saveCurrentResult(
              state.resultId,
              details.prompt,
              details.designId,
              pending
            );
            state.resultId = record.id;
            if (
              accountMode &&
              !state.comparisonSnapshots &&
              record.original &&
              record.draft
            ) {
              state.comparisonSnapshots = {
                raw: image,
                original: await imageFromBlob(record.original),
                draft: await imageFromBlob(record.draft),
              };
            }
            state.resultSaved = true;
            saved = true;
          } catch (error) {
            warning = `效果已生成，但浏览器历史保存失败：${error.message}。请下载或重试保存。`;
          }
        }
        if (saved) {
          if (details.operationId) await completeOperation(details.operationId);
          else {
            clearPendingTask(task);
          }
        }
        status(
          warning
            ? `${warning} 本次未结算测试积分。`
            : kind === 'design'
              ? '图案已生成并自动保存，可反复免费复用。确认位置后再单独生成真实试戴效果。'
              : '单张试戴已生成并保存到试戴历史。可放大对比、下载，或复用同一图案换个位置。',
          !!warning
        );
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
  state.comparisonSnapshots = null;
  state.resultSaved = false;
  state.resultId = null;
  state.resultOperationId = null;
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
  if (accountMode && kind !== 'resume') {
    try {
      const cost = previewCreditCost(kind, $('render-resolution').value);
      wallet.requireAccess(cost);
      if (
        !globalThis.confirm(
          studioLocale === 'zh'
            ? `本次生成将使用 ${cost} 积分，是否继续？`
            : `Generate using ${cost} credit${cost > 1 ? 's' : ''}?`
        )
      )
        return;
    } catch (error) {
      status(error.message, true);
      return;
    }
  }
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
    if (hasPendingTask())
      throw new Error('请先继续查看上次测试任务，不要重复提交。');
    if (
      !state.configured ||
      (!accountMode &&
        (!$('consent').checked || $('access-token').value.length < 24)) ||
      $('prompt').value.trim().length < 3
    )
      throw new Error('请填写提示词并完成测试授权。');
    if (!accountMode && (await library.listDesigns()).length >= 100)
      throw new Error('图案库已满，请先下载并删除不需要的图案，再生成新图案。');
    const details = {
      operationId: crypto.randomUUID(),
      prompt: $('prompt').value.trim(),
    };
    await walletMutation('reserve', details.operationId, 1);
    update();
    let submitted = false;
    try {
      status('正在提交一次 KIE 设计生成请求…');
      submitted = true;
      const result = await request('design', {
        operationId: details.operationId,
        prompt: details.prompt,
      });
      submitted = true;
      taskStorage.setItem(
        'try-on-lab-task',
        JSON.stringify({ task: result.task, kind: 'design', ...details })
      );
      $('resume-task').hidden = false;
      await waitForTask(result.task, 'design', null, details);
    } catch (error) {
      if (!submitted || error.definitelyRejected)
        await walletMutation('release', details.operationId);
      throw error;
    }
  });
$('render').onclick = () =>
  billable('render', async () => {
    if (hasPendingTask())
      throw new Error('请先继续查看上次测试任务，不要重复提交。');
    const context = editingContext();
    if (
      !state.photo ||
      !state.design ||
      !state.configured ||
      (!accountMode &&
        (!$('consent').checked || $('access-token').value.length < 24))
    )
      throw new Error('请先上传照片、选择图案并完成测试授权。');
    if (!accountMode && (await library.listHistory()).length >= 100)
      throw new Error('试戴历史已满，请先下载并删除不需要的结果，再生成。');
    const details = {
      operationId: crypto.randomUUID(),
      resolution: $('render-resolution').value,
      prompt: state.designPrompt,
      designId: state.designId,
    };
    await walletMutation(
      'reserve',
      details.operationId,
      previewCreditCost('render', details.resolution)
    );
    update();
    let submitted = false;
    try {
      state.region = placementRegion(geometry(), state.width, state.height);
      status('正在上传测试参考图片到 KIE…');
      const snapshot = referenceCanvas();
      await library.savePending({
        id: details.operationId,
        resolution: details.resolution,
        original: await sourceBlob(state.photo),
        draft: await sourceBlob(snapshot),
        prompt: details.prompt,
        ...(details.designId ? { designId: details.designId } : {}),
      });
      if (!state.photoAsset) state.photoAsset = await upload(state.photo);
      if (!state.designAsset)
        state.designAsset = await upload(state.designSource);
      const guide = await upload(snapshot);
      status('正在提交一次 KIE 单张试戴请求…');
      submitted = true;
      const result = await request('render', {
        operationId: details.operationId,
        prompt: details.prompt,
        ...(details.designId ? { designId: details.designId } : {}),
        photo: state.photoAsset,
        design: state.designAsset,
        guide,
        region: state.region,
        resolution: details.resolution,
      });
      submitted = true;
      taskStorage.setItem(
        'try-on-lab-task',
        JSON.stringify({
          task: result.task,
          kind: 'render',
          context,
          ...details,
        })
      );
      $('resume-task').hidden = false;
      await waitForTask(result.task, 'render', context, details);
    } catch (error) {
      if (!submitted || error.definitelyRejected) {
        await walletMutation('release', details.operationId);
        await library.deletePending(details.operationId).catch(() => {});
      }
      throw error;
    }
  });
$('resume-task').onclick = () =>
  billable('resume', async () => {
    if (
      !accountMode &&
      (!state.configured || $('access-token').value.length < 24)
    )
      throw new Error('请输入预览测试访问口令。');
    const saved = JSON.parse(taskStorage.getItem('try-on-lab-task') || 'null');
    if (!saved) throw new Error('当前没有保存的测试任务。');
    await waitForTask(saved.task, saved.kind, saved.context, saved);
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
const detailViewer = createDetailViewer(
  () =>
    historySources ||
    state.comparisonSnapshots || {
      original: state.resultMatches ? state.photo : null,
      draft: state.resultMatches ? referenceCanvas() : null,
      raw: state.raw,
    },
  i18n.t
);
$('inspect-result').onclick = () => {
  if (!state.busy) {
    historySources = null;
    detailViewer.open(
      state.view === 'original'
        ? 'original'
        : state.view === 'draft'
          ? 'draft'
          : 'raw'
    );
  }
};
canvas.ondblclick = () => {
  if (state.raw && !state.busy && state.view !== 'draft') {
    historySources = null;
    detailViewer.open(state.view === 'original' ? 'original' : 'raw');
  }
};
$('reset').onclick = () => {
  if (state.busy) {
    status('测试任务仍在 KIE 执行。请等待结果，避免重复提交。', true);
    return;
  }
  location.reload();
};
window.addEventListener('resize', update);
window.addEventListener('storage', update);
async function refreshAccount() {
  if (!accountMode) return;
  const response = await fetch(api, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not refresh account.');
  accountConfig = await response.json();
  wallet.update(accountConfig);
  if (!hasPendingTask() && accountConfig.pending?.length)
    taskStorage.setItem(
      'try-on-lab-task',
      JSON.stringify(accountConfig.pending[0])
    );
  update();
}
async function checkConfiguration() {
  if (accountMode) {
    try {
      await refreshAccount();
      state.configured = accountConfig.configured === true;
    } catch (error) {
      status(error.message, true);
    }
    update();
    return;
  }
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
const panel = new URLSearchParams(location.search).get('panel');
if (panel === 'history' || panel === 'designs') gallery.open(panel);
try {
  await checkConfiguration();
  if (bootError && !state.configured)
    status(
      studioLocale === 'zh'
        ? '暂时无法连接账户服务。可以继续手动摆放，稍后刷新重试。'
        : 'Account service is unavailable. You can still place designs manually; reload to retry.',
      true
    );
  $('resume-task').hidden = !hasPendingTask();
  draw();
} finally {
  document.body.dataset.runtimeReady = 'true';
  $('studio-bootstrap').hidden = true;
}
