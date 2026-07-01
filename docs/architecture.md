# Architecture

## Overview

This project is a production-inspired railway reservation system built using a microservices architecture. The goal is to design a scalable, maintainable, and resilient backend capable of handling high traffic, concurrent bookings, and distributed workflows.

Each service owns a single business capability, has its own database, and communicates with other services using synchronous REST APIs and asynchronous events through a message broker.

---

# Architecture Principles

The system is designed around the following principles:

- Single Responsibility Principle for services
- Database per service
- Loose coupling
- High cohesion
- Stateless services
- Event-driven communication where appropriate
- Horizontal scalability
- Fault isolation
- Independent deployment

---

# High-Level Architecture

```text
                           Client (React)

                                 │
                                 ▼

                           API Gateway
                    Authentication • Routing
                   Rate Limiting • Logging

        ─────────────────────────────────────────────

      │            │             │             │

      ▼            ▼             ▼             ▼

   Auth        Train         Search        Booking
   Service     Service        Service       Service
      │            │             │             │
      ▼            ▼             ▼             ▼
 PostgreSQL   PostgreSQL      Redis      PostgreSQL

                          │
                          ▼

                     RabbitMQ

                  ┌──────────────┐
                  ▼              ▼

             Payment      Notification
              Service         Service
                  │
                  ▼
             PostgreSQL
```

---

# Services

## API Gateway

The API Gateway is the single entry point for all client requests.

Responsibilities:

- Request routing
- JWT validation
- Rate limiting
- Request logging
- Correlation IDs
- API versioning

The gateway does not contain business logic.

---

## Auth Service

Responsible for user authentication and authorization.

Responsibilities:

- Registration
- Login
- Refresh tokens
- User roles
- JWT generation

Owns its own PostgreSQL database.

---

## Train Service

Responsible for train-related data.

Responsibilities:

- Stations
- Trains
- Routes
- Schedules
- Coaches
- Seat layouts

Owns its own PostgreSQL database.

---

## Search Service

Provides optimized train search functionality.

Responsibilities:

- Train search
- Availability lookup
- Fare calculation
- Search optimization
- Redis caching

This service is optimized for read-heavy workloads.

---

## Booking Service

The core service responsible for ticket booking.

Responsibilities:

- Seat reservation
- Seat locking
- Booking confirmation
- Booking cancellation
- Waitlist management
- RAC management
- PNR generation

This service manages transactional consistency for reservations.

---

## Payment Service

Handles all payment-related operations.

Responsibilities:

- Payment initiation
- Payment confirmation
- Refund processing
- Payment status

Owns its own PostgreSQL database.

---

## Notification Service

Responsible for user notifications.

Responsibilities:

- Booking confirmation emails
- Cancellation notifications
- Payment notifications
- Future SMS support

Consumes events from the message broker.

---

# Communication

## Synchronous Communication

REST APIs are used when an immediate response is required.

Examples:

- Gateway → Auth Service
- Gateway → Search Service
- Booking Service → Train Service

---

## Asynchronous Communication

RabbitMQ is used for event-driven workflows.

Example events:

- BookingCreated
- BookingConfirmed
- BookingCancelled
- PaymentSucceeded
- PaymentFailed

This reduces coupling between services and improves resilience.

---

# Data Management

Each service owns its own database.

No service is allowed to read or write directly to another service's database.

Communication between services must occur through APIs or events.

This ensures:

- Loose coupling
- Independent deployments
- Better scalability
- Fault isolation

---

# Caching Strategy

Redis is used to reduce database load and improve response times.

Primary use cases include:

- Frequently searched trains
- Seat availability
- API rate limiting
- Temporary booking locks
- Idempotency keys

---

# Scalability

The architecture is designed to support horizontal scaling.

Examples:

- Multiple Booking Service instances
- Multiple Search Service instances
- Independent scaling based on traffic
- Stateless application containers

---

# Reliability

The system will include the following reliability mechanisms over time:

- Retry policies
- Dead Letter Queues (DLQ)
- Idempotent operations
- Health checks
- Graceful shutdown
- Request correlation IDs

---

# Security

Security measures include:

- JWT authentication
- Password hashing
- Role-Based Access Control (RBAC)
- HTTPS
- Rate limiting
- Input validation
- Secure environment variable management

---

# Observability

The platform will expose operational insights through:

- Structured logging
- Correlation IDs
- Metrics
- Health endpoints
- Distributed tracing (future)

---

# Future Enhancements

Planned architectural improvements include:

- Saga Pattern for distributed transactions
- Circuit Breaker pattern
- Service discovery
- Distributed tracing
- Kubernetes deployment
- API Gateway load balancing
- Auto-scaling
- Read replicas
- Database partitioning
- Multi-region deployment

---

# Non-Goals

The initial version of the project intentionally excludes:

- Kubernetes
- Service mesh
- Event sourcing
- CQRS
- Multi-region infrastructure

These may be explored in later iterations once the core platform is complete.
