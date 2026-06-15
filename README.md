<div align="center">
  <h1>MarketXpress Backend</h1>
  <p><strong>Open-source marketplace API built with NestJS and PostgreSQL (Supabase).</strong></p>

  <a href="https://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="100" alt="Nest Logo" /></a>

  <br /><br />

  ![CI](https://github.com/MarketXpress/MarketX-backend/actions/workflows/ci.yml/badge.svg)
  ![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
</div>

---

## About

**MarketXpress** is an open-source marketplace backend. The current codebase provides a clean, working foundation — and the community is actively building features on top of it. If you want to contribute a module, check the [open issues](https://github.com/MarketXpress/MarketX-backend/issues).

### Core Modules (live)

| Module | Description |
|---|---|
| **Auth** | JWT authentication, refresh token rotation, 2FA |
| **Users** | User profiles and account management |
| **Products** | Product listings with multi-currency pricing |
| **Categories** | Product categorization |
| **Orders** | Order lifecycle management |
| **Health** | Database and liveness health checks |

### Planned (open for contribution)

Payments, Escrow, Notifications, Search, Reviews, Messaging, Media uploads, and more. See [Issues](https://github.com/MarketXpress/MarketX-backend/issues) for open tasks.

---

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (Node.js / TypeScript)
- **Database**: PostgreSQL via [Supabase](https://supabase.com/) + [TypeORM](https://typeorm.io/)
- **Auth**: Passport.js + JWT
- **Validation**: class-validator + class-transformer
- **Testing**: Jest

---

## Getting Started

### Prerequisites

- Node.js v20+
- npm
- A PostgreSQL database (Supabase free tier works fine)

### 1. Clone & install

```bash
git clone https://github.com/MarketXpress/MarketX-backend.git
cd MarketX-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. The minimum required variables:

```env
# Database (Supabase session pooler recommended)
DATABASE_HOST=your-project.pooler.supabase.com
DATABASE_PORT=5432
DATABASE_USER=postgres.your-project-ref
DATABASE_PASSWORD=your-db-password
DATABASE_NAME=postgres

# JWT secrets — use long random strings in production
JWT_SECRET=change-me-in-production
JWT_ACCESS_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-in-production
```

### 3. Run

```bash
# Development (hot-reload)
npm run start:dev

# Production
npm run start:prod
```

The server starts on port `3000` by default. Override with `PORT=3002 npm run start:dev`.

### 4. Verify

```bash
curl http://localhost:3000/health/live
# → {"status":"up"}

curl http://localhost:3000/health
# → {"status":"ok","info":{"database":{"status":"up",...}}}
```

---

## API Overview

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register a new user |
| POST | `/auth/login` | No | Login, returns JWT pair |
| POST | `/auth/refresh` | Refresh token | Rotate tokens |
| GET | `/users` | JWT | List users |
| GET | `/users/:id` | JWT | Get user by ID |
| GET | `/products` | JWT | List products |
| POST | `/products` | JWT | Create product |
| GET | `/categories` | No | List categories |
| POST | `/categories` | JWT | Create category |
| GET | `/orders` | JWT | List orders |
| POST | `/orders` | JWT | Create order |
| GET | `/health` | No | Full health check |
| GET | `/health/live` | No | Liveness probe |

---

## Running Tests

All tests must pass before a PR can be merged.

```bash
# Run the full test suite
npm test

# Run with coverage report
npm run test:cov

# Watch mode (TDD)
npm run test:watch

# Full pre-PR check (lint + typecheck + tests)
npm run pr:check
```

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

Browse [open issues](https://github.com/MarketXpress/MarketX-backend/issues) to find something to work on.

---

## Security

- Secret scanning runs on every push/PR via Gitleaks
- Dependency audit runs via `npm audit`
- See `.github/workflows/security.yml`

---

## License

MIT
