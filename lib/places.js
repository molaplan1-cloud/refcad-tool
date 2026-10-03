// Country and city climate, local U-value limits, electrical practice and
// the usual heating choice. Finland keeps zones I–IV. Spain uses CTE DB-HE
// zones A–E. Add a country by appending one record to COUNTRIES.

export const CLIMATE_ZONES = [
  { id: 'I', name: 'I Etelä-Suomi', outdoor: -26, summer: 28, degreeDays: 4200, cdd: 80 },
  { id: 'II', name: 'II', outdoor: -29, summer: 27, degreeDays: 4700, cdd: 50 },
  { id: 'III', name: 'III Keski-Suomi', outdoor: -32, summer: 26, degreeDays: 5200, cdd: 30 },
  { id: 'IV', name: 'IV Pohjois-Suomi', outdoor: -38, summer: 25, degreeDays: 6300, cdd: 10 },
]

export const CLIMATE_PLACES = [
  { id: 'helsinki', name: 'Helsinki', zone: 'I', lat: 60.17, winter: -26, summer: 28, hdd: 4200, cdd: 90, solar: 980 },
  { id: 'espoo', name: 'Espoo', zone: 'I', lat: 60.2, winter: -26, summer: 28, hdd: 4200, cdd: 80, solar: 970 },
  { id: 'vantaa', name: 'Vantaa', zone: 'I', lat: 60.3, winter: -26, summer: 28, hdd: 4300, cdd: 80, solar: 960 },
  { id: 'turku', name: 'Turku', zone: 'I', lat: 60.45, winter: -26, summer: 27, hdd: 4100, cdd: 70, solar: 990 },
  { id: 'hanko', name: 'Hanko', zone: 'I', lat: 59.8, winter: -22, summer: 26, hdd: 3900, cdd: 60, solar: 1000 },
  { id: 'tampere', name: 'Tampere', zone: 'II', lat: 61.5, winter: -29, summer: 27, hdd: 4700, cdd: 50, solar: 920 },
  { id: 'lahti', name: 'Lahti', zone: 'II', lat: 60.98, winter: -29, summer: 27, hdd: 4600, cdd: 55, solar: 930 },
  { id: 'pori', name: 'Pori', zone: 'II', lat: 61.48, winter: -26, summer: 26, hdd: 4400, cdd: 40, solar: 950 },
  { id: 'lappeenranta', name: 'Lappeenranta', zone: 'II', lat: 61.06, winter: -29, summer: 27, hdd: 4700, cdd: 50, solar: 910 },
  { id: 'kouvola', name: 'Kouvola', zone: 'II', lat: 60.87, winter: -29, summer: 27, hdd: 4600, cdd: 55, solar: 920 },
  { id: 'jyvaskyla', name: 'Jyväskylä', zone: 'III', lat: 62.24, winter: -32, summer: 26, hdd: 5200, cdd: 30, solar: 880 },
  { id: 'kuopio', name: 'Kuopio', zone: 'III', lat: 62.89, winter: -32, summer: 26, hdd: 5300, cdd: 30, solar: 860 },
  { id: 'seinajoki', name: 'Seinäjoki', zone: 'III', lat: 62.79, winter: -32, summer: 26, hdd: 5100, cdd: 25, solar: 890 },
  { id: 'vaasa', name: 'Vaasa', zone: 'III', lat: 63.1, winter: -30, summer: 25, hdd: 4900, cdd: 20, solar: 900 },
  { id: 'joensuu', name: 'Joensuu', zone: 'III', lat: 62.6, winter: -32, summer: 26, hdd: 5400, cdd: 25, solar: 850 },
  { id: 'oulu', name: 'Oulu', zone: 'IV', lat: 65.01, winter: -34, summer: 25, hdd: 5800, cdd: 15, solar: 820 },
  { id: 'kajaani', name: 'Kajaani', zone: 'IV', lat: 64.22, winter: -36, summer: 25, hdd: 6000, cdd: 12, solar: 800 },
  { id: 'rovaniemi', name: 'Rovaniemi', zone: 'IV', lat: 66.5, winter: -38, summer: 24, hdd: 6300, cdd: 8, solar: 760 },
  { id: 'sodankyla', name: 'Sodankylä', zone: 'IV', lat: 67.42, winter: -40, summer: 23, hdd: 6800, cdd: 5, solar: 720 },
]

const ES_ZONES = [
  { id: 'A', name: 'CTE A', outdoor: 5, summer: 34, degreeDays: 400, cdd: 1100 },
  { id: 'B', name: 'CTE B', outdoor: 2, summer: 36, degreeDays: 700, cdd: 1300 },
  { id: 'C', name: 'CTE C', outdoor: 0, summer: 32, degreeDays: 1400, cdd: 700 },
  { id: 'D', name: 'CTE D', outdoor: -3, summer: 35, degreeDays: 2000, cdd: 600 },
  { id: 'E', name: 'CTE E', outdoor: -8, summer: 30, degreeDays: 2800, cdd: 200 },
]

const SE_ZONES = [
  { id: 'I', name: 'Södra Sverige', outdoor: -16, summer: 27, degreeDays: 3200, cdd: 40 },
  { id: 'II', name: 'Mellersta Sverige', outdoor: -20, summer: 26, degreeDays: 4000, cdd: 25 },
  { id: 'III', name: 'Norra Sverige', outdoor: -30, summer: 24, degreeDays: 5500, cdd: 8 },
]

const EE_ZONES = [
  { id: 'I', name: 'Rannik', outdoor: -22, summer: 27, degreeDays: 4000, cdd: 40 },
  { id: 'II', name: 'Sisemaa', outdoor: -25, summer: 28, degreeDays: 4500, cdd: 50 },
]

const UK_ZONES = [
  { id: 'south', name: 'South', outdoor: -3, summer: 30, degreeDays: 2100, cdd: 180 },
  { id: 'north', name: 'North', outdoor: -5, summer: 26, degreeDays: 2600, cdd: 40 },
]

export const COUNTRIES = [
  {
    id: 'FI',
    zones: CLIMATE_ZONES,
    places: CLIMATE_PLACES,
    defaultZone: 'II',
    latitude: 62,
    electrical: 'sfs-6000',
    voltage: { phase: 230, line: 400 },
    heating: 'district',
    uMax: { wall: 0.17, roof: 0.09, floor: 0.16, window: 1.0 },
    structures: { exterior: 'us-timber-brick', interior: 'vs-92-wool', floor: 'ap-slab-200', roof: 'yp-blown-400' },
  },
  {
    id: 'SE',
    zones: SE_ZONES,
    defaultZone: 'II',
    latitude: 60,
    electrical: 'iec-60364',
    voltage: { phase: 230, line: 400 },
    heating: 'air-water',
    uMax: { wall: 0.18, roof: 0.13, floor: 0.15, window: 1.2 },
    structures: { exterior: 'se-timber', interior: 'vs-92-wool', floor: 'ap-slab-200', roof: 'yp-blown-400' },
    places: [
      { id: 'stockholm', name: 'Stockholm', zone: 'II', lat: 59.33, winter: -18, summer: 27, hdd: 3700, cdd: 40, solar: 980 },
      { id: 'goteborg', name: 'Göteborg', zone: 'I', lat: 57.71, winter: -16, summer: 26, hdd: 3300, cdd: 30, solar: 990 },
      { id: 'malmo', name: 'Malmö', zone: 'I', lat: 55.6, winter: -12, summer: 27, hdd: 3100, cdd: 50, solar: 1020 },
      { id: 'kiruna', name: 'Kiruna', zone: 'III', lat: 67.86, winter: -32, summer: 22, hdd: 6700, cdd: 2, solar: 700 },
    ],
  },
  {
    id: 'EE',
    zones: EE_ZONES,
    defaultZone: 'I',
    latitude: 59,
    electrical: 'iec-60364',
    voltage: { phase: 230, line: 400 },
    heating: 'air-water',
    uMax: { wall: 0.2, roof: 0.12, floor: 0.15, window: 1.1 },
    structures: { exterior: 'ee-timber', interior: 'vs-92-wool', floor: 'ap-slab-200', roof: 'yp-blown-400' },
    places: [
      { id: 'tallinn', name: 'Tallinn', zone: 'I', lat: 59.44, winter: -22, summer: 27, hdd: 4200, cdd: 40, solar: 960 },
      { id: 'tartu', name: 'Tartu', zone: 'II', lat: 58.38, winter: -25, summer: 28, hdd: 4500, cdd: 55, solar: 950 },
      { id: 'narva', name: 'Narva', zone: 'II', lat: 59.38, winter: -25, summer: 27, hdd: 4600, cdd: 40, solar: 930 },
    ],
  },
  {
    id: 'ES',
    zones: ES_ZONES,
    defaultZone: 'D',
    latitude: 40,
    electrical: 'iec-60364',
    voltage: { phase: 230, line: 400 },
    heating: 'air-water',
    uMax: { wall: 0.5, roof: 0.35, floor: 0.45, window: 1.8 },
    structures: { exterior: 'es-brick-cavity', interior: 'vs-brick', floor: 'ap-slab-100', roof: 'yp-flat' },
    places: [
      { id: 'sevilla', name: 'Sevilla', zone: 'B', lat: 37.39, winter: 2, summer: 40, hdd: 600, cdd: 1500, solar: 1850, heating: 'none', uMax: { wall: 0.7, roof: 0.5, floor: 0.7, window: 2.7 } },
      { id: 'malaga', name: 'Málaga', zone: 'A', lat: 36.72, winter: 4, summer: 34, hdd: 400, cdd: 1100, solar: 1900, heating: 'none', uMax: { wall: 0.94, roof: 0.5, floor: 0.85, window: 3.2 } },
      { id: 'valencia', name: 'Valencia', zone: 'B', lat: 39.47, winter: 2, summer: 34, hdd: 800, cdd: 1000, solar: 1700, heating: 'heat-pump' },
      { id: 'barcelona', name: 'Barcelona', zone: 'C', lat: 41.39, winter: 0, summer: 31, hdd: 1300, cdd: 650, solar: 1550, heating: 'heat-pump' },
      { id: 'madrid', name: 'Madrid', zone: 'D', lat: 40.42, winter: -3, summer: 36, hdd: 2000, cdd: 700, solar: 1650, heating: 'heat-pump', uMax: { wall: 0.41, roof: 0.35, floor: 0.41, window: 1.8 } },
      { id: 'bilbao', name: 'Bilbao', zone: 'C', lat: 43.26, winter: -1, summer: 28, hdd: 1500, cdd: 250, solar: 1250, heating: 'heat-pump' },
      { id: 'burgos', name: 'Burgos', zone: 'E', lat: 42.34, winter: -8, summer: 32, hdd: 2800, cdd: 250, solar: 1500, heating: 'heat-pump', uMax: { wall: 0.33, roof: 0.28, floor: 0.33, window: 1.6 } },
    ],
  },
  {
    id: 'UK',
    zones: UK_ZONES,
    defaultZone: 'south',
    latitude: 52,
    electrical: 'iec-60364',
    voltage: { phase: 230, line: 400 },
    heating: 'air-water',
    uMax: { wall: 0.26, roof: 0.16, floor: 0.18, window: 1.6 },
    structures: { exterior: 'us-brick-cavity', interior: 'vs-block', floor: 'ap-slab-100', roof: 'yp-pitched' },
    places: [
      { id: 'london', name: 'London', zone: 'south', lat: 51.51, winter: -3, summer: 31, hdd: 2100, cdd: 200, solar: 1050 },
      { id: 'manchester', name: 'Manchester', zone: 'north', lat: 53.48, winter: -4, summer: 26, hdd: 2500, cdd: 40, solar: 950 },
      { id: 'edinburgh', name: 'Edinburgh', zone: 'north', lat: 55.95, winter: -5, summer: 24, hdd: 2800, cdd: 15, solar: 900 },
    ],
  },
]

export function countryById(id) {
  return COUNTRIES.find((item) => item.id === id) || COUNTRIES[0]
}

export function climateOf(plan) {
  const country = countryById(plan?.country || 'FI')
  const stored = plan?.thermal || {}
  const placeId = plan?.place || stored.place || ''
  const place = country.places.find((item) => item.id === placeId) || null
  const zoneId = place?.zone || stored.zone || country.defaultZone
  const zone = country.zones.find((item) => item.id === zoneId) || country.zones[0]
  const usePlace = Boolean(place)
  return {
    country: country.id,
    countryName: country.id,
    zone: zone.id,
    zoneName: zone.name,
    place: place?.id || '',
    placeName: place?.name || '',
    outdoor: usePlace ? place.winter : zone.outdoor,
    summer: usePlace ? place.summer : zone.summer,
    degreeDays: usePlace ? place.hdd : zone.degreeDays,
    coolingDegreeDays: usePlace ? place.cdd : zone.cdd,
    latitude: Number.isFinite(Number(plan?.latitude)) ? Number(plan.latitude) : (usePlace ? place.lat : country.latitude),
    solar: usePlace ? place.solar : 1000,
    electrical: country.electrical,
    voltage: country.voltage,
    uMax: place?.uMax || country.uMax,
    heating: place?.heating || country.heating,
    structures: country.structures,
  }
}

export function heatingPatchFor(climate) {
  if (!climate) return null
  if (climate.heating === 'none') return { source: 'direct-electric', distribution: 'none', supplementAir: false }
  if (climate.heating === 'heat-pump' || climate.heating === 'air-water') return { source: 'air-water', distribution: 'floor', supplementAir: true }
  if (climate.heating === 'district') return { source: 'district', distribution: 'floor', supplementAir: false }
  return null
}

export function countryPatch(plan, countryId, placeId = '') {
  const country = countryById(countryId)
  const place = country.places.find((item) => item.id === placeId) || null
  const zone = place?.zone || country.defaultZone
  return {
    country: country.id,
    place: place?.id || null,
    thermal: { ...(plan?.thermal || {}), zone, place: place?.id || '' },
  }
}
