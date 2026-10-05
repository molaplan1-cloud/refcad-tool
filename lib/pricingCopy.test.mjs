import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { MESSAGES } from './messages.js'

const NOTE = 'Hinnat ovat ohjeellisia (alv 0 %). Lähetä tilaus, niin lähetämme sinulle laskun tilauksen mukaisesti. Aktivoimme tilauksesi, kun maksu on vastaanotettu.'
const ORDER = 'Lähetä tilaus'
const THANKS = 'Kiitos tilauksesta! Lähetämme laskun sähköpostiisi.'

const CUSTOMER_FILES = [
  'app/LandingClient.jsx',
  'app/uusi/page.jsx',
  'app/suunnittelu/page.jsx',
  'app/signup/SignupClient.jsx',
  'app/admin/page.jsx',
  'app/layout.jsx',
  'components/floorplan/FloorPlanApp.jsx',
  'lib/messages.js',
]

const BANNED = [
  'verkkomaksua ei ole',
  'ylläpito kuittaa',
  'ylläpito on kuitannut',
  'Odottaa maksun vahvistusta',
  'Pyydä käyttöön',
  'maksu on kuitattu',
  'kuitatun maksun',
]

test('pricing copy is the invoice wording in every language', () => {
  assert.equal(MESSAGES.fi['price.note'], NOTE)
  assert.equal(MESSAGES.fi['price.order'], ORDER)
  assert.equal(MESSAGES.fi['price.thanks'], THANKS)
  for (const id of ['en', 'sv', 'es', 'et']) {
    for (const key of ['price.note', 'price.order', 'price.thanks', 'price.adminLead', 'price.cold', 'price.meta']) {
      const text = MESSAGES[id][key]
      assert.equal(typeof text, 'string')
      assert.ok(text.length > 8, `${id} ${key}`)
      assert.notEqual(text, MESSAGES.fi[key], `${id} ${key}`)
      for (const phrase of BANNED) assert.equal(text.toLowerCase().includes(phrase.toLowerCase()), false, `${id} ${key}`)
    }
  }
})

test('customer and admin pages do not tell people that staff confirm a missing online payment', () => {
  for (const file of CUSTOMER_FILES) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    for (const phrase of BANNED) {
      assert.equal(source.includes(phrase), false, `${file} still says “${phrase}”`)
    }
  }
  const landing = readFileSync(new URL('../app/LandingClient.jsx', import.meta.url), 'utf8')
  assert.match(landing, /t\('price\.note'\)/)
  assert.match(landing, /t\('price\.order'\)/)
  assert.match(landing, /t\('price\.thanks'\)/)
})
