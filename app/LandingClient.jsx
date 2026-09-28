'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LandingClient({ user }) {
  const router = useRouter()

  const handleStart = () => {
    if (user) {
      router.push('/projects')
    } else {
      router.push('/signup')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0f1e', color: '#f1f5f9' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.6)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
          <svg width="32" height="32" viewBox="0 0 64 64">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <polygon points="32,8 52,20 32,32 12,20" fill="#dbeafe" opacity="0.9" />
            <polygon points="12,20 12,44 32,56 32,32" fill="#bfdbfe" opacity="0.9" />
            <polygon points="52,20 52,44 32,56 32,32" fill="url(#logoGrad)" />
          </svg>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, background: 'linear-gradient(135deg, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RefCAD Tool</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Cold Room Designer</div>
          </div>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {user ? (
            <>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{user.email}</span>
              <Link href="/projects" style={navBtnStyle}>Projektit</Link>
              <form action="/api/auth/logout" method="POST" style={{ display: 'inline' }}>
                <button type="submit" style={{ ...navBtnStyle, background: 'rgba(255,255,255,0.05)' }}>Kirjaudu ulos</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" style={navBtnStyle}>Kirjaudu</Link>
              <Link href="/signup" style={{ ...navBtnStyle, background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>Rekisteröidy</Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '40px 20px' }}>
        <div style={{ maxWidth: '1100px', width: '100%', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '40px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-block', padding: '4px 10px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '20px', fontSize: '11px', fontWeight: 600, color: '#60a5fa', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ❄️ For Refrigeration Contractors
            </div>
            <h1 style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.1, marginBottom: '20px', letterSpacing: '-0.02em' }}>
              The conversation <span style={{ background: 'linear-gradient(135deg, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>becomes the</span> layout.
            </h1>
            <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: '32px' }}>
              Design the room around the business, not the enquiry. RefCAD Tool turns the discovery conversation into the cold room layout for refrigeration contractors.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
              <button onClick={handleStart} style={{
                padding: '14px 28px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                border: 'none', borderRadius: '10px', color: '#fff',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59,130,246,0.4)'
              }}>
                {user ? 'Avaa projektit' : 'Aloita ilmaiseksi'} →
              </button>
              <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} style={{
                padding: '14px 24px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#f1f5f9',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer'
              }}>
                Lue lisää
              </button>
            </div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              <div>✓ Ei tilausmaksuja</div>
              <div>✓ Pilvitallennus</div>
              <div>✓ Reaaliaikainen 3D</div>
            </div>
          </div>

          {/* 3D isometric illustration */}
          <div style={{ position: 'relative', height: '480px' }}>
            <svg viewBox="0 0 500 500" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="wallLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>
                <linearGradient id="wallRight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#94a3b8" />
                </linearGradient>
                <linearGradient id="floorG" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e3a8a" stopOpacity=".9" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity=".7" />
                </linearGradient>
                <radialGradient id="fanG" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="80%" stopColor="#0f172a" />
                </radialGradient>
              </defs>
              {/* Floor */}
              <polygon points="120,300 380,300 440,360 60,360" fill="url(#floorG)" />
              {/* Walls */}
              <polygon points="120,300 380,300 380,160 120,160" fill="url(#wallLeft)" />
              <polygon points="380,300 440,360 440,220 380,160" fill="url(#wallRight)" />
              {/* Door */}
              <rect x="200" y="160" width="50" height="6" fill="#fbbf24" />
              <line x1="200" y1="160" x2="290" y2="100" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
              {/* Evaporator hanging from ceiling */}
              <rect x="135" y="180" width="80" height="20" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
              <line x1="135" y1="178" x2="215" y2="178" stroke="#1e293b" strokeWidth="1.5" />
              {[150, 170, 190, 210].map((x, i) => (
                <circle key={i} cx={x} cy={190} r="5" fill="url(#fanG)" stroke="#0f172a" strokeWidth="0.3" />
              ))}
              {/* Cooling coils inside */}
              {Array.from({ length: 8 }).map((_, i) => (
                <line key={i} x1={140 + i * 9} y1={185} x2={140 + i * 9} y2={195} stroke="#475569" strokeWidth="0.3" />
              ))}
              {/* Temperature display */}
              <circle cx="175" cy="230" r="14" fill="#06b6d4" stroke="#fff" strokeWidth="1.5" />
              <text x="175" y="234" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">+2°</text>
              {/* Airflow arrows */}
              <path d="M 160 215 L 160 230" stroke="#06b6d4" strokeWidth="1.5" />
              <path d="M 195 215 L 195 230" stroke="#06b6d4" strokeWidth="1.5" />
              {/* Rack */}
              <line x1="280" y1="160" x2="280" y2="290" stroke="#ea580c" strokeWidth="1.5" />
              <line x1="350" y1="160" x2="350" y2="290" stroke="#ea580c" strokeWidth="1.5" />
              <rect x="282" y="220" width="68" height="8" fill="#a16207" />
              <rect x="282" y="255" width="68" height="8" fill="#a16207" />
              {/* Wall dimensions */}
              <line x1="120" y1="140" x2="380" y2="140" stroke="#fbbf24" strokeWidth="0.5" />
              <text x="250" y="135" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700">5.0 m</text>
              <text x="450" y="220" fill="#fbbf24" fontSize="10" transform="rotate(45 450 220)">3.0 m</text>
              {/* H (height) */}
              <text x="80" y="230" fill="#22d3ee" fontSize="11" fontWeight="700">H: 3.0 m</text>
              {/* Origin axes */}
              <line x1="50" y1="380" x2="80" y2="380" stroke="#ef4444" strokeWidth="1" />
              <line x1="50" y1="380" x2="50" y2="410" stroke="#22c55e" strokeWidth="1" />
              <line x1="50" y1="380" x2="20" y2="380" stroke="#3b82f6" strokeWidth="1" />
              <text x="84" y="384" fill="#ef4444" fontSize="9">X</text>
              <text x="46" y="420" fill="#22c55e" fontSize="9">Z</text>
              <text x="14" y="384" fill="#3b82f6" fontSize="9">Y</text>
            </svg>
          </div>
        </div>
      </main>

      {/* Features */}
      <section id="features" style={{ padding: '60px 40px', background: 'rgba(15,23,42,0.6)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Kaikki mitä tarvitset kylmähuoneen suunnitteluun</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px' }}>Ammattimainen CAD-työkalu selaimessa — ilman asennuksia, ilman tilauksia.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {[
              { icon: '🏠', title: '5 huonetyyppiä', desc: 'Chilled, Frozen, Blast Chiller/Freezer, Fresh' },
              { icon: '🎲', title: '3D isometrinen', desc: 'Reaaliaikainen pyöritettävä näkymä' },
              { icon: '📊', title: 'Lämpökuorma', desc: 'Reaaliaikainen laskenta kaikille lähteille' },
              { icon: '⚙️', title: '14 laitetta', desc: 'Esivalmistetut ovet, höyrystimet, lauhduttimet' },
              { icon: '☁️', title: 'Pilvitallennus', desc: 'Tallenna ja jaa projekteja verkossa' },
              { icon: '📄', title: 'PDF-vienti', desc: 'Ammattimaiset raportit asiakkaalle' }
            ].map((f, i) => (
              <div key={i} style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{f.icon}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{f.title}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '20px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.8)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
        <div>© 2026 RefCAD Tool. For refrigeration contractors.</div>
        <div>v2.0.0 · Open source</div>
      </footer>
    </div>
  )
}

const navBtnStyle = {
  padding: '8px 14px', background: 'transparent', color: '#f1f5f9',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', textDecoration: 'none',
  fontSize: '13px', fontWeight: 600
}
