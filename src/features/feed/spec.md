# Feed — current behavior

## What this feature does
Displays a list of posts. Users can open a separate screen to add a post.

## Behavior
- Feed screen fetches posts via React Query using `src/lib/api/client.tsx`.
- The feed displays the posts returned by the query in a `FlashList`. It does
  not currently paginate or load additional pages.
- The screen draws its own header row: the title `feed.title` and a "Create"
  link (`feed.create`, testID `create-post-link`) to `/feed/add-post`. The
  header lives here because the native tab bar has no header slot.
- Add post opens `/feed/add-post` with form validation via TanStack Form + Zod.
- A valid submission posts the title, body, and demo user ID `1`. Success and
  failure are reported with flash messages. The feed cache is not currently
  invalidated after creation.
- Selecting a post opens `/feed/[id]`, which shows loading, failure, and
  loaded-detail states.

## Entry points
- Route: `src/app/(app)/index.tsx` → `features/feed/feed-screen.tsx`
- State: React Query cache (server state), no client store

## Platform differences
- None.

## Out of scope
- Real-time updates (WebSockets) — not implemented.
- Post reactions/likes — deferred.
