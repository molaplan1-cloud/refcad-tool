import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyPlan } from './floorplan.js'
import { translate } from './i18n.js'
import { ivSection, projectIvZone, projectZone, zoneHeight, zoneInsulation, zonesFor } from './ivZone.js'
import { addServiceRun, autoRoute, partsList, setProjectIvZone, setProjectZone, updateServiceRun } from './services.js'

function wall(id, kind, x1, z1, x2, z2) {
  return { id, kind, a: { x: x1, z: z1 }, b: { x: x2, z: z2 }, thickness: kind === 'interior' ? 0.1 : 0.2 }
}

function zoneHouse(zone) {
  return {
    ...emptyPlan(),
    floorHeight: 2.6,
    ivZone: zone,
    walls: [
      wall('e1', 'exterior', 0, 0, 8, 0),
      wall('e2', 'exterior', 8, 0, 8, 6),
      wall('e3', 'exterior', 8, 6, 0, 6),
      wall('e4', 'exterior', 0, 6, 0, 0),
      wall('mid', 'interior', 4, 0, 4, 6),
    ],
    openings: [{ id: 'door', wallId: 'mid', kind: 'door', offset: 2.4, width: 0.9 }],
    services: {
      layers: { iv: true, water: true, drain: true, electric: true, heat: true, ground: true },
      nodes: [
        { id: 'ahu', system: 'iv', kind: 'ahu', x: 1, y: 2.3, z: 3 },
        { id: 'valve', system: 'iv', kind: 'valve', role: 'tulo', flow: 8, x: 7, y: 2.3, z: 3 },
      ],
      runs: [],
    },
  }
}

function wallHit(a, b, wall) {
  const rx = b.x - a.x
  const rz = b.z - a.z
  const sx = wall.b.x - wall.a.x
  const sz = wall.b.z - wall.a.z
  const den = rx * sz - rz * sx
  if (Math.abs(den) < 1e-7) return null
  const t = ((wall.a.x - a.x) * sz - (wall.a.z - a.z) * sx) / den
  const u = ((wall.a.x - a.x) * rz - (wall.a.z - a.z) * rx) / den
  if (t <= 0.02 || t >= 0.98 || u <= 0.02 || u >= 0.98) return null
  return { x: a.x + rx * t, z: a.z + rz * t }
}

function crossings(plan) {
  const wall = plan.walls.find((item) => item.id === 'mid')
  const hits = []
  plan.services.runs.filter((run) => run.system === 'iv').forEach((run) => {
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      const hit = wallHit(points[i - 1], points[i], wall)
      if (hit) hits.push(hit)
    }
  })
  return hits
}

test('duct zones name the attic, the heated space, the intermediate floor and the ground slab', () => {
  assert.equal(projectIvZone(emptyPlan()), 'sisatilat')
  assert.equal(zoneHeight({ floorHeight: 2.6 }, 'sisatilat'), 2.3)
  assert.ok(zoneHeight({ floorHeight: 2.6 }, 'ylapohja') > 2.6)
  assert.ok(zoneHeight({ floorHeight: 2.6 }, 'valipohja') > 2.3)
  assert.ok(zoneHeight({ floorHeight: 2.6 }, 'valipohja') < 2.6)
  assert.ok(zoneHeight({ floorHeight: 2.6 }, 'alapohja') < 0)
  assert.equal(zoneInsulation('ylapohja', 'tulo'), 'wool-100')
  assert.equal(zoneInsulation('ylapohja', 'poisto'), 'wool-100')
  assert.equal(zoneInsulation('ylapohja', 'ulko'), 'condensate')
  assert.equal(zoneInsulation('ylapohja', 'jate'), 'condensate')
  assert.equal(zoneInsulation('sisatilat', 'tulo'), '')
  ;['fi', 'en', 'sv', 'es', 'et'].forEach((locale) => {
    ;['iv.zone.ylapohja', 'iv.zone.sisatilat', 'iv.zone.valipohja', 'iv.zone.alapohja', 'iv.insulation.wool', 'iv.insulation.condensate', 'view.section'].forEach((key) => {
      assert.notEqual(translate(locale, key), key, `${locale} ${key}`)
    })
  })
  assert.equal(translate('fi', 'iv.zone.ylapohja'), 'Yläpohja')
  assert.equal(translate('fi', 'iv.zone.sisatilat'), 'Sisätilat')
  assert.equal(translate('fi', 'iv.zone.valipohja'), 'Välipohja')
  assert.equal(translate('fi', 'iv.zone.alapohja'), 'Lattia/alapohja')
  assert.deepEqual(zonesFor('water'), zonesFor('heat'))
  assert.deepEqual(zonesFor('drain'), zonesFor('water'))
  assert.deepEqual(zonesFor('electric'), ['lattia', 'pinta', 'seinassa', 'ylapohja', 'valipohja'])
  assert.equal(projectZone(emptyPlan(), 'water'), 'lattia')
  assert.equal(projectZone(emptyPlan(), 'heat'), 'lattia')
  assert.equal(projectZone(emptyPlan(), 'drain'), 'alapohja')
  assert.equal(projectZone(emptyPlan(), 'electric'), 'lattia')
  ;['fi', 'en', 'sv', 'es', 'et'].forEach((locale) => {
    ;['zone.lvi.lattia', 'zone.lvi.pinta', 'zone.lvi.alapohja', 'zone.el.lattia', 'zone.el.pinta', 'zone.seinassa', 'zone.part.suojaputki', 'zone.part.eristys', 'zone.part.kaapelikouru', 'zone.hint', 'zone.section.lvi', 'zone.section.electric'].forEach((key) => {
      assert.notEqual(translate(locale, key), key, `${locale} ${key}`)
    })
  })
  assert.equal(translate('fi', 'zone.lvi.lattia'), 'Lattian sisällä')
  assert.equal(translate('fi', 'zone.lvi.pinta'), 'Pinta-asennus seinällä')
  assert.equal(translate('fi', 'zone.lvi.alapohja'), 'Alapohja/maanalainen')
  assert.equal(translate('fi', 'zone.el.lattia'), 'Lattiassa')
  assert.equal(translate('fi', 'zone.el.pinta'), 'Seinällä pinta-asennus')
  assert.equal(translate('fi', 'zone.seinassa'), 'Seinässä upotettuna')
})

test('yläpohja ducts cross an interior wall and sit above the ceiling with wool', () => {
  const plan = autoRoute(zoneHouse('ylapohja'), 'iv')
  const hits = crossings(plan)
  assert.ok(hits.length >= 1)
  assert.ok(hits.some((hit) => Math.abs(hit.z - 3.18) < 0.3), 'the attic duct stays on the straight line')
  assert.equal(hits.some((hit) => Math.abs(hit.z - 2.4) < 0.15), false)
  const runs = plan.services.runs.filter((run) => run.system === 'iv')
  assert.ok(runs.some((run) => run.points.some((point) => point.y > 2.6)))
  assert.ok(runs.every((run) => run.insulation === 'wool-100'))
  const parts = partsList(plan, 'iv')
  const wool = parts.find((row) => row.code === 'wool-100')
  assert.ok(wool)
  assert.equal(wool.name, 'Mineraalivilla 100 mm')
  assert.ok(wool.qty > 1)
  const section = ivSection(plan)
  assert.ok(section.ducts.some((duct) => duct.above && Math.max(duct.y0, duct.y1) > section.ceiling))
  const nodes = JSON.stringify(zoneHouse('ylapohja').services.nodes)
  assert.equal(JSON.stringify(plan.services.nodes), nodes)
})

test('sisätilat ducts stay below the ceiling and jog to a door instead of crossing a room wall freely', () => {
  const plan = autoRoute(zoneHouse('sisatilat'), 'iv')
  const hits = crossings(plan)
  assert.ok(hits.length >= 1)
  assert.ok(hits.every((hit) => Math.abs(hit.z - 2.4) < 0.25), 'the indoor duct crosses at the door')
  const runs = plan.services.runs.filter((run) => run.system === 'iv')
  assert.ok(runs.every((run) => run.points.every((point) => Math.abs(point.y - 2.3) < 0.02)))
  assert.equal(partsList(plan, 'iv').some((row) => row.code === 'wool-100'), false)
  const section = ivSection(plan)
  assert.ok(section.ducts.length > 0)
  assert.ok(section.ducts.every((duct) => !duct.above && Math.max(duct.y0, duct.y1) < section.ceiling))
})

test('a selected segment can override the project zone, and a manual duct keeps its zone', () => {
  let plan = autoRoute(zoneHouse('sisatilat'), 'iv')
  const duct = plan.services.runs.find((run) => run.system === 'iv' && (run.points || []).length >= 2)
  const index = duct.points.findIndex((point, i) => i > 0 && Math.hypot(point.x - duct.points[i - 1].x, point.z - duct.points[i - 1].z) > 1)
  plan = updateServiceRun(plan, duct.id, { segmentZone: { index: Math.max(0, index - 1), zone: 'ylapohja' } })
  const lifted = plan.services.runs.find((run) => run.id === duct.id)
  assert.equal(lifted.locked, true)
  assert.ok(lifted.points.some((point) => point.y > 2.6))
  assert.ok(partsList(plan, 'iv').some((row) => row.code === 'wool-100'))
  const drawn = addServiceRun(plan, {
    system: 'iv',
    kind: 'tulo',
    role: 'branch',
    zone: 'alapohja',
    manual: true,
    points: [{ x: 0.4, y: -0.12, z: 0.4 }, { x: 1.8, y: -0.12, z: 0.4 }],
  })
  const hand = drawn.services.runs[drawn.services.runs.length - 1]
  const again = autoRoute(drawn, 'iv')
  const kept = again.services.runs.find((run) => run.id === hand.id)
  assert.equal(kept.zone, 'alapohja')
  assert.ok(kept.points.every((point) => point.y < 0))
  const moved = setProjectIvZone(zoneHouse('sisatilat'), 'ylapohja')
  const routed = setProjectIvZone(autoRoute(moved, 'iv'), 'valipohja')
  const open = routed.services.runs.filter((run) => run.system === 'iv' && !run.locked && !run.manual)
  assert.ok(open.length > 0)
  assert.ok(open.every((run) => run.points.some((point) => point.y > 2.4 && point.y < 2.6)))
})

function pipeHouse(zone) {
  const plan = zoneHouse('sisatilat')
  plan.services.nodes = [
    { id: 'man', system: 'water', kind: 'manifold', x: 1, y: 0.35, z: 3 },
    { id: 'fix', system: 'water', kind: 'fixture', cold: true, x: 7, y: 0.35, z: 3 },
    { id: 'panel', system: 'electric', kind: 'panel', x: 0.25, y: 1.4, z: 1 },
    { id: 'socket', system: 'electric', kind: 'socket', x: 7.75, y: 0.3, z: 5, circuit: 2 },
  ]
  return setProjectZone(setProjectZone(plan, 'water', zone), 'electric', zone === 'sisatilat' ? 'lattia' : zone)
}

function distToWalls(point, walls) {
  let best = Infinity
  walls.forEach((wall) => {
    const dx = wall.b.x - wall.a.x
    const dz = wall.b.z - wall.a.z
    const len2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / len2))
    best = Math.min(best, Math.hypot(point.x - (wall.a.x + dx * t), point.z - (wall.a.z + dz * t)))
  })
  return best
}

function longFar(runs, walls) {
  const hits = []
  runs.forEach((run) => {
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]
      const b = points[i]
      if (Math.hypot(b.x - a.x, b.z - a.z) < 1.2) continue
      const quarter = { x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }
      hits.push(distToWalls(quarter, walls))
    }
  })
  return hits
}

test('one zone catalog routes LVI in the slab and on the wall, and cables on a tray', () => {
  const nodes = JSON.stringify(pipeHouse('lattia').services.nodes)
  const slab = autoRoute(pipeHouse('lattia'), 'water')
  assert.equal(JSON.stringify(slab.services.nodes), nodes)
  const pipes = slab.services.runs.filter((run) => run.system === 'water')
  assert.ok(pipes.length >= 1)
  const mid = slab.walls.find((wall) => wall.id === 'mid')
  const crossed = []
  pipes.forEach((run) => {
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) crossed.push(wallHit(points[i - 1], points[i], mid))
  })
  assert.ok(crossed.filter(Boolean).some((hit) => Math.abs(hit.z - 3) < 0.35))
  assert.ok(pipes.every((run) => run.points.some((point) => Math.abs(point.y - 0.02) < 0.03)))
  assert.ok(partsList(slab, 'water').some((row) => row.code === 'suojaputki' && row.name === 'Suojaputki'))
  const surface = autoRoute(pipeHouse('pinta'), 'water')
  const surfacePipes = surface.services.runs.filter((run) => run.system === 'water')
  const far = longFar(surfacePipes, surface.walls)
  assert.ok(far.length >= 1)
  assert.ok(far.every((dist) => dist < 0.55), 'surface pipe stays on a wall face')
  assert.ok(surfacePipes.some((run) => {
    const points = run.points || []
    return points.slice(1).some((point, index) => Math.hypot(point.x - points[index].x, point.z - points[index].z) < 0.08 && Math.abs((point.y || 0) - (points[index].y || 0)) > 0.4)
  }))
  assert.equal(JSON.stringify(surface.services.nodes), nodes)
  const cables = autoRoute(pipeHouse('pinta'), 'electric')
  const wires = cables.services.runs.filter((run) => run.system === 'electric')
  assert.ok(wires.length >= 1)
  assert.ok(partsList(cables, 'electric').some((row) => row.code === 'kaapelikouru'))
  assert.equal(cables.services.nodes.find((node) => node.id === 'panel').x, 0.25)
  assert.equal(cables.services.nodes.find((node) => node.id === 'socket').y, 0.3)
  const attic = autoRoute(setProjectZone(pipeHouse('lattia'), 'water', 'ylapohja'), 'water')
  assert.ok(attic.services.runs.filter((run) => run.system === 'water').some((run) => run.points.some((point) => point.y > 2.6)))
  assert.ok(partsList(attic, 'water').some((row) => row.code === 'eristys'))
  const stored = setProjectZone(zoneHouse('sisatilat'), 'drain', 'alapohja')
  assert.equal(stored.services.runs.length, 0)
  assert.equal(projectZone(stored, 'drain'), 'alapohja')
})
