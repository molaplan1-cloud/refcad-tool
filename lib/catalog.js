// Original RefCAD templates. Sizes are typical catalogue ranges for layout,
// not a copy of any third-party equipment library.

import { DOOR_LIBRARY } from './doors.js'

export const ROOM_TYPES = [
  {
    id: 'chilled',
    name: 'Jäähdytys',
    short: '+2 °C',
    prefix: 'J',
    temp: 2,
    color: '#3b82f6',
    uWall: 0.3,
    uCeiling: 0.25,
    uFloor: 0.35,
    wallThickness: 0.08,
    defaultHeight: 3,
    defaultProduct: 'vegetables',
    defaultEntry: 12,
  },
  {
    id: 'frozen',
    name: 'Pakaste',
    short: '−18 °C',
    prefix: 'P',
    temp: -18,
    color: '#1d4ed8',
    uWall: 0.22,
    uCeiling: 0.2,
    uFloor: 0.28,
    wallThickness: 0.12,
    defaultHeight: 3,
    defaultProduct: 'frozen-food',
    defaultEntry: -15,
  },
  {
    id: 'blast-chiller',
    name: 'Pikajäähdytys',
    short: '0 °C',
    prefix: 'S',
    temp: 0,
    color: '#06b6d4',
    uWall: 0.35,
    uCeiling: 0.28,
    uFloor: 0.4,
    wallThickness: 0.1,
    defaultHeight: 3,
    defaultProduct: 'meat',
    defaultEntry: 65,
  },
  {
    id: 'blast-freezer',
    name: 'Pikapakastus',
    short: '−30 °C',
    prefix: 'B',
    temp: -30,
    color: '#0891b2',
    uWall: 0.28,
    uCeiling: 0.22,
    uFloor: 0.32,
    wallThickness: 0.15,
    defaultHeight: 3,
    defaultProduct: 'meat',
    defaultEntry: 10,
  },
  {
    id: 'fresh',
    name: 'Tuore',
    short: '−2 °C',
    prefix: 'T',
    temp: -2,
    color: '#22c55e',
    uWall: 0.32,
    uCeiling: 0.26,
    uFloor: 0.36,
    wallThickness: 0.08,
    defaultHeight: 3,
    defaultProduct: 'vegetables',
    defaultEntry: 10,
  },
  {
    id: 'corridor',
    name: 'Käytävä',
    short: 'tila',
    prefix: 'K',
    temp: 18,
    color: '#d6d3d1',
    uWall: 5,
    uCeiling: 5,
    uFloor: 5,
    wallThickness: 0.18,
    defaultHeight: 3,
    refrigerated: false,
    defaultProduct: 'generic',
    defaultEntry: 18,
  },
  {
    id: 'dock',
    name: 'Lastaus',
    short: 'tila',
    prefix: 'L',
    temp: 12,
    color: '#e7e5e4',
    uWall: 5,
    uCeiling: 5,
    uFloor: 5,
    wallThickness: 0.2,
    defaultHeight: 5,
    refrigerated: false,
    defaultProduct: 'generic',
    defaultEntry: 12,
  },
  {
    id: 'warehouse',
    name: 'Varasto',
    short: 'tila',
    prefix: 'A',
    temp: 18,
    color: '#f5f5f4',
    uWall: 5,
    uCeiling: 5,
    uFloor: 5,
    wallThickness: 0.2,
    defaultHeight: 6,
    refrigerated: false,
    defaultProduct: 'generic',
    defaultEntry: 18,
  },
  {
    id: 'plant',
    name: 'Konehuone',
    short: 'tila',
    prefix: 'M',
    temp: 25,
    color: '#fef3c7',
    uWall: 5,
    uCeiling: 5,
    uFloor: 5,
    wallThickness: 0.18,
    defaultHeight: 4,
    refrigerated: false,
    defaultProduct: 'generic',
    defaultEntry: 25,
  },
  {
    id: 'office',
    name: 'Toimisto',
    short: 'tila',
    prefix: 'O',
    temp: 21,
    color: '#e0f2fe',
    uWall: 5,
    uCeiling: 5,
    uFloor: 5,
    wallThickness: 0.15,
    defaultHeight: 3,
    refrigerated: false,
    defaultProduct: 'generic',
    defaultEntry: 21,
  },
  {
    id: 'yard',
    name: 'Ulkoalue',
    short: 'piha',
    prefix: 'U',
    temp: 25,
    color: '#d9f99d',
    uWall: 5,
    uCeiling: 5,
    uFloor: 5,
    wallThickness: 0.05,
    defaultHeight: 0.4,
    refrigerated: false,
    defaultProduct: 'generic',
    defaultEntry: 25,
  },
]

export const PRODUCTS = [
  { id: 'vegetables', name: 'Vihannekset', cp: 3.85, respiration: 0.04 },
  { id: 'fruit', name: 'Hedelmät', cp: 3.7, respiration: 0.03 },
  { id: 'meat', name: 'Liha', cp: 3.2, respiration: 0 },
  { id: 'fish', name: 'Kala', cp: 3.55, respiration: 0.02 },
  { id: 'dairy', name: 'Maitotuotteet', cp: 3.8, respiration: 0 },
  { id: 'frozen-food', name: 'Pakasteet', cp: 2.1, respiration: 0 },
  { id: 'bakery', name: 'Leipomotuotteet', cp: 2.6, respiration: 0 },
  { id: 'generic', name: 'Muu tuote', cp: 3.5, respiration: 0 },
]

function doorTemplate(spec, extra = {}) {
  return {
    id: spec.id,
    category: 'door',
    name: spec.name,
    width: spec.width,
    height: spec.height,
    depth: spec.depth,
    capacityKw: 0,
    fanW: 0,
    doorStyle: spec.style,
    uValue: spec.uValue,
    insulated: !!spec.insulated,
    heated: !!spec.heated,
    curtain: !!spec.curtain,
    heaterW: spec.heaterW || 0,
    cutsWall: spec.cutsWall !== false,
    dockOnly: !!spec.dockOnly,
    fire: spec.fire || null,
    family: spec.family,
    ...extra,
  }
}

const DOORS = [
  doorTemplate({ id: 'door-700', style: 'hinged', name: 'Kylmäovi 700', width: 0.7, height: 2.0, depth: 0.08, uValue: 0.5, insulated: true, family: 'cold' }, { legacyDoor: true }),
  doorTemplate({ id: 'door-900', style: 'hinged', name: 'Kylmäovi 900', width: 0.9, height: 2.0, depth: 0.08, uValue: 0.5, insulated: true, family: 'cold' }, { legacyDoor: true }),
  doorTemplate({ id: 'door-1200', style: 'sliding', name: 'Liukuovi 1200', width: 1.2, height: 2.2, depth: 0.1, uValue: 0.45, insulated: true, family: 'cold' }, { legacyDoor: true }),
  doorTemplate({ id: 'door-1500', style: 'sliding', name: 'Liukuovi 1500', width: 1.5, height: 2.4, depth: 0.1, uValue: 0.45, insulated: true, family: 'cold' }, { legacyDoor: true }),
  doorTemplate({ id: 'door-2000', style: 'sliding', name: 'Liukuovi 2000', width: 2.0, height: 2.6, depth: 0.12, uValue: 0.45, insulated: true, family: 'cold' }, { legacyDoor: true }),
  ...DOOR_LIBRARY.map((spec) => doorTemplate(spec)),
]

export const CAPACITY_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20]

function round2(value) {
  return Math.round(value * 100) / 100
}

function kwTag(kw) {
  return String(kw).replace('.', '_')
}

function kwLabel(kw) {
  return Number.isInteger(kw) ? String(kw) : String(kw).replace('.', ',')
}

function cubicEvap(kw) {
  const legacy = {
    5: { id: 'evap-5', width: 0.9, height: 0.4, depth: 0.55, fanW: 120 },
    10: { id: 'evap-10', width: 1.3, height: 0.48, depth: 0.7, fanW: 220 },
    20: { id: 'evap-20', width: 1.8, height: 0.55, depth: 0.85, fanW: 400 },
  }[kw]
  const s = Math.sqrt(kw / 5)
  const dims = legacy || {
    id: `evap-${kwTag(kw)}`,
    width: round2(0.62 + 0.72 * s),
    height: round2(0.32 + 0.08 * Math.min(s, 2)),
    depth: round2(0.4 + 0.32 * s),
    fanW: Math.round(40 + kw * 18),
  }
  return {
    ...dims,
    category: 'evaporator',
    style: 'cubic',
    name: `Höyrystin ${kwLabel(kw)} kW`,
    capacityKw: kw,
  }
}

/** Axial fans across a unit face: 1–4 from the casing width. */
export function fanCountForWidth(widthM) {
  const w = Number(widthM) || 0
  if (w < 1.35) return 1
  if (w < 2.15) return 2
  if (w < 2.65) return 3
  return 4
}

function slantEvap(kw) {
  const s = Math.sqrt(kw / 5)
  return {
    id: `evap-slant-${kwTag(kw)}`,
    category: 'evaporator',
    style: 'slant',
    name: `Viistohöyrystin ${kwLabel(kw)} kW`,
    width: round2(0.9 + 1.05 * s),
    height: round2(0.18 + 0.012 * Math.min(kw, 16)),
    depth: round2(0.5 + 0.26 * s),
    capacityKw: kw,
    fanW: Math.round(36 + kw * 16),
  }
}

function condenser(kw) {
  const legacy = {
    15: { id: 'cond-15', width: 1.1, height: 0.75, depth: 0.5 },
    30: { id: 'cond-30', width: 1.6, height: 0.9, depth: 0.7 },
  }[kw]
  const s = Math.sqrt(kw / 10)
  const dims = legacy || {
    id: `cond-${kwTag(kw)}`,
    width: round2(0.75 + 0.9 * s),
    height: round2(0.58 + 0.1 * Math.min(s, 2.2)),
    depth: round2(0.45 + 0.2 * s),
  }
  return {
    ...dims,
    category: 'condenser',
    style: 'condenser',
    name: `Lauhdutin ${kwLabel(kw)} kW`,
    capacityKw: kw,
    fanW: Math.round(70 + kw * 30),
  }
}

function combo(kw) {
  const s = Math.sqrt(kw / 8)
  const legacy = kw === 8
    ? { id: 'unit-8', width: 1.15, height: 0.78, depth: 0.58 }
    : {
      id: `combo-${kwTag(kw)}`,
      width: round2(0.72 + 0.7 * s),
      height: round2(0.58 + 0.08 * Math.min(s, 2)),
      depth: round2(0.42 + 0.18 * s),
    }
  return {
    ...legacy,
    category: 'combo',
    style: 'combo',
    name: `Koneikko ${kwLabel(kw)} kW`,
    capacityKw: kw,
    fanW: Math.round(80 + kw * 25),
  }
}

function compressor(kw) {
  const s = Math.sqrt(kw / 8)
  return {
    id: `comp-${kwTag(kw)}`,
    category: 'compressor',
    style: 'compressor',
    name: `Kompressoritelat ${kwLabel(kw)} kW`,
    width: round2(0.7 + 0.55 * s),
    height: 1.2,
    depth: 0.62,
    capacityKw: kw,
    fanW: 0,
  }
}

const CONTROLS = [
  { id: 'sensor-room', category: 'sensor', sensor: 'room', name: 'Huoneanturi', width: 0.22, height: 0.08, depth: 0.22, capacityKw: 0, fanW: 0 },
  { id: 'sensor-evap', category: 'sensor', sensor: 'evap', name: 'Höyrystinanturi', width: 0.18, height: 0.06, depth: 0.18, capacityKw: 0, fanW: 0 },
  { id: 'sensor-defrost', category: 'sensor', sensor: 'defrost', name: 'Sulatusanturi', width: 0.18, height: 0.06, depth: 0.18, capacityKw: 0, fanW: 0 },
  { id: 'sensor-door', category: 'sensor', sensor: 'door', name: 'Ovikytkin', width: 0.16, height: 0.08, depth: 0.1, capacityKw: 0, fanW: 0 },
  { id: 'controller', category: 'controller', sensor: 'controller', name: 'Ohjaus säädin', width: 0.36, height: 0.22, depth: 0.12, capacityKw: 0, fanW: 0 },
]

export const TEMPLATES = [
  ...DOORS,
  ...CAPACITY_STEPS.map(cubicEvap),
  { id: 'evap-35', category: 'evaporator', style: 'cubic', name: 'Höyrystin 35 kW', width: 2.2, height: 0.7, depth: 1.05, capacityKw: 35, fanW: 750 },
  ...CAPACITY_STEPS.map(slantEvap),
  ...CAPACITY_STEPS.map(condenser),
  { ...condenser(30) },
  ...CAPACITY_STEPS.map(combo),
  ...CAPACITY_STEPS.map(compressor),
  ...CONTROLS,
  { id: 'column-400', category: 'column', name: 'Pilari 400', width: 0.4, height: 4, depth: 0.4, capacityKw: 0, fanW: 0 },
  { id: 'rack-3', category: 'rack', name: 'Lavahylly 2.7 m', width: 2.7, height: 4.5, depth: 1.05, capacityKw: 0, fanW: 0 },
]

export const TEMPLATE_GROUPS = [
  { id: 'door', label: 'Ovet' },
  { id: 'evaporator', label: 'Höyrystimet' },
  { id: 'condenser', label: 'Lauhduttimet' },
  { id: 'combo', label: 'Koneikot' },
  { id: 'compressor', label: 'Kompressorit' },
  { id: 'sensor', label: 'Anturit ja ohjaus' },
  { id: 'column', label: 'Pilarit' },
  { id: 'rack', label: 'Hyllyt' },
]

export function getType(typeId) {
  return ROOM_TYPES.find((t) => t.id === typeId) || ROOM_TYPES[0]
}

export function isRefrigerated(typeId) {
  return getType(typeId).refrigerated !== false
}

export function getProduct(productId) {
  return PRODUCTS.find((p) => p.id === productId) || PRODUCTS[PRODUCTS.length - 1]
}

export function getTemplate(templateId) {
  return TEMPLATES.find((t) => t.id === templateId) || null
}

export function defaultLoad(typeId, options = {}) {
  const type = getType(typeId)
  const product = getProduct(type.defaultProduct)
  const partition = !!options.partition
  return {
    productId: product.id,
    dailyMassKg: partition ? 200 : 500,
    entryTempC: type.defaultEntry,
    cp: product.cp,
    respirationWPerKg: product.respiration,
    doorOpeningsPerDay: partition ? 20 : 40,
    doorOpenSeconds: 12,
    doorWidthM: 1.2,
    doorHeightM: 2.2,
    infiltrationVelocity: 0.22,
    airChangesPerDay: 0,
    people: partition ? 1 : 2,
    peopleWatts: 270,
    peopleHoursPerDay: 3,
    lightingWm2: 10,
    lightingHoursPerDay: 10,
    extraEquipmentW: 0,
    equipmentHoursPerDay: 12,
    fanRuntime: 1,
    pullDownEnabled: options.pullDown !== undefined ? !!options.pullDown : !partition,
    slabThicknessM: 0.15,
    slabDensity: 2400,
    slabCp: 0.88,
    slabInitialTempC: 18,
    pullDownHours: 24,
    safetyFactor: 1.1,
    groundTempC: 12,
    ceilingToParent: !!options.ceilingToParent,
    floorToParent: !!options.floorToParent,
  }
}

export function suggestEvaporators(watts) {
  const kw = Math.max(0, (watts || 0) / 1000)
  const evaps = TEMPLATES.filter((t) => t.category === 'evaporator' && t.style !== 'slant').sort((a, b) => a.capacityKw - b.capacityKw)
  const single = evaps.find((e) => e.capacityKw >= kw - 0.001)
  if (single) return { count: 1, template: single, kw }
  const largest = evaps[evaps.length - 1]
  const count = Math.max(1, Math.ceil(kw / largest.capacityKw))
  return { count, template: largest, kw }
}
