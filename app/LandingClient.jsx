'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function LandingClient({ user }) {
  const router = useRouter()

  const handleStart = () => {
    router.push('/projects')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0a0f1e', color: '#f1f5f9', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px',
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
          <svg width="40" height="40" viewBox="0 0 64 64">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <polygon points="32,6 56,20 32,34 8,20" fill="#dbeafe" opacity="0.95" />
            <polygon points="8,20 8,46 32,60 32,34" fill="#bfdbfe" opacity="0.95" />
            <polygon points="56,20 56,46 32,60 32,34" fill="url(#logoGrad)" />
          </svg>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, background: 'linear-gradient(135deg, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>RefCAD Tool</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '3px' }}>Cold Room Designer</div>
          </div>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a href="#features" style={navBtnStyle}>Ominaisuudet</a>
          <a href="#demo" style={navBtnStyle}>Demo</a>
          <button onClick={handleStart} style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            border: 'none', borderRadius: '8px', color: '#fff',
            fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
          }}>
            {user ? 'Avaa projektit' : 'Aloita ilmaiseksi'} →
          </button>
        </nav>
      </header>

      {/* Hero */}
      <main style={{ flex: 1 }}>
        <section style={{
          position: 'relative',
          padding: '60px 32px 80px',
          background: 'radial-gradient(ellipse at top, rgba(59,130,246,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(6,182,212,0.12), transparent 50%)',
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '60px', alignItems: 'center' }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 14px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)',
                borderRadius: '24px', fontSize: '11px', fontWeight: 600, color: '#60a5fa',
                marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1.5px',
              }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }}></span>
                Ammattilaisille · Kylmähuonesuunnittelu
              </div>
              <h1 style={{ fontSize: '56px', fontWeight: 800, lineHeight: 1.05, marginBottom: '24px', letterSpacing: '-0.025em' }}>
                Suunnittele kylmähuone{' '}
                <span style={{ background: 'linear-gradient(135deg, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>selaimessa</span>.
              </h1>
              <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, marginBottom: '36px', maxWidth: '540px' }}>
                RefCAD Tool on selainpohjainen CAD-työkalu kylmäurakoitsijoille. Piirrä 2D-pohjapiirros, katso 3D-isometrinen näkymä, laske lämpökuorma automaattisesti ja vie PDF-raportti.
              </p>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '44px' }}>
                <button onClick={handleStart} style={{
                  padding: '14px 28px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                  border: 'none', borderRadius: '10px', color: '#fff',
                  fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 24px rgba(59,130,246,0.45)',
                }}>
                  ➕ Luo uusi projekti
                </button>
                <a href="#demo" style={{
                  padding: '14px 24px', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#f1f5f9',
                  fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                }}>
                  ▶ Katso demo
                </a>
              </div>
              <div style={{ display: 'flex', gap: '32px', fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                <FeaturePill text="Ei tilauksia" />
                <FeaturePill text="Ei asennuksia" />
                <FeaturePill text="Toimii kaikkialla" />
              </div>
            </div>

            {/* 3D Isometric Cold Room Illustration */}
            <div id="demo" style={{ position: 'relative', height: '520px' }}>
              <SupaCADScene />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" style={{ padding: '80px 32px', background: 'rgba(15,23,42,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '20px', fontSize: '11px', fontWeight: 600, color: '#22d3ee', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                OMINAISUUDET
              </div>
              <h2 style={{ fontSize: '38px', fontWeight: 800, marginBottom: '14px', letterSpacing: '-0.02em' }}>
                Kaikki mitä tarvitset kylmähuoneen suunnitteluun
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
                Ammattimainen CAD ilman asennuksia, ilman tilauksia, suoraan selaimessa.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {[
                { icon: '❄️', title: '5 kylmähuonetyyppiä', desc: 'Chilled, Frozen, Blast Chiller, Blast Freezer, Fresh', color: '#3b82f6' },
                { icon: '🎲', title: '3D-isometrinen näkymä', desc: 'Reaaliaikainen pyöritettävä visualisointi', color: '#06b6d4' },
                { icon: '🚪', title: '14 esivalmistettua laitetta', desc: 'Ovet, höyrystimet, lauhduttimet, koneikot, hyllyt', color: '#8b5cf6' },
                { icon: '📊', title: 'Lämpökuormalaskenta', desc: 'Automaattinen Q-transmission, Q-infiltraatio, Q-tuote', color: '#22c55e' },
                { icon: '🖱️', title: 'Drag-and-drop', desc: 'Vedä ja pudota laitteet suoraan pohjapiirrokseen', color: '#f59e0b' },
                { icon: '📏', title: 'Mitat & merkinnät', desc: 'mm/cm/m-yksiköissä, automaattiset seinämitat', color: '#ec4899' },
                { icon: '📄', title: 'PDF-vienti', desc: 'Ammattimainen raportti yhdellä klikkauksella', color: '#06b6d4' },
                { icon: '💾', title: 'Selaimen tallennus', desc: 'localStorage — toimii ilman pilveä tai tiliä', color: '#3b82f6' },
              ].map((f, i) => (
                <div key={i} style={{
                  padding: '24px',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = f.color
                  e.currentTarget.style.transform = 'translateY(-4px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '48px', height: '48px',
                    background: `${f.color}20`,
                    border: `1px solid ${f.color}40`,
                    borderRadius: '12px',
                    fontSize: '24px',
                    marginBottom: '14px',
                  }}>
                    {f.icon}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#f1f5f9' }}>{f.title}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '80px 32px', textAlign: 'center', background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.15), transparent 70%)' }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.02em' }}>
              Valmis aloittamaan?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', marginBottom: '32px' }}>
              Ei rekisteröitymistä, ei luottokorttia. Avaa suunnittelija ja aloita ensimmäinen projektisi 30 sekunnissa.
            </p>
            <button onClick={handleStart} style={{
              padding: '16px 36px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              border: 'none', borderRadius: '12px', color: '#fff',
              fontSize: '16px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 6px 28px rgba(59,130,246,0.5)',
            }}>
              ➕ Luo ensimmäinen projekti
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '24px 32px', borderTop: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(15,23,42,0.8)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        fontSize: '12px', color: 'rgba(255,255,255,0.4)',
      }}>
        <div>© 2026 RefCAD Tool · Kylmäurakoitsijoille</div>
        <div>v3.0.7 · Avoin lähdekoodi</div>
      </footer>
    </div>
  )
}

function FeaturePill({ text }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(34,211,238,0.2)', color: '#22d3ee', fontSize: '9px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
      {text}
    </div>
  )
}

// Beautiful isometric cold-room scene — the heart of SupaCAD-style UI.
function SupaCADScene() {
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setRotation((r) => (r + 0.4) % 360), 50)
    return () => clearInterval(id)
  }, [])

  // Isometric projection constants — classic 30°/30° cabinet projection
  const cos = Math.cos((rotation * Math.PI) / 180) * 0.3
  const sin = Math.sin((rotation * Math.PI) / 180) * 0.3

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse at center bottom, rgba(59,130,246,0.15), transparent 70%)',
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <svg viewBox="0 0 600 600" style={{ width: '90%', height: '90%' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Wall gradients */}
          <linearGradient id="wallLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="wallRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="wallBack" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          {/* Floor */}
          <linearGradient id="floorG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          {/* Equipment gradients */}
          <linearGradient id="evapGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="doorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="rackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#9a3412" />
          </linearGradient>
          <radialGradient id="coolGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          {/* Shadow filter */}
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="3" result="offsetblur" />
            <feComponentTransfer><feFuncA type="linear" slope="0.4" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="300" cy="500" rx="220" ry="22" fill="rgba(0,0,0,0.45)" />

        {/* === COLD ROOM BUILDING === */}
        {/* Floor (parallelogram in isometric) */}
        <polygon
          points={`${150 + cos * 100},${420 + sin * 100} ${450 + cos * 100},${420 + sin * 100} ${510 - cos * 60},${490 - sin * 60} ${90 - cos * 60},${490 - sin * 60}`}
          fill="url(#floorG)"
          stroke="#475569"
          strokeWidth="1"
        />
        {/* Floor grid */}
        {[1, 2, 3, 4].map((i) => (
          <line
            key={`gv${i}`}
            x1={150 + cos * 100 + ((i * 60)) * (1 - cos * 0.4)}
            y1={420 + sin * 100 + ((i * 60)) * (sin * 0.4)}
            x2={450 + cos * 100 + ((i * 60)) * (1 - cos * 0.4)}
            y2={420 + sin * 100 + ((i * 60)) * (sin * 0.4)}
            stroke="#334155"
            strokeWidth="0.5"
            opacity="0.5"
          />
        ))}
        {[1, 2, 3, 4].map((i) => (
          <line
            key={`gh${i}`}
            x1={150 + cos * 100}
            y1={420 + sin * 100 + i * 17}
            x2={510 - cos * 60}
            y2={490 - sin * 60 + i * 17}
            stroke="#334155"
            strokeWidth="0.5"
            opacity="0.5"
          />
        ))}

        {/* Back wall (left face) */}
        <polygon
          points={`${150 + cos * 100},${420 + sin * 100} ${450 + cos * 100},${420 + sin * 100} ${450 + cos * 100},${160 + sin * 100} ${150 + cos * 100},${160 + sin * 100}`}
          fill="url(#wallBack)"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        {/* Side wall (right face) */}
        <polygon
          points={`${450 + cos * 100},${420 + sin * 100} ${510 - cos * 60},${490 - sin * 60} ${510 - cos * 60},${230 - sin * 60} ${450 + cos * 100},${160 + sin * 100}`}
          fill="url(#wallRight)"
          stroke="#64748b"
          strokeWidth="1.5"
        />
        {/* Left wall */}
        <polygon
          points={`${150 + cos * 100},${420 + sin * 100} ${90 - cos * 60},${490 - sin * 60} ${90 - cos * 60},${230 - sin * 60} ${150 + cos * 100},${160 + sin * 100}`}
          fill="url(#wallLeft)"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />

        {/* === DOOR (front, with frame) === */}
        <g filter="url(#shadow)">
          <polygon
            points={`${280 + cos * 100},${420 + sin * 100} ${340 + cos * 100},${420 + sin * 100} ${340 + cos * 100},${260 + sin * 100} ${280 + cos * 100},${260 + sin * 100}`}
            fill="url(#doorGrad)"
            stroke="#92400e"
            strokeWidth="1.5"
          />
          {/* Door handle */}
          <circle cx={335 + cos * 100} cy={345 + sin * 100} r="3" fill="#fbbf24" stroke="#92400e" strokeWidth="0.5" />
          {/* Door hinges */}
          <rect x={282 + cos * 100} y={285 + sin * 100} width="3" height="6" fill="#78350f" />
          <rect x={282 + cos * 100} y={395 + sin * 100} width="3" height="6" fill="#78350f" />
        </g>

        {/* === EVAPORATOR (hanging from ceiling) === */}
        <g filter="url(#shadow)">
          {/* Hanging bracket */}
          <line x1={210 + cos * 50} y1={190 + sin * 50} x2={210 + cos * 50} y2={220 + sin * 50} stroke="#475569" strokeWidth="1.5" />
          <line x1={290 + cos * 50} y1={190 + sin * 50} x2={290 + cos * 50} y2={220 + sin * 50} stroke="#475569" strokeWidth="1.5" />
          {/* Unit body */}
          <rect
            x={200 + cos * 50} y={220 + sin * 50}
            width={100}
            height={26}
            fill="url(#evapGrad)"
            stroke="#475569"
            strokeWidth="1.2"
            rx="2"
          />
          {/* Cooling coils */}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={i}
              x1={205 + cos * 50 + i * 8}
              y1={224 + sin * 50}
              x2={205 + cos * 50 + i * 8}
              y2={243 + sin * 50}
              stroke="#1e293b"
              strokeWidth="0.5"
              opacity="0.6"
            />
          ))}
          {/* Fans */}
          <circle cx={220 + cos * 50} cy={233 + sin * 50} r="6" fill="#1e293b" stroke="#0f172a" strokeWidth="0.5" />
          <circle cx={250 + cos * 50} cy={233 + sin * 50} r="6" fill="#1e293b" stroke="#0f172a" strokeWidth="0.5" />
          <circle cx={280 + cos * 50} cy={233 + sin * 50} r="6" fill="#1e293b" stroke="#0f172a" strokeWidth="0.5" />
          {/* Fan blades */}
          {[220, 250, 280].map((cx, i) => (
            <g key={`fb${i}`} transform={`rotate(${rotation * 3} ${cx + cos * 50} ${233 + sin * 50})`}>
              <ellipse cx={cx + cos * 50} cy={233 + sin * 50} rx="5" ry="1.5" fill="#475569" />
            </g>
          ))}
        </g>

        {/* === RACKING (right side, multi-level) === */}
        <g filter="url(#shadow)">
          {/* Vertical posts */}
          <line x1={400 + cos * 70} y1={200 + sin * 70} x2={400 + cos * 70} y2={415 + sin * 70} stroke="url(#rackGrad)" strokeWidth="3" />
          <line x1={440 + cos * 70} y1={200 + sin * 70} x2={440 + cos * 70} y2={415 + sin * 70} stroke="url(#rackGrad)" strokeWidth="3" />
          {/* Shelves */}
          <rect x={398 + cos * 70} y={245 + sin * 70} width={44} height={6} fill="#a16207" stroke="#78350f" strokeWidth="0.5" />
          <rect x={398 + cos * 70} y={290 + sin * 70} width={44} height={6} fill="#a16207" stroke="#78350f" strokeWidth="0.5" />
          <rect x={398 + cos * 70} y={335 + sin * 70} width={44} height={6} fill="#a16207" stroke="#78350f" strokeWidth="0.5" />
          <rect x={398 + cos * 70} y={380 + sin * 70} width={44} height={6} fill="#a16207" stroke="#78350f" strokeWidth="0.5" />
          {/* Boxes on shelves */}
          <rect x={402 + cos * 70} y={232 + sin * 70} width={12} height={13} fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
          <rect x={416 + cos * 70} y={232 + sin * 70} width={12} height={13} fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
          <rect x={430 + cos * 70} y={232 + sin * 70} width={10} height={13} fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
          <rect x={402 + cos * 70} y={277 + sin * 70} width={12} height={13} fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
          <rect x={416 + cos * 70} y={277 + sin * 70} width={12} height={13} fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
          <rect x={402 + cos * 70} y={322 + sin * 70} width={14} height={13} fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
        </g>

        {/* === TEMPERATURE DISPLAY === */}
        <g filter="url(#shadow)">
          <rect x={170 + cos * 50} y={295 + sin * 50} width={70} height={32} fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" rx="3" />
          <text x={205 + cos * 50} y={318 + sin * 50} textAnchor="middle" fill="#22d3ee" fontSize="18" fontWeight="700" fontFamily="monospace">+2°C</text>
        </g>

        {/* === DIMENSIONS === */}
        <g>
          {/* Width dimension (top) */}
          <line x1={150 + cos * 100} y1={150 + sin * 100} x2={450 + cos * 100} y2={150 + sin * 100} stroke="#fbbf24" strokeWidth="0.8" />
          <line x1={150 + cos * 100} y1={145 + sin * 100} x2={150 + cos * 100} y2={155 + sin * 100} stroke="#fbbf24" strokeWidth="0.8" />
          <line x1={450 + cos * 100} y1={145 + sin * 100} x2={450 + cos * 100} y2={155 + sin * 100} stroke="#fbbf24" strokeWidth="0.8" />
          <rect x={285 + cos * 100} y={140 + sin * 100} width={50} height={18} fill="#0a0f1e" stroke="#fbbf24" strokeWidth="0.5" rx="2" />
          <text x={310 + cos * 100} y={153 + sin * 100} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700">6.0 m</text>

          {/* Depth dimension (right side) */}
          <line x1={460 + cos * 100} y1={420 + sin * 100} x2={520 - cos * 60} y2={490 - sin * 60} stroke="#fbbf24" strokeWidth="0.8" />
          <text x={485} y={465} textAnchor="middle" fill="#fbbf24" fontSize="10" fontWeight="700" transform="rotate(35 485 465)">4.0 m</text>

          {/* Height dimension (left) */}
          <line x1={140 + cos * 100} y1={160 + sin * 100} x2={140 + cos * 100} y2={420 + sin * 100} stroke="#22d3ee" strokeWidth="0.8" />
          <text x={125 + cos * 100} y={290 + sin * 100} fill="#22d3ee" fontSize="11" fontWeight="700" textAnchor="middle">H 3.0m</text>
        </g>

        {/* === AXIS INDICATOR (bottom right) === */}
        <g transform="translate(530, 540)">
          <line x1="0" y1="0" x2="20" y2="0" stroke="#ef4444" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="0" y2="-20" stroke="#22c55e" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="-15" y2="9" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="22" y="3" fill="#ef4444" fontSize="10" fontWeight="700">X</text>
          <text x="-3" y="-22" fill="#22c55e" fontSize="10" fontWeight="700">Y</text>
          <text x="-25" y="14" fill="#3b82f6" fontSize="10" fontWeight="700">Z</text>
        </g>

        {/* === INFO BADGES === */}
        <g transform="translate(80, 80)">
          <rect x="0" y="0" width="100" height="24" fill="#0f172a" stroke="#22d3ee" strokeWidth="1" rx="12" />
          <circle cx="12" cy="12" r="4" fill="#22d3ee" />
          <text x="22" y="16" fill="#22d3ee" fontSize="11" fontWeight="700">CHILLED</text>
        </g>
        <g transform="translate(450, 90)">
          <rect x="0" y="0" width="80" height="22" fill="#0f172a" stroke="#06b6d4" strokeWidth="1" rx="11" />
          <text x="40" y="15" textAnchor="middle" fill="#06b6d4" fontSize="10" fontWeight="700">10 kW</text>
        </g>
      </svg>
    </div>
  )
}

const navBtnStyle = {
  padding: '8px 14px', background: 'transparent', color: '#f1f5f9',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', textDecoration: 'none',
  fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center',
}
