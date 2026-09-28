# 🌐 Cloudflare Pages -julkaisuohje

## Vaihe 1: Luo Cloudflare-tili
- Mene [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
- Rekisteröidy ilmaiseksi

## Vaihe 2: Luo Pages-projekti
1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → **GitHub**
2. Valitse `molaplan1-cloud/refcad-tool`

## Vaihe 3: Asenna build-asetukset

| Asetus | Arvo |
|--------|------|
| Project name | `refcad-tool` |
| Production branch | `master` |
| Framework preset | **Next.js** |
| Build command | `npm run cf:build` |
| Build directory | `.vercel/output/static` |

## Vaihe 4: Ympäristömuuttujat

**Settings → Environment variables:**

| Variable | Value |
|----------|-------|
| `AUTH_SECRET` | (64 hex chars, generate below) |
| `NODE_VERSION` | `20` |

Generoi AUTH_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Vaihe 5: Deploy

Klikkaa **Save and Deploy**. URL: `https://refcad-tool.pages.dev`

## ⚠️ Riippuvuusongelma ja korjaus

`@cloudflare/next-on-pages` vaatii Next.js 14.3+. Käytämme:
- `npm ci --legacy-peer-deps`
- Next.js `^14.3.0`

## Vaihtoehtoiset alustat

### Vercel (helpoin)
- Tuo GitHub repo Vercel:iin → auto-detects Next.js → Deploy
- AUTH_SECRET env-muuttuja
- Custom domain ilmaiseksi

### Railway
- $5/kk täysi Node.js hosting
- Docker-tuki

### Render
- Free tier olemassa
- Git-integraatio

## 🔐 Tärkeää turvallisuudesta

- **AUTH_SECRET** EI SAA olla oletusarvo (`'refcad-tool-secret-key-change-in-production-min-32-chars'`)
- Generoi **aina** uusi vahva satunnaisarvo tuotantoa varten
- Salasanat tallentuvat tietokantaan bcrypt-hashattuina
- JWT-evästeet ovat httpOnly ja SameSite=Lax
