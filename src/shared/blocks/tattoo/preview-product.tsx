import { Check } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import {
  previewNotice,
  studioUrl,
} from '@/config/preview/product';
import { Section } from '@/shared/types/blocks/landing';
import { Testimonials } from '@/themes/default/blocks/testimonials';

import { PreviewWorkflowCase } from './preview-workflow-case';
import { TattooGuideLinks } from './tattoo-guide-links';

const linkClass =
  'bg-primary text-primary-foreground inline-flex rounded-full px-7 py-3 text-sm font-medium';

export type PreviewPricingCard = {
  title?: string;
  price?: string;
  credits?: number;
  description?: string;
  label?: string;
  features?: string[];
};

export function PreviewBanner({ locale }: { locale: string }) {
  return (
    <aside
      role="note"
      className="bg-muted mt-14 border-b px-5 py-3 text-center text-sm leading-6 lg:mt-18"
    >
      {previewNotice(locale)}
    </aside>
  );
}

/**
 * Prominent welcome-offer block shared by both homes. It states the live
 * signup terms exactly: one 3-credit gift after email verification, no
 * re-grant on later sign-ins, per-operation costs, and no unlimited claims.
 */
function FreeCreditsBlock({
  locale,
  preview = false,
}: {
  locale: string;
  preview?: boolean;
}) {
  const zh = locale === 'zh';
  return (
    <section
      aria-labelledby="free-credits-heading"
      className="tattoo-container pb-4"
    >
      <div className="bg-card mx-auto max-w-3xl rounded-2xl border p-7 text-center sm:p-9">
        <h2
          id="free-credits-heading"
          className="text-foreground text-lg font-semibold sm:text-xl"
        >
          {zh
            ? '注册并验证邮箱，领取 3 个免费积分'
            : 'Get 3 free credits when you sign up'}
        </h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-base leading-7">
          {zh
            ? '新账户一次性赠送 3 积分，验证邮箱后即可使用；重复登录不会再次发放。生成一张 1K 设计消耗 1 积分，单张试戴按 1K / 2K / 4K 消耗 1 / 2 / 3 积分。上传、定位与复用设计始终免费；这是一次性积分，不是永久免费或无限生成。'
            : 'New accounts receive 3 credits once, usable after you verify your email; signing in again does not re-grant them. A 1K design costs 1 credit and a single try-on costs 1 / 2 / 3 credits at 1K / 2K / 4K. Uploading, positioning and reusing designs stay free — this is a one-time balance, not permanent free or unlimited generation.'}
        </p>
        {preview ? (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <a href={studioUrl(undefined, locale)} className={linkClass}>
                {zh ? '打开测试工作室' : 'Open the test studio'}
              </a>
              <a
                href={
                  zh
                    ? 'https://tattoovis.ink/zh/sign-up'
                    : 'https://tattoovis.ink/sign-up'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border px-7 py-3 text-sm"
              >
                {zh
                  ? '到正式站注册领取 ↗'
                  : 'Sign up on the live site ↗'}
              </a>
            </div>
            <p className="text-muted-foreground mt-4 text-sm leading-6">
              {zh
                ? 'Preview 工作室使用独立的测试积分（另附测试说明），不代表真实余额。'
                : 'The Preview studio uses separate test credits (see its own note); this is not a real balance.'}
            </p>
          </>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link href="/sign-up" className={linkClass}>
              {zh ? '注册领取 3 积分' : 'Sign up — get 3 free credits'}
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border px-7 py-3 text-sm"
            >
              {zh ? '查看积分价格' : 'See credit pricing'}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function HomeFaq({
  locale,
  preview = false,
}: {
  locale: string;
  preview?: boolean;
}) {
  const zh = locale === 'zh';
  const faqs = (
    preview
      ? zh
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
      : zh
        ? [
            [
              '如何使用积分？',
              '生成一张 1K 设计消耗 1 积分；单张 1K / 2K / 4K 试戴分别消耗 1 / 2 / 3 积分。上传、保存、复用与定位免费。生成前会显示费用。',
            ],
            [
              '设计和历史保存在哪里？',
              '设计库与试戴历史保存在你的账户中。登录后可查看、下载与复用已保存的设计，也可继续查看已有历史结果。',
            ],
            [
              '一次会生成几张试戴图片？',
              '新流程每次只生成一张试戴图片，位置由你自由调整。需要比较其他位置时，复用设计、调整位置，再提交一次试戴。',
            ],
            [
              '生成失败会怎样？',
              '生成失败后，本次操作消耗的积分会退还一次。购买退款请联系支持团队，部分退款人工处理。',
            ],
            [
              'AI 图片能直接作为纹身稿吗？',
              '结果是视觉参考。AI 可能改变皮肤、体型或背景；实际纹身前，请让专业纹身师确认线条、大小和位置。',
            ],
          ]
        : [
            [
              'How do credits work?',
              'One 1K design costs 1 credit. A single 1K / 2K / 4K try-on costs 1 / 2 / 3 credits. Uploading, saving, reusing and positioning are free. Review the cost before generating.',
            ],
            [
              'Where are my designs and history saved?',
              'Your design library and try-on history are saved to your account. Sign in to view, download and reuse saved designs, and revisit existing results.',
            ],
            [
              'How many placements does one task create?',
              'Each new try-on generates one image at your chosen position. Reuse the design, adjust its placement and submit another try-on to compare positions.',
            ],
            [
              'What happens if generation fails?',
              'The credits consumed for a failed operation are returned once. Contact support for purchase refund requests; partial refunds require manual handling.',
            ],
            [
              'Can I use the image as a tattoo stencil?',
              'Treat it as a visual reference. AI may change skin, body shape or background details. Ask a professional tattoo artist to review linework, size and placement.',
            ],
          ]
  ) as [string, string][];
  return (
    <section className="tattoo-section" aria-labelledby="home-faq-heading">
      <div className="tattoo-container">
        <div className="mx-auto max-w-3xl">
          <h2 id="home-faq-heading" className="tattoo-heading">
            {preview
              ? zh
                ? '测试前需要了解'
                : 'Before you try it'
              : zh
                ? '开始前需要了解'
                : 'Before you try it'}
          </h2>
          <div className="mt-8">
            {faqs.map(([question, answer]) => (
              <details key={question} className="border-b py-5">
                <summary className="cursor-pointer font-medium">
                  {question}
                </summary>
                <p className="text-muted-foreground mt-4 leading-7">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeSteps({
  locale,
  preview = false,
}: {
  locale: string;
  preview?: boolean;
}) {
  const zh = locale === 'zh';
  const steps = (
    preview
      ? zh
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
          ]
      : zh
        ? [
            [
              '01 / 设计',
              '上传或生成设计',
              '上传已有图案免费；也可以输入提示词，以 1 积分生成一张 1K 设计。成功生成后自动存入账户设计库。',
            ],
            [
              '02 / 定位',
              '在自己的照片上自由摆放',
              '上传照片，选择新设计或复用已保存设计，自由移动、缩放和旋转。上传、保存、复用与定位均免费。',
            ],
            [
              '03 / 试戴',
              '确认位置，生成单张效果',
              '每次试戴生成一张图片。1K / 2K / 4K 分别消耗 1 / 2 / 3 积分；生成前确认清晰度和费用。',
            ],
          ]
        : [
            [
              '01 / DESIGN',
              'Upload or create a design',
              'Upload an existing design free, or describe a new idea and generate one 1K design for 1 credit. Successful new designs save automatically to your account library.',
            ],
            [
              '02 / POSITION',
              'Place it freely on your photo',
              'Upload your photo and choose a new or saved design. Move, resize and rotate it. Uploading, saving, reusing and positioning designs are free.',
            ],
            [
              '03 / TRY ON',
              'Confirm placement. Generate one image.',
              'Each try-on creates one image. Choose 1K / 2K / 4K for 1 / 2 / 3 credits. Review resolution and cost before generating.',
            ],
          ]
  ) as [string, string, string][];
  return (
    <section
      id="features"
      className="tattoo-section scroll-mt-24"
      aria-labelledby="features-heading"
    >
      <div className="tattoo-container">
        <div className="max-w-2xl">
          <p className="tattoo-eyebrow">HOW IT WORKS</p>
          <h2 id="features-heading" className="tattoo-heading">
            {zh ? '三步完成：设计、定位、试戴' : 'Design, place, try on'}
          </h2>
          <p className="tattoo-section-body">
            {zh
              ? '每个环节独立计费：免费上传与摆放，只为设计与试戴生成付费，结果可长期复用。'
              : 'Each step stands on its own: upload and place for free, pay only to generate a design or try-on, and reuse what you saved.'}
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map(([number, title, body]) => (
            <article key={number} className="bg-card rounded-2xl border p-7">
              <p className="text-primary mb-5 text-xs tracking-widest">
                {number}
              </p>
              <h3 className="text-xl font-medium">{title}</h3>
              <p className="text-muted-foreground mt-4 leading-7">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeHero({
  locale,
  preview = false,
}: {
  locale: string;
  preview?: boolean;
}) {
  const zh = locale === 'zh';
  return (
    <section className="tattoo-hero">
      <div className="tattoo-container pt-12 pb-16 text-center sm:pt-16 md:pb-20">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          {zh ? '先设计，再自由定位试戴' : 'Design it. Place it. See it on you.'}
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-8">
          {zh
            ? '免费 AI 纹身生成器：上传或生成设计，在自己的照片上自由移动、缩放、旋转，再生成一张 AI 试戴效果。喜欢的设计可以保存，下次直接复用。'
            : 'A free AI tattoo generator try-on: upload or create a design, move, resize and rotate it on your own photo, then generate a single realistic AI try-on. Save designs you love and reuse them next time.'}
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
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          {preview
            ? zh
              ? '测试积分与正式账户余额分开；不提供真实购买。正式版注册验证邮箱赠送 3 积分的权益保持原规则。'
              : 'Test credits are separate from live balances; no real purchases. The live signup offer of 3 credits after email verification keeps its existing terms.'
            : zh
              ? '积分永不过期；已有账户余额保持不变。'
              : 'Credits never expire; existing account balances stay unchanged.'}
        </p>
      </div>
    </section>
  );
}

export function PreviewHome({
  locale,
  reviews,
}: {
  locale: string;
  reviews?: Section;
}) {
  return (
    <main>
      <HomeHero locale={locale} preview />
      <FreeCreditsBlock locale={locale} preview />
      <HomeSteps locale={locale} preview />
      <PreviewWorkflowCase locale={locale} />
      <TattooGuideLinks locale={locale} />
      {reviews && <Testimonials section={reviews} />}
      <HomeFaq locale={locale} preview />
    </main>
  );
}

export function ProductionHome({
  locale,
  reviews,
}: {
  locale: string;
  reviews?: Section;
}) {
  return (
    <main>
      <HomeHero locale={locale} />
      <FreeCreditsBlock locale={locale} />
      <HomeSteps locale={locale} />
      <PreviewWorkflowCase locale={locale} />
      <TattooGuideLinks locale={locale} />
      {reviews && <Testimonials section={reviews} />}
      <HomeFaq locale={locale} />
    </main>
  );
}

export function PreviewPricing({
  locale,
  cards,
}: {
  locale: string;
  cards: PreviewPricingCard[];
}) {
  const zh = locale === 'zh';
  const featuredIndex = Math.max(
    0,
    cards.findIndex((card) => card.label)
  );
  return (
    <main className="tattoo-section">
      <div className="tattoo-container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="tattoo-eyebrow">
            PREVIEW / {zh ? '价格草案' : 'PROPOSED PRICING'}
          </p>
          <h1 className="tattoo-heading">
            {zh
              ? '按操作使用积分，设计自由复用'
              : 'Credits per operation. Designs you can reuse.'}
          </h1>
          <p className="tattoo-section-body">
            {zh
              ? '仅展示拟议积分包，不提供真实购买。工作室使用独立测试积分，不扣真实余额。'
              : 'Proposed credit packs for testing only. No real purchases. The studio uses separate test credits, never live balances.'}
          </p>
        </div>
        <div className="mt-12 grid items-stretch gap-6 md:grid-cols-3">
          {cards.map((card, index) => (
            <article
              key={card.title}
              className={`bg-card flex flex-col rounded-2xl border p-7 ${
                index === featuredIndex
                  ? 'border-primary ring-primary/30 shadow-lg ring-2'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium">{card.title}</h2>
                {index === featuredIndex && card.label ? (
                  <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium">
                    {card.label}
                  </span>
                ) : null}
              </div>
              <p className="mt-5 text-4xl font-semibold">{card.price}</p>
              <p className="mt-2 text-base">
                {card.credits}{' '}
                {zh ? '积分（拟议）' : 'credits (proposed)'}
              </p>
              <p className="text-muted-foreground mt-4 text-sm leading-6">
                {card.description}
              </p>
              <ul className="mt-6 mb-8 space-y-3">
                {(card.features ?? []).map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check
                      size={17}
                      className="text-primary mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-sm leading-6">{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href={studioUrl(undefined, locale)}
                className={`${linkClass} mt-auto w-full`}
              >
                {zh ? '打开测试工作室' : 'Open the test studio'}
              </a>
            </article>
          ))}
        </div>
        <div className="bg-muted/40 mx-auto mt-10 max-w-2xl rounded-2xl border p-7 leading-8">
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
        <p className="text-muted-foreground mt-4 text-center text-sm">
          {zh
            ? '测试展示 · 购买未开放'
            : 'Preview only · Purchasing unavailable'}
        </p>
      </div>
    </main>
  );
}
