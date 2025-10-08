# Repository Guidelines

## Project Structure & Module Organization
- `app/` Next.js App Router pages and APIs (`app/**/page.tsx`, `app/api/**/route.ts`).
- `components/` Shared UI (e.g., `components/ui/*`, `components/AdminDashboards/*`).
- `lib/` Domain logic; assignment engine in `lib/assignment/**`.
- `hooks/`, `types/` Reusable React hooks and TypeScript types.
- `prisma/` Prisma schema, migrations, and `seed.ts`.
- `scripts/` Integration/maintenance scripts (DB checks, assignment tests).
- `public/`, `config/` Static assets and configuration.

## Build, Test, and Development Commands
- `npm run dev` — Start dev server on `:3030`.
- `npm run build` / `npm start` — Production build/run.
- `npm run lint` — ESLint (Next core-web-vitals + TypeScript).
- `npm run seed` — Seed DB via `prisma/seed.ts`.
- `docker compose up -d` — Spin up app + MySQL locally.
- Tests: `node scripts/validate-integration-tests.js`, `npm run test:pool-integration`, `npm run test:enhanced`.

Required env before running: `DATABASE_URL`, `SESSION_SECRET`.

## Coding Style & Naming Conventions
- TypeScript (strict); avoid `any`. Prefer explicit types and Zod where helpful.
- Indent 2 spaces. Keep existing file casing (PascalCase dirs like `AdminDashboards`, kebab-case files like `booking-calendar.tsx`).
- Components `PascalCase`; variables/functions `camelCase`; types/interfaces `PascalCase`.
- API route files are `route.ts`. Use path alias `@/*` (e.g., `import prisma from "@/prisma/prisma"`).

## Testing Guidelines
- Scripts in `scripts/` exercise DB + assignment logic; name tests `test-*.js`.
- Seed or create isolated data; clean up or use throwaway records.
- No formal coverage target; prioritize reproducible, focused scripts.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`.
- PRs include: clear description, linked issues, steps to test, screenshots/GIFs for UI, and notes on schema/env changes.
- Keep diffs scoped; avoid unrelated refactors. Run `npm run lint` before opening PRs.

## Security & Configuration Tips
- Env vars used: `DATABASE_URL`, `SESSION_SECRET`, client flags `NEXT_PUBLIC_ENABLE_*`, server flags `ENABLE_*`, plus `CRON_SECRET`/`CRON_TOKEN`, `FORWARD_MONTH_LIMIT`, `BUSINESS_TZ_OFFSET_MINUTES`.
- Never commit secrets. Commit Prisma migrations with schema changes.

## Agent-Specific Instructions
- Follow this guide when modifying code. Do not change unrelated files.
- Update docs when adding envs/scripts; keep structure consistent with the sections above.

