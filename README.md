<div align="center">
  <h1>🛒 MarketX Backend Engine</h1>
  <p><strong>A high-concurrency, scalable marketplace API built with NestJS, Postgres, and Redis.</strong></p>
  
  <a href="https://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</div>

<br />

## 📖 About MarketX

**MarketX** is an ambitious open-source marketplace backend engineered for scale, fraud resistance, and lightning-fast developer experience. Designed initially to power peer-to-peer (P2P) commerce, it provides an expansive suite of tightly coupled e-commerce micro-features.

We are currently undertaking a massive open-source contribution wave (via **Drips**) to fortify the architecture, refactor technical debt, and build out enterprise-grade systems like Escrow and AI Fraud Detection.

### ✨ Core Features & Domains

- **🛍️ Order & Inventory Engine**: Handles concurrent checkout flows, preventing atomic overselling via database locking mechanisms.
- **🏦 Escrow & Payments**: Securely holds buyer funds in transit and conditionally releases them to sellers upon confirmed delivery. (Currently being wired to Stripe Connect).
- **🛡️ Fraud Detection**: Analyzes heuristics (IP, velocity, value) to algorithmically score and halt suspicious transactions in real-time.
- **🧠 Recommendation Engine**: Utilizes browsing history and collaborative filtering to deliver personalized product feeds.
- **🔄 Refunds & Returns**: Complex workflows allowing buyers to initiate disputes and request refunds securely.
- **📳 Real-Time Notifications**: Internal dispatcher emitting WebSocket, Email, and SMS alerts for critical lifecycle events.
- **🐇 Queue & Event Backbone**: Bull-backed workers handle emails, recommendation refreshes, and image processing while RabbitMQ fan-out exchanges broadcast domain events for future microservices.

---

## 🛠️ Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (Node.js / TypeScript)
- **Database**: PostgreSQL (via [TypeORM](https://typeorm.io/))
- **Caching & Rate Limiting**: Redis
- **Testing**: Jest (Unit & E2E) & Supertest

---

## 🚀 Getting Started

Follow these instructions to spin up your local development environment.

### 1. Prerequisites

Ensure you have the following installed on your machine:

- **Node.js** (v18+)
- **npm** or **yarn**
- **Docker** & **Docker Compose** (for spinning up Postgres and Redis easily)

### 2. Installation

Clone the repository and install the Node dependencies:

```bash
git clone https://github.com/Cybermaxi7/MarketX-backend.git
cd MarketX-backend
npm install
```

### 3. Environment Setup

_(Note: As we transition into the open-source phase, we are currently integrating a `docker-compose.yml` to streamline setup)._

For now, assure you have a running **PostgreSQL 15** database and a **Redis** server. Copy the `.env.example` file to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

Then edit `.env` with your specific configuration. The application will validate required environment variables at startup and provide clear error messages for missing or invalid configurations.

**Required Environment Variables:**
- `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` - PostgreSQL connection
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` - Authentication secrets (must be at least 32 characters)

**Optional but Recommended:**
- `REDIS_HOST`, `REDIS_PORT` - Redis connection for caching and rate limiting
- `AMQP_URL` - RabbitMQ for event messaging
- `STRIPE_API_KEY` - Payment processing
- `SENDGRID_API_KEY` - Email sending
- `AWS_*` variables - File storage and backups

See `.env.example` for a complete list of all available configuration options with descriptions.

# RabbitMQ
AMQP_URL=amqp://guest:guest@localhost:5672
```

### Local infrastructure (compose profile)

We provide a minimal Docker Compose profile for local development that starts Postgres, Redis and RabbitMQ. See the full instructions in [docs/local-infra.md](docs/local-infra.md).


### API Documentation

API documentation is generated from NestJS Swagger metadata and published automatically when changes land on `main`.

```bash
npm run docs:generate
npm run docs:render
```

This creates:

- `docs/api/openapi.json`
- `docs/api/index.html`

The API docs workflow is defined in `.github/workflows/api-docs.yml` and publishes the rendered docs to GitHub Pages.


### 4. Running the App

```bash
# Start the development server (with hot-reload)
$ npm run start:dev

# Start in production mode
$ npm run start:prod
```

## Security Checks

Security scans are now part of the default CI process for `main` and `develop` branches, and on pull requests targeting those branches.

- Secret scanning is performed with Gitleaks.
- Dependency vulnerability reporting is performed with `npm audit --audit-level=moderate`.
- The workflow is defined in `.github/workflows/security.yml`.

## Pull Request Quality Checklist

We require PRs to follow a quality checklist (tests, migration notes, docs). See [docs/pr-checklist.md](docs/pr-checklist.md) for details and use the repository PR template when opening a PR.

Before opening a PR, run the quick confidence suite:

```bash
$ npm run pr:check
```

<<<<<<< HEAD
This command runs the maintained contributor confidence suite: targeted lint checks, targeted TypeScript typechecking, and focused regression tests for the current contribution slice.
=======
This command runs issue-slice lint checks, issue-slice TypeScript typechecking, and the focused regression test suite used for this contribution wave.
## Architecture Decisions

We track major architectural choices in [docs/adr/README.md](docs/adr/README.md). If a change introduces or materially changes module boundaries, async data flow, infrastructure roles, or long-lived domain workflows, update the relevant ADR or add a new one in the same PR.

## Issue Reporting

We use standardized GitHub issue templates to keep triage fast and consistent. Please choose the template that matches your request:

- Bug report: for defects, regressions, and unexpected behavior. Include reproduction steps, impact, and a validation plan.
- Feature request: for new capabilities or meaningful enhancements. Include the problem, expected value, acceptance criteria, and testing/docs expectations.
- Refactor request: for behavior-preserving structural improvements. Include current pain, goals, non-goals, risks, and regression coverage expectations.
- Tech debt: for shortcuts, brittle patterns, dependency alignment, or missing safeguards that reduce engineering velocity or increase risk over time.

Blank issues are disabled so requests consistently include the details reviewers need to triage, scope, and ship changes safely.
>>>>>>> 19a7b48f152c83b373dd40836b279bc02c65038e


---

## 🧪 Testing

We heavily value test coverage to ensure marketplace stability.

```bash
# Run the quick pre-PR confidence suite
$ npm run pr:check

# Run individual parts of the confidence suite
$ npm run lint:pr
$ npm run typecheck:pr
$ npm run test:pr

# Run the unit test suite
$ npm run test

# Run the full repository TypeScript typecheck
$ npm run typecheck

# Watch mode for Active Test-Driven Development
$ npm run test:watch

# See code coverage report
$ npm run test:cov
```

---

## 🤝 Contributing & Open-Source Tasks

Interested in collaborating? We'd love your help!

Please read our **[Contributing Guide](CONTRIBUTING.md)** for detailed instructions on how to set up your environment, follow our coding standards, and submit your changes.

**Quick Setup Check:**
If you encounter any issues during setup, run our environment diagnostics tool:
```bash
npm run doctor
```

To get started, browse our active [GitHub Issues](https://github.com/Cybermaxi7/MarketX-backend/issues). When you find an issue you'd like to tackle, please **read the issue description thoroughly** before beginning your work.

---

## 📜 License & Support

MarketX is MIT licensed. If you encounter any issues spinning up the environment, please drop an Issue on GitHub. Let's build something incredible together! 🚀
