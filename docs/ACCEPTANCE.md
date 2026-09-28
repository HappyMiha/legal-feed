# AIx acceptance evidence

Validated on 28 September 2026 with the production Worker at 1366×768 and mobile at 390×844.

`npm run aix:verify`: PASS (typecheck, lint, six backend tests, production build, six browser scenarios). The browser suite includes three complete independent clean-state Stage 0–6 rehearsals. No page errors in the rehearsals. PDF output was rendered and inspected for clipping and text correctness.

| Specification | Evidence |
|---|---|
| TC-01–03 | Clean start, empty initial input, deterministic processing, six topics, selection/edit/delete, back and refresh persistence |
| TC-04–07 | Enabled source defaults, economiesuisse disabled and preserved, Zurich plus Bern, invalid URL rejection, two requested signals |
| TC-08–10 | Immediate delivery preview, exact profile JSON, disabled empty-name activation, persisted activation and confirmation |
| TC-11–13 | Exactly four feed records, exactly two High, read state survives refresh |
| TC-14–17 | Saved state, private note, real clipboard text, hidden feedback record retained in profile history |
| TC-18–20 | Refresh at each core route, browser reset, immediate canonical feed recovery |
| P1 | PDF download while offline, profile pause/resume/duplicate/delete, settings persistence and local password setup |
| Edge cases | Unknown query/custom topic, combined date/search filters, missing ID recovery, malformed storage, canton removal, signal toggles, regeneration disables Continue |
| Visual | Desktop/mobile full-page screenshots; no horizontal overflow; readable high-contrast brand palette; rendered PDF has no clipping |
| Offline | Service worker installed, network disabled, update opened and refreshed, PDF downloaded successfully |

The exact fixture statements remain fictional AIx scenario content. Default disclosure is enabled. No live source ingestion, model calls or email delivery is represented as active.

## Delivery boundaries

Source reuse and exact commits are recorded in SOURCE_BASELINE.md. Notes/state remain browser-local. A clean production build is required after a clean dependency install. Private Sites access may require first-load sign-in; it does not add an application authentication dependency. Public access is a separate audience setting and is not changed implicitly.
