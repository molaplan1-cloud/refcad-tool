'use client'

import { normalizeHeating } from '@/lib/hydronic'
import { ensureServices } from '@/lib/services'

const btn = (active) => ({
  height: 28,
  padding: '0 10px',
  borderRadius: 7,
  border: '1px solid #d6d3d1',
  background: active ? '#134e4a' : '#fff',
  color: active ? '#ccfbf1' : '#1c1917',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
})

function fmt(value, digits = 1) {
  return Number(value || 0).toFixed(digits).replace('.', ',')
}

const DIST = {
  floor: 'Lattialämmitys',
  radiator: 'Patteriverkosto',
  both: 'Lattia ja patterit',
  none: 'Suora sähkö',
}

export function HeatingSchematic({ plan }) {
  const heating = normalizeHeating(plan)
  const report = ensureServices(plan).heat || {}
  const water = ensureServices(plan).water || {}
  const boxes = [
    { title: report.source || 'Lämmönlähde', note: report.borehole ? 'Lämpökaivo / keruupiiri' : '' },
    heating.buffer ? { title: 'Puskurivaraaja', note: `${heating.bufferLitres} l` } : null,
    heating.distribution === 'radiator'
      ? { title: 'Patteriverkosto', note: `${(report.radiators || []).length} patteria` }
      : heating.distribution === 'none'
        ? { title: 'Suora sähkö', note: 'Sähköpatterit' }
        : { title: 'Lattialämmitys', note: `${(report.loops || []).length} piiriä` },
  ].filter(Boolean)
  if (heating.distribution === 'both') boxes.push({ title: 'Patteriverkosto', note: `${(report.radiators || []).length} patteria` })
  const dhw = heating.dhw === 'exchanger'
    ? { title: 'Käyttöveden siirrin', note: 'Kaukolämpö' }
    : { title: 'Lämminvesivaraaja', note: `${heating.dhwLitres} l · ${heating.dhwMode === 'electric' ? 'sähkö' : 'lämmönlähde'}` }
  const width = 160 + boxes.length * 180
  return (
    <svg data-testid="heat-schematic" viewBox={`0 0 ${width} 420`} width={width} height={420} style={{ background: '#fff', border: '1px solid #1c1917' }}>
      <text x="24" y="32" fontSize="18" fontWeight="700" fill="#1c1917">Lämmitysjärjestelmän periaatekaavio</text>
      {boxes.map((box, index) => {
        const x = 36 + index * 180
        return (
          <g key={box.title} data-testid={`heat-box-${index}`}>
            {index > 0 && <line x1={x - 48} y1={110} x2={x} y2={110} stroke="#dc2626" strokeWidth="2" />}
            {index > 0 && <line x1={x - 48} y1={128} x2={x} y2={128} stroke="#2563eb" strokeWidth="2" />}
            <rect x={x} y={78} width={140} height={72} rx="6" fill="#fff" stroke="#1c1917" strokeWidth="1.4" />
            <text x={x + 70} y={108} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1c1917">{box.title}</text>
            <text x={x + 70} y={130} textAnchor="middle" fontSize="12" fill="#44403c">{box.note}</text>
          </g>
        )
      })}
      <line x1={36 + 70} y1={150} x2={36 + 70} y2={210} stroke="#dc2626" strokeWidth="2" />
      <rect x={36} y={210} width={160} height={64} rx="6" fill="#fff7ed" stroke="#c2410c" strokeWidth="1.4" />
      <text x={116} y={236} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1c1917">{dhw.title}</text>
      <text x={116} y={256} textAnchor="middle" fontSize="12" fill="#44403c">{dhw.note}</text>
      <text x="24" y="310" fontSize="13" fontWeight="700" fill="#1d4ed8">Käyttövesi</text>
      <text x="24" y="332" fontSize="12" fill="#1c1917">{`KV ${fmt(water.coldFlow, 2)} l/s · PEX ${water.coldSize || '—'}`}</text>
      <text x="24" y="352" fontSize="12" fill="#dc2626">{`LV ${fmt(water.hotFlow, 2)} l/s · PEX ${water.hotSize || '—'}`}</text>
      {report.supplementAir && <text x="24" y="380" fontSize="12" fill="#44403c">Lisänä ilmalämpöpumppu</text>}
      <text x={width - 220} y="390" fontSize="11" fill="#78716c">{DIST[heating.distribution] || heating.distribution}</text>
    </svg>
  )
}

export function HeatingTable({ plan }) {
  const report = ensureServices(plan).heat || { loops: [], radiators: [] }
  const heating = normalizeHeating(plan)
  return (
    <div data-testid="heat-table">
      <div style={{ fontSize: 18, fontWeight: 750, marginBottom: 8 }}>Patterit ja lattialämmityspiirit</div>
      <div data-testid="heat-summary" style={{ fontSize: 13, marginBottom: 12 }}>
        <strong>{report.source || 'Lämmönlähde'}</strong>
        {heating.buffer ? ` · puskurivaraaja ${heating.bufferLitres} l` : ' · ei puskurivaraajaa'}
        {` · ${DIST[heating.distribution] || ''}`}
        {report.totalPower ? ` · ${report.totalPower} W` : ''}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' }}>
        <thead>
          <tr>
            {['Huone', 'Tyyppi', 'Piiri', 'Teho', 'Virtaama', 'Pituus', 'Jakoväli', 'Putki'].map((title) => (
              <th key={title} style={{ textAlign: 'left', borderBottom: '1px solid #1c1917', padding: '6px 8px' }}>{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(report.loops || []).map((loop) => (
            <tr key={`${loop.roomId}-${loop.index}`} data-testid="loop-row">
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{loop.roomName}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>Lattialämmitys</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{loop.index}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{loop.power} W</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{fmt(loop.flow, 3)} l/s</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{fmt(loop.length, 1)} m</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{fmt(loop.spacing * 1000, 0)} mm</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>PEX {loop.size}</td>
            </tr>
          ))}
          {(report.radiators || []).map((row) => (
            <tr key={row.id} data-testid="radiator-row">
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{row.roomName}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>Patteri</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{row.name}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{row.power} W</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>{fmt(row.flow, 3)} l/s</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }} />
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }} />
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e7e5e4' }}>PEX {row.size}</td>
            </tr>
          ))}
          {(report.loops || []).length + (report.radiators || []).length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 12, color: '#78716c' }}>Ei piirejä. Valitse jakotapa talon asetuksista.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function HeatingPanel({ plan, mode, onMode, onClose, onPrint }) {
  return (
    <div data-testid="heating-panel" style={{ position: 'fixed', left: 16, right: 16, top: 108, bottom: 16, zIndex: 30, background: '#fbfaf7', overflow: 'auto', padding: '16px 18px 28px', border: '1px solid #1c1917', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button type="button" data-testid="tab-heat-table" style={btn(mode === 'table')} onClick={() => onMode('table')}>Piiritaulukko</button>
        <button type="button" data-testid="tab-heat-schematic" style={btn(mode === 'schematic')} onClick={() => onMode('schematic')}>Periaatekaavio</button>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="heat-print" style={btn(false)} onClick={onPrint}>Tulosta PDF</button>
        <button type="button" data-testid="heat-close" style={btn(false)} onClick={onClose}>Sulje</button>
      </div>
      {mode === 'schematic' ? <HeatingSchematic plan={plan} /> : <HeatingTable plan={plan} />}
    </div>
  )
}
