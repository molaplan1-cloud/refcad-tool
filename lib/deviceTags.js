// Unique device tags (tunnukset). One prefix per device type, next free number
// in the project, and cables name both ends: "SK1 → JR3".

const KIND_PREFIX = {
  ahu: 'IV',
  'iv-unit': 'IV',
  hood: 'KU',
  silencer: 'AV',
  'outdoor-terminal': 'UL',
  'exhaust-terminal': 'JA',
  manifold: 'JT',
  'floor-manifold': 'JT',
  'kv-manifold': 'JT',
  'lv-manifold': 'JT',
  shutoff: 'PS',
  inlet: 'VI',
  'floor-drain': 'K',
  well: 'K',
  rainwell: 'K',
  soakaway: 'K',
  cleanout: 'PU',
  junction: 'JR',
  socket: 'P',
  switch: 'KY',
  light: 'V',
  data: 'DA',
  antenna: 'AT',
  stove: 'LS',
  oven: 'UU',
  heater: 'KI',
  radiator: 'SP',
  ev: 'EL',
  heatpump: 'LP',
  boiler: 'VR',
  washer: 'PM',
  dishwasher: 'AK',
  'dhw-tank': 'LV',
  'dhw-exchanger': 'KS',
  'heat-source': 'LL',
  'buffer-tank': 'PB',
  'heater-rad': 'PA',
  thermostat: 'T',
  actuator: 'TO',
  'air-air': 'IL',
  'heater-control': 'OK',
  collector: 'KE',
  'outdoor-tap': 'PH',
  fixture: 'VP',
  'drain-point': 'KL',
}

const POINT_PREFIX = {
  sink: 'AL',
  shower: 'SU',
  wc: 'WC',
  washer: 'PV',
  dishwasher: 'AP',
  outdoor: 'PH',
  'drain-link': 'DK',
}

const RESERVED = new Set([
  ...Object.values(KIND_PREFIX),
  ...Object.values(POINT_PREFIX),
  'PK', 'SK', 'JR', 'TU', 'PO', 'VE', 'VP',
])

export function normalizeTag(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

export function tagPrefix(node) {
  if (!node) return 'X'
  if (node.kind === 'panel') {
    const name = String(node.name || '')
    if (node.role === 'main' || node.main || /pääkeskus|paakeskus/i.test(name)) return 'PK'
    return 'SK'
  }
  if (node.kind === 'valve') {
    if (node.role === 'poisto') return 'PO'
    if (node.role === 'tulo') return 'TU'
    return 'VE'
  }
  if (node.kind === 'water-point') return POINT_PREFIX[node.pointType] || 'VP'
  if (KIND_PREFIX[node.kind]) return KIND_PREFIX[node.kind]
  const letters = String(node.kind || 'X').toUpperCase().replace(/[^A-Z]/g, '')
  let prefix = (letters.slice(0, 2) || 'X')
  if (prefix.length < 2) prefix = `${prefix}X`
  let guard = 0
  while (RESERVED.has(prefix) && guard < 4) {
    prefix = `${prefix}X`.slice(0, 4)
    guard += 1
  }
  return prefix
}

export function tagTaken(nodes, tag, exceptId = null) {
  const want = normalizeTag(tag)
  if (!want) return false
  return (nodes || []).some((node) => node.id !== exceptId && normalizeTag(node.tag) === want)
}

export function deviceTagError(nodes, id, raw) {
  const tag = normalizeTag(raw)
  if (!tag) return 'Tunnus ei voi olla tyhjä'
  if (!/^[A-ZÅÄÖ]{1,6}\d+$/.test(tag)) return 'Tunnus on etuliite ja numero, esimerkiksi SK1'
  if (tagTaken(nodes, tag, id)) return `Tunnus ${tag} on jo käytössä`
  return ''
}

export function nextDeviceTag(nodes, node) {
  const prefix = tagPrefix(node)
  const used = new Set()
  ;(nodes || []).forEach((item) => {
    const tag = normalizeTag(item.tag)
    if (!tag) return
    used.add(tag)
    const match = tag.match(new RegExp(`^${prefix}(\\d+)$`))
    if (match) used.add(`${prefix}${Number(match[1])}`)
  })
  let n = 1
  while (used.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

export function withDeviceTags(plan) {
  const services = plan?.services
  if (!services || !Array.isArray(services.nodes)) return plan
  const nodes = []
  let changed = false
  services.nodes.forEach((node) => {
    const tag = normalizeTag(node.tag)
    const clash = tag && nodes.some((item) => normalizeTag(item.tag) === tag)
    if (tag && !clash) {
      if (tag !== node.tag) {
        nodes.push({ ...node, tag })
        changed = true
      } else nodes.push(node)
      return
    }
    nodes.push({ ...node, tag: nextDeviceTag(nodes, node) })
    changed = true
  })
  if (!changed) return plan
  return { ...plan, services: { ...services, nodes } }
}

function nearestTagged(nodes, point, run) {
  let best = null
  const system = run?.system
  ;(nodes || []).forEach((node) => {
    if (!node?.tag) return
    if (system && node.system && node.system !== system) return
    const dist = Math.hypot((node.x || 0) - (point?.x || 0), (node.z || 0) - (point?.z || 0))
    if (dist > 0.75) return
    if (!best || dist < best.dist) best = { dist, node }
  })
  return best?.node || null
}

export function cableSpan(nodes, run) {
  const points = run?.points || []
  if (points.length < 2) return ''
  let start = nearestTagged(nodes, points[0], run)
  let end = nearestTagged(nodes, points[points.length - 1], run)
  if (run?.deviceId) {
    const device = (nodes || []).find((node) => node.id === run.deviceId && node.tag)
    if (device) {
      const atStart = Math.hypot((device.x || 0) - (points[0].x || 0), (device.z || 0) - (points[0].z || 0))
      const atEnd = Math.hypot((device.x || 0) - (points[points.length - 1].x || 0), (device.z || 0) - (points[points.length - 1].z || 0))
      if (atStart <= atEnd) start = device
      else end = device
    }
  }
  const from = normalizeTag(start?.tag)
  const to = normalizeTag(end?.tag)
  if (!from || !to || from === to) return ''
  return `${from} → ${to}`
}

export function cableSchedule(plan, system) {
  const nodes = plan?.services?.nodes || []
  return (plan?.services?.runs || [])
    .filter((run) => !system || run.system === system)
    .map((run) => ({
      id: run.id,
      system: run.system,
      span: cableSpan(nodes, run),
      marking: run.marking || run.cable || '',
    }))
    .filter((row) => row.span)
}
