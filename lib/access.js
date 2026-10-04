export const DEMO_WATERMARK = 'RefCAD – DEMO / ILMAINEN VERSIO'

export const PLAN_IDS = ['free', 'basic', 'pro', 'company']

export const PLANS = [
  {
    id: 'free',
    name: 'Ilmainen',
    monthly: 0,
    yearly: 0,
    audience: 'Pohjakuva ilman kirjautumista',
    points: ['Pohjakuva (Rakenne)', 'Tulosteessa vesileima'],
  },
  {
    id: 'basic',
    name: 'Perus',
    monthly: 19,
    yearly: 190,
    audience: 'Asuintalon suunnitelma',
    points: ['Pohjakuva', 'Sähkö, LVI ja IV', 'Puhdas PDF'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 49,
    yearly: 490,
    audience: 'Kylmä, halli ja piha',
    points: ['Kaikki Perus-ominaisuudet', 'Kylmätekniikka', 'Halli', 'Piha ja tontin tekniikka', 'Materiaaliluettelot'],
  },
  {
    id: 'company',
    name: 'Yritys',
    monthly: 99,
    yearly: 990,
    audience: 'Toimisto',
    points: ['Kaikki Pro-ominaisuudet', 'Enintään 5 käyttäjää', 'Logo nimiöön'],
  },
]

export const PROJECT_TYPES = [
  {
    id: 'kylmio',
    name: 'Kylmiö / kylmähuone',
    summary: 'Höyrystin, koneikko, putkistot ja kuormalaskenta.',
    workspaces: ['rakenne', 'kylma'],
    feature: 'kylma',
    route: '/suunnittelu',
    defaults: { name: 'Kylmiö' },
  },
  {
    id: 'toimisto',
    name: 'Toimisto- tai liikerakennus',
    summary: 'Liiketila, jonka hankkeeseen kylmiöt kuuluvat.',
    workspaces: ['rakenne', 'kalusteet', 'sahko', 'lvi', 'iv', 'kylma'],
    feature: null,
    route: '/pohjakuva',
    defaults: { name: 'Liikerakennus', buildingType: 'toimisto' },
  },
  {
    id: 'omakotitalo',
    name: 'Omakotitalo',
    summary: 'Asuintalon pohja, talotekniikka ja piha.',
    workspaces: ['rakenne', 'kalusteet', 'sahko', 'lvi', 'iv', 'piha'],
    feature: null,
    route: '/pohjakuva',
    defaults: { name: 'Omakotitalo', buildingType: 'omakotitalo' },
  },
  {
    id: 'rivitalo',
    name: 'Rivitalo',
    summary: 'Useampi asunto samassa rakennuksessa.',
    workspaces: ['rakenne', 'kalusteet', 'sahko', 'lvi', 'iv', 'piha'],
    feature: null,
    route: '/pohjakuva',
    defaults: { name: 'Rivitalo', buildingType: 'rivitalo' },
  },
  {
    id: 'paritalo',
    name: 'Paritalo',
    summary: 'Kaksi asuntoa ja jaettu rakenne.',
    workspaces: ['rakenne', 'kalusteet', 'sahko', 'lvi', 'iv', 'piha'],
    feature: null,
    route: '/pohjakuva',
    defaults: { name: 'Paritalo', buildingType: 'paritalo' },
  },
  {
    id: 'halli',
    name: 'Halli / varastorakennus',
    summary: 'Suuri jänneväli. Kehärakenteet, nosto-ovet ja hyllyt tulevat hallin kirjastoon.',
    workspaces: ['rakenne', 'kalusteet', 'sahko', 'lvi', 'iv'],
    feature: 'halli',
    route: '/pohjakuva',
    defaults: { name: 'Halli', buildingType: 'halli', floorHeight: 6 },
  },
]

const PLAN_SPACES = {
  free: ['rakenne'],
  basic: ['rakenne', 'kalusteet', 'sahko', 'lvi', 'iv'],
  pro: ['rakenne', 'kalusteet', 'sahko', 'lvi', 'iv', 'piha', 'kylma'],
  company: ['rakenne', 'kalusteet', 'sahko', 'lvi', 'iv', 'piha', 'kylma'],
}

const PLAN_FEATURES = {
  free: [],
  basic: [],
  pro: ['kylma', 'halli', 'piha', 'materials'],
  company: ['kylma', 'halli', 'piha', 'materials', 'logo', 'seats'],
}

function day(value, end) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T${end ? '23:59:59' : '00:00:00'}`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function paymentActive(user, now = new Date()) {
  if (!user || user.payment !== 'received') return false
  const from = day(user.validFrom, false)
  const until = day(user.validUntil, true)
  if (from && from > now) return false
  if (until && until < now) return false
  return true
}

function clip(access, type) {
  if (!type) return access
  const spaces = access.workspaces.filter((id) => type.workspaces.includes(id))
  const blocked = Boolean(type.feature) && !access.features.includes(type.feature)
  return {
    ...access,
    projectType: type.id,
    workspaces: blocked ? [] : spaces,
    typeBlocked: blocked,
  }
}

export function accessFor(user, projectType = null, now = new Date()) {
  const type = PROJECT_TYPES.find((item) => item.id === projectType) || null
  const base = {
    tier: 'free',
    plan: 'free',
    draw: true,
    admin: false,
    watermark: true,
    pending: false,
    workspaces: ['rakenne'],
    features: [],
    role: null,
  }
  if (!user) return clip(base, type)
  if (user.disabled) {
    return { ...base, tier: 'disabled', draw: false, workspaces: [], watermark: true, role: user.role || 'user' }
  }
  if (user.role === 'admin') {
    return {
      ...base,
      tier: 'admin',
      plan: user.plan || 'company',
      draw: false,
      admin: true,
      watermark: false,
      workspaces: [],
      features: [],
      role: 'admin',
    }
  }
  if (user.role === 'demo') {
    return clip({
      ...base,
      tier: 'demo',
      plan: 'pro',
      draw: true,
      watermark: true,
      workspaces: PLAN_SPACES.pro,
      features: PLAN_FEATURES.pro,
      role: 'demo',
    }, type)
  }
  const pending = user.payment === 'pending'
  const plan = paymentActive(user, now) && PLAN_SPACES[user.plan] ? user.plan : 'free'
  return clip({
    ...base,
    tier: plan,
    plan: user.plan || 'free',
    draw: true,
    watermark: plan === 'free',
    pending,
    workspaces: PLAN_SPACES[plan],
    features: PLAN_FEATURES[plan],
    role: user.role || 'user',
  }, type)
}

export function canStartType(access, type) {
  if (!access?.draw) return false
  if (type?.feature && !access.features.includes(type.feature)) return false
  return true
}

export function projectTypeById(id) {
  return PROJECT_TYPES.find((item) => item.id === id) || null
}
