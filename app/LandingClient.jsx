'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LandingClient({ user }) {
  const router = useRouter()
  const start = () => router.push('/projects')

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      {/* Top nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect x="4" y="4" width="32" height="32" rx="6" fill="#0ea5e9" />
              <path d="M12 22L20 14L28 22L20 30L12 22Z" fill="white" opacity="0.95" />
              <path d="M14 24L20 18L26 24L20 30L14 24Z" fill="white" opacity="0.5" />
            </svg>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1 }}>RefCAD Tool</div>
              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: '2px' }}>Cold Room Designer</div>
            </div>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link href="/pohjakuva" style={{ padding: '8px 14px', color: '#475569', textDecoration: 'none', fontSize: '14px', fontWeight: 500, borderRadius: '8px' }}>Pohjakuva</Link>
            <a href="#features" style={{ padding: '8px 14px', color: '#475569', textDecoration: 'none', fontSize: '14px', fontWeight: 500, borderRadius: '8px' }}>Ominaisuudet</a>
            <a href="#docs" style={{ padding: '8px 14px', color: '#475569', textDecoration: 'none', fontSize: '14px', fontWeight: 500, borderRadius: '8px' }}>Dokumentaatio</a>
            <a href="#pricing" style={{ padding: '8px 14px', color: '#475569', textDecoration: 'none', fontSize: '14px', fontWeight: 500, borderRadius: '8px' }}>Hinnoittelu</a>
            <button onClick={start} style={{
              padding: '10px 20px', background: '#0ea5e9', border: 'none', borderRadius: '8px',
              color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              marginLeft: '12px',
            }}>
              {user ? 'Avaa projektit' : 'Aloita ilmaiseksi'} →
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{
        padding: '80px 24px 100px',
        background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: '999px', fontSize: '13px', fontWeight: 500, color: '#475569',
            marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></span>
            RefCAD Tool v3.0.8 · Selaimessa toimiva CAD
          </div>
          <h1 style={{
            fontSize: '64px', fontWeight: 800, lineHeight: 1.05,
            letterSpacing: '-0.03em', marginBottom: '24px', color: '#0f172a',
            maxWidth: '900px', margin: '0 auto 24px',
          }}>
            Kylmähuoneen suunnittelu{' '}
            <span style={{ color: '#0ea5e9' }}>yhdellä työkalulla</span>
          </h1>
          <p style={{
            fontSize: '19px', color: '#475569', lineHeight: 1.65,
            maxWidth: '680px', margin: '0 auto 40px',
          }}>
            RefCAD Tool yhdistää luonnostelun ja lämpökuormalaskennan yhdeksi saumattomaksi kokonaisuudeksi. Suunniteltu kylmäalan ammattilaisille, jotka haluavat piirtää kylmähuoneensa, konfiguroida höyrystimet ja ovet, ja saada automaattisesti 3D-mallin — kaikki yhdessä paikassa.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '60px' }}>
            <button onClick={start} style={{
              padding: '16px 32px', background: '#0ea5e9', border: 'none', borderRadius: '10px',
              color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(14,165,233,0.3)',
            }}>
              ➕ Luo ensimmäinen projekti
            </button>
            <a href="#demo" style={{
              padding: '16px 28px', background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: '10px', color: '#0f172a',
              fontSize: '15px', fontWeight: 500, textDecoration: 'none',
            }}>
              ▶ Katso demo
            </a>
          </div>

          {/* Hero demo preview */}
          <div id="demo" style={{
            maxWidth: '1100px', margin: '0 auto',
            background: '#0f172a', borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
            border: '1px solid #1e293b',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '12px 16px', background: '#1e293b', borderBottom: '1px solid #334155',
            }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></span>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></span>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }}></span>
              <div style={{ flex: 1, textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>refcad-tool/app</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 280px', height: '520px' }}>
              {/* Sidebar */}
              <div style={{ background: '#1e293b', borderRight: '1px solid #334155', padding: '16px 12px', color: '#cbd5e1', fontSize: '12px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Projektit</div>
                <div style={{ padding: '8px 10px', background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.4)', borderRadius: '6px', marginBottom: '6px', color: '#fff' }}>
                  <div style={{ fontWeight: 600, marginBottom: '2px' }}>Iso kylmähuone</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>6.0m × 4.0m × 3.0m</div>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: '6px', marginBottom: '6px', color: '#cbd5e1' }}>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>Pakastevarasto</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>5.0m × 3.5m × 2.8m</div>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: '6px', marginBottom: '6px', color: '#cbd5e1' }}>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>Tuorehuone</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>4.0m × 3.0m × 2.8m</div>
                </div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '20px 0 10px' }}>Sketchet</div>
                <div style={{ padding: '6px 10px', color: '#cbd5e1', fontSize: '11px' }}>📐 Pohjapiirros</div>
                <div style={{ padding: '6px 10px', color: '#cbd5e1', fontSize: '11px' }}>📐 Laitteet</div>
                <div style={{ padding: '6px 10px', color: '#cbd5e1', fontSize: '11px' }}>📐 Lämpökuorma</div>
              </div>
              {/* Main canvas */}
              <div style={{ background: '#0a0f1e', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SupaCADDemo />
                {/* Top toolbar */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
                  {['2D', '3D', 'Mitat', 'Laitteet', 'Lämpökuorma'].map((t, i) => (
                    <div key={t} style={{
                      padding: '5px 10px', background: i === 0 ? '#0ea5e9' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px',
                      fontSize: '11px', color: '#fff', fontWeight: 500,
                    }}>{t}</div>
                  ))}
                </div>
              </div>
              {/* Right panel */}
              <div style={{ background: '#1e293b', borderLeft: '1px solid #334155', padding: '16px', color: '#cbd5e1', fontSize: '12px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Huone</div>
                <Row label="Tyyppi" value="Chilled" />
                <Row label="Lämpötila" value="+2 °C" />
                <Row label="Ympäristö" value="25 °C" />
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '16px 0 10px' }}>Mitat</div>
                <Row label="Pituus" value="6.0 m" />
                <Row label="Leveys" value="4.0 m" />
                <Row label="Korkeus" value="3.0 m" />
                <Row label="Pinta-ala" value="24.0 m²" />
                <Row label="Tilavuus" value="72.0 m³" />
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '16px 0 10px' }}>Lämpökuorma</div>
                <Row label="Q transmission" value="2.4 kW" />
                <Row label="Q tuote" value="0.8 kW" />
                <Row label="Q yhteensä" value="3.5 kW" highlight />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What is RefCAD section */}
      <section id="docs" style={{ padding: '100px 24px', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{
              display: 'inline-block', padding: '5px 14px', background: '#f0f9ff',
              borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: '#0369a1',
              marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>
              MIKÄ ON REFCAD TOOL?
            </div>
            <h2 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '20px', color: '#0f172a' }}>
              Erikoistunut kylmähuonesuunnitteluohjelmisto
            </h2>
            <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '720px', margin: '0 auto', lineHeight: 1.65 }}>
              RefCAD Tool yhdistää luonnostelun ja lämpökuormalaskennan yhdeksi saumattomaksi alustaksi. Se poistaa tarpeen hyppiä useiden työkalujen välillä — kaikki kylmähuoneen suunnitteluun tarvittava löytyy yhdestä paikasta.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {[
              { icon: '🎨', title: 'Luonnostele suoraan', desc: 'Piirrä kylmähuoneen pohjapiirros, lisää ovet, höyrystimet ja muut laitteet visuaalisesti.', color: '#0ea5e9' },
              { icon: '📐', title: '3D-isometrinen näkymä', desc: 'Kaunis automaattinen 3D-visualisointi kylmähuoneen kaikista komponenteista.', color: '#8b5cf6' },
              { icon: '⚡', title: 'Lämpökuormalaskenta', desc: 'Automaattinen Q-transmission, Q-infiltraatio ja Q-tuote -laskenta reaaliajassa.', color: '#f59e0b' },
              { icon: '🌡️', title: '5 kylmähuonetyyppiä', desc: 'Chilled, Frozen, Blast Chiller, Blast Freezer, Fresh — kaikki tuettuna.', color: '#06b6d4' },
              { icon: '📦', title: '14 esivalmistettua laitetta', desc: 'Ovet, höyrystimet, lauhduttimet, koneikot ja hyllyt — heti käyttövalmiina.', color: '#22c55e' },
              { icon: '📄', title: 'PDF-vienti', desc: 'Ammattimaiset PDF-raportit yhdellä klikkauksella.', color: '#ec4899' },
            ].map((f, i) => (
              <div key={i} style={{
                padding: '24px', background: '#fff',
                border: '1px solid #e5e7eb', borderRadius: '12px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '44px', height: '44px', fontSize: '22px',
                  background: `${f.color}15`, borderRadius: '10px', marginBottom: '14px',
                }}>{f.icon}</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>{f.title}</div>
                <div style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Projects & Sketches section */}
      <section id="features" style={{ padding: '100px 24px', background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{
              display: 'inline-block', padding: '5px 14px', background: '#f0f9ff',
              borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: '#0369a1',
              marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>
              PROJEKTIEN HALLINTA
            </div>
            <h2 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '20px', color: '#0f172a' }}>
              RefCAD Tool järjestää suunnitelmasi Projekteihin ja Sketch-tiedostoihin
            </h2>
            <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '720px', margin: '0 auto', lineHeight: 1.65 }}>
              Jokainen projekti sisältää useita kylmähuoneita (sketch-tiedostoja). Näin hallitset koko asiakkaan kylmähuonekokonaisuuden yhdellä klikkauksella.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              { num: '1', title: 'Luo projekti', desc: 'Anna projektille nimi (esim. "Kauppa X kylmähuoneet")', icon: '📁' },
              { num: '2', title: 'Lisää sketch', desc: 'Jokainen sketch = yksi kylmähuone (esim. "Pääkylmähuone", "Pakasteosasto")', icon: '📐' },
              { num: '3', title: 'Konfiguroi', desc: 'Aseta huonetyyppi, mitat, ympäristön lämpötila ja lisää laitteet', icon: '⚙️' },
              { num: '4', title: 'Laske', desc: 'Saat automaattisen lämpökuorman ja 3D-mallin', icon: '📊' },
              { num: '5', title: 'Jaa', desc: 'Vie PDF-raportti tai jaa linkki asiakkaalle', icon: '🔗' },
              { num: '6', title: 'Toista', desc: 'Kopioi projekti, muokkaa huonetta, luo versioita', icon: '🔄' },
            ].map((step, i) => (
              <div key={i} style={{
                padding: '28px 24px', background: '#fff',
                border: '1px solid #e5e7eb', borderRadius: '12px',
                position: 'relative',
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', height: '36px', background: '#0ea5e9', color: '#fff',
                  borderRadius: '50%', fontWeight: 700, fontSize: '14px',
                  marginBottom: '14px',
                }}>{step.num}</div>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '4px' }}>VAIHE {step.num}</div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>{step.title}</div>
                <div style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.55 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing section */}
      <section id="pricing" style={{ padding: '100px 24px', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', padding: '5px 14px', background: '#f0f9ff',
            borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: '#0369a1',
            marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1.5px',
          }}>
            HINNOITTELU
          </div>
          <h2 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '20px', color: '#0f172a' }}>
            Yksinkertainen hinnoittelu
          </h2>
          <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px', lineHeight: 1.65 }}>
            RefCAD Tool on tällä hetkellä ilmainen demo. Ei tilausmaksuja, ei luottokortteja, ei piilokustannuksia.
          </p>
          <div style={{
            padding: '40px', background: '#f8fafc',
            border: '1px solid #e5e7eb', borderRadius: '16px',
            maxWidth: '480px', margin: '0 auto',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>
              DEMO-TILI
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '56px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>0 €</span>
              <span style={{ fontSize: '16px', color: '#64748b' }}>/ ikuinen</span>
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              Kaikki ominaisuudet, ei rajoituksia.
            </div>
            <button onClick={start} style={{
              padding: '14px 28px', background: '#0ea5e9', border: 'none', borderRadius: '10px',
              color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
              width: '100%', boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
            }}>
              ➕ Aloita nyt
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px', background: '#0f172a', textAlign: 'center' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: '16px' }}>
            Valmis aloittamaan ensimmäisen kylmähuoneprojektisi?
          </h2>
          <p style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '32px', lineHeight: 1.6 }}>
            Ei rekisteröitymistä, ei luottokorttia, ei sitoumuksia. Avaa suunnittelija ja aloita 30 sekunnissa.
          </p>
          <button onClick={start} style={{
            padding: '16px 36px', background: '#0ea5e9', border: 'none', borderRadius: '10px',
            color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(14,165,233,0.4)',
          }}>
            ➕ Avaa RefCAD Tool
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '32px 24px', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#64748b' }}>
          <div>© 2026 RefCAD Tool · Kylmäalan ammattilaisille</div>
          <div>v3.0.8 · Avoin lähdekoodi</div>
        </div>
      </footer>
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{
        fontWeight: highlight ? 700 : 500,
        color: highlight ? '#22d3ee' : '#f1f5f9',
        fontFamily: 'monospace',
      }}>{value}</span>
    </div>
  )
}

// Clean isometric cold-room scene matching the demo theme
function SupaCADDemo() {
  return (
    <svg viewBox="0 0 500 350" style={{ width: '100%', height: '100%', maxWidth: '560px' }}>
      <defs>
        <linearGradient id="floorD" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0c1538" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="wallBD" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="wallLD" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="evapD" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      {/* Floor */}
      <polygon points="100,250 380,250 440,310 60,310" fill="url(#floorD)" stroke="#3b82f6" strokeWidth="1" />
      {/* Floor grid */}
      {[1, 2, 3].map(i => (
        <line key={`fv${i}`} x1={100 + i * 60} y1={250} x2={100 + i * 60} y2={310} stroke="rgba(59,130,246,0.2)" strokeWidth="0.5" />
      ))}
      {[1, 2, 3].map(i => (
        <line key={`fh${i}`} x1={100} y1={250 + i * 15} x2={440} y2={310 + i * 15} stroke="rgba(59,130,246,0.2)" strokeWidth="0.5" />
      ))}
      {/* Back wall */}
      <polygon points="100,250 380,250 380,80 100,80" fill="url(#wallBD)" stroke="#94a3b8" strokeWidth="1" />
      {/* Left wall */}
      <polygon points="100,250 60,310 60,140 100,80" fill="url(#wallLD)" stroke="#64748b" strokeWidth="1" />
      {/* Door (sliding, with frame) */}
      <rect x="200" y="180" width="60" height="70" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
      <line x1="200" y1="180" x2="260" y2="180" stroke="#92400e" strokeWidth="2" />
      <line x1="230" y1="185" x2="230" y2="245" stroke="#92400e" strokeWidth="0.5" strokeDasharray="2,2" />
      {/* Door dimensions */}
      <text x="230" y="195" textAnchor="middle" fill="#92400e" fontSize="9" fontWeight="700">0.9m</text>
      {/* Evaporator hanging from ceiling */}
      <rect x="170" y="120" width="100" height="20" fill="url(#evapD)" stroke="#475569" strokeWidth="1" rx="2" />
      {/* Cooling coils */}
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={i} x1={175 + i * 8} y1={124} x2={175 + i * 8} y2={136} stroke="#1e293b" strokeWidth="0.5" />
      ))}
      {/* Fans */}
      <circle cx={195} cy={130} r="5" fill="#1e293b" />
      <circle cx={220} cy={130} r="5" fill="#1e293b" />
      <circle cx={245} cy={130} r="5" fill="#1e293b" />
      {/* Hanging rods */}
      <line x1="175" y1="115" x2="175" y2="120" stroke="#475569" strokeWidth="1.5" />
      <line x1="265" y1="115" x2="265" y2="120" stroke="#475569" strokeWidth="1.5" />
      {/* Racking */}
      <rect x="290" y="200" width="80" height="50" fill="none" stroke="#ea580c" strokeWidth="1.5" />
      <line x1="290" y1="217" x2="370" y2="217" stroke="#ea580c" strokeWidth="1" />
      <line x1="290" y1="234" x2="370" y2="234" stroke="#ea580c" strokeWidth="1" />
      {/* Boxes on shelves */}
      <rect x="293" y="203" width="20" height="14" fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
      <rect x="316" y="203" width="20" height="14" fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
      <rect x="339" y="203" width="20" height="14" fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
      <rect x="293" y="220" width="20" height="14" fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
      <rect x="316" y="220" width="20" height="14" fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
      <rect x="293" y="237" width="20" height="14" fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
      {/* Width dimension (top) */}
      <line x1="100" y1="70" x2="380" y2="70" stroke="#22d3ee" strokeWidth="0.8" />
      <line x1="100" y1="65" x2="100" y2="75" stroke="#22d3ee" strokeWidth="0.8" />
      <line x1="380" y1="65" x2="380" y2="75" stroke="#22d3ee" strokeWidth="0.8" />
      <rect x="225" y="60" width="50" height="16" fill="#0f172a" stroke="#22d3ee" strokeWidth="0.5" rx="2" />
      <text x="250" y="72" textAnchor="middle" fill="#22d3ee" fontSize="10" fontWeight="700">6.0 m</text>
      {/* Depth */}
      <line x1="395" y1="250" x2="455" y2="310" stroke="#22d3ee" strokeWidth="0.8" />
      <text x="445" y="285" textAnchor="middle" fill="#22d3ee" fontSize="10" fontWeight="700" transform="rotate(35 445 285)">4.0 m</text>
      {/* Height */}
      <line x1="80" y1="80" x2="80" y2="250" stroke="#fbbf24" strokeWidth="0.8" />
      <text x="50" y="170" fill="#fbbf24" fontSize="10" fontWeight="700">H 3.0m</text>
      {/* Axis indicator */}
      <g transform="translate(40, 320)">
        <line x1="0" y1="0" x2="20" y2="0" stroke="#ef4444" strokeWidth="1.5" />
        <line x1="0" y1="0" x2="0" y2="-20" stroke="#22c55e" strokeWidth="1.5" />
        <line x1="0" y1="0" x2="-15" y2="9" stroke="#3b82f6" strokeWidth="1.5" />
        <text x="22" y="3" fill="#ef4444" fontSize="8" fontWeight="700">X</text>
        <text x="-3" y="-22" fill="#22c55e" fontSize="8" fontWeight="700">Y</text>
        <text x="-22" y="14" fill="#3b82f6" fontSize="8" fontWeight="700">Z</text>
      </g>
      {/* CHILLED badge */}
      <g transform="translate(280, 30)">
        <rect x="0" y="0" width="90" height="22" fill="#0f172a" stroke="#22d3ee" strokeWidth="1" rx="11" />
        <circle cx="12" cy="11" r="4" fill="#22d3ee" />
        <text x="22" y="15" fill="#22d3ee" fontSize="10" fontWeight="700">CHILLED</text>
      </g>
    </svg>
  )
}
