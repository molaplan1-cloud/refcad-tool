// Finnish layered structures (rakennetyypit) for Pohjakuva.
// U-values follow EN ISO 6946: surface resistances, a well-ventilated
// cavity, and the upper/lower limit method for timber-frame layers.

import { jsPDF } from 'jspdf'

export const LAYER_MATERIALS = [
  { id: 'gypsum', name: 'Kipsilevy', lambda: 0.21, hatch: 'gypsum' },
  { id: 'vapour', name: 'Höyrynsulku', lambda: 0.33, hatch: 'membrane' },
  { id: 'wool', name: 'Mineraalivilla', lambda: 0.037, hatch: 'insulation' },
  { id: 'blown', name: 'Puhallusvilla', lambda: 0.041, hatch: 'insulation' },
  { id: 'windboard', name: 'Tuulensuojalevy', lambda: 0.055, hatch: 'wood' },
  { id: 'vent', name: 'Tuuletusrako', lambda: 0, hatch: 'vent', role: 'vent' },
  { id: 'brick', name: 'Tiiliverhous', lambda: 0.6, hatch: 'brick' },
  { id: 'masonry', name: 'Muurattu tiili', lambda: 0.6, hatch: 'brick' },
  { id: 'woodclad', name: 'Puuverhous', lambda: 0.14, hatch: 'wood' },
  { id: 'render', name: 'Rappaus', lambda: 0.8, hatch: 'render' },
  { id: 'fibre', name: 'Kuitusementtilevy', lambda: 0.35, hatch: 'board' },
  { id: 'concrete', name: 'Betoni', lambda: 1.7, hatch: 'concrete' },
  { id: 'eps', name: 'EPS', lambda: 0.036, hatch: 'insulation' },
  { id: 'xps', name: 'Finnfoam / XPS', lambda: 0.033, hatch: 'insulation' },
  { id: 'siporex', name: 'Kevytbetoni / Siporex', lambda: 0.11, hatch: 'block' },
  { id: 'leca', name: 'Leca-harkko', lambda: 0.2, hatch: 'block' },
  { id: 'log', name: 'Massiivihirsi', lambda: 0.12, hatch: 'wood' },
  { id: 'lamella', name: 'Lamellihirsi', lambda: 0.12, hatch: 'wood' },
  { id: 'clt', name: 'CLT / massiivipuu', lambda: 0.13, hatch: 'wood' },
  { id: 'timber', name: 'Puurunko', lambda: 0.13, hatch: 'wood' },
  { id: 'air', name: 'Ilmaväli', lambda: 0.18, hatch: 'vent' },
  { id: 'ceramic', name: 'Keraaminen tiili', lambda: 0.7, hatch: 'brick' },
  { id: 'termoarcilla', name: 'Termoarcilla', lambda: 0.29, hatch: 'block' },
  { id: 'gravel', name: 'Sora', lambda: 2, hatch: 'gravel' },
  { id: 'hollow', name: 'Ontelolaatta', lambda: 0.9, hatch: 'concrete' },
  { id: 'flooring', name: 'Pintamateriaali', lambda: 0.14, hatch: 'wood' },
  { id: 'waterproof', name: 'Vedeneriste', lambda: 0.2, hatch: 'membrane' },
  { id: 'tile', name: 'Laatta', lambda: 1, hatch: 'concrete' },
  { id: 'osb', name: 'Lattialevy', lambda: 0.13, hatch: 'wood' },
  { id: 'roofing', name: 'Vesikate', lambda: 1, hatch: 'board' },
  { id: 'membrane', name: 'Kermieriste', lambda: 0.2, hatch: 'membrane' },
  { id: 'pex', name: 'Lattialämmitysputki', lambda: 0.4, hatch: 'membrane', role: 'note' },
]

const STUD_LAMBDA = 0.13

const SURFACE = {
  wall: { rsi: 0.13, rse: 0.04 },
  roof: { rsi: 0.1, rse: 0.04 },
  floor: { rsi: 0.17, rse: 0.04 },
}

function materialOf(id) {
  return LAYER_MATERIALS.find((item) => item.id === id) || LAYER_MATERIALS[0]
}

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function layer(materialId, thicknessMm, extra = {}) {
  const material = materialOf(materialId)
  return {
    materialId,
    name: material.name,
    lambda: material.lambda,
    hatch: material.hatch,
    role: material.role || 'solid',
    thicknessMm,
    ...extra,
  }
}

const timberShell = (woolMm, cladding) => [
  layer('gypsum', 13),
  layer('vapour', 0.2),
  layer('wool', woolMm, { frame: true }),
  layer('windboard', woolMm >= 180 ? 25 : 12),
  layer('vent', 30),
  layer(cladding.id, cladding.mm, { cladding: true }),
]

export const STRUCTURE_PRESETS = [
  {
    id: 'us-timber-brick',
    category: 'exterior',
    name: 'Puuranka, tiiliverhous',
    kind: 'wall',
    frameFraction: 0.12,
    legacy: 'puuranka',
    layers: timberShell(200, { id: 'brick', mm: 85 }),
  },
  {
    id: 'us-timber-wood',
    category: 'exterior',
    name: 'Puuranka, puuverhous',
    kind: 'wall',
    frameFraction: 0.12,
    legacy: 'puuranka',
    layers: timberShell(200, { id: 'woodclad', mm: 23 }),
  },
  {
    id: 'us-timber-render',
    category: 'exterior',
    name: 'Puuranka, rappaus',
    kind: 'wall',
    frameFraction: 0.12,
    legacy: 'puuranka',
    layers: timberShell(200, { id: 'render', mm: 20 }),
  },
  {
    id: 'us-timber-fibre',
    category: 'exterior',
    name: 'Puuranka, kuitusementti',
    kind: 'wall',
    frameFraction: 0.12,
    legacy: 'puuranka',
    layers: timberShell(200, { id: 'fibre', mm: 8 }),
  },
  {
    id: 'us-sandwich',
    category: 'exterior',
    name: 'Betoninen sandwich-elementti',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'betoni',
    layers: [layer('concrete', 80), layer('eps', 220), layer('concrete', 70)],
  },
  {
    id: 'es-brick-cavity',
    category: 'exterior',
    countries: ['ES'],
    name: 'Ladrillo cerámico + cámara + aislamiento 60 mm',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'betoni',
    layers: [layer('gypsum', 13), layer('ceramic', 70), layer('wool', 60), layer('air', 40), layer('ceramic', 115)],
  },
  {
    id: 'es-brick-80',
    category: 'exterior',
    countries: ['ES'],
    name: 'Ladrillo cerámico + aislamiento 80 mm',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'betoni',
    layers: [layer('gypsum', 13), layer('ceramic', 70), layer('wool', 80), layer('ceramic', 115)],
  },
  {
    id: 'es-termoarcilla',
    category: 'exterior',
    countries: ['ES'],
    name: 'Termoarcilla 290',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'harkko',
    layers: [layer('render', 15), layer('termoarcilla', 290), layer('render', 15)],
  },
  {
    id: 'es-concrete',
    category: 'exterior',
    countries: ['ES'],
    name: 'Hormigón armado + aislamiento',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'betoni',
    layers: [layer('gypsum', 13), layer('concrete', 150), layer('eps', 60), layer('render', 15)],
  },
  {
    id: 'se-timber',
    category: 'exterior',
    countries: ['SE'],
    name: 'Trästomme, träpanel',
    kind: 'wall',
    frameFraction: 0.12,
    legacy: 'puuranka',
    layers: timberShell(220, { id: 'woodclad', mm: 23 }),
  },
  {
    id: 'ee-timber',
    category: 'exterior',
    countries: ['EE'],
    name: 'Puitkarkass, tellis',
    kind: 'wall',
    frameFraction: 0.12,
    legacy: 'puuranka',
    layers: timberShell(250, { id: 'brick', mm: 85 }),
  },
  {
    id: 'us-brick-cavity',
    category: 'exterior',
    countries: ['UK'],
    name: 'Tiili + villa + tiili',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'betoni',
    layers: [layer('masonry', 130), layer('wool', 150), layer('masonry', 85)],
  },
  {
    id: 'us-siporex-375',
    category: 'exterior',
    name: 'Kevytbetoni 375',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'harkko',
    layers: [layer('siporex', 375)],
  },
  {
    id: 'us-siporex-500',
    category: 'exterior',
    name: 'Kevytbetoni 500',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'harkko',
    layers: [layer('siporex', 500)],
  },
  {
    id: 'us-leca',
    category: 'exterior',
    name: 'Leca-harkko 380',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'harkko',
    layers: [layer('leca', 100), layer('eps', 180), layer('leca', 100)],
  },
  {
    id: 'us-eps-block',
    category: 'exterior',
    name: 'EPS-harkko (Lammi)',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'harkko',
    layers: [layer('concrete', 40), layer('eps', 250), layer('concrete', 40)],
  },
  {
    id: 'us-finnfoam',
    category: 'exterior',
    name: 'Puuranka, Finnfoam',
    kind: 'wall',
    frameFraction: 0.12,
    legacy: 'puuranka',
    layers: [
      layer('gypsum', 13),
      layer('vapour', 0.2),
      layer('xps', 180, { frame: true }),
      layer('windboard', 9),
      layer('vent', 22),
      layer('woodclad', 23, { cladding: true }),
    ],
  },
  {
    id: 'us-log-200',
    category: 'exterior',
    name: 'Massiivihirsi 200',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'hirsi',
    layers: [layer('log', 200)],
  },
  {
    id: 'us-log-275',
    category: 'exterior',
    name: 'Massiivihirsi 275',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'hirsi',
    layers: [layer('log', 275)],
  },
  {
    id: 'us-log-extra',
    category: 'exterior',
    name: 'Hirsi + lisäeriste',
    kind: 'wall',
    frameFraction: 0.1,
    legacy: 'hirsi',
    layers: [layer('gypsum', 13), layer('wool', 50, { frame: true }), layer('log', 200)],
  },
  {
    id: 'us-lamella',
    category: 'exterior',
    name: 'Lamellihirsi 240',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'hirsi',
    layers: [layer('lamella', 240)],
  },
  {
    id: 'us-clt',
    category: 'exterior',
    name: 'CLT + villa',
    kind: 'wall',
    frameFraction: 0.1,
    legacy: 'puuranka',
    layers: [
      layer('clt', 100),
      layer('wool', 200, { frame: true }),
      layer('windboard', 25),
      layer('vent', 30),
      layer('woodclad', 23, { cladding: true }),
    ],
  },
  {
    id: 'us-clt-solid',
    category: 'exterior',
    name: 'Massiivipuu CLT 200',
    kind: 'wall',
    frameFraction: 0,
    legacy: 'hirsi',
    layers: [layer('clt', 200)],
  },
  {
    id: 'us-old-100',
    category: 'exterior',
    name: 'Vanha puuranka, villa 100',
    kind: 'wall',
    frameFraction: 0.15,
    legacy: 'puuranka',
    layers: timberShell(100, { id: 'woodclad', mm: 23 }),
  },
  {
    id: 'us-old-150',
    category: 'exterior',
    name: 'Vanha puuranka, villa 150',
    kind: 'wall',
    frameFraction: 0.15,
    legacy: 'puuranka',
    layers: timberShell(150, { id: 'woodclad', mm: 23 }),
  },
  {
    id: 'us-garage',
    category: 'exterior',
    name: 'Eristeetön puuranka (varasto)',
    kind: 'wall',
    frameFraction: 0.12,
    legacy: 'puuranka',
    layers: [layer('woodclad', 12), layer('air', 100, { frame: true }), layer('woodclad', 22, { cladding: true })],
  },
  {
    id: 'vs-66',
    category: 'interior',
    name: 'Kipsilevyväliseinä 66',
    kind: 'wall',
    frameFraction: 0.12,
    layers: [layer('gypsum', 13), layer('air', 40, { frame: true }), layer('gypsum', 13)],
  },
  {
    id: 'vs-66-wool',
    category: 'interior',
    name: 'Kipsilevyväliseinä 66 + villa',
    kind: 'wall',
    frameFraction: 0.12,
    layers: [layer('gypsum', 13), layer('wool', 40, { frame: true }), layer('gypsum', 13)],
  },
  {
    id: 'vs-92',
    category: 'interior',
    name: 'Kipsilevyväliseinä 92',
    kind: 'wall',
    frameFraction: 0.12,
    layers: [layer('gypsum', 13), layer('air', 66, { frame: true }), layer('gypsum', 13)],
  },
  {
    id: 'vs-92-wool',
    category: 'interior',
    name: 'Kipsilevyväliseinä 92 + villa',
    kind: 'wall',
    frameFraction: 0.12,
    layers: [layer('gypsum', 13), layer('wool', 66, { frame: true }), layer('gypsum', 13)],
  },
  {
    id: 'vs-125',
    category: 'interior',
    name: 'Kipsilevyväliseinä 125 + villa',
    kind: 'wall',
    frameFraction: 0.1,
    layers: [layer('gypsum', 13), layer('wool', 99, { frame: true }), layer('gypsum', 13)],
  },
  {
    id: 'vs-brick',
    category: 'interior',
    name: 'Tiiliväliseinä',
    kind: 'wall',
    frameFraction: 0,
    layers: [layer('masonry', 130)],
  },
  {
    id: 'vs-block',
    category: 'interior',
    name: 'Harkkoväliseinä',
    kind: 'wall',
    frameFraction: 0,
    layers: [layer('leca', 100)],
  },
  {
    id: 'vs-ei30',
    category: 'interior',
    name: 'Paloseinä EI30',
    kind: 'wall',
    frameFraction: 0.1,
    fire: 'EI30',
    layers: [layer('gypsum', 26), layer('wool', 70, { frame: true }), layer('gypsum', 26)],
  },
  {
    id: 'vs-ei60',
    category: 'interior',
    name: 'Paloseinä EI60',
    kind: 'wall',
    frameFraction: 0.1,
    fire: 'EI60',
    layers: [layer('gypsum', 39), layer('wool', 95, { frame: true }), layer('gypsum', 39)],
  },
  {
    id: 'vs-wet',
    category: 'interior',
    name: 'Märkätilan seinä',
    kind: 'wall',
    frameFraction: 0.12,
    layers: [
      layer('tile', 8),
      layer('waterproof', 1),
      layer('gypsum', 13),
      layer('wool', 66, { frame: true }),
      layer('gypsum', 13),
    ],
  },
  {
    id: 'ap-slab-100',
    category: 'floor',
    name: 'Maanvarainen laatta, EPS 100',
    kind: 'floor',
    frameFraction: 0,
    layers: [layer('flooring', 10), layer('concrete', 80), layer('eps', 100), layer('gravel', 200)],
  },
  {
    id: 'ap-slab-200',
    category: 'floor',
    name: 'Maanvarainen laatta, EPS 200',
    kind: 'floor',
    frameFraction: 0,
    layers: [layer('flooring', 10), layer('concrete', 100), layer('eps', 200), layer('gravel', 300)],
  },
  {
    id: 'ap-slab-300',
    category: 'floor',
    name: 'Maanvarainen laatta, EPS 300',
    kind: 'floor',
    frameFraction: 0,
    layers: [layer('flooring', 10), layer('concrete', 100), layer('eps', 300), layer('gravel', 300)],
  },
  {
    id: 'ap-crawl',
    category: 'floor',
    name: 'Tuulettuva puualapohja',
    kind: 'floor',
    frameFraction: 0.1,
    layers: [layer('flooring', 15), layer('osb', 22), layer('wool', 250, { frame: true }), layer('windboard', 12), layer('vent', 200)],
  },
  {
    id: 'ap-hollow',
    category: 'floor',
    name: 'Kantava ontelolaatta',
    kind: 'floor',
    frameFraction: 0,
    layers: [layer('flooring', 10), layer('concrete', 50), layer('hollow', 265), layer('eps', 150), layer('gravel', 200)],
  },
  {
    id: 'ap-garage',
    category: 'floor',
    name: 'Lämmittämätön autotallin laatta',
    kind: 'floor',
    frameFraction: 0,
    layers: [layer('concrete', 100), layer('gravel', 300)],
  },
  {
    id: 'vp-timber',
    category: 'midfloor',
    name: 'Puuvälipohja',
    kind: 'floor',
    frameFraction: 0.1,
    layers: [layer('flooring', 15), layer('osb', 22), layer('wool', 100, { frame: true }), layer('gypsum', 13)],
  },
  {
    id: 'vp-hollow',
    category: 'midfloor',
    name: 'Ontelolaattavälipohja',
    kind: 'floor',
    frameFraction: 0,
    layers: [layer('flooring', 10), layer('concrete', 40), layer('hollow', 265)],
  },
  {
    id: 'yp-blown-300',
    category: 'roof',
    name: 'Puhallusvilla 300',
    kind: 'roof',
    frameFraction: 0.08,
    layers: [layer('gypsum', 13), layer('vapour', 0.2), layer('blown', 300, { frame: true }), layer('vent', 100), layer('roofing', 1, { cladding: true })],
  },
  {
    id: 'yp-blown-400',
    category: 'roof',
    name: 'Puhallusvilla 400',
    kind: 'roof',
    frameFraction: 0.08,
    layers: [layer('gypsum', 13), layer('vapour', 0.2), layer('blown', 400, { frame: true }), layer('vent', 100), layer('roofing', 1, { cladding: true })],
  },
  {
    id: 'yp-blown-500',
    category: 'roof',
    name: 'Puhallusvilla 500',
    kind: 'roof',
    frameFraction: 0.08,
    layers: [layer('gypsum', 13), layer('vapour', 0.2), layer('blown', 500, { frame: true }), layer('vent', 100), layer('roofing', 1, { cladding: true })],
  },
  {
    id: 'yp-pitched',
    category: 'roof',
    name: 'Vino yläpohja',
    kind: 'roof',
    frameFraction: 0.12,
    layers: [
      layer('gypsum', 13),
      layer('vapour', 0.2),
      layer('wool', 300, { frame: true }),
      layer('windboard', 25),
      layer('vent', 50),
      layer('roofing', 1, { cladding: true }),
    ],
  },
  {
    id: 'yp-flat',
    category: 'roof',
    name: 'Tasainen betonikatto',
    kind: 'roof',
    frameFraction: 0,
    layers: [layer('concrete', 200), layer('eps', 280), layer('membrane', 4, { cladding: true })],
  },
]

export const STRUCTURE_CATEGORIES = [
  { id: 'exterior', name: 'Ulkoseinä', role: 'exteriorWall' },
  { id: 'interior', name: 'Väliseinä', role: 'interiorWall' },
  { id: 'floor', name: 'Alapohja', role: 'floor' },
  { id: 'midfloor', name: 'Välipohja', role: 'midFloor' },
  { id: 'roof', name: 'Yläpohja', role: 'roof' },
]

export function materialById(id) {
  return materialOf(id)
}

function thermalLayers(layers) {
  const list = layers || []
  const vent = list.findIndex((item) => item.role === 'vent')
  const source = vent >= 0 ? list.slice(0, vent) : list
  return source.filter((item) => item.role !== 'note' && item.role !== 'vent')
}

function layerResistance(item, lambda) {
  const depth = Math.max(0, Number(item.thicknessMm) || 0) / 1000
  const value = Number(lambda)
  if (!(depth > 0) || !(value > 0)) return 0
  return depth / value
}

export function structurePerformance(structure) {
  const kind = structure?.kind || 'wall'
  const surface = SURFACE[kind] || SURFACE.wall
  const rsi = Number.isFinite(structure?.rsi) ? structure.rsi : surface.rsi
  const rseSolid = Number.isFinite(structure?.rse) ? structure.rse : surface.rse
  const layers = structure?.layers || []
  const ventilated = layers.some((item) => item.role === 'vent')
  const rse = ventilated ? rsi : rseSolid
  const thermal = thermalLayers(layers)
  const fraction = Math.min(0.6, Math.max(0, Number(structure?.frameFraction) || 0))
  const framed = thermal.some((item) => item.frame) && fraction > 0
  const section = (useStud) => {
    let resistance = rsi
    thermal.forEach((item) => {
      const lambda = item.frame && useStud ? (item.studLambda || STUD_LAMBDA) : item.lambda
      resistance += layerResistance(item, lambda)
    })
    return resistance + rse
  }
  let resistance = section(false)
  let u = 1 / Math.max(0.05, resistance)
  if (framed) {
    const insulationPath = section(false)
    const studPath = section(true)
    const upper = fraction * (1 / studPath) + (1 - fraction) * (1 / insulationPath)
    let lowerR = rsi
    thermal.forEach((item) => {
      if (!item.frame) {
        lowerR += layerResistance(item, item.lambda)
        return
      }
      const rIns = layerResistance(item, item.lambda)
      const rStud = layerResistance(item, item.studLambda || STUD_LAMBDA)
      if (rIns > 0 && rStud > 0) lowerR += 1 / (fraction / rStud + (1 - fraction) / rIns)
    })
    lowerR += rse
    const lower = 1 / Math.max(0.05, lowerR)
    u = (upper + lower) / 2
    resistance = 1 / u
  }
  const thicknessMm = layers.reduce((sum, item) => sum + (item.role === 'note' ? 0 : (Number(item.thicknessMm) || 0)), 0)
  return {
    u: round3(u),
    r: round3(resistance),
    thickness: round3(thicknessMm / 1000),
    thicknessMm: Math.round(thicknessMm),
    ventilated,
  }
}

function annotate(structure) {
  if (!structure) return null
  const performance = structurePerformance(structure)
  return { ...structure, layers: (structure.layers || []).map((item) => ({ ...item })), ...performance }
}

export function presetById(id) {
  return STRUCTURE_PRESETS.find((item) => item.id === id) || null
}

export function resolveStructure(plan, id) {
  if (!id) return null
  const saved = (plan?.structures?.saved || []).find((item) => item.id === id)
  if (saved) return annotate(saved)
  const preset = presetById(id)
  return preset ? annotate(preset) : null
}

export function structuresFor(plan, category) {
  const country = plan?.country || 'FI'
  const rank = (item) => {
    const list = item?.countries
    if (list?.includes(country)) return 0
    if (!list?.length) return 1
    return 2
  }
  const custom = (plan?.structures?.saved || []).filter((item) => item.category === category && item.custom)
  const presets = STRUCTURE_PRESETS.filter((item) => item.category === category).map((item) => resolveStructure(plan, item.id))
  presets.sort((a, b) => rank(a) - rank(b))
  return [...presets, ...custom.map((item) => annotate(item))]
}

export function storeStructure(plan, structure) {
  const saved = (plan?.structures?.saved || []).filter((item) => item.id !== structure.id)
  const next = {
    ...(plan?.structures || {}),
    saved: [...saved, { ...structure, layers: structure.layers.map((item) => ({ ...item })) }],
  }
  return { ...plan, structures: next }
}

export function blankStructure(category = 'exterior', name = 'Oma rakenne') {
  const kind = category === 'roof' ? 'roof' : category === 'floor' || category === 'midfloor' ? 'floor' : 'wall'
  return annotate({
    id: `custom-${Date.now()}`,
    category,
    name,
    kind,
    frameFraction: 0,
    custom: true,
    layers: [layer('gypsum', 13)],
  })
}

export function moveLayer(structure, index, direction) {
  const layers = structure.layers.map((item) => ({ ...item }))
  const target = index + direction
  if (target < 0 || target >= layers.length) return structure
  const [row] = layers.splice(index, 1)
  layers.splice(target, 0, row)
  return { ...structure, layers }
}

export function resolveWallStructure(plan, wall) {
  if (!wall) return null
  if (wall.structureId) return resolveStructure(plan, wall.structureId)
  const interior = wall.kind === 'interior' || wall.kind === 'partition'
  const id = interior ? plan?.structures?.interiorWall : (plan?.exteriorStructureId || plan?.structures?.exteriorWall)
  return resolveStructure(plan, id)
}

export function envelopeStructure(plan, role) {
  const id = role === 'wall'
    ? (plan?.exteriorStructureId || plan?.structures?.exteriorWall)
    : plan?.structures?.[role]
  return resolveStructure(plan, id)
}

export function assignHouseStructure(plan, role, id) {
  const spec = resolveStructure(plan, id)
  const structures = { ...(plan?.structures || {}), [role]: id || null }
  const patch = { structures }
  if (role === 'exteriorWall') {
    patch.exteriorStructureId = id || null
    if (spec) {
      patch.exteriorThickness = spec.thickness
      if (spec.legacy) patch.exteriorStructure = spec.legacy
    }
  }
  return patch
}

function lengthOf(wall) {
  return Math.hypot((wall?.b?.x || 0) - (wall?.a?.x || 0), (wall?.b?.z || 0) - (wall?.a?.z || 0))
}

function openingArea(plan, wall) {
  return (plan.openings || []).filter((item) => item.wallId === wall.id).reduce((sum, item) => {
    const height = item.height || (item.kind === 'window' ? 1.2 : 2.1)
    return sum + Math.max(0, item.width || 0) * height
  }, 0)
}

export function structureSide(wall) {
  return wall?.kind === 'interior' || wall?.kind === 'partition' ? 'VS' : 'US'
}

export function structureCatalog(plan) {
  const rows = []
  const count = { US: 0, VS: 0 }
  const seen = new Set()
  ;(plan?.walls || []).forEach((wall) => {
    if (wall?.hidden) return
    const spec = resolveWallStructure(plan, wall)
    if (!spec) return
    const side = structureSide(wall)
    const key = `${side}:${spec.id}`
    if (seen.has(key)) return
    seen.add(key)
    count[side] += 1
    rows.push({
      key,
      id: spec.id,
      side,
      code: `${side}${count[side]}`,
      name: spec.name,
      u: spec.u,
      thicknessMm: spec.thicknessMm,
    })
  })
  return rows
}

export function structureCode(plan, wall) {
  const spec = resolveWallStructure(plan, wall)
  if (!spec || !wall) return null
  return structureCatalog(plan).find((row) => row.key === `${structureSide(wall)}:${spec.id}`) || null
}

export function assignWallStructures(plan, wallIds, structureId) {
  const ids = new Set(wallIds || [])
  return {
    ...plan,
    walls: (plan.walls || []).map((wall) => (
      ids.has(wall.id) ? { ...wall, structureId: structureId || null, thicknessCustom: false } : wall
    )),
  }
}

export function retargetLayer(item, materialId) {
  const material = materialById(materialId)
  return {
    ...item,
    materialId,
    name: material.name,
    lambda: material.lambda,
    hatch: material.hatch,
    role: material.role || 'solid',
  }
}

export function writeWallLayers(plan, wallIds, source) {
  const ids = new Set(wallIds || [])
  const wantedId = source?.id
  const preset = presetById(wantedId)
  const saved = (plan?.structures?.saved || []).find((item) => item.id === wantedId)
  const usedElsewhere = (plan.walls || []).some((wall) => !ids.has(wall.id) && wall.structureId === wantedId)
  const houseUses = [plan?.structures?.interiorWall, plan?.structures?.exteriorWall, plan?.exteriorStructureId].includes(wantedId)
  const fork = !saved || preset || usedElsewhere || houseUses
  const seq = fork ? (plan?.seq || 1) + 1 : (plan?.seq || 1)
  const id = fork ? `wt-${seq}` : wantedId
  const structure = {
    ...(saved || {}),
    id,
    category: source.category || saved?.category || (source.kind === 'interior' || source.kind === 'partition' ? 'interior' : 'exterior'),
    name: source.name || saved?.name || 'Oma rakenne',
    kind: 'wall',
    frameFraction: Number.isFinite(source.frameFraction) ? source.frameFraction : (saved?.frameFraction || 0),
    custom: true,
    layers: (source.layers || []).map((item) => ({ ...item })),
  }
  const stored = storeStructure({ ...plan, seq }, structure)
  return assignWallStructures(stored, [...ids], id)
}

export function setSlabPipes(plan, enabled) {
  const currentId = plan?.structures?.floor || (enabled ? 'ap-slab-200' : null)
  if (!currentId) return plan
  const spec = resolveStructure(plan, currentId)
  if (!spec) return plan
  const base = (spec.layers || []).filter((item) => item.materialId !== 'pex').map((item) => ({ ...item }))
  const layers = enabled ? [...base, layer('pex', 16)] : base
  const fork = Boolean(presetById(spec.id)) || !spec.custom
  const seq = fork ? (plan?.seq || 1) + 1 : (plan?.seq || 1)
  const id = fork ? `wt-${seq}` : spec.id
  const stored = storeStructure({ ...plan, seq }, {
    id,
    category: 'floor',
    name: spec.name,
    kind: 'floor',
    frameFraction: spec.frameFraction || 0,
    custom: true,
    layers,
  })
  const patch = assignHouseStructure(stored, 'floor', id)
  return { ...stored, ...patch, structures: patch.structures }
}

function pdfAscii(value) {
  return String(value ?? '')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a')
    .replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Å/g, 'A')
    .replace(/²/g, '2').replace(/³/g, '3')
}

export function buildStructureCardPdf(structure) {
  const spec = structure?.layers ? { ...structure, ...structurePerformance(structure) } : null
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Rakennetyyppi', 16, 20)
  if (!spec) return doc
  doc.setFontSize(12)
  doc.text(pdfAscii(spec.name || 'Rakenne'), 16, 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`U = ${Number(spec.u || 0).toFixed(3).replace('.', ',')} W/m2K`, 16, 36)
  doc.text(`Paksuus ${spec.thicknessMm || 0} mm`, 16, 42)
  doc.setFont('helvetica', 'bold')
  doc.text('Kerros sisalta ulos', 16, 52)
  doc.text('mm', 150, 52)
  doc.text('W/mK', 170, 52)
  doc.setFont('helvetica', 'normal')
  ;(spec.layers || []).forEach((item, index) => {
    const y = 60 + index * 7
    doc.text(pdfAscii(item.name || ''), 16, y)
    doc.text(String(item.thicknessMm ?? ''), 150, y)
    doc.text(String(item.lambda ?? ''), 170, y)
  })
  return doc
}

export function structureBill(plan) {
  const rows = new Map()
  const add = (code, structureName, name, qty, unit, materialId, structureId) => {
    const key = `${code}:${name}:${unit}`
    const found = rows.get(key) || { code, structureName, name, qty: 0, unit, materialId, structureId }
    found.qty += qty
    rows.set(key, found)
  }
  const heightOf = (wall) => wall.height || plan.floorHeight || 2.6
  ;(plan.walls || []).forEach((wall) => {
    const spec = resolveWallStructure(plan, wall)
    const coded = structureCode(plan, wall)
    if (!spec || !coded) return
    const area = Math.max(0, lengthOf(wall) * heightOf(wall) - openingArea(plan, wall))
    spec.layers.forEach((item) => {
      if (item.role === 'note' || !(item.thicknessMm > 0)) return
      const depth = item.thicknessMm / 1000
      if (item.hatch === 'insulation' || item.materialId === 'wool' || item.materialId === 'blown' || item.materialId === 'eps' || item.materialId === 'xps') {
        add(coded.code, spec.name, item.name, area * depth, 'm³', item.materialId, spec.id)
      }
      add(coded.code, spec.name, item.name, area, 'm²', item.materialId, spec.id)
    })
  })
  const floorArea = (plan.rooms || []).filter((room) => !room.suppressed).reduce((sum, room) => sum + (room.area || 0), 0)
  ;['floor', 'roof'].forEach((role) => {
    const spec = envelopeStructure(plan, role)
    if (!spec || !(floorArea > 0)) return
    const code = role === 'roof' ? 'YP' : 'AP'
    spec.layers.forEach((item) => {
      if (item.role === 'note' || !(item.thicknessMm > 0)) return
      const depth = item.thicknessMm / 1000
      if (item.hatch === 'insulation' || ['wool', 'blown', 'eps', 'xps'].includes(item.materialId)) add(code, spec.name, item.name, floorArea * depth, 'm³', item.materialId, spec.id)
      add(code, spec.name, item.name, floorArea, 'm²', item.materialId, spec.id)
    })
  })
  return [...rows.values()].map((row) => ({ ...row, qty: Math.round(row.qty * 100) / 100 })).filter((row) => row.qty > 0)
}

export function hatchStrips(wall, openings, walls, layers) {
  const faces = layerFaces(wall, walls, layers)
  const len = Math.hypot((wall?.b?.x || 0) - (wall?.a?.x || 0), (wall?.b?.z || 0) - (wall?.a?.z || 0)) || 1
  const gaps = (openings || [])
    .filter((opening) => opening.wallId === wall?.id && opening.width > 0)
    .map((opening) => ({
      from: Math.max(0, opening.offset - opening.width / 2),
      to: Math.min(len, opening.offset + opening.width / 2),
    }))
    .sort((a, b) => a.from - b.from)
  if (!gaps.length) return faces
  const spans = []
  let cursor = 0
  gaps.forEach((gap) => {
    if (gap.from > cursor + 0.02) spans.push([cursor, gap.from])
    cursor = Math.max(cursor, gap.to)
  })
  if (cursor < len - 0.02) spans.push([cursor, len])
  return faces.flatMap((face) => spans.map(([u0, u1]) => {
    const at = (u, side) => {
      const start = side === 0 ? face.points[0] : face.points[3]
      const end = side === 0 ? face.points[1] : face.points[2]
      const t = u / len
      return { x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t }
    }
    return { ...face, points: [at(u0, 0), at(u1, 0), at(u1, 1), at(u0, 1)] }
  }))
}

export function layerFaces(wall, walls, layers) {
  if (!wall?.a || !wall?.b || !(layers || []).length) return []
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  let nx = -dz
  let nz = dx
  let cx = 0
  let cz = 0
  let count = 0
  ;(walls || []).forEach((item) => {
    cx += item.a.x + item.b.x
    cz += item.a.z + item.b.z
    count += 2
  })
  if (count) {
    cx /= count
    cz /= count
    const midX = (wall.a.x + wall.b.x) / 2
    const midZ = (wall.a.z + wall.b.z) / 2
    if ((midX - cx) * nx + (midZ - cz) * nz < 0) {
      nx = -nx
      nz = -nz
    }
  }
  const usable = layers.filter((item) => item.role !== 'note' && (item.thicknessMm || 0) > 0.05)
  const total = usable.reduce((sum, item) => sum + item.thicknessMm, 0) / 1000
  let cursor = -total / 2
  return usable.map((item) => {
    const depth = item.thicknessMm / 1000
    const inner = cursor
    const outer = cursor + depth
    cursor = outer
    const at = (point, dist) => ({ x: point.x + nx * dist, z: point.z + nz * dist })
    return {
      hatch: item.hatch || 'gypsum',
      name: item.name,
      points: [at(wall.a, inner), at(wall.b, inner), at(wall.b, outer), at(wall.a, outer)],
    }
  })
}

export function annualHeatingKwh(watts, setpoint, outdoor, degreeDays) {
  const delta = Math.max(1, (Number(setpoint) || 0) - (Number(outdoor) || 0))
  const days = Math.max(0, Number(degreeDays) || 0)
  if (!(watts > 0) || !(days > 0)) return 0
  return Math.round(((watts / delta) * days * 24) / 1000)
}
