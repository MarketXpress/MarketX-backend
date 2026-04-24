# PR Quality Checklist

This document explains the expectations contributors must meet when opening a Pull Request.

Purpose: ensure consistent quality, prevent regressions, and make reviews faster.

## Required items

- Quick confidence suite: run `npm run pr:check` before opening the PR so the maintained issue-slice lint, typecheck, and focused regression test all pass together.
- Tests: include unit and/or integration tests that cover the change. For bug fixes, add regression tests.
- Migrations: if schema or data changes are required, add migration files and clear instructions on applying/rolling back.
- Documentation: update `README.md`, `docs/`, module-level docs, or generated API docs for any user-facing or developer-facing change.
- Security: confirm no new secrets or high/critical dependency vulnerabilities are introduced.
- ADRs: add or update an ADR in `docs/adr/` when the change affects architecture, module boundaries, infrastructure roles, or long-lived domain workflows.
- Coverage: run the test suite locally; the change should not reduce global coverage meaningfully for the touched area.
- Issue link: reference an open issue or explain the motivation if one does not exist.
- Changelog: add a short entry explaining the user-visible impact (or link to the issue). This helps release notes.

## Validation checklist to include in PR description

- [ ] Tests added/updated
- [ ] Migrations included (if applicable) and instructions provided
- [ ] Documentation updated
- [ ] ADR updated or added when architecture changed
- [ ] Manual verification steps added
- [ ] CI green (unit + e2e where relevant)

## Migration guidance

- Use the repository's migration tooling (see `migrations/` or project scripts). If none exists, document the SQL to run.
- Include backwards-compatibility notes and an expected downtime window, if any.

## Testing guidance

- Use `npm run pr:check` as the default pre-PR command for fast confidence on the maintained issue slice.
- Unit tests should be fast (<100ms each) and deterministic.
- Integration/e2E tests should run in CI; local runs should be possible with the `local-dev` docker profile.

## When to ask for help

If a change touches complex domains (payments, escrow, reconciliation, migrations involving money), request a reviewer from the core team and add a high-level design note in the PR.

## Reviewer expectations

- Confirm tests cover the change and are meaningful.
- Confirm migrations have safe rollout and rollback plans.
- Validate documentation updates or request clarifying documentation before merge.

---

Thank you for contributing — clear PRs make everyone's life easier.

## PR template

We provide an official PR template at `.github/PULL_REQUEST_TEMPLATE.md` that surfaces the checklist items automatically when opening a Pull Request. Please use that template — it includes sections for migrations, documentation changes, test instructions, and changelog notes.
