// Exterior colours and finishes. A new paint is one row in PAINTS.
// Stored plans keep hex colours and a code (RAL, NCS or a shade name).

export const PAINTS = [
  { id: 'white', name: 'Valkoinen', hex: '#F4F1EA', code: 'NCS S 0500-N' },
  { id: 'grey', name: 'Harmaa', hex: '#8C8F91', code: 'RAL 7037' },
  { id: 'dark-grey', name: 'Tummanharmaa', hex: '#383E42', code: 'RAL 7016' },
  { id: 'blue', name: 'Sininen', hex: '#2E5984', code: 'NCS S 4030-R90B' },
  { id: 'red-ochre', name: 'Punamulta', hex: '#8E3924', code: 'NCS S 4050-Y80R' },
  { id: 'yellow', name: 'Keltainen', hex: '#E0B03A', code: 'NCS S 1050-Y10R' },
  { id: 'green', name: 'Vihreä', hex: '#2F4F3E', code: 'RAL 6005' },
  { id: 'black', name: 'Musta', hex: '#1C1C1C', code: 'RAL 9005' },
  { id: 'brick-red', name: 'Tiilenpunainen', hex: '#6B3A32', code: 'RAL 3009' },
  { id: 'brown', name: 'Ruskea', hex: '#45322D', code: 'RAL 8017' },
]

export const ROOF_COLOURS = ['black', 'dark-grey', 'brick-red', 'brown', 'green'].map((id) => PAINTS.find((item) => item.id === id))

export const ROOFINGS = [
  { id: 'standing-seam', name: 'Konesaumattu pelti', pattern: 'seam', aliases: ['metal'] },
  { id: 'tile-metal', name: 'Tiilikuviopelti', pattern: 'tile-metal' },
  { id: 'concrete-tile', name: 'Betonitiili', pattern: 'tile' },
  { id: 'clay-tile', name: 'Savitiili', pattern: 'tile', aliases: ['tile'] },
  { id: 'felt', name: 'Huopa', pattern: 'felt', aliases: ['felt'] },
  { id: 'corrugated', name: 'Aaltopelti', pattern: 'corrugated' },
]

export const PLINTHS = [
  { id: 'render-grey', name: 'Sokkelirappaus harmaa', color: '#9A9A96', code: 'RAL 7030', pattern: 'render' },
  { id: 'concrete', name: 'Betoni', color: '#B7B5B0', code: 'RAL 7035', pattern: 'concrete' },
  { id: 'stone', name: 'Kivi', color: '#7A756E', code: 'RAL 7039', pattern: 'stone' },
  { id: 'black', name: 'Musta', color: '#2A2A2A', code: 'RAL 9005', pattern: 'render' },
]

export const BRICK_TONES = [
  { id: 'brick-yellow', name: 'Keltatiili' },
  { id: 'brick-red', name: 'Punatiili' },
  { id: 'brick-brown', name: 'Ruskea tiili' },
  { id: 'brick-grey', name: 'Harmaa tiili' },
  { id: 'brick-white', name: 'Valkotiili' },
]

const WOOD = new Set(['wood-horizontal', 'wood-vertical', 'wood-batten'])
const BRICK = new Set(['brick-red', 'brick-yellow', 'brick-white', 'brick-brown', 'brick-grey'])

// Finnish facing brick, running bond. The module is the brick plus one mortar joint.
export const BRICK_LENGTH_MM = 257
export const BRICK_HEIGHT_MM = 85
export const BRICK_JOINT_MM = 10
export const BRICK_MODULE_M = {
  w: (BRICK_LENGTH_MM + BRICK_JOINT_MM) / 1000,
  h: (BRICK_HEIGHT_MM + BRICK_JOINT_MM) / 1000,
}

export function validHex(value) {
  const text = String(value || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toUpperCase()
  if (/^[0-9a-fA-F]{6}$/.test(text)) return `#${text.toUpperCase()}`
  return ''
}

export function paintById(id) {
  return PAINTS.find((item) => item.id === id) || null
}

export function roofingOf(id) {
  return ROOFINGS.find((item) => item.id === id || (item.aliases || []).includes(id)) || ROOFINGS[0]
}

export function plinthSpec(id) {
  return PLINTHS.find((item) => item.id === id) || PLINTHS[0]
}

function clamp(value, lo, hi, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(hi, Math.max(lo, number))
}

export function finishesOf(plan = {}) {
  const plinth = plinthSpec(plan.plinthMaterial)
  return {
    boardWidthMm: clamp(plan.boardWidthMm, 70, 280, 145),
    claddingColor: validHex(plan.claddingColor),
    claddingCode: plan.claddingCode || '',
    trimColor: validHex(plan.trimColor) || '#F4F1EA',
    trimCode: plan.trimCode || 'NCS S 0500-N',
    mortarColor: validHex(plan.mortarColor) || '#D5CBBA',
    brickPaint: validHex(plan.brickPaint),
    brickPaintCode: plan.brickPaintCode || '',
    renderColor: validHex(plan.renderColor),
    renderCode: plan.renderCode || '',
    concreteColor: validHex(plan.concreteColor),
    concreteCode: plan.concreteCode || '',
    stoneColor: validHex(plan.stoneColor),
    stoneCode: plan.stoneCode || '',
    fibreColor: validHex(plan.fibreColor),
    fibreCode: plan.fibreCode || '',
    roofColor: validHex(plan.roofColor),
    roofCode: plan.roofCode || '',
    gutterColor: validHex(plan.gutterColor) || '#383E42',
    gutterCode: plan.gutterCode || 'RAL 7016',
    plinthHeight: clamp(plan.plinthHeight, 0.15, 0.9, 0.4),
    plinthMaterial: plinth.id,
    plinthColor: validHex(plan.plinthColor) || plinth.color,
    plinthCode: plan.plinthCode || plinth.code,
    plinthPattern: plinth.pattern,
    plinthName: plinth.name,
    windowColor: validHex(plan.windowColor) || '#F4F1EA',
    windowCode: plan.windowCode || 'NCS S 0500-N',
    doorColor: validHex(plan.doorColor) || '#6B4226',
    doorCode: plan.doorCode || '',
    sceneStyle: plan.sceneStyle === 'technical' ? 'technical' : 'realistic',
  }
}

export function lookFor(item, plan, override = {}) {
  const finish = finishesOf(plan)
  const base = item || { id: 'wood-horizontal', name: 'Vaakapaneeli', group: 'Puuverhous', color: '#C4A484', pattern: 'boards-h' }
  let color = base.color
  let code = ''
  let painted = false
  const pattern = base.pattern || 'render'
  const custom = validHex(override.color)
  if (custom) {
    color = custom
    code = override.colorCode || custom
  } else if (WOOD.has(base.id) && finish.claddingColor) {
    color = finish.claddingColor
    code = finish.claddingCode || color
  } else if (BRICK.has(base.id) && finish.brickPaint) {
    color = finish.brickPaint
    code = finish.brickPaintCode || color
    painted = true
  } else if (base.id === 'render' && finish.renderColor) {
    color = finish.renderColor
    code = finish.renderCode || color
  } else if (base.id === 'brick-rendered' && finish.renderColor) {
    color = finish.renderColor
    code = finish.renderCode || color
    painted = true
  } else if (base.id === 'stone' && finish.stoneColor) {
    color = finish.stoneColor
    code = finish.stoneCode || color
  } else if (base.id === 'concrete' && finish.concreteColor) {
    color = finish.concreteColor
    code = finish.concreteCode || color
  } else if (base.id === 'fibre' && finish.fibreColor) {
    color = finish.fibreColor
    code = finish.fibreCode || color
  }
  return {
    id: base.id,
    name: base.name,
    group: base.group || '',
    color,
    code,
    pattern,
    painted,
    mortar: finish.mortarColor,
    boardWidthMm: finish.boardWidthMm,
  }
}
