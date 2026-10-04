// UI languages. Finnish is the default. Add a language by appending one
// locale here and one value on every row in lib/messages.js.

import { MESSAGES } from './messages.js'

export const LOCALES = [
  { id: 'fi', name: 'Suomi', intl: 'fi-FI' },
  { id: 'en', name: 'English', intl: 'en-GB' },
  { id: 'sv', name: 'Svenska', intl: 'sv-SE' },
  { id: 'es', name: 'Español', intl: 'es-ES' },
  { id: 'et', name: 'Eesti', intl: 'et-EE' },
]

const LOCALE_IDS = new Set(LOCALES.map((item) => item.id))

export function normalizeLocale(value) {
  const id = String(value || '').toLowerCase()
  return LOCALE_IDS.has(id) ? id : 'fi'
}

export function intlOf(locale) {
  return LOCALES.find((item) => item.id === normalizeLocale(locale))?.intl || 'fi-FI'
}

export function translate(locale, key, vars) {
  const id = normalizeLocale(locale)
  const table = MESSAGES[id] || {}
  let text = table[key]
  if (text == null) text = MESSAGES.en?.[key]
  if (text == null) text = MESSAGES.fi?.[key]
  if (text == null) text = key
  if (vars) {
    Object.entries(vars).forEach(([name, value]) => {
      text = text.replaceAll(`{${name}}`, String(value ?? ''))
    })
  }
  return text
}

export function text(locale, key, fallback) {
  const value = translate(locale, key)
  return value === key ? (fallback ?? key) : value
}

export function formatNumber(value, locale = 'fi', digits = 1) {
  const number = Number(value)
  const safe = Number.isFinite(number) ? number : 0
  return new Intl.NumberFormat(intlOf(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe)
}

export function pdfAscii(value) {
  return String(value ?? '')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a').replace(/õ/g, 'o')
    .replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Å/g, 'A').replace(/Õ/g, 'O')
    .replace(/á/g, 'a').replace(/à/g, 'a').replace(/â/g, 'a').replace(/ã/g, 'a')
    .replace(/é/g, 'e').replace(/è/g, 'e').replace(/ê/g, 'e')
    .replace(/í/g, 'i').replace(/ì/g, 'i').replace(/î/g, 'i')
    .replace(/ó/g, 'o').replace(/ò/g, 'o').replace(/ô/g, 'o')
    .replace(/ú/g, 'u').replace(/ù/g, 'u').replace(/û/g, 'u').replace(/ü/g, 'u')
    .replace(/ñ/g, 'n').replace(/ç/g, 'c')
    .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ü/g, 'U').replace(/Ñ/g, 'N')
    .replace(/×/g, 'x').replace(/°/g, ' ')
}
