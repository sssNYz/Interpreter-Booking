# Docker setup

This project includes a clear split between development and production setups.

- Development: `docker-compose.yml`
- Production: `docker-compose.prod.yml` + multi-stage `Dockerfile`

## Development

- Start services:
  - `docker compose up -d`
- App: http://172.31.150.22:3030
- DB: MySQL 8 on 172.31.150.22:3306 (user `booking_user`)
- Hot reload: code mounted into the container; `node_modules` uses a named volume.

Notes
- Inside container the app uses `DATABASE_URL` pointing to `db:3306`.
- Your local `.env` can still point to `172.31.150.22:3306` for running outside Docker.

## Production

- Build and run:
  - `docker compose -f docker-compose.prod.yml up -d --build`
- The image runs `prisma migrate deploy` on startup (idempotent), then `next start`.
- To seed (optional):
  - `docker compose -f docker-compose.prod.yml exec web npm run seed`

## Files

- `Dockerfile`: multi-stage build (deps → builder → runner) with a `devbase` stage for dev.
- `.dockerignore`: reduces build context for faster, cleaner builds.

## Migrations

- Both dev and prod flows run `prisma migrate deploy` against the `db` service.
- Ensure `prisma/migrations` are committed before deploying.

