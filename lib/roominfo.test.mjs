import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addFixture,
  addWall,
  applyRoomType,
  emptyPlan,
  faceSide,
  materialsList,
  resolveFaceMaterial,
  setFaceMaterial,
  updateFixture,
  updateRoom,
} from './floorplan.js'
import { buildPlanPdf, formatRoomInfo, heatingLoads, referenceThermal, roomReport } from './roominfo.js'

function twoRooms() {
  let plan = emptyPlan('Jaettu')
  const outer = [[0, 0], [8, 0], [8, 6], [0, 6], [0, 0]]
  for (let i = 0; i < outer.length - 1; i += 1) {
    plan = addWall(plan, { x: outer[i][0], z: outer[i][1] }, { x: outer[i + 1][0], z: outer[i + 1][1] }, 'exterior')
  }
  plan = addWall(plan, { x: 4, z: 0 }, { x: 4, z: 6 }, 'interior')
  const left = plan.rooms.find((room) => room.cx < 4)
  const right = plan.rooms.find((room) => room.cx > 4)
  plan = updateRoom(plan, right.id, { name: 'Makuuhuone', type: 'makuuhuone', interiorId: 'wallpaper', floorId: 'parquet' })
  plan = applyRoomType(plan, left.id, 'autotalli', 'Autotalli')
  return plan
}

test('a shared wall keeps an independent finish on each face and a separate structure', () => {
  let plan = twoRooms()
  const wall = plan.walls.find((item) => item.kind === 'interior')
  const garage = plan.rooms.find((room) => room.name === 'Autotalli')
  const bedroom = plan.rooms.find((room) => room.name === 'Makuuhuone')
  const garageEdge = garage.walls.find((edge) => edge.wallId === wall.id)
  const garageSide = faceSide(wall, garageEdge.a, garageEdge.b)
  const bedroomSide = garageSide === 'left' ? 'right' : 'left'
  assert.equal(wall.structure, 'ei30')
  assert.equal(resolveFaceMaterial(plan, wall, garageSide), 'gypsum')
  assert.equal(resolveFaceMaterial(plan, wall, bedroomSide), 'wallpaper')
  plan = setFaceMaterial(plan, wall.id, garageSide, 'concrete-paint')
  const shared = plan.walls.find((item) => item.id === wall.id)
  assert.equal(resolveFaceMaterial(plan, shared, garageSide), 'concrete-paint')
  assert.equal(resolveFaceMaterial(plan, shared, bedroomSide), 'wallpaper')
  const garageInfo = roomReport(plan, plan.rooms.find((room) => room.name === 'Autotalli'))
  const bedroomInfo = roomReport(plan, plan.rooms.find((room) => room.name === 'Makuuhuone'))
  const sharedGarage = garageInfo.walls.find((item) => item.wallId === shared.id)
  const sharedBedroom = bedroomInfo.walls.find((item) => item.wallId === shared.id)
  assert.equal(sharedGarage.materialName, 'Maalattu betoni')
  assert.equal(sharedBedroom.materialName, 'Tapetti')
  assert.equal(sharedGarage.structureName, 'EI30')
  assert.ok(sharedGarage.net > 10)
  assert.ok(Math.abs(sharedGarage.net - sharedBedroom.net) < 0.2)
  const rows = materialsList(plan)
  const garageRow = rows.find((row) => row.roomName === 'Autotalli' && row.name === 'Maalattu betoni')
  const bedroomRow = rows.find((row) => row.roomName === 'Makuuhuone' && row.name === 'Tapetti')
  assert.ok(garageRow.area > 10)
  assert.ok(bedroomRow.area > 10)
  assert.equal(garage.floorId, 'concrete')
  assert.equal(garageInfo.heat.setpoint, 5)
  assert.equal(bedroomInfo.heat.setpoint, 21)
  assert.ok(bedroomInfo.heat.parts.some((part) => part.id === 'partition' && part.watts > 10))
  const text = formatRoomInfo(bedroomInfo)
  assert.ok(text.includes('Huoneen tiedot'))
  assert.ok(text.includes('Lämmitystarve'))
  assert.ok(text.includes('Tapetti'))
  const loads = heatingLoads(plan)
  assert.equal(loads.length, 2)
  assert.ok(loads.every((row) => row.watts > 0 && row.wattsPerM2 > 0))
})

test('heating defaults follow the climate zone, year and energy class', () => {
  const modern = referenceThermal({ year: 2020, energyClass: 'C' })
  const old = referenceThermal({ year: 1970, energyClass: 'C' })
  const passive = referenceThermal({ year: 2020, energyClass: 'A' })
  assert.ok(modern.wall < old.wall)
  assert.ok(passive.wall < modern.wall)
  assert.equal(modern.window, 1)
  const plan = twoRooms()
  const bedroom = roomReport({ ...plan, thermal: { zone: 'IV', year: 2020, energyClass: 'C' } }, plan.rooms.find((room) => room.name === 'Makuuhuone'))
  assert.equal(bedroom.heat.outdoor, -38)
  assert.ok(bedroom.heat.watts > 500)
  const doc = buildPlanPdf(plan)
  const raw = doc.output()
  assert.ok(raw.includes('Huoneen tiedot'))
  assert.ok(raw.includes('Lammitystarve'))
  assert.ok(raw.includes('Autotalli'))
  assert.ok(raw.includes('Makuuhuone'))
})

test('a non-storing fireplace is instant heat and a storing one is not', () => {
  const plan = twoRooms()
  const bedroom = plan.rooms.find((room) => room.name === 'Makuuhuone')
  const before = roomReport(plan, bedroom).heat.watts
  let open = addFixture(plan, 'insert', 6, 3, 0)
  const openReport = roomReport(open, bedroom)
  const credit = openReport.heat.parts.find((part) => part.id === 'wood')
  assert.equal(credit.watts, -7000)
  assert.equal(credit.storing, false)
  assert.equal(openReport.heat.watts, Math.max(0, before - 7000))
  assert.ok(formatRoomInfo(openReport).includes('Puulämpö, hetkellinen'))
  open = updateFixture(open, open.fixtures.find((item) => item.type === 'insert').id, { heatKw: 1.5 })
  assert.equal(roomReport(open, bedroom).heat.parts.find((part) => part.id === 'wood').watts, -1500)

  const mass = addFixture(plan, 'fireplace', 6, 3, 0)
  const massReport = roomReport(mass, bedroom)
  assert.equal(massReport.heat.parts.some((part) => part.id === 'wood'), false)
  assert.equal(massReport.heat.watts, before)

  const stove = addFixture(plan, 'kamiina', 6, 3, 0)
  assert.equal(roomReport(stove, bedroom).heat.parts.find((part) => part.id === 'wood').watts, -6000)
})
