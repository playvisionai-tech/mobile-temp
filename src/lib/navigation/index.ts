import type { Href, Route } from 'expo-router';

/**
 * A path that can be navigated to as a bare string.
 *
 * `Route` is expo-router's union of the `pathname`s of `Href`'s **object**
 * members, minus relative and external paths. Unlike `Href`'s string arm it
 * carries no `/${string}` member, so it is the narrowest thing the generated
 * types offer — see `decisions.md`. Dynamic patterns are dropped from it here:
 * `/feed/[id]` is a template, not somewhere a user can land.
 */
type StaticRoute = Exclude<Route, `${string}[${string}]${string}`>;

/** A route that takes params, expressed as the call that builds its `Href`. */
type HrefFactory = (...args: never[]) => Href;

/**
 * The shape `ROUTES` is checked against. Every entry is either a literal path
 * that exists in `src/app/`, or a function whose return value is a valid
 * `Href` — pathname and params both.
 */
export type RouteRegistry = Readonly<Record<string, StaticRoute | HrefFactory>>;

/**
 * Every route in the app, named. Call sites navigate through these instead of
 * writing path strings, so a wrong path or a wrong param is a compile error
 * here — once, at the definition — rather than nowhere.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  onboarding: '/onboarding',
  settings: '/settings',
  style: '/style',
  addPost: '/feed/add-post',
  post: (id: string | number) => ({ pathname: '/feed/[id]', params: { id } }),
} as const satisfies RouteRegistry;
