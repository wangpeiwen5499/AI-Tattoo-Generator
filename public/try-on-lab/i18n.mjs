import { productionCopy } from './production-i18n.mjs';

const EN = new Map(
  Object.entries({
    主导航: 'Main navigation',
    功能: 'Features',
    博客: 'Blog',
    价格: 'Pricing',
    工作室: 'Studio',
    历史记录: 'History',
    我的设计: 'My Designs',
    菜单: 'Menu',
    关闭: 'Close',
    语言: 'Language',
    试戴工作室: 'Try-on Studio',
    处理无任务编号的测试预留: 'Recover an untracked test reservation',
    'AI 结果改变了画面比例，已完整显示且未拉伸；与原图无法严格逐点对齐。':
      'The AI result changed the aspect ratio. It is shown without stretching, so exact point-by-point alignment is unavailable.',
    '拖动查看局部，滚轮或双指缩放；切换图片会保留缩放和查看位置。':
      'Drag to inspect, use the wheel or pinch to zoom. Switching images keeps the same zoom and viewing position.',
    处理未确认的测试任务预留: 'Resolve the unconfirmed test reservation',
    '这只释放没有任务编号的本地测试预留，不会取消可能已创建的 KIE 任务。请先检查 KIE 后台，避免重复付费提交。是否继续？':
      'This releases an untracked test reservation, but cannot cancel any KIE task already created. Check KIE first to avoid duplicate paid submissions. Continue?',
    '已释放无任务编号的测试预留。请检查 KIE 后台后再提交。':
      'The untracked test reservation was released. Check KIE before submitting again.',
    '请先继续查看上次测试任务，不要重复提交。':
      'Resume the previous test task before submitting another one.',
    先继续查看上次测试任务: 'Resume the previous test task',
    '当前有待完成的测试任务，请先继续查看或处理预留记录。':
      'A test task is pending. Resume it or recover its untracked reservation first.',
    '已恢复任务及当时的原图和摆放快照，可继续三图对比。当前编辑内容没有被替换。':
      'Restored this task with its original photo and placement snapshots for comparison. Your current edits were not replaced.',
    工作室导航: 'Studio navigation',
    我的图案: 'My designs',
    试戴历史: 'Try-on history',
    积分说明: 'Credit guide',
    'Preview · 本地保存 / 测试积分': 'Preview · Browser storage / Test credits',
    '先看见，再决定。': 'See it first. Make it yours.',
    '让一个纹身想法，在你的照片上成为可能。':
      'See your tattoo idea on your own photo.',
    重新开始: 'Start over',
    测试积分: 'Test credits',
    '正在读取测试积分…': 'Loading test credits…',
    '模拟新账户赠送 3 credits。仅当前浏览器，清理浏览器数据或更换 Preview 地址后不会保留；与正式账户无关。':
      'Start with 3 simulated credits. They belong to this browser only and are lost when you clear browser data or change Preview addresses. They are separate from your real account.',
    '免费补充 10 测试积分': 'Add 10 free test credits',
    试戴步骤: 'Try-on steps',
    上传照片: 'Upload a photo',
    选择或创作图案: 'Choose or create a design',
    在照片上摆放: 'Place it on your photo',
    生成与对比: 'Generate and compare',
    先上传一张部位照片: 'Upload a body photo first',
    '让想纹身的位置清晰可见，局部和侧面照片都可以。':
      'Show the area clearly. Close-up and side-view photos work too.',
    '让想纹身的位置清晰可见，局部和侧面照片都可以。也可先用示例体验。':
      'Show the area clearly. Close-up and side-view photos work too, or start with the sample.',
    照片工作区: 'Photo workspace',
    显示模式: 'View mode',
    原图编辑: 'Edit placement',
    查看原图: 'Original photo',
    'AI 原始结果': 'Original AI result',
    局部融合结果: 'Locally blended result',
    '本地叠图，尚未进行 AI 渲染':
      'Local overlay · AI rendering has not run yet',
    纹身深浅: 'Ink intensity',
    浅淡: 'Light',
    浓黑: 'Dark',
    完成: 'Done',
    收起深浅调节: 'Close ink adjustment',
    '在原图上拖动纹身，使用控制柄或双指缩放和旋转；长按或右键打开纹身菜单':
      'Drag the tattoo on the photo. Resize and rotate with handles or two fingers. Long-press or right-click for tattoo actions.',
    纹身操作: 'Tattoo actions',
    水平翻转: 'Flip horizontally',
    恢复初始摆放: 'Reset placement',
    移除纹身: 'Remove tattoo',
    '你的照片，就是试戴画布': 'Your photo. Your tattoo canvas.',
    '手臂、肩背、小腿或其他清晰可见的部位。':
      'Use a clear photo of your arm, back, calf, or another area.',
    '正面、侧面、局部照片都可以。':
      'Front, side, and close-up photos all work.',
    上传部位照片: 'Upload a body photo',
    先用示例体验: 'Try a sample first',
    '照片在点击真实生成前只留在本机浏览器中。':
      'Your photo stays in this browser until you choose AI generation.',
    当前纹身状态: 'Current tattoo placement',
    '⊞ 放大查看 · 三图对比': '⊞ Inspect · Compare three views',
    免费保存到历史: 'Save to history · Free',
    '↓ 下载当前图': '↓ Download current image',
    你的照片: 'Your photo',
    '选择 / 更换照片': 'Choose / Replace photo',
    '上传照片后选择图案，直接在照片上调整。无需圈选区域。':
      'Upload a photo, choose a design, and adjust it directly on the photo. No area selection needed.',
    你的纹身: 'Your tattoo',
    选择图案来源: 'Choose a design source',
    上传图案: 'Upload design',
    生成新图案: 'Create a design',
    当前纹身图案: 'Current tattoo design',
    还没有选择图案: 'No design selected yet',
    '选好即放进照片，可拖动到想纹身的位置。':
      'Your design appears on the photo. Drag it to your preferred spot.',
    免费保存图案: 'Save design · Free',
    下载图案: 'Download design',
    使用几何狼头示例: 'Use geometric wolf sample',
    '描述一个新图案 · 1 测试 credit': 'Describe a design · 1 test credit',
    '主题 + 风格 + 构图，例如：黑灰几何狼头，细线和点刺，纵向构图':
      'Subject + style + composition, e.g. a black-and-gray geometric wolf, fine lines and dotwork, vertical layout',
    '生成新图案 · 1 测试 credit': 'Create a design · 1 test credit',
    '成功生成的图案会自动保存到“我的图案”，下次直接选择，不再重复扣设计积分。生成失败不扣测试积分；保存、复用和手动摆放免费。使用狼头示例也免费。':
      'Successful designs are saved to My designs automatically. Reuse them without another design charge. Failed generation costs no test credits. Saving, reuse, manual placement, and the wolf sample are free.',
    看它融入皮肤: 'See it on your skin',
    '先在照片上确认位置、大小和深浅，再生成一张试戴图。AI 会尝试贴合皮肤，结果需检查是否改动原照片。':
      'Set the position, size, and ink intensity, then generate a try-on. AI will try to match your skin; check whether it changed the original photo.',
    试戴分辨率与费用: 'Try-on resolution and cost',
    测试授权: 'Test authorization',
    生成前需完成: 'Complete before generating',
    预览测试访问口令: 'Preview test access token',
    '仅测试口令，不是 KIE API Key': 'Test access token only, not a KIE API key',
    '正在检查预览环境配置…': 'Checking Preview configuration…',
    重新检查配置: 'Check configuration again',
    '我同意将测试图片传给 KIE。AI 生成会消耗 KIE 测试额度，不扣网站积分。':
      'I agree to send test images to KIE. AI generation uses the KIE test quota, not my website credits.',
    生成真实试戴效果: 'Generate AI try-on',
    继续查看上次测试任务: 'Resume previous test task',
    '图案和试戴历史保存在当前浏览器，不会上传至正式账户存储，也不跨设备或 Preview 地址同步。成功生成才结算测试积分，保存与复用免费。测试积分没有购买或退款交易；AI 调用仍消耗 KIE 测试额度。手动叠放属于普通叠图；AI 原始结果和局部融合结果会分别展示。上传到 KIE 的测试文件是临时文件，请及时保存结果。':
      'Designs and try-on history are stored in this browser, separate from your real account. They do not sync across devices or Preview addresses. Test credits are charged only for successful generation; saving and reuse are free. Test credits involve no purchases or refunds. AI calls still use the KIE test quota. Manual placement is a simple overlay. Original AI results and locally blended results are shown separately. Files uploaded to KIE are temporary, so save your results promptly.',
    三图对比: 'Compare three views',
    '同一位置，看看变化': 'Same position. See the difference.',
    '↓ 下载 AI 结果': '↓ Download AI result',
    关闭: 'Close',
    对比图片: 'Comparison image',
    '① 原图': '① Original photo',
    '② 手动叠放': '② Manual overlay',
    '③ AI 生成结果': '③ AI result',
    缩放: 'Zoom',
    适应窗口: 'Fit to window',
    实际像素: 'Actual pixels',
    '拖动查看局部，滚轮或双指缩放；切换图片会保留查看位置。':
      'Drag to inspect details; use the wheel or pinch to zoom. Switching images keeps your viewing position.',
    '大图细节，可滚动或拖动查看': 'Image details. Scroll or drag to inspect.',
    纹身对比大图: 'Enlarged tattoo comparison',
    '正在生成真实效果…': 'Generating your try-on…',
    '正在创作图案…': 'Creating your design…',
    '正在处理测试任务，请勿重复提交。':
      'A test task is running. Please do not submit it again.',
    上传一张部位照片: 'upload a body photo',
    选择一个纹身图案: 'choose a tattoo design',
    选择纹身图案: 'choose a tattoo design',
    检查预览测试配置: 'check Preview configuration',
    '完成 Preview 测试服务配置': 'complete Preview test service configuration',
    '在本页输入至少 24 个字符的测试访问口令':
      'enter a test access token with at least 24 characters on this page',
    '勾选同意调用 KIE': 'agree to the KIE call',
    补充测试积分: 'add test credits',
    正在创作你的纹身图案: 'Creating your tattoo design',
    '无需重复提交。图案准备好后，就可以在照片上拖动摆放。':
      'Please do not submit again. When your design is ready, drag it into place on your photo.',
    正在生成真实效果: 'Generating your AI try-on',
    '无需再次点击。结果返回后可对比原图、手动叠放和 AI 效果。':
      'No need to click again. When ready, compare the original photo, manual overlay, and AI result.',
    '生成完成，放大对比一下': 'Your result is ready. Compare the details.',
    '点击「三图对比」检查位置和皮肤细节，确认满意后下载 AI 结果。返回编辑并调整摆放将清除本次对比，请先保存。':
      'Open Compare three views to check placement and skin details, then download the AI result. Editing placement clears this comparison, so save it first.',
    '接下来，选一个纹身图案': 'Next, choose a tattoo design',
    '上传已有图案，或点击狼头示例。想要新的设计？填写主题、风格和构图后生成。':
      'Upload a design or try the wolf sample. For something new, describe the subject, style, and composition.',
    在照片上摆放到你想纹的位置: 'Place it where you want your tattoo',
    '拖动图案移动；右下角缩放，上方旋转；点击「深浅」调节浓淡。手机可双指缩放旋转。满意后点击「生成真实试戴效果」。':
      'Drag to move; resize from the lower-right corner and rotate from above. Tap Ink to adjust intensity. On mobile, pinch to resize and rotate. When ready, generate your AI try-on.',
    已准备好: 'Ready',
    展开完成授权: 'Expand to authorize',
    'KIE 返回的原始图片': 'Original image returned by KIE',
    'AI 结果在纹身附近局部融合，其他位置保留原图':
      'AI is blended around the tattoo; the rest uses your original photo',
    '你上传的照片（不显示纹身）': 'Your uploaded photo, without the tattoo',
    '拖动图案移动 · 右下角缩放 · 上方旋转 · 点击或上下拖动「深浅」调浓淡。长按 / 右键可翻转、重置和移除。':
      'Drag to move · Resize at the lower right · Rotate above · Tap or drag Ink vertically to adjust intensity. Long-press / right-click to flip, reset, or remove.',
    '照片已准备好。选择纹身图案，即可直接在原图上调整。':
      'Your photo is ready. Choose a tattoo design to adjust it on the photo.',
    '已保存 · 复用免费': 'Saved · Free to reuse',
    可免费保存到当前浏览器: 'Save to this browser for free',
    '已保存到当前浏览器 · 复用免费': 'Saved in this browser · Free to reuse',
    '已自动保存 · 下次复用免费':
      'Saved automatically · Free to reuse next time',
    '已复用保存的图案，不消耗测试积分。':
      'Saved design loaded. No test credits used.',
    '已免费补充 10 测试积分，不产生购买交易。':
      'Added 10 free test credits. No purchase was made.',
    '图案已免费保存。': 'Design saved for free.',
    '试戴结果已免费保存到当前浏览器。':
      'Try-on result saved to this browser for free.',
    '真实试戴结果已返回。请检查图案位置、皮肤融合和照片是否保持。':
      'Your AI try-on is ready. Check placement, skin blending, and whether the photo was preserved.',
    '正在提交一次 KIE 设计生成请求…': 'Submitting one KIE design request…',
    '正在上传测试参考图片到 KIE…': 'Uploading test reference images to KIE…',
    '正在提交一次 KIE 单张试戴请求…': 'Submitting one KIE try-on request…',
    '测试任务仍在 KIE 执行。请等待结果，避免重复提交。':
      'The test task is still running on KIE. Wait for the result to avoid duplicate submissions.',
    'Preview 测试服务已配置。请在上方输入对应的测试访问口令。':
      'Preview test service is configured. Enter the matching test access token above.',
    '未连接测试服务。请稍后重新检查。':
      'Test service is unavailable. Check again later.',
    '测试接口返回了登录页面。请先完成 Vercel 访问验证，再重新检查。':
      'The test endpoint returned a login page. Complete Vercel access verification, then check again.',
    '此部署未启用测试接口，请使用最新 Preview 地址。':
      'This deployment has no test endpoint. Use the latest Preview address.',
    '图片无法读取，请换一张 PNG、JPG 或 WebP。':
      'Could not read this image. Try a PNG, JPEG, or WebP file.',
    '请选择 10MB 以内的 PNG、JPG 或 WebP 图片。':
      'Choose a PNG, JPEG, or WebP image under 10 MB.',
    '请填写提示词并完成测试授权。':
      'Enter a prompt and complete test authorization.',
    '已找回 AI 原始结果。刷新后需重新上传原图才能重新验证局部合成。':
      'Recovered the original AI result. After refreshing, upload the original photo again to verify local blending.',
    '已找回 AI 原始结果，可放大查看。原照片或摆放状态已改变，无法与当前编辑状态对比，未创建局部融合结果。':
      'Recovered the original AI result for inspection. The photo or placement has changed, so it cannot be compared with the current edit. No locally blended result was created.',
    '模型改变了画面比例。本次只展示 AI 原始结果，没有拉伸或合成到原图。请检查位置和构图。':
      'The model changed the aspect ratio. Only the original AI result is shown, without stretching or blending. Check placement and composition.',
    深浅: 'Ink',
    手动预览: 'Manual preview',
    原图: 'Original photo',
    'AI 结果': 'AI result',
    融合结果: 'Blended result',
    'KIE_LAB_API_KEY 或 KIE_LAB_ACCESS_TOKEN（至少 24 个字符）':
      'KIE_LAB_API_KEY or KIE_LAB_ACCESS_TOKEN (at least 24 characters)',
    上传的纹身设计: 'Uploaded tattoo design',
    几何狼头示例: 'Geometric wolf sample',
    'AI 生成的纹身设计': 'AI-generated tattoo design',
    '测试积分不可用。': 'Test credits are unavailable.',
    '测试请求未成功，请检查 KIE 后台，勿反复提交。':
      'The test request failed. Check your KIE dashboard before submitting again.',
    '图片导出失败。': 'Image export failed.',
    '测试参考图片超过 3MB，请使用较小图片。':
      'The test reference image exceeds 3 MB. Choose a smaller image.',
    '测试结果图片无法读取。请检查 KIE 后台或稍后继续查看。':
      'Could not read the result image. Check your KIE dashboard or resume later.',
    正在生成独立纹身设计: 'Generating a standalone tattoo design',
    正在生成单张真实试戴: 'Generating one AI try-on image',
    'KIE 返回生成失败，已释放测试积分预留；不扣网站真实积分。':
      'KIE reported a generation failure. Reserved test credits were released; your website credits were not charged.',
    '图案已生成并自动保存，可反复免费复用。确认位置后再单独生成真实试戴效果。':
      'Your design was generated and saved automatically. Reuse it for free, then generate a separate try-on after placing it.',
    '单张试戴已生成并保存到试戴历史。可放大对比、下载，或复用同一图案换个位置。':
      'Your try-on was generated and saved to history. Inspect, compare, download, or reuse the design in another position.',
    '仍在等待 KIE。保留了任务编号，请稍后继续查看，不要重复生成。':
      'Still waiting for KIE. Your task ID is saved. Resume later instead of generating again.',
    '图案库已满，请先下载并删除不需要的图案，再生成新图案。':
      'Your design library is full. Download and delete unneeded designs before generating another.',
    '请先上传照片、选择图案并完成测试授权。':
      'Upload a photo, choose a design, and complete test authorization first.',
    '试戴历史已满，请先下载并删除不需要的结果，再生成。':
      'Your try-on history is full. Download and delete unneeded results before generating another.',
    '请输入预览测试访问口令。': 'Enter your Preview test access token.',
    '当前没有保存的测试任务。': 'There is no saved test task to resume.',
  })
);

const normalize = (value) => value.replace(/\s+/g, ' ').trim();

/** Explicit opt-in localization only. data-i18n translates textContent;
 * data-i18n-placeholder / data-i18n-aria-label / data-i18n-alt translate those
 * attributes. User input values and unmarked nodes are never changed.
 */
export function createStudioI18n(
  locale = new URLSearchParams(globalThis.location?.search || '').get('lang') ||
    'zh',
  { account = false } = {}
) {
  const english = String(locale).toLowerCase().startsWith('en');
  function t(message) {
    if (typeof message !== 'string') return message;
    if (account) {
      const copy = productionCopy(message, english);
      if (copy !== undefined) return copy;
    }
    if (!english) return message;
    const source = normalize(message);
    if (EN.has(source)) return EN.get(source);
    let match;
    if ((match = /^可用测试积分 (\d+) credits(?: · 预留 (\d+))?$/.exec(source)))
      return `Available test credits: ${match[1]}${match[2] ? ` · Reserved: ${match[2]}` : ''}`;
    if ((match = /^生成真实试戴效果 · (\d+) 测试 credits?$/.exec(source)))
      return `Generate try-on · ${match[1]} test credit${match[1] === '1' ? '' : 's'}`;
    if ((match = /^(1K|2K|4K) · (\d+) 测试 credits?$/.exec(source)))
      return `${match[1]} · ${match[2]} test credit${match[2] === '1' ? '' : 's'}`;
    if (
      (match = /^大小 ([\d.]+)% · 旋转 (-?[\d.]+)° · 深浅 ([\d.]+)%$/.exec(
        source
      ))
    )
      return `Size ${match[1]}% · Rotation ${match[2]}° · Ink ${match[3]}%`;
    if ((match = /^还需完成：(.+)。$/.exec(source)))
      return `Still needed: ${match[1]
        .split('；')
        .map((part) =>
          t(part).replace(/^[A-Z]/, (letter) => letter.toLowerCase())
        )
        .join('; ')}.`;
    if (
      (match =
        /^已准备好。成功后结算 (\d+) 测试 credits?，失败释放预留。不使用网站真实积分。$/.exec(
          source
        ))
    )
      return `Ready. ${match[1]} test credit${match[1] === '1' ? ' is' : 's are'} charged on success; failed tasks release the reservation. Your website credits are not used.`;
    if ((match = /^↓ 下载(手动预览|原图|AI 结果|融合结果)$/.exec(source)))
      return `↓ Download ${{ 手动预览: 'manual preview', 原图: 'original photo', 'AI 结果': 'AI result', 融合结果: 'blended result' }[match[1]]}`;
    if ((match = /^测试积分不可用：(.+)$/.exec(source)))
      return `Test credits unavailable: ${match[1]}`;
    if (
      (match =
        /^(正在生成独立纹身设计|正在生成单张真实试戴)… (?:\\n)?可离开此页，回来后输入测试口令并点击继续查看。$/.exec(
          source
        ))
    )
      return `${t(match[1])}… You can leave this page and return later. Enter the test token and resume the saved task.`;
    if (source.endsWith(' 本次未结算测试积分。'))
      return `${t(source.slice(0, -' 本次未结算测试积分。'.length))} No test credits were charged for this attempt.`;
    if ((match = /^图案未保存：(.+)。可以先下载图案。$/.exec(source)))
      return `Design was not saved: ${match[1]}. Download the design to keep a copy.`;
    if ((match = /^试戴历史未保存：(.+)。请先下载结果。$/.exec(source)))
      return `History was not saved: ${match[1]}. Download your result first.`;
    if (
      (match =
        /^图案已生成，但浏览器保存失败：(.+)。请先下载图案，稍后可免费重试保存。$/.exec(
          source
        ))
    )
      return `Your design was generated, but browser storage failed: ${match[1]}. Download it first. Saving can be retried for free.`;
    if (
      (match =
        /^效果已生成，但浏览器历史保存失败：(.+)。请下载或重试保存。$/.exec(
          source
        ))
    )
      return `Your result was generated, but saving history failed: ${match[1]}. Download it or retry saving.`;
    if ((match = /^已生成一张 (\d+) × (\d+) 的 AI 结果。.+$/.exec(source)))
      return `Generated an AI result at ${match[1]} × ${match[2]}. Use Original AI result to inspect the model output. The locally blended result restores the original photo outside the tattoo area; this does not mean the model left the photo unchanged.`;
    if (
      (match =
        /^当前部署配置不完整：(.+)。请在 Vercel Preview 环境配置后重新部署，旧部署不会自动读取新增变量。$/.exec(
          source
        ))
    )
      return `Deployment configuration is incomplete: ${match[1].replace('（至少 24 个字符）', ' (at least 24 characters)')}. Set these in the Vercel Preview environment and redeploy. Existing deployments do not pick up new variables automatically.`;
    return message;
  }

  function apply() {
    document.documentElement.lang = english ? 'en' : 'zh-CN';
    document.title = account
      ? english
        ? 'TattooVis · Try-on Studio'
        : 'TattooVis · 试戴工作室'
      : english
        ? 'TattooVis · Try-on Studio Preview'
        : 'TattooVis · 定点试戴预览';
    for (const node of document.querySelectorAll('[data-i18n]'))
      node.textContent = t(node.getAttribute('data-i18n'));
    for (const attr of ['placeholder', 'aria-label', 'alt']) {
      for (const node of document.querySelectorAll(`[data-i18n-${attr}]`))
        node.setAttribute(attr, t(node.getAttribute(`data-i18n-${attr}`)));
    }
  }

  return { t, apply };
}
