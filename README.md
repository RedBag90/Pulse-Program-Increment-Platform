# Pulse — Program Increment Platform

A SAFe-native enterprise platform for managing Agile Release Trains, Program Increments, and the four-tier initiative hierarchy (Epic → Feature → Story → Task).

**Status:** Sprint 0 — Scaffolding complete. Sprint 1 (walking skeleton) in progress.

---

## Prerequisites

| Tool    | Version | Install                                       |
| ------- | ------- | --------------------------------------------- |
| Node.js | ≥ 20    | [nodejs.org](https://nodejs.org)              |
| pnpm    | ≥ 9     | `corepack enable && corepack use pnpm@latest` |
| Docker  | any     | Required for local integration tests          |

---

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/pulse-program-increment-platform.git
cd pulse-program-increment-platform
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

- **`DATABASE_URL`** — from Supabase Dashboard → Project → Settings → Database → Connection string (Transaction pooler, port 6543)
- **`DIRECT_URL`** — from the same page (Session pooler, port 5432)
- **`NEXT_PUBLIC_SUPABASE_URL`** — from Supabase Dashboard → Project → Settings → API
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — same location
- **`SUPABASE_SERVICE_ROLE_KEY`** — same location (keep secret!)
- **`RESEND_API_KEY`** — from [resend.com](https://resend.com) (optional in development)

### 3. Generate the Prisma client

```bash
pnpm prisma generate
```

### 4. Apply the database schema

```bash
pnpm prisma migrate dev
```

This applies all migrations in `prisma/migrations/` to your Supabase project.

### 5. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Script                    | Description                                   |
| ------------------------- | --------------------------------------------- |
| `pnpm dev`                | Start Next.js dev server with Turbopack       |
| `pnpm build`              | Build for production                          |
| `pnpm start`              | Start production server                       |
| `pnpm typecheck`          | TypeScript type checking (no emit)            |
| `pnpm lint`               | ESLint with zero warnings allowed             |
| `pnpm lint:fix`           | ESLint with auto-fix                          |
| `pnpm format`             | Prettier format all files                     |
| `pnpm format:check`       | Prettier format check                         |
| `pnpm test`               | Run unit tests (Vitest)                       |
| `pnpm test:watch`         | Run unit tests in watch mode                  |
| `pnpm test:coverage`      | Run unit tests with coverage report           |
| `pnpm test:e2e`           | Run E2E tests (Playwright)                    |
| `pnpm prisma generate`    | Regenerate Prisma client after schema changes |
| `pnpm prisma migrate dev` | Apply pending migrations                      |
| `pnpm prisma studio`      | Open Prisma Studio (DB GUI)                   |

---

## Project Structure

```
src/
  app/           Next.js App Router (route segments)
  components/    Shared UI primitives
  features/      Feature modules (portfolio, art, pi, team, admin, …)
  domain/        Pure domain logic — types, Zod schemas, roles
  server/        Server-only code — services, repositories, auth, email
  i18n/          next-intl configuration
  lib/           Client-safe shared utilities
  test/          Test infrastructure (MSW handlers, fixtures, setup)
messages/        i18n strings (en.json, de.json)
prisma/          Prisma schema and migrations
docs/            Architecture docs, ADRs, runbooks
tests/e2e/       Playwright E2E tests
```

See [`docs/concepts/pulse-technical-concept.md`](docs/concepts/pulse-technical-concept.md) for the full architecture.

---

## Tech Stack

| Area       | Technology                      |
| ---------- | ------------------------------- |
| Framework  | Next.js 15 (App Router)         |
| Language   | TypeScript (strict)             |
| Database   | PostgreSQL via Supabase         |
| ORM        | Prisma 6                        |
| Auth       | Supabase Auth (`@supabase/ssr`) |
| State      | TanStack React Query v5         |
| Forms      | react-hook-form + Zod           |
| Styling    | Tailwind CSS v4                 |
| i18n       | next-intl v4 (DE + EN)          |
| Testing    | Vitest + Playwright + MSW       |
| CI         | GitHub Actions                  |
| Deployment | Vercel                          |

---

## Contributing

1. Branches: `feat/PULSE-<id>-<slug>`, `fix/PULSE-<id>-<slug>`
2. Commits: [Conventional Commits](https://www.conventionalcommits.org/)
3. PRs require: 1 approval + all CI checks green
4. Story completion requires all items in the [Definition of Done](docs/concepts/pulse-implementation-concept.md#62-definition-of-done-dod) to be checked

---

## Documentation

- [Technical Concept](docs/concepts/pulse-technical-concept.md)
- [Implementation Concept](docs/concepts/pulse-implementation-concept.md)
- [Architecture Decision Records](docs/adr/)
- [Runbooks](docs/runbooks/)
