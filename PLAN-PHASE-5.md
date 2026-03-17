# PLAN-PHASE-5.md - Hardening, Testing, and Packaging Readiness

## Objective

Harden the desktop app for reliability and prepare repeatable packaging checks.

## Files in Scope

| Action | File |
| --- | --- |
| Create | `vitest.config.ts` |
| Modify | `PLAN-TESTING.md` |
| Modify | `PLAN-DEPLOY.md` |
| Modify | `apps/desktop/package.json` |
| Modify | `apps/desktop/src/main/index.ts` |

## Hardening Workstreams

1. Test infrastructure
- Add root Vitest config with include/coverage rules.
- Add targeted tests for OAuth callbacks, timeout, and state mismatch.

2. Runtime safeguards
- Explicit startup validation for required env vars.
- Deterministic error states for auth bootstrap failures.

3. Packaging checks
- Add `electron-builder` config and package command in desktop package.
- Verify deep-link protocol registration in packaged app metadata.
- Verify icon assets exist before packaging.

4. Manual smoke checklist
- First launch
- Connect flow
- Command flow
- Restart token reuse
- No active device recovery

## Exit Criteria

- Mechanical checks all pass from workspace root.
- Coverage is generated and reviewed.
- Packaged app can launch and receive deep links.
- Release risks and rollback are recorded.

## Rollback

Revert packaging/hardening commits independently from feature logic where possible.
