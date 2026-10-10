import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyPlan, exampleHouse, familyHouse, planBounds, planDimensions, pointInPolygon, viewLayout, visibleRooms } from './floorplan.js'
import {
  addServiceNode,
  addServiceRun,
  airflowBalance,
  acceptEquipment,
  autoRoute,
  autoRouteAll,
  designServices,
  buildServicePdf,
  circuitList,
  deleteServiceRun,
  ductSize,
  ensureServices,
  hitService,
  layerVisible,
  partsList,
  roomKind,
  serviceHeight,
  serviceMenuSpec,
  serviceSheet,
  applyHeating,
  rewireHeat,
  manifoldCallouts,
  setServiceLayer,
  snapServicePoint,
  suggestAirflows,
} from './services.js'

function flows(list, role) {
  return list.filter((item) => item.role === role).reduce((sum, item) => sum + item.flow, 0)
}

test('room kinds follow the Finnish name when the stored type is generic', () => {
  assert.equal(roomKind({ name: 'Keittiö', type: 'huone' }), 'keittio')
  assert.equal(roomKind({ name: 'WC', type: 'huone' }), 'wc')
  assert.equal(roomKind({ type: 'makuuhuone', name: 'Huone 2' }), 'makuuhuone')
  assert.equal(roomKind({ name: 'Eteinen' }), 'eteinen')
})

test('duct diameter steps at 15, 30 and 60 l/s', () => {
  assert.equal(ductSize(8), 100)
  assert.equal(ductSize(15), 100)
  assert.equal(ductSize(16), 125)
  assert.equal(ductSize(30), 125)
  assert.equal(ductSize(31), 160)
  assert.equal(ductSize(60), 160)
  assert.equal(ductSize(61), 200)
  assert.equal(ductSize(120), 200)
})

test('D2 airflows put supply in living and bedrooms and extract in wet rooms', () => {
  const house = exampleHouse()
  const valves = suggestAirflows(house)
  const kitchen = valves.filter((item) => item.roomKind === 'keittio')
  assert.equal(kitchen.length, 1)
  assert.equal(kitchen[0].kind, 'hood')
  assert.equal(kitchen[0].flow, 25)
  assert.equal(kitchen[0].role, 'poisto')
  const wc = valves.find((item) => item.roomKind === 'wc')
  assert.equal(wc.role, 'poisto')
  assert.equal(wc.flow, 10)
  const bed = valves.find((item) => item.roomKind === 'makuuhuone')
  assert.equal(bed.role, 'tulo')
  assert.ok(bed.flow === 8 || bed.flow === 12)
  const living = valves.find((item) => item.roomKind === 'olohuone')
  assert.equal(living.role, 'tulo')
  assert.ok(living.flow >= 8)
  const sauna = valves.filter((item) => item.roomKind === 'sauna')
  assert.equal(sauna.length, 2)
  assert.equal(sauna[0].flow, sauna[1].flow)
  assert.ok(Math.abs(flows(valves, 'tulo') - flows(valves, 'poisto')) <= 1.5)
  const family = suggestAirflows(familyHouse())
  assert.equal(family.filter((item) => item.roomKind === 'eteinen').length, 0)
  assert.ok(Math.abs(flows(family, 'tulo') - flows(family, 'poisto')) <= 1.5)
})

test('auto-route draws a balanced ventilation system with four duct colours', () => {
  const source = exampleHouse()
  const before = JSON.stringify(source)
  const placed = acceptEquipment(source, 'iv')
  const beforeNodes = JSON.stringify(placed.services.nodes)
  const plan = autoRoute(placed, 'iv')
  assert.equal(JSON.stringify(plan.services.nodes), beforeNodes)
  assert.equal(JSON.stringify(source), before)
  const nodes = plan.services.nodes.filter((item) => item.system === 'iv')
  const runs = plan.services.runs.filter((item) => item.system === 'iv')
  assert.ok(nodes.some((item) => item.kind === 'ahu'))
  assert.ok(nodes.filter((item) => item.kind === 'silencer').length >= 2)
  assert.ok(nodes.some((item) => item.kind === 'hood' && item.flow === 25))
  ;['tulo', 'poisto', 'ulko', 'jate'].forEach((kind) => {
    assert.ok(runs.some((item) => item.kind === kind), kind)
  })
  const y = serviceHeight(plan, 'iv')
  assert.ok(runs.filter((item) => item.kind !== 'jate' || true).every((item) => item.points.every((point) => Math.abs(point.y - y) < 0.02)))
  nodes.filter((item) => item.kind === 'valve' || item.kind === 'hood').forEach((node) => {
    assert.equal(node.size, ductSize(node.flow))
  })
  const trunk = runs.find((item) => item.kind === 'tulo' && item.role === 'trunk')
  const extract = runs.find((item) => item.kind === 'poisto' && item.role === 'trunk')
  assert.equal(trunk.size, ductSize(trunk.flow))
  assert.ok(trunk.flow > 0)
  assert.equal(extract.size, ductSize(extract.flow))
  const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
  const interior = (points) => points[Math.min(1, points.length - 1)]
  assert.ok(gap(trunk.points[0], extract.points[0]) < 0.05)
  assert.ok(gap(interior(trunk.points), interior(extract.points)) > 0.2)
  const box = planBounds(plan)
  const outdoor = runs.find((item) => item.kind === 'ulko')
  assert.ok(outdoor.points.some((point) => point.z < box.minZ - 0.2 || point.x < box.minX - 0.2 || point.x > box.maxX + 0.2))
  const balance = airflowBalance(nodes)
  assert.ok(Math.abs(balance.delta) <= 1.5)
  assert.ok(balance.supply > 20)
})

function touches(point, run, tol = 0.08) {
  const points = run.points || []
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / len2))
    if (Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t)) <= tol) return true
  }
  return false
}

function reachesDevice(start, goal, runs) {
  const seen = new Set()
  const queue = []
  runs.forEach((run, index) => {
    if (touches(start, run)) queue.push(index)
  })
  while (queue.length) {
    const index = queue.pop()
    if (seen.has(index)) continue
    seen.add(index)
    const run = runs[index]
    if (touches(goal, run)) return true
    runs.forEach((other, otherIndex) => {
      if (seen.has(otherIndex)) return
      const joined = (other.points || []).some((point) => touches(point, run))
      if (joined) queue.push(otherIndex)
    })
  }
  return false
}

function wallHits(a, b, wall) {
  const rx = b.x - a.x
  const rz = b.z - a.z
  const sx = wall.b.x - wall.a.x
  const sz = wall.b.z - wall.a.z
  const den = rx * sz - rz * sx
  if (Math.abs(den) < 1e-7) return null
  const t = ((wall.a.x - a.x) * sz - (wall.a.z - a.z) * sx) / den
  const u = ((wall.a.x - a.x) * rz - (wall.a.z - a.z) * rx) / den
  if (t <= 0.04 || t >= 0.96 || u <= 0.02 || u >= 0.98) return null
  const len = Math.hypot(sx, sz) || 1
  const ux = sx / len
  const uz = sz / len
  const dlen = Math.hypot(rx, rz) || 1
  return {
    dot: Math.abs((rx / dlen) * ux + (rz / dlen) * uz),
    endClear: Math.min(u, 1 - u) * len,
    x: a.x + rx * t,
    z: a.z + rz * t,
    wall,
  }
}

test('IV auto-route is one tree per system, with every valve connected and ducts sized from the flow', () => {
  const placed = acceptEquipment(exampleHouse(), 'iv')
  const nodesBefore = JSON.stringify(placed.services.nodes)
  const plan = autoRoute(placed, 'iv')
  assert.equal(JSON.stringify(plan.services.nodes), nodesBefore)
  const nodes = plan.services.nodes.filter((item) => item.system === 'iv')
  const runs = plan.services.runs.filter((item) => item.system === 'iv')
  const ahu = nodes.find((item) => item.kind === 'ahu')
  const valves = nodes.filter((item) => item.kind === 'valve' || item.kind === 'hood')
  valves.forEach((valve) => {
    const same = runs.filter((run) => run.kind === (valve.kind === 'hood' ? 'poisto' : valve.role))
    assert.equal(reachesDevice(valve, ahu, same), true, `${valve.kind} ${valve.role} reaches the unit`)
    const touching = same.filter((run) => touches(valve, run))
    assert.ok(touching.some((run) => run.flow + 0.1 >= valve.flow), `${valve.role} duct carries the valve flow`)
  })
  const devices = nodes.filter((item) => ['ahu', 'valve', 'hood', 'outdoor-terminal', 'exhaust-terminal'].includes(item.kind))
  runs.forEach((run) => {
    assert.ok([100, 125, 160, 200].includes(run.size), `size ${run.size}`)
    assert.equal(run.size, ductSize(run.flow))
    const ends = [run.points[0], run.points[run.points.length - 1]]
    ends.forEach((end) => {
      const onDevice = devices.some((device) => Math.hypot(device.x - end.x, device.z - end.z) <= 0.08)
      const onDuct = runs.some((other) => other !== run && touches(end, other))
      assert.equal(onDevice || onDuct, true, `${run.kind} ${run.role} end is connected`)
    })
    for (let i = 1; i < run.points.length; i += 1) {
      const dx = Math.abs(run.points[i].x - run.points[i - 1].x)
      const dz = Math.abs(run.points[i].z - run.points[i - 1].z)
      assert.ok(dx < 0.03 || dz < 0.03, 'ducts stay orthogonal')
      ;(plan.walls || []).forEach((wall) => {
        const hit = wallHits(run.points[i - 1], run.points[i], wall)
        if (!hit) return
        assert.ok(hit.dot < 0.25, 'a duct crosses a wall perpendicularly')
        const door = (plan.openings || []).find((opening) => (
          opening.wallId === wall.id
          && opening.kind !== 'window'
          && Math.hypot(
            wall.a.x + ((wall.b.x - wall.a.x) * (opening.offset / (Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) || 1))) - hit.x,
            wall.a.z + ((wall.b.z - wall.a.z) * (opening.offset / (Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) || 1))) - hit.z,
          ) < 0.45
        ))
        assert.equal(hit.endClear > 0.15 || Boolean(door), true, 'a duct does not cut a wall corner')
      })
    }
  })
  const supply = runs.filter((run) => run.kind === 'tulo')
  const extract = runs.filter((run) => run.kind === 'poisto')
  const rootSupply = supply.find((run) => run.role === 'trunk')
  const rootExtract = extract.find((run) => run.role === 'trunk')
  assert.equal(rootSupply.flow, valves.filter((item) => item.role === 'tulo').reduce((sum, item) => sum + item.flow, 0))
  assert.equal(rootExtract.flow, valves.filter((item) => item.role === 'poisto' || item.kind === 'hood').reduce((sum, item) => sum + item.flow, 0))
  const mid = (run) => {
    const pts = run.points
    let best = null
    for (let i = 1; i < pts.length; i += 1) {
      const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
      if (!best || len > best.len) best = { x: (pts[i].x + pts[i - 1].x) / 2, z: (pts[i].z + pts[i - 1].z) / 2, len }
    }
    return best
  }
  supply.forEach((run) => {
    const point = mid(run)
    if (!point || point.len < 0.3) return
    extract.forEach((other) => {
      assert.equal(touches(point, other, 0.05), false, 'supply and exhaust do not share a centerline')
    })
  })
  const hall = visibleRooms(familyHouse()).find((room) => roomKind(room) === 'eteinen')
  const family = autoRoute(acceptEquipment(familyHouse(), 'iv'), 'iv')
  const hallTrunk = family.services.runs.filter((run) => run.system === 'iv' && run.role === 'trunk' && (run.kind === 'tulo' || run.kind === 'poisto'))
  const inside = hallTrunk.some((run) => (run.points || []).some((point) => pointInPolygon(point.x, point.z, hall.polygon)))
  assert.equal(inside, true)

  let again = plan
  const drawn = addServiceRun(again, {
    system: 'iv',
    kind: 'tulo',
    role: 'branch',
    size: 100,
    flow: 8,
    points: [{ x: 0.4, y: 2.3, z: 0.4 }, { x: 1.6, y: 2.3, z: 0.4 }],
  })
  const hand = drawn.services.runs[drawn.services.runs.length - 1]
  assert.equal(hand.manual, true)
  const handPoints = hand.points.map((point) => ({ ...point }))
  const beforeIds = new Set(drawn.services.runs.filter((run) => run.system === 'iv' && run.id !== hand.id).map((run) => run.id))
  again = autoRoute(drawn, 'iv')
  assert.equal(JSON.stringify(again.services.nodes), nodesBefore)
  const kept = again.services.runs.find((run) => run.id === hand.id)
  assert.ok(kept)
  assert.deepEqual(kept.points, handPoints)
  beforeIds.forEach((id) => assert.equal(again.services.runs.some((run) => run.id === id), false))
  assert.ok(again.services.runs.some((run) => run.system === 'iv' && run.manual === false))
})

test('water route runs from the inlet through a manifold in PEX 16, 20 and 25', () => {
  const plan = autoRoute(acceptEquipment(exampleHouse(), 'water', { floorHeating: true }), 'water', { floorHeating: true })
  const nodes = plan.services.nodes.filter((item) => item.system === 'water')
  const runs = plan.services.runs.filter((item) => item.system === 'water')
  assert.ok(nodes.some((item) => item.kind === 'inlet'))
  assert.ok(nodes.some((item) => item.kind === 'shutoff'))
  assert.ok(nodes.some((item) => item.kind === 'manifold'))
  assert.ok(nodes.some((item) => item.kind === 'outdoor-tap'))
  assert.ok(nodes.some((item) => item.fixtureType === 'washer'))
  assert.ok(runs.some((item) => item.kind === 'cold' && item.size === 25))
  assert.ok(runs.some((item) => item.kind === 'cold' && item.size === 16))
  assert.ok(runs.some((item) => item.kind === 'hot' && item.size === 20))
  assert.ok(runs.some((item) => item.kind === 'hot' && item.size === 16))
  assert.ok(runs.some((item) => item.kind === 'circ' && item.size === 16))
  const toilet = (exampleHouse().fixtures).find((item) => item.type === 'toilet')
  const hotNearToilet = runs.filter((item) => item.kind === 'hot').some((item) => item.points.some((point) => Math.hypot(point.x - toilet.x, point.z - toilet.z) < 0.2))
  assert.equal(hotNearToilet, false)
  const loop = runs.find((item) => item.kind === 'floorheat')
  assert.ok(loop)
  assert.ok(loop.points.every((point) => point.y > 0 && point.y < 0.05))
  assert.ok(runs.filter((item) => item.kind !== 'floorheat').every((item) => item.points.every((point) => Math.abs(point.y - 0.35) < 0.02)))
})

test('drains fall below the slab with slope, a vent stack and cleanouts', () => {
  const plan = autoRoute(acceptEquipment(exampleHouse(), 'drain'), 'drain')
  const nodes = plan.services.nodes.filter((item) => item.system === 'drain')
  const runs = plan.services.runs.filter((item) => item.system === 'drain')
  const main = runs.find((item) => item.kind === 'main')
  assert.equal(main.size, 110)
  assert.equal(main.slope, 1)
  assert.ok(main.points.every((point) => point.y < 0))
  assert.ok(main.points[main.points.length - 1].y < main.points[0].y)
  const vent = runs.find((item) => item.kind === 'vent')
  assert.equal(vent.size, 110)
  assert.ok(vent.points.some((point) => point.y > 2))
  assert.ok(nodes.some((item) => item.kind === 'cleanout'))
  assert.ok(nodes.some((item) => item.kind === 'floor-drain'))
  assert.ok(runs.some((item) => item.kind === 'branch' && item.size === 50 && item.slope === 2))
  assert.ok(runs.some((item) => item.kind === 'branch' && item.size === 75))
  const box = planBounds(plan)
  assert.ok(Math.abs(main.points[0].z - (box.maxZ - 0.45)) < 0.05)
})

test('electrical route has a panel, device symbols and five circuits', () => {
  const house = exampleHouse()
  const placed = acceptEquipment(house, 'electric')
  const beforeNodes = JSON.stringify(placed.services.nodes)
  const plan = autoRoute(placed, 'electric')
  assert.equal(JSON.stringify(plan.services.nodes), beforeNodes)
  assert.equal(plan.services.nodes.some((item) => item.kind === 'junction'), false)
  assert.equal(plan.services.nodes.some((item) => item.kind === 'heater-control'), false)
  const nodes = plan.services.nodes.filter((item) => item.system === 'electric')
  assert.ok(nodes.some((item) => item.kind === 'panel'))
  assert.ok(nodes.filter((item) => item.kind === 'light').length >= visibleRooms(house).length)
  assert.ok(nodes.filter((item) => item.kind === 'switch').length >= visibleRooms(house).length)
  const living = visibleRooms(house).find((room) => roomKind(room) === 'olohuone')
  const livingSockets = nodes.filter((item) => item.kind === 'socket' && pointInPolygon(item.x, item.z, living.polygon))
  assert.ok(livingSockets.length >= 2)
  const stove = nodes.find((item) => item.kind === 'stove')
  const heater = nodes.find((item) => item.kind === 'heater')
  assert.ok(stove && heater)
  assert.notEqual(stove.circuit, heater.circuit)
  assert.equal(nodes.filter((item) => item.circuit === stove.circuit && !['panel', 'junction', 'heater-control'].includes(item.kind)).length, 1)
  assert.ok(nodes.some((item) => item.kind === 'data'))
  assert.ok(nodes.some((item) => item.kind === 'antenna'))
  const lightCircuit = nodes.find((item) => item.kind === 'light').circuit
  const lightRooms = new Set(nodes.filter((item) => item.kind === 'light' && item.circuit === lightCircuit).map((item) => item.roomId))
  assert.ok(lightRooms.size >= 3)
  const circuits = circuitList(plan)
  assert.ok(circuits.length >= 5)
  assert.ok(circuits.every((item) => item.count > 0))
  assert.ok(circuits.find((item) => item.id === lightCircuit).length > 0)
  assert.equal(nodes.find((item) => item.kind === 'light').y > 2, true)
  assert.ok(Math.abs(nodes.find((item) => item.kind === 'socket').y - 0.3) < 0.05)
  assert.ok(plan.services.runs.some((item) => item.system === 'electric' && item.circuit === 1))
})

test('layers hide a system from hit testing and the parts list still measures the ducts', () => {
  const routed = designServices(exampleHouse(), { floorHeating: true })
  const panel = routed.services.nodes.find((item) => item.kind === 'panel')
  assert.equal(hitService(routed, panel).id, panel.id)
  const plan = addServiceNode(routed, { system: 'electric', kind: 'socket', x: 30, z: 30 })
  const lonely = plan.services.nodes.find((item) => item.x === 30 && item.z === 30)
  assert.equal(hitService(plan, lonely).id, lonely.id)
  const hidden = setServiceLayer(plan, 'electric', false)
  assert.equal(layerVisible(hidden, 'electric'), false)
  assert.equal(hitService(hidden, lonely), null)
  assert.notEqual(hitService(hidden, panel)?.id, panel.id)
  assert.equal(layerVisible(hidden, 'iv'), true)
  const parts = partsList(plan, 'iv')
  assert.ok(parts.some((row) => row.unit === 'm' && row.qty > 5))
  assert.ok(parts.some((row) => row.name === 'Käyrä' && row.qty >= 1))
  assert.ok(parts.some((row) => row.name === 'T-haara' && row.qty >= 1))
  assert.ok(parts.some((row) => row.name === 'Äänenvaimennin'))
  const sheet = serviceSheet(plan, 'iv')
  const blob = `${sheet.title} ${sheet.balance} ${sheet.legend.join(' ')} ${sheet.parts.join(' ')}`
  assert.equal(/[äöåÄÖÅØ]/.test(blob), false)
  assert.match(sheet.balance, /Tulo \d+ l\/s/)
  const doc = buildServicePdf(plan, 'water')
  assert.equal(doc.getNumberOfPages(), 1)
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 420) < 0.01)
  ;['drain', 'electric', 'iv'].forEach((system) => {
    assert.equal(buildServicePdf(plan, system).getNumberOfPages(), 1)
  })
})

test('manual nodes snap to the grid, to nodes and to walls', () => {
  const empty = emptyPlan()
  assert.deepEqual(ensureServices(empty).nodes, [])
  const grid = snapServicePoint({ x: 1.04, z: 2.06 }, empty)
  assert.deepEqual(grid, { x: 1, z: 2.1 })
  let plan = addServiceNode(empty, { system: 'iv', kind: 'valve', role: 'tulo', flow: 8, x: 3, z: 4 })
  const snapped = snapServicePoint({ x: 3.2, z: 4.1 }, plan)
  assert.equal(snapped.x, 3)
  assert.equal(snapped.z, 4)
  const house = exampleHouse()
  const wall = snapServicePoint({ x: 0.2, z: 4 }, house, { mode: 'wall' })
  assert.ok(Math.abs(wall.x) < 0.05)
  const side = house.walls.find((item) => item.a.x === 0 && item.b.x === 0 && Math.min(item.a.z, item.b.z) <= 4 && Math.max(item.a.z, item.b.z) >= 4)
  assert.equal(wall.wallId, side.id)
  plan = addServiceRun(plan, { system: 'iv', kind: 'tulo', size: 125, points: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }] })
  assert.equal(plan.services.runs[0].points.length, 3)
  assert.ok(plan.services.runs[0].points.every((point) => Math.abs(point.y - 2.3) < 0.01))
  plan = deleteServiceRun(plan, plan.services.runs[0].id)
  assert.equal(plan.services.runs.length, 0)
  assert.equal(plan.services.nodes.length, 1)
})

test('floor manifold names sit on one leader in the sheet margin', () => {
  const plan = rewireHeat(applyHeating(familyHouse(), { source: 'district', distribution: 'floor', buffer: false }))
  const room = visibleRooms(plan).find((item) => item.name === 'Eteinen')
  const callouts = manifoldCallouts(plan)
  assert.equal(callouts.length, 1)
  assert.equal(callouts[0].text, 'Meno/Paluu PEX 25')
  assert.equal(pointInPolygon(callouts[0].x, callouts[0].z, room.polygon), false)
  const box = {
    minX: callouts[0].x - callouts[0].w / 2,
    maxX: callouts[0].x + callouts[0].w / 2,
    minZ: callouts[0].z - callouts[0].h / 2,
    maxZ: callouts[0].z + callouts[0].h / 2,
  }
  const south = planDimensions(plan).filter((dim) => (dim.nz || 0) < 0)
  const outer = Math.min(...south.map((dim) => dim.z1 + (dim.nz || 0) * (dim.offset || 0)))
  assert.ok(box.maxZ < outer - 0.18, `label clears the outer dimension chain (${box.maxZ} vs ${outer})`)
  const layout = viewLayout(plan)
  const frameZ = layout.box.minZ + ((layout.frame.y + 6) - layout.oy) / layout.scale
  assert.ok(box.minZ > frameZ, `label stays inside the sheet (${box.minZ} vs ${frameZ})`)
  const onPipe = plan.services.runs.some((run) => {
    if (run.system !== 'heat') return false
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      for (let s = 0; s <= 8; s += 1) {
        const t = s / 8
        const x = points[i - 1].x + (points[i].x - points[i - 1].x) * t
        const z = points[i - 1].z + (points[i].z - points[i - 1].z) * t
        if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) return true
      }
    }
    return false
  })
  assert.equal(onPipe, false)
})

test('every service element exposes a delete action in its menu', () => {
  ;['ahu', 'valve', 'hood', 'silencer', 'run', 'floor-drain', 'socket', 'cleanout', 'wire'].forEach((kind) => {
    assert.ok(serviceMenuSpec(kind).includes('delete'), kind)
  })
  const plan = designServices(exampleHouse())
  plan.services.nodes.forEach((node) => assert.ok(serviceMenuSpec(node).includes('delete')))
  plan.services.runs.forEach((run) => assert.ok(serviceMenuSpec(run).includes('delete')))
  assert.ok(serviceMenuSpec({ system: 'drain', kind: 'branch', points: [{ x: 0, z: 0 }] }).includes('slope'))
  assert.ok(serviceMenuSpec({ system: 'iv', kind: 'tulo', points: [{ x: 0, z: 0 }] }).includes('size'))
  assert.ok(serviceMenuSpec('wire').includes('lock'))
  assert.ok(serviceMenuSpec({ kind: 'stove', system: 'electric' }).includes('voltage'))
  assert.ok(serviceMenuSpec({ kind: 'heater', system: 'electric' }).includes('power'))
})
