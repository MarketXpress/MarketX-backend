## Summary

This pull request addresses the requirement to decouple linting validation in CI from the auto-fixing behavior used by developers. Previously, the primary `lint` command included the `--fix` flag, which could lead to unexpected mutations of source files during CI runs. 

The implementation now follows a strict validation-only approach for CI while providing a dedicated `lint:fix` command for local development, ensuring repository stability and consistent code quality without silent side effects.

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

## Implementation Details

### 1. Script Updates in `package.json`
- **`lint`**: Updated to be strictly validation-only. It now uses `--max-warnings=0` to ensure that any linting issue (even warnings) triggers a failure in the pipeline. Removed the `--fix` flag.
- **`lint:fix`**: Introduced a new script specifically for developers to use locally. This script retains the `--fix` functionality to allow for rapid style corrections.
- **`lint:issues`**: Maintained for focused checks on specific issue-related files.

### 2. CI/CD Pipeline Integration
- **`.github/workflows/ci.yml`**: Added a dedicated `Lint verification` step that executes `npm run lint`. This step is positioned early in the pipeline to provide fast feedback on code style compliance before running more intensive tests.

---

## Testing Steps

### Manual Verification (Local)
1.  **Validation Check**: Run `npm run lint`. Verify that it reports errors if they exist but does **not** change any files.
2.  **Auto-Fix Check**: Introduce a simple linting error (e.g., extra semicolon or incorrect quoting), then run `npm run lint:fix`. Verify that the error is automatically resolved.
3.  **Comprehensive Check**: Run `npm run pr:check` to ensure the new scripts integrate correctly with the existing verification suite.

### Automated Verification (CI)
- Once pushed, verify the `CI Pipeline` run on GitHub. The `Lint verification` step should pass successfully (or fail if issues are present), confirming the configuration is active.

---

## Migration Notes

No database or data migrations are required. Developers should update their workflow to use `npm run lint:fix` when they want to automatically resolve linting errors.

## Docs / Release Notes

- **Developers**: Use `npm run lint` for validation and `npm run lint:fix` for auto-fixing.
- **CI/CD**: The pipeline now enforces a zero-warning linting policy (`--max-warnings=0`) to maintain high code quality standards.
