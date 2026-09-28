# 🌐 Cloudflare Pages -julkaisuohje

## ✅ Miksi Cloudflare Pages?

- ✅ **Ilmainen** - rajoittamaton kaista, 500 buildia/kk
- ✅ **Nopea** - Cloudflare maailmanlaajuinen CDN
- ✅ **Next.js -tuki** natiivisti
- ✅ **Custom domain** - ilmainen HTTPS
- ✅ **Server-Side Rendering** Workersin kautta (ilmainen taso: 100k req/pv)
- ✅ **Git-integraatio** - pushaa, julkaisee automaattisesti

## 🚀 Julkaisu vaihe vaiheelta

### Vaihe 1: Luo Cloudflare-tili
- Mene [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
- Rekisteröidy ilmaiseksi (ei vaadi luottokorttia)

### Vaihe 2: Luo Pages-projekti
1. Vasemmalta valikosta **Workers & Pages** → **Create**
2. Valitse **Pages** → **Connect to Git**
3. Valitse **GitHub** → Authorize
4. Valitse repositorio: `molaplan1-cloud/refcad-tool`

### Vaihe 3: Asenna build-asetukset
Anna nämä tiedot:

| Kenttä | Arvo |
|--------|------|
| **Project name** | `refcad-tool` |
| **Production branch** | `master` |
| **Framework preset** | `Next.js` |
| **Build command** | `npx @cloudflare/next-on-pages@1 build` |
| **Build output directory** | `.vercel/output/static` |

### Vaihe 4: Lisää ympäristömuuttujat
Settings → Environment variables → Production:

| Variable | Value |
|----------|-------|
| `AUTH_SECRET` | (generate one - see below) |
| `NODE_VERSION` | `20` |

**Generoi AUTH_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Vaihe 5: Klikkaa "Save and Deploy"
Rakennus kestää noin 2-5 minuuttia. Saat URL:n kuten:
- `https://refcad-tool.pages.dev`

### Vaihe 6: Custom domain (valinnainen)
1. Pages projekti → Custom domains → Set up a domain
2. Lisää `refcad.fi` tai oma verkkotunnuksesi
3. Päivitä DNS-tietueet (CNAME)

## ⚠️ Tärkeää: Päivitä Auth Secret

Tuotantokäytössä AUTH_SECRET **EI SAA** olla oletusarvo. Generoi vahva satunnaisarvo:

```bash
# Unix / Mac
openssl rand -hex 32

# Windows PowerShell
-join (((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) }))
```

Aseta se Cloudflare dashboardissa → Settings → Environment Variables.

## 🔧 Paikallinen testaus ennen julkaisua

```bash
# Asenna Cloudflare adapter
npm install --save-dev @cloudflare/next-on-pages wrangler

# Buildaa paikallisesti
npx @cloudflare/next-on-pages build

# Testaa wranglerilla
npx wrangler pages dev .vercel/output/static
```

## 🚦 Rajoitukset (ilmainen taso)

- ✅ 500 buildia/kk
- ✅ 100,000 pyyntöä/pv
- ⚠️ Worker CPU-aika: 10ms/req
- ⚠️ Jos käyttäjämäärä kasvaa → Workers Paid ($5/kk, 10M req/kk)

## 📱 PWA-tuki (valinnainen)

Lisää `manifest.json` ja service worker PWA:ta varten.

## 🎯 Lopullinen julkaisu

Kun build on valmis, sovellus on osoitteessa `https://refcad-tool.pages.dev` (tai omalla verkkotunnuksellasi).

---

Vaihtoehtoiset alustat:
- **Vercel**: Helpompi, mutta kaupallinen. Pages-yhteensopiva Next.js.
- **Railway**: $5/kk täysi hallinta
- **Render**: Ilmainen tier olemassa
