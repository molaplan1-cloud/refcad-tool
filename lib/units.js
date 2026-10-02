// Display conversion only. The model and the heat-load engine stay in SI
// (metres, °C, watts). IP is feet / °F / BTU/h for the screen and the report.

const METRES_PER_FOOT = 0.3048
const BTU_PER_WATT = 3.412141633

export function lengthUnit(system) {
  return system === 'IP' ? 'ft' : 'm'
}

export function tempUnit(system) {
  return system === 'IP' ? '°F' : '°C'
}

export function toLength(metres, system) {
  if (!Number.isFinite(metres)) return 0
  return system === 'IP' ? metres / METRES_PER_FOOT : metres
}

export function fromLength(value, system) {
  if (!Number.isFinite(value)) return 0
  return system === 'IP' ? value * METRES_PER_FOOT : value
}

export function toTemp(celsius, system) {
  if (!Number.isFinite(celsius)) return 0
  return system === 'IP' ? (celsius * 9) / 5 + 32 : celsius
}

export function fromTemp(value, system) {
  if (!Number.isFinite(value)) return 0
  return system === 'IP' ? ((value - 32) * 5) / 9 : value
}

export function wattsToBtu(watts) {
  return watts * BTU_PER_WATT
}

/** Canvas label: metres, or feet and inches. */
export function formatLength(metres, system) {
  if (!Number.isFinite(metres)) return '—'
  if (system === 'IP') {
    const totalInches = metres / METRES_PER_FOOT * 12
    const sign = totalInches < 0 ? '-' : ''
    const abs = Math.abs(totalInches)
    let feet = Math.floor(abs / 12)
    let inches = Math.round(abs - feet * 12)
    if (inches === 12) {
      feet += 1
      inches = 0
    }
    return `${sign}${feet}' ${inches}"`
  }
  if (Math.abs(metres) < 1) return `${Math.round(metres * 1000)} mm`
  return `${metres.toFixed(2)} m`
}

export function formatTemp(celsius, system, digits = 1) {
  if (!Number.isFinite(celsius)) return '—'
  if (system === 'IP') return `${toTemp(celsius, 'IP').toFixed(digits)} °F`
  return `${celsius.toFixed(digits)} °C`
}

export function formatPower(watts, system) {
  if (!Number.isFinite(watts)) return '—'
  if (system === 'IP') {
    const btu = wattsToBtu(watts)
    return `${Math.round(btu).toLocaleString('fi-FI')} BTU/h`
  }
  const abs = Math.abs(watts)
  if (abs >= 1000) return `${(watts / 1000).toFixed(2)} kW`
  return `${Math.round(watts)} W`
}

export function formatKw(watts) {
  if (!Number.isFinite(watts)) return '—'
  return `${(watts / 1000).toFixed(2)} kW`
}
