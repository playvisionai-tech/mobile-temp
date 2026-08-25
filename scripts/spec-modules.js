/**
 * What the spec system considers a "module", and which documents each module
 * owes. This file is the single source of truth for both enforcers:
 *
 *   - scripts/check-specs.js       git-diff based, run locally and in CI
 *   - scripts/eslint-rule-spec.js  in-editor / `pnpm lint` feedback
 *
 * They previously carried two copies of these rules, and the copies drifted
 * away from AGENTS.md: both required decisions.md for src/features/* only,
 * while the guide requires spec.md AND decisions.md for every feature, lib
 * module and the UI kit. Keep the rules here so that can not happen again.
 */

const SPEC_FILE = 'spec.md';
const DECISIONS_FILE = 'decisions.md';

// src/components/ui is ONE module: individual primitives do not get their own
// spec, the inventory at src/components/ui/spec.md covers all of them.
const UI_MODULE = 'src/components/ui';

// src/app is ONE module too. Its spec.md is the route inventory — which URLs
// exist and which feature screen each one renders — not a copy of the feature
// specs, which stay the source of truth for screen behavior. The two _layout
// files do own real behavior (navigator shape, the auth/onboarding guard), and
// that belongs in the inventory too. Navigation structure and guard ordering
// are choices rather than behavior, so they go in src/app/decisions.md.
const ROUTING_MODULE = 'src/app';

// These, in contrast, are namespaces: each direct subdirectory is a module.
const MODULE_PARENTS = ['src/features/', 'src/lib/'];

/**
 * Map a repo-relative file path to the module directory that owns it.
 * Returns null when the file belongs to no module — notably for loose files
 * sitting directly in src/features/ or src/lib/ (e.g. src/lib/test-utils.tsx),
 * which are not modules of their own.
 */
function getModuleDir(file) {
  const p = file.replaceAll('\\', '/');

  for (const single of [UI_MODULE, ROUTING_MODULE]) {
    if (p.startsWith(`${single}/`)) {
      return single;
    }
  }

  for (const base of MODULE_PARENTS) {
    if (!p.startsWith(base)) {
      continue;
    }
    const rest = p.slice(base.length);
    const slash = rest.indexOf('/');
    // No slash left => a loose file directly inside src/features/ or src/lib/.
    if (slash <= 0) {
      return null;
    }
    const moduleName = rest.slice(0, slash);
    // Tests for loose namespace files live in src/{features,lib}/__tests__.
    // That directory is placement infrastructure, not a feature/lib module.
    if (moduleName === '__tests__') {
      return null;
    }
    return base + moduleName;
  }

  return null;
}

/**
 * The documents a module must carry, in reporting order.
 * Every module owes both — features, lib modules, the UI kit and src/app.
 */
function requiredDocs() {
  return [SPEC_FILE, DECISIONS_FILE];
}

/** Is this changed file one of the module's own documents rather than code? */
function isModuleDoc(file) {
  const name = file.replaceAll('\\', '/').split('/').pop();
  return name === SPEC_FILE || name === DECISIONS_FILE;
}

/**
 * Is this a test rather than the code under test?
 *
 * The drift rule asks for a spec rewrite when a module's code changes. Adding
 * or fixing a test changes no observable behavior, so demanding a spec edit for
 * it produces exactly the padding AGENTS.md tells you not to write. Tests still
 * count for the "module exists" check — only the freshness rule skips them.
 *
 * Covers both layouts in the repo: `__tests__/` folders (the documented
 * convention) and the colocated `*.test.tsx` files in components/ui.
 */
function isTestFile(file) {
  const p = file.replaceAll('\\', '/');
  return p.includes('/__tests__/') || /\.(?:test|spec)\.[jt]sx?$/.test(p);
}

module.exports = {
  DECISIONS_FILE,
  getModuleDir,
  isModuleDoc,
  isTestFile,
  MODULE_PARENTS,
  requiredDocs,
  ROUTING_MODULE,
  SPEC_FILE,
  UI_MODULE,
};
