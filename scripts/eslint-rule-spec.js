/**
 * ESLint rule: every module under src/features/, src/lib/ and the
 * src/components/ui/ design system must carry a spec.md and a decisions.md.
 * scripts/spec-modules.js owns the module map and the per-module document
 * list, so this rule and scripts/check-specs.js can not drift apart.
 *
 * The rule reports once per module rather than once per file, so a 12-file
 * feature missing a spec produces one error instead of twelve. The bookkeeping
 * lives at module scope because ESLint creates a fresh rule context per file;
 * it is reset after a period of inactivity so that a long-lived language
 * server picks up newly created spec files instead of caching forever.
 *
 * This rule only sees the files eslint.config.mjs routes to it. It cannot see
 * spec drift (whether spec.md was updated alongside a code change) — that is
 * git-diff shaped and lives in scripts/check-specs.js.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  DECISIONS_FILE,
  getModuleDir,
  requiredDocs,
  SPEC_FILE,
} = require('./spec-modules.js');

const RUN_IDLE_MS = 5000;

let lastSeenAt = 0;
const existsCache = new Map();
const reportedModules = new Set();

function startOfLintPass() {
  const now = Date.now();
  if (now - lastSeenAt > RUN_IDLE_MS) {
    existsCache.clear();
    reportedModules.clear();
  }
  lastSeenAt = now;
}

function exists(filePath) {
  let hit = existsCache.get(filePath);
  if (hit === undefined) {
    hit = fs.existsSync(filePath);
    existsCache.set(filePath, hit);
  }
  return hit;
}

const MESSAGE_ID = {
  [SPEC_FILE]: 'missingSpec',
  [DECISIONS_FILE]: 'missingDecisions',
};

module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce spec.md and decisions.md exist for feature/lib/ui modules' },
    schema: [],
    messages: {
      missingSpec: 'Module "{{dir}}" has testable behavior but no spec.md. Create spec.md describing what it does today.',
      missingDecisions: 'Module "{{dir}}" has no decisions.md. Create it and record the trade-offs behind the module.',
    },
  },
  create(context) {
    const projectRoot = context.settings?.rootDir || context.cwd || process.cwd();
    const relPath = path.relative(projectRoot, context.filename);

    const moduleDir = getModuleDir(relPath);
    if (!moduleDir) {
      return {};
    }

    return {
      Program(node) {
        startOfLintPass();
        if (reportedModules.has(moduleDir)) {
          return;
        }

        // Report the first missing document only: one error per module keeps
        // the output readable, and creating it surfaces the next one.
        for (const doc of requiredDocs(moduleDir)) {
          if (!exists(path.join(projectRoot, moduleDir, doc))) {
            reportedModules.add(moduleDir);
            context.report({ node, messageId: MESSAGE_ID[doc], data: { dir: moduleDir } });
            return;
          }
        }
      },
    };
  },
};
