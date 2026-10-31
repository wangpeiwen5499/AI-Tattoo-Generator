# DRAFT — credit product transition copy

Status: review copy only, October 31, 2026. Do not publish to Waffo, change merchant products, send mail, enable purchasing or apply these terms to existing purchases. Preview uses a browser-local prototype library/history and separate simulated credits. Actual KIE test requests still incur provider costs after explicit consent. No production balances, orders, subscriptions, database or R2 resources are changed by this draft.

## Waffo product description drafts

| Price  | Credits | English display name   | Chinese display name |
| ------ | ------- | ---------------------- | -------------------- |
| $4.99  | 5       | TattooVis — 5 credits  | TattooVis — 5 积分   |
| $14.99 | 20      | TattooVis — 20 credits | TattooVis — 20 积分  |
| $29.99 | 50      | TattooVis — 50 credits | TattooVis — 50 积分  |

Shared English description: “Credits for TattooVis design generation and single-image try-ons. A 1K design costs 1 credit. Each single-image try-on costs 1 credit at 1K, 2 at 2K or 3 at 4K. Uploading, positioning, saving and reusing designs are free. Total image output depends on the operations and resolutions you choose; this pack does not promise a fixed image count.”

统一中文说明：“积分可用于 TattooVis 设计生成与单张试戴。生成一张 1K 设计消耗 1 积分；单张 1K、2K、4K 试戴分别消耗 1、2、3 积分。上传、定位、保存与复用设计免费。可生成图片的总数量取决于所选操作与分辨率，本积分包不承诺固定图片数量。”

## Refund policy draft

English: “Support reviews refund eligibility separately under the applicable purchase terms. Partial credit use alone does not determine eligibility for a full refund. After a full refund is completed, automatically recover only that order’s remaining unused credits. Do not claw back spent credits or deduct welcome gifts or other orders’ balances. Partial refunds require manual handling; no automatic credit recovery is applied to a partial refund. Existing purchases retain their applicable purchase terms until any separate transition is explicitly confirmed. This draft does not amend existing purchased entitlements.”

中文：“退款资格由支持团队按适用购买条款另行审核，不能仅因积分部分使用而断言不支持全额退款。全额退款完成后，仅自动收回该订单剩余未用积分；已用积分不追扣，不扣欢迎赠送积分或其他订单余额。部分退款人工处理，不自动执行积分回收。既有购买在另行明确确认迁移方案前，保持其原购买条款。此草案不修改历史已购权益。”

Operational review before launch: identify the refunded order’s remaining unused credits, preserve the transaction/usage audit record, and agree on manual partial-refund handling and separate eligibility review. Recovery must be limited to the refunded order’s remaining unused credits, even when that number is zero. Do not apply new rates or refund language retroactively to legacy orders.

## Purchase confirmation email draft

Subject: Your TattooVis credits are ready / 你的 TattooVis 积分已到账

English:

Thank you for your purchase. Your purchased credits are available in your TattooVis account.

Generate one 1K design for 1 credit. Each single-image try-on costs 1 / 2 / 3 credits at 1K / 2K / 4K. Uploading, positioning, saving and reusing a design are free. Your credit pack does not promise a fixed image count.

Support reviews refund eligibility separately under the applicable purchase terms. After a completed full refund, only that order’s remaining unused credits are automatically recovered. Spent credits are not clawed back, and gifts or other orders’ balances are not deducted. Partial refunds require manual handling. Contact support@tattoovis.ink with your order reference for help. Existing purchased entitlements follow their applicable purchase terms.

中文：

感谢购买。你购买的积分现已存入 TattooVis 账户。

生成一张 1K 设计消耗 1 积分；单张 1K / 2K / 4K 试戴分别消耗 1 / 2 / 3 积分。上传、定位、保存与复用设计免费。积分包不承诺固定图片数量。

退款资格由支持团队按适用条款另行审核。全额退款完成后，仅自动收回该订单剩余未用积分；已用积分不追扣，不扣赠送积分或其他订单余额。部分退款人工处理。如需帮助，请将订单编号发送至 support@tattoovis.ink。历史已购权益遵循其适用购买条款。

## Full-refund confirmation email draft

Subject: Your TattooVis full refund is complete / 你的 TattooVis 全额退款已完成

English: “Your full refund for order [order reference] is complete. We recovered [remaining unused credits recovered] remaining unused credits from that order. [credits already used] credits had already been used; we have not clawed them back or deducted credits from welcome gifts or other orders. If the order had no unused credits remaining, the recovered count is zero. Contact support@tattoovis.ink with your order reference if you need help.”

中文：“订单 [订单编号] 的全额退款已完成。已收回该订单剩余未用积分 [收回数量]；此前已使用的 [已用数量] 积分不追扣，也未扣除欢迎赠送积分或其他订单余额。若该订单已无剩余未用积分，收回数量为零。如需帮助，请将订单编号发送至 support@tattoovis.ink。”

## Welcome email draft

Subject: Welcome to TattooVis / 欢迎使用 TattooVis

English: “Your live account receives a one-time welcome gift of 3 credits, usable after email verification. Signing in again does not refill it. Preview test credits are separate from this live balance. In the Preview studio, one 1K design costs 1 test credit and a single 1K / 2K / 4K try-on costs 1 / 2 / 3 test credits. Uploading, saving, reusing and positioning are free. Preview designs and try-on history stay in the current browser, without account sync; download important images as a backup. No real purchases are available in Preview.”

中文：“正式账户一次性获得 3 积分欢迎礼，验证邮箱后可使用，重新登录不会补充。Preview 测试积分与该真实余额分开。在 Preview 工作室中，1K 设计消耗 1 测试积分，单张 1K / 2K / 4K 试戴分别消耗 1 / 2 / 3 测试积分。上传、保存、复用与定位免费。Preview 设计与试戴历史仅保存在当前浏览器，不与账户同步；请下载重要图片备份。Preview 不提供真实购买。”

## Rollout checklist — not authorization to execute

- Verify English and Chinese pricing, operation costs, welcome copy, purchase confirmation and refund text together.
- Decide separately how legacy purchased credits/entitlements retain their original rights; do not silently reprice old purchases.
- Approve the actual billing ledger rules, success/failure charging and payment product configuration before enabling real purchases.
- Confirm persistence resources and privacy/retention terms before describing a design library as account-synced or durable across devices.
- Replace Preview-only language only after production scope and live rates are approved.
- Obtain explicit publication/sending authorization before merchant changes, policy publication or email delivery. This file is the review artifact only.

## Provider cost revalidation gate

The parent review found the [KIE GPT Image 2 pricing page](https://kie.ai/gpt-image-2) lists 6 / 10 / 16 provider credits per image for 1K / 2K / 4K, differing from the earlier 3 / 5 / 8 estimate. Revalidate the live provider quote and actual billed test usage before approving margins or production billing. Provider credits and TattooVis platform credits are separate units. The approved proposed platform rates remain 1 credit per 1K design and 1 / 2 / 3 credits per single 1K / 2K / 4K try-on; this note does not authorize a rate or merchant change.

上游成本需复核：上述 KIE 页面在主任务核查时列出 1K / 2K / 4K 每张 6 / 10 / 16 上游积分，与此前 3 / 5 / 8 的估算不同。上线前应复核当前报价与实际测试扣费，再确认毛利和正式计费。上游积分与平台积分不是同一单位；已批准的平台拟议操作费率保持不变。
