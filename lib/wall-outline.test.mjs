import assert from 'node:assert/strict'
import test from 'node:test'
import { faceQuads, fractionQuad, silhouetteOf, wallFigures } from './wall-outline.js'

const thick = (wall) => wall.thickness || (wall.kind === 'interior' ? 0.12 : 0.24)

test('a 90 degree outside corner is sharp and closed', () => {
  const walls = [
    { id: 's', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior' },
    { id: 'w', a: { x: 0, z: 0 }, b: { x: 0, z: 3 }, kind: 'exterior' },
  ]
  const south = faceQuads(walls[0], [], walls, thick)[0]
  const east = faceQuads(walls[1], [], walls, thick)[0]
  const outer = { x: -0.12, z: -0.12 }
  const hit = [...south, ...east].some((point) => Math.hypot(point.x - outer.x, point.z - outer.z) < 0.02)
  assert.equal(hit, true)
  const loops = silhouetteOf([south, east])
  assert.ok(loops.length >= 1)
  const ring = loops.sort((a, b) => Math.abs(b.area) - Math.abs(a.area))[0].points
  const corner = ring.some((point) => Math.hypot(point.x - outer.x, point.z - outer.z) < 0.03)
  assert.equal(corner, true)
  const diagonal = ring.some((point, index) => {
    const next = ring[(index + 1) % ring.length]
    const dx = next.x - point.x
    const dz = next.z - point.z
    return Math.abs(dx) > 0.05 && Math.abs(dz) > 0.05 && Math.hypot(point.x, point.z) < 0.3
  })
  assert.equal(diagonal, false)
})

test('a 45 degree corner meets on the face intersection', () => {
  const walls = [
    { id: 'a', a: { x: 0, z: 0 }, b: { x: 3, z: 0 }, kind: 'exterior', thickness: 0.2 },
    { id: 'b', a: { x: 0, z: 0 }, b: { x: 2.121, z: 2.121 }, kind: 'exterior', thickness: 0.2 },
  ]
  const quad = faceQuads(walls[0], [], walls, thick)[0]
  assert.equal(quad.length, 4)
  const far = quad.some((point) => Math.hypot(point.x, point.z) > 0.12)
  assert.equal(far, true)
  const loops = silhouetteOf([quad, faceQuads(walls[1], [], walls, thick)[0]])
  assert.ok(loops.length >= 1)
})

test('collinear partitions of different thickness meet in a step', () => {
  const walls = [
    { id: 'u', a: { x: 4, z: 0 }, b: { x: 4, z: 2.4 }, kind: 'interior', thickness: 0.24 },
    { id: 'l', a: { x: 4, z: 2.4 }, b: { x: 4, z: 5.5 }, kind: 'interior', thickness: 0.09 },
  ]
  const figures = wallFigures(walls, [], (wall) => wall.thickness)
  const diagonal = figures.core.some((loop) => loop.points.some((point, index) => {
    const next = loop.points[(index + 1) % loop.points.length]
    return Math.abs(next.x - point.x) > 0.02 && Math.abs(next.z - point.z) > 0.02
  }))
  assert.equal(diagonal, false)
  const stepped = figures.core.some((loop) => (
    loop.points.some((point) => Math.abs(point.x - 3.88) < 0.01 && Math.abs(point.z - 2.4) < 0.01)
    && loop.points.some((point) => Math.abs(point.x - 3.955) < 0.01 && Math.abs(point.z - 2.4) < 0.01)
  ))
  assert.equal(stepped, true)
})

test('left alignment keeps the left face on the reference line', () => {
  const wall = { id: 'u', a: { x: 4, z: 0 }, b: { x: 4, z: 2 }, kind: 'interior', thickness: 0.3, align: 'left' }
  const quad = faceQuads(wall, [], [wall], (item) => item.thickness)[0]
  const xs = quad.map((point) => point.x)
  assert.ok(xs.some((x) => Math.abs(x - 4) < 0.002))
  assert.ok(xs.some((x) => Math.abs(x - 4.3) < 0.002))
  assert.ok(xs.every((x) => Math.abs(x - 4) < 0.002 || Math.abs(x - 4.3) < 0.002))
})

test('a cladding band does not diagonalise along a thickness step', () => {
  const walls = [
    { id: 'u', a: { x: 0, z: 0 }, b: { x: 0, z: 3 }, kind: 'exterior', thickness: 0.3 },
    { id: 'l', a: { x: 0, z: 3 }, b: { x: 0, z: 6 }, kind: 'exterior', thickness: 0.18 },
    { id: 'e', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior', thickness: 0.24 },
  ]
  const figures = wallFigures(walls, [], (wall) => wall.thickness || 0.24)
  const slanted = figures.cladding.some((loop) => loop.points.some((point, index) => {
    const next = loop.points[(index + 1) % loop.points.length]
    return Math.abs(next.z - point.z) > 1 && Math.abs(next.x - point.x) > 0.02
  }))
  assert.equal(slanted, false)
})

test('a short exterior step keeps parallel faces at 50, 100, 240 and 300 mm', () => {
  const thickOf = (wall) => wall.thickness || 0.24
  const diagonal = (loops) => (loops || []).some((loop) => loop.points.some((point, index) => {
    const next = loop.points[(index + 1) % loop.points.length]
    return Math.abs(next.x - point.x) > 0.012 && Math.abs(next.z - point.z) > 0.012
  }))
  for (const mm of [50, 100, 240, 300]) {
    const rise = mm / 1000
    const step = [
      { id: 'h', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior', thickness: 0.24 },
      { id: 'v', a: { x: 0, z: 0 }, b: { x: 0, z: rise }, kind: 'exterior', thickness: 0.24 },
    ]
    const jog = [
      { id: 'top', a: { x: 0, z: rise }, b: { x: 2, z: rise }, kind: 'exterior', thickness: 0.24 },
      { id: 'step', a: { x: 2, z: rise }, b: { x: 2, z: 0 }, kind: 'exterior', thickness: 0.24 },
      { id: 'bot', a: { x: 2, z: 0 }, b: { x: 6, z: 0 }, kind: 'exterior', thickness: 0.24 },
    ]
    const corner = wallFigures(step, [], thickOf)
    const notch = wallFigures(jog, [], thickOf)
    assert.equal(diagonal(corner.core), false, `corner ${mm}`)
    assert.equal(diagonal(corner.cladding), false, `corner cladding ${mm}`)
    assert.equal(diagonal(notch.core), false, `jog ${mm}`)
    assert.equal(diagonal(notch.cladding), false, `jog cladding ${mm}`)
    assert.ok(corner.core.length >= 1)
  }
})

function edgeList(loops) {
  const edges = []
  ;(loops || []).forEach((loop) => {
    const points = loop.points || []
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      edges.push({ a, b, dx: b.x - a.x, dz: b.z - a.z })
    }
  })
  return edges
}

test('layers follow a recessed door and stop at the jambs', () => {
  const walls = [
    { id: 'nl', a: { x: 0, z: 0 }, b: { x: 2.2, z: 0 }, kind: 'exterior', thickness: 0.24 },
    { id: 'jl', a: { x: 2.2, z: 0 }, b: { x: 2.2, z: 1.15 }, kind: 'exterior', thickness: 0.24 },
    { id: 'bk', a: { x: 2.2, z: 1.15 }, b: { x: 3.5, z: 1.15 }, kind: 'exterior', thickness: 0.24 },
    { id: 'jr', a: { x: 3.5, z: 1.15 }, b: { x: 3.5, z: 0 }, kind: 'exterior', thickness: 0.24 },
    { id: 'nr', a: { x: 3.5, z: 0 }, b: { x: 6.4, z: 0 }, kind: 'exterior', thickness: 0.24 },
    { id: 'e', a: { x: 6.4, z: 0 }, b: { x: 6.4, z: 4.2 }, kind: 'exterior', thickness: 0.24 },
    { id: 's', a: { x: 6.4, z: 4.2 }, b: { x: 0, z: 4.2 }, kind: 'exterior', thickness: 0.24 },
    { id: 'w', a: { x: 0, z: 4.2 }, b: { x: 0, z: 0 }, kind: 'exterior', thickness: 0.24 },
  ]
  const openings = [{ id: 'door', wallId: 'bk', offset: 0.65, width: 0.9, kind: 'door' }]
  const figures = wallFigures(walls, openings, thick)
  const layers = [...figures.cladding, ...figures.insulation]
  const edges = edgeList(layers)
  const jamb = edges.some((edge) => Math.abs(edge.dx) < 0.03 && Math.abs(edge.dz) > 0.45 && Math.abs((edge.a.x + edge.b.x) / 2 - 2.33) < 0.04)
  assert.equal(jamb, true)
  const acrossMouth = edges.some((edge) => {
    const z = (edge.a.z + edge.b.z) / 2
    return Math.abs(edge.dz) < 0.03 && z < 0.2 && Math.min(edge.a.x, edge.b.x) < 2.45 && Math.max(edge.a.x, edge.b.x) > 3.25
  })
  assert.equal(acrossMouth, false)
  const acrossDoor = edges.some((edge) => {
    const z = (edge.a.z + edge.b.z) / 2
    return Math.abs(edge.dz) < 0.04 && z > 0.85 && z < 1.25 && Math.min(edge.a.x, edge.b.x) < 2.55 && Math.max(edge.a.x, edge.b.x) > 3.15
  })
  assert.equal(acrossDoor, false)
  const besideDoor = edges.some((edge) => {
    const z = (edge.a.z + edge.b.z) / 2
    const x0 = Math.min(edge.a.x, edge.b.x)
    const x1 = Math.max(edge.a.x, edge.b.x)
    return Math.abs(edge.dz) < 0.04 && z > 0.95 && z < 1.15 && x1 <= 2.45 && x0 >= 2.2
  })
  assert.equal(besideDoor, true)
  const inside = (loops, x, z) => loops.some((loop) => {
    let on = false
    const poly = loop.points
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const hit = (poly[i].z > z) !== (poly[j].z > z) && x < ((poly[j].x - poly[i].x) * (z - poly[i].z)) / ((poly[j].z - poly[i].z) || 1e-12) + poly[i].x
      if (hit) on = !on
    }
    return on
  })
  assert.equal(inside(layers, 2.33, 0.55), true, 'cladding turns down the jamb')
  assert.equal(inside(layers, 2.85, 1.02), false, 'layers stop at the door')
  assert.equal(inside(layers, 2.85, 0.2), false, 'layers do not cross the recess')
  assert.equal(inside(layers, 3.2, 2.4), false, 'layers do not fill the room')
  const outer = fractionQuad(walls[1], walls, 0.85, 1, thick)
  assert.ok(outer.some((point) => point.x > 2.25 && point.z > 0.9))
  assert.ok(outer.some((point) => point.x > 2.25 && point.z < 0))
  assert.ok(outer.every((point) => point.x < 2.55))
})

test('layers turn every side of a U recess', () => {
  const walls = [
    { id: 'a', a: { x: 0, z: 0 }, b: { x: 1.4, z: 0 }, kind: 'exterior', thickness: 0.24 },
    { id: 'b', a: { x: 1.4, z: 0 }, b: { x: 1.4, z: 0.8 }, kind: 'exterior', thickness: 0.24 },
    { id: 'c', a: { x: 1.4, z: 0.8 }, b: { x: 2.8, z: 0.8 }, kind: 'exterior', thickness: 0.24 },
    { id: 'd', a: { x: 2.8, z: 0.8 }, b: { x: 2.8, z: 0 }, kind: 'exterior', thickness: 0.24 },
    { id: 'e', a: { x: 2.8, z: 0 }, b: { x: 5, z: 0 }, kind: 'exterior', thickness: 0.24 },
    { id: 'f', a: { x: 5, z: 0 }, b: { x: 5, z: 3.5 }, kind: 'exterior', thickness: 0.24 },
    { id: 'g', a: { x: 5, z: 3.5 }, b: { x: 0, z: 3.5 }, kind: 'exterior', thickness: 0.24 },
    { id: 'h', a: { x: 0, z: 3.5 }, b: { x: 0, z: 0 }, kind: 'exterior', thickness: 0.24 },
  ]
  const figures = wallFigures(walls, [], thick)
  const edges = edgeList([...figures.cladding, ...figures.insulation, ...figures.core])
  const side = edges.some((edge) => Math.abs(edge.dx) < 0.03 && Math.abs(edge.dz) > 0.35 && Math.abs((edge.a.x + edge.b.x) / 2 - 1.52) < 0.05)
  const back = edges.some((edge) => {
    const z = (edge.a.z + edge.b.z) / 2
    return Math.abs(edge.dz) < 0.03 && z > 0.6 && z < 0.95 && Math.min(edge.a.x, edge.b.x) < 1.7 && Math.max(edge.a.x, edge.b.x) > 2.5
  })
  const across = edges.some((edge) => {
    const z = (edge.a.z + edge.b.z) / 2
    return Math.abs(edge.dz) < 0.03 && z < 0.15 && Math.min(edge.a.x, edge.b.x) < 1.6 && Math.max(edge.a.x, edge.b.x) > 2.6
  })
  assert.equal(side, true)
  assert.equal(back, true)
  assert.equal(across, false)
  const inside = (loops, x, z) => loops.some((loop) => {
    let on = false
    const poly = loop.points
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const hit = (poly[i].z > z) !== (poly[j].z > z) && x < ((poly[j].x - poly[i].x) * (z - poly[i].z)) / ((poly[j].z - poly[i].z) || 1e-12) + poly[i].x
      if (hit) on = !on
    }
    return on
  })
  const bands = [...figures.cladding, ...figures.insulation]
  assert.equal(inside(bands, 1.52, 0.4), true, 'band follows the U side')
  assert.equal(inside(bands, 2.1, 0.2), false, 'band stays out of the U void')
  assert.equal(inside(bands, 2.1, 1.6), false, 'band does not fill the room')
})

test('a T-junction butts into the crossing face', () => {
  const walls = [
    { id: 'bar', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior' },
    { id: 'stem', a: { x: 2, z: 0 }, b: { x: 2, z: 2 }, kind: 'interior', thickness: 0.12 },
  ]
  const stem = faceQuads(walls[1], [], walls, thick)[0]
  const past = stem.some((point) => point.z < -0.02)
  assert.equal(past, false)
  const figures = wallFigures(walls, [], thick)
  assert.ok(figures.core.length >= 1)
  assert.ok(figures.cladding.length >= 1)
})
