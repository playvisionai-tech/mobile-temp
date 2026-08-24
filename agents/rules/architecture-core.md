# Architecture Core Rules

## Rule
- Code is organized in **vertical feature slices** under `src/features/<name>/`. Each slice contains its screens, components, API hooks, store, tests, and docs.
- **No cross-feature imports**. Features share code only via `src/components/ui/` or `src/lib/`.
- **Routing stays thin** — leaf routes in `src/app/` are re-exports and nothing else. The two `_layout.tsx` files are the accepted exception: Expo Router requires the navigator and the auth guard to be declared there. `src/app/spec.md` lists every route and flags the files that still carry logic they should not.
- **No barrel files** except `src/components/ui/index.tsx`. Barrels break Fast Refresh and bloat the Metro graph.
- **UI kit promotion** — a component moves to `src/components/ui/` only when used by ≥2 features AND has no feature-specific logic.
- **State split** — server state → React Query, client state → Zustand. Never duplicate the same data in both. Zustand is aspirational today: no store exists yet, so this is the shape the first one should take, not a description of the code. Durable client state currently goes to MMKV through `src/lib/hooks/`.

## Rationale
Vertical slices keep related code together, making it easier to understand, test, and delete a feature. Cross-feature imports create hidden coupling. Thin routes enable navigation restructuring without touching business logic. Barrels harm Metro performance. The UI kit prevents duplicate components. The state split avoids synchronization bugs.

## Examples

### Good
```
src/features/auth/          # the real slice, as it stands today
├── spec.md
├── decisions.md
├── login-screen.tsx
├── components/
│   ├── login-form.tsx
│   └── __tests__/login-form.test.tsx
└── __tests__/login-screen.test.tsx
```

A slice with server data adds its hooks alongside — `src/features/feed/api.ts`
declares the feed's queries and mutations with `react-query-kit`.

### Bad
```tsx
// src/features/settings/settings-screen.tsx
import { usePosts } from '@/features/feed/api'; // ❌ Cross-feature import
import { Button } from '@/components/ui'; // ✅ OK — UI kit
```
```tsx
// src/app/(app)/feed.tsx
export { default } from '@/features/feed/feed-screen'; // ✅ Thin route
// const feedData = fetchFeed(); // ❌ Business logic in route
```

## Enforcement
- ESLint: custom rule `local/spec-required` (`scripts/eslint-rule-spec.js`, registered in `eslint.config.mjs`) enforces spec.md/decisions.md
- CI: `.github/workflows/drift-check.yml` blocks a PR without spec updates
- Review: **cross-feature imports are not enforced by any tool.** `eslint.config.mjs` configures no `import/no-restricted-paths`, so this boundary is a convention held by review. Wiring the rule up would make it automatic.
- Review: manual check for barrel files and route logic
