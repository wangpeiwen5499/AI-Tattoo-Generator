/** Copy patch is applied only by the server request loader on Preview. */
export function previewFunnelCopy(locale: string): Record<string, string> {
  const zh = locale === 'zh';
  return {
    guestTitle: zh
      ? '先设计，再自由定位试戴'
      : 'Design first. Place freely. Try on once.',
    guestDescription: zh
      ? 'Preview 工作室使用独立测试积分。上传或复用设计，调整位置后生成单张试戴。'
      : 'The Preview studio uses separate test credits. Upload or reuse a design, then position it and generate one try-on image.',
    getCredits: zh
      ? '了解正式版 3 积分欢迎礼'
      : 'Live offer: 3 welcome credits',
    bonusExplanation: zh
      ? '正式版新账户一次性赠送 3 积分，验证邮箱后使用。Preview 测试积分独立于该权益：1K 设计 1 积分；单张 1K / 2K / 4K 试戴为 1 / 2 / 3 积分。'
      : 'Live accounts receive 3 credits once, usable after email verification. Preview test credits are separate: a 1K design costs 1 credit; one 1K / 2K / 4K try-on costs 1 / 2 / 3 credits.',
    signupBenefit: zh
      ? '正式账户欢迎礼为一次性 3 积分，需验证邮箱。Preview 工作室采用独立测试积分，设计与历史仅保存在当前浏览器，不与账户同步。'
      : 'The live welcome offer is 3 credits once, after email verification. Preview uses separate test credits; designs and history stay in this browser without account sync.',
    trialBalance: zh
      ? '测试：1K 设计 1 积分；单张 1K / 2K / 4K 试戴为 1 / 2 / 3 积分。'
      : 'Test rates: 1K design, 1 credit. Single 1K / 2K / 4K try-on, 1 / 2 / 3 credits.',
    resolutionOption: zh
      ? '{resolution}，单张试戴 {count} 测试积分'
      : '{resolution}, {count} test credits per single try-on',
    resolutionHelp: zh
      ? '每次生成一张试戴图片。设计单独生成，固定 1K、1 测试积分。上传、保存、复用与定位免费。'
      : 'Each try-on generates one image. Design generation is separate: 1K for 1 test credit. Uploading, saving, reusing and positioning are free.',
    noCreditsDescription: zh
      ? 'Preview 不提供真实购买。测试积分与真实账户余额独立，已保存的本机图片仍可浏览和下载。'
      : 'Preview offers no real purchases. Test credits are separate from live balances. Saved local images remain available to view and download.',
    buyCredits: zh ? '查看拟议积分规则' : 'View proposed credit rates',
  };
}
