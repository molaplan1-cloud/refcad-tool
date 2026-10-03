import test from 'node:test'
import assert from 'node:assert/strict'
import { coolingInput, coolingLoad } from './cooling.js'
import { coverBill, coverMembers, coverOverhang, normalizeCover, roofLook } from './covers.js'
import { exampleHouse, materialsList } from './floorplan.js'
import { addCover, deleteYardItem, ensureYard, hitTestYard } from './yard.js'

const wall = { id: 'w1', kind: 'exterior', a: { x: 0, z: 0 }, b: { x: 6, z: 0 } }
const rectangle = [
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 3 },
  { x: 0, z: 3 },
]
const opening = { id: 'o1', kind: 'window', wallId: 'w1', offset: 3, width: 1.4, height: 1.4, sill: 0.9 }

test('a cover keeps its type, frame and a transparent polycarbonate roof', () => {
  const item = normalizeCover({ kind: 'pergola', points: rectangle })
  assert.equal(item.kind, 'pergola')
  assert.equal(item.frame, 'wood')
  assert.equal(item.height, 2.4)
  assert.equal(item.attached, false)
  const clear = roofLook({ roofing: 'polycarbonate', roofTint: 'clear' })
  const opal = roofLook({ roofing: 'polycarbonate', roofTint: 'opal' })
  assert.equal(clear.transparent, true)
  assert.ok(clear.opacity < 0.4)
  assert.ok(opal.opacity > clear.opacity)
  const porch = normalizeCover({ kind: 'glass-porch' })
  assert.equal(porch.sides, 'glazing')
  assert.equal(porch.roofing, 'glass')
  assert.equal(porch.glassKind, 'laminated')
})

test('posts and rafters follow the footprint and skip the attached wall', () => {
  const item = normalizeCover({ kind: 'terrace-roof', points: rectangle, wallId: 'w1', roofing: 'polycarbonate' })
  const members = coverMembers(item, wall)
  assert.ok(members.posts.length >= 3)
  assert.ok(members.posts.some((post) => post.z > 2 && post.x > 2 && post.x < 4))
  assert.ok(members.posts.every((post) => post.z > 0.2))
  assert.ok(members.rafters.length >= 3)
  assert.ok(members.beams.length >= 3)
  assert.equal(members.roof.length, 4)
  assert.ok(members.roof.some((point) => point.y > item.height))
})

test('an attached cover shades the windows in front of it', () => {
  const cover = { id: 'c1', kind: 'terrace-roof', wallId: 'w1', points: rectangle, height: 2.5, roofing: 'polycarbonate', roofTint: 'clear' }
  const plan = { walls: [wall], openings: [opening], yard: { covers: [cover] } }
  const shade = coverOverhang(plan, wall, opening)
  assert.ok(shade.depth > 1)
  const free = coverOverhang({ yard: { covers: [{ ...cover, wallId: '' }] } }, wall, opening)
  assert.equal(free, null)
  const report = {
    floorArea: 20,
    ceilingArea: 20,
    type: 'olohuone',
    heat: { setpoint: 21 },
    walls: [],
    windows: [{ id: 'o1', area: 6, height: 1.5, u: 1.1, g: 0.63, frameFraction: 0.18, bearing: 180, shading: 'none' }],
  }
  const shaded = coolingLoad(coolingInput(plan, report))
  const open = coolingLoad(coolingInput({ ...plan, yard: { covers: [] } }, report))
  const standing = coolingLoad(coolingInput({ ...plan, yard: { covers: [{ ...cover, wallId: '' }] } }, report))
  assert.ok(coolingInput(plan, report).windows[0].coverDepth > 1)
  assert.ok(shaded.watts < open.watts)
  assert.equal(shaded.overheat, false)
  assert.equal(open.overheat, true)
  assert.ok(Math.abs(standing.watts - open.watts) < 1)
})

test('cover lights and heaters become outdoor electrical devices and a BOM row', () => {
  let plan = addCover(exampleHouse(), [
    { x: 20, z: 20 },
    { x: 26, z: 20 },
    { x: 26, z: 24 },
    { x: 20, z: 24 },
  ], { kind: 'pergola', lights: true, heaters: true, roofing: 'polycarbonate' })
  const cover = plan.yard.covers[0]
  assert.equal(cover.roofing, 'polycarbonate')
  assert.equal(cover.attached, false)
  const nodes = plan.services.nodes.filter((node) => String(node.linkedFrom || '').startsWith(`yard:cover:${cover.id}`))
  assert.ok(nodes.some((node) => node.kind === 'light' && node.outdoor && node.ip === 'IP65' && node.voltage === 230))
  assert.ok(nodes.some((node) => node.kind === 'patio-heater' && node.voltage === 230 && node.power === 2000 && node.dedicated))
  const listed = materialsList(plan)
  assert.ok(listed.some((row) => row.group === 'cover' && row.area > 20 && /Kennolevy/.test(row.name)))
  assert.ok(listed.some((row) => row.groupLabel === 'Katto' && row.name === 'Pelti'))
  assert.ok(coverBill(plan)[0].area > 20)
  const hit = hitTestYard(plan, { x: 23, z: 22 })
  assert.equal(hit.collection, 'covers')
  plan = deleteYardItem(plan, 'covers', cover.id)
  assert.equal(ensureYard(plan).covers.length, 0)
  assert.equal(plan.services.nodes.filter((node) => String(node.linkedFrom || '').startsWith('yard:cover:')).length, 0)
})
