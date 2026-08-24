import { getItem, removeItem, setItem } from '@/lib/storage';

import { getToken, removeToken, setToken } from '../utils';

jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('legacy token helpers', () => {
  it('reads the token key', () => {
    getToken();

    expect(getItem).toHaveBeenCalledWith('token');
  });

  it('writes the token key', () => {
    const token = { access: 'access-token', refresh: 'refresh-token' };

    setToken(token);

    expect(setItem).toHaveBeenCalledWith('token', token);
  });

  it('removes the token key', () => {
    removeToken();

    expect(removeItem).toHaveBeenCalledWith('token');
  });
});
