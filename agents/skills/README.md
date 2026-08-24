# agents/skills

Topic notes for the agent, one folder per topic. Each `README.md` maps a short
label to the real command that runs it. `agents/commands.md` is the same set in
one file — read that first if you just need a command.

**Only `add-dependency/` is a loadable skill.** A loadable skill is a `SKILL.md` with
frontmatter; these folders hold a `README.md` only. `.claude/skills` symlinks to
this directory, so they appear alongside real skills, but no agent can invoke
them by name.

## Folders that exist

| Folder     | Covers                                                    |
|------------|-----------------------------------------------------------|
| `add-dependency/` | **loadable skill** — adding a dependency or native module |
| `expo/`    | setup, prebuild, dev server, doctor, run on device         |
| `testing/` | jest, coverage, Maestro E2E, React Query devtools          |
| `lint/`    | eslint, type-check, translation lint, spec drift check     |
| `build/`   | EAS builds, version bump and release                       |
| `clerk/`   | where auth actually lives — there is no Clerk CLI          |

## Real skills

The loadable skills live in `.agents/skills/<name>/SKILL.md`: the `argent-*` set
(simulator and emulator control, debugging, profiling — see
`agents/rules/argent.md`) and `tdd`. Argent is the only MCP server in this repo
(`.mcp.json`).

## No skill for these

They are plain code paths, not tooling:

- **Storage** – `react-native-mmkv` through `src/lib/storage.tsx`. No CLI, no
  inspect or clear helper; read and write it from the app.
- **i18n** – `i18next` + `react-i18next`. Strings live in
  `src/translations/*.json`; `pnpm lint:translations` checks them. See
  `src/lib/i18n/spec.md`.
- **Scaffolding** – no generator. Copy `.templates/spec.md` and
  `.templates/decisions.md` into a new feature folder by hand.

To add a topic, create a folder here with a `README.md` and list only commands
that exist.
