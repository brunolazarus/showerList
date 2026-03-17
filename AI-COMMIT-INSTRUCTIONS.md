# AI Commit Instructions

Extracted from `AI-Guide.md` to guide implementation agents.

## 1. Branch Discipline

- Use explicit branch prefixes: `feature/`, `bug/`, `hotfix/`, `chore/`, `docs/`, `refactor/`, `test/`.
- Preferred promotion flow: working branch -> `dev` -> `main`.
- Avoid direct pushes to `main` in collaborative repositories.

## 2. Commit Cadence

- Make at least one meaningful checkpoint commit per day.
- Do not wait for one giant final commit.
- Commit after validated increments so rollback points stay clear.

## 3. Scope Rules Per Commit

- Keep diffs small and reviewable.
- Stay inside approved plan scope; avoid hidden scope expansion.
- Do not mix unrelated architecture changes into the same checkpoint.

## 4. Pre-Commit Validation

Run (or re-run if files changed):

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If any check fails, fix before committing (or explicitly record why it is intentionally deferred).

## 5. Commit Message Structure

Use a conventional subject and evidence-oriented body.

Subject format:

```text
<type>(<scope>): <short summary>
```

Suggested body template:

```text
Scope:
- What changed

Validation:
- typecheck: pass/fail
- lint: pass/fail
- test: pass/fail
- build: pass/fail

Risks:
- Key residual risks

Rollback:
- How to revert quickly
```

## 6. End-of-Day Log Discipline

- Reconcile work from `git log`, not memory.
- Ensure dated devlog includes:
  1. scope/repositories
  2. commit record
  3. delivered outcomes

## 7. Merge Evidence Standard (for PRs)

Every non-trivial PR should include:

1. checks executed (`lint`, types, tests, build)
2. behavior proof (logs/screenshots/repro steps)
3. risk notes (what can fail, how to detect)
4. rollback note

If this evidence is missing, treat the change as not ready.
