# Product Domain and Business Rules

**There are no product or business rules yet.** This repo is the Obytes starter
template, not a shipped product: the feed is demo data from `dummyjson.com` (see
`EXPO_PUBLIC_API_URL` in `.env.example`) and `style-demo` is an internal
showcase. Nothing here encodes a domain.

Add rules to this file as the product acquires them — eligibility, pricing,
entitlements, workflow states. Keep it to rules an engineer could not infer from
the code.

The few domain-shaped facts that are real today:

- **Sign-in is email/password through Clerk.** There is no anonymous mode and no
  social provider configured. `src/features/auth/spec.md` is the source of truth.
- **Two locales ship: `en` and `ar`.** Arabic makes RTL a supported layout, not a
  hypothetical. `src/lib/i18n/spec.md` covers detection and fallback.
- **Three environments — development, preview, production — install side by
  side**, each with its own bundle ID (`com.obytes.development`,
  `com.obytes.preview`, `com.obytes`). See `env.ts`.

For how the app is built rather than what it does, start at
[`ARCHITECTURE.md`](../ARCHITECTURE.md). This file used to restate architecture
from `AGENTS.md`, and the restatement went stale — that is what `ARCHITECTURE.md`
is for now.
