# Tattoo resolution operations

## Contract

A task creates one tattoo design and four body previews at the same resolution. Default: 1K. The server charges 1 / 2 / 3 credits for 1K / 2K / 4K. Prices, package credit quantities, welcome grants and existing balances are unchanged. Credits may be mixed across resolutions.

`tattoo_project.resolution` and `credits_cost` are immutable task snapshots. Status, recovery and history read them. The server ignores client price claims; request IDs cannot be reused with another resolution. Failed tasks reverse their original consumption, with existing full-cash-refund protections retained.

## Deployment

Production `deploy:prepare` adds both snapshot columns with `IF NOT EXISTS` under a transaction lock. Existing projects receive 1K / 1; credit rows are never rewritten. An old deployment can continue operating during this additive migration. Re-running the upgrade preserves saved 2K/4K tasks.

## Provider and storage

The five KIE requests explicitly send `input.resolution`. Tattoo designs remain 1:1; body previews remain 3:4. The current [KIE model page](https://kie.ai/gpt-image-2) permits these aspect ratios at all three resolutions.

Task deadlines: 20 / 30 / 45 minutes. Stored output limits: 15 / 40 / 80 MiB per image. Photo uploads stay capped at 10 MiB. KIE reference inputs are limited to 30 MiB: only oversized designs are JPEG-compressed without resizing, then stored with the correct extension/type before body-preview submission. Smaller designs remain untouched. A design that cannot fit fails with the original charge reversed. Final body images retain their output limit.

Downloads stream from trusted storage origins with an 80 MiB hard limit, backpressure and cancellation. This avoids buffering a large PNG into a normal Vercel function response. Proxy runtime is 90 seconds; its upstream timeout is 60 seconds.

## Commercial copy

EN/ZH pricing, FAQ and signup explanations distinguish credits from complete preview sets. `docs/commerce/waffo-products.md` contains matching Waffo copy. Applying that text in the external Waffo dashboard remains a separate manual action. Existing product IDs, amounts and credit quantities are preserved.

## Verification limits

Automated tests use provider/storage doubles for billing and workflow behavior, plus a real local image encoder for reference compression. They do not incur paid KIE generation. A production provider smoke test should confirm actual delivered image dimensions and the account-specific provider charge; public KIE prices can differ from account rates.
