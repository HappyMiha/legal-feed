# Legal Feed

Swiss legal monitoring, preserving the Helvetic Lens AIx interface and four-step profile journey. Application code is Apache-2.0.

- Production: https://legalfeed.helveticlens.ch
- Repository: https://github.com/HappyMiha/legal-feed
- Original interface: https://github.com/HappyMiha/helvetic-lens-aix

## Real services

The application uses authenticated, account-scoped Cloudflare D1 storage; Swisscom Apertus 1.5 70B for topic suggestions and source-grounded analysis; official public feeds/APIs plus the existing Helvetic Lens SearXNG engine for discovery; and an Infomaniak SMTP transport for notification delivery. No fictional legal updates, preset scenario topics, recovery fixtures, artificial processing delay or local account backend are shipped.

Profiles, source selections, pause/resume, notes, read/saved state, feedback, settings, passwords for sensitive-action confirmation, and deletion are server-backed. Only unfinished drafts are kept locally, under a key scoped to the authenticated account. Email/password registration requires a one-use mailbox verification link. Login uses server-side sessions with HttpOnly cookies. Password reset and changes revoke previous sessions and pending email changes. ChatGPT identity headers are ignored; neither ChatGPT nor Google is an authentication provider.

## Run locally

Requires Node.js 22.13+, npm, and Python 3 for integration tests/background email transport.

```sh
npm ci
cp .env.example .dev.vars
# Fill server-only service credentials in .dev.vars.
npm run db:local
npm run dev
```

Apply the generated SQL migrations to the local D1 binding using Wrangler before using the app. Set AUTH_SECRET and the SMTP credentials before using registration. Authentication emails send immediately through TLS SMTP on port 465; failed messages have bounded background retries. For isolated integration tests, set AUTH_MAIL_TEST_STORE=true and SITE_URL=http://localhost:5173; the tests inspect only the local mail queue, without sending email. This mode is ignored on hosted domains.

```sh
npm run typecheck
npm test
npm run test:api  # against the local dev server and migrated local D1
npm run build
```

The production build emits a Cloudflare Worker and static client assets. Migrations in `drizzle/` are applied by Sites on publication. `app/globals.css`, `app/design-tokens.css`, and the supplied UI primitives retain the demo's visual design.

## Background monitoring and email

`.github/workflows/monitor.yml` runs every 15 minutes and supports manual dispatch. It invokes secret-protected job endpoints, discovers and analyzes source documents, then delivers queued emails using STARTTLS SMTP. GitHub scheduling can be delayed; this is not a contractual delivery-time guarantee. Instant alerts mean delivery after discovery, subject to quiet hours. Sources are normally checked hourly. Weekly digests use Europe/Zurich, including daylight-saving transitions, and the selected day/time (default Monday 07:00).

Repository configuration:

- Variable: `LEGAL_FEED_URL`
- Secrets: `CRON_SECRET`, `SITES_SERVICE_TOKEN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`

Site runtime configuration is documented in `.env.example`. SMTP credentials stay in the server and scheduled transport, not in browser code. The service token permits job requests through the private Sites gateway; `CRON_SECRET` independently authenticates the application's job endpoints.

Updates and instant notification records commit together. URL uniqueness, processed-document fingerprints, profile leases, outbox leases, and stable email Message-IDs prevent common duplicate/retry failures. SMTP provides at-least-once delivery: an accepted email followed by a lost acknowledgement can still be duplicated. Failed deliveries retry with bounded attempts. Pause, relevance, negative feedback, current frequency, and quiet hours are checked before delivery.

Changing email requires the current password and a confirmation link to the new address. The old login and notification address stays active until confirmation; confirmation updates both atomically and revokes old sessions. Existing accounts from the earlier authentication system retain their profiles when the same email address is verified during registration or password reset. Account deletion cascades to profiles, updates, source checks, pending deliveries and verification requests. Export includes retained account data and source-check status without credential material.

## Source coverage and limits

Public discovery uses a dedicated server token at `SEARCH_SERVICE_URL`, backed by the owner's existing local SearXNG deployment. There is no paid Search1API fallback. The token stays server-side and grants only public search, not access to Helvetic Lens accounts or dossiers. Profile-scoped search results are cached for an hour (10 minutes for partial engine results), so subsequent analysis batches reuse the search. Topic changes use a new cache key; deleting a profile cascades its cache. Empty successful results and unavailable engines remain distinct. Queries still go to the configured public search engines.

Verified direct connectors: Fedlex RSS, ESTV and BSV public news APIs, Federal Administrative Court media releases, Zurich authority news, Swiss Startup Association RSS. Other federal/cantonal/association selections use searches scoped to official publisher domains, with retrieved text or explicitly labelled public search excerpts. Generic RSS/Atom and public newsletter archive URLs are supported. LinkedIn monitoring covers public indexed content only, not private posts or an authenticated LinkedIn subscription.

Source errors are visible under profile monitoring status. A source being selected is not a promise of comprehensive coverage. Some publishers block automated retrieval; image-only/PDF-only or login-only content is not fully ingested. Unknown publication dates are labelled **Discovered**, not presented as a new legal change. Legal-basis text is shown only when it appears in the captured source. Generated summaries require professional review; original publisher links and source excerpts are retained.

AI results validate article indexes, selected topic references, completion status and content structure. A completed explicit `relevance: none` classification with no topic IDs is a valid non-match; malformed, contradictory or truncated responses remain failures and do not mark documents processed. Current monitoring health includes only enabled sources; historical checks remain retained. Paused profiles explicitly show that monitoring is paused. The protected `retry-failed` maintenance job requeues enabled failed checks without breaking live leases or erasing the previous failure before a real successful check.

Teams/Slack channels and German/French interface controls remain disabled as in the supplied demo. The application does not claim those integrations exist.

## Operations

Use GitHub Actions run history for scheduler failures and the profile's Monitoring status for individual source failures. Runtime logs must never print credentials. Do not seed production with test data. `tests/api-integration.py` and `tests/auth-integration.py` refuse non-local endpoints. Test-only verification links never appear in API responses. Root pages request no indexing through robots metadata; this is not access control.

Before publication: run type checks, unit tests and local API integration tests, build the exact source, commit and push it, package the Worker with its migrations, and publish that saved revision through Sites. Keep published migrations immutable. Review source failures independently of application deployment health.

## License and source rights

Apache-2.0 covers this application's original code, not third-party source publications or models. Publisher material retains its own rights. Source text is held as account-linked monitoring evidence and never committed to this repository. See LICENSE, NOTICE, SOURCE_BASELINE.md, and THIRD_PARTY_NOTICES.md.
