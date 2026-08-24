import { getClerkInstance } from '@clerk/expo';
import axios from 'axios';

type RequestHandler = (config: any) => Promise<any>;
type ResponseHandler = (value: any) => any;

const requestUse = jest.fn();
const responseUse = jest.fn();
const mockClient = {
  interceptors: {
    request: { use: requestUse },
    response: { use: responseUse },
  },
};

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn(() => mockClient) },
}));

jest.mock('@clerk/expo', () => ({
  getClerkInstance: jest.fn(),
}));

jest.mock('env', () => ({
  __esModule: true,
  default: {
    EXPO_PUBLIC_API_URL: 'https://api.example.com',
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    EXPO_PUBLIC_CLERK_JWT_TEMPLATE: 'mobile-api',
  },
}));

let requestHandler: RequestHandler;
let responseSuccess: ResponseHandler;
let responseFailure: ResponseHandler;

beforeAll(() => {
  jest.isolateModules(() => {
    require('../client');
  });
  requestHandler = requestUse.mock.calls[0][0];
  responseSuccess = responseUse.mock.calls[0][0];
  responseFailure = responseUse.mock.calls[0][1];
});

beforeEach(() => {
  jest.restoreAllMocks();
  jest.mocked(getClerkInstance).mockReset();
});

describe('api client', () => {
  it('uses the configured API URL', () => {
    expect(axios.create).toHaveBeenCalledWith({ baseURL: 'https://api.example.com' });
  });

  it('attaches a Clerk session token to requests', async () => {
    const getToken = jest.fn().mockResolvedValue('session-token');
    jest.mocked(getClerkInstance).mockReturnValue({ session: { getToken } } as never);
    const config = { headers: {} };

    await expect(requestHandler(config)).resolves.toBe(config);
    expect(getToken).toHaveBeenCalledWith({ template: 'mobile-api' });
    expect(config.headers).toEqual({ Authorization: 'Bearer session-token' });
  });

  it.each([
    ['there is no session', { session: null }],
    ['the session returns no token', { session: { getToken: jest.fn().mockResolvedValue(null) } }],
  ])('leaves public requests unauthenticated when %s', async (_label, clerk) => {
    jest.mocked(getClerkInstance).mockReturnValue(clerk as never);
    const config = { headers: {} };

    await requestHandler(config);

    expect(config.headers).toEqual({});
  });

  it('allows a request to continue when Clerk token lookup fails', async () => {
    const failure = new Error('token unavailable');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(getClerkInstance).mockReturnValue({
      session: { getToken: jest.fn().mockRejectedValue(failure) },
    } as never);
    const config = { headers: {} };

    await expect(requestHandler(config)).resolves.toBe(config);
    expect(warn).toHaveBeenCalledWith('Failed to get Clerk token:', failure);
  });

  it('passes successful responses through unchanged', () => {
    const response = { data: { id: 1 } };

    expect(responseSuccess(response)).toBe(response);
  });

  it('rejects non-auth failures without signing out', async () => {
    const signOut = jest.fn();
    jest.mocked(getClerkInstance).mockReturnValue({ signOut } as never);
    const failure = { response: { status: 500 } };

    await expect(responseFailure(failure)).rejects.toBe(failure);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out and preserves the original 401 failure', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    jest.mocked(getClerkInstance).mockReturnValue({ signOut } as never);
    const failure = { response: { status: 401 } };

    await expect(responseFailure(failure)).rejects.toBe(failure);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('preserves a 401 when Clerk sign-out also fails', async () => {
    const signOutFailure = new Error('sign-out unavailable');
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(getClerkInstance).mockReturnValue({
      signOut: jest.fn().mockRejectedValue(signOutFailure),
    } as never);
    const failure = { response: { status: 401 } };

    await expect(responseFailure(failure)).rejects.toBe(failure);
    expect(error).toHaveBeenCalledWith('Sign out error:', signOutFailure);
  });
});
