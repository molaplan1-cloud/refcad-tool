/** Fan parts in the group frame. +Z is the face normal; z = 0 is the casing face. */

export const FAN_WIRE_R = 0.0016

export function condenserFanSpec(radius) {
  const r = radius
  return {
    wire: FAN_WIRE_R,
    recessZ: -0.044,
    recessR: r * 0.9,
    bladeZ: -0.03,
    bladeDepth: 0.006,
    bladeR: r * 1.04,
    hubZ: -0.02,
    hubLength: 0.012,
    hubR: r * 0.2,
    shroudZ: -0.014,
    shroudLength: 0.016,
    shroudR: r * 0.97,
    grilleZ: -0.0035,
    grilleR: r * 0.92,
  }
}

/** Axis-aligned bounds. Depth is along Z, so a face-on fan is much wider than it is deep. */
export function condenserFanBounds(radius) {
  const spec = condenserFanSpec(radius)
  const radial = Math.max(spec.recessR, spec.bladeR, spec.hubR, spec.shroudR, spec.grilleR + spec.wire)
  const z = [
    spec.recessZ,
    spec.bladeZ - spec.bladeDepth / 2,
    spec.bladeZ + spec.bladeDepth / 2,
    spec.hubZ - spec.hubLength / 2,
    spec.hubZ + spec.hubLength / 2,
    spec.shroudZ - spec.shroudLength / 2,
    spec.shroudZ + spec.shroudLength / 2,
    spec.grilleZ - spec.wire,
    spec.grilleZ + spec.wire,
  ]
  return {
    min: [-radial, -radial, Math.min(...z)],
    max: [radial, radial, Math.max(...z)],
  }
}
