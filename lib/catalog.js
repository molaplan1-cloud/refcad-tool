// Original RefCAD templates. Sizes are typical catalogue ranges for layout,
// not a copy of any third-party equipment library.

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

export const TEMPLATES = [
  { id: 'door-700', category: 'door', name: 'Kylmäovi 700', width: 0.7, height: 2.0, depth: 0.08, capacityKw: 0, fanW: 0 },
  { id: 'door-900', category: 'door', name: 'Kylmäovi 900', width: 0.9, height: 2.0, depth: 0.08, capacityKw: 0, fanW: 0 },
  { id: 'door-1200', category: 'door', name: 'Liukuovi 1200', width: 1.2, height: 2.2, depth: 0.1, capacityKw: 0, fanW: 0 },
  { id: 'door-1500', category: 'door', name: 'Liukuovi 1500', width: 1.5, height: 2.4, depth: 0.1, capacityKw: 0, fanW: 0 },
  { id: 'door-2000', category: 'door', name: 'Liukuovi 2000', width: 2.0, height: 2.6, depth: 0.12, capacityKw: 0, fanW: 0 },
  { id: 'evap-5', category: 'evaporator', name: 'Höyrystin 5 kW', width: 0.9, height: 0.4, depth: 0.55, capacityKw: 5, fanW: 120 },
  { id: 'evap-10', category: 'evaporator', name: 'Höyrystin 10 kW', width: 1.3, height: 0.48, depth: 0.7, capacityKw: 10, fanW: 220 },
  { id: 'evap-20', category: 'evaporator', name: 'Höyrystin 20 kW', width: 1.8, height: 0.55, depth: 0.85, capacityKw: 20, fanW: 400 },
  { id: 'evap-35', category: 'evaporator', name: 'Höyrystin 35 kW', width: 2.2, height: 0.7, depth: 1.05, capacityKw: 35, fanW: 750 },
  { id: 'cond-15', category: 'condenser', name: 'Lauhdutin 15 kW', width: 1.1, height: 0.75, depth: 0.5, capacityKw: 15, fanW: 0 },
  { id: 'cond-30', category: 'condenser', name: 'Lauhdutin 30 kW', width: 1.6, height: 0.9, depth: 0.7, capacityKw: 30, fanW: 0 },
  { id: 'unit-8', category: 'unit', name: 'Koneikko 8 kW', width: 1.0, height: 1.4, depth: 0.7, capacityKw: 8, fanW: 0 },
  { id: 'rack-3', category: 'rack', name: 'Lavahylly 2.7 m', width: 2.7, height: 4.5, depth: 1.05, capacityKw: 0, fanW: 0 },
]

export const TEMPLATE_GROUPS = [
  { id: 'door', label: 'Ovet' },
  { id: 'evaporator', label: 'Höyrystimet' },
  { id: 'condenser', label: 'Lauhduttimet' },
  { id: 'unit', label: 'Koneikot' },
  { id: 'rack', label: 'Hyllyt' },
]

export function getType(typeId) {
  return ROOM_TYPES.find((t) => t.id === typeId) || ROOM_TYPES[0]
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
  const evaps = TEMPLATES.filter((t) => t.category === 'evaporator').sort((a, b) => a.capacityKw - b.capacityKw)
  const single = evaps.find((e) => e.capacityKw >= kw - 0.001)
  if (single) return { count: 1, template: single, kw }
  const largest = evaps[evaps.length - 1]
  const count = Math.max(1, Math.ceil(kw / largest.capacityKw))
  return { count, template: largest, kw }
}
