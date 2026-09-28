# RefCAD Tool — Deployment Guide

This app is built with **Next.js 14** (App Router) and deployed on **Vercel**.

## Quick start (recommended: Vercel Git integration)

1. Go to https://vercel.com/signup and create a free account (sign in with GitHub).
2. Click **Add New → Project**.
3. Select the **`molaplan1-cloud/refcad-tool`** repository.
4. Vercel auto-detects:
   - Framework Preset: **Next.js**
   - Build Command: `next build`
   - Output Directory: `.next`
5. Open **Environment Variables** and add:
   - `AUTH_SECRET` — random 32+ char string. Generate with: `openssl rand -hex 32`
   - `NEXT_PUBLIC_APP_URL` — your future Vercel domain, e.g. `https://refcad-tool.vercel.app`
6. Click **Deploy**. The first build takes ~1 minute.

After the first deploy succeeds you'll get a URL like `https://refcad-tool.vercel.app`. Subsequent commits to `master` deploy automatically.

## Alternative: GitHub Actions CI deploy

This repo also has a GitHub Actions workflow at `.github/workflows/deploy.yml` that deploys via the official `amondnet/vercel-action@v25`. To enable it:

1. Get a Vercel token: Vercel Dashboard → Settings → Tokens → Create Token. Copy it.
2. Get your Vercel org & project IDs:
   - Org ID: Vercel Dashboard → Settings → General → "Your ID"
   - Project ID: create the project first (via Git integration or `vercel link`), then it's in `.vercel/project.json` or the dashboard URL.
3. Add three GitHub repository secrets (Settings → Secrets and variables → Actions):
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
   - `AUTH_SECRET`
4. Push to `master` — the workflow deploys to production.

If you use the GitHub Actions path, you can disable Vercel's auto-deploy in the project's Git settings to avoid duplicate deploys.

## Local development

```bash
# 1. Install
npm install --legacy-peer-deps

# 2. Create local env file
cp .env.production.example .env.local
# Then edit .env.local and set AUTH_SECRET to any random 32+ char string

# 3. Run dev server
npm run dev
# Open http://localhost:3000

# 4. Production build (sanity check)
npm run build && npm start
```

## File-based database

The app uses a simple JSON file at `data/db.json` for users and projects. This is fine for demos and small teams; for production scale, swap `lib/db.js` for a real database (Supabase, Postgres, etc.). The exported function signatures are designed so only that one file needs to change.

Note: Vercel's serverless functions have ephemeral filesystems, so the JSON DB persists during the lifetime of a single function instance but resets between deploys. For real persistence, use a hosted DB.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | Yes | JWT signing secret. At least 32 chars of random data. Must match across all running instances. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public URL of the deployed app. Used for absolute links in PDFs, emails, etc. |
| `NODE_ENV` | Auto | Set to `production` automatically by Vercel. |

## Troubleshooting

- **Build fails with "Cannot find module"**: run `npm install --legacy-peer-deps` locally and commit the regenerated `package-lock.json`.
- **Login fails after deploy**: ensure `AUTH_SECRET` is set in Vercel environment variables.
- **JSON data resets on every deploy**: this is expected on Vercel serverless. Use a hosted DB for persistence.
