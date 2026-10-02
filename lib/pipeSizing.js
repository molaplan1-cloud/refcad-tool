// Screening pipe sizes for a refrigeration proposal. The constants are linearised
// saturation properties so a reviewer can recompute every step. They are not a
// refrigerant-property library and not a substitute for a manufacturer's chart.
// R744 above about 31 °C is treated as a gas cooler with the same equations and
// an explicit note, not as a full transcritical model.

export const COPPER = [
  { odMm: 6.35, inch: '1/4', wallMm: 0.76 },
  { odMm: 9.52, inch: '3/8', wallMm: 0.81 },
  { odMm: 12.7, inch: '1/2', wallMm: 0.89 },
  { odMm: 15.88, inch: '5/8', wallMm: 1.02 },
  { odMm: 19.05, inch: '3/4', wallMm: 1.07 },
  { odMm: 22.22, inch: '7/8', wallMm: 1.14 },
  { odMm: 28.58, inch: '1-1/8', wallMm: 1.27 },
  { odMm: 34.92, inch: '1-3/8', wallMm: 1.4 },
  { odMm: 41.28, inch: '1-5/8', wallMm: 1.52 },
  { odMm: 53.98, inch: '2-1/8', wallMm: 1.78 },
  { odMm: 66.68, inch: '2-5/8', wallMm: 2.03 },
  { odMm: 79.38, inch: '3-1/8', wallMm: 2.29 },
]

// q0 kJ/kg and suction density kg/m³ at Te = -10 °C, Tc = 40 °C.
// q0Te / q0Tc are kJ/kg per K. rhoVTe is kg/m³ per K. dpdT is kPa per K
// (saturation slope used to turn a pressure drop into an equivalent temperature drop).
export const REFRIGERANTS = {
  R404A: { id: 'R404A', q0: 118, q0Te: 1.15, q0Tc: -0.85, rhoV: 16.5, rhoVTe: 0.55, rhoL: 1040, dpdT: 12.5 },
  R449A: { id: 'R449A', q0: 150, q0Te: 1.2, q0Tc: -0.9, rhoV: 14.2, rhoVTe: 0.48, rhoL: 1110, dpdT: 11.8 },
  R452A: { id: 'R452A', q0: 135, q0Te: 1.15, q0Tc: -0.85, rhoV: 17, rhoVTe: 0.52, rhoL: 1080, dpdT: 12.2 },
  R134a: { id: 'R134a', q0: 155, q0Te: 1.05, q0Tc: -0.7, rhoV: 8.2, rhoVTe: 0.32, rhoL: 1260, dpdT: 8.4 },
  R290: { id: 'R290', q0: 280, q0Te: 1.4, q0Tc: -1.1, rhoV: 5.4, rhoVTe: 0.18, rhoL: 530, dpdT: 7.2 },
  R744: { id: 'R744', q0: 200, q0Te: 2.2, q0Tc: -1.6, rhoV: 42, rhoVTe: 1.4, rhoL: 980, dpdT: 85, criticalC: 31 },
}

export const REFRIGERANT_IDS = Object.keys(REFRIGERANTS)

const MU_VAPOR = 1.2e-5
const MU_LIQUID = 1.8e-4

function n(value, digits) {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(digits)
}

function refrigerantOf(id) {
  return REFRIGERANTS[id] || REFRIGERANTS.R449A
}

export function routeLength(points) {
  let length = 0
  for (let i = 1; i < (points || []).length; i += 1) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
  }
  return length
}

function properties(ref, teC, tcC) {
  const q0 = Math.max(40, ref.q0 + ref.q0Te * (teC - (-10)) + ref.q0Tc * (tcC - 40))
  const rhoV = Math.max(1.2, ref.rhoV + ref.rhoVTe * (teC - (-10)))
  const rhoL = ref.rhoL
  return { q0, rhoV, rhoL }
}

function tubeRow(tube, mass, rho, mu, lengthM) {
  const idM = (tube.odMm - 2 * tube.wallMm) / 1000
  const area = (Math.PI * idM * idM) / 4
  const velocity = mass / (rho * area)
  const re = (rho * velocity * idM) / mu
  const f = re < 2300 ? 64 / Math.max(re, 1) : 0.316 / (re ** 0.25)
  const dpPa = f * (lengthM / idM) * rho * velocity * velocity / 2
  return { tube, idMm: idM * 1000, velocity, re, f, dpKPa: dpPa / 1000 }
}

function pickTube(rows, { kind, teC, riseM, dpdT }) {
  const riser = kind === 'suction' && riseM > 0.3
  const vMin = kind === 'suction' ? (riser ? (teC < -10 ? 8 : 6) : 4) : 0.4
  const vPrefer = kind === 'suction' ? 15 : 1.5
  const vHard = kind === 'suction' ? 20 : 2
  const dTMax = kind === 'suction' ? 1 : 0.7
  const scored = rows.map((row) => {
    const dT = row.dpKPa / Math.max(dpdT, 0.1)
    return { ...row, dT, vMin, vPrefer, vHard, dTMax }
  })
  const fits = (row) => row.velocity <= vPrefer + 1e-6 && row.dT <= dTMax + 1e-6 && (!riser || row.velocity + 1e-6 >= vMin)
  let chosen = scored.find(fits)
  let note = ''
  if (!chosen && riser) {
    const returning = scored.filter((row) => row.velocity + 1e-6 >= vMin && row.velocity <= vHard)
    chosen = returning[returning.length - 1] || scored[0]
    if (chosen.dT > dTMax) note = 'Nousun öljynpalautus vaatii pienemmän putken kuin painehäviön raja. Tarkista nousu.'
  }
  if (!chosen) {
    chosen = scored.find((row) => row.velocity <= vHard && row.dT <= dTMax) || scored[scored.length - 1]
    if (chosen.velocity > vHard) note = 'Nopeus jää rajan yli suurimmallakin putkella.'
  }
  if (riser && chosen.velocity + 1e-9 < vMin) note = 'Nousun nopeus jää alle öljynpalautusrajan.'
  return { chosen, note, riser, vMin, vPrefer, dTMax }
}

function drainSize(roomTempC) {
  const heatTraced = roomTempC < 0
  const odMm = heatTraced ? 25 : 20
  const steps = [
    {
      label: 'Kondenssivesi',
      formula: heatTraced
        ? 'Huone < 0 °C: 25 mm, eristetty ja lämmityskaapeli. Ei kylmäainemitoitusta.'
        : 'Huone ≥ 0 °C: 20 mm viettoviemäri. Ei kylmäainemitoitusta.',
      value: `${odMm} mm`,
    },
  ]
  return {
    kind: 'drain',
    odMm,
    idMm: odMm,
    inch: heatTraced ? '25 mm' : '20 mm',
    wallMm: 0,
    insulated: heatTraced,
    heatTraced,
    velocity: 0,
    massFlowKgS: 0,
    density: 0,
    pressureDropKPa: 0,
    equivalentTempK: 0,
    warnings: [],
    steps,
    label: heatTraced
      ? 'Kondenssivesi 25 mm · eristetty + lämmityskaapeli'
      : 'Kondenssivesi 20 mm',
    labelAscii: heatTraced
      ? 'Kondenssivesi 25 mm, eristetty + lammityskaapeli'
      : 'Kondenssivesi 20 mm',
  }
}

export function sizeLine({
  kind = 'suction',
  refrigerant = 'R449A',
  capacityKw = 0,
  teC = -8,
  tcC = 40,
  lengthM = 10,
  riseM = 0,
  roomTempC = 2,
} = {}) {
  if (kind === 'drain') return { ...drainSize(roomTempC), lengthM, riseM, refrigerant, capacityKw, teC, tcC, roomTempC }
  const ref = refrigerantOf(refrigerant)
  const props = properties(ref, teC, tcC)
  const kw = Math.max(0, capacityKw)
  const mass = kw / props.q0
  const rho = kind === 'liquid' ? props.rhoL : props.rhoV
  const mu = kind === 'liquid' ? MU_LIQUID : MU_VAPOR
  const length = Math.max(0.5, lengthM + Math.max(0, riseM))
  const rows = COPPER.map((tube) => tubeRow(tube, Math.max(mass, 1e-6), rho, mu, length))
  const pick = pickTube(rows, { kind, teC, riseM, dpdT: ref.dpdT })
  const row = pick.chosen
  const warnings = []
  if (pick.note) warnings.push(pick.note)
  if (ref.criticalC && tcC > ref.criticalC) {
    warnings.push(`R744 kriittinen piste on ${ref.criticalC} °C. Tc ${n(tcC, 0)} °C on kaasujäähdytinalue; tämä on seulontamitoitus, ei transkriittinen malli.`)
  }
  const title = kind === 'liquid' ? 'Nesteputki' : 'Imuputki'
  const steps = [
    {
      label: 'Massavirta',
      formula: `m = Q / q0 = ${n(kw, 2)} kW / ${n(props.q0, 1)} kJ/kg`,
      value: `${n(mass, 4)} kg/s`,
    },
    {
      label: 'Kylmäaine',
      formula: `${ref.id}, Te ${n(teC, 1)} °C, Tc ${n(tcC, 1)} °C, q0 = ${n(ref.q0, 0)} + ${n(ref.q0Te, 2)}·(Te+10) + ${n(ref.q0Tc, 2)}·(Tc-40)`,
      value: `${n(props.q0, 1)} kJ/kg`,
    },
    {
      label: 'Tiheys',
      formula: kind === 'liquid'
        ? `Nesteen tiheys ${n(props.rhoL, 0)} kg/m³`
        : `Imuhöyry ${n(ref.rhoV, 1)} + ${n(ref.rhoVTe, 2)}·(Te+10)`,
      value: `${n(rho, 1)} kg/m³`,
    },
    {
      label: 'Pituus',
      formula: `L = pohja ${n(lengthM, 2)} m + nousu ${n(Math.max(0, riseM), 2)} m`,
      value: `${n(length, 2)} m`,
    },
    {
      label: 'Kitka',
      formula: row.re < 2300
        ? `f = 64 / Re, Re = ${n(row.re, 0)}, μ = ${kind === 'liquid' ? '1.8e-4' : '1.2e-5'} Pa·s`
        : `f = 0.316 / Re^0.25, Re = ${n(row.re, 0)}`,
      value: n(row.f, 4),
    },
    {
      label: 'Putki',
      formula: `Δp = f·(L/D)·ρ·v²/2, v = ${n(row.velocity, 2)} m/s, raja ${n(pick.vMin, 1)}–${n(pick.vPrefer, 1)} m/s${pick.riser ? `, nousu ≥ ${n(pick.vMin, 0)} m/s` : ''}`,
      value: `${n(row.tube.odMm, 2)} mm (${row.tube.inch})`,
    },
    {
      label: 'Painehäviö',
      formula: `${n(row.dpKPa, 2)} kPa / ${n(ref.dpdT, 1)} kPa/K, raja ${n(pick.dTMax, 1)} K`,
      value: `${n(row.dT, 2)} K`,
    },
  ]
  return {
    kind,
    refrigerant: ref.id,
    capacityKw: kw,
    teC,
    tcC,
    lengthM,
    riseM,
    roomTempC,
    massFlowKgS: mass,
    density: rho,
    q0: props.q0,
    velocity: row.velocity,
    odMm: row.tube.odMm,
    idMm: row.idMm,
    inch: row.tube.inch,
    wallMm: row.tube.wallMm,
    pressureDropKPa: row.dpKPa,
    equivalentTempK: row.dT,
    insulated: false,
    heatTraced: false,
    warnings,
    steps,
    label: `${title} ${n(row.tube.odMm, 1)} mm (${row.tube.inch})`,
    labelAscii: `${title} ${n(row.tube.odMm, 1)} mm (${row.tube.inch})`,
  }
}

export function sizePipe(pipe, duty = {}) {
  return sizeLine({
    kind: pipe?.kind || 'suction',
    refrigerant: pipe?.refrigerant || duty.refrigerant || 'R449A',
    capacityKw: duty.capacityKw ?? pipe?.capacityKw ?? 0,
    teC: pipe?.teC ?? duty.teC ?? -8,
    tcC: pipe?.tcC ?? duty.tcC ?? 40,
    lengthM: duty.lengthM ?? routeLength(pipe?.points),
    riseM: pipe?.riseM ?? duty.riseM ?? 0,
    roomTempC: duty.roomTempC ?? pipe?.roomTempC ?? 2,
  })
}
