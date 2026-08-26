/**
 * Fake `@clerk/expo/token-cache`, swapped in by metro.config.js when
 * MOCK_AUTH=1.
 *
 * The real one persists the Clerk session to expo-secure-store so it survives a
 * cold start. This one is a deliberate no-op: the mock session lives in module
 * memory and resets on every reload, so there is nothing to persist and nothing
 * to restore. That is the main fidelity gap — see ./README.md.
 */

export const tokenCache = {
  async getToken(_key: string): Promise<string | null> {
    return null;
  },
  async saveToken(_key: string, _token: string): Promise<void> {},
  async clearToken(_key: string): Promise<void> {},
};

export default tokenCache;
