# Feed — current behavior

## What this feature does
Displays a list of posts. Users can open a separate screen to add a post.

## Behavior
- Feed screen fetches posts via React Query using `src/lib/api/client.tsx`.
- The feed displays the posts returned by the query in a `FlashList`. It does
  not currently paginate or load additional pages.
- The screen draws its own header row: the title `feed.title` and a "Create"
  link (`feed.create`, testID `create-post-link`) to `ROUTES.addPost`
  (`/feed/add-post`). The header lives here because the native tab bar has no
  header slot.
- The header claims the top safe-area inset — it is wrapped in `SafeAreaView`
  from `@/components/ui` with `edges={['top']}`. The app draws edge-to-edge, so
  without that inset the row would sit under the status bar and the system
  would swallow taps on "Create". Only the top edge is claimed: the native tab
  bar owns the bottom one, and the row's horizontal padding is a design choice.
  The list below the header is not inset and scrolls to the screen edges.
- Add post opens `ROUTES.addPost` with form validation via TanStack Form + Zod.
- A valid submission posts the title, body, and demo user ID `1`. Success and
  failure are reported with flash messages. The feed cache is not currently
  invalidated after creation.
- Selecting a post opens `ROUTES.post(id)` — pathname `/feed/[id]` with the
  post id as a param — which shows loading, failure, and loaded-detail states.
- Every destination this feature links to comes from the `ROUTES` registry in
  `@/lib/navigation`. No screen or component here writes a path literal.
- The queries name their response shapes where they call the API client
  (`client.get<...>`), so a `Post` reaches React Query without passing through an
  untyped step: the list reads `data.posts`, the detail and the create read
  `data`.

## Entry points
- Route: `src/app/(app)/index.tsx` → `features/feed/feed-screen.tsx`
- State: React Query cache (server state), no client store

## Platform differences
- None.

## Out of scope
- Real-time updates (WebSockets) — not implemented.
- Post reactions/likes — deferred.
