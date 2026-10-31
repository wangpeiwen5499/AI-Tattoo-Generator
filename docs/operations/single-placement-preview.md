# Single-placement lab (Preview only)

Open `/try-on-lab/index.html` on the deployment created from `feat/single-placement-preview`. Do not merge or push this branch to `shipany-two` during validation.

The static work surface bypasses the production app layout/auth flow. The lab API does not access the database, R2, credits, orders or Workflow. Production rejects all lab API operations with 404. Production deployment preparation is not invoked for Preview.

Set only in Preview:

- `KIE_LAB_API_KEY`: a separate KIE key with a small account-side spend/request cap.
- `KIE_LAB_ACCESS_TOKEN`: a random access token of at least 24 characters. Enter this token in the work surface; never enter the KIE API key there.

The API never falls back to `KIE_API_KEY`. Without lab configuration, local image upload and direct free placement still work. No external upload or paid generation occurs until an explicit KIE operation is clicked after the disclosure checkbox is selected. These calls use KIE test credits; website credits are not involved. Submissions are not automatically retried on ambiguous errors.

## What to validate

1. Upload a real local body-part photo, including a side upper-arm photo. No region selection is required. Upload a design (in either order); it appears directly on the photo.
2. Drag the design; use its bottom-right resize handle and upper rotation handle, or two fingers on mobile. There is no standalone adjustment panel. Tap the on-photo opacity handle or its label for a contextual ink slider, or drag the handle vertically; Escape/Done closes it. Use long-press/right-click or Shift+F10 on the tattoo for flip/reset/remove. Arrow keys move, plus/minus scale, R/Shift+R rotate, bracket keys adjust opacity, F flips, 0 resets placement and Delete removes. These actions remain local. Near-white backgrounds are faded. The editing canvas is a flat local overlay, not an AI result.
3. Optionally generate one design at 1K with a prompt, then reuse it for placement. Independent design generation is a separate explicit provider call.
4. Generate one realistic 1K try-on. The model gets the original photo, the design and a flattened placement guide; no native mask enforcement is claimed.
5. Compare the raw provider result with the original: tattoo position, size, rotation, skin realism, unchanged pose/face/background and camera angle. The raw output is shown/downloaded at native aspect ratio. If the model changes aspect ratio, no composite is created.
6. Click “放大查看 · 三图对比” after rendering. Compare original, manual overlay and raw AI result in one read-only dialog. Zoom starts at 100% fit-to-window and extends to at least 500%, or native pixels if larger. Wheel/pinch and drag retain the same viewport across sources of matching aspect ratio. A prominent dialog download saves the selected source at its native dimensions. Raw result pixels are copied from the loaded image, rather than reusing its revoked temporary URL. If aspect ratios differ, contain without stretching and warn that exact alignment is unavailable.
7. Separately inspect the local blend. Its padded bounds follow the rotated design automatically; a feathered rectangular mask retains the original away from the tattoo. It is not evidence that the provider itself preserved the original. Returning to editing preserves transforms; any actual edit invalidates the old result. Download and provider guide omit editor handles.

Photos are reduced to a working maximum edge of 1800px. Existing design uploads are reused, and each explicit render creates only one provider task. KIE uploads use its temporary file service; save outputs promptly. Refreshing keeps a signed provider task reference in sessionStorage, but original local photo and placement are not persisted. The resume action can recover the raw result; re-uploading may be necessary for a new composition.

## Verification evidence and limits

Geometry and API tests cover letterboxing coordinates, reverse drags, design aspect, environment/auth isolation, signed token tampering/expiry/origins, and one-call rendering with original-photo framing. Browser checks cover desktop/mobile placement, locked inputs during an in-flight mocked upload, and aspect-mismatch output display/download. These mocked checks are not real KIE output-quality validation. Actual provider quality must be recorded separately from these checks and from the locally composited result.

## Direct editing verification (2026-10-31)

Browser validation used local body photos and mocked provider responses, not paid AI output. Desktop resize changed scale to 130%; mobile touch input changed scale to 170% and rotation to 45°, without page overflow at 390px. Three-source comparison retained zoom 250%, scrollLeft 100 and scrollTop 160. Detail image decoding was verified after temporary asset URLs were revoked. Geometry and studio interaction regressions cover no-selection placement, portrait pinch, rotated hit testing, minimum API region at edges, explicit render payload, stale-result invalidation and removal. Build and typecheck passed; build retains existing baseline-browser-mapping and @vercel/oidc version warnings.

Interrupted render tasks are bound to an editor-session/version identifier. If the photo, design or placement changes before resuming, the recovered result remains available for raw-only zoom; original/manual comparisons and local blending are disabled to avoid mismatched comparisons. Refresh likewise recovers raw-only viewing. Regression tests cover interrupted tasks and duplicate-submission locks.

## On-photo controls update (2026-10-31)

The standalone “调整纹身” panel and all editor range inputs were removed. Object handles, direct manipulation and a contextual on-photo menu replace them. The result viewer's zoom control remains because it is a separate read-only viewing tool. Menu actions do not call the provider; generation locks input and closes the menu/long-press gesture. The small-design center hit regression is fixed by moving the resize handle outward and prioritizing the object center. A 390px browser check confirmed that a 20% tattoo moves by dragging its center without changing scale. The separate actual-pixel viewer limitation identified in review is unchanged in this scope.

## Guided studio and comparison update (2026-10-31)

The next Preview revision adds a restrained warm-neutral studio layout, four-step progress and context-specific guidance. Native photo/design pickers now use explicit keyboard-accessible buttons. New-design generation and realistic rendering have distinct busy messages. Technical test access sits inside an authorization disclosure; consent remains explicit and paid-call boundaries are unchanged.

Ink strength opens a small on-photo slider on click/tap as well as retaining vertical drag. It is dismissed by Escape, Done, outside interaction, leaving editing or starting generation. It is not a restored standalone adjustment row. Comparison and download use prominent buttons; the comparison dialog includes a selected-source download. Following user feedback, the comparison now fills the browser viewport, with a dark canvas and compact toolbar rather than a narrow portrait modal. Photos remain centered with their own aspect ratios. Resizing the window or changing orientation refits the photo. Native pixels exceed the old 500% cap where required; centered-image wheel/pinch coordinates account for the image margins.

Verification uses local samples and simulated provider output. Regression tests reproduce opacity tap, photo-picker activation, current-source download, native pixel zoom beyond 500% and centered portrait pinch anchoring. No real KIE call was made. Production branch and billing logic are untouched.
