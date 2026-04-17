# Contributing to IntraClaw

Thanks for taking the time to contribute. This doc covers how to report bugs,
propose features, and submit code.

By participating in this project you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

---

## Reporting bugs

Open an issue using the **Bug report** template. Good reports include:

- What you expected to happen
- What actually happened
- Minimal reproduction steps
- Environment: OS, Node version, LLM provider, relevant env flags
- Relevant logs (redact any secrets)

---

## Proposing features

Open an issue using the **Feature request** template. Describe the problem
first, then the proposed solution. Drop-in new modules are easier to merge
than cross-cutting refactors.

---

## Submitting a pull request

1. **Fork** the repo and create a branch from `main`:
   - `feat/<short-name>` for features
   - `fix/<short-name>` for bug fixes
   - `docs/<short-name>` for documentation-only changes
   - `refactor/<short-name>` for refactors
2. **Make your changes.** Keep the scope tight — one PR, one concern.
3. **Lint, type-check, test** before pushing:
   ```bash
   npm run lint
   npm run build    # tsc --noEmit is fine too
   npm test
   ```
4. **Open the PR** against `main`. Fill in the template. Link related issues.
5. **Address review comments** by pushing new commits (no force-push during review).

We squash-merge by default, so your commit history inside the PR doesn't need
to be pristine — just keep the PR title Conventional-Commits-compatible.

---

## Coding style

- **TypeScript strict mode**. No `any` unless genuinely unavoidable — prefer
  `unknown` and narrow.
- **Semicolons on**, **2-space indent**, **single quotes** for strings.
- **Imports**: keep sorted (eslint handles it).
- **File layout**: one concept per file. If a file crosses ~400 lines, think
  about splitting.
- **Naming**: `camelCase` for functions/variables, `PascalCase` for types and
  classes, `SCREAMING_SNAKE_CASE` for env vars and constants.
- **Errors**: throw `Error` subclasses with enough context to debug from the
  log alone. Never swallow errors silently.
- **Logging**: use the shared `logger` from `src/utils/logger.ts` — never
  `console.log` in committed code.
- **Secrets**: never commit keys, tokens, user IDs, or personal identifiers.
  See `.env.example` for the right pattern.

---

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<optional body>

<optional footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`.

Examples:
- `feat(channels): add Matrix channel adapter`
- `fix(memory): avoid duplicate inserts on nightly consolidation`
- `docs(readme): clarify LLM provider discovery order`

---

## Branch naming

| Prefix      | Use for                             |
| ----------- | ----------------------------------- |
| `feat/`     | new features                        |
| `fix/`      | bug fixes                           |
| `docs/`     | documentation-only changes          |
| `refactor/` | internal changes, no behavior shift |
| `test/`     | adding or fixing tests              |
| `chore/`    | tooling, deps, build config         |

---

## What we won't merge

- Hardcoded credentials, user IDs, or personal data
- Breaking changes without a migration note and a `BREAKING CHANGE:` footer
- Giant "cleanup" PRs that mix formatting and behavior changes
- Features locked behind a paywall (billing hooks are fine — visible-by-default paywalls are not)

---

## Questions

Open a discussion or drop into an issue. We'd rather answer early than merge
something that has to be re-done.
