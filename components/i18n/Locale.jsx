'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { LOCALES, formatNumber, normalizeLocale, translate } from '@/lib/i18n'

const LocaleContext = createContext({
  locale: 'fi',
  setLocale: () => {},
  t: (key) => key,
  num: (value) => String(value ?? ''),
})

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('fi')
  useEffect(() => {
    const saved = window.localStorage.getItem('refcad-locale')
    if (saved) setLocaleState(normalizeLocale(saved))
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  const setLocale = (next) => {
    const value = normalizeLocale(next)
    setLocaleState(value)
    window.localStorage.setItem('refcad-locale', value)
    document.documentElement.lang = value
  }
  const t = (key, vars) => translate(locale, key, vars)
  const num = (value, digits = 1) => formatNumber(value, locale, digits)
  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, num }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}

export function usePlanLocale(plan) {
  const ctx = useLocale()
  const locale = plan?.locale || ctx.locale || 'fi'
  return {
    locale,
    setLocale: ctx.setLocale,
    t: (key, vars) => translate(locale, key, vars),
    num: (value, digits = 1) => formatNumber(value, locale, digits),
  }
}

export function LanguageSwitch({ value, onChange, tone = 'dark', className = '' }) {
  const light = tone === 'light'
  return (
    <select
      data-testid="language-switch"
      className={`language-switch${className ? ` ${className}` : ''}`}
      aria-label="Language"
      value={value || 'fi'}
      onChange={(event) => onChange(event.target.value)}
      style={{
        height: 36,
        borderRadius: 8,
        border: light ? '1px solid #cbd5e1' : '1px solid #44403c',
        background: light ? '#fff' : '#111827',
        color: light ? '#0f172a' : '#fff',
        fontSize: 13,
        fontWeight: 650,
        padding: '0 8px',
      }}
    >
      {LOCALES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  )
}

export function ShellLanguage({ tone = 'light', className = '' }) {
  const { locale, setLocale } = useLocale()
  return <LanguageSwitch value={locale} onChange={setLocale} tone={tone} className={className} />
}
