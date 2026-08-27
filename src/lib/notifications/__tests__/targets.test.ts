import { resolveNotificationTarget } from '@/lib/notifications/targets';

describe('resolving a destination from a push payload', () => {
  it('resolves a static route the app allows', () => {
    expect(resolveNotificationTarget({ route: 'settings' })).toBe('/settings');
    expect(resolveNotificationTarget({ route: 'home' })).toBe('/');
    expect(resolveNotificationTarget({ route: 'style' })).toBe('/style');
    expect(resolveNotificationTarget({ route: 'addPost' })).toBe('/feed/add-post');
  });

  it('resolves a route that takes a parameter', () => {
    expect(resolveNotificationTarget({ route: 'post', id: '42' })).toStrictEqual({
      pathname: '/feed/[id]',
      params: { id: '42' },
    });
  });

  it('ignores a payload that names no route', () => {
    expect(resolveNotificationTarget({ title: 'hello' })).toBeNull();
    expect(resolveNotificationTarget({})).toBeNull();
    expect(resolveNotificationTarget(undefined)).toBeNull();
  });

  it('refuses a route name the allow-list does not carry', () => {
    expect(resolveNotificationTarget({ route: 'admin' })).toBeNull();
    expect(resolveNotificationTarget({ route: '/settings' })).toBeNull();
  });

  it('refuses login and onboarding, which the guard owns', () => {
    expect(resolveNotificationTarget({ route: 'login' })).toBeNull();
    expect(resolveNotificationTarget({ route: 'onboarding' })).toBeNull();
  });

  it('does not resolve an inherited property as a route', () => {
    expect(resolveNotificationTarget({ route: 'constructor' })).toBeNull();
    expect(resolveNotificationTarget({ route: 'toString' })).toBeNull();
    expect(resolveNotificationTarget({ route: '__proto__' })).toBeNull();
  });

  it('refuses a parameter that could escape its segment', () => {
    expect(resolveNotificationTarget({ route: 'post', id: '../../settings' })).toBeNull();
    expect(resolveNotificationTarget({ route: 'post', id: 'a b' })).toBeNull();
    expect(resolveNotificationTarget({ route: 'post', id: '' })).toBeNull();
    expect(resolveNotificationTarget({ route: 'post', id: 'x'.repeat(65) })).toBeNull();
  });

  it('refuses a parameter that is missing or not a string', () => {
    expect(resolveNotificationTarget({ route: 'post' })).toBeNull();
    expect(resolveNotificationTarget({ route: 'post', id: 42 })).toBeNull();
    expect(resolveNotificationTarget({ route: 'post', id: { id: '42' } })).toBeNull();
  });

  it('ignores a route name that is not a string', () => {
    expect(resolveNotificationTarget({ route: 7 })).toBeNull();
    expect(resolveNotificationTarget({ route: ['settings'] })).toBeNull();
  });

  it('is unbothered by anything else in the payload', () => {
    expect(resolveNotificationTarget({ route: 'post', id: '9', extra: { deep: true } })).toStrictEqual({
      pathname: '/feed/[id]',
      params: { id: '9' },
    });
  });
});
