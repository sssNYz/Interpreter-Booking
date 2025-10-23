Setup notes

- Requires Node 18+.
- Set `SESSION_SECRET` in environment for cookie signing.
- Session timeout is 30 minutes idle (sliding). Adjust in `lib/auth/session.ts`.
- Optional: `COMPLETE_BOOKINGS_GRACE_MINUTES` controls the auto-complete job grace window (defaults to 10 minutes).
- Authentication upstream (JWT):
  - `LOGIN_API_URL` (server-side) e.g. `http://your-auth-host/api/login`
  - `AUTH_JWT_SECRET` (server-side, HS256) for signature verification
  - Client flow remains cookie-based; no JWT is exposed to the browser

### Microsoft Teams (optional)

To add a Teams meeting link in booking emails (no DB storage):

- `ENABLE_MS_TEAMS=true`
- `MS_GRAPH_TENANT_ID=<tenant-id>`
- `MS_GRAPH_CLIENT_ID=<app-client-id>`
- `MS_GRAPH_CLIENT_SECRET=<app-client-secret>`
- `MS_GRAPH_ORGANIZER_UPN=<organizer upn/email>` (defaults to `SMTP_FROM_EMAIL`)
- `MS_TEAMS_DEFAULT_DURATION_MIN=60` (optional)

App permissions required (admin consent): `OnlineMeetings.ReadWrite.All`.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server (ensure envs in `.env.local`):

```
DATABASE_URL=mysql://user:pass@host:3306/db
SESSION_SECRET=your-session-secret
LOGIN_API_URL=http://your-auth-host/api/login
AUTH_JWT_SECRET=shared-hs256-secret
```

Then start:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://172.31.150.22:3030](http://172.31.150.22:3030) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
