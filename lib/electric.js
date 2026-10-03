export const FUSE_SERIES = [10, 13, 16, 20, 25, 32, 40, 50, 63]
export const FUSE_SERIES_3 = [10, 16, 20, 25, 32, 40, 50, 63]
const MAIN_SERIES = [25, 32, 40, 50, 63, 80, 100]

const WET = new Set(['wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone'])

export const ELECTRIC_DEVICES = [
  { kind: 'socket', name: 'Pistorasia', voltage: 230, power: 1000, cosPhi: 0.95, connection: 'socket', dedicated: false, role: 'socket' },
  { kind: 'light', name: 'Valaisin', voltage: 230, power: 80, cosPhi: 0.9, connection: 'fixed', dedicated: false, role: 'light' },
  { kind: 'switch', name: 'Kytkin', voltage: 230, power: 0, cosPhi: 1, connection: 'fixed', dedicated: false, role: 'light' },
  { kind: 'stove', name: 'Liesi', voltage: 400, power: 7600, cosPhi: 1, connection: 'fixed', dedicated: true, role: 'power' },
  { kind: 'oven', name: 'Uuni', voltage: 230, power: 3500, cosPhi: 1, connection: 'fixed', dedicated: true, role: 'power' },
  { kind: 'heater', name: 'Kiuas', voltage: 400, power: 9000, cosPhi: 1, connection: 'fixed', dedicated: true, role: 'power' },
  { kind: 'radiator', name: 'Sähköpatteri', voltage: 230, power: 1000, cosPhi: 1, connection: 'fixed', dedicated: false, role: 'socket' },
  { kind: 'ev', name: 'Sähköauton lataus', voltage: 400, power: 11000, cosPhi: 1, connection: 'fixed', dedicated: true, role: 'power' },
  { kind: 'heatpump', name: 'Lämpöpumppu', voltage: 400, power: 3500, cosPhi: 0.9, connection: 'fixed', dedicated: true, role: 'power' },
  { kind: 'iv-unit', name: 'IV-kone', voltage: 230, power: 600, cosPhi: 0.85, connection: 'fixed', dedicated: true, role: 'power' },
  { kind: 'boiler', name: 'Varaaja', voltage: 230, power: 3000, cosPhi: 1, connection: 'fixed', dedicated: true, role: 'power' },
  { kind: 'washer', name: 'Pesukone', voltage: 230, power: 2000, cosPhi: 1, connection: 'socket', dedicated: false, role: 'socket' },
  { kind: 'dishwasher', name: 'Astianpesukone', voltage: 230, power: 2200, cosPhi: 1, connection: 'socket', dedicated: false, role: 'socket' },
  { kind: 'data', name: 'Data', voltage: 0, power: 0, cosPhi: 1, connection: 'fixed', dedicated: false, role: 'signal' },
  { kind: 'antenna', name: 'Antenni', voltage: 0, power: 0, cosPhi: 1, connection: 'fixed', dedicated: false, role: 'signal' },
  { kind: 'junction', name: 'Jakorasia', voltage: 230, power: 0, cosPhi: 1, connection: 'fixed', dedicated: false, role: 'light' },
  { kind: 'panel', name: 'Sähkökeskus', voltage: 400, power: 0, cosPhi: 1, connection: 'fixed', dedicated: false, role: 'panel' },
]

export function deviceSpec(kind) {
  return ELECTRIC_DEVICES.find((item) => item.kind === kind) || null
}

export function phasesOf(voltage) {
  return Number(voltage) >= 300 ? 3 : 1
}

export function designCurrent(powerW, voltage, cosPhi = 1) {
  const power = Math.max(0, Number(powerW) || 0)
  const volts = Number(voltage) || 230
  const cos = Math.min(1, Math.max(0.2, Number(cosPhi) || 1))
  if (power <= 0 || volts <= 0) return 0
  if (phasesOf(volts) >= 3) return power / (Math.sqrt(3) * volts * cos)
  return power / (volts * cos)
}

export function selectFuse(amps, phases = 1) {
  const series = phases >= 3 ? FUSE_SERIES_3 : FUSE_SERIES
  const need = Math.max(0, Number(amps) || 0)
  return series.find((item) => item + 1e-9 >= need) || series[series.length - 1]
}

const CABLE_1 = [
  { fuse: 10, section: 1.5 },
  { fuse: 16, section: 2.5 },
  { fuse: 20, section: 4 },
  { fuse: 25, section: 6 },
  { fuse: 32, section: 10 },
  { fuse: 40, section: 16 },
  { fuse: 63, section: 25 },
]

const CABLE_3 = [
  { fuse: 10, section: 1.5 },
  { fuse: 16, section: 2.5 },
  { fuse: 25, section: 4 },
  { fuse: 32, section: 6 },
  { fuse: 40, section: 10 },
  { fuse: 50, section: 16 },
  { fuse: 63, section: 25 },
]

export function formatSection(cores, section) {
  return `${cores}x${String(section).replace('.', ',')}`
}

export function cableFor(voltage, fuse) {
  const phases = phasesOf(voltage)
  const table = phases >= 3 ? CABLE_3 : CABLE_1
  const row = table.find((item) => Number(fuse) <= item.fuse) || table[table.length - 1]
  const cores = phases >= 3 ? 5 : 3
  return { cores, section: row.section, label: formatSection(cores, row.section), code: 'MMJ' }
}

export function sizeCircuit(voltage, powerW, cosPhi = 1) {
  const volts = Number(voltage) || 230
  const phases = phasesOf(volts)
  const current = designCurrent(powerW, volts, cosPhi)
  const fuse = selectFuse(current, phases)
  const cable = cableFor(volts, fuse)
  return { phases, voltage: volts, current, fuse, cosPhi: Number(cosPhi) || 1, ...cable }
}

export function sizeDevice(kind, overrides = {}) {
  const spec = { ...(deviceSpec(kind) || ELECTRIC_DEVICES[0]), ...overrides }
  return sizeCircuit(spec.voltage, spec.power, spec.cosPhi)
}

export function voltageDrop({ current, lengthM, section, phases = 1, voltage = 230, cosPhi = 1 }) {
  const area = Math.max(0.5, Number(section) || 1.5)
  const resistance = 0.018 * Math.max(0, Number(lengthM) || 0) / area
  const factor = phases >= 3 ? Math.sqrt(3) : 2
  const drop = factor * Math.max(0, Number(current) || 0) * resistance * (Number(cosPhi) || 1)
  const volts = Number(voltage) || 230
  const pct = volts > 0 ? (drop / volts) * 100 : 0
  return {
    drop: Math.round(drop * 100) / 100,
    pct: Math.round(pct * 10) / 10,
    warning: pct > 4 + 1e-6,
  }
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

export function prepareDevice(device, context = {}) {
  const spec = deviceSpec(device?.kind) || {
    name: device?.name || 'Laite',
    voltage: 230,
    power: 0,
    cosPhi: 1,
    connection: 'fixed',
    dedicated: false,
    role: 'socket',
  }
  const role = device?.role || spec.role
  if (role === 'signal' || spec.role === 'signal' || device?.kind === 'panel') {
    return {
      ...device,
      name: device?.name || spec.name,
      role: device?.kind === 'panel' ? 'panel' : 'signal',
      voltage: 0,
      power: 0,
      current: 0,
      fuse: 0,
      phases: 1,
      cores: 0,
      section: 0,
      cable: device?.kind === 'panel' ? '' : 'Data',
      connection: 'fixed',
      dedicated: false,
      rcd: false,
      warning: '',
    }
  }
  const voltage = device?.voltage != null ? Number(device.voltage) : spec.voltage
  const power = device?.power != null ? Number(device.power) : spec.power
  const cosPhi = device?.cosPhi != null ? Number(device.cosPhi) : spec.cosPhi
  const connection = device?.connection || spec.connection
  const sized = sizeCircuit(voltage, power, cosPhi)
  const fuse = device?.fuseManual ? Number(device.fuse) || sized.fuse : sized.fuse
  const autoCable = cableFor(voltage, fuse)
  const section = device?.cableManual ? Number(device.section) || autoCable.section : autoCable.section
  const cores = autoCable.cores
  const roomKindName = context.roomKind || device?.roomKind || ''
  const wet = Boolean(device?.wet) || WET.has(roomKindName)
  const outdoor = Boolean(device?.outdoor)
  const rcd = outdoor || Boolean(device?.rcd) || connection === 'socket' || wet
  const family = outdoor ? 'MCMK' : 'MMJ'
  const notes = []
  if (device?.fuseManual && fuse + 1e-6 < sized.fuse) notes.push(`Sulake ${fuse} A on pienempi kuin laskettu ${sized.fuse} A`)
  if (section + 1e-6 < sized.section) notes.push(`Johdin ${section} mm² on pienempi kuin ${sized.section} mm²`)
  return {
    ...device,
    name: device?.name || spec.name,
    role: spec.role === 'panel' ? 'panel' : (device?.role || spec.role),
    voltage,
    power,
    cosPhi,
    connection,
    dedicated: device?.dedicated != null ? Boolean(device.dedicated) : spec.dedicated,
    phases: sized.phases,
    current: sized.current,
    fuse,
    cores,
    section,
    cable: `${family} ${formatSection(cores, section)}`,
    cableLabel: formatSection(cores, section),
    recommendedFuse: sized.fuse,
    recommendedSection: sized.section,
    recommendedCable: `${family} ${sized.label}`,
    outdoor,
    ip: device?.ip || (outdoor ? 'IP44' : ''),
    roomKind: roomKindName,
    roomName: context.roomName || device?.roomName || '',
    roomId: context.roomId || device?.roomId || '',
    wet,
    rcd,
    warning: notes.join('. '),
  }
}

function groupLimit(device) {
  if (device.role === 'light') return 10
  return 16
}

function areaKey(device) {
  return device.roomId || device.roomKind || device.roomName || 'talo'
}

function dominantRole(devices) {
  const counts = {}
  ;(devices || []).forEach((device) => {
    if (device.kind === 'switch' || device.kind === 'junction') return
    const role = device.role || 'socket'
    counts[role] = (counts[role] || 0) + 1
  })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return top?.[0] || devices?.[0]?.role || 'socket'
}

function topologyFor(role) {
  if (role === 'light') return 'lighting'
  if (role === 'signal') return 'signal'
  if (role === 'power') return 'radial'
  return 'socket'
}

export function segmentMark(circuit, { switched = false, cores } = {}) {
  if (!circuit) return ''
  if (circuit.role === 'signal' || circuit.topology === 'signal') return `Data / R${circuit.id}`
  const useCores = cores || (switched ? 3 : circuit.cores) || 3
  const section = circuit.section || 1.5
  const label = formatSection(useCores, section)
  const family = circuit.outdoor || String(circuit.cable || '').startsWith('MCMK') ? 'MCMK' : 'MMJ'
  return `${family} ${label}${switched ? ' S' : ''} / R${circuit.id}`
}

export function planCircuits(devices) {
  const prepared = (devices || []).map((device, index) => ({
    ...prepareDevice(device),
    _key: device?.id || `tmp-${index}`,
  })).filter((device) => device.role !== 'panel')
  const bins = []
  const manual = []
  const lightingRooms = new Map()
  const take = (key, create) => {
    let bin = bins.find((item) => item.key === key && item.open)
    if (!bin) {
      bin = { ...create, key, devices: [], open: true }
      bins.push(bin)
    }
    return bin
  }
  prepared.forEach((device) => {
    if (device.circuitMode === 'manual' && Number(device.circuit) > 0) {
      manual.push(device)
      return
    }
    if (device.role === 'signal') {
      take('signal', { role: 'signal', voltage: 0, name: 'Data ja antenni', topology: 'signal' }).devices.push(device)
      return
    }
    if (device.dedicated || device.role === 'power') {
      bins.push({
        key: `ded:${device._key}`,
        open: false,
        role: 'power',
        voltage: device.voltage,
        name: device.name,
        devices: [device],
        topology: 'radial',
      })
      return
    }
    if (device.role === 'light') {
      if (device.outdoor) {
        let bin = bins.find((item) => item.key === 'outdoor-light' && item.open && (item.current || 0) + (device.current || 0) <= 10 + 1e-6)
        if (!bin) {
          bin = {
            key: 'outdoor-light',
            open: true,
            role: 'light',
            voltage: 230,
            name: 'Pihavalaistus',
            devices: [],
            current: 0,
            topology: 'lighting',
            outdoor: true,
          }
          bins.push(bin)
        }
        bin.devices.push(device)
        bin.current = (bin.current || 0) + (device.current || 0)
        return
      }
      const roomKey = device.roomId || device.roomName || 'talo'
      const room = lightingRooms.get(roomKey) || { devices: [], current: 0, cx: device.x || 0, cz: device.z || 0 }
      room.devices.push(device)
      room.current += device.current || 0
      room.cx = device.x ?? room.cx
      room.cz = device.z ?? room.cz
      lightingRooms.set(roomKey, room)
      return
    }
    const limit = groupLimit(device)
    const key = `${device.role}:${areaKey(device)}:${device.voltage}`
    let bin = bins.find((item) => item.key === key && item.open && (item.current || 0) + device.current <= limit + 1e-6)
    if (!bin) {
      const room = device.roomName || device.roomKind || 'talo'
      bin = {
        key,
        open: true,
        role: device.role,
        voltage: device.voltage,
        name: `Pistorasiat ${room}`,
        devices: [],
        current: 0,
        topology: 'socket',
      }
      bins.push(bin)
    }
    bin.devices.push(device)
    bin.current = (bin.current || 0) + device.current
  })
  ;[...lightingRooms.values()]
    .sort((a, b) => (a.cz || 0) - (b.cz || 0) || (a.cx || 0) - (b.cx || 0))
    .forEach((room) => {
      let bin = bins.find((item) => item.topology === 'lighting' && item.open && (item.current || 0) + room.current <= 10 + 1e-6)
      if (!bin) {
        bin = {
          key: `light:${bins.length}`,
          open: true,
          role: 'light',
          voltage: 230,
          name: 'Valaistus',
          devices: [],
          current: 0,
          topology: 'lighting',
        }
        bins.push(bin)
      }
      bin.devices.push(...room.devices)
      bin.current = (bin.current || 0) + room.current
    })
  manual.forEach((device) => {
    const id = Number(device.circuit)
    const bin = take(`manual:${id}`, {
      manual: true,
      id,
      role: device.role,
      voltage: device.voltage,
      name: device.name,
      topology: topologyFor(device.role),
    })
    bin.devices.push(device)
    bin.voltage = Math.max(bin.voltage || 0, device.voltage || 0)
    bin.role = dominantRole(bin.devices)
    bin.topology = topologyFor(bin.role)
  })

  const used = new Set(bins.filter((bin) => bin.manual && bin.id).map((bin) => bin.id))
  let cursor = 1
  const nextId = () => {
    while (used.has(cursor)) cursor += 1
    const id = cursor
    used.add(id)
    cursor += 1
    return id
  }
  const circuits = bins.filter((bin) => bin.devices.length).map((bin) => {
    const power = bin.devices.reduce((sum, device) => sum + (device.power || 0), 0)
    const current = bin.devices.reduce((sum, device) => sum + (device.current || 0), 0)
    const voltage = bin.role === 'signal' ? 0 : Math.max(...bin.devices.map((device) => device.voltage || 0))
    const cosPhi = power > 0
      ? bin.devices.reduce((sum, device) => sum + (device.cosPhi || 1) * (device.power || 0), 0) / power
      : 1
    const phases = voltage >= 300 ? 3 : 1
    const manualFuse = bin.devices.some((device) => device.fuseManual)
    const fuse = bin.role === 'signal'
      ? 0
      : manualFuse
        ? Math.max(...bin.devices.map((device) => Number(device.fuse) || 0))
        : selectFuse(current, phases)
    const manualSection = bin.devices.find((device) => device.cableManual)
    const cable = bin.role === 'signal'
      ? { cores: 0, section: 0, label: 'Data', code: '' }
      : manualSection
        ? { cores: phases >= 3 ? 5 : 3, section: Number(manualSection.section) || 1.5, label: formatSection(phases >= 3 ? 5 : 3, Number(manualSection.section) || 1.5) }
        : cableFor(voltage || 230, fuse)
    const outdoor = Boolean(bin.outdoor) || bin.devices.some((device) => device.outdoor)
    const rcd = outdoor || bin.devices.some((device) => device.rcd)
    const names = bin.devices.map((device) => device.name || device.kind)
    const rooms = [...new Set(bin.devices.map((device) => device.roomName).filter(Boolean))]
    const role = dominantRole(bin.devices)
    const topology = bin.role === 'signal' ? 'signal' : (bin.topology || topologyFor(role))
    const description = outdoor && topology === 'lighting'
      ? 'Pihavalaistus'
      : topology === 'lighting'
      ? `Valaistus${rooms.length ? ` ${rooms.join(', ')}` : ''}`
      : topology === 'socket'
        ? `Pistorasiat ${rooms.join(', ') || 'talo'}`
        : topology === 'signal'
          ? 'Data ja antenni'
          : (bin.name || names[0] || 'Ryhmä')
    return {
      id: bin.manual ? bin.id : nextId(),
      description,
      devices: names,
      deviceIds: bin.devices.map((device) => device._key),
      members: bin.devices.map((device) => ({
        id: device._key,
        name: device.name || device.kind,
        room: device.roomName || '',
        kind: device.kind,
      })),
      rooms,
      topology,
      voltage,
      phases,
      power: Math.round(power),
      current: round1(current),
      fuse,
      rcd: rcd ? '30 mA' : '',
      cores: cable.cores,
      section: cable.section,
      cable: bin.role === 'signal' ? 'Data' : `${outdoor ? 'MCMK' : 'MMJ'} ${cable.label}`,
      cableLabel: cable.label,
      outdoor,
      cosPhi,
      role: bin.role === 'signal' ? 'signal' : role,
      length: 0,
      dropPct: 0,
      warning: '',
    }
  })

  const phaseAmps = { L1: 0, L2: 0, L3: 0 }
  circuits.filter((circuit) => circuit.phases >= 3 && circuit.current > 0).forEach((circuit) => {
    circuit.phase = 'L1-L3'
    phaseAmps.L1 += circuit.current
    phaseAmps.L2 += circuit.current
    phaseAmps.L3 += circuit.current
  })
  circuits.filter((circuit) => circuit.phases < 3 && circuit.role !== 'signal').forEach((circuit) => {
    const phase = Object.entries(phaseAmps).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0]
    circuit.phase = phase
    phaseAmps[phase] += circuit.current
  })
  circuits.filter((circuit) => !circuit.phase).forEach((circuit) => { circuit.phase = '—' })

  const assigned = prepared.map((device) => {
    const circuit = circuits.find((item) => item.deviceIds.includes(device._key))
    if (!circuit) return device
    const marking = circuit.role === 'signal' ? `Data / R${circuit.id}` : `${circuit.cable} / R${circuit.id}`
    return {
      ...device,
      circuit: circuit.id,
      phase: circuit.phase,
      fuse: device.fuseManual ? device.fuse : (circuit.fuse || device.fuse),
      cable: device.cableManual ? device.cable : circuit.cable,
      cableLabel: circuit.cableLabel,
      cores: circuit.cores,
      section: circuit.section,
      rcd: Boolean(circuit.rcd),
      marking,
    }
  })
  const peak = Math.max(phaseAmps.L1, phaseAmps.L2, phaseAmps.L3, 0)
  const main = MAIN_SERIES.find((item) => item + 1e-9 >= peak) || MAIN_SERIES[MAIN_SERIES.length - 1]
  const totalPower = circuits.reduce((sum, circuit) => sum + circuit.power, 0)
  return {
    devices: assigned.map(({ _key, ...device }) => device),
    circuits,
    phaseLoads: {
      L1: round1(phaseAmps.L1),
      L2: round1(phaseAmps.L2),
      L3: round1(phaseAmps.L3),
    },
    totalPower,
    mainFuse: `3x${main} A`,
    mainAmps: main,
  }
}

export function applyVoltageDrop(circuit, lengthM) {
  if (!circuit || circuit.role === 'signal' || !circuit.section) return { ...circuit, length: round1(lengthM), dropPct: 0, warning: circuit?.warning || '' }
  const drop = voltageDrop({
    current: circuit.current,
    lengthM,
    section: circuit.section,
    phases: circuit.phases,
    voltage: circuit.voltage,
    cosPhi: circuit.cosPhi || 1,
  })
  const warning = [circuit.warning, drop.warning ? `Jännitehäviö ${drop.pct} % ylittää 4 %` : ''].filter(Boolean).join('. ')
  return { ...circuit, length: round1(lengthM), dropPct: drop.pct, warning }
}

export function markingFor(circuit) {
  if (!circuit) return ''
  if (circuit.role === 'signal') return `Data / R${circuit.id}`
  const label = circuit.cableLabel || String(circuit.cable || '').replace(/^MMJ\s+/, '')
  return `MMJ ${label} / R${circuit.id}`
}
