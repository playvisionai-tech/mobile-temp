import { client } from '@/lib/api';

import { useAddPost, usePost, usePosts } from '../api';

jest.mock('@/lib/api', () => ({
  client: Object.assign(jest.fn(), { get: jest.fn() }),
}));

const mockedClient = client as unknown as jest.Mock & { get: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('feed API', () => {
  it('returns the posts from the feed response', async () => {
    mockedClient.get.mockResolvedValue({
      data: { posts: [{ id: 1, userId: 1, title: 'First', body: 'Body' }] },
    });

    await expect(usePosts.fetcher(undefined)).resolves.toEqual([
      { id: 1, userId: 1, title: 'First', body: 'Body' },
    ]);
    expect(mockedClient.get).toHaveBeenCalledWith('posts');
  });

  it('returns the requested post', async () => {
    mockedClient.get.mockResolvedValue({
      data: { id: 7, userId: 1, title: 'Seventh', body: 'Body' },
    });

    await expect(usePost.fetcher({ id: '7' })).resolves.toEqual({
      id: 7,
      userId: 1,
      title: 'Seventh',
      body: 'Body',
    });
    expect(mockedClient.get).toHaveBeenCalledWith('posts/7');
  });

  it('creates a post and returns the server representation', async () => {
    const variables = { title: 'A useful title', body: 'A complete body', userId: 1 };
    mockedClient.mockResolvedValue({ data: { id: 11, ...variables } });

    await expect(useAddPost.mutationFn(variables, {} as never)).resolves.toEqual({
      id: 11,
      ...variables,
    });
    expect(mockedClient).toHaveBeenCalledWith({
      url: 'posts/add',
      method: 'POST',
      data: variables,
    });
  });
});
