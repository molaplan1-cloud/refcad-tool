// Furniture and fixture catalog for Pohjakuva.
// Sizes are metres. Water point ids match WATER_POINTS. Electric kinds match the device list.

export const FURNITURE_GROUPS = [
  'WC',
  'Kylpyhuone',
  'Sauna',
  'Keittiö',
  'Olohuone',
  'Makuuhuone',
  'Kodinhoitohuone',
  'Eteinen',
  'Työhuone',
  'Autotalli',
]

function power(kind, voltage, watts, extra = {}) {
  return {
    kind,
    voltage,
    power: watts,
    role: extra.role || (voltage >= 300 || watts >= 2000 ? 'power' : 'socket'),
    dedicated: extra.dedicated != null ? extra.dedicated : watts >= 2000 || voltage >= 300,
    connection: extra.connection || (watts >= 2000 ? 'fixed' : 'socket'),
    name: extra.name,
    y: extra.y,
  }
}

function item(entry) {
  const variants = entry.variants || null
  const first = variants?.[0]
  return {
    h: 0.85,
    symbol: entry.id,
    body: entry.symbol || entry.id,
    rooms: [],
    water: null,
    drain: null,
    electric: null,
    ...entry,
    w: entry.w || first?.w,
    d: entry.d || first?.d,
    h: entry.h || first?.h || 0.85,
    variants,
  }
}

export const FURNITURE = [
  item({
    id: 'toilet', group: 'WC', rooms: ['wc', 'kylpyhuone'], name: 'WC-istuin', symbol: 'toilet', body: 'toilet', h: 0.4,
    water: 'wc', drain: 'fixture',
    variants: [
      { id: 'floor', name: 'Lattia-WC', w: 0.4, d: 0.68, h: 0.4, symbol: 'toilet' },
      { id: 'wall', name: 'Seinä-WC', w: 0.38, d: 0.54, h: 0.4, symbol: 'toilet-wall' },
    ],
  }),
  item({ id: 'bidet', group: 'WC', rooms: ['wc', 'kylpyhuone'], name: 'Bidee', symbol: 'bidet', body: 'bidet', w: 0.38, d: 0.6, h: 0.4, water: 'basin', drain: 'fixture' }),
  item({ id: 'bidet-spray', group: 'WC', rooms: ['wc', 'kylpyhuone'], name: 'Bidesuihku', symbol: 'spray', body: 'spray', w: 0.12, d: 0.16, h: 0.9, water: 'basin', drain: null }),
  item({
    id: 'basin', group: 'WC', rooms: ['wc', 'kylpyhuone', 'kodinhoitohuone'], name: 'Pesuallas', symbol: 'basin', body: 'basin', h: 0.85,
    water: 'basin', drain: 'fixture',
    variants: [
      { id: '600', name: 'Allas 600', w: 0.6, d: 0.46, h: 0.85 },
      { id: '450', name: 'Allas 450', w: 0.45, d: 0.38, h: 0.85 },
      { id: '800', name: 'Allas 800', w: 0.8, d: 0.48, h: 0.85 },
    ],
  }),
  item({ id: 'vanity', group: 'WC', rooms: ['wc', 'kylpyhuone'], name: 'Allaskaappi', symbol: 'vanity', body: 'vanity', w: 0.6, d: 0.47, h: 0.85, water: 'basin', drain: 'fixture',
    variants: [
      { id: '600', name: 'Kaappi 600', w: 0.6, d: 0.47, h: 0.85 },
      { id: '800', name: 'Kaappi 800', w: 0.8, d: 0.47, h: 0.85 },
      { id: '1000', name: 'Kaappi 1000', w: 1.0, d: 0.47, h: 0.85 },
    ],
  }),
  item({ id: 'mirror-cab', group: 'WC', rooms: ['wc', 'kylpyhuone', 'eteinen'], name: 'Peilikaappi', symbol: 'mirror-cab', body: 'mirror-cab', w: 0.6, d: 0.14, h: 0.7 }),
  item({ id: 'mirror', group: 'WC', rooms: ['wc', 'kylpyhuone', 'eteinen', 'makuuhuone'], name: 'Peili', symbol: 'mirror', body: 'mirror', w: 0.5, d: 0.04, h: 0.7 }),
  item({ id: 'paper', group: 'WC', rooms: ['wc', 'kylpyhuone'], name: 'Paperiteline', symbol: 'paper', body: 'paper', w: 0.16, d: 0.12, h: 0.7 }),
  item({ id: 'hooks', group: 'WC', rooms: ['wc', 'kylpyhuone', 'eteinen'], name: 'Pyyhekoukut', symbol: 'hooks', body: 'hooks', w: 0.32, d: 0.08, h: 1.2 }),
  item({ id: 'floor-drain', group: 'WC', rooms: ['wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone'], name: 'Lattiakaivo', symbol: 'drain', body: 'drain', w: 0.15, d: 0.15, h: 0.02, drain: 'floor' }),
  item({ id: 'wc-store', group: 'WC', rooms: ['wc'], name: 'Säilytyskaappi', symbol: 'cabinet', body: 'cabinet', w: 0.4, d: 0.32, h: 0.8 }),

  item({
    id: 'washer', group: 'Kylpyhuone', rooms: ['kylpyhuone', 'kodinhoitohuone'], name: 'Pesukone', symbol: 'washer', body: 'washer', w: 0.6, d: 0.6, h: 0.85,
    water: 'washer', drain: 'fixture', electric: power('washer', 230, 2200, { name: 'Pesukone', y: 0.3 }),
  }),
  item({
    id: 'dryer', group: 'Kylpyhuone', rooms: ['kylpyhuone', 'kodinhoitohuone'], name: 'Kuivausrumpu', symbol: 'dryer', body: 'washer', w: 0.6, d: 0.62, h: 0.85,
    electric: power('dryer', 230, 2500, { name: 'Kuivausrumpu', y: 0.3 }),
  }),
  item({
    id: 'laundry-stack', group: 'Kylpyhuone', rooms: ['kylpyhuone', 'kodinhoitohuone'], name: 'Pesukone + rumpu', symbol: 'stack', body: 'stack', w: 0.6, d: 0.64, h: 1.7,
    water: 'washer', drain: 'fixture', electric: power('washer', 230, 4500, { name: 'Pesutorni', y: 0.3 }),
  }),
  item({ id: 'dry-cabinet', group: 'Kylpyhuone', rooms: ['kylpyhuone', 'kodinhoitohuone'], name: 'Kuivauskaappi', symbol: 'dry-cab', body: 'tall', w: 0.6, d: 0.62, h: 1.9, electric: power('dryer', 230, 2000, { name: 'Kuivauskaappi', y: 0.4 }) }),
  item({
    id: 'shower', group: 'Kylpyhuone', rooms: ['kylpyhuone', 'wc'], name: 'Suihku', symbol: 'shower', body: 'shower', h: 2.0, water: 'shower', drain: 'floor',
    variants: [
      { id: 'open', name: 'Avoin suihku', w: 0.9, d: 0.9, h: 2.0, symbol: 'shower' },
      { id: 'cabin', name: 'Suihkukaappi', w: 0.9, d: 0.9, h: 2.05, symbol: 'shower-cabin' },
      { id: 'corner', name: 'Kulmasuihku', w: 0.9, d: 0.9, h: 2.0, symbol: 'shower-corner' },
      { id: 'walk', name: 'Walk-in', w: 1.2, d: 0.9, h: 2.0, symbol: 'shower-walk' },
      { id: 'screen', name: 'Suihkuseinä', w: 0.9, d: 0.8, h: 2.0, symbol: 'shower-screen' },
    ],
  }),
  item({
    id: 'bath', group: 'Kylpyhuone', rooms: ['kylpyhuone'], name: 'Kylpyamme', symbol: 'bath', body: 'bath', h: 0.58, water: 'bath', drain: 'fixture',
    variants: [
      { id: 'standard', name: 'Amme 1700', w: 1.7, d: 0.75, h: 0.58 },
      { id: 'small', name: 'Amme 1500', w: 1.5, d: 0.7, h: 0.56 },
    ],
  }),
  item({ id: 'spa', group: 'Kylpyhuone', rooms: ['kylpyhuone'], name: 'Poreamme', symbol: 'spa', body: 'bath', w: 1.8, d: 0.8, h: 0.62, water: 'bath', drain: 'fixture', electric: power('spa', 230, 2000, { name: 'Poreamme', y: 0.3 }) }),
  item({ id: 'soap', group: 'Kylpyhuone', rooms: ['kylpyhuone'], name: 'Saippuateline', symbol: 'soap', body: 'soap', w: 0.14, d: 0.1, h: 1.1 }),
  item({ id: 'shower-bench', group: 'Kylpyhuone', rooms: ['kylpyhuone', 'sauna'], name: 'Suihkupenkki', symbol: 'stool', body: 'stool', w: 0.36, d: 0.32, h: 0.45 }),
  item({ id: 'shower-rail', group: 'Kylpyhuone', rooms: ['kylpyhuone'], name: 'Suihkutanko', symbol: 'rail', body: 'rail', w: 0.7, d: 0.08, h: 2.0 }),
  item({ id: 'towel-rad', group: 'Kylpyhuone', rooms: ['kylpyhuone', 'wc'], name: 'Pyyhekuivain', symbol: 'towel-rad', body: 'towel-rad', w: 0.5, d: 0.1, h: 1.2, electric: power('towel', 230, 100, { name: 'Pyyhekuivain', dedicated: false, role: 'socket', y: 0.4 }) }),
  item({ id: 'litter', group: 'Kylpyhuone', rooms: ['kylpyhuone', 'kodinhoitohuone', 'eteinen'], name: 'Kissan hiekkalaatikko', symbol: 'litter', body: 'box', w: 0.5, d: 0.38, h: 0.16 }),
  item({ id: 'hamper', group: 'Kylpyhuone', rooms: ['kylpyhuone', 'kodinhoitohuone', 'makuuhuone'], name: 'Pyykkikori', symbol: 'basket', body: 'basket', w: 0.4, d: 0.3, h: 0.55 }),

  item({
    id: 'heater', group: 'Sauna', rooms: ['sauna'], name: 'Kiuas', symbol: 'heater', body: 'heater', h: 0.7,
    variants: [
      { id: 'electric', name: 'Sähkökiuas', w: 0.45, d: 0.45, h: 0.75, symbol: 'heater', electric: power('heater', 400, 9000, { name: 'Sähkökiuas', y: 0.4 }) },
      { id: 'wood', name: 'Puukiuas', w: 0.5, d: 0.5, h: 0.8, symbol: 'heater-wood', electric: null },
    ],
  }),
  item({
    id: 'bench', group: 'Sauna', rooms: ['sauna'], name: 'Lauteet', symbol: 'sauna-bench', body: 'sauna-bench', h: 1.15,
    variants: [
      { id: 'two', name: 'Kaksi tasoa', w: 1.8, d: 0.7, h: 0.95, symbol: 'sauna-bench' },
      { id: 'three', name: 'Kolme tasoa', w: 2.0, d: 1.05, h: 1.2, symbol: 'sauna-bench-3' },
    ],
  }),
  item({ id: 'sauna-door', group: 'Sauna', rooms: ['sauna'], name: 'Saunan ovi', symbol: 'sauna-door', body: 'sauna-door', w: 0.8, d: 0.09, h: 1.9 }),
  item({ id: 'bucket', group: 'Sauna', rooms: ['sauna'], name: 'Kiulu', symbol: 'bucket', body: 'bucket', w: 0.28, d: 0.28, h: 0.22 }),

  item({
    id: 'cabinet', group: 'Keittiö', rooms: ['keittio'], name: 'Alakaappi', symbol: 'base-cab', body: 'base-cab', h: 0.9,
    variants: [
      { id: '600', name: '600 mm', w: 0.6, d: 0.6, h: 0.9 },
      { id: '300', name: '300 mm', w: 0.3, d: 0.6, h: 0.9 },
      { id: '450', name: '450 mm', w: 0.45, d: 0.6, h: 0.9 },
      { id: '800', name: '800 mm', w: 0.8, d: 0.6, h: 0.9 },
      { id: '900', name: '900 mm', w: 0.9, d: 0.6, h: 0.9 },
    ],
  }),
  item({
    id: 'wall-cab', group: 'Keittiö', rooms: ['keittio'], name: 'Yläkaappi', symbol: 'wall-cab', body: 'wall-cab', h: 0.7,
    variants: [
      { id: '600', name: '600 mm', w: 0.6, d: 0.35, h: 0.7 },
      { id: '300', name: '300 mm', w: 0.3, d: 0.35, h: 0.7 },
      { id: '800', name: '800 mm', w: 0.8, d: 0.35, h: 0.7 },
    ],
  }),
  item({
    id: 'sink', group: 'Keittiö', rooms: ['keittio'], name: 'Tiskiallas', symbol: 'sink', body: 'sink', h: 0.9, water: 'sink', drain: 'fixture',
    variants: [
      { id: 'single', name: 'Yksi allas', w: 0.6, d: 0.6, h: 0.9, symbol: 'sink' },
      { id: 'double', name: 'Kaksi allasta', w: 1.2, d: 0.6, h: 0.9, symbol: 'sink-double' },
    ],
  }),
  item({ id: 'stove', group: 'Keittiö', rooms: ['keittio'], name: 'Liesi', symbol: 'hob', body: 'hob', w: 0.6, d: 0.6, h: 0.9, electric: power('stove', 400, 7600, { name: 'Liesi', y: 0.9 }),
    variants: [
      { id: 'induction', name: 'Induktio', w: 0.6, d: 0.6, h: 0.9, symbol: 'hob' },
      { id: 'ceramic', name: 'Keraaminen', w: 0.6, d: 0.6, h: 0.9, symbol: 'hob' },
    ],
  }),
  item({ id: 'oven', group: 'Keittiö', rooms: ['keittio'], name: 'Uuni', symbol: 'oven', body: 'oven', w: 0.6, d: 0.57, h: 0.6, electric: power('oven', 230, 3500, { name: 'Uuni', y: 0.4 }) }),
  item({ id: 'microwave', group: 'Keittiö', rooms: ['keittio'], name: 'Mikro', symbol: 'micro', body: 'micro', w: 0.5, d: 0.35, h: 0.3, electric: power('microwave', 230, 1200, { name: 'Mikro', dedicated: false, y: 1.2 }) }),
  item({ id: 'hood', group: 'Keittiö', rooms: ['keittio'], name: 'Liesituuletin', symbol: 'hood', body: 'hood', w: 0.6, d: 0.5, h: 0.4, electric: power('hood', 230, 200, { name: 'Liesituuletin', dedicated: false, role: 'socket', y: 1.6 }) }),
  item({ id: 'fridge', group: 'Keittiö', rooms: ['keittio'], name: 'Jääkaappi', symbol: 'fridge', body: 'fridge', w: 0.6, d: 0.6, h: 1.75, electric: power('fridge', 230, 150, { name: 'Jääkaappi', dedicated: false, role: 'socket', y: 0.3 }) }),
  item({ id: 'freezer', group: 'Keittiö', rooms: ['keittio'], name: 'Pakastin', symbol: 'freezer', body: 'fridge', w: 0.6, d: 0.62, h: 1.75, electric: power('fridge', 230, 180, { name: 'Pakastin', dedicated: false, role: 'socket', y: 0.3 }) }),
  item({ id: 'fridge-freezer', group: 'Keittiö', rooms: ['keittio'], name: 'Jääpakastin', symbol: 'fridge-freezer', body: 'fridge', w: 0.6, d: 0.64, h: 1.85, electric: power('fridge', 230, 200, { name: 'Jääpakastin', dedicated: false, role: 'socket', y: 0.3 }) }),
  item({ id: 'dishwasher', group: 'Keittiö', rooms: ['keittio'], name: 'Astianpesukone', symbol: 'dishwasher', body: 'appliance', w: 0.6, d: 0.6, h: 0.86, water: 'dishwasher', drain: 'fixture', electric: power('dishwasher', 230, 2200, { name: 'Astianpesukone', y: 0.3 }) }),
  item({ id: 'island', group: 'Keittiö', rooms: ['keittio'], name: 'Saareke', symbol: 'island', body: 'island', w: 1.4, d: 0.8, h: 0.9 }),
  item({ id: 'dining', group: 'Keittiö', rooms: ['keittio', 'olohuone'], name: 'Ruokapöytä', symbol: 'table', body: 'table', w: 1.4, d: 0.85, h: 0.75,
    variants: [
      { id: '4', name: '4 hengelle', w: 1.2, d: 0.8, h: 0.75 },
      { id: '6', name: '6 hengelle', w: 1.6, d: 0.9, h: 0.75 },
    ],
  }),
  item({ id: 'chair', group: 'Keittiö', rooms: ['keittio', 'olohuone', 'tyohuone'], name: 'Tuoli', symbol: 'chair', body: 'chair', w: 0.46, d: 0.5, h: 0.85 }),
  item({ id: 'stool', group: 'Keittiö', rooms: ['keittio', 'olohuone'], name: 'Jakkara', symbol: 'stool', body: 'stool', w: 0.36, d: 0.36, h: 0.45 }),
  item({ id: 'bin', group: 'Keittiö', rooms: ['keittio', 'kodinhoitohuone'], name: 'Roska-astia', symbol: 'bin', body: 'bin', w: 0.28, d: 0.32, h: 0.55 }),

  item({
    id: 'sofa', group: 'Olohuone', rooms: ['olohuone'], name: 'Sohva', symbol: 'sofa', body: 'sofa', h: 0.82,
    variants: [
      { id: '3', name: '3-istuttava', w: 2.1, d: 0.9, h: 0.82, symbol: 'sofa' },
      { id: '2', name: '2-istuttava', w: 1.5, d: 0.9, h: 0.82, symbol: 'sofa' },
      { id: 'corner', name: 'Kulmasohva', w: 2.5, d: 1.7, h: 0.82, symbol: 'sofa-corner', body: 'sofa-corner' },
      { id: 'divan', name: 'Divaanisohva', w: 2.3, d: 1.45, h: 0.82, symbol: 'divan', body: 'divan' },
    ],
  }),
  item({ id: 'armchair', group: 'Olohuone', rooms: ['olohuone', 'makuuhuone'], name: 'Nojatuoli', symbol: 'armchair', body: 'armchair', w: 0.85, d: 0.9, h: 0.85 }),
  item({ id: 'table', group: 'Olohuone', rooms: ['olohuone'], name: 'Sohvapöytä', symbol: 'coffee', body: 'coffee', w: 1.1, d: 0.6, h: 0.42 }),
  item({ id: 'tv', group: 'Olohuone', rooms: ['olohuone', 'makuuhuone'], name: 'Televisio', symbol: 'tv', body: 'tv', w: 1.2, d: 0.08, h: 0.7, electric: power('tv', 230, 120, { name: 'Televisio', dedicated: false, role: 'socket', y: 1.1 }) }),
  item({ id: 'tv-stand', group: 'Olohuone', rooms: ['olohuone', 'makuuhuone'], name: 'TV-taso', symbol: 'tvstand', body: 'low', w: 1.4, d: 0.42, h: 0.45 }),
  item({ id: 'speakers', group: 'Olohuone', rooms: ['olohuone'], name: 'Stereot', symbol: 'speakers', body: 'speakers', w: 0.9, d: 0.28, h: 0.35, electric: power('tv', 230, 80, { name: 'Stereot', dedicated: false, role: 'socket', y: 0.5 }) }),
  item({ id: 'dresser', group: 'Olohuone', rooms: ['olohuone', 'makuuhuone', 'eteinen'], name: 'Lipasto', symbol: 'dresser', body: 'dresser', w: 1.0, d: 0.45, h: 0.8 }),
  item({ id: 'bookcase', group: 'Olohuone', rooms: ['olohuone', 'tyohuone', 'makuuhuone'], name: 'Kirjahylly', symbol: 'shelf', body: 'shelf', w: 0.8, d: 0.32, h: 2.0 }),
  item({ id: 'vitrine', group: 'Olohuone', rooms: ['olohuone'], name: 'Vitriini', symbol: 'vitrine', body: 'vitrine', w: 0.8, d: 0.4, h: 1.6 }),
  item({ id: 'rug', group: 'Olohuone', rooms: ['olohuone', 'makuuhuone', 'eteinen'], name: 'Matto', symbol: 'rug', body: 'rug', w: 2.0, d: 1.4, h: 0.02 }),
  item({ id: 'floor-lamp', group: 'Olohuone', rooms: ['olohuone', 'makuuhuone'], name: 'Lattiavalaisin', symbol: 'lamp', body: 'lamp', w: 0.35, d: 0.35, h: 1.55, electric: power('light', 230, 40, { name: 'Lattiavalaisin', dedicated: false, role: 'light', y: 1.5 }) }),
  item({ id: 'fireplace', group: 'Olohuone', rooms: ['olohuone'], name: 'Takka', symbol: 'fireplace', body: 'fireplace', w: 0.9, d: 0.55, h: 1.3 }),
  item({ id: 'piano', group: 'Olohuone', rooms: ['olohuone'], name: 'Piano', symbol: 'piano', body: 'piano', w: 1.5, d: 1.45, h: 0.95 }),

  item({
    id: 'bed', group: 'Makuuhuone', rooms: ['makuuhuone'], name: 'Sänky', symbol: 'bed', body: 'bed', h: 0.5, d: 2.05,
    variants: [
      { id: '160', name: '160 cm', w: 1.6, d: 2.1, h: 0.55 },
      { id: '80', name: '80 cm', w: 0.8, d: 2.0, h: 0.5 },
      { id: '90', name: '90 cm', w: 0.9, d: 2.0, h: 0.5 },
      { id: '120', name: '120 cm', w: 1.2, d: 2.05, h: 0.5 },
      { id: '140', name: '140 cm', w: 1.4, d: 2.05, h: 0.5 },
      { id: '180', name: '180 cm', w: 1.8, d: 2.1, h: 0.55 },
    ],
  }),
  item({ id: 'bunk', group: 'Makuuhuone', rooms: ['makuuhuone'], name: 'Kerrossänky', symbol: 'bunk', body: 'bunk', w: 0.95, d: 2.0, h: 1.65 }),
  item({ id: 'nightstand', group: 'Makuuhuone', rooms: ['makuuhuone'], name: 'Yöpöytä', symbol: 'night', body: 'night', w: 0.45, d: 0.38, h: 0.5 }),
  item({
    id: 'wardrobe', group: 'Makuuhuone', rooms: ['makuuhuone', 'eteinen'], name: 'Vaatekaappi', symbol: 'wardrobe', body: 'wardrobe', h: 2.1,
    variants: [
      { id: 'hinged', name: 'Saranallinen', w: 1.2, d: 0.6, h: 2.1, symbol: 'wardrobe' },
      { id: 'slide', name: 'Liukuovikaappi', w: 1.8, d: 0.65, h: 2.2, symbol: 'slider' },
    ],
  }),
  item({ id: 'vanity-table', group: 'Makuuhuone', rooms: ['makuuhuone'], name: 'Kampauspöytä', symbol: 'vanity-table', body: 'vanity-table', w: 0.9, d: 0.45, h: 0.75 }),
  item({ id: 'desk', group: 'Makuuhuone', rooms: ['makuuhuone', 'tyohuone'], name: 'Työpöytä', symbol: 'desk', body: 'desk', w: 1.4, d: 0.65, h: 0.75 }),

  item({ id: 'laundry-sink', group: 'Kodinhoitohuone', rooms: ['kodinhoitohuone'], name: 'Pyykkiallas', symbol: 'laundry-sink', body: 'sink', w: 0.6, d: 0.6, h: 0.9, water: 'sink', drain: 'fixture' }),
  item({ id: 'drying-rack', group: 'Kodinhoitohuone', rooms: ['kodinhoitohuone', 'kylpyhuone'], name: 'Kuivausteline', symbol: 'rack', body: 'rack', w: 0.7, d: 0.55, h: 1.05 }),
  item({ id: 'ironing', group: 'Kodinhoitohuone', rooms: ['kodinhoitohuone'], name: 'Silityslauta', symbol: 'iron', body: 'iron', w: 1.15, d: 0.38, h: 0.9, electric: power('socket', 230, 2200, { name: 'Silitysrauta', dedicated: false, y: 0.9 }) }),
  item({ id: 'clean-cab', group: 'Kodinhoitohuone', rooms: ['kodinhoitohuone', 'eteinen'], name: 'Siivouskaappi', symbol: 'cabinet', body: 'tall', w: 0.6, d: 0.4, h: 1.9 }),

  item({ id: 'coat', group: 'Eteinen', rooms: ['eteinen'], name: 'Naulakko', symbol: 'coat', body: 'coat', w: 0.9, d: 0.35, h: 1.8 }),
  item({ id: 'shoes', group: 'Eteinen', rooms: ['eteinen'], name: 'Kenkähylly', symbol: 'shoes', body: 'low', w: 0.8, d: 0.32, h: 0.5 }),
  item({ id: 'hall-bench', group: 'Eteinen', rooms: ['eteinen'], name: 'Penkki', symbol: 'bench', body: 'bench', w: 0.9, d: 0.38, h: 0.45 }),
  item({ id: 'hall-cab', group: 'Eteinen', rooms: ['eteinen'], name: 'Eteiskaappi', symbol: 'wardrobe', body: 'wardrobe', w: 1.0, d: 0.4, h: 2.1 }),

  item({ id: 'office-chair', group: 'Työhuone', rooms: ['tyohuone', 'makuuhuone'], name: 'Toimistotuoli', symbol: 'office-chair', body: 'office-chair', w: 0.65, d: 0.65, h: 1.1 }),
  item({ id: 'printer', group: 'Työhuone', rooms: ['tyohuone'], name: 'Tulostin', symbol: 'printer', body: 'printer', w: 0.45, d: 0.4, h: 0.28, electric: power('socket', 230, 400, { name: 'Tulostin', dedicated: false, y: 0.75 }) }),

  item({ id: 'car', group: 'Autotalli', rooms: ['autotalli'], name: 'Auto', symbol: 'car', body: 'car', w: 1.8, d: 4.4, h: 1.5 }),
  item({ id: 'garage-bench', group: 'Autotalli', rooms: ['autotalli', 'tyohuone'], name: 'Työpöytä', symbol: 'desk', body: 'desk', w: 1.5, d: 0.6, h: 0.9 }),
  item({ id: 'garage-shelf', group: 'Autotalli', rooms: ['autotalli'], name: 'Hylly', symbol: 'shelf', body: 'shelf', w: 1.2, d: 0.45, h: 1.8 }),
  item({ id: 'tires', group: 'Autotalli', rooms: ['autotalli'], name: 'Renkaat', symbol: 'tires', body: 'tires', w: 0.7, d: 0.7, h: 0.7 }),
]

const BY_ID = new Map(FURNITURE.map((entry) => [entry.id, entry]))

export function furnitureTemplate(id) {
  return BY_ID.get(id) || FURNITURE[0]
}

export function variantOf(template, variantId) {
  const list = template?.variants || []
  if (!list.length) return null
  return list.find((entry) => entry.id === variantId) || list[0]
}

export function resolveFixture(fixture) {
  const template = furnitureTemplate(fixture?.type)
  const variant = variantOf(template, fixture?.variant)
  const electric = variant && Object.prototype.hasOwnProperty.call(variant, 'electric') ? variant.electric : template.electric
  return {
    template,
    variant,
    name: template.name,
    variantName: variant?.name || '',
    symbol: variant?.symbol || template.symbol,
    body: variant?.body || template.body || template.symbol,
    w: fixture?.w || variant?.w || template.w,
    d: fixture?.d || variant?.d || template.d,
    h: fixture?.h || variant?.h || template.h,
    water: template.water,
    drain: template.drain,
    electric,
  }
}

export function waterNeed(fixture) {
  const spec = resolveFixture(fixture).water
  if (!spec) return null
  if (spec === 'wc' || spec === 'dishwasher' || spec === 'washer') return { hot: false, cold: true, point: spec }
  return { hot: true, cold: true, point: spec }
}

export function isShowerType(type) {
  return type === 'shower' || furnitureTemplate(type).water === 'shower'
}

export function fixturesInGroup(group) {
  return FURNITURE.filter((entry) => entry.group === group)
}

export function suggestionsFor(kind) {
  if (!kind) return []
  return FURNITURE.filter((entry) => (entry.rooms || []).includes(kind))
}

const LAYOUTS = {
  wc: [
    { type: 'toilet', variant: 'floor', side: 'n', t: 0.32 },
    { type: 'bidet-spray', side: 'n', t: 0.48 },
    { type: 'paper', side: 'w', t: 0.72 },
    { type: 'vanity', variant: '600', side: 's', t: 0.38 },
    { type: 'mirror-cab', side: 's', t: 0.62 },
    { type: 'hooks', side: 'e', t: 0.35 },
    { type: 'floor-drain', x: 0.55, z: 0.62 },
    { type: 'wc-store', side: 'e', t: 0.72 },
  ],
  kylpyhuone: [
    { type: 'shower', variant: 'walk', side: 'n', t: 0.28 },
    { type: 'floor-drain', x: 0.30, z: 0.78 },
    { type: 'bath', variant: 'small', side: 'e', t: 0.48 },
    { type: 'vanity', variant: '600', side: 's', t: 0.32 },
    { type: 'mirror-cab', side: 's', t: 0.55 },
    { type: 'toilet', variant: 'wall', side: 'w', t: 0.48 },
    { type: 'towel-rad', side: 'w', t: 0.28 },
    { type: 'washer', side: 'n', t: 0.78 },
    { type: 'hamper', x: 0.62, z: 0.55 },
  ],
  sauna: [
    { type: 'bench', variant: 'two', side: 'n', t: 0.55 },
    { type: 'heater', variant: 'electric', side: 's', t: 0.35 },
    { type: 'bucket', x: 0.28, z: 0.72 },
    { type: 'sauna-door', side: 's', t: 0.72 },
    { type: 'floor-drain', x: 0.5, z: 0.55 },
  ],
  keittio: [
    { type: 'cabinet', variant: '600', side: 's', t: 0.14 },
    { type: 'sink', variant: 'single', side: 's', t: 0.30 },
    { type: 'dishwasher', side: 's', t: 0.46 },
    { type: 'stove', variant: 'induction', side: 's', t: 0.62 },
    { type: 'hood', side: 's', t: 0.62, nudge: 0.05 },
    { type: 'cabinet', variant: '600', side: 's', t: 0.80 },
    { type: 'fridge-freezer', side: 'e', t: 0.18 },
    { type: 'oven', side: 'e', t: 0.40 },
    { type: 'wall-cab', variant: '600', side: 'n', t: 0.22 },
    { type: 'wall-cab', variant: '600', side: 'n', t: 0.40 },
    { type: 'microwave', side: 'n', t: 0.58 },
    { type: 'dining', variant: '4', x: 0.38, z: 0.42 },
    { type: 'chair', x: 0.28, z: 0.30 },
    { type: 'chair', x: 0.48, z: 0.30 },
    { type: 'chair', x: 0.28, z: 0.54 },
    { type: 'chair', x: 0.48, z: 0.54 },
    { type: 'island', x: 0.62, z: 0.72 },
    { type: 'bin', x: 0.22, z: 0.22 },
  ],
  olohuone: [
    { type: 'sofa', variant: '3', side: 'w', t: 0.45 },
    { type: 'armchair', x: 0.62, z: 0.28 },
    { type: 'table', x: 0.42, z: 0.48 },
    { type: 'rug', x: 0.46, z: 0.5 },
    { type: 'tv-stand', side: 'e', t: 0.48 },
    { type: 'tv', side: 'e', t: 0.48 },
    { type: 'speakers', side: 'e', t: 0.72 },
    { type: 'bookcase', side: 'n', t: 0.25 },
    { type: 'fireplace', side: 'n', t: 0.7 },
    { type: 'floor-lamp', x: 0.22, z: 0.72 },
  ],
  makuuhuone: [
    { type: 'bed', variant: '160', x: 0.48, z: 0.42 },
    { type: 'nightstand', x: 0.22, z: 0.28 },
    { type: 'nightstand', x: 0.78, z: 0.28 },
    { type: 'wardrobe', variant: 'slide', side: 'n', t: 0.55 },
    { type: 'dresser', side: 'e', t: 0.7 },
    { type: 'desk', side: 's', t: 0.3 },
    { type: 'office-chair', x: 0.3, z: 0.78 },
  ],
  kodinhoitohuone: [
    { type: 'laundry-sink', side: 's', t: 0.3 },
    { type: 'washer', side: 'n', t: 0.28 },
    { type: 'dryer', side: 'n', t: 0.55 },
    { type: 'drying-rack', x: 0.55, z: 0.55 },
    { type: 'ironing', x: 0.35, z: 0.72 },
    { type: 'clean-cab', side: 'e', t: 0.4 },
    { type: 'floor-drain', x: 0.5, z: 0.4 },
  ],
  eteinen: [
    { type: 'coat', side: 'w', t: 0.35 },
    { type: 'shoes', side: 'w', t: 0.65 },
    { type: 'hall-bench', side: 'e', t: 0.4 },
    { type: 'mirror', side: 'e', t: 0.62 },
    { type: 'hall-cab', side: 'n', t: 0.5 },
  ],
  tyohuone: [
    { type: 'desk', side: 'n', t: 0.4 },
    { type: 'office-chair', x: 0.4, z: 0.48 },
    { type: 'bookcase', side: 'e', t: 0.4 },
    { type: 'printer', side: 's', t: 0.3 },
  ],
  autotalli: [
    { type: 'car', x: 0.48, z: 0.42 },
    { type: 'garage-bench', side: 'e', t: 0.35 },
    { type: 'garage-shelf', side: 'w', t: 0.4 },
    { type: 'tires', side: 'n', t: 0.25 },
  ],
}

export function layoutFor(kind) {
  return LAYOUTS[kind] || []
}

export function fixtureServiceSpecs(fixtures) {
  const specs = []
  ;(fixtures || []).forEach((fixture) => {
    if (fixture.hidden) return
    const resolved = resolveFixture(fixture)
    const x = fixture.x
    const z = fixture.z
    if (resolved.water) {
      const need = waterNeed(fixture)
      specs.push({
        system: 'water',
        kind: 'fixture',
        name: resolved.name,
        fixtureType: fixture.type,
        hot: need.hot,
        cold: need.cold,
        pointType: need.point,
        linkedFrom: `fix:${fixture.id}:water`,
        x,
        z,
        y: 0.55,
      })
    }
    if (resolved.drain === 'floor') {
      specs.push({
        system: 'drain',
        kind: 'floor-drain',
        name: 'Lattiakaivo',
        fixtureType: fixture.type,
        size: 75,
        linkedFrom: `fix:${fixture.id}:drain`,
        x,
        z,
        y: -0.02,
      })
    } else if (resolved.drain === 'fixture') {
      specs.push({
        system: 'drain',
        kind: 'drain-point',
        name: resolved.name,
        fixtureType: fixture.type,
        size: resolved.water === 'wc' ? 110 : 50,
        linkedFrom: `fix:${fixture.id}:drain`,
        x,
        z,
        y: -0.02,
      })
    }
    if (resolved.electric) {
      const electric = resolved.electric
      specs.push({
        system: 'electric',
        kind: electric.kind,
        role: electric.role,
        name: electric.name || resolved.name,
        voltage: electric.voltage,
        power: electric.power,
        dedicated: electric.dedicated,
        connection: electric.connection,
        cosPhi: 1,
        fixtureType: fixture.type,
        linkedFrom: `fix:${fixture.id}:electric`,
        x,
        z,
        y: electric.y || 0.3,
      })
    }
  })
  return specs
}

export function scheduleRows(fixtures, roomAt) {
  const rows = []
  ;(fixtures || []).forEach((fixture) => {
    const spec = resolveFixture(fixture)
    const room = roomAt ? roomAt(fixture) : ''
    const key = `${room}|${spec.name}|${spec.variantName}|${Math.round(spec.w * 1000)}|${Math.round(spec.d * 1000)}`
    const found = rows.find((row) => row.key === key)
    if (found) found.count += 1
    else {
      rows.push({
        key,
        room: room || '—',
        name: spec.name,
        variant: spec.variantName,
        w: spec.w,
        d: spec.d,
        h: spec.h,
        count: 1,
      })
    }
  })
  return rows.sort((a, b) => a.room.localeCompare(b.room, 'fi') || a.name.localeCompare(b.name, 'fi'))
}
