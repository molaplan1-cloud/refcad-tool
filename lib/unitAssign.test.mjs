import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateProject } from './heatLoad.js'
import { buildPdf } from './pdfExport.js'
import { autoCircuit } from './pipeTopology.js'
import {
  assignAllToOne,
  assignEachOwn,
  assignOwnUnit,
  assignRooms,
  createUnit,
  groupUnits,
  pickUnitModel,
} from './coldUnits.js'

const load = { safetyFactor: 1, productId: 'generic', dailyMassKg: 0, doorOpeningsPerDay: 0, people: 0, lightsWPerM2: 0, fansW: 0, defrostW: 0, pullDown: false }

function room(id, label, temp, x) {
  return {
    id, type: temp < 0 ? 'frozen' : 'chilled', name: label, label, temp, x, z: 0,
    width: 4, depth: 3, height: 3, wallThickness: 0.1,
    uWall: 0.3, uCeiling: 0.25, uFloor: 0.35,
    equipment: [{ id: `ev-${id}`, category: 'evaporator', name: `Evap ${label}`, capacityKw: 2, style: 'slant', width: 1.2, depth: 0.5, height: 0.4, mount: 'ceiling', elevation: 2.2, x: 0, z: 0 }],
    load,
  }
}

test('logical units assign a mix without placing a symbol', () => {
  const rooms = [room('a', 'J1', 2, 0), room('b', 'J2', 2, 4), room('c', 'J3', -18, 8), room('d', 'J4', 4, 12)]
  const before = rooms.map((item) => item.equipment.length)
  const first = createUnit([])
  assert.equal(first.unit.name, 'K1')
  const shared = assignRooms(rooms, ['a', 'b'], first.unit.id)
  const ownC = assignOwnUnit(shared, first.units, 'c')
  const ownD = assignOwnUnit(ownC.rooms, ownC.units, 'd')
  assert.deepEqual(ownD.units.map((unit) => unit.name), ['K1', 'K2', 'K3'])
  assert.equal(ownD.rooms.find((item) => item.id === 'a').unitId, first.unit.id)
  assert.equal(ownD.rooms.find((item) => item.id === 'b').unitId, first.unit.id)
  assert.notEqual(ownD.rooms.find((item) => item.id === 'c').unitId, first.unit.id)
  assert.notEqual(ownD.rooms.find((item) => item.id === 'd').unitId, ownD.rooms.find((item) => item.id === 'c').unitId)
  assert.deepEqual(ownD.rooms.map((item) => item.equipment.length), before)

  const result = calculateProject(ownD.rooms)
  const board = groupUnits(ownD.rooms, result, { units: ownD.units, diversity: 0.8 })
  const k1 = board.groups.find((group) => group.machine?.name === 'K1')
  assert.equal(k1.rooms.length, 2)
  assert.ok(k1.plusKw > 0)
  assert.equal(k1.minusKw, 0)
  assert.ok(k1.plusKw < k1.rooms.reduce((sum, item) => sum + item.kw, 0))
  assert.ok(k1.suggested)
  const picked = pickUnitModel(ownD.units, first.unit.id, k1.suggested.id)
  const chosen = groupUnits(ownD.rooms, result, { units: picked, diversity: 0.8 }).groups.find((group) => group.machine.name === 'K1')
  assert.equal(chosen.chosen.id, k1.suggested.id)
  const frozen = board.groups.find((group) => group.rooms.some((item) => item.id === 'c'))
  assert.ok(frozen.minusKw > 0)
  assert.equal(frozen.rooms.length, 1)
  const pdf = buildPdf({ projectName: 'Koneikot', rooms: ownD.rooms, schematic: { units: picked, diversity: 0.8 } })
  const raw = pdf.output()
  assert.match(raw, /K1/)
  assert.match(raw, /K2/)
  assert.match(raw, /K3/)
})

test('all rooms can share one unit and each room can have its own', () => {
  const rooms = [room('a', 'J1', 2, 0), room('b', 'J2', 2, 4), room('c', 'J3', 2, 8)]
  const all = assignAllToOne(rooms, [])
  assert.equal(all.units.length, 1)
  assert.equal(all.units[0].name, 'K1')
  assert.ok(all.rooms.every((item) => item.unitId === all.units[0].id))
  const each = assignEachOwn(all.rooms, all.units)
  assert.equal(each.units.length, 3)
  assert.equal(new Set(each.rooms.map((item) => item.unitId)).size, 3)
  const again = assignEachOwn(each.rooms, each.units)
  assert.equal(again.units.length, 3)
})

test('autopipe follows the placed symbol bound to the logical unit', () => {
  const cold = room('a', 'J1', 2, 0)
  const other = room('b', 'J2', 2, 4)
  const plant = {
    id: 'plant', type: 'plant', name: 'Konehuone', label: 'M1', temp: 20, x: 12, z: 0,
    width: 6, depth: 4, height: 3, wallThickness: 0.1, equipment: [
      { id: 'near', category: 'combo', name: 'Near', x: 0.4, z: 0, width: 1.1, depth: 0.6, height: 0.8, capacityKw: 8, mount: 'floor', elevation: 0, rotation: 0 },
      { id: 'far', category: 'combo', name: 'Far', x: 4.2, z: 0, width: 1.1, depth: 0.6, height: 0.8, capacityKw: 8, mount: 'floor', elevation: 0, rotation: 0 },
    ],
    load: {},
  }
  const units = [
    { id: 'k1', name: 'K1', catalogId: null, placedId: 'far' },
    { id: 'k2', name: 'K2', catalogId: null, placedId: 'near' },
  ]
  const rooms = [
    { ...cold, unitId: 'k1' },
    { ...other, unitId: 'k2' },
    plant,
  ]
  let n = 0
  const piped = autoCircuit(rooms, { units, id: () => `p${n++}` })
  assert.equal(piped.ok, true)
  const suction = piped.pipes.filter((pipe) => pipe.kind === 'suction')
  assert.equal(suction.find((pipe) => pipe.fromName === 'Evap J1').toName, 'Far')
  assert.equal(suction.find((pipe) => pipe.fromName === 'Evap J2').toName, 'Near')
  assert.equal(rooms[0].equipment.some((eq) => eq.category === 'combo'), false)
})
