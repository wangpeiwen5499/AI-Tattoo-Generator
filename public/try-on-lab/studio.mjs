import { fitPlacement, pointInPhoto, regionFromDrag } from './geometry.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('stage'),
  ctx = canvas.getContext('2d');
const api = '/api/preview/try-on';
const state = {
  photo: null,
  design: null,
  designSource: null,
  raw: null,
  composite: null,
  region: null,
  tempRegion: null,
  mode: 'select',
  view: 'draft',
  width: 1200,
  height: 900,
  scale: 1,
  rotation: 0,
  opacity: 0.85,
  px: 0.5,
  py: 0.5,
  busy: false,
  configured: false,
  photoAsset: null,
  designAsset: null,
  gesture: null,
  polling: false,
};
const controls = ['scale', 'rotation', 'opacity', 'placement-x', 'placement-y'];
const regionControls = [
  'region-x',
  'region-y',
  'region-width',
  'region-height',
];
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
  ])
    $(id).disabled = state.busy;
  const placed = !!(state.photo && state.design && state.region);
  for (const id of controls) $(id).disabled = !placed || state.busy;
  for (const id of regionControls) $(id).disabled = !state.region || state.busy;
  $('select-region').disabled = !state.photo || state.busy;
  $('fit-design').disabled = !placed || state.busy;
  const access =
    state.configured &&
    $('access-token').value.length >= 24 &&
    $('consent').checked;
  $('generate-design').disabled =
    !access || state.busy || $('prompt').value.trim().length < 3;
  $('render').disabled = !placed || !access || state.busy;
  $('download').hidden = !(state.photo || state.raw);
  $('empty').hidden = !!(state.photo || state.raw);
  $('scale-value').textContent = `${Math.round(state.scale * 100)}%`;
  $('rotation-value').textContent = `${Math.round(state.rotation)}°`;
  $('opacity-value').textContent = `${Math.round(state.opacity * 100)}%`;
  $('scale').value = String(state.scale * 100);
  $('rotation').value = String(state.rotation);
  $('opacity').value = String(state.opacity * 100);
  $('placement-x').value = String(state.px * 100);
  $('placement-y').value = String(state.py * 100);
  if (state.region) {
    const r = state.region;
    $('region-summary').textContent =
      `已选区域：照片宽度的 ${Math.round(r.width * 100)}%，高度的 ${Math.round(r.height * 100)}%`;
    $('region-x').value = String((r.x + r.width / 2) * 100);
    $('region-y').value = String((r.y + r.height / 2) * 100);
    $('region-width').value = String(r.width * 100);
    $('region-height').value = String(r.height * 100);
  } else $('region-summary').textContent = '还没有选择位置';
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
        ? '将 AI 结果合成在选区内，选区外使用原图'
        : state.view === 'original'
          ? '你上传的照片'
          : '本地叠图，尚未进行 AI 渲染';
  canvas.className = state.mode === 'select' ? 'selecting' : 'moving';
  const dimensions = viewDimensions();
  canvas.style.maxWidth = `${((innerWidth < 760 ? 560 : 760) * dimensions.width) / dimensions.height}px`;
}
function regionPath(context, r) {
  context.beginPath();
  context.ellipse(
    (r.x + r.width / 2) * state.width,
    (r.y + r.height / 2) * state.height,
    (r.width * state.width) / 2,
    (r.height * state.height) / 2,
    0,
    0,
    Math.PI * 2
  );
}
function draft(context) {
  if (!state.design || !state.region) return;
  const r = state.region;
  const fit = fitPlacement(
    r,
    state.design.width / state.design.height,
    state.width,
    state.height
  );
  context.save();
  regionPath(context, r);
  context.clip();
  context.translate(
    (r.x + r.width * state.px) * state.width,
    (r.y + r.height * state.py) * state.height
  );
  context.rotate((state.rotation * Math.PI) / 180);
  context.globalAlpha = state.opacity;
  context.globalCompositeOperation = 'multiply';
  context.drawImage(
    state.design,
    (-fit.width * state.scale) / 2,
    (-fit.height * state.scale) / 2,
    fit.width * state.scale,
    fit.height * state.scale
  );
  context.restore();
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
    const r = state.tempRegion || state.region;
    if (r) {
      ctx.save();
      regionPath(ctx, r);
      ctx.strokeStyle = '#7160ed';
      ctx.lineWidth = (2 * state.width) / Math.max(canvas.clientWidth, 1);
      ctx.setLineDash([
        (7 * state.width) / Math.max(canvas.clientWidth, 1),
        (5 * state.width) / Math.max(canvas.clientWidth, 1),
      ]);
      ctx.stroke();
      ctx.restore();
    }
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
  state.mode = state.region ? 'move' : 'select';
  state.view = 'draft';
  draw();
}
async function setPhoto(image, sample = false) {
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
  state.mode = 'select';
  state.view = 'draft';
  $('result-info').hidden = true;
  $('photo-hint').textContent = '在照片上拖动，圈出希望纹身的皮肤区域。';
  status('照片已准备好。先圈选位置，也可以使用滑块调整。');
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
$('photo').addEventListener('change', async (event) => {
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
$('select-region').onclick = () => {
  if (!state.region)
    state.region = { x: 0.35, y: 0.3, width: 0.3, height: 0.35 };
  state.mode = 'select';
  state.view = 'draft';
  status('在照片上按住并拖动，圈出希望纹身的区域。');
  draw();
};
$('fit-design').onclick = fitDesign;
for (const button of document.querySelectorAll('[data-view]'))
  button.onclick = () => setView(button.dataset.view);
for (const id of controls)
  $(id).oninput = () => {
    state.scale = Number($('scale').value) / 100;
    state.rotation = Number($('rotation').value);
    state.opacity = Number($('opacity').value) / 100;
    state.px = Number($('placement-x').value) / 100;
    state.py = Number($('placement-y').value) / 100;
    state.view = 'draft';
    state.raw = null;
    state.composite = null;
    $('result-info').hidden = true;
    draw();
  };
for (const id of regionControls)
  $(id).oninput = () => {
    if (!state.region) return;
    const width = Number($('region-width').value) / 100,
      height = Number($('region-height').value) / 100;
    const x = constrain(
        Number($('region-x').value) / 100 - width / 2,
        0,
        1 - width
      ),
      y = constrain(
        Number($('region-y').value) / 100 - height / 2,
        0,
        1 - height
      );
    state.region = { x, y, width, height };
    state.raw = null;
    state.composite = null;
    $('result-info').hidden = true;
    state.view = 'draft';
    draw();
  };
canvas.onpointerdown = (event) => {
  if (!state.photo || state.busy || state.view !== 'draft') return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const bounds = canvas.getBoundingClientRect();
  const point = pointInPhoto(
    { x: event.clientX, y: event.clientY },
    {
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height,
    }
  );
  state.gesture = {
    start: point,
    px: state.px,
    py: state.py,
    mode: state.mode,
  };
};
canvas.onpointermove = (event) => {
  if (!state.gesture) return;
  event.preventDefault();
  const b = canvas.getBoundingClientRect();
  const point = pointInPhoto(
    { x: event.clientX, y: event.clientY },
    { x: b.left, y: b.top, width: b.width, height: b.height }
  );
  if (state.gesture.mode === 'select')
    state.tempRegion = regionFromDrag(state.gesture.start, point);
  else if (state.region) {
    state.px = constrain(
      state.gesture.px + (point.x - state.gesture.start.x) / state.region.width,
      0,
      1
    );
    state.py = constrain(
      state.gesture.py +
        (point.y - state.gesture.start.y) / state.region.height,
      0,
      1
    );
  }
  draw();
};
function endGesture() {
  if (!state.gesture) return;
  if (state.gesture.mode === 'select' && state.tempRegion) {
    state.region = state.tempRegion;
    state.tempRegion = null;
    state.mode = 'move';
    fitDesign();
    status('区域已选好。选择图案后，可以直接拖动或用滑块调整。');
  }
  state.gesture = null;
  draw();
}
canvas.onpointerup = endGesture;
canvas.onpointercancel = () => {
  state.tempRegion = null;
  state.gesture = null;
  draw();
};
canvas.onkeydown = (event) => {
  if (!state.region || state.busy) return;
  const delta = event.shiftKey ? 0.05 : 0.01;
  if (event.key === 'ArrowLeft') state.px = constrain(state.px - delta, 0, 1);
  else if (event.key === 'ArrowRight')
    state.px = constrain(state.px + delta, 0, 1);
  else if (event.key === 'ArrowUp')
    state.py = constrain(state.py - delta, 0, 1);
  else if (event.key === 'ArrowDown')
    state.py = constrain(state.py + delta, 0, 1);
  else return;
  event.preventDefault();
  state.view = 'draft';
  draw();
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
async function waitForTask(task, kind) {
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
          await showResult(image);
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
async function showResult(image) {
  state.composite = null;
  state.raw = image;
  state.view = 'raw';
  $('result-info').hidden = false;
  if (!state.photo || !state.region) {
    state.width = image.naturalWidth;
    state.height = image.naturalHeight;
    $('result-info').textContent =
      '已找回 AI 原始结果。刷新后需重新上传原图才能重新验证局部合成。';
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
    mc.save();
    mc.translate(
      (r.x + r.width / 2) * state.width,
      (r.y + r.height / 2) * state.height
    );
    mc.scale((r.width * state.width) / 2, (r.height * state.height) / 2);
    const gradient = mc.createRadialGradient(0, 0, 0.88, 0, 0, 1);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    mc.fillStyle = gradient;
    mc.fillRect(-1, -1, 2, 2);
    mc.restore();
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(mask, 0, 0);
    state.composite = makeCanvas();
    const cc = state.composite.getContext('2d');
    cc.drawImage(state.photo, 0, 0);
    cc.drawImage(layer, 0, 0);
    $('result-info').textContent =
      `已生成一张 ${image.naturalWidth} × ${image.naturalHeight} 的 AI 结果。“AI 原始结果”用于检查模型表现；“选区内合成”把选区外换回原图，不代表模型本身没有改动原图。`;
  }
  status('真实试戴结果已返回。请检查图案位置、皮肤融合和照片是否保持。');
  draw();
}
async function billable(kind, action) {
  if (state.busy) return;
  state.busy = true;
  state.gesture = null;
  state.tempRegion = null;
  update();
  try {
    await action();
  } catch (error) {
    status(error.message, true);
  } finally {
    state.busy = false;
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
      JSON.stringify({ task: result.task, kind: 'render' })
    );
    $('resume-task').hidden = false;
    await waitForTask(result.task, 'render');
  });
$('resume-task').onclick = () =>
  billable('resume', async () => {
    if (!state.configured || $('access-token').value.length < 24)
      throw new Error('请输入预览测试访问口令。');
    const saved = JSON.parse(
      sessionStorage.getItem('try-on-lab-task') || 'null'
    );
    if (!saved) throw new Error('当前没有保存的测试任务。');
    await waitForTask(saved.task, saved.kind);
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
$('reset').onclick = () => {
  if (state.busy) {
    status('测试任务仍在 KIE 执行。请等待结果，避免重复提交。', true);
    return;
  }
  location.reload();
};
window.addEventListener('resize', update);
try {
  const response = await fetch(api, { cache: 'no-store' });
  const config = await response.json();
  state.configured = !!config.configured;
  $('configuration').dataset.ready = String(state.configured);
  $('configuration').textContent = state.configured
    ? 'Preview 测试服务已配置。使用测试口令解锁 AI 操作。'
    : '尚未配置 Preview 测试 Key 或口令。圈选和摆放可用，真实生成暂不可用。';
} catch {
  $('configuration').dataset.ready = 'false';
  $('configuration').textContent = '未连接测试服务。圈选和摆放仍可使用。';
}
$('resume-task').hidden = !sessionStorage.getItem('try-on-lab-task');
draw();
