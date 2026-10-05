'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PLANS } from '@/lib/access'
import { useLocale } from '@/components/i18n/Locale'

const features = [
  {
    title: 'Kylmiöt',
    text: 'Höyrystin, koneikko, putkistot ja kuormalaskenta pysyvät kylmähuoneen suunnittelussa.',
    image: '/marketing/cold-room.jpg',
    alt: 'Kylmähuone, jossa kattoon asennettu höyrystin',
  },
  {
    title: 'Talot',
    text: 'Omakotitalo, rivitalo, paritalo ja liikerakennus samassa pohjakuvassa. Sähkö, LVI ja IV maksullisessa tilassa.',
    image: '/marketing/house.jpg',
    alt: 'Puinen omakotitalo',
  },
  {
    title: 'Hallit',
    text: 'Halli saa suuren huonekorkeuden. Kehärakenteet, nosto-ovet ja hyllyt tulevat hallin kirjastoon.',
    image: '/marketing/hall.jpg',
    alt: 'Teräsrunkoinen varastohali',
  },
]

export default function LandingClient() {
  const { t } = useLocale()
  const [yearly, setYearly] = useState(false)
  const [user, setUser] = useState(null)
  const [notice, setNotice] = useState('')
  const [ordered, setOrdered] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then((res) => res.json()).then((data) => setUser(data.user || null)).catch(() => {})
  }, [])

  const ask = async (plan) => {
    if (plan.id === 'free') return
    if (!user) {
      window.location.href = `/signup?plan=${plan.id}&cycle=${yearly ? 'year' : 'month'}`
      return
    }
    const res = await fetch('/api/billing/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: plan.id, cycle: yearly ? 'year' : 'month' }),
    })
    const data = await res.json()
    setOrdered(res.ok)
    setNotice(res.ok ? t('price.thanks') : (data.error || t('price.failed')))
  }

  return (
    <div data-testid="landing" style={{ background: '#fff', color: '#0f172a' }}>
      <header className="landing-header">
        <Link href="/" style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', textDecoration: 'none' }}>RefCAD</Link>
        <nav className="landing-nav">
          <a href="#kohteet" style={nav}>Kohteet</a>
          <a href="#pricing" style={nav}>Hinnasto</a>
          <Link href={user?.role === 'admin' ? '/admin' : '/login'} style={nav}>{user?.role === 'admin' ? 'Ylläpito' : 'Kirjaudu'}</Link>
          <Link href="/uusi" data-testid="landing-start" style={primary}>Aloita piirtäminen</Link>
        </nav>
      </header>

      <section data-testid="landing-hero" className="landing-hero" style={{ padding: '72px 24px 48px', background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 70%)' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, color: '#0369a1' }}>Pohjakuva, talotekniikka ja kylmä</p>
          <h1 className="landing-title">Piirrä kylmiö, talo tai halli yhdessä paikassa</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: '#475569', maxWidth: 720, margin: '0 auto 28px' }}>
            RefCAD on selaimessa toimiva suunnittelutyökalu. Ilmainen versio piirtää pohjakuvan. Maksullinen tila avaa sähkö-, LVI-, IV-, piha- ja kylmätyötilat sekä puhtaan tulosteen.
          </p>
          <div className="landing-actions" style={{ justifyContent: 'center' }}>
            <Link href="/uusi" style={primary}>Valitse hanketyyppi</Link>
            <a href="#pricing" style={secondary}>Katso ohjeelliset hinnat</a>
          </div>
        </div>
      </section>

      <section id="kohteet" className="landing-grid" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 72px' }}>
        {features.map((item) => (
          <article key={item.title} data-testid={`feature-${item.title}`} style={{ border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden', background: '#fff' }}>
            <img src={item.image} alt={item.alt} style={{ width: '100%', height: 210, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: 18 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>{item.title}</h2>
              <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>{item.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section id="pricing" data-testid="pricing" style={{ background: '#f8fafc', padding: '64px 24px 80px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
            <div>
              <h2 style={{ fontSize: 36, margin: '0 0 8px' }}>Hinnasto</h2>
              <p data-testid="pricing-note" style={{ margin: 0, maxWidth: 640, color: '#475569', lineHeight: 1.5 }}>{t('price.note')}</p>
            </div>
            <button type="button" data-testid="billing-cycle" onClick={() => setYearly((value) => !value)} style={secondary}>
              {yearly ? 'Vuosi, 2 kk veloituksetta' : 'Näytä vuosihinta'}
            </button>
          </div>
          {notice && (
            <p data-testid={ordered ? 'order-thanks' : 'order-error'} style={{ marginTop: 16, maxWidth: 640, padding: '12px 14px', background: ordered ? '#f0fdf4' : '#fff7ed', border: `1px solid ${ordered ? '#86efac' : '#fdba74'}`, borderRadius: 10, color: ordered ? '#166534' : '#9a3412', lineHeight: 1.5 }}>{notice}</p>
          )}
          <div data-testid="pricing-grid" className="pricing-grid" style={{ marginTop: 24 }}>
            {PLANS.map((plan) => (
              <article key={plan.id} data-testid={`price-${plan.id}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{plan.name}</div>
                <div style={{ fontSize: 32, margin: '8px 0' }}>{yearly ? plan.yearly : plan.monthly} €<span style={{ fontSize: 14, color: '#64748b' }}>{plan.monthly === 0 ? '' : yearly ? '/vuosi' : '/kk'}</span></div>
                <div style={{ color: '#64748b', minHeight: 40 }}>{plan.audience}</div>
                <ul style={{ paddingLeft: 18, color: '#334155', lineHeight: 1.5, flex: 1 }}>
                  {plan.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
                {plan.id === 'free' ? (
                  <Link href="/uusi" style={{ ...primary, textAlign: 'center' }}>Piirrä pohjakuva</Link>
                ) : (
                  <button type="button" data-testid={`ask-${plan.id}`} onClick={() => ask(plan)} style={primary}>{t('price.order')}</button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

const nav = { color: '#334155', textDecoration: 'none', fontWeight: 600 }
const primary = { display: 'inline-block', padding: '12px 16px', borderRadius: 10, background: '#0284c7', color: '#fff', textDecoration: 'none', fontWeight: 700, border: 'none', cursor: 'pointer' }
const secondary = { display: 'inline-block', padding: '12px 16px', borderRadius: 10, background: '#fff', color: '#0f172a', textDecoration: 'none', fontWeight: 700, border: '1px solid #cbd5e1', cursor: 'pointer' }
