# Homepage visual refresh

User scope: remove ShipAny attribution and GitHub from the footer, add a website image, reference Songtailor typography, redesign features as cards and make testimonials scroll.

## Design decisions

- Inspected the reference site's computed styles in the browser: body uses Georgia / Times New Roman / serif, headings use Georgia at weight 400. Use the same system serif approach, with Chinese serif fallbacks; keep a system monospace stack for prompts/code. Remove unused Google font loaders.
- Preserve existing light/dark theme colors. New feature cards use ink #29243c, paper #ffffff, pale text #f3effb, and lavender #d0c0f4.
- Six features form a 2+1 / 1+1+1 / full-width layout on desktop, then collapse to one column on phones. The first card includes the site's actual geometric-wolf output. The privacy notice remains intact and visible.
- Reviews use a continuous 48-second horizontal loop, individual quotation cards, consistent author alignment and fading edges. Provide pause/play, hover pause, and a static, non-duplicated layout under reduced-motion preferences. Duplicate visual cards are hidden from assistive technology. Existing review text and authors are preserved; no new endorsements or ratings were invented.
- Footer image uses the same configured favicon as the browser tab, per the user's clarification. EN/ZH footer configs remove GitHub; the footer component removes the attribution.

## Verification

- Desktop 1440px dark mode and 390px Chinese light mode inspected visually. No horizontal overflow; footer image visible at 64px.
- Browser confirms Georgia font family and six feature cards. Footer contains neither ShipAny nor GitHub links.
- Browser confirms scrolling animation, explicit pause, and static layout with the duplicate track removed under reduced motion.
- Interaction test covers pause/play state and one accessible copy of each review. Final regression, lint and production build recorded in the task.
- Local changes only; no deployment or production data changes.

## Case interaction revision

- The original implementation hid the design and disabled placements until visitors selected the sample photo and revealed the design. Remove these gates while retaining the step-by-step guide and original-photo initial view. Show the actual saved wolf design immediately; allow all four placements and comparison at any time.
- Original photo thumbnail, wolf design and full-size body preview each open the matching single-image lightbox; closing returns focus to the actual trigger.
- Read-only prompt is 16px with 28px line height, at least 256px high, and uses content sizing to show the full prompt in supporting browsers.
- Remove outer card border, shadow and column separators; keep only image corners and clear interactive controls. Placement toolbar stays below the header while scrolling through the body preview.
- Footer now follows envConfigs.app_favicon exactly; ICO images bypass the image optimizer.

Verification: 57 tests pass with `npm test -- --maxWorkers=2`; typecheck, lint (0 new errors) and production build pass. Desktop native clicks switch all four placements; original/design lightboxes show their matching assets. On 390px Chinese layout, prompt is 16px/312px with equal client/scroll height, all placements are enabled, and page has no horizontal overflow. Footer image URL matches the icon link exactly (`/favicon.ico`).
