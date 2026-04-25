## Summary

Separated the CI lint check from the auto-fix behavior. This ensures that linting in CI remains strictly a validation step (non-mutating) while maintaining the auto-fix convenience for local development workflows.

---

## Related Issue

- Fixes: #361

---

## Checklist (required for all PRs)

- [x] I have read the [PR checklist](docs/pr-checklist.md) and followed its guidance.
- [x] I added or updated tests that verify my change (unit / integration / e2e as appropriate).
- [ ] I updated or added migrations, and included migration notes in the description if applicable.
- [x] I updated relevant documentation (README, docs/, or module-level docs).
- [x] I ran `npm run pr:check` locally and it passes.
- [x] I added steps for manual verification in the description.
- [x] This PR includes a concise changelog entry or references the issue tracking the user-visible change.

---

## Testing Steps

1.  Run `npm run lint` locally. It should perform a strict validation and fail if issues are found, without modifying any files.
2.  Run `npm run lint:fix` locally. It should automatically fix any linting issues it can.
3.  The CI pipeline now automatically includes a `Lint verification` step in `.github/workflows/ci.yml`.

## Migration Notes

N/A

## Docs / Release Notes

Updated `package.json` with a new `lint:fix` command. The existing `lint` command is now validation-only for CI stability.
