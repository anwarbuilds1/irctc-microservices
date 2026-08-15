# IRCTC Microservices

A production-inspired railway reservation system built with a microservices architecture.

## Tech Stack

- Node.js
- Express
- TypeScript
- PostgreSQL
- Redis
- RabbitMQ
- Docker
- GitHub Actions
- AWS

## Architecture & Services

The system is split into independent microservices communicating via REST and asynchronous message brokers:

* **[User Service](./services/user-service/README.md)** (IAM): Handles secure authentication, registration, cryptographically hashed OTP verification, and JWT session rotation.
* **Train Service**: Manages trains, stations, routes, schedules, and pricing.
* **Search Service**: High-performance train availability search.
* **Booking Service**: Orchestrates transaction-safe ticket reservations.
* **Payment Service**: Third-party payment processor integrations.
* **Notification Service**: Sends email/SMS confirmations.

---

## Getting Started (Docker Compose)

You can run the entire infrastructure and microservices with a single command:

```bash
docker compose up --build
```

This starts:
* **PostgreSQL** (`localhost:5432`) & **pgAdmin** (`localhost:5050`)
* **Redis** (`localhost:6379`) & **RedisInsight** (`localhost:8001`)
* **RabbitMQ** (`localhost:5672`)
* **User Service** (`localhost:3000`)
  * Documentation: `http://localhost:3000/docs`
  * Health Check: `http://localhost:3000/api/v1/health`

---

## Status

🚧 Currently under active development. The **User Service** (IAM) is fully production-ready, feature-complete, and verified.

