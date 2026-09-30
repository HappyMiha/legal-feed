# Production acceptance

- Preserve the supplied shell, four setup screens, feed/detail/source views, profile management and settings.
- Authenticate each account and scope every data mutation/read to its server identity.
- Generate topics through the configured live model; ingest attributed public source material.
- Persist profiles, notes, feedback, settings and history remotely.
- Enforce pause, selected sources/topics, relevance threshold and quiet hours.
- Run background monitoring independently of an open browser, with observable failures.
- Deliver email through a configured SMTP account and record acknowledged delivery.
- Preserve canonical publication links and distinguish publication dates from discovery dates.
- Export retained account data and cascade deletion of account-owned records.
- Never report blocked sources, inaccessible LinkedIn content or disabled channels as fully connected.

Automated checks: typecheck, backend unit tests, local API integration tests, production build. Live provider probes validate model availability and source ingestion; SMTP authentication is checked without sending unsolicited test messages. Visual browser parity has not been asserted by these checks; original visual styles are retained.

WebMCP profile-list/start-draft tools are feature-detected. A supported live WebMCP validation context was unavailable; that optional integration has not been runtime-verified.
