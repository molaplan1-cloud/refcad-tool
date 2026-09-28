# RefCAD Tool

Professional cold room designer (SaaS) with 3D isometric view, heat-load calculation, drag-and-drop equipment, dimensions, and PDF export. Built with Next.js 14 App Router + JWT auth + multi-user projects.

## Features

- **SupaCAD-style landing page** — warm cyan/blue gradient with isometric 3D illustration
- **Multi-user with JWT auth** — bcrypt-hashed passwords, signed JWT cookies, 7-day sessions
- **Projects dashboard** — CRUD projects per user, auto-save to disk
- **Cold Room Designer** — 2D plan view (SVG) + 3D isometric view (SVG)
- **Drag-and-drop equipment** — doors, evaporators, condensers, units, racks
- **Auto-snap** — doors snap to nearest wall; evaporators hang from ceiling
- **Dimensions** — measure and display in mm/m
- **Heat load calculation** — based on room type (chilled/frozen/blast chiller/blast freezer/fresh)
- **Right-click context menu** — move, copy, delete equipment
- **PDF export** — generates branded PDF with room specs

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
# Edit .env.local — set AUTH_SECRET to a random 32+ char string
npm run dev
# Open http://localhost:3000
```

## Deploy

See **[DEPLOY.md](./DEPLOY.md)** for the Vercel deployment guide (recommended).

The simplest path:

1. Sign up at https://vercel.com (free)
2. Import the `molaplan1-cloud/refcad-tool` repo
3. Set `AUTH_SECRET` env var
4. Deploy

First build takes ~1 minute, subsequent deploys ~30 seconds.

## Project structure

```
app/
  page.jsx              # SupaCAD-style landing
  login/, signup/       # Auth pages
  projects/             # Dashboard + [id] designer
  api/                  # Auth + projects CRUD
lib/
  auth.js               # JWT + bcrypt helpers
  db.js                 # JSON-file based DB
scripts/
  check-lockfile.js     # pre-build lockfile validator
.github/workflows/
  deploy.yml            # Vercel deploy via amondnet/vercel-action
data/                   # JSON DB (gitignored)
```

## License

MIT
