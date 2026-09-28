# RefCAD Tool

Professional Cold Room Designer - Web-sovellus kylmähuoneiden suunnitteluun.

## Ominaisuudet

- **5 esivalmistettua huonetyyppiä**: Chilled (+2°C), Frozen (-18°C), Blast Chiller (0°C), Blast Freezer (-30°C), Fresh (-2°C)
- **Polygon-huoneiden piirtäminen** - vapaamuotoinen pohjapiirros
- **Esivalmistetut laitetemplateet** - ovet, höyrystimet, lauhduttimet, koneikot, hyllyt
- **Reaaliaikainen 3D-isometrinen näkymä** pyöritettävissä
- **Lämpökuorma-analyysi** - reaaliaikainen laskenta
- **Kontekstivalikko (oikea klikkaus)** - siirrä, kopioi, kierrä, muokkaa
- **Drag & drop** - laitteiden raahaus huoneisiin
- **Automaattinen tallennus** localStorageen
- **PDF/JSON-vienti**
- **SI/IP-yksikön vaihto** (mm/cm/m)
- **Suomenkielinen käyttöliittymä**

## Teknologia

- React 18
- Vite
- Three.js (valinnainen, SVG korvaa)
- jsPDF

## Asennus

```bash
npm install
npm run dev          # Kehitys
npm run build        # Tuotanto
npm run preview      # Esikatselu
```

## Lisenssi

MIT
