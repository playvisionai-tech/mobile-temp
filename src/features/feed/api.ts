import type { AxiosError } from 'axios';
import { createMutation, createQuery } from 'react-query-kit';
import { client } from '@/lib/api';

// Types
export type Post = {
  userId: number;
  id: number;
  title: string;
  body: string;
};

// Hooks
type PostsResponse = Post[];
type PostsVariables = void;

export const usePosts = createQuery<PostsResponse, PostsVariables, AxiosError>({
  queryKey: ['posts'],
  fetcher: async () => {
    const response = await client.get<{ posts: PostsResponse }>(`posts`);
    return response.data.posts;
  },
});

type PostResponse = Post;
type PostVariables = { id: string };

export const usePost = createQuery<PostResponse, PostVariables, AxiosError>({
  queryKey: ['posts'],
  fetcher: async (variables) => {
    const response = await client.get<PostResponse>(`posts/${variables.id}`);
    return response.data;
  },
});

type AddPostResponse = Post;
type AddPostVariables = { title: string; body: string; userId: number };

export const useAddPost = createMutation<AddPostResponse, AddPostVariables, AxiosError>({
  mutationFn: async (variables) => {
    const response = await client<AddPostResponse>({
      url: 'posts/add',
      method: 'POST',
      data: variables,
    });
    return response.data;
  },
});
