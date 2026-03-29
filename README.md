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

For now, assure you have a running **PostgreSQL 15** database and a **Redis** server. Configure your `.env` file at the root of the project with the necessary credentials:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=marketx

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
AMQP_URL=amqp://guest:guest@localhost:5672
```

### 4. Running the App

```bash
# Start the development server (with hot-reload)
$ npm run start:dev

# Start in production mode
$ npm run start:prod
```

---

## 🧪 Testing

We heavily value test coverage to ensure marketplace stability.

```bash
# Run the unit test suite
$ npm run test

# Watch mode for Active Test-Driven Development
$ npm run test:watch

# See code coverage report
$ npm run test:cov
```

---

## 🤝 Contributing & Open-Source Tasks

Interested in collaborating? We'd love your help!

To get started, please browse our active GitHub Issues (or Drips tasks). When you find an issue you'd like to tackle, please **read the issue description thoroughly** to understand the context, problem, and specific acceptance criteria before beginning your work.

**Workflow:**

1. Fork the repo and identify the issue you want to work on.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Implement the feature or fix, ensuring you meet all acceptance criteria.
4. Commit your changes strictly following conventional commit messages.
5. Open a Pull Request and link the relevant issue!

---

## 📜 License & Support

MarketX is [MIT licensed](LICENSE). If you encounter any issues spinning up the environment, please drop an Issue on GitHub. Let's build something incredible together! 🚀
