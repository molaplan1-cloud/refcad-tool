'use client'

import { cableSchedule } from '@/lib/deviceTags'
import { electricSummary } from '@/lib/services'

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

function fmtPower(watts) {
  const value = Number(watts) || 0
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')} kW`
  return `${Math.round(value)} W`
}

function fmtAmp(amps) {
  return `${Number(amps || 0).toFixed(1).replace('.', ',')} A`
}

function fmtLength(metres) {
  const value = Number(metres) || 0
  if (!value) return ''
  return `${String(value).replace('.', ',')} m`
}

export function SingleLine({ report }) {
  const circuits = report?.circuits || []
  const width = Math.max(860, 140 + circuits.length * 168)
  const height = 460
  const left = 56
  const right = width - 56
  const busY = 150
  const count = Math.max(circuits.length, 1)
  return (
    <svg data-testid="single-line" viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block', background: '#fff', border: '1px solid #1c1917' }}>
      <text x={width / 2} y={32} textAnchor="middle" fontSize="18" fontWeight="700" fill="#1c1917">Pääkaavio</text>
      <text x={width / 2} y={54} textAnchor="middle" fontSize="12" fill="#44403c">Sähkökeskus</text>
      <line x1={width / 2} y1={64} x2={width / 2} y2={96} stroke="#1c1917" strokeWidth="2" />
      <text x={width / 2 + 8} y={80} fontSize="11" fill="#44403c">Syöttö</text>
      <rect x={width / 2 - 42} y={96} width={84} height={26} fill="#fff" stroke="#1c1917" strokeWidth="1.4" />
      <text x={width / 2} y={114} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1c1917">{report?.mainFuse || '—'}</text>
      <line x1={width / 2} y1={122} x2={width / 2} y2={busY} stroke="#1c1917" strokeWidth="2" />
      <line x1={left} y1={busY} x2={right} y2={busY} stroke="#1c1917" strokeWidth="3" />
      {circuits.map((circuit, index) => {
        const x = count === 1 ? width / 2 : left + (index * (right - left)) / (count - 1)
        const rcd = Boolean(circuit.rcd)
        const fuseY = busY + 28
        const rcdY = fuseY + 36
        const textY = rcd ? rcdY + 48 : fuseY + 28
        return (
          <g key={circuit.id} data-testid={`diagram-group-${circuit.id}`}>
            <line x1={x} y1={busY} x2={x} y2={fuseY} stroke="#1c1917" strokeWidth="1.4" />
            <rect x={x - 16} y={fuseY} width={32} height={18} fill="#fff" stroke="#1c1917" />
            <text x={x} y={fuseY + 13} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1c1917">{circuit.fuse ? `${circuit.fuse} A` : '—'}</text>
            {rcd && (
              <g>
                <line x1={x} y1={fuseY + 18} x2={x} y2={rcdY - 11} stroke="#1c1917" strokeWidth="1.4" />
                <circle cx={x} cy={rcdY} r="11" fill="#fff" stroke="#1c1917" />
                <text x={x} y={rcdY + 3} textAnchor="middle" fontSize="8" fill="#1c1917">30</text>
                <text x={x + 16} y={rcdY + 4} textAnchor="start" fontSize="10" fill="#1c1917">mA</text>
              </g>
            )}
            <line x1={x} y1={rcd ? rcdY + 11 : fuseY + 18} x2={x} y2={textY} stroke="#1c1917" strokeWidth="1.4" />
            <text x={x} y={textY + 18} textAnchor="middle" fontSize="14" fontWeight="750" fill="#1c1917">R{circuit.id}</text>
            <text x={x} y={textY + 36} textAnchor="middle" fontSize="11" fill="#1c1917">{circuit.description}</text>
            <text x={x} y={textY + 52} textAnchor="middle" fontSize="11" fill="#44403c">{circuit.cable}</text>
            <text x={x} y={textY + 68} textAnchor="middle" fontSize="11" fill="#44403c">{circuit.phase} · {fmtPower(circuit.power)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Summary({ report }) {
  const loads = report.phaseLoads || { L1: 0, L2: 0, L3: 0 }
  return (
    <div data-testid="electric-summary" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, fontSize: 13 }}>
      <div><strong>Kokonaisteho</strong> {fmtPower(report.totalPower)}</div>
      <div><strong>Pääsulake</strong> {report.mainFuse || '—'}</div>
      <div data-testid="phase-l1"><strong>L1</strong> {fmtAmp(loads.L1)}</div>
      <div data-testid="phase-l2"><strong>L2</strong> {fmtAmp(loads.L2)}</div>
      <div data-testid="phase-l3"><strong>L3</strong> {fmtAmp(loads.L3)}</div>
    </div>
  )
}

export function ScheduleTable({ report }) {
  const circuits = report?.circuits || []
  return (
    <div data-testid="electric-schedule">
      <div style={{ fontSize: 18, fontWeight: 750, marginBottom: 8 }}>Ryhmäluettelo</div>
      <Summary report={report} />
      <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse', fontSize: 13, background: '#fff' }}>
        <thead>
          <tr>
            {['Ryhmä', 'Kuvaus', 'Laitteet', 'Jännite', 'Vaihe', 'Teho', 'Virta', 'Sulake', 'RCD', 'Kaapeli', 'Pituus'].map((title) => (
              <th key={title} style={{ textAlign: 'left', borderBottom: '1px solid #1c1917', padding: '6px 6px', whiteSpace: 'nowrap' }}>{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {circuits.length === 0 && (
            <tr>
              <td colSpan={11} style={{ padding: 12, color: '#78716c' }}>Ei ryhmiä. Sijoita sähkölaitteet, niin johdotus ja ryhmät lasketaan.</td>
            </tr>
          )}
          {circuits.map((circuit) => (
            <tr
              key={circuit.id}
              data-testid={`circuit-row-${circuit.id}`}
              style={{ background: circuit.warning ? '#fef2f2' : 'transparent' }}
              onDragOver={(event) => { if (onAssign) event.preventDefault() }}
              onDrop={(event) => {
                const deviceId = event.dataTransfer.getData('application/x-refcad-device')
                if (deviceId && onAssign) onAssign(deviceId, circuit.id)
              }}
            >
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4', fontWeight: 700 }}>R{circuit.id}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{circuit.description}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>
                {(circuit.members || []).length ? circuit.members.map((member) => (
                  <span
                    key={member.id}
                    draggable
                    data-testid={`circuit-device-${member.id}`}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-refcad-device', member.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    style={{ display: 'inline-block', margin: '0 4px 4px 0', padding: '2px 6px', border: '1px solid #d6d3d1', borderRadius: 6, cursor: 'grab', background: '#fff' }}
                  >
                    {member.tag ? `${member.tag} ` : ''}{member.room ? `${member.room}: ` : ''}{member.name}
                  </span>
                )) : (circuit.devices || []).join(', ')}
              </td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{circuit.voltage ? `${circuit.voltage} V` : '—'}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{circuit.phase}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{fmtPower(circuit.power)}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{circuit.current ? fmtAmp(circuit.current) : ''}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{circuit.fuse ? `${circuit.fuse} A` : ''}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{circuit.rcd || ''}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{circuit.cable}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{fmtLength(circuit.length)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {circuits.some((circuit) => circuit.warning) && (
        <div data-testid="schedule-warning" style={{ marginTop: 8, color: '#b91c1c', fontSize: 12 }}>
          {circuits.filter((circuit) => circuit.warning).map((circuit) => `R${circuit.id}: ${circuit.warning}`).join(' · ')}
        </div>
      )}
    </div>
  )
}

function CableTable({ plan, system }) {
  const rows = cableSchedule(plan, system)
  if (!rows.length) return null
  return (
    <div data-testid="cable-table" style={{ marginTop: 18 }}>
      <div style={{ fontSize: 16, fontWeight: 750, marginBottom: 8 }}>Johdot</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' }}>
        <thead>
          <tr>
            {['Yhteys', 'Merkintä'].map((title) => (
              <th key={title} style={{ textAlign: 'left', borderBottom: '1px solid #1c1917', padding: '6px 6px' }}>{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid="cable-row">
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4', fontWeight: 700 }}>{row.span}</td>
              <td style={{ padding: '6px', borderBottom: '1px solid #e7e5e4' }}>{row.marking}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ElectricPanel({ plan, mode, onMode, onClose, onPrint, onAssign }) {
  const report = electricSummary(plan)
  return (
    <div
      data-testid="electric-panel"
      style={{ position: 'fixed', left: 16, right: 16, top: 108, bottom: 16, zIndex: 30, background: '#fbfaf7', overflow: 'auto', padding: '16px 18px 28px', border: '1px solid #1c1917', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button type="button" data-testid="tab-schedule" style={btn(mode === 'list')} onClick={() => onMode('list')}>Ryhmäluettelo</button>
        <button type="button" data-testid="tab-diagram" style={btn(mode === 'diagram')} onClick={() => onMode('diagram')}>Pääkaavio</button>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="electric-print" style={btn(false)} onClick={onPrint}>Tulosta PDF</button>
        <button type="button" data-testid="electric-close" style={btn(false)} onClick={onClose}>Sulje</button>
      </div>
      {mode === 'diagram' ? (
        <div data-testid="electric-diagram">
          <Summary report={report} />
          <SingleLine report={report} />
        </div>
      ) : (
        <>
          <ScheduleTable report={report} />
          <CableTable plan={plan} system="electric" />
        </>
      )}
    </div>
  )
}
