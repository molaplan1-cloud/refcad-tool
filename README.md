# RefCAD Tool

Browser CAD for cold rooms, houses and halls. The landing page introduces the product, the project-type picker opens one drawing workspace, and paid workspaces stay closed until an admin confirms the payment.

## Features

- **Landing page** — cold rooms, houses and halls, plus an indicative price list
- **Project types** — kylmiö, liikerakennus, omakotitalo, rivitalo, paritalo, halli
- **Floor plan** — free without an account. Prints carry the watermark `RefCAD – DEMO / ILMAINEN VERSIO`
- **Paid workspaces** — Sähkö, LVI, IV, Piha and Kylmätekniikka after the payment is marked received
- **Auth** — bcrypt password hashes and httpOnly JWT sessions (7 days). No Supabase project is required on Vercel
- **Admin** — the admin account does not draw. It lists, creates, disables and deletes users, sets the plan, confirms a payment and sets validity dates
- **Cold room designer** — evaporator, condensing unit, piping and load calculation stay on `/suunnittelu`

## Accounts and environment

The repository is public. Do not commit passwords or `.env.local`.

Set these in the Vercel project environment before deploy. Locally, put the same names in `.env.local` (gitignored):

- `AUTH_SECRET` — random string, at least 32 characters (`openssl rand -hex 32`)
- `ADMIN_EMAIL` — admin login. This account opens the admin panel and cannot draw
- `ADMIN_PASSWORD` — plaintext only in the environment. The app stores a bcrypt hash
- `DEMO_USERNAME` — showcase login. Full features, watermarked prints
- `DEMO_PASSWORD` — plaintext only in the environment

If `ADMIN_EMAIL` / `ADMIN_PASSWORD` or `DEMO_USERNAME` / `DEMO_PASSWORD` are unset, that account is not created. A missing `AUTH_SECRET` refuses logins instead of falling back to a shared demo user.

Prices on the site are indicative. There is no card payment: the user requests a plan and the admin marks the payment received.

## Cold room types

- **Chilled** (+2°C)
- **Frozen** (-18°C)
- **Blast chiller** (0°C)
- **Blast freezer** (-30°C)
- **Fresh** (-2°C)

## Equipment categories

- Doors (auto-snap to walls)
- Evaporators (hang from ceiling)
- Condensers (mounted externally)
- Refrigeration units (standalone)
- Storage racks

## Stack

- Next.js 14 (App Router)
- React 18
- bcryptjs + jose for JWT auth
- jsPDF for PDF export
- SVG-based 2D/3D rendering (no WebGL dependencies)
- File-based JSON database (`data/db.json`) — swap for Postgres/Supabase in production

## Run locally

```bash
npm install --legacy-peer-deps
cp .env.production.example .env.local
# Edit .env.local — set AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_USERNAME and DEMO_PASSWORD
npm run dev
# Open http://localhost:3000
```

## Deploy

See **[DEPLOY.md](./DEPLOY.md)** for the Vercel deployment guide (recommended).

The simplest path:

1. Sign up at https://vercel.com (free)
2. Import the `molaplan1-cloud/refcad-tool` repo
3. Set `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_USERNAME` and `DEMO_PASSWORD` in the Vercel environment. Do not put the password values in the repo.
4. Deploy

First build takes ~1 minute, subsequent deploys ~30 seconds.

## Project structure

```
app/
  page.jsx              # Landing page
  uusi/                 # Project type picker
  admin/                # User and payment admin
  pohjakuva/            # Floor-plan workspace
  suunnittelu/          # Cold-room designer
  login/, signup/       # Auth pages
  api/                  # Auth, admin and projects
lib/
  auth.js               # bcrypt + JWT sessions
  seed.js               # Env-only admin and demo accounts
  access.js             # Plans, project types, watermark rule
  db.js                 # JSON file, or Vercel KV when configured
scripts/
  check-lockfile.js     # pre-build lockfile validator
.github/workflows/
  deploy.yml            # Vercel deploy via amondnet/vercel-action
data/                   # JSON DB (gitignored)
```

## License

MIT
