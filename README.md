# Helvetic Lens AIx

Focused ESOP monitoring application for the AI+X Summit on 1 October 2026. UI language is English. Product branding is Helvetic Lens. Target hostname: https://ai.helveticlens.ch.

## Setup and verification

Requires Node.js 22.13+ and npm. From a clean checkout:

```sh
npm ci
npm exec playwright install chromium
npm run dev
```

Open the URL printed by the development server. The complete core flow uses local data and browser persistence; it needs no model, monitoring API, authentication service or live source connector after loading.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run start -- --port 4173
npm run test:e2e
npm run aix:verify
```

`aix:verify` runs typecheck, lint, unit tests, production build and browser tests in that order. E2E tests own a production server on port 4173; do not start a second server there. `AIX_TEST_URL` can target another running environment. `AIX_CHROMIUM_PATH` optionally selects an installed Chromium. Production browser tests include three separate clean rehearsals, offline refresh/PDF export, state persistence, profile management, invalid inputs, and 1366×768 / 390×844 layouts. No release to the target hostname if verification fails.

## Architecture

- `src/domain/monitoring.ts`: MonitoringBackend, MonitoringProfile, Topic, Source, Delivery, Update.
- `src/aix`: asynchronous AIxMonitoringBackend, deterministic topics/sources/updates, operator recovery.
- `src/features`: onboarding wizard, feed/detail/source record, profiles/digest/settings.
- `src/platform`: versioned browser storage, clipboard text and PDF/data export.
- `src/app.tsx`: three-area shell and local history routing.

UI screens obtain update records through MonitoringBackend. Fixture modules are not imported by screens. Replacing the backend with a future HelveticLensMonitoringBackend does not require changing feature screens. State namespace: `helvetic-lens-aix:v1`.

Draft input, topic selection/edits/deletions, source toggles, signals, delivery, profile names, notes, save/read/feedback state, quiet hours, and paused profiles persist in this browser. Failed storage writes do not announce success. The source repositories are unchanged; see SOURCE_BASELINE.md.

## AIx scenario semantics

ESOP, VSOP, employee participation, employee options, stock options, phantom shares, equity plan and Mitarbeiterbeteiligung match case-insensitively. Topic processing lasts 1700 ms. Unknown queries retain their input and allow custom topics without inventing unrelated legal content.

Activating an ESOP profile creates the specified four recurring-use historical records immediately. Their source, legal basis and matched topic are immutable snapshots. Editing or deleting a subscription topic/source does not rewrite historical provenance. The fixture history remains the fixed four-item story even when the presenter changes selections. New custom-only profiles have no unrelated ESOP records. Duplicating a profile copies its configuration but starts with empty history, notes and feedback. Pause/resume stores profile state; there is no live monitoring scheduler.

All four scenario records appear in the feed and digest, including Medium relevance. The delivery threshold remains in the profile and applies to the instant-alert preview. This deliberately preserves the supplied journey; production monitoring semantics must be aligned when the real engine is connected.

Signals validate HTTP(S) URL syntax and remain `requested`; no LinkedIn or newsletter connection is claimed. No real messages or email digests are sent. Local account settings do not provide remote identity/authentication. The locally hashed password confirms local data deletion only; it is not encryption or an access-control boundary.

The four legal updates are fictional scenario records, not verified decisions or legal advice. Original source opens a matching internal source-record view; it never points to an unrelated court decision. Public disclosure is enabled by default and appears discreetly in detail/source views and copied/downloaded content. Do not add invented case identifiers.

## Configuration

See `.env.example`. Runtime deployment configuration belongs in Sites environment variables, not the hosting manifest:

- `AIX_PUBLIC_DISCLOSURE=true`: small `AIx sample scenario` note. Required outside a controlled pitch.
- `AIX_OPERATOR_CONTROLS=true`: local reset/recovery controls; never primary navigation.
- `AIX_PROCESSING_MODEL`: truthful deployed model label; empty means no model connected.
- `AIX_DEPLOYMENT_TYPE`, `AIX_HOSTING_LOCATION`: truthful runtime values; unknown stays not configured.
- `AIX_MODE=true`: documented environment designation; backend selection is fixed to AIx in this slice.

No secrets belong in client variables. No Swiss hosting or Apertus claims are hard-coded.

## Reset and recovery

```sh
npm run aix:reset
```

The command prints browser-local actions (it cannot clear a different browser's storage):

- `/?reset=1`, `/?state=empty`, or Alt+Shift+0: clear all AIx state and show the clean start.
- `/?state=feed` or Alt+Shift+5: restore one canonical Fintara AG: ESOP profile with four updates.
- `/?state=detail` or Alt+Shift+6: restore and open the court update.

Recovery replaces only AIx state, never other applications' storage. Operators can restore the feed in under five seconds. Reset removes draft, account, profiles, updates, notes, feedback, and saved/read state.

## Offline and production

Build emits a versioned service worker and precaches all app assets, fonts, PDF chunks and the root shell. After one successful production load and service-worker installation, local navigation, refresh, the full Stage 0–6 flow, PDF and all browser-state actions work offline. A brand-new device still needs one network load. Failed offline-cache installation does not block online use.

Sites infrastructure may have an owner-only access gate before the first load; application code has no authentication dependency. Keep access policy deliberate. A local production server avoids an external first-load gate during a presentation.

## Deployment

`.openai/hosting.json` belongs to this AIx Site only. Build/verify, commit and push the exact source, package `dist`, save that revision in Sites and deploy it. Never substitute another Helvetic Lens Site ID. Configure the requested hostname using its returned CNAME and verification records without changing other product hostnames. Source credentials and DNS credentials are never committed.

The build generates `dist/server/index.js`, `dist/client`, and the Sites hosting manifest. `npm run start` serves the production Worker locally. For Sites packaging use the installed Sites build/package scripts. Runtime configuration updates require deployment of a saved version.

## Presentation runbook

1. Reset to clean Stage 0. Create monitoring profile.
2. Enter ESOP; suggest topics; make a small edit, selection and deletion.
3. Continue; disable economiesuisse; add a competing law firm's LinkedIn page and the Ledgy newsletter.
4. Choose Both, Email, Only high relevance; show the live preview.
5. Name the profile `Fintara AG: ESOP`; activate; go to feed.
6. Open the 25.09.2026 court update; show provenance, legal basis, Summary and Why it matters.
7. Copy summary. End here; use profile management/settings only for questions.

P2 work (real authentication, monitoring engine, email sending, ingestion and other scenarios) is intentionally excluded.
