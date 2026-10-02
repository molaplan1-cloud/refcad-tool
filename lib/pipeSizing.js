// Screening pipe sizes for a refrigeration proposal. Saturation properties are
// linearised around Te = -10 °C and Tc = 40 °C so every step can be recomputed.
// R449A is anchored to the TEGA saturation table: q0 = h_vapour(Te) − h_liquid(Tc),
// suction density at the dew point, liquid density at Tc. Friction is Swamee–Jain
// for turbulent flow (drawn-copper roughness 0.0015 mm) and 64/Re only below
// Re 2300. Limits follow the usual ASHRAE / Hussmann screening rules: suction
// equivalent drop about 2 °F (1.1 K), riser velocity at least 6 m/s (1 200 ft/min),
// liquid velocity under about 1.5 m/s (300 ft/min). This is not a manufacturer chart.
// R744 above about 31 °C is a gas-cooler note, not a transcritical model.

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
// q0Te / q0Tc are kJ/kg per K. rhoVTe is kg/m³ per K.
// dpdT is the suction dew-point slope, kPa per K. dpdTLiq is the same slope at Tc,
// which is what turns a liquid-line pressure drop into an equivalent temperature drop.
export const REFRIGERANTS = {
  // rhoDis is saturation vapour density at Tc = 40 °C (discharge / hot gas), kg/m³.
  R404A: { id: 'R404A', q0: 118, q0Te: 1.15, q0Tc: -0.85, rhoV: 16.5, rhoVTe: 0.55, rhoL: 1040, rhoDis: 66, rhoDisTc: 1.8, dpdT: 15, dpdTLiq: 40 },
  R449A: { id: 'R449A', q0: 132.9, q0Te: 0.52, q0Tc: -1.66, rhoV: 15.97, rhoVTe: 0.59, rhoL: 1025, rhoDis: 70, rhoDisTc: 1.7, dpdT: 13.0, dpdTLiq: 42.5 },
  R452A: { id: 'R452A', q0: 128, q0Te: 1.05, q0Tc: -0.9, rhoV: 17, rhoVTe: 0.52, rhoL: 1080, rhoDis: 68, rhoDisTc: 1.7, dpdT: 14, dpdTLiq: 40 },
  R134a: { id: 'R134a', q0: 148, q0Te: 0.9, q0Tc: -0.85, rhoV: 8.5, rhoVTe: 0.32, rhoL: 1147, rhoDis: 38, rhoDisTc: 1.1, dpdT: 7.5, dpdTLiq: 25 },
  R290: { id: 'R290', q0: 290, q0Te: 1.3, q0Tc: -1.2, rhoV: 5.2, rhoVTe: 0.18, rhoL: 470, rhoDis: 22, rhoDisTc: 0.6, dpdT: 10, dpdTLiq: 35 },
  R744: { id: 'R744', q0: 200, q0Te: 2.2, q0Tc: -1.6, rhoV: 60, rhoVTe: 1.8, rhoL: 900, rhoDis: 140, rhoDisTc: 4, dpdT: 120, dpdTLiq: 120, criticalC: 31 },
}

export const REFRIGERANT_IDS = Object.keys(REFRIGERANTS)

const MU_VAPOR = 1.2e-5
const MU_LIQUID = 1.8e-4
const COPPER_ROUGHNESS_M = 0.0015e-3
const SUCTION_DT_MAX = 1.1
const LIQUID_DT_MAX = 1.1

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
  const rhoDis = Math.max(2, (ref.rhoDis || ref.rhoV * 4) + (ref.rhoDisTc || 1) * (tcC - 40))
  return { q0, rhoV, rhoL, rhoDis }
}

function frictionFactor(re, idM) {
  if (!(re > 1)) return 0
  if (re < 2300) return 64 / re
  const relative = COPPER_ROUGHNESS_M / (3.7 * idM) + 5.74 / (re ** 0.9)
  const log = Math.log10(Math.max(relative, 1e-12))
  return 0.25 / (log * log)
}

function tubeRow(tube, mass, rho, mu, lengthM) {
  const idM = (tube.odMm - 2 * tube.wallMm) / 1000
  const area = (Math.PI * idM * idM) / 4
  const velocity = mass / (rho * Math.max(area, 1e-9))
  const re = (rho * velocity * idM) / mu
  const f = frictionFactor(re, idM)
  const dpPa = f * (lengthM / idM) * rho * velocity * velocity / 2
  return { tube, idMm: idM * 1000, velocity, re, f, laminar: re < 2300, dpKPa: dpPa / 1000 }
}

function pickTube(rows, { kind, teC, riseM, dpdT, liquidService }) {
  const vapor = kind === 'suction' || kind === 'hotgas'
  const riser = vapor && riseM > 0.3
  let vMin = 0.4
  let vPrefer = 1.5
  let vHard = 2
  let dTMax = LIQUID_DT_MAX
  if (kind === 'suction') {
    vMin = riser ? (teC < -10 ? 8 : 6) : 3.6
    vPrefer = 15
    vHard = 20
    dTMax = SUCTION_DT_MAX
  } else if (kind === 'hotgas') {
    vMin = riser ? 8 : 5
    vPrefer = 15
    vHard = 20
    dTMax = SUCTION_DT_MAX
  } else if (liquidService === 'return') {
    vMin = 0.15
    vPrefer = 0.8
    vHard = 1.2
    dTMax = LIQUID_DT_MAX
  }
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

function lineTitle(kind, liquidService) {
  if (kind === 'hotgas') return 'Kuumakaasuputki'
  if (kind === 'liquid' && liquidService === 'return') return 'Nesteputki, lauhdutin–vastaanotin'
  if (kind === 'liquid') return 'Nesteputki'
  return 'Imuputki'
}

function missingWarning(kind) {
  if (kind === 'hotgas') return 'Liitä kuumakaasuputki kompressoriin ja lauhduttimeen tai syötä teho.'
  if (kind === 'liquid') return 'Liitä nesteputki vastaanottimeen tai höyrystimeen tai syötä teho.'
  return 'Liitä putki höyrystimeen tai syötä teho.'
}

function missingCapacity(kind, extra) {
  const title = lineTitle(kind, extra.liquidService)
  return {
    kind,
    missingCapacity: true,
    odMm: 0,
    idMm: 0,
    inch: '',
    wallMm: 0,
    insulated: false,
    heatTraced: false,
    velocity: 0,
    massFlowKgS: 0,
    density: 0,
    pressureDropKPa: 0,
    equivalentTempK: 0,
    warnings: [missingWarning(kind)],
    steps: [{
      label: 'Teho',
      formula: extra.capacityNote || 'Q = 0 kW. Putkea ei mitoiteta ilman tehoa.',
      value: '0 kW',
    }],
    label: `${title} — teho puuttuu`,
    labelAscii: `${title} - teho puuttuu`,
    ...extra,
  }
}

function finishLine({ kind, liquidService, ref, props, kw, teC, tcC, lengthM, riseM, roomTempC, capacityNote, mass, rho, mu, dpdT, length, row, pick, title, extraSteps = [] }) {
  const warnings = []
  if (pick.note) warnings.push(pick.note)
  if (row.laminar) warnings.push('Virtaus on laminaari. Tarkista teho ja putkikoko.')
  if (ref.criticalC && tcC > ref.criticalC) {
    warnings.push(`R744 kriittinen piste on ${ref.criticalC} °C. Tc ${n(tcC, 0)} °C on kaasujäähdytinalue; tämä on seulontamitoitus, ei transkriittinen malli.`)
  }
  const densityFormula = kind === 'liquid'
    ? `Nesteen tiheys ${n(props.rhoL, 0)} kg/m³`
    : kind === 'hotgas'
      ? `Painekaasu Tc:ssä ${n(ref.rhoDis, 0)} + ${n(ref.rhoDisTc, 1)}·(Tc-40)`
      : `Imuhöyry ${n(ref.rhoV, 1)} + ${n(ref.rhoVTe, 2)}·(Te+10)`
  const slopeWhere = kind === 'suction' ? 'Te' : 'Tc'
  const steps = [
    {
      label: 'Teho',
      formula: capacityNote || 'Annettu jäähdytysteho Q',
      value: `${n(kw, 2)} kW`,
    },
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
      formula: densityFormula,
      value: `${n(rho, 1)} kg/m³`,
    },
    {
      label: 'Pituus',
      formula: `L = pohja ${n(lengthM, 2)} m + nousu ${n(Math.max(0, riseM), 2)} m`,
      value: `${n(length, 2)} m`,
    },
    ...extraSteps,
    {
      label: 'Kitka',
      formula: row.laminar
        ? `f = 64 / Re (laminaari), Re = ${n(row.re, 0)}, μ = ${kind === 'liquid' ? '1.8e-4' : '1.2e-5'} Pa·s`
        : `f = Swamee-Jain, ε = 0.0015 mm, Re = ${n(row.re, 0)}`,
      value: n(row.f, 4),
    },
    {
      label: 'Putki',
      formula: `Δp = f·(L/D)·ρ·v²/2, v = ${n(row.velocity, 2)} m/s, raja ${n(pick.vMin, 1)}–${n(pick.vPrefer, 1)} m/s${pick.riser ? `, nousu ≥ ${n(pick.vMin, 0)} m/s` : ''}`,
      value: `${n(row.tube.odMm, 2)} mm (${row.tube.inch})`,
    },
    {
      label: 'Painehäviö',
      formula: `${n(row.dpKPa, 2)} kPa / ${n(dpdT, 1)} kPa/K (${slopeWhere}), raja ${n(pick.dTMax, 1)} K`,
      value: `${n(row.dT, 2)} K`,
    },
  ]
  const ascii = title.replace('–', '-')
  return {
    kind,
    liquidService: liquidService || 'supply',
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
    labelAscii: `${ascii} ${n(row.tube.odMm, 1)} mm (${row.tube.inch})`,
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
  capacityNote = '',
  liquidService = 'supply',
} = {}) {
  if (kind === 'drain') return { ...drainSize(roomTempC), lengthM, riseM, refrigerant, capacityKw, teC, tcC, roomTempC }
  const ref = refrigerantOf(refrigerant)
  const props = properties(ref, teC, tcC)
  const kw = Math.max(0, capacityKw)
  const title = lineTitle(kind, liquidService)
  if (kw <= 0.05) {
    return missingCapacity(kind, { refrigerant: ref.id, capacityKw: 0, teC, tcC, lengthM, riseM, roomTempC, capacityNote, q0: props.q0, liquidService })
  }
  const mass = kw / props.q0
  const rho = kind === 'liquid' ? props.rhoL : kind === 'hotgas' ? props.rhoDis : props.rhoV
  const mu = kind === 'liquid' ? MU_LIQUID : MU_VAPOR
  const dpdT = kind === 'suction' ? ref.dpdT : (ref.dpdTLiq || ref.dpdT)
  const length = Math.max(0.5, lengthM + Math.max(0, riseM))
  const rows = COPPER.map((tube) => tubeRow(tube, mass, rho, mu, length))
  if (kind === 'liquid' && liquidService === 'return') {
    const supply = sizeLine({
      kind: 'liquid', refrigerant, capacityKw: kw, teC, tcC, lengthM, riseM, roomTempC, capacityNote, liquidService: 'supply',
    })
    const idx = COPPER.findIndex((tube) => tube.odMm === supply.odMm)
    const bumped = idx >= 0 && idx < COPPER.length - 1
    const tube = COPPER[Math.min(COPPER.length - 1, Math.max(0, idx + 1))]
    const row = tubeRow(tube, mass, rho, mu, length)
    const dT = row.dpKPa / Math.max(dpdT, 0.1)
    const chosen = { ...row, dT, vMin: 0.15, vPrefer: 0.8, vHard: 1.2, dTMax: LIQUID_DT_MAX }
    return finishLine({
      kind, liquidService, ref, props, kw, teC, tcC, lengthM, riseM, roomTempC, capacityNote,
      mass, rho, mu, dpdT, length, row: chosen, pick: { chosen, note: '', riser: false, vMin: 0.15, vPrefer: 0.8, dTMax: LIQUID_DT_MAX }, title,
      extraSteps: [{
        label: 'Vastaanotinlinja',
        formula: bumped
          ? `Lauhdutin–vastaanotin on yhtä kokoa suurempi (${supply.inch} → ${tube.inch}) kuin samalla teholla mitoitettu nesteputki paisuntaventtiilille. Lauhduttimelta lähtevä neste voi sisältää kaasukuplia, joten linja pidetään väljänä.`
          : 'Lauhdutin–vastaanotin on jo suurimmassa putkikossa. Kokoa ei kasvatettu.',
        value: `${n(tube.odMm, 2)} mm (${tube.inch})`,
      }],
    })
  }
  const pick = pickTube(rows, { kind, teC, riseM, dpdT, liquidService })
  return finishLine({
    kind, liquidService, ref, props, kw, teC, tcC, lengthM, riseM, roomTempC, capacityNote,
    mass, rho, mu, dpdT, length, row: pick.chosen, pick, title,
  })
}

export function sizePipe(pipe, duty = {}) {
  return sizeLine({
    kind: pipe?.kind || 'suction',
    refrigerant: pipe?.refrigerant || duty.refrigerant || 'R449A',
    capacityKw: duty.capacityKw ?? pipe?.capacityKw ?? 0,
    capacityNote: duty.capacityNote || '',
    teC: pipe?.teC ?? duty.teC ?? -8,
    tcC: pipe?.tcC ?? duty.tcC ?? 40,
    lengthM: duty.lengthM ?? routeLength(pipe?.points),
    riseM: pipe?.riseM ?? duty.riseM ?? 0,
    roomTempC: duty.roomTempC ?? pipe?.roomTempC ?? 2,
    liquidService: duty.liquidService || (pipe?.segment === 'return' ? 'return' : 'supply'),
  })
}
