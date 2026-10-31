# Single-placement lab (Preview only)

Open `/try-on-lab/index.html` on the deployment created from `feat/single-placement-preview`. Do not merge or push this branch to `shipany-two` during validation.

The static work surface bypasses the production app layout/auth flow. The lab API does not access the database, R2, credits, orders or Workflow. Production rejects all lab API operations with 404. Production deployment preparation is not invoked for Preview.

Set only in Preview:

- `KIE_LAB_API_KEY`: a separate KIE key with a small account-side spend/request cap.
- `KIE_LAB_ACCESS_TOKEN`: a random access token of at least 24 characters. Enter this token in the work surface; never enter the KIE API key there.

The API never falls back to `KIE_API_KEY`. Without lab configuration, local image upload, selection and free placement still work. No external upload or paid generation occurs until an explicit KIE operation is clicked after the disclosure checkbox is selected. These calls use KIE test credits; website credits are not involved. Submissions are not automatically retried on ambiguous errors.

## What to validate

1. Upload a real local body-part photo, including a side upper-arm photo. Circle the intended area. Sliders support keyboard adjustment, and the selection button initializes an adjustable region if needed.
2. Upload an existing tattoo design or use the wolf example. Drag, scale, rotate and adjust ink opacity. The displayed placement is a flat local preview, not an AI result.
3. Optionally generate one design at 1K with a prompt, then reuse it for placement. Independent design generation is a separate explicit provider call.
4. Generate one realistic 1K try-on. The model gets the original photo, the design and a flattened placement guide; no native mask enforcement is claimed.
5. Compare the raw provider result with the original: tattoo position, size, rotation, skin realism, unchanged pose/face/background and camera angle. The raw output is shown/downloaded at native aspect ratio. If the model changes aspect ratio, no composite is created.
6. Separately inspect selected-area composition. This locally blends the provider image inside the ellipse and uses the original outside it. This must never be presented as evidence that the provider itself preserved the original.

Photos are reduced to a working maximum edge of 1800px. Existing design uploads are reused, and each explicit render creates only one provider task. KIE uploads use its temporary file service; save outputs promptly. Refreshing keeps a signed provider task reference in sessionStorage, but original local photo/selection are not persisted. The resume action can recover the raw result; re-uploading may be necessary for a new composition.

## Verification evidence and limits

Geometry and API tests cover letterboxing coordinates, reverse drags, design aspect, environment/auth isolation, signed token tampering/expiry/origins, and one-call rendering with original-photo framing. Browser checks cover desktop/mobile placement, locked inputs during an in-flight mocked upload, and aspect-mismatch output display/download. These mocked checks are not real KIE output-quality validation. Actual provider quality must be recorded separately from these checks and from the locally composited result.
