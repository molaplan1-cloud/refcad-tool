/** Fan parts in the group frame. +Z is the face normal; z = 0 is the casing face. */

export const FAN_WIRE_R = 0.0016

export function condenserFanSpec(radius) {
  const r = radius
  const openingR = r * 0.98
  const shroudLength = 0.07
  const shroudOuter = openingR - 0.002
  const shroudInner = shroudOuter - 0.012
  return {
    wire: FAN_WIRE_R,
    openingR,
    recessZ: -shroudLength,
    recessR: shroudInner - 0.003,
    bladeZ: -0.04,
    bladeDepth: 0.01,
    bladeR: shroudInner * 0.9,
    hubZ: -0.04,
    hubLength: 0.018,
    hubR: r * 0.16,
    shroudLength,
    shroudOuter,
    shroudInner,
    grilleZ: 0.005 - FAN_WIRE_R,
    grilleR: shroudInner * 0.96,
  }
}

/** Axis-aligned bounds. The grille may stand a few millimetres proud of the face. */
export function condenserFanBounds(radius) {
  const spec = condenserFanSpec(radius)
  const radial = Math.max(spec.recessR, spec.bladeR, spec.hubR, spec.shroudOuter, spec.grilleR + spec.wire)
  const z = [
    spec.recessZ,
    spec.bladeZ - spec.bladeDepth / 2,
    spec.bladeZ + spec.bladeDepth / 2,
    spec.hubZ - spec.hubLength / 2,
    spec.hubZ + spec.hubLength / 2,
    -spec.shroudLength,
    0,
    spec.grilleZ - spec.wire,
    spec.grilleZ + spec.wire,
  ]
  return {
    min: [-radial, -radial, Math.min(...z)],
    max: [radial, radial, Math.max(...z)],
  }
}
