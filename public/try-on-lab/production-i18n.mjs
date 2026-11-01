/** Explicit production copy. Saved names and prompts are never rewritten. */
const COPY = {
  功能: ['功能', 'Features'],
  可免费保存到当前浏览器: ['可免费保存到账户', 'Save to your account for free'],
  '请填写提示词并完成测试授权。': [
    '请填写提示词并登录已验证的账户。',
    'Enter a prompt and sign in with a verified account.',
  ],
  '请先上传照片、选择图案并完成测试授权。': [
    '请上传照片、选择图案并登录已验证的账户。',
    'Upload a photo, choose a design and sign in with a verified account.',
  ],
  '请输入预览测试访问口令。': [
    '生成服务暂时不可用，请稍后刷新重试。',
    'Generation is unavailable. Reload to retry later.',
  ],
  测试数据说明: ['数据保存说明', 'How your data is stored'],
  账户数据说明: ['账户数据说明', 'How your account data is handled'],
  账户积分: ['账户积分', 'Account credits'],
  查看积分价格: ['查看积分价格', 'See credit pricing'],
  '正在读取账户积分…': ['正在读取账户积分…', 'Loading account credits…'],
  '照片与结果保存在你的账户中，不会公开。': [
    '照片与结果保存在你的账户中，不会公开。',
    'Photos and results are saved to your account and stay private.',
  ],
  '设计与试戴历史保存在你的 TattooVis 账户中，可跨设备查看与复用。': [
    '设计与试戴历史保存在你的 TattooVis 账户中，可跨设备查看与复用。',
    'Designs and try-on history are saved to your TattooVis account, available across devices.',
  ],
  '生成设计消耗 1 积分；单张试戴按 1K / 2K / 4K 消耗 1 / 2 / 3 积分；上传、摆放、保存与复用免费。': [
    '生成设计消耗 1 积分；单张试戴按 1K / 2K / 4K 消耗 1 / 2 / 3 积分；上传、摆放、保存与复用免费。',
    'A design costs 1 credit; a single try-on costs 1 / 2 / 3 credits at 1K / 2K / 4K. Uploading, placing, saving and reusing are free.',
  ],
  '生成失败会退回本次积分；手动叠放属于普通叠图，AI 原始结果与局部融合结果会分别展示。': [
    '生成失败会退回本次积分；手动叠放属于普通叠图，AI 原始结果与局部融合结果会分别展示。',
    'Failed generations restore their credits. The manual overlay is a plain composite; the raw AI result and the local blend are shown separately.',
  ],
  '账户服务未就绪，稍后刷新重试': [
    '账户服务未就绪，稍后刷新重试',
    'account service is not ready yet — retry shortly',
  ],
  '积分不足，可在 Pricing 补充': [
    '积分不足，可在 Pricing 补充',
    'not enough credits — top up on Pricing',
  ],
  '任务仍在执行。请等待结果，避免重复提交。': [
    '任务仍在执行。请等待结果，避免重复提交。',
    'A task is still running. Wait for its result instead of resubmitting.',
  ],
  '正在处理任务，请勿重复提交。': [
    '正在处理任务，请勿重复提交。',
    'A task is in progress; do not submit another one.',
  ],
  '当前没有保存的任务。': [
    '当前没有保存的任务。',
    'There is no saved task right now.',
  ],
  '请填写提示词并完成账户登录。': [
    '请填写提示词并完成账户登录。',
    'Enter a prompt and sign in with a verified account.',
  ],
  '请先上传照片并选择图案。': [
    '请先上传照片并选择图案。',
    'Upload a photo and choose a design first.',
  ],
  '积分服务不可用。': [
    '积分服务不可用。',
    'The credit service is unavailable.',
  ],

  '图案和试戴历史仅保存在当前浏览器：不上传正式账户存储，也不跨设备或 Preview 地址同步。':
    [
      '图案与 AI 结果保存到账户，可跨设备查看。',
      'Designs and AI results are saved to your account across devices.',
    ],
  '成功生成才结算测试积分；保存与复用免费。测试积分没有购买或退款交易，AI 调用仍消耗 KIE 测试额度。':
    [
      '成功生成才结算积分；保存与复用免费，失败退回本次积分。',
      'Credits settle only after a successful generation; saving and reuse are free, and failures restore the credits used.',
    ],
  '手动叠放属于普通叠图；AI 原始结果与局部融合结果会分别展示。上传到 KIE 的测试文件是临时文件，请及时保存结果。':
    [
      '手动叠放属于普通叠图；AI 原始结果与局部融合结果会分别展示，请对比后再决定。',
      'The manual overlay is a plain composite; the raw AI result and the local blend are shown separately for comparison.',
    ],
  测试积分: ['账户积分', 'Account credits'],
  '正在读取测试积分…': ['正在读取账户积分…', 'Loading account credits…'],
  '模拟新账户赠送 3 credits。仅当前浏览器，清理浏览器数据或更换 Preview 地址后不会保留；与正式账户无关。':
    [
      '积分与账户同步。上传、保存、复用和手动摆放免费。',
      'Credits sync with your account. Uploading, saving, reuse and manual placement are free.',
    ],
  '描述一个新图案 · 1 测试 credit': [
    '描述一个新图案 · 1 积分',
    'Describe a design · 1 credit',
  ],
  '生成新图案 · 1 测试 credit': [
    '生成新图案 · 1 积分',
    'Create a design · 1 credit',
  ],
  '成功生成的图案会自动保存到“我的图案”，下次直接选择，不再重复扣设计积分。':
    [
      '成功生成的图案自动保存到账户，下次复用免费，不再重复扣积分。',
      'Generated designs are saved to your account for free reuse, without paying the design credit again.',
    ],
  '生成失败不扣测试积分；保存、复用和手动摆放免费。使用示例图案也免费。':
    [
      '生成失败退回本次积分。上传、保存和手动摆放免费。',
      'Failed generations restore the credits used. Uploading, saving and manual placement are free.',
    ],
  继续查看上次测试任务: ['继续查看任务', 'Resume saved task'],
  先继续查看上次测试任务: [
    '先继续查看账户任务',
    'Resume your pending account task',
  ],
  '请先继续查看上次测试任务，不要重复提交。': [
    '请先继续查看账户任务，不要重复提交。',
    'Resume your pending account task before submitting again.',
  ],
  '当前没有保存的测试任务。': [
    '当前没有待完成的任务。',
    'No pending task to resume.',
  ],
  '正在处理测试任务，请勿重复提交。': [
    '正在处理账户任务，请勿重复提交。',
    'Your task is processing. Avoid duplicate submissions.',
  ],
  补充测试积分: ['前往价格页购买积分', 'Get credits on the pricing page'],
  '完成 Preview 测试服务配置': [
    '等待生成服务恢复',
    'Wait for the generation service',
  ],
  '已复用保存的图案，不消耗测试积分。': [
    '已复用保存的图案，不消耗积分。',
    'Saved design reused for free.',
  ],
  '已保存到当前浏览器 · 复用免费': [
    '已保存到账户 · 复用免费',
    'Saved to your account · Free to reuse',
  ],
  '已保存 · 复用免费': [
    '已保存到账户 · 复用免费',
    'Saved to your account · Free to reuse',
  ],
  '试戴结果已免费保存到当前浏览器。': [
    '试戴结果已保存到账户历史。',
    'Result saved to your account history.',
  ],
  '正在提交一次 KIE 设计生成请求…': [
    '正在提交图案生成任务…',
    'Submitting your design…',
  ],
  '正在上传测试参考图片到 KIE…': [
    '正在保存参考图片…',
    'Saving reference images…',
  ],
  '正在提交一次 KIE 单张试戴请求…': [
    '正在提交试戴任务…',
    'Submitting your try-on…',
  ],
  'KIE 返回的原始图片': ['AI 原始图片', 'Original AI image'],
  '测试任务仍在 KIE 执行。请等待结果，避免重复提交。': [
    '任务仍在执行，请等待结果，避免重复提交。',
    'Your task is running. Wait for the result before submitting again.',
  ],
  'KIE 返回生成失败，已释放测试积分预留；不扣网站真实积分。': [
    '生成失败，本次使用的积分已按原账户记录退回。',
    'Generation failed. The credits used were restored to their original account grants.',
  ],
  '测试请求未成功，请检查 KIE 后台，勿反复提交。': [
    '请求未完成，请继续查看任务，避免重复提交。',
    'The request did not finish. Resume your task to avoid duplicate submissions.',
  ],
  '测试结果图片无法读取。请检查 KIE 后台或稍后继续查看。': [
    '暂时无法读取结果，请稍后继续查看账户任务。',
    'Could not load the result. Resume your account task later.',
  ],
  '测试参考图片超过 3MB，请使用较小图片。': [
    '参考图片超过 3MB，请使用较小图片。',
    'Reference image exceeds 3 MB. Use a smaller image.',
  ],
  '仍在等待 KIE。保留了任务编号，请稍后继续查看，不要重复生成。': [
    '任务仍在执行，已保存在账户中。请稍后继续查看，避免重复生成。',
    'Your task is saved to your account and is still running. Resume it later.',
  ],
};
export function productionCopy(source, english) {
  const normalized = source.trim().replace(/\s+/g, ' ');
  if (normalized.endsWith(' 本次未结算测试积分。'))
    return productionCopy(
      normalized.slice(0, -' 本次未结算测试积分。'.length),
      english
    );
  if (COPY[normalized]) return COPY[normalized][english ? 1 : 0];
  let match;
  if ((match = /^已准备好。成功后结算 (\d+) 积分，失败自动退回。$/.exec(normalized)))
    return `Ready. ${match[1]} credit${match[1] === '1' ? '' : 's'} settle after success; failures are returned automatically.`;
  if ((match = /^可用测试积分 (\d+) credits/.exec(normalized)))
    return english ? `Available credits: ${match[1]}` : `可用积分 ${match[1]}`;
  if ((match = /^(1K|2K|4K) · (\d+) 测试 credits?$/.exec(normalized)))
    return `${match[1]} · ${match[2]} ${english ? 'credits' : '积分'}`;
  if ((match = /^生成真实试戴效果 · (\d+) 测试 credits?$/.exec(normalized)))
    return english
      ? `Generate try-on · ${match[1]} credits`
      : `生成真实试戴效果 · ${match[1]} 积分`;
  if (
    (match =
      /^已准备好。成功后结算 (\d+) 测试 credits?，失败释放预留。不使用网站真实积分。$/.exec(
        normalized
      ))
  )
    return english
      ? `Ready. Uses ${match[1]} account credits. Failed generations restore the credits used.`
      : `已准备好。本次使用 ${match[1]} 账户积分；生成失败退回本次积分。`;
  if (/^(正在生成独立纹身设计|正在生成单张真实试戴)…/.test(normalized))
    return english
      ? 'Generating… Your task is saved to your account. You can leave and resume later on any device.'
      : '正在生成…任务已保存到账户，可离开并在任意设备继续查看。';
  if (
    (match =
      /^(图案已生成，但浏览器保存失败|效果已生成，但浏览器历史保存失败)：(.+)。/.exec(
        normalized
      ))
  )
    return english
      ? `Your result is saved on the server, but could not be loaded: ${match[2]}. Resume the task to retry.`
      : `结果已保存在服务器，暂时无法读取：${match[2]}。请继续查看任务重试。`;
  if (normalized.endsWith(' 本次未结算测试积分。'))
    return productionCopy(
      normalized.slice(0, -' 本次未结算测试积分。'.length),
      english
    );
  return undefined;
}
