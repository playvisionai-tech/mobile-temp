# Onboarding — current behavior

## What this feature does
First-run welcome screen that introduces the starter app.

## Behavior
- The screen displays a static illustration, starter-app highlights, and a
  “Let's Get Started” button.
- Pressing the button sets `isFirstTime = false` in MMKV via the
  `use-is-first-time` hook and replaces the current route with `ROUTES.login`
  (`/login`).
- Destinations come from the `ROUTES` registry in `@/lib/navigation`. This
  screen writes no path literal.
- The root route guard skips this route when `isFirstTime` is already false.
- The screen does not request device permissions.

## Entry points
- Route: `src/app/onboarding.tsx` → `features/onboarding/onboarding-screen.tsx`
- State: MMKV via `use-is-first-time` hook (client state)
- Navigation: `ROUTES` from `@/lib/navigation`

## Platform differences
- None.

## Out of scope
- Personalized onboarding based on user segment — deferred.
