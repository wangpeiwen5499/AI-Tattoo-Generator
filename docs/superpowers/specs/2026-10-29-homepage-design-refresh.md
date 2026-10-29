# Homepage visual refresh

User scope: remove ShipAny attribution and GitHub from the footer, add a website image, reference Songtailor typography, redesign features as cards and make testimonials scroll.

## Design decisions

- Inspected the reference site's computed styles in the browser: body uses Georgia / Times New Roman / serif, headings use Georgia at weight 400. Use the same system serif approach, with Chinese serif fallbacks; keep a system monospace stack for prompts/code. Remove unused Google font loaders.
- Preserve existing light/dark theme colors. New feature cards use ink #29243c, paper #ffffff, pale text #f3effb, and lavender #d0c0f4.
- Six features form a 2+1 / 1+1+1 / full-width layout on desktop, then collapse to one column on phones. The first card includes the site's actual geometric-wolf output. The privacy notice remains intact and visible.
- Reviews use a continuous 48-second horizontal loop, individual quotation cards, consistent author alignment and fading edges. Provide pause/play, hover pause, and a static, non-duplicated layout under reduced-motion preferences. Duplicate visual cards are hidden from assistive technology. Existing review text and authors are preserved; no new endorsements or ratings were invented.
- The repository logo is still the ShipAny template mark. Use the existing site case's wolf design for the requested footer image instead of displaying the template mark. EN/ZH footer configs remove GitHub; the footer component removes the attribution.

## Verification

- Desktop 1440px dark mode and 390px Chinese light mode inspected visually. No horizontal overflow; footer image visible at 64px.
- Browser confirms Georgia font family and six feature cards. Footer contains neither ShipAny nor GitHub links.
- Browser confirms scrolling animation, explicit pause, and static layout with the duplicate track removed under reduced motion.
- Interaction test covers pause/play state and one accessible copy of each review. Final regression, lint and production build recorded in the task.
- Local changes only; no deployment or production data changes.
