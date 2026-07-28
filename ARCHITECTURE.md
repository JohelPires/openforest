# OpenForest Architecture

> Version: 1.0
>
> Status: Living Document
>
> Last Updated: 2026

---

# Overview

OpenForest is an open-source platform for environmental restoration management.

The platform enables organizations to manage restoration projects, monitor restoration areas, collect field observations, integrate environmental data, and generate ecological insights.

The architecture prioritizes:

- Simplicity
- Maintainability
- Scalability
- Testability
- Observability
- Developer Experience

Rather than optimizing for maximum scalability from day one, OpenForest is designed to evolve incrementally while remaining production-ready at every stage.

---

# Architectural Goals

The architecture should:

- Support long-term evolution
- Keep onboarding simple
- Minimize operational complexity
- Encourage modular development
- Facilitate testing
- Be cloud-ready
- Enable future distributed systems
- Keep business logic independent from infrastructure

---

# Architecture Principles

## API First

Every capability is exposed through the API.

The frontend is simply another API consumer.

Benefits:

- Mobile applications
- Third-party integrations
- Public APIs
- Better automated testing

---

## Modular Monolith

OpenForest starts as a Modular Monolith.

This decision is intentional.

Premature microservices often introduce:

- operational complexity;
- deployment challenges;
- distributed transactions;
- higher infrastructure costs.

Instead, business capabilities are isolated into independent modules while sharing a single deployment.

Each module owns:

- routes;
- services;
- domain models;
- repositories;
- tests.

Future extraction into independent services becomes significantly easier.

---

## Domain-Oriented Design

The codebase is organized around business capabilities.

Not around technical layers.

Good:

```
projects/
species/
monitoring/
areas/
```

Avoid:

```
controllers/
services/
models/
repositories/
```

at the root level.

Business domains should remain cohesive.

---

## Infrastructure Independence

Business rules must never depend directly on infrastructure.

Business logic should not know:

- PostgreSQL
- Redis
- S3
- FastAPI

Infrastructure is replaceable.

---

## Observability by Default

Every production component should expose:

- structured logs
- metrics
- traces
- health status

Observability is considered a feature.

Not an afterthought.

---

## Cloud Ready

Every architectural decision should be compatible with cloud deployment.

No local-only assumptions.

---

# High-Level Architecture

```
                       Users
                          │
                          ▼
                    Next.js Frontend
                          │
                          ▼
                     FastAPI API Layer
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
      Domain Modules   Authentication   Shared Services
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                    Persistence Layer
                PostgreSQL / Redis / MinIO
                          │
                          ▼
                 Observability Stack
        OpenTelemetry / Prometheus / Grafana
```

---

# System Layers

## Presentation Layer

Responsibilities:

- HTTP endpoints
- Request validation
- Authentication
- Authorization
- Serialization
- OpenAPI generation

Technologies:

- FastAPI
- Pydantic

---

## Application Layer

Coordinates use cases.

Contains:

- commands
- queries
- application services

Responsibilities:

- orchestrate workflows
- transaction boundaries
- event publishing

---

## Domain Layer

Contains business rules.

Should have no dependency on:

- HTTP
- Database
- Frameworks

Contains:

- entities
- value objects
- domain services
- domain events

---

## Infrastructure Layer

Responsible for:

- database
- storage
- cache
- queues
- messaging
- email
- cloud integrations

Infrastructure should implement interfaces defined by the domain.

---

# Domain Modules

## Authentication

Responsibilities

- Login
- JWT
- RBAC
- User permissions

---

## Users

Responsibilities

- User profile
- Organization membership

---

## Organizations

Represents NGOs, universities, companies and public institutions.

---

## Projects

Represents restoration projects.

Example:

Amazon Reforestation 2026

---

## Restoration Areas

Each project contains one or more restoration areas.

Stores:

- coordinates
- biome
- size
- restoration status

---

## Monitoring

Stores field visits.

Includes:

- observations
- photos
- measurements
- species

---

## Species

Stores ecological information.

Future integrations:

- GBIF
- iNaturalist

---

## Media

Responsible for:

- uploads
- thumbnails
- metadata

---

## Notifications

Future module.

Handles:

- email
- push
- webhooks

---

# Database Strategy

Primary database:

PostgreSQL

Reasons:

- ACID compliance
- GIS support (future PostGIS)
- mature ecosystem
- reliability

---

# Cache Strategy

Redis.

Uses:

- response cache
- session cache
- rate limiting
- distributed locks

Cache should never become the source of truth.

---

# Object Storage

Development:

MinIO

Production:

Amazon S3

Storage includes:

- photos
- reports
- exports

---

# Asynchronous Processing

Initially:

No queues.

Later:

Background workers.

Future:

Message broker.

Candidate technologies:

- SQS
- RabbitMQ

Kafka will only be introduced if justified by real workload.

---

# Authentication

JWT

Refresh Tokens

RBAC

Future:

OAuth2

OIDC

SSO

---

# Authorization

Role-based.

Example roles:

- Administrator
- Manager
- Researcher
- Volunteer
- Viewer

Future:

Attribute-based authorization.

---

# API Design

RESTful.

Versioned.

Example:

```
/api/v1/projects

/api/v1/areas

/api/v1/species
```

Guidelines:

- nouns
- pagination
- filtering
- sorting
- predictable responses

---

# Error Handling

Every API response should follow the same format.

Example:

```json
{
   "error": {
      "code": "PROJECT_NOT_FOUND",
      "message": "Project does not exist."
   }
}
```

---

# Validation

Input validation:

Pydantic

Business validation:

Domain Layer

Database constraints:

PostgreSQL

Validation should never exist only in the frontend.

---

# Logging

Structured JSON logs.

Every request receives:

- request id
- correlation id

Logs should never expose:

- passwords
- tokens
- secrets

---

# Metrics

Prometheus metrics:

- request count
- latency
- error rate
- database queries
- cache hit ratio

---

# Distributed Tracing

OpenTelemetry.

Future visualization:

Jaeger

Every request should generate:

- spans
- timing
- dependencies

---

# Health Checks

Endpoints:

```
/health

/readiness

/liveness
```

---

# Testing Strategy

Testing pyramid.

## Unit Tests

Business logic.

Fast.

No database.

---

## Integration Tests

Database.

Repositories.

Services.

---

## API Tests

HTTP endpoints.

---

## End-to-End

Future.

Critical user flows.

---

# Security

Security is mandatory.

Includes:

- HTTPS
- JWT
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection
- CSRF where applicable
- Secure headers

Dependencies should be continuously scanned.

---

# CI/CD

GitHub Actions.

Pipeline:

```
Lint

↓

Formatting

↓

Unit Tests

↓

Integration Tests

↓

Docker Build

↓

Security Scan

↓

Deploy
```

---

# Configuration

12-Factor App.

Configuration through:

Environment Variables.

No secrets committed.

---

# Documentation

Documentation is part of the architecture.

Every feature must include:

- API docs
- ADR updates
- examples
- migration notes (if applicable)

---

# Architectural Decision Records

Every significant decision generates an ADR.

Examples:

- Why FastAPI?
- Why PostgreSQL?
- Why Modular Monolith?
- Why Redis?
- Why S3?
- Why not Microservices?

---

# Evolution Strategy

Phase 1

Modular Monolith

↓

Phase 2

Background Workers

↓

Phase 3

Async Processing

↓

Phase 4

Observability

↓

Phase 5

Cloud Deployment

↓

Phase 6

Event Driven

↓

Phase 7

Distributed Services (if justified)

Architecture should evolve only when real business needs emerge.

---

# Non-Goals

OpenForest intentionally avoids:

- premature microservices;
- unnecessary abstractions;
- framework-driven architecture;
- overengineering;
- vendor lock-in.

Every technology introduced must solve a concrete problem.

---

# Success Criteria

The architecture will be considered successful if:

- new contributors can understand the project quickly;
- modules remain loosely coupled;
- automated tests provide confidence;
- production issues are observable;
- deployment remains simple;
- future scaling does not require rewriting the application.

Architecture is not measured by complexity.

It is measured by how easily the system can evolve.
