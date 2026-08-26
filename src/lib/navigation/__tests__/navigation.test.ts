import type { Href } from 'expo-router';
import type { RouteRegistry } from '@/lib/navigation';

import { ROUTES } from '@/lib/navigation';

describe('rOUTES', () => {
  it('names every static route in src/app', () => {
    expect(ROUTES.home).toBe('/');
    expect(ROUTES.login).toBe('/login');
    expect(ROUTES.onboarding).toBe('/onboarding');
    expect(ROUTES.settings).toBe('/settings');
    expect(ROUTES.style).toBe('/style');
    expect(ROUTES.addPost).toBe('/feed/add-post');
  });

  it('builds a post href from an id, leaving the pathname as the template', () => {
    expect(ROUTES.post('42')).toEqual({ pathname: '/feed/[id]', params: { id: '42' } });
    expect(ROUTES.post(42)).toEqual({ pathname: '/feed/[id]', params: { id: 42 } });
  });
});

/**
 * The rest of this file asserts at the *type* level, and is checked by
 * `pnpm type-check`, not by Jest. A `@ts-expect-error` that stops erroring is
 * itself a compile error, so each one below is a live assertion: it fails the
 * build the day `RouteRegistry` stops catching what it claims to catch.
 */
describe('routeRegistry — what the satisfies clause catches', () => {
  it('is why the registry exists: a bare Href does not check the path', () => {
    // No `@ts-expect-error` here, deliberately. The generated `Href` union has
    // a `/${string}` member — contributed by the `[...messing]` catch-all — so
    // this nonsense path compiles. See decisions.md.
    const unchecked: Href = '/nope-not-a-route';

    expect(unchecked).toBe('/nope-not-a-route');
  });

  it('rejects a path that is not a route', () => {
    const registry = {
      // @ts-expect-error - '/nope-not-a-route' has no file in src/app
      home: '/nope-not-a-route',
    } as const satisfies RouteRegistry;

    expect(registry.home).toBe('/nope-not-a-route');
  });

  it('rejects a param the route does not declare', () => {
    const registry = {
      // @ts-expect-error - '/feed/[id]' declares `id`, not `wrong`
      post: (id: string) => ({ pathname: '/feed/[id]', params: { wrong: id } }),
    } as const satisfies RouteRegistry;

    expect(registry.post('1')).toEqual({ pathname: '/feed/[id]', params: { wrong: '1' } });
  });

  it('rejects a dynamic pattern used as a static path', () => {
    const registry = {
      // @ts-expect-error - '/feed/[id]' is a template; navigate via ROUTES.post
      post: '/feed/[id]',
    } as const satisfies RouteRegistry;

    expect(registry.post).toBe('/feed/[id]');
  });
});
