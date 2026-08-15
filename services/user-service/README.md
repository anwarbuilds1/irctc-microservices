# User Service

The **User Service** is the foundational identity and access management (IAM) microservice of the IRCTC Microservices platform. It handles user registration, secure credential storage, OTP-based email verification, token-based session management, and JWT rotation.

---

## 1. Key Responsibilities
* **User Management**: Creating and managing user accounts with PostgreSQL (via Prisma).
* **Secure Authentication**: Hashing passwords securely using `bcrypt` and validating credentials.
* **OTP Verification**: Generating cryptographically secure OTPs, storing SHA-256 hashes in Redis, and emailing plain OTPs to users via the **Resend** API.
* **Session Management**: Establishing Redis-backed sessions with sliding expirations to allow instant token revocation.
* **Refresh Token Rotation**: Enhancing security by issuing one-time-use refresh tokens that rotate on every renewal cycle.
* **API Documentation**: Hosting interactive Swagger UI documentation at `/docs`.

---

## 2. Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **Node.js** | Runtime Environment |
| **TypeScript** | Static Typing & Type Safety |
| **Express** | Web Framework |
| **Prisma** | Modern Type-safe ORM |
| **PostgreSQL** | Primary Relational Database |
| **Redis** | In-Memory Session & Cooldown Cache |
| **Resend** | Transactional Email Service |
| **Zod** | Input Schema Validation Middleware |
| **Pino & Pino-HTTP** | High-performance Structured Logging |
| **Vitest & Supertest** | Testing Suite |
| **Swagger UI Express** | Interactive API Documentation |

---

## 3. Architecture & Workflows

### 3.1 Layered Architecture & Data Flow

```mermaid
flowchart TD
    Client["Client / Frontend"]
    
    subgraph ExpressApp ["Express Application (src/app.ts)"]
        Router["Router Layer (src/routes/)"]
        Validate["Validation Middleware (Zod)"]
        AuthGuard["Auth Guard Middleware"]
        Controller["Controllers (src/controllers/)"]
        Service["Services (src/services/)"]
        Repo["Repositories (src/repository/)"]
    end
    
    subgraph DataStore ["Data & Cache Layer"]
        Postgres[("PostgreSQL (Users Table)")]
        Redis[("Redis (OTPs, Sessions)")]
        Resend["Resend API (Mock/SMTP)"]
    end

    Client -->|HTTP Request| Router
    Router -->|1. Parse Inputs| Validate
    Validate -->|2. Check AccessToken| AuthGuard
    AuthGuard -->|3. Route Request| Controller
    Controller -->|4. Business Logic| Service
    Service -->|5. Query Cache| Redis
    Service -->|6. CRUD ops| Repo
    Service -->|7. Email Dispatch| Resend
    Repo -->|8. Fetch/Store| Postgres
```

### 3.2 User Signup & OTP Verification Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant API as User Service API
    participant Cache as Redis
    participant DB as PostgreSQL
    participant Email as Resend Service

    %% Signup Flow
    Note over Client, Email: Signup Flow
    Client->>API: POST /api/v1/auth/signup {name, email, password, phone}
    API->>DB: Check if email/phone exists
    DB-->>API: No duplicate found
    API->>DB: Create user (emailVerified = false)
    API->>API: Generate 6-digit OTP
    API->>API: Hash OTP (SHA-256)
    API->>Cache: Save hashed OTP (TTL 5m)
    API->>Email: Send plaintext OTP
    Email-->>Client: Receive OTP Email
    API-->>Client: 201 Created (Prompt OTP Verification)

    %% Verification Flow
    Note over Client, Email: OTP Verification Flow
    Client->>API: POST /api/v1/auth/verify-otp {email, otp}
    API->>Cache: Get hashed OTP & increment attempts counter
    alt Verification fails or attempts > 5
        API->>Cache: (If attempts > 5) Delete OTP
        API-->>Client: 400 Bad Request
    else Verification succeeds
        API->>API: Timing-safe match check
        API->>Cache: Delete OTP and attempts keys
        API->>DB: Update user (emailVerified = true)
        API-->>Client: 200 OK (Verification Successful)
    end
```

### 3.3 User Login & Token Rotation Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant API as User Service API
    participant Cache as Redis
    participant DB as PostgreSQL

    %% Login Flow
    Note over Client, DB: Login Flow
    Client->>API: POST /api/v1/auth/login {email, password}
    API->>DB: Retrieve verified user record
    DB-->>API: User details & password hash
    API->>API: Compare bcrypt password hash
    API->>API: Generate Session ID (UUID)
    API->>Cache: Store session payload (TTL 7 days)
    API->>API: Sign JWT Access Token (15m expiry)
    API->>API: Sign JWT Refresh Token (7d expiry)
    API-->>Client: 200 OK (Body: AccessToken, Cookie: httpOnly RefreshToken)

    %% Token Refresh Rotation Flow
    Note over Client, DB: Token Refresh Rotation Flow
    Client->>API: POST /api/v1/auth/refresh (Cookie: Old RefreshToken)
    API->>API: Verify Refresh Token signature & extract Session ID
    API->>Cache: Fetch & extend Session ID TTL (7 days)
    alt Session not found (expired / logged out)
        API-->>Client: 401 Unauthorized (Log in again)
    else Session active
        API->>API: Generate new Access Token
        API->>API: Generate new rotated Refresh Token
        API-->>Client: 200 OK (Body: New AccessToken, Cookie: New httpOnly RefreshToken)
    end
```

---

## 4. Project Structure

```text
services/user-service/
├── prisma/
│   └── schema.prisma        # Database models & mappings
├── src/
│   ├── config/              # Environment config, Redis client, Prisma service, Logger, Swagger spec
│   ├── controllers/         # HTTP request handlers & responders
│   ├── middlewares/         # Route protectors, logger, error, & validation middlewares
│   ├── repository/          # Direct database query layers (Prisma)
│   ├── routes/              # Express API endpoint declarations
│   ├── services/            # Core business logic (auth, OTP, email sending)
│   ├── tests/               # Integration tests (Vitest + Supertest)
│   ├── utils/               # Reusable JWT & password hashing functions
│   ├── validators/          # Input schema declarations (Zod schemas)
│   ├── app.ts               # Isolated Express app declaration for testing
│   └── index.ts             # Application entrypoint & HTTP listener
├── Dockerfile               # Production multi-stage build setup
├── Dockerfile.dev           # Development container configuration
├── prisma.config.js         # Prisma CLI configuration for v7
├── package.json             # Service dependencies & scripts
└── tsconfig.json            # TypeScript compiler configuration
```

---

## 5. API Endpoints

All endpoints are prefixed with `/api/v1` except for the root-level Swagger docs.

### Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Headers / Cookies | Request Body | Description |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/signup` | None | `{ name, email, password, phone }` | Registers a user, creates user record, hashes OTP, sets cooldown, and emails plain OTP. |
| **POST** | `/verify-otp` | None | `{ email, otp }` | Verifies plain OTP against Redis hash. Deletes key on success. Sets `emailVerified: true` in Postgres. |
| **POST** | `/resend-otp` | None | `{ email }` | Discards current OTP and dispatches a new one (restricted to a 60-second cooldown). |
| **POST** | `/login` | None | `{ email, password }` | Authenticates verified user, creates Redis session, returns JWT Access Token, and sets secure `httpOnly` `refreshToken` cookie. |
| **POST** | `/logout` | Bearer `<accessToken>` | None | Deletes active session from Redis and clears client cookie. |
| **POST** | `/refresh` | `refreshToken` cookie | `{ refreshToken }` *(optional)* | Issues a new Access Token and a brand new rotated Refresh Token. |
| **GET** | `/docs` | None | None | Interactive Swagger UI API Documentation. |

### Utility Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/v1/health` | Renders API & service health details. |

---

## 6. Security & Lockout Policies

1. **OTP Cryptography**: Plain OTPs are never logged or stored. They are hashed using SHA-256 before being stored in Redis.
2. **Timing-Safe Equal Verification**: OTP comparisons are protected against side-channel timing attacks using `crypto.timingSafeEqual`.
3. **Attempt Lockout**: Users are limited to **5 attempts** on OTP verification. If exceeded, the OTP is deleted from Redis immediately, forcing a new request.
4. **Cookie Protections**: Refresh tokens are served with `httpOnly`, `sameSite: 'strict'`, and `secure: true` (in production) properties to prevent CSRF and XSS attacks.

---

## 7. How to Run Locally

### Environment Variables
Configure these in `services/user-service/.env`:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/user_db"
REDIS_URL="redis://:secure_redis_password@localhost:6379"
JWT_SECRET="your-jwt-secret-key"
JWT_REFRESH_SECRET="your-jwt-refresh-secret-key"
RESEND_API_KEY="re_mock_key" # Use real key to test email dispatch
RESEND_FROM_EMAIL="onboarding@resend.dev"
```

### Installation & Run Commands
Ensure you have Docker Compose running your Postgres/Redis containers, then run:

```bash
# 1. Install dependencies
npm install

# 2. Run Database Migrations
npx prisma db push

# 3. Start development server (hot-reloads)
npm run dev
```

---

## 7. Testing
The integration test suite executes live Postgres and Redis operations using mocked email dispatching:

```bash
# Run tests
npm run test
```
