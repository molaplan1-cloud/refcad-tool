import { fixtureServiceSpecs } from './furniture.js'
import { ensureServices, rewireElectric } from './services.js'

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function upsert(nodes, spec, seq) {
  const existing = nodes.find((node) => node.linkedFrom === spec.linkedFrom)
  const stamped = {
    ...spec,
    x: round3(spec.x),
    z: round3(spec.z),
    y: round3(spec.y),
  }
  if (existing) {
    return nodes.map((node) => (node === existing ? { ...existing, ...stamped, id: existing.id, circuit: existing.circuit, circuitMode: existing.circuitMode || 'auto' } : node))
  }
  seq.n += 1
  nodes.push({ id: `svc-${seq.n}`, circuitMode: 'auto', ...stamped })
  return nodes
}

export function fixtureServiceKey(plan) {
  return (plan?.fixtures || []).map((item) => [item.id, item.type, item.variant || '', item.x, item.z, item.w || '', item.hidden ? 1 : 0].join(':')).join(';')
}

export function syncFixtureServices(plan) {
  const services = ensureServices(plan)
  const seq = { n: plan?.seq || 1 }
  const wanted = fixtureServiceSpecs(plan?.fixtures)
  const keep = new Set(wanted.map((item) => item.linkedFrom))
  let nodes = (services.nodes || []).filter((node) => !node.linkedFrom || !String(node.linkedFrom).startsWith('fix:') || keep.has(node.linkedFrom))
  wanted.forEach((spec) => {
    const near = nodes.find((node) => !node.linkedFrom && node.system === spec.system && Math.hypot((node.x || 0) - spec.x, (node.z || 0) - spec.z) < 0.2 && (node.fixtureType === spec.fixtureType || node.kind === spec.kind))
    if (near) {
      nodes = nodes.map((node) => (node === near ? { ...node, linkedFrom: spec.linkedFrom, name: spec.name, voltage: spec.voltage ?? node.voltage, power: spec.power ?? node.power, x: round3(spec.x), z: round3(spec.z) } : node))
      return
    }
    nodes = upsert(nodes, spec, seq)
  })
  let next = { ...plan, seq: seq.n, services: { ...services, nodes } }
  const hadElectric = (services.runs || []).some((run) => run.system === 'electric')
  if (hadElectric && wanted.some((item) => item.system === 'electric')) next = rewireElectric(next)
  return next
}
