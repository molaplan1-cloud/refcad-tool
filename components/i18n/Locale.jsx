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

export function LanguageSwitch({ value, onChange }) {
  return (
    <select
      data-testid="language-switch"
      aria-label="Language"
      value={value || 'fi'}
      onChange={(event) => onChange(event.target.value)}
      style={{ height: 28, borderRadius: 8, border: '1px solid #44403c', background: '#111827', color: '#fff', fontSize: 12, padding: '0 6px' }}
    >
      {LOCALES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  )
}
