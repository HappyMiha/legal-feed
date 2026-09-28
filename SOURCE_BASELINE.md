# Helvetic Lens AIx source baseline

Source repository: https://github.com/HappyMiha/helvetic-lens
Source commit: b6017005ddade369e3b129b99ac7fb4ffb2b3421
Date copied: 2026-09-28
Reused components: `apps/web/components/brand.tsx` copied unchanged to `src/components/brand.tsx`; Apache-2.0 LICENSE and NOTICE retained.
Reused domain types: None. The core MonitoringTopic and production data contracts include unrelated platform concerns. AIx implements the exact supplied domain contract with additive methods for read state, source records, duplication, and deletion.
Reused API clients: None. Production clients require authentication and remote source workflows. The asynchronous MonitoringBackend interface isolates deterministic AIx behavior.
Reused styles/tokens: `app/design-tokens.css` copied unchanged from https://github.com/HappyMiha/helveticlens-legal at f95f0fb1a24eb7f61cee9443fbe26a16562723c2. Light reading palette, typography stack, carbon navigation frame, spacing, radii, and status colors reused. Existing geometric brand mark retained. The topic processing lens uses the same restrained refraction colors.
Known deviations: Product shell and feed composed specifically for the three permitted navigation areas. The core shell, feed and detail pages require unrelated navigation/auth/translation/cache dependencies, so copying them would widen scope. Matching Shadcn/Radix controls come unchanged from the installed Sites starter. No shared packages extracted; no source repository modified. Fonts use the existing local system typography stack, with packaged DejaVu Sans solely for portable Unicode PDF export.

## Framework provenance

The separate AIx repository uses the Sites portable Vinext starter, React, TypeScript, Radix/Shadcn primitives and Cloudflare Workers packaging. Starter primitives in `components/ui` remain unchanged. This is infrastructure reuse, not a new brand.
