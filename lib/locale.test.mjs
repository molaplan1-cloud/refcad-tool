import assert from 'node:assert/strict'
import test from 'node:test'
import { MESSAGES, MESSAGE_KEYS } from './messages.js'
import { formatNumber, translate } from './i18n.js'
import { climateOf, heatingPatchFor } from './places.js'
import { bearingOf, compassCode, sideCompass } from './orientation.js'
import { coincidentPeak, coolingLoad, solarPosition } from './cooling.js'
import { emptyPlan } from './floorplan.js'
import { thermalOf } from './roominfo.js'

test('every language has the same message keys', () => {
  const finnish = Object.keys(MESSAGES.fi).sort()
  assert.deepEqual(finnish, [...MESSAGE_KEYS].sort())
  Object.keys(MESSAGES).forEach((id) => {
    assert.deepEqual(Object.keys(MESSAGES[id]).sort(), finnish, id)
    finnish.forEach((key) => assert.equal(typeof MESSAGES[id][key], 'string'))
  })
  assert.equal(translate('es', 'file.house'), 'Ajustes de la casa')
  assert.equal(translate('de', 'tool.select'), 'Valitse')
  assert.equal(translate('en', 'missing.key'), 'missing.key')
  assert.equal(formatNumber(1.5, 'en', 1), '1.5')
  assert.ok(formatNumber(1.5, 'fi', 1).includes(','))
  assert.ok(formatNumber(1.5, 'es', 1).includes(','))
})

test('location climate drives winter, summer and the electrical code', () => {
  const north = climateOf({ thermal: { zone: 'IV' } })
  assert.equal(north.outdoor, -38)
  assert.equal(north.country, 'FI')
  assert.equal(north.electrical, 'sfs-6000')
  const helsinki = thermalOf({ ...emptyPlan(), thermal: { zone: 'I', place: 'helsinki' } })
  assert.equal(helsinki.outdoor, -26)
  assert.equal(helsinki.degreeDays, 4200)
  assert.equal(helsinki.placeName, 'Helsinki')
  const sevilla = climateOf({ country: 'ES', place: 'sevilla', thermal: { place: 'sevilla', zone: 'B' } })
  assert.equal(sevilla.heating, 'none')
  assert.ok(sevilla.summer >= 35)
  assert.equal(sevilla.electrical, 'iec-60364')
  assert.equal(heatingPatchFor(sevilla).distribution, 'none')
  const sweden = climateOf({ country: 'SE', thermal: { zone: 'II' } })
  assert.equal(sweden.electrical, 'iec-60364')
  assert.ok(sweden.uMax.wall > 0.17)
  const madrid = climateOf({ country: 'ES', place: 'madrid' })
  assert.equal(madrid.zone, 'D')
  assert.equal(madrid.heating, 'heat-pump')
})

test('north angle turns plan axes into compass bearings', () => {
  assert.equal(compassCode(bearingOf(1, 0, 0)), 'E')
  assert.equal(compassCode(bearingOf(0, 1, 0)), 'S')
  assert.equal(compassCode(bearingOf(1, 0, 90)), 'N')
  assert.equal(sideCompass('north', 0), 'N')
  assert.equal(sideCompass('north', 90), 'W')
  assert.equal(sideCompass('east', 0), 'E')
})

test('south glazing needs more cooling than north, and shading cuts the peak', () => {
  const noon = solarPosition(60, 12)
  assert.ok(noon.alt > 53 && noon.alt < 54)
  assert.ok(noon.az > 175 && noon.az < 185)
  const base = {
    latitude: 60,
    summer: 28,
    setpoint: 21,
    floorArea: 20,
    height: 2.6,
    ventilation: 0.35,
    n50: 1,
    roofArea: 20,
    roofU: 0.09,
    roomType: 'olohuone',
    walls: [{ area: 12, u: 0.17, bearing: 180 }],
  }
  const window = { area: 6, height: 1.5, u: 1.1, g: 0.63, frameFraction: 0.18, shading: 'none' }
  const south = coolingLoad({ ...base, windows: [{ ...window, bearing: 180 }] })
  const north = coolingLoad({ ...base, windows: [{ ...window, bearing: 0 }] })
  const shaded = coolingLoad({ ...base, windows: [{ ...window, bearing: 180, shading: 'blind' }] })
  assert.ok(south.watts > north.watts)
  assert.ok(shaded.watts < south.watts)
  assert.ok(south.hour >= 10 && south.hour <= 17)
  assert.equal(south.overheat, true)
  assert.equal(north.overheat, false)
  assert.ok(south.parts.some((part) => part.id === 'solar' && part.watts > 100))
  const house = coincidentPeak([south, north])
  assert.ok(house.watts <= south.watts + north.watts + 1)
  assert.ok(house.watts >= Math.max(south.watts, north.watts) - 1)
  assert.equal(south.equipment.kind, 'split')
})
