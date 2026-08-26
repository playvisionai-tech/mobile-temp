import { getItem, removeItem, setItem } from '@/lib/storage';

const TOKEN = 'token';

export type TokenType = {
  access: string;
  refresh: string;
};

export const getToken = () => getItem<TokenType>(TOKEN);
export const removeToken = async () => removeItem(TOKEN);
export const setToken = async (value: TokenType) => setItem<TokenType>(TOKEN, value);
