# Contributing to MarketXpress Backend

Thank you for contributing! This guide covers everything you need to get your PR merged.

---

## Before You Start

1. **Find or create an issue** — every PR should be linked to a GitHub issue. If one doesn't exist for your change, open one first.
2. **Comment on the issue** to let others know you're working on it.
3. **Read the issue description fully** before writing a single line of code.

---

## Setup

```bash
git clone https://github.com/MarketXpress/MarketX-backend.git
cd MarketX-backend
npm install
cp .env.example .env   # fill in your local values
npm run start:dev       # confirm the server boots
curl http://localhost:3000/health/live  # should return {"status":"up"}
```

---

## Workflow

### 1. Create a branch

Branch off `main` using this naming convention:

```
feat/<issue-number>-short-description
fix/<issue-number>-short-description
chore/<issue-number>-short-description
```

Example: `feat/42-add-payment-module`

### 2. Write your code

- Keep changes scoped to what the issue asks for — no unrelated cleanup in the same PR
- Follow the existing module structure (`controller → service → module → entity`)
- Do not add `console.log` — use the injected `LoggerService`
- Do not disable TypeScript strict checks (`@ts-ignore`, `as any`) without a clear comment explaining why

### 3. Write tests

**This is a hard requirement.** PRs that add or change logic without tests will not be merged.

- Place unit tests in the same directory as the file being tested, named `*.spec.ts`
- Every new service method should have at least one passing test
- Every bug fix should have a test that would have caught the regression

### 4. Make sure all tests pass

```bash
npm run pr:check
```

This runs lint, TypeScript typecheck, and the full test suite. **All three must pass cleanly** before you open a PR. If any check was already failing before your change, note it in the PR description — but do not introduce new failures.

### 5. Open the PR

- Title: `feat(module): short description` — follow the issue's scope
- Body: link the issue (`Closes #42`), describe what changed and why, list any decisions made
- Keep PRs small and focused — one issue per PR

---

## Code Standards

### TypeScript

- Strict mode is on — no implicit `any`
- Use DTOs with `class-validator` decorators for all request bodies
- Use `@Injectable()` services, never raw functions for business logic

### NestJS conventions

- One module per domain folder
- Export only what other modules need (keep `providers` private by default)
- Use `@InjectRepository()` for TypeORM repos, never instantiate repos directly

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(orders): add order cancellation endpoint
fix(auth): prevent token reuse after refresh
chore(deps): update @nestjs/common to 10.4
```

---

## What CI Checks

Every push and PR runs:

| Check | Command | Must pass |
|---|---|---|
| Formatting | `npm run format:check` | Yes |
| Lint | `npm run lint` | Yes (0 warnings) |
| TypeScript | `npm run typecheck` | Yes |
| Tests | `npm test` | Yes |
| Secret scan | Gitleaks | Yes |
| Dependency audit | `npm audit` | Yes (moderate+) |

Run `npm run pr:check` locally to catch everything before pushing.

---

## Adding a New Module

New modules follow this checklist:

- [ ] `src/<module>/<module>.module.ts`
- [ ] `src/<module>/<module>.controller.ts`
- [ ] `src/<module>/<module>.service.ts`
- [ ] `src/<module>/entities/<module>.entity.ts` (if it has a DB table)
- [ ] `src/<module>/dto/*.dto.ts` (with validation decorators)
- [ ] `src/<module>/<module>.service.spec.ts` (unit tests)
- [ ] Module registered in `src/app.module.ts`
- [ ] README API table updated (if endpoints are added)

---

## Questions?

Open a [GitHub Discussion](https://github.com/MarketXpress/MarketX-backend/discussions) or comment on the issue you're working on.
