# RefCAD Tool

Professional Cold Room Designer - Next.js SaaS ilman tilausmaksuja.

## 🎯 Ominaisuudet

- **5 esivalmistettua kylmähuonetyyppiä**: Chilled (+2°C), Frozen (-18°C), Blast Chiller (0°C), Blast Freezer (-30°C), Fresh (-2°C)
- **Polygon-huoneiden piirtäminen** - vapaamuotoinen pohjapiirros
- **14 esivalmistettua laitetta**: ovet, höyrystimet, lauhduttimet, koneikot, hyllyt
- **Reaaliaikainen 3D-isometrinen näkymä** pyöritettävissä
- **Lämpökuorma-analyysi** - 6 eri lähdettä (johtuminen, ilmanvaihto, tuotteet, laitteet, valaistus, henkilöt)
- **Drag & drop** - laitteiden raahaus huoneisiin
- **Kontekstivalikko** - kopioi, liitä, kierrä, siirrä
- **Automaattinen mittayksikön vaihto** (mm/cm/m)
- **PDF-vienti** (3-sivuinen raportti)
- **Pilvitallennus** - projekti- ja käyttäjäkohtainen

## 🔐 Autentikointi

- JWT-evästeet (`jose`)
- Salasanan hashays (`bcryptjs`)
- Ei kolmannen osapuolen kirjautumispalvelua
- Ei tilausmaksuja, ei Stripe-integraatiota
- Käyttäjäkohtainen tietovarasto

## 🛠 Teknologia

- **Next.js 14** App Router
- **React 18**
- **jose** (JWT)
- **bcryptjs** (salasanat)
- **jsPDF** (PDF-vienti)
- Tiedostopohjainen tietovarasto (data/db.json)

## 📁 Rakenne

```
app/
  page.jsx              # Laskeutumissivu (SupaCAD-tyyli)
  LandingClient.jsx     # Tyylitelty aloitussivu
  login/, signup/       # Autentikointisivut
  projects/
    page.jsx            # Projektien lista (suojattu)
    ProjectsClient.jsx  # Projektinhallinta UI
    [id]/
      page.jsx          # Yksittäisen projektin muokkaus
      DesignerClient.jsx # Cold Room Designer
  api/
    auth/               # Login/signup/logout endpointit
    projects/           # CRUD-projektit
lib/
  auth.js               # JWT, bcrypt, evästehallinta
  db.js                 # JSON-tiedostopohjainen tietokanta
data/
  db.json               # Käyttäjät ja projektit
```

## 🚀 Asennus ja käyttöönotto

### Paikallinen kehitys
```bash
npm install
AUTH_SECRET=your-secret-key-here npm run dev
```

Avaa [http://localhost:3000](http://localhost:3000)

### Tuotanto (esim. Railway, Render, Fly.io)
```bash
npm install
AUTH_SECRET=your-secret-key-here npm run build
AUTH_SECRET=your-secret-key-here npm start
```

### Ympäristömuuttujat
- `AUTH_SECRET` - salaisten JWT:ien allekirjoitusavain (min 32 merkkiä)

## 📝 Lisenssi

MIT License
