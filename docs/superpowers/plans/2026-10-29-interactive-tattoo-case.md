# Homepage interactive tattoo case

User brief: replace the hero image with alt “AI Tattoo Generator preview” with an interactive case using the original untattooed full-body photo, the exact geometric-wolf prompt, the wolf design, and four supplied result images.

Design: retain the existing site typography and theme. Use an asymmetric two-column example: compact process controls on the left, a large full-body preview on the right. Quiet graphite/neutral surfaces, the existing warm amber accent for active controls, a white paper surface for the tattoo design. The photographs carry the visual emphasis. Stack on mobile, keep all body parts visible, and provide keyboard-accessible controls.

Interaction: the visitor selects the sample photo, reads its preset prompt, and reveals the already-generated design. Four buttons switch the saved results immediately. A separate original-photo comparison and restart control allow exploration. Label this an example; do not call generation/upload APIs or spend credits. Link to /generate for personal uploads. All controls are localized EN/ZH.

Asset mapping (anatomical left/right): 3.png = left arm; 1.png = right arm; 2.png = shoulder; 4.png = calf. tatto.png = design. The original image is exec-8aa3f8ef-8990-4907-b0a5-edcb34fbd83e.png. Optimize copies to WebP without changing the content; originals remain untouched.

Steps:

- [x] Add failing interaction tests for progression, four placements, original comparison and restart.
- [x] Prepare six optimized assets and implement the client component; enable it only for the home hero.
- [x] Verify both languages, mobile/desktop layout and image loading in a browser.
- [x] Run the test suite, type checking, lint and production build; retain local changes for review.

Verification: 35 tests pass, TypeScript passes, lint has no new errors (72 inherited template findings remain). Desktop light/dark and 390px mobile checked in Chrome, all four placements load, no horizontal overflow. Independent review findings fixed with failing-then-passing tests: lightbox focus return and localized single-image instructions. Final production build is checked before commit. Six WebP assets total 255,368 bytes; original supplied PNGs remain untouched. No production deployment.
