<!--
Please fill out the sections below when opening a Pull Request.
This template is designed to help maintainers and reviewers quickly validate changes.
-->

# Summary

Provide a short description of the change. Reference related issue(s):

Resolves: #<issue-number> (if applicable)

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Tests
- [ ] Chore / Maintenance

## Checklist

- [ ] Tests added/updated (unit and/or integration)
- [ ] Migrations included (if applicable) and migration notes provided below
- [ ] Documentation updated (README, docs/, or module-level docs)
- [ ] Manual verification steps included
- [ ] CI is green for this branch
- [ ] Changelog entry added or linked to an issue

## Migration Notes

If this change requires schema or data migrations, include:

- migration file paths
- commands to run the migration and rollback
- expected downtime or rollout notes

## How to run tests locally

Provide the commands and any env/setup required to run the tests locally, for example:

```
# install deps
npm ci

# run unit tests
npm run test:unit

# run integration/e2e (if applicable)
npm run test:integration
```

## Verification steps

List manual steps a reviewer can use to validate the change.

## Additional context

If this PR touches sensitive domains (payments, escrow, reconciliation, migrations involving money), add a high-level design note and request a core-team reviewer.

---

See docs/pr-checklist.md for more guidance on expectations for tests, migrations, and documentation.
## Summary

Short description of the change and the problem it solves.

---

## Related Issue

- Fixes: # (issue number)

---

## Checklist (required for all PRs)

- [ ] I have read the [PR checklist](docs/pr-checklist.md) and followed its guidance.
- [ ] I added or updated tests that verify my change (unit / integration / e2e as appropriate).
- [ ] I updated or added migrations, and included migration notes in the description if applicable.
- [ ] I updated relevant documentation (README, docs/, or module-level docs).
- [ ] I ran `npm run pr:check` locally and it passes.
- [ ] I added steps for manual verification in the description.
- [ ] This PR includes a concise changelog entry or references the issue tracking the user-visible change.

---

## Testing Steps

Describe how to run the tests and verify the change locally.

## Migration Notes

If this change requires database migrations or data migrations, document them here (how to run, rollback plan, risk notes).

## Docs / Release Notes

If this change affects usage, configuration, or public APIs, include the updated docs and a short release note.
