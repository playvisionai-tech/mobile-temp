const { getModuleDir } = require('../spec-modules.js');

describe('getModuleDir', () => {
  it('does not treat tests for loose lib files as a lib module', () => {
    expect(getModuleDir('src/lib/__tests__/storage.test.tsx')).toBeNull();
  });

  it('still maps tests nested inside a real lib module', () => {
    expect(getModuleDir('src/lib/api/__tests__/client.test.tsx')).toBe(
      'src/lib/api',
    );
  });
});
