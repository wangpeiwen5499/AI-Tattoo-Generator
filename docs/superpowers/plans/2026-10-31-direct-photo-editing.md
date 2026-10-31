# Direct Photo Editing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mandatory region selection and separate placement view with direct tattoo manipulation on the original photo.

**Architecture:** Keep the existing isolated try-on lab and provider API. Store tattoo position in original-photo normalized coordinates, derive a padded render region from the transformed design, and keep editing independent of provider calls.

**Tech Stack:** Existing native browser canvas, ES modules, Vitest, Next.js Preview API.

**Spec:** User-approved interaction description in this chat on 2026-10-31: upload photo, generate/upload design, adjust directly, explicitly render realism, return to editing without losing transforms.

## Global Constraints

- Reuse feat/single-placement-preview; do not change production routes, credits, credentials, billing or database.
- No mandatory circle, no separate placement-preview step.
- Desktop drag/resize/rotate; mobile drag and two-finger scale/rotate; retain accessible sliders.
- Flip, reset, opacity, remove design, white-background removal; editing never invokes provider.
- Preserve placement when comparing original/results and returning; invalidate stale results upon edits.

## Review Focus

- Portrait/landscape coordinates and rotated region boundaries stay in the photo.
- Transparent margins and white-background removal remain intact.
- Pointer cancellation and lifting one finger must not leave stuck gestures.
- No adjustment or duplicate submission during an active provider request.
- Export/provider guide excludes adjustment handles; provider region follows latest placement.

### Task 1: Placement geometry

- [x] Write failing tests for transformed bounds, hit testing and two-pointer transform.
- [x] Run targeted geometry tests and confirm failure, implement helpers, rerun.

### Task 2: Direct editing surface

- [x] Remove region UI and separate draft tab; original photo becomes editable with optional clean-photo comparison.
- [x] Render tattoo without ellipse clipping; add scale/rotate handles, drag, pinch, flip/reset/remove and keyboard controls.
- [x] Derive provider/composite region at explicit rendering; preserve transforms across views, clear stale results after edits.

### Task 3: Verification

- [x] Exercise browser desktop/mobile using local images, without paid provider calls.
- [x] Run complete test suite, typecheck and formatting; update operation notes and record limitations.

Execution: user explicitly requested implementation; proceed inline without another approval. No deployment or production changes are implied.

## Execution record

User steering added a result detail viewer and three-way comparison during implementation. Implemented as separate detail-viewer.mjs, without changing editor state or provider calls. Geometry tests failed first (missing helpers), then passed. Studio tests failed first (mandatory selection, missing viewer/removal), then passed. A browser-discovered revoked-blob viewer bug gained a failing regression and was fixed by serializing the loaded result. A thin edge-placement regression failed first and now passes with minimum padded bounds. Browser checks used mocked provider output only. No deployment, paid provider request or production state changes were performed.

Independent review found one P2: resumed tasks could compare old AI output against newly edited inputs. Added a failing regression, bound render tasks to editor session/revision, and disabled comparison/blending when context differs; targeted16 tests pass. Recovered raw-only results still support zoom.
