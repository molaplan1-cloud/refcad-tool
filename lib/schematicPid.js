// Orthogonal refrigeration flow diagram. Symbols follow the EN 1861 / ISO 14617
// shapes used on a P&ID: compressor circle, heat-exchanger blocks, vessels,
// valve bowties, and instrument bubbles. Coordinates are a fixed A3 grid so
// the liquid line stays on top and the suction line stays on the bottom.

export function pipeCode(prefix, odMm) {
  const n = Number(odMm)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `${prefix}-${(Math.round(n * 10) / 10).toFixed(1)} Cu`
}

const SHEET_W = 1680
const SHEET_H = 1188
const SPINE = 188
const SUCTION_Y = 800
const ROOM_HEADER = 140
const COLUMN = 700
const TRUNK = 772
const DROP_X = 1200

export function layoutPid(spec) {
  const acc = spec.accessories || {}
  const remote = !!spec.remote
  const sizes = spec.sizes || {}
  const dischargeCode = pipeCode('D', sizes.hotgasOd)
  const liquidCode = pipeCode('L', sizes.liquidOd)
  const returnCode = pipeCode('L', sizes.liquidReturnOd)
  const suctionCode = pipeCode('S', sizes.suctionOd)
  const oilCode = 'O-6.4 Cu'
  const trainY = remote ? 360 : 248
  const columnTop = remote ? 276 : ROOM_HEADER
  const evaps = spec.evaps?.length ? spec.evaps : [{ name: 'Höyrystin' }]
  const symbols = []
  const lines = []
  const labels = []

  const boxes = []
  if (remote) {
    boxes.push(box('condenser', 40, 32, 700, 164, 'Lauhdutin'))
    boxes.push(box('unit', 40, 208, 700, 660, spec.virtual ? 'Koneikko (ei pohjassa)' : (spec.machineName || 'Koneikko')))
  } else {
    boxes.push(box('unit', 40, 32, 700, 836, spec.virtual ? 'Koneikko (ei pohjassa)' : (spec.machineName || 'Koneikko')))
  }
  boxes.push(box('room', 820, 32, 820, 836, spec.title || evaps[0].roomName || 'Kylmähuone'))

  const condenser = sym(symbols, 'condenser', 148, 68, 280, 52, {
    hot: { x: 40, y: 52 },
    liquid: { x: 280, y: 26 },
  }, {
    group: remote ? 'condenser' : 'unit',
    name: 'Lauhdutin',
    model: spec.condenserName || (remote ? 'Kaukoylauhdutin' : 'Ilmalauhdutteinen'),
    connection: [dischargeCode, returnCode].filter(Boolean).join(' / ') || '—',
  })

  const compressor = sym(symbols, 'compressor', 152, 620, 72, 72, {
    discharge: { x: 36, y: 0 },
    suction: { x: 36, y: 72 },
    oil: { x: 72, y: 36 },
  }, {
    group: 'unit',
    name: 'Kompressori',
    model: spec.machineName || 'Puolihermeettinen',
    connection: [suctionCode, dischargeCode].filter(Boolean).join(' / ') || '—',
  })

  const dischargeValve = sym(symbols, 'serviceValve', 172, 580, 32, 28, {
    in: { x: 16, y: 28 },
    out: { x: 16, y: 0 },
  }, { group: 'unit', name: 'Painepuolen sulkuventtiili', model: 'Sulku', connection: dischargeCode || '—', tag: 'SV1' })

  const suctionValve = sym(symbols, 'serviceValve', 172, 704, 32, 28, {
    in: { x: 16, y: 0 },
    out: { x: 16, y: 28 },
  }, { group: 'unit', name: 'Imupuolen sulkuventtiili', model: 'Sulku', connection: suctionCode || '—', tag: 'SV2' })

  poly(lines, [compressor.ports.discharge, dischargeValve.ports.in], 'discharge')
  poly(lines, [suctionValve.ports.in, compressor.ports.suction], 'suction')
  poly(lines, [suctionValve.ports.out, { x: SPINE, y: SUCTION_Y }], 'suction')

  let oil = null
  if (acc.oilSeparator) {
    oil = sym(symbols, 'oilSeparator', 166, 340, 44, 150, {
      in: { x: 22, y: 150 },
      out: { x: 22, y: 0 },
      oil: { x: 44, y: 80 },
    }, {
      group: 'unit',
      name: 'Öljynerotin',
      model: 'Pystysäiliö',
      connection: [dischargeCode, oilCode].filter(Boolean).join(' / '),
    })
    const check = sym(symbols, 'checkValve', 256, 500, 28, 28, {
      in: { x: 14, y: 0 },
      out: { x: 14, y: 28 },
    }, { group: 'unit', name: 'Takaiskuventtiili', model: 'Öljyn paluu', connection: oilCode, tag: 'CV' })
    poly(lines, [dischargeValve.ports.out, oil.ports.in], 'discharge')
    const riser = poly(lines, [oil.ports.out, condenser.ports.hot], 'discharge')
    tag(labels, riser, dischargeCode, 'discharge', { x: 146, y: 230, rotate: true })
    poly(lines, [oil.ports.oil, { x: 270, y: oil.ports.oil.y }, check.ports.in], 'oil')
    poly(lines, [check.ports.out, { x: 270, y: compressor.ports.oil.y }, compressor.ports.oil], 'oil')
    tag(labels, lines[lines.length - 1], oilCode, 'oil', { x: 308, y: 610, rotate: true })
  } else {
    const riser = poly(lines, [dischargeValve.ports.out, condenser.ports.hot], 'discharge')
    tag(labels, riser, dischargeCode, 'discharge', { x: 146, y: 360, rotate: true })
  }

  const train = []
  let cursor = 400
  if (acc.receiver) {
    const receiver = sym(symbols, 'receiver', cursor, trainY - 70, 44, 100, {
      in: { x: 22, y: 0 },
      out: { x: 44, y: 70 },
    }, { group: 'unit', name: 'Vastaanotin', model: 'Pystysäiliö', connection: returnCode || liquidCode || '—' })
    train.push(receiver)
    cursor += 68
  }
  if (acc.filterDrier) {
    const drier = sym(symbols, 'filterDrier', cursor, trainY - 14, 86, 28, {
      in: { x: 0, y: 14 },
      out: { x: 86, y: 14 },
    }, { group: 'unit', name: 'Suodinkuivain', model: 'Kuivain', connection: liquidCode || '—' })
    train.push(drier)
    cursor += 100
  }
  if (acc.sightGlass) {
    const sight = sym(symbols, 'sightGlass', cursor, trainY - 14, 28, 28, {
      in: { x: 0, y: 14 },
      out: { x: 28, y: 14 },
    }, { group: 'unit', name: 'Näkölasi', model: 'Kosteusindikaattori', connection: liquidCode || '—' })
    train.push(sight)
    cursor += 44
  }
  if (acc.solenoid) {
    const solenoid = sym(symbols, 'solenoid', cursor, trainY - 24, 40, 48, {
      in: { x: 0, y: 24 },
      out: { x: 40, y: 24 },
      coil: { x: 20, y: 0 },
    }, { group: 'unit', name: 'Magneettiventtiili', model: 'NC', connection: liquidCode || '—' })
    train.push(solenoid)
    cursor += 56
  }

  if (train.length) {
    const first = train[0]
    const entry = first.type === 'receiver' ? first.ports.in : first.ports.in
    const enteringTop = first.type === 'receiver'
    const dodge = condenser.ports.liquid.x + 36
    const busY = enteringTop ? entry.y - 48 : entry.y - 48
    const feed = poly(lines, [
      condenser.ports.liquid,
      { x: dodge, y: condenser.ports.liquid.y },
      { x: dodge, y: busY },
      { x: entry.x, y: busY },
      entry,
    ], 'liquid')
    tag(labels, feed, returnCode || liquidCode, 'liquid', remote
      ? { x: dodge + 22, y: 180, rotate: true }
      : { x: 560, y: 108, rotate: false })
    for (let i = 1; i < train.length; i += 1) {
      poly(lines, [train[i - 1].ports.out, train[i].ports.in], 'liquid')
    }
  }

  const expansionType = acc.expansion === 'eev' ? 'eev' : acc.expansion === 'none' ? '' : 'txv'
  let expansion = null
  if (expansionType) {
    expansion = sym(symbols, expansionType, 900, ROOM_HEADER - 20, 56, 40, {
      in: { x: 0, y: 20 },
      out: { x: 56, y: 20 },
      bulb: { x: 28, y: 40 },
      equaliser: { x: 40, y: 40 },
    }, {
      group: 'room',
      name: expansionType === 'eev' ? 'Elektroninen paisuntaventtiili' : 'Paisuntaventtiili',
      model: expansionType === 'eev' ? 'EEV' : 'TXV, ulkoinen tasaus',
      connection: liquidCode || '—',
    })
  }

  const evapSymbols = evaps.map((evap, index) => sym(symbols, 'evaporator', index === 0 ? 1020 : 1280, index === 0 ? ROOM_HEADER - 32 : 300, index === 0 ? 360 : 280, index === 0 ? 64 : 56, {
    liquid: { x: 0, y: index === 0 ? 32 : 28 },
    suction: { x: index === 0 ? 180 : 140, y: index === 0 ? 64 : 56 },
  }, {
    group: 'room',
    name: 'Höyrystin',
    model: evap.name || 'Höyrystin',
    connection: [liquidCode, suctionCode].filter(Boolean).join(' / ') || '—',
  }))
  const evap = evapSymbols[0]

  const last = train[train.length - 1]
  const origin = last ? last.ports.out : condenser.ports.liquid
  const destination = expansion ? expansion.ports.in : evap.ports.liquid
  const supplyPoints = [{ x: origin.x, y: origin.y }]
  if (origin.x !== COLUMN || origin.y !== trainY) supplyPoints.push({ x: COLUMN, y: origin.y })
  if (remote) {
    supplyPoints.push({ x: COLUMN, y: columnTop }, { x: 860, y: columnTop }, { x: 860, y: ROOM_HEADER })
  } else if (origin.y !== ROOM_HEADER) {
    supplyPoints.push({ x: COLUMN, y: ROOM_HEADER })
  }
  supplyPoints.push(destination)
  const supply = poly(lines, supplyPoints, 'liquid')
  tag(labels, supply, liquidCode, 'liquid', remote
    ? { x: 820, y: columnTop - 18, rotate: false }
    : { x: 760, y: ROOM_HEADER - 18, rotate: false })

  if (expansion) {
    poly(lines, [expansion.ports.out, evap.ports.liquid], 'liquid')
    if (expansionType === 'txv') {
      poly(lines, [
        expansion.ports.bulb,
        { x: expansion.ports.bulb.x, y: 196 },
        { x: 1160, y: 196 },
        { x: 1160, y: evap.ports.suction.y },
      ], 'capillary', { endCap: 'bulb' })
      poly(lines, [
        expansion.ports.equaliser,
        { x: expansion.ports.equaliser.x, y: 214 },
        { x: evap.ports.suction.x - 12, y: 214 },
        { x: evap.ports.suction.x - 12, y: evap.ports.suction.y },
      ], 'capillary')
    }
  }

  evapSymbols.slice(1).forEach((extra) => {
    poly(lines, [
      { x: 990, y: ROOM_HEADER },
      { x: 990, y: extra.ports.liquid.y },
      { x: DROP_X - 14, y: extra.ports.liquid.y },
      { x: DROP_X - 14, y: extra.ports.liquid.y - 14 },
      { x: DROP_X + 14, y: extra.ports.liquid.y - 14 },
      { x: DROP_X + 14, y: extra.ports.liquid.y },
      extra.ports.liquid,
    ], 'liquid')
    poly(lines, [
      extra.ports.suction,
      { x: extra.ports.suction.x, y: extra.ports.suction.y + 28 },
      { x: DROP_X, y: extra.ports.suction.y + 28 },
    ], 'suction')
  })

  const suctionChain = []
  if (acc.suctionFilter) {
    suctionChain.push(sym(symbols, 'suctionFilter', 460, SUCTION_Y - 14, 100, 28, {
      in: { x: 100, y: 14 },
      out: { x: 0, y: 14 },
    }, { group: 'unit', name: 'Imusuodatin', model: 'Imusuodatin', connection: suctionCode || '—' }))
  }
  if (acc.accumulator) {
    suctionChain.push(sym(symbols, 'accumulator', 320, SUCTION_Y - 52, 48, 104, {
      in: { x: 48, y: 52 },
      out: { x: 0, y: 52 },
    }, { group: 'unit', name: 'Imuakku', model: 'Pystysäiliö', connection: suctionCode || '—' }))
  }

  poly(lines, [evap.ports.suction, { x: evap.ports.suction.x, y: SUCTION_Y }], 'suction')
  let suctionCursor = { x: DROP_X, y: SUCTION_Y }
  suctionChain.forEach((item) => {
    poly(lines, [suctionCursor, item.ports.in], 'suction')
    suctionCursor = item.ports.out
  })
  const suctionRun = poly(lines, [suctionCursor, { x: SPINE, y: SUCTION_Y }], 'suction')
  tag(labels, suctionRun, suctionCode, 'suction', { x: 1040, y: SUCTION_Y - 20, rotate: false })

  if (acc.hpSwitch) {
    const pzh = sym(symbols, 'pressureSwitch', 236, remote ? 240 : 292, 36, 36, {
      tap: { x: 0, y: 18 },
      signal: { x: 36, y: 18 },
    }, { group: 'unit', name: 'Korkeapainepressostaatti', model: 'PZH', connection: dischargeCode || '—', tag: 'PZH' })
    poly(lines, [pzh.ports.tap, { x: SPINE, y: pzh.ports.tap.y }], 'capillary')
    across(lines, pzh.ports.signal, TRUNK, pzh.ports.signal.y, 'control', columnTop, trainY)
  }
  if (acc.lpSwitch) {
    const pzl = sym(symbols, 'pressureSwitch', 278, 688, 36, 36, {
      tap: { x: 18, y: 36 },
      signal: { x: 36, y: 18 },
    }, { group: 'unit', name: 'Matalapainepressostaatti', model: 'PZL', connection: suctionCode || '—', tag: 'PZL' })
    poly(lines, [pzl.ports.tap, { x: pzl.ports.tap.x, y: SUCTION_Y }], 'capillary')
    across(lines, pzl.ports.signal, TRUNK, pzl.ports.signal.y, 'control', columnTop, trainY)
  }

  const controller = acc.controller ? sym(symbols, 'controller', 840, 430, 150, 72, {
    bus: { x: 0, y: 36 },
    out: { x: 150, y: 36 },
  }, { group: 'room', name: 'Ohjauskeskus', model: 'TC', connection: 'Ohjaus', tag: 'TC' }) : null

  if (controller) {
    poly(lines, [{ x: TRUNK, y: remote ? 240 : 188 }, { x: TRUNK, y: 706 }], 'control')
    poly(lines, [{ x: TRUNK, y: controller.ports.bus.y }, controller.ports.bus], 'control')
  }
  const solenoid = train.find((item) => item.type === 'solenoid')
  if (solenoid) {
    const tapY = remote ? 320 : 200
    across(lines, solenoid.ports.coil, TRUNK, tapY, 'control', columnTop, trainY)
  }

  const heaters = []
  if (acc.defrostHeater) {
    heaters.push(sym(symbols, 'heater', 1040, 230, 140, 20, { in: { x: 0, y: 10 } }, {
      group: 'room', name: 'Sulatusvastus', model: 'Sähkö', connection: 'Ohjaus', tag: 'EH1',
    }))
  }
  if (acc.drainHeater) {
    heaters.push(sym(symbols, 'heater', 1040, 258, 140, 20, { in: { x: 0, y: 10 } }, {
      group: 'room', name: 'Valutusvastus', model: 'Sähkö', connection: 'Ohjaus', tag: 'EH2',
    }))
  }
  if (controller && heaters.length) {
    poly(lines, [controller.ports.out, { x: 1010, y: controller.ports.out.y }, { x: 1010, y: heaters[0].ports.in.y }, heaters[0].ports.in], 'control')
    if (heaters[1]) poly(lines, [{ x: 1110, y: heaters[0].y + heaters[0].h }, { x: 1110, y: heaters[1].y }], 'control')
  }

  if (acc.evapProbe) {
    const tt = sym(symbols, 'probe', 1260, 196, 32, 32, { tap: { x: 16, y: 0 } }, {
      group: 'room', name: 'Höyrystinanturi', model: 'TE', connection: 'Anturi', tag: 'TT1',
    })
    poly(lines, [tt.ports.tap, { x: tt.ports.tap.x, y: evap.ports.suction.y }], 'sensor')
  }
  if (acc.roomProbe) {
    const tt = sym(symbols, 'probe', 1480, 452, 32, 32, { tap: { x: 32, y: 16 } }, {
      group: 'room', name: 'Huoneanturi', model: 'TE', connection: 'Anturi', tag: 'TT2',
    })
    poly(lines, [tt.ports.tap, { x: tt.ports.tap.x + 48, y: tt.ports.tap.y }], 'sensor')
  }

  const parts = numberParts(symbols)
  separate(labels)

  return {
    width: SHEET_W,
    height: SHEET_H,
    remote,
    virtual: !!spec.virtual,
    title: spec.title,
    projectName: spec.projectName,
    refrigerant: spec.refrigerant,
    teC: spec.teC,
    tcC: spec.tcC,
    roomTempC: spec.roomTempC,
    capacityKw: spec.capacityKw || 0,
    duty: spec.mode || '',
    drawingNo: spec.drawingNo || 'KA-01',
    revision: spec.revision || 'A',
    designer: spec.designer || '',
    date: spec.date || '',
    note: 'NTS',
    sizingNote: 'Kuumakaasu seulottu 10 m vaakana, lämpötilaraja 1,1 K. Nousu tarkistetaan erikseen. Vastaanotinlinja on yhtä kokoa suurempi.',
    sizes,
    boxes,
    symbols,
    lines,
    labels,
    parts,
    legend: [
      { kind: 'discharge', label: 'Kuumakaasu' },
      { kind: 'liquid', label: 'Neste' },
      { kind: 'suction', label: 'Imu' },
      { kind: 'oil', label: 'Öljy' },
      { kind: 'control', label: 'Ohjaus' },
      { kind: 'sensor', label: 'Anturi' },
    ],
  }
}

const NUMBERED = [
  ['compressor', 'Kompressori'],
  ['oilSeparator', 'Öljynerotin'],
  ['condenser', 'Lauhdutin'],
  ['receiver', 'Vastaanotin'],
  ['filterDrier', 'Suodinkuivain'],
  ['sightGlass', 'Näkölasi'],
  ['solenoid', 'Magneettiventtiili'],
  ['txv', 'Paisuntaventtiili'],
  ['eev', 'Elektroninen paisuntaventtiili'],
  ['evaporator', 'Höyrystin'],
  ['suctionFilter', 'Imusuodatin'],
  ['accumulator', 'Imuakku'],
]

function numberParts(symbols) {
  const parts = []
  let n = 1
  NUMBERED.forEach(([type, name]) => {
    symbols.filter((item) => item.type === type).forEach((item) => {
      item.tag = String(n)
      item.name = name
      parts.push(row(item))
      n += 1
    })
  })
  symbols.filter((item) => !NUMBERED.some(([type]) => type === item.type)).forEach((item) => {
    parts.push(row(item))
  })
  return parts
}

function row(item) {
  return {
    tag: item.tag || '',
    name: item.name || item.label || item.type,
    model: item.model || '—',
    connection: item.connection || '—',
  }
}

function box(role, x, y, w, h, title) {
  return { id: role, role, x, y, w, h, title }
}

function sym(symbols, type, x, y, w, h, ports, extra) {
  const abs = {}
  Object.entries(ports || {}).forEach(([key, point]) => {
    abs[key] = { x: x + point.x, y: y + point.y }
  })
  const symbol = {
    id: `s${symbols.length}`,
    type, x, y, w, h, ports: abs,
    group: extra.group || 'unit',
    label: extra.name || type,
    name: extra.name || type,
    model: extra.model || '—',
    connection: extra.connection || '—',
    tag: extra.tag || '',
  }
  symbols.push(symbol)
  return symbol
}

function poly(lines, points, kind, extra = {}) {
  const clean = []
  points.forEach((point) => {
    if (!point) return
    const next = { x: Math.round(point.x), y: Math.round(point.y) }
    const last = clean[clean.length - 1]
    if (last && last.x === next.x && last.y === next.y) return
    clean.push(next)
  })
  if (clean.length < 2) return null
  const line = {
    id: `l${lines.length}`,
    points: clean,
    kind,
    label: '',
    labelPos: clean[0],
    endCap: extra.endCap || '',
  }
  lines.push(line)
  return line
}

function across(lines, from, toX, y, kind, columnTop, columnBottom) {
  const points = [{ x: from.x, y: from.y }]
  if (from.y !== y) points.push({ x: from.x, y })
  const low = Math.min(columnTop, columnBottom)
  const high = Math.max(columnTop, columnBottom)
  if (from.x < COLUMN && toX > COLUMN && y > low + 6 && y < high - 6) {
    points.push({ x: COLUMN - 16, y }, { x: COLUMN - 16, y: y - 14 }, { x: COLUMN + 16, y: y - 14 }, { x: COLUMN + 16, y })
  }
  points.push({ x: toX, y })
  return poly(lines, points, kind)
}

function tag(labels, line, text, kind, at) {
  if (!line || !text) return
  line.label = text
  line.labelPos = { x: at.x, y: at.y }
  labels.push({
    id: `b${labels.length}`,
    text,
    kind,
    x: at.x,
    y: at.y,
    w: at.rotate ? 16 : Math.max(52, text.length * 6.6),
    h: at.rotate ? Math.max(52, text.length * 6.6) : 16,
    rotate: !!at.rotate,
  })
}

function separate(labels) {
  for (let pass = 0; pass < 6; pass += 1) {
    let moved = false
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const a = labels[i]
        const b = labels[j]
        const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2
        const overlapY = Math.abs(a.y - b.y) < (a.h + b.h) / 2
        if (overlapX && overlapY) {
          b.y += a.h + 6
          moved = true
        }
      }
    }
    if (!moved) break
  }
}
