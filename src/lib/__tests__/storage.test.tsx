import { getItem, removeItem, setItem, storage } from '@/lib/storage';

const getString = storage.getString as jest.Mock;
const set = storage.set as jest.Mock;
const remove = storage.remove as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('storage', () => {
  it('returns the stored JSON value', () => {
    getString.mockReturnValueOnce('{"enabled":true}');

    expect(getItem('settings')).toEqual({ enabled: true });
  });

  it.each([undefined, '', 'null'])('returns null for an empty value (%p)', (value) => {
    getString.mockReturnValueOnce(value);

    expect(getItem('settings')).toBeNull();
  });

  it('serializes values before storing them', async () => {
    await setItem('settings', { enabled: true });

    expect(set).toHaveBeenCalledWith('settings', '{"enabled":true}');
  });

  it('removes values by key', async () => {
    await removeItem('settings');

    expect(remove).toHaveBeenCalledWith('settings');
  });
});
