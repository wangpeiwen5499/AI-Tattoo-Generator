import {
  previewNotice,
  previewPacks,
  studioUrl,
} from '@/config/preview/product';
import { Section } from '@/shared/types/blocks/landing';
import { Testimonials } from '@/themes/default/blocks/testimonials';

import { PreviewWorkflowCase } from './preview-workflow-case';
import { TattooGuideLinks } from './tattoo-guide-links';

const linkClass =
  'bg-primary text-primary-foreground inline-flex rounded-full px-7 py-3 text-sm font-medium';

export function PreviewBanner({ locale }: { locale: string }) {
  return (
    <aside
      role="note"
      className="bg-muted border-b px-5 py-3 text-center text-xs leading-6"
      style={{ marginTop: '4.5rem' }}
    >
      {previewNotice(locale)}
    </aside>
  );
}

export function PreviewHome({
  locale,
  reviews,
}: {
  locale: string;
  reviews?: Section;
}) {
  const zh = locale === 'zh';
  const steps = zh
    ? [
        [
          '01 / 设计',
          '上传或生成设计',
          '上传已有图案免费；也可以输入提示词，以 1 测试积分生成一张 1K 设计。成功生成后自动存入本机设计库。',
        ],
        [
          '02 / 定位',
          '在自己的照片上自由摆放',
          '上传照片，选择新设计或复用已保存设计，自由移动、缩放和旋转。上传、保存、复用与定位均免费。',
        ],
        [
          '03 / 试戴',
          '确认位置，生成单张效果',
          '每次试戴生成一张图片。1K / 2K / 4K 分别消耗 1 / 2 / 3 测试积分；生成前确认清晰度、费用和测试授权。',
        ],
      ]
    : [
        [
          '01 / DESIGN',
          'Upload or create a design',
          'Upload an existing design free, or describe a new idea and generate one 1K design for 1 test credit. Successful new designs save automatically to this browser’s library.',
        ],
        [
          '02 / POSITION',
          'Place it freely on your photo',
          'Upload your photo and choose a new or saved design. Move, resize and rotate it. Uploading, saving, reusing and positioning designs are free.',
        ],
        [
          '03 / TRY ON',
          'Confirm placement. Generate one image.',
          'Each try-on creates one image. Choose 1K / 2K / 4K for 1 / 2 / 3 test credits. Review resolution, cost and test consent before generating.',
        ],
      ];
  return (
    <main>
      <section className="mx-auto max-w-5xl px-5 pt-24 pb-20 text-center sm:pt-32">
        <p className="text-primary mb-5 text-xs tracking-widest">
          TATTOOVIS / PREVIEW STUDIO
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          {zh
            ? '先设计，再自由定位试戴'
            : 'Design it. Place it. See it on you.'}
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-8">
          {zh
            ? '上传或生成纹身设计，在自己的照片上自由移动、缩放、旋转，再生成一张 AI 试戴效果。喜欢的设计可以保存，下次直接复用。'
            : 'Upload or create a tattoo design, move, resize and rotate it on your own photo, then generate a single AI try-on. Save designs you love and reuse them next time.'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a href={studioUrl(undefined, locale)} className={linkClass}>
            {zh ? '打开自由定位工作室' : 'Open the placement studio'}
          </a>
          <a
            href="#tattoo-case"
            className="rounded-full border px-7 py-3 text-sm"
          >
            {zh ? '浏览历史案例' : 'Explore saved examples'}
          </a>
        </div>
        <p className="text-muted-foreground mt-5 text-xs leading-6">
          {zh
            ? '测试积分与正式账户余额分开；不提供真实购买。正式版注册验证邮箱赠送 3 积分的权益保持原规则。'
            : 'Test credits are separate from live balances; no real purchases. The live signup offer of 3 credits after email verification keeps its existing terms.'}
        </p>
      </section>
      <section
        id="features"
        className="mx-auto grid max-w-6xl gap-6 px-5 pb-20 md:grid-cols-3"
      >
        {steps.map(([number, title, body]) => (
          <article key={number} className="bg-card rounded-2xl border p-7">
            <p className="text-primary mb-5 text-xs tracking-widest">
              {number}
            </p>
            <h2 className="text-xl font-medium">{title}</h2>
            <p className="text-muted-foreground mt-4 text-sm leading-7">
              {body}
            </p>
          </article>
        ))}
      </section>
      <div className="px-5 pb-20">
        <PreviewWorkflowCase locale={locale} />
      </div>
      <TattooGuideLinks locale={locale} />
      {reviews && <Testimonials section={reviews} />}
      <section className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="mb-8 text-2xl">
          {zh ? '测试前需要了解' : 'Before you try it'}
        </h2>
        {(zh
          ? [
              [
                '会扣真实积分吗？',
                '不会。Preview 使用独立测试积分，不读取或扣除真实账户余额；AI 生成仍产生 KIE 测试费用，需要明确授权。',
              ],
              [
                '设计和历史保存在哪里？',
                '设计库与试戴历史仅保存在当前浏览器，不与账户或其他设备同步。清理浏览器数据会删除记录，请下载重要图片备份。',
              ],
              [
                '一次会生成几个部位？',
                '新流程每次只生成一张试戴图片，位置由你自由调整。需要比较其他位置时，复用设计、调整位置，再提交一次试戴。',
              ],
              [
                'AI 图片能直接作为纹身稿吗？',
                '结果是视觉参考。AI 可能改变皮肤、体型或背景；实际纹身前，请让专业纹身师确认线条、大小和位置。',
              ],
            ]
          : [
              [
                'Will this charge my real credits?',
                'No. Preview uses separate test credits and does not read or debit live balances. AI generation still incurs KIE test costs and requires explicit consent.',
              ],
              [
                'Where are my designs and history saved?',
                'The design library and try-on history stay in this browser, without account or device sync. Clearing browser data removes them. Download important images as backups.',
              ],
              [
                'How many placements does one task create?',
                'Each new try-on generates one image at your chosen position. Reuse the design, adjust its placement and submit another try-on to compare positions.',
              ],
              [
                'Can I use the image as a tattoo stencil?',
                'Treat it as a visual reference. AI may change skin, body shape or background details. Ask a professional tattoo artist to review linework, size and placement.',
              ],
            ]
        ).map(([question, answer]) => (
          <details key={question} className="border-b py-5">
            <summary className="cursor-pointer font-medium">{question}</summary>
            <p className="text-muted-foreground mt-4 text-sm leading-7">
              {answer}
            </p>
          </details>
        ))}
      </section>
    </main>
  );
}

export function PreviewPricing({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  return (
    <main className="mx-auto max-w-5xl px-5 pt-24 pb-20 text-center">
      <p className="text-primary text-xs tracking-widest">
        PREVIEW / {zh ? '价格草案' : 'PROPOSED PRICING'}
      </p>
      <h1 className="mt-5 text-4xl font-semibold">
        {zh
          ? '按操作使用积分，设计自由复用'
          : 'Credits per operation. Designs you can reuse.'}
      </h1>
      <p className="text-muted-foreground mt-5 leading-7">
        {zh
          ? '仅展示拟议积分包，不提供真实购买。工作室使用独立测试积分，不扣真实余额。'
          : 'Proposed credit packs for testing only. No real purchases. The studio uses separate test credits, never live balances.'}
      </p>
      <div className="my-10 grid gap-5 sm:grid-cols-3">
        {previewPacks.map((pack) => (
          <article key={pack.credits} className="rounded-2xl border p-7">
            <p className="text-3xl font-semibold">{pack.price}</p>
            <p className="mt-3">
              {pack.credits} {zh ? '积分（拟议）' : 'credits (proposed)'}
            </p>
            <p className="text-muted-foreground mt-4 text-xs">
              {zh
                ? '测试展示 · 购买未开放'
                : 'Preview only · Purchasing unavailable'}
            </p>
          </article>
        ))}
      </div>
      <div className="bg-muted/40 mx-auto max-w-2xl rounded-2xl border p-7 text-left leading-8">
        <h2 className="mb-4 text-xl font-medium">
          {zh ? '每项操作的积分' : 'Cost of each operation'}
        </h2>
        <p>
          {zh ? '生成设计：1K，1 积分。' : 'Generate a design: 1K, 1 credit.'}
        </p>
        <p>
          {zh
            ? '单张试戴：1K / 2K / 4K，分别 1 / 2 / 3 积分。'
            : 'Single-image try-on: 1K / 2K / 4K for 1 / 2 / 3 credits.'}
        </p>
        <p>
          {zh
            ? '上传、自由定位、保存与复用设计：免费。'
            : 'Upload, free placement, saving and reusing designs: free.'}
        </p>
        <p className="text-muted-foreground mt-4 text-sm">
          {zh
            ? '拟议规则：积分永不过期。积分包不承诺固定图片数量，总用量取决于操作和分辨率。设计与历史仅保存在当前浏览器，不与账户同步。'
            : 'Proposed rule: Credits never expire. Packs do not promise a fixed image count: usage depends on operations and resolution. Designs and history stay in this browser without account sync.'}
        </p>
      </div>
      <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-sm leading-7">
        {zh
          ? '拟议退款处理规则：全额退款完成后，仅自动收回该订单剩余未用积分；已用积分不追扣，不扣赠送积分或其他订单余额。部分退款人工处理。退款资格由支持团队另行审核，不能仅因积分部分使用而断言不支持全额退款。此规则尚未生效，历史已购权益另行确认。'
          : 'Draft refund handling: after a full refund, automatically recover only that order’s remaining unused credits. Do not claw back spent credits or deduct gifts or other orders’ balances. Partial refunds require manual handling. Support reviews refund eligibility separately; partial credit use alone does not determine full-refund eligibility. This rule is not live. Existing purchased entitlements need a separate decision.'}
      </p>
      <a href={studioUrl(undefined, locale)} className={`${linkClass} mt-8`}>
        {zh ? '打开测试工作室' : 'Open the test studio'}
      </a>
    </main>
  );
}
