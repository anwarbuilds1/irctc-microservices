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

## 3. Project Structure

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

## 4. API Endpoints

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

### Utility Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/docs` | Renders interactive Swagger UI API Documentation. |
| **GET** | `/api/v1/health` | Renders API & service health details. |

---

## 5. Security & Lockout Policies

1. **OTP Cryptography**: Plain OTPs are never logged or stored. They are hashed using SHA-256 before being stored in Redis.
2. **Timing-Safe Equal Verification**: OTP comparisons are protected against side-channel timing attacks using `crypto.timingSafeEqual`.
3. **Attempt Lockout**: Users are limited to **5 attempts** on OTP verification. If exceeded, the OTP is deleted from Redis immediately, forcing a new request.
4. **Cookie Protections**: Refresh tokens are served with `httpOnly`, `sameSite: 'strict'`, and `secure: true` (in production) properties to prevent CSRF and XSS attacks.

---

## 6. How to Run Locally

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
