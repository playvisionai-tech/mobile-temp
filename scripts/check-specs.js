#!/usr/bin/env node
/**
 * Spec drift check.
 *
 * Every module under src/features/<name>/, src/lib/<name>/ and the
 * src/components/ui/ design system must carry a spec.md AND a decisions.md.
 * src/app/ is the one decisions-only module: routes are re-exports, so their
 * behavior belongs to the feature's spec, but routing structure and guard
 * ordering are real decisions and go in src/app/decisions.md.
 * scripts/spec-modules.js owns that map; this script only applies it.
 *
 * This script looks at what changed and fails when a changed module either
 *   - is missing one of the documents it owes, or
 *   - had code change without its spec.md changing in the same set
 *     (the actual "drift" in drift check — see agents/rules/ci-cd-rules.md).
 * decisions.md is existence-only: it is append-only and only for genuine
 * trade-offs, so demanding an entry per change would manufacture noise.
 *
 * Usage:
 *   node scripts/check-specs.js                 # staged changes, falling back
 *                                               # to the working tree vs HEAD
 *   node scripts/check-specs.js --base <ref>    # everything changed since <ref>
 *                                               # (used by CI on pull requests)
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const {
  getModuleDir,
  isModuleDoc,
  requiredDocs,
  SPEC_FILE,
} = require('./spec-modules.js');

const WHY = {
  'spec.md': 'describe what the module does today',
  'decisions.md': 'record the trade-offs behind it',
};

function parseArgs(argv) {
  let base = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') {
      base = argv[++i];
    }
    else if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    }
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (base !== null && !base) {
    throw new Error('--base requires a git ref');
  }
  return { base };
}

function git(args, cwd) {
  // core.quotepath=false + -z keeps non-ASCII paths and paths with spaces
  // readable instead of C-quoted.
  const out = execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.split('\0').filter(Boolean);
}

function repoRoot() {
  return git(['rev-parse', '--show-toplevel'], __dirname)[0].trim();
}

/**
 * Collect the changed files to inspect.
 * --diff-filter=ACMR skips deletions, so removing a feature folder (which also
 * removes its spec.md) does not report that spec as missing.
 */
function collectChanges(root, base) {
  if (base) {
    return {
      label: `changes since ${base}`,
      files: git(['diff', '-z', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`], root),
    };
  }

  // Decide the mode on the unfiltered staged set, so that a commit which only
  // stages deletions is still treated as "staged" rather than falling through
  // to an unrelated dirty working tree.
  if (git(['diff', '--cached', '-z', '--name-only'], root).length > 0) {
    return {
      label: 'staged changes',
      files: git(['diff', '--cached', '-z', '--name-only', '--diff-filter=ACMR'], root),
    };
  }

  // Nothing staged: fall back to the working tree so that running the check
  // before staging (as the docs tell you to) is not a silent no-op.
  return {
    label: 'working tree vs HEAD',
    files: [
      ...git(['diff', '-z', '--name-only', '--diff-filter=ACMR', 'HEAD'], root),
      ...git(['ls-files', '-z', '--others', '--exclude-standard'], root),
    ],
  };
}

/**
 * Group the changed files by owning module, splitting each module's changes
 * into its own documents and everything else ("code").
 */
function groupByModule(files) {
  const modules = new Map();
  for (const file of files) {
    const mod = getModuleDir(file);
    if (!mod) {
      continue;
    }
    let entry = modules.get(mod);
    if (!entry) {
      entry = { changedDocs: new Set(), codeChanged: false };
      modules.set(mod, entry);
    }
    if (isModuleDoc(file)) {
      entry.changedDocs.add(path.posix.basename(file.replaceAll('\\', '/')));
    }
    else {
      entry.codeChanged = true;
    }
  }
  return modules;
}

function inspect(root, modules) {
  const problems = [];

  for (const mod of [...modules.keys()].sort()) {
    const { changedDocs, codeChanged } = modules.get(mod);
    const required = requiredDocs(mod);

    for (const doc of required) {
      if (!fs.existsSync(path.join(root, mod, doc))) {
        problems.push({
          file: `${mod}/${doc}`,
          message: `${mod} changed but has no ${doc} — ${WHY[doc]}`,
        });
      }
    }

    // Drift: code moved, the spec did not. Only meaningful once the spec
    // exists (otherwise the missing-file problem above already says it).
    const needsSpec = required.includes(SPEC_FILE)
      && fs.existsSync(path.join(root, mod, SPEC_FILE));
    if (codeChanged && needsSpec && !changedDocs.has(SPEC_FILE)) {
      problems.push({
        file: `${mod}/${SPEC_FILE}`,
        message: `${mod} has code changes but ${mod}/${SPEC_FILE} is untouched — rewrite it to describe the new behavior (or state why nothing observable changed)`,
      });
    }
  }

  return problems;
}

function main() {
  const { base } = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const { label, files } = collectChanges(root, base);
  const modules = groupByModule(files);
  const problems = inspect(root, modules);

  if (problems.length > 0) {
    console.error(`check-specs: ${problems.length} problem(s) in ${label}\n`);
    for (const problem of problems) {
      console.error(`  ✖ ${problem.message}`);
      if (process.env.GITHUB_ACTIONS === 'true') {
        console.error(`::error file=${problem.file}::${problem.message}`);
      }
    }
    console.error('\nSee .templates/spec.md for the expected shape.');
    process.exit(1);
  }

  console.log(`check-specs: ${modules.size} module(s) checked in ${label} — specs present and in sync.`);
}

try {
  main();
}
catch (error) {
  console.error(`check-specs: ${error.message}`);
  process.exit(1);
}
