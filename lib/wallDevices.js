// Wall-mounted electrical devices. Sizes are metres for the 3D box and the
// wall snap. The plan symbol is a paper-size schematic, not this envelope.
// Rotation 0 points the depth along +z, matching the floor-plan SVG rotate()
// and the Three.js yaw used by furniture.

export const PANEL_WIDTH = 0.6
export const PANEL_DEPTH = 0.15
export const PANEL_HEIGHT = 0.8
export const PANEL_MOUNT = 1

const WALL_DEVICES = new Set(['panel', 'socket', 'switch', 'junction'])

export function isWallDevice(kind) {
  return WALL_DEVICES.has(kind)
}

function num(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function normDeg(value) {
  const n = Math.round(Number(value) || 0) % 360
  return (n + 360) % 360
}

export function deviceEnvelope(node) {
  const kind = node?.kind
  if (kind === 'panel') {
    const height = Math.max(0.05, num(node?.height, PANEL_HEIGHT))
    const mount = Number.isFinite(Number(node?.mount))
      ? Number(node.mount)
      : (Number.isFinite(Number(node?.y)) ? Number(node.y) - height / 2 : PANEL_MOUNT)
    return {
      width: Math.max(0.05, num(node?.width, PANEL_WIDTH)),
      depth: Math.max(0.02, num(node?.depth, PANEL_DEPTH)),
      height,
      mount,
    }
  }
  const height = Math.max(0.02, num(node?.height, 0.08))
  const mount = Number.isFinite(Number(node?.mount))
    ? Number(node.mount)
    : (Number.isFinite(Number(node?.y)) ? Number(node.y) - height / 2 : null)
  return {
    width: Math.max(0.04, num(node?.width, kind === 'junction' ? 0.08 : 0.086)),
    depth: Math.max(0.015, num(node?.depth, 0.04)),
    height,
    mount,
  }
}

// Local +x is the width (along the wall). Local +z is the depth, into the room.
export function deviceCorners(node) {
  const env = deviceEnvelope(node)
  const rad = (normDeg(node?.rotation) * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const w = env.width
  const d = env.depth
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, lz]) => ({
    x: (node?.x || 0) + lx * c + lz * s,
    z: (node?.z || 0) - lx * s + lz * c,
  }))
}
