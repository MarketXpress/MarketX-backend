# Contributing to MarketX Backend Engine

First off, thank you for considering contributing to MarketX! It's people like you that make MarketX such a great tool.

This guide will help you get started with your first contribution. Please read it thoroughly to understand our development workflow and standards.

---

## 🚀 Getting Started

### 1. Prerequisites

Ensure you have the following installed:
- **Node.js** (v18+)
- **npm** (v9+)
- **Docker** & **Docker Compose**

### 2. Fork and Clone

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/MarketX-backend.git
   cd MarketX-backend
   ```
3. Add the upstream repository as a remote:
   ```bash
   git remote add upstream https://github.com/Cybermaxi7/MarketX-backend.git
   ```

### 3. Environment Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in the necessary credentials.

### 4. Local Infrastructure

We use Docker Compose to spin up the required services (PostgreSQL, Redis, RabbitMQ).
```bash
docker compose --profile local-dev up -d
```
For more details, see [docs/local-infra.md](docs/local-infra.md).

---

## 🛠️ Development Workflow

### Branching Strategy

- Always create a new branch for your work:
  - `feature/your-feature-name` for new features.
  - `bugfix/your-fix-name` for bug fixes.
  - `refactor/your-refactor-name` for code improvements.
  - `docs/your-doc-update` for documentation changes.

### Coding Standards

We use ESLint and Prettier to maintain code quality and consistency.
- **Linting**: `npm run lint` (validation only)
- **Auto-fixing lint issues**: `npm run lint:fix`
- **Formatting**: `npm run format`
- **Typechecking**: `npm run typecheck`

#### Helpful Scripts
- **Makefile**: We provide a `Makefile` with common commands. Run `make help` to see all available targets.
- **Git Hooks**: You can set up a pre-commit hook that runs linting and typechecking by running:
  ```bash
  ./scripts/setup_hooks.sh
  ```

Please ensure your code passes linting and typechecking before submitting a PR.

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat: ...` for new features.
- `fix: ...` for bug fixes.
- `docs: ...` for documentation changes.
- `style: ...` for formatting, missing semi colons, etc.
- `refactor: ...` for code changes that neither fix a bug nor add a feature.
- `test: ...` for adding missing tests or correcting existing tests.
- `chore: ...` for updating build tasks, package manager configs, etc.

---

## 🧪 Testing

We value high test coverage. Ensure you add tests for any new features or bug fixes.

- **Run all tests**: `npm run test`
- **Run pre-PR confidence suite**: `npm run pr:check`
- **Watch mode**: `npm run test:watch`
- **Check coverage**: `npm run test:cov`

For specific testing guides, see:
- [docs/PACT_CONTRACT_TESTING.md](docs/PACT_CONTRACT_TESTING.md)
- [docs/AUDIT_TESTING_GUIDE.md](docs/AUDIT_TESTING_GUIDE.md)

---

## 📖 Documentation

- **API Docs**: If you change API endpoints, update the Swagger metadata in your controllers and run:
  ```bash
  npm run docs:generate
  ```
- **ADRs**: For significant architectural changes, please add or update an Architectural Decision Record in `docs/adr/`. See [docs/adr/README.md](docs/adr/README.md).

---

## 📤 Submission Process

1. **Rebase**: Ensure your branch is up to date with `upstream/develop` (or `main` as specified in the issue).
2. **Confidence Check**: Run `npm run pr:check`.
3. **Push**: Push your branch to your fork.
4. **Open PR**: Open a Pull Request against the `develop` branch of the upstream repository.
5. **PR Checklist**: Follow the [PR Quality Checklist](docs/pr-checklist.md) and use our PR template.

---

## 💬 Communication

- **Issues**: Use the provided [issue templates](.github/ISSUE_TEMPLATE/) to report bugs or request features.
- **Discussions**: For general questions, use GitHub Discussions.

---

Thank you for your contribution! 🚀
