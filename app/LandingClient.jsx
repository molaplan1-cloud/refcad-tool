'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PLANS } from '@/lib/access'
import { ShellLanguage, useLocale } from '@/components/i18n/Locale'

const FEATURES = ['cold', 'house', 'hall']
const PLAN_POINTS = { free: 2, basic: 3, pro: 5, company: 3 }

export default function LandingClient() {
  const { t } = useLocale()
  const [yearly, setYearly] = useState(false)
  const [user, setUser] = useState(null)
  const [notice, setNotice] = useState('')

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
    setNotice(res.ok ? t('shell.pending') : (data.error || t('shell.requestFailed')))
  }

  return (
    <div data-testid="landing" style={{ background: '#fff', color: '#0f172a' }}>
      <header className="landing-header">
        <Link href="/" style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', textDecoration: 'none' }}>RefCAD</Link>
        <nav className="landing-nav">
          <a href="#kohteet" style={nav}>{t('shell.targets')}</a>
          <a href="#pricing" style={nav}>{t('shell.pricing')}</a>
          <Link href={user?.role === 'admin' ? '/admin' : '/login'} style={nav}>{user?.role === 'admin' ? t('shell.admin') : t('shell.login')}</Link>
          <Link href="/uusi" data-testid="landing-start" style={primary}>{t('shell.start')}</Link>
          <ShellLanguage tone="light" />
        </nav>
      </header>

      <section data-testid="landing-hero" className="landing-hero" style={{ padding: '72px 24px 48px', background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 70%)' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, color: '#0369a1' }}>{t('shell.eyebrow')}</p>
          <h1 className="landing-title">{t('shell.hero')}</h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: '#475569', maxWidth: 720, margin: '0 auto 28px' }}>{t('shell.lead')}</p>
          <div className="landing-actions" style={{ justifyContent: 'center' }}>
            <Link href="/uusi" style={primary}>{t('shell.chooseType')}</Link>
            <a href="#pricing" style={secondary}>{t('shell.seePrices')}</a>
          </div>
        </div>
      </section>

      <section id="kohteet" className="landing-grid" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 72px' }}>
        {FEATURES.map((id) => (
          <article key={id} data-testid={`feature-${id}`} style={{ border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden', background: '#fff' }}>
            <img src={`/marketing/${id === 'cold' ? 'cold-room' : id === 'house' ? 'house' : 'hall'}.jpg`} alt={t(`shell.feature.${id}.alt`)} style={{ width: '100%', height: 210, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: 18 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>{t(`shell.feature.${id}.title`)}</h2>
              <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>{t(`shell.feature.${id}.text`)}</p>
            </div>
          </article>
        ))}
      </section>

      <section id="pricing" data-testid="pricing" style={{ background: '#f8fafc', padding: '64px 24px 80px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
            <div>
              <h2 style={{ fontSize: 36, margin: '0 0 8px' }}>{t('shell.pricing')}</h2>
              <p data-testid="pricing-note" style={{ margin: 0, color: '#9a3412', fontWeight: 700 }}>{t('shell.priceNote')}</p>
            </div>
            <button type="button" data-testid="billing-cycle" onClick={() => setYearly((value) => !value)} style={secondary}>
              {yearly ? t('shell.yearly') : t('shell.showYearly')}
            </button>
          </div>
          {notice && <p data-testid="payment-pending" style={{ marginTop: 16 }}>{notice}</p>}
          <div data-testid="pricing-grid" className="pricing-grid" style={{ marginTop: 24 }}>
            {PLANS.map((plan) => (
              <article key={plan.id} data-testid={`price-${plan.id}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{t(`plan.${plan.id}.name`)}</div>
                <div style={{ fontSize: 32, margin: '8px 0' }}>{yearly ? plan.yearly : plan.monthly} €<span style={{ fontSize: 14, color: '#64748b' }}>{plan.monthly === 0 ? '' : yearly ? t('shell.perYear') : t('shell.perMonth')}</span></div>
                <div style={{ color: '#64748b', minHeight: 40 }}>{t(`plan.${plan.id}.audience`)}</div>
                <ul style={{ paddingLeft: 18, color: '#334155', lineHeight: 1.5, flex: 1 }}>
                  {Array.from({ length: PLAN_POINTS[plan.id] }, (_, index) => (
                    <li key={index}>{t(`plan.${plan.id}.p${index}`)}</li>
                  ))}
                </ul>
                {plan.id === 'free' ? (
                  <Link href="/uusi" style={{ ...primary, textAlign: 'center' }}>{t('shell.drawPlan')}</Link>
                ) : (
                  <button type="button" data-testid={`ask-${plan.id}`} onClick={() => ask(plan)} style={primary}>{t('shell.askAccess')}</button>
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
