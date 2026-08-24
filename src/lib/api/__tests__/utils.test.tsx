import {
  getNextPageParam,
  getPreviousPageParam,
  getQueryKey,
  getUrlParameters,
  normalizePages,
} from '../utils';

describe('api pagination helpers', () => {
  it('builds stable query keys with optional parameters', () => {
    expect(getQueryKey('posts')).toEqual(['posts']);
    expect(getQueryKey('posts', { limit: 10 })).toEqual(['posts', { limit: 10 }]);
  });

  it('normalizes absent and paginated results', () => {
    expect(normalizePages()).toEqual([]);
    expect(normalizePages([])).toEqual([]);
    expect(normalizePages([
      { results: [1, 2], count: 3, next: '/posts?offset=2', previous: null },
      { results: [3], count: 3, next: null, previous: '/posts?offset=0' },
    ])).toEqual([1, 2, 3]);
  });

  it('extracts query parameters from URLs', () => {
    expect(getUrlParameters(null)).toBeNull();
    expect(getUrlParameters('/posts')).toEqual({});
    expect(getUrlParameters('/posts?offset=20&limit=10')).toEqual({
      offset: '20',
      limit: '10',
    });
  });

  it('reads page offsets and falls back to null', () => {
    const page = {
      results: [],
      count: 0,
      next: '/posts?offset=20',
      previous: '/posts?offset=0',
    };

    expect(getNextPageParam(page, [], undefined as never, undefined as never)).toBe('20');
    expect(getPreviousPageParam(page, [], undefined as never, undefined as never)).toBe('0');
    expect(getNextPageParam({ ...page, next: null }, [], undefined as never, undefined as never)).toBeNull();
    expect(getPreviousPageParam({ ...page, previous: null }, [], undefined as never, undefined as never)).toBeNull();
  });
});
