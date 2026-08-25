# Architecture Core Rules

## Rule
- Code is organized in **vertical feature slices** under `src/features/<name>/`. Each slice contains its screens, components, API hooks, tests, docs, and — only if it has client state — its store.
- **No cross-feature imports**. Features share code only via `src/components/ui/` or `src/lib/`.
- **Routing stays thin** — leaf routes in `src/app/` are re-exports and nothing else. The two `_layout.tsx` files are the accepted exception: Expo Router requires the navigator and the auth guard to be declared there. `src/app/spec.md` lists every route and flags the files that still carry logic they should not.
- **No barrel files** except `src/components/ui/index.tsx`. Barrels break Fast Refresh and bloat the Metro graph.
- **UI kit promotion** — a component moves to `src/components/ui/` only when used by ≥2 features AND has no feature-specific logic.
- **State split** — server state → React Query. Never duplicate server data into a store.
- **A store belongs to its feature** — client state is owned by the feature that holds it, so its Zustand store lives inside that slice as `src/features/<name>/store.ts`. There is no global store, and a feature must not import another feature's store (see **No cross-feature imports** above).
- **A store is not part of the slice template** — create one **only when the feature already has client state to hold**: state that outlives a single render, is read or written by more than one component in the slice, and is not server data. Short of that, `useState` is enough. Most features need none, and an empty or speculative store — added to complete the folder shape — is wrong. No store exists in the codebase today; the first feature that genuinely needs one establishes the file.
- **Durable global client state** — theme and first-run go to MMKV through `src/lib/hooks/`, not to a feature store.

## Rationale
Vertical slices keep related code together, making it easier to understand, test, and delete a feature. Cross-feature imports create hidden coupling. Thin routes enable navigation restructuring without touching business logic. Barrels harm Metro performance. The UI kit prevents duplicate components. The state split avoids synchronization bugs. Keeping a store in its slice means client state is deleted with the feature that owned it and cannot be reached sideways; requiring real state before creating one keeps empty stores — and the indirection they add — out of features that only ever needed `useState`.

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
└── __tests__/login-screen.test.tsx   # no store.ts — this slice holds no client state
```

A slice with server data adds its hooks alongside — `src/features/feed/api.ts`
declares the feed's queries and mutations with `react-query-kit`.

A slice that does hold client state adds a `store.ts` next to them:

```tsx
// src/features/editor/store.ts — draft text survives navigating away, and
// both the toolbar and the canvas read it. Real client state, so a real store.
export const useEditorStore = create<EditorState>(set => ({ ... }));
```

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
```tsx
// src/features/profile/store.ts
// ❌ The feature has no client state — this store exists only because the
// slice "should have one". Delete it; nothing is holding state here.
export const useProfileStore = create(() => ({}));
```
```tsx
// src/features/feed/store.ts
// ❌ Server data mirrored into a store — React Query already owns `posts`.
export const useFeedStore = create<{ posts: Post[] }>(() => ({ posts: [] }));
```
```tsx
// src/features/settings/settings-screen.tsx
import { useEditorStore } from '@/features/editor/store'; // ❌ Another feature's store
```

## Enforcement
- ESLint: custom rule `local/spec-required` (`scripts/eslint-rule-spec.js`, registered in `eslint.config.mjs`) enforces spec.md/decisions.md
- CI: `.github/workflows/drift-check.yml` blocks a PR without spec updates
- Review: **cross-feature imports are not enforced by any tool.** `eslint.config.mjs` configures no `import/no-restricted-paths`, so this boundary is a convention held by review. Wiring the rule up would make it automatic.
- Review: **store placement and necessity are not enforced by any tool.** A store outside its slice, an empty store, and a cross-feature store import are all caught by review only.
- Review: manual check for barrel files and route logic
