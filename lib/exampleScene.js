import { getTemplate } from './catalog.js'
import { createRoom, genId } from './geometry.js'
import { calculateProject } from './heatLoad.js'
import { defaultElevation, equipmentPorts } from './placement.js'
import { suggestPackage } from './selection.js'

function place(template, room, localX, localZ, extra = {}) {
  const eq = {
    id: genId(),
    catalogId: template.id,
    category: template.category,
    style: template.style || null,
    sensor: template.sensor || null,
    name: template.name,
    width: template.width,
    height: template.category === 'column' ? room.height : template.height,
    depth: template.depth,
    capacityKw: template.capacityKw || 0,
    fanW: template.fanW || 0,
    x: localX,
    z: localZ,
    rotation: extra.rotation || 0,
    wall: extra.wall || null,
    mount: extra.mount || null,
    elevation: null,
  }
  eq.mount = extra.mount || (template.category === 'evaporator' ? 'ceiling' : template.category === 'column' || template.category === 'rack' ? 'floor' : 'wall')
  eq.elevation = Number.isFinite(extra.elevation) ? extra.elevation : defaultElevation(room, eq)
  return eq
}

function tuneMass(room, rooms, targetKw) {
  let low = 0
  let high = 8000
  for (let i = 0; i < 14; i += 1) {
    const mid = (low + high) / 2
    room.load = { ...room.load, dailyMassKg: mid, pullDownEnabled: true }
    const result = calculateProject(rooms).rooms.find((item) => item.id === room.id)
    if (!result || result.total / 1000 < targetKw) low = mid
    else high = mid
  }
  room.load = { ...room.load, dailyMassKg: Math.round(high) }
}

export function decorateExample(coldRooms) {
  const parent = {
    ...coldRooms[0],
    equipment: coldRooms[0].equipment.map((eq) => ({ ...eq, style: eq.style || 'cubic', mount: 'ceiling', elevation: null })),
  }
  const child = {
    ...coldRooms[1],
    equipment: coldRooms[1].equipment.map((eq) => ({ ...eq })),
  }
  parent.equipment.forEach((eq) => {
    if (eq.category === 'evaporator') {
      eq.mount = 'ceiling'
      eq.elevation = defaultElevation(parent, eq)
      eq.style = 'cubic'
    }
    if (eq.category === 'door') {
      eq.mount = 'floor'
      eq.elevation = 0
    }
  })

  const slant = getTemplate('evap-slant-10')
  child.equipment = child.equipment.map((eq) => {
    if (eq.category !== 'evaporator') {
      return { ...eq, mount: 'floor', elevation: 0 }
    }
    const next = {
      ...eq,
      catalogId: slant.id,
      style: 'slant',
      name: slant.name,
      width: slant.width,
      height: slant.height,
      depth: slant.depth,
      capacityKw: slant.capacityKw,
      fanW: slant.fanW,
      mount: 'ceiling',
    }
    next.elevation = defaultElevation(child, next)
    return next
  })

  const list = [parent, child]
  const warehouse = createRoom({
    typeId: 'warehouse',
    x: parent.x - parent.width / 2 - 4,
    z: parent.z,
    width: 8,
    depth: parent.depth,
    height: 6,
    rooms: list,
  })
  warehouse.name = 'Varasto'
  warehouse.temp = 18
  const corridor = createRoom({
    typeId: 'corridor',
    x: parent.x,
    z: parent.z + parent.depth / 2 + 1.5,
    width: parent.width,
    depth: 3,
    rooms: [...list, warehouse],
  })
  corridor.name = 'Käytävä'
  const plant = createRoom({
    typeId: 'plant',
    x: parent.x + parent.width / 2 + 2.6,
    z: parent.z + 0.4,
    width: 5.2,
    depth: 6,
    height: 4,
    rooms: [...list, warehouse, corridor],
  })
  plant.name = 'Konehuone'
  const office = createRoom({
    typeId: 'office',
    x: warehouse.x,
    z: warehouse.z + warehouse.depth / 2 + 1.6,
    width: 6,
    depth: 3.2,
    rooms: [...list, warehouse, corridor, plant],
  })
  office.name = 'Toimisto'
  const dock = createRoom({
    typeId: 'dock',
    x: warehouse.x - warehouse.width / 2 - 3,
    z: warehouse.z + 1,
    width: 6,
    depth: 5,
    height: 5,
    rooms: [...list, warehouse, corridor, plant, office],
  })
  dock.name = 'Lastauslaituri'
  const yard = createRoom({
    typeId: 'yard',
    x: parent.x + 1,
    z: corridor.z + corridor.depth / 2 + 2.2,
    width: 18,
    depth: 4.4,
    rooms: [...list, warehouse, corridor, plant, office, dock],
  })
  yard.name = 'Ulkoalue'
  const sample = createRoom({
    typeId: 'chilled',
    x: warehouse.x,
    z: warehouse.z - warehouse.depth / 2 - 1.5,
    width: 2.8,
    depth: 2.6,
    height: 2.6,
    rooms: [...list, warehouse, corridor, plant, office, dock, yard],
  })
  sample.name = 'Näytehuone'
  sample.equipment = [place(getTemplate('evap-2'), sample, 0, -0.1, { mount: 'ceiling' })]

  const column = getTemplate('column-400')
  warehouse.equipment = [
    place(column, warehouse, -1.6, -1.4),
    place(column, warehouse, 1.6, 1.2),
  ]

  const rooms = [parent, child, warehouse, corridor, plant, office, dock, yard, sample]
  tuneMass(sample, rooms, 2)

  const project = calculateProject(rooms)
  const parentLoad = project.rooms.find((room) => room.id === parent.id)
  const pack = suggestPackage(parentLoad?.total || 10000, {
    refrigerant: 'R449A',
    teC: -8,
    tcC: 40,
    lengthM: 16,
    riseM: 4,
  })
  const comboTpl = pack.combo || getTemplate('unit-8')
  const condTpl = pack.condenser || getTemplate('cond-15')
  const compTpl = pack.compressor || getTemplate('comp-8')
  parent.equipment.push(place(comboTpl, parent, parent.width / 2 + comboTpl.depth / 2 + 0.08, 0.2, {
    mount: 'wall',
    rotation: 270,
    elevation: 1.35,
  }))
  plant.equipment = [
    place(condTpl, plant, -0.2, -1.3, { mount: 'floor', elevation: 0, rotation: 0 }),
    place(compTpl, plant, 0.4, 1.1, { mount: 'floor', elevation: 0, rotation: 0 }),
  ]

  const sensorRoom = getTemplate('sensor-room')
  const sensorEvap = getTemplate('sensor-evap')
  const sensorDefrost = getTemplate('sensor-defrost')
  const sensorDoor = getTemplate('sensor-door')
  const controller = getTemplate('controller')
  parent.equipment.push(
    place(controller, parent, -parent.width / 2 + 0.55, 1.4, { mount: 'wall', elevation: 1.45 }),
    place(sensorRoom, parent, -0.4, -1.2, { mount: 'wall', elevation: 1.6 }),
    place(sensorEvap, parent, -3.2, 0.4, { mount: 'ceiling' }),
    place(sensorDoor, parent, -2.9, parent.depth / 2 - 0.35, { mount: 'wall', elevation: 1.15 }),
  )
  child.equipment.push(place(sensorDefrost, child, 0.2, -0.9, { mount: 'ceiling' }))

  const evap = parent.equipment.find((eq) => eq.catalogId === 'evap-20')
  const unit = parent.equipment.find((eq) => eq.category === 'combo' || eq.category === 'unit')
  const freezerEvap = child.equipment.find((eq) => eq.category === 'evaporator')
  const evapPorts = equipmentPorts(parent, evap)
  const unitPorts = equipmentPorts(parent, unit)
  const drainPort = equipmentPorts(child, freezerEvap).drain
  const suction = [
    evapPorts.suction,
    { x: evapPorts.suction.x, z: unitPorts.suction.z },
    unitPorts.suction,
  ]
  const liquid = [
    evapPorts.liquid,
    { x: evapPorts.liquid.x, z: unitPorts.liquid.z },
    unitPorts.liquid,
  ]
  const drain = [
    drainPort,
    { x: drainPort.x, z: parent.z + parent.depth / 2 + 0.8 },
  ]
  const pipes = [
    { id: 'ex-suction', kind: 'suction', points: suction, refrigerant: 'R449A', teC: -8, tcC: 40, riseM: 4, roomTempC: parent.temp },
    { id: 'ex-liquid', kind: 'liquid', points: liquid, refrigerant: 'R449A', teC: -8, tcC: 40, riseM: 0, roomTempC: parent.temp },
    { id: 'ex-drain', kind: 'drain', points: drain, refrigerant: 'R449A', teC: -28, tcC: 40, riseM: 0, roomTempC: child.temp },
  ]
  const control = parent.equipment.find((eq) => eq.category === 'controller')
  const origin = { x: parent.x + control.x, z: parent.z + control.z }
  const cables = parent.equipment.filter((eq) => eq.category === 'sensor').map((eq, index) => ({
    id: `ex-cable-${index}`,
    points: [
      { x: parent.x + eq.x, z: parent.z + eq.z },
      { x: parent.x + eq.x, z: origin.z },
      origin,
    ],
  }))
  cables.push({
    id: 'ex-cable-defrost',
    points: [
      { x: child.x + child.equipment.find((eq) => eq.sensor === 'defrost').x, z: child.z + child.equipment.find((eq) => eq.sensor === 'defrost').z },
      { x: child.x, z: origin.z },
      origin,
    ],
  })
  return { rooms, pipes, cables }
}
