# Job Seeker

A full-stack job application tracker with AI-powered resume generation, Kanban board management, and analytics.

## Features

- **Resume Source Builder** — Maintain your complete work history (experience, education, skills, publications) in a structured format
- **Kanban Board** — Track job applications across customizable columns with drag-and-drop, search, and filtering
- **AI Resume Generation** — Generate tailored resumes using Claude AI, matched against each job description
- **Analytics Dashboard** — Pipeline funnel, weekly trends, conversion rates, and closure breakdowns
- **Admin Panel** — Platform stats, user management, generation tracking, and per-user cap controls
- **Data Export** — Download all your data as a JSON file at any time

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth v5 (Google OAuth)
- **AI**: Anthropic Claude API
- **UI**: Tailwind CSS v4, shadcn/ui, Radix UI
- **Charts**: Recharts
- **Drag & Drop**: @hello-pangea/dnd
- **Document Generation**: docx (OOXML)
- **Rate Limiting**: Upstash Redis (optional)
- **Testing**: Vitest, Testing Library, Playwright

## Prerequisites

- Node.js 20+
- PostgreSQL database
- Google OAuth credentials
- Anthropic API key (for resume generation)

## Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd job-seeker
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in the required values — see [Environment Variables](#environment-variables) below.

3. **Set up database**

   ```bash
   npx prisma migrate dev
   ```

4. **Run development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | NextAuth secret — generate with `npx auth secret` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth Client Secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | Yes | PostgreSQL direct connection string (for migrations) |
| `ADMIN_EMAILS` | Yes | Comma-separated list of admin email addresses |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude resume generation |
| `CLAUDE_MODEL` | No | Claude model ID (defaults to claude-sonnet-4-20250514) |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token for rate limiting |
| `NEXT_PUBLIC_KOFI_ID` | No | Ko-fi username to show a support button |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

## Deployment

1. Set all required environment variables on your hosting platform
2. Run `npx prisma migrate deploy` for database migrations
3. Build with `npm run build`
4. Start with `npm run start`

The app works on any platform that supports Next.js (Vercel, Railway, Fly.io, etc.).
