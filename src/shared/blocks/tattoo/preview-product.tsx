import { Link } from '@/core/i18n/navigation';
import { previewNotice, studioUrl } from '@/config/preview/product';
import { Section } from '@/shared/types/blocks/landing';
import {
  PricingCardData,
  PricingCards,
} from '@/shared/blocks/tattoo/pricing-cards';
import { Testimonials } from '@/themes/default/blocks/testimonials';

import { PreviewWorkflowCase } from './preview-workflow-case';
import { TattooGuideLinks } from './tattoo-guide-links';

const linkClass =
  'bg-primary text-primary-foreground inline-flex rounded-full px-7 py-3 text-sm font-medium';

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
  accountsEnabled = true,
}: {
  locale: string;
  preview?: boolean;
  accountsEnabled?: boolean;
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
            ? '新账户一次性赠送 3 积分，验证邮箱后即可使用；重复登录不会再次发放。生成一张 1K 设计消耗 1 积分，单张试戴按 1K / 2K / 4K 消耗 1 / 2 / 3 积分。上传、定位与复用设计始终免费——这是一次性积分，不是永久免费或无限生成。'
            : 'New accounts receive 3 credits once, usable after you verify your email; signing in again does not re-grant them. A 1K design costs 1 credit and a single try-on costs 1 / 2 / 3 credits at 1K / 2K / 4K. Uploading, positioning and reusing designs stay free — this is a one-time balance, not permanent free or unlimited generation.'}
        </p>
        {preview ? (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              {accountsEnabled ? (
                <Link href="/sign-up" className={linkClass}>
                  {zh ? '注册领取 3 积分' : 'Sign up — get 3 free credits'}
                </Link>
              ) : null}
              <a href={studioUrl(undefined, locale)} className="rounded-full border px-7 py-3 text-sm">
                {zh ? '打开工作室' : 'Open the studio'}
              </a>
            </div>
            <p className="text-muted-foreground mt-4 text-sm leading-6">
              {accountsEnabled
                ? zh
                  ? '预发环境使用隔离数据库中的账户与积分，与正式站数据完全隔离。'
                  : 'This Preview uses accounts and credits from an isolated database, fully separated from the live site.'
                : zh
                  ? '账户服务等待隔离的预发数据库配置（PREVIEW_STUDIO_ISOLATED），配置完成前暂不可注册。'
                  : 'Accounts are waiting for the isolated Preview database configuration (PREVIEW_STUDIO_ISOLATED); sign-up opens once it is set.'}
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

function HomeFaq({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  const faqs = (
    zh
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
            {zh ? '开始前需要了解' : 'Before you try it'}
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

function HomeSteps({ locale }: { locale: string }) {
  const zh = locale === 'zh';
  const steps = (
    zh
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
              ? '预发环境使用隔离数据库中的账户、积分与图片存储，与正式站完全隔离；购买暂未开放。'
              : 'This Preview keeps accounts, credits and image storage in an isolated database, fully separated from the live site; purchasing is not available yet.'
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
  accountsEnabled = true,
}: {
  locale: string;
  reviews?: Section;
  accountsEnabled?: boolean;
}) {
  return (
    <main>
      <HomeHero locale={locale} preview />
      <FreeCreditsBlock locale={locale} preview accountsEnabled={accountsEnabled} />
      <HomeSteps locale={locale} />
      <PreviewWorkflowCase locale={locale} />
      <TattooGuideLinks locale={locale} />
      {reviews && <Testimonials section={reviews} />}
      <HomeFaq locale={locale} />
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

export type { PricingCardData };

export function PreviewPricing({
  locale,
  cards,
}: {
  locale: string;
  cards: PricingCardData[];
}) {
  const zh = locale === 'zh';
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
              ? '预发环境暂不提供真实购买；积分与套餐规则与正式站一致。'
              : 'No real purchases in this Preview; credits and pack rules match the live site.'}
          </p>
        </div>
        <div className="mt-12">
          <PricingCards
            cards={cards}
            renderCta={() => (
              <a
                href={studioUrl(undefined, locale)}
                className={`${linkClass} w-full`}
              >
                {zh ? '打开工作室' : 'Open the studio'}
              </a>
            )}
          />
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
              ? '积分永不过期。积分包不承诺固定图片数量，总用量取决于操作和分辨率。设计与试戴历史保存在账户中，可跨设备查看。'
              : 'Credits never expire. Packs do not promise a fixed image count: usage depends on operations and resolution. Designs and try-on history are saved to your account across devices.'}
          </p>
        </div>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-sm leading-7">
          {zh
            ? '退款规则：全额退款完成后，仅自动收回该订单剩余未用积分；已用积分不追扣，不扣赠送积分或其他订单余额。部分退款人工处理。退款资格由支持团队另行审核。'
            : 'Refund rules: after a full refund, only that order’s remaining unused credits are recovered. Spent credits, gifts and other orders’ balances are not deducted. Partial refunds require manual handling, and support reviews refund eligibility separately.'}
        </p>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          {zh
            ? '预发展示 · 购买未开放'
            : 'Preview only · Purchasing unavailable'}
        </p>
      </div>
    </main>
  );
}
