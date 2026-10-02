import { isRefrigerated } from './catalog.js'
import { containingRoom, equipmentPorts } from './placement.js'
import { routeLength, sizePipe } from './pipeSizing.js'

const PORT_REACH_M = 0.75

function endsOf(pipe) {
  const points = pipe?.points || []
  if (!points.length) return []
  if (points.length === 1) return [points[0]]
  return [points[0], points[points.length - 1]]
}

function near(point, port) {
  return !!point && !!port && Math.hypot(point.x - port.x, point.z - port.z) <= PORT_REACH_M
}

export function connectedEvaporators(pipe, rooms) {
  const ends = endsOf(pipe)
  const found = []
  const seen = new Set()
  for (const room of rooms || []) {
    for (const eq of room.equipment || []) {
      if (eq.category !== 'evaporator' || seen.has(eq.id)) continue
      const ports = equipmentPorts(room, eq)
      if (!ports) continue
      const hit = ends.some((point) => near(point, ports.suction) || near(point, ports.liquid) || near(point, ports.drain))
      if (!hit) continue
      seen.add(eq.id)
      found.push(eq)
    }
  }
  return found
}

function refrigeratedHost(points, rooms) {
  const hits = []
  const seen = new Set()
  for (const point of points || []) {
    const room = containingRoom(rooms, point.x, point.z)
    if (!room || !isRefrigerated(room.type) || seen.has(room.id)) continue
    seen.add(room.id)
    hits.push(room)
  }
  hits.sort((a, b) => a.width * a.depth - b.width * b.depth)
  return hits[0] || null
}

function loadWatts(loads, roomId) {
  if (!loads || !roomId) return 0
  if (loads instanceof Map) return loads.get(roomId) || 0
  const row = (loads || []).find((item) => item.id === roomId)
  return row?.total || 0
}

function automaticCapacity(pipe, rooms, loads) {
  const points = pipe?.points || []
  const evaporators = connectedEvaporators(pipe, rooms)
  const host = refrigeratedHost(points, rooms)
  if (evaporators.length) {
    const kw = evaporators.reduce((sum, eq) => sum + (Number(eq.capacityKw) || 0), 0)
    const names = evaporators.map((eq) => eq.name || 'höyrystin').join(', ')
    return {
      kw,
      source: 'evaporator',
      note: evaporators.length > 1 ? `Höyrystimien summa: ${names}` : `Höyrystin ${names}`,
      roomTempC: host?.temp,
      evaporators,
    }
  }
  const watts = loadWatts(loads, host?.id)
  if (host && watts > 0) {
    return {
      kw: watts / 1000,
      source: 'room',
      note: `Huoneen ${host.label || host.name || 'kuorma'} tarvittava teho`,
      roomTempC: host.temp,
      evaporators: [],
    }
  }
  return {
    kw: 0,
    source: 'missing',
    note: 'Tehoa ei löytynyt kytketystä höyrystimestä eikä huoneen kuormasta.',
    roomTempC: host?.temp,
    evaporators: [],
  }
}

export function resolvePipeCapacity(pipe, rooms, loads) {
  if (pipe?.kind === 'drain') {
    const host = refrigeratedHost(pipe?.points || [], rooms)
    return {
      kw: 0,
      source: 'drain',
      note: 'Kondenssivesi mitoitetaan huoneen lämpötilan mukaan.',
      roomTempC: pipe.roomTempC ?? host?.temp,
      evaporators: [],
    }
  }
  const auto = automaticCapacity(pipe, rooms, loads)
  if (pipe?.capacityManual && Number.isFinite(Number(pipe.capacityKw))) {
    const kw = Math.max(0, Number(pipe.capacityKw))
    const linked = auto.kw > 0 ? ` Kytketty teho olisi ${auto.kw.toFixed(2)} kW (${auto.note}).` : ''
    return {
      kw,
      source: 'manual',
      note: `Käsin syötetty teho.${linked}`,
      roomTempC: pipe.roomTempC ?? auto.roomTempC,
      evaporators: auto.evaporators,
    }
  }
  return auto
}

export function sizePlacedPipe(pipe, rooms, loads) {
  const duty = resolvePipeCapacity(pipe, rooms, loads)
  const sized = sizePipe(pipe, {
    capacityKw: duty.kw,
    capacityNote: duty.note,
    roomTempC: pipe?.roomTempC ?? duty.roomTempC ?? 2,
    lengthM: routeLength(pipe?.points),
  })
  return { duty, sized }
}
