'use client'

import { useEffect, useState } from 'react'
import { usePlanLocale } from '@/components/i18n/Locale'
import { FUSE_SERIES } from '@/lib/electric'
import { HEAT_SOURCES, pexSize } from '@/lib/hydronic'
import {
  PLACEABLES,
  SERVICE_SYSTEMS,
  airflowBalance,
  collectFittings,
  deleteServiceNode,
  deleteServiceRun,
  ensureServices,
  joinServiceRuns,
  layerVisible,
  manifoldCallouts,
  serviceItemVisible,
  nodeColor,
  rerouteRun,
  rerouteSystem,
  runColor,
  serviceLegend,
  serviceObjectTitle,
  splitServiceRun,
  updateServiceNode,
  updateServiceRun,
} from '@/lib/services'
import { HEIGHT_PRESETS, heightMetres, insulationOptions, materialOptions, routeLength } from '@/lib/routeEdit'
import { houseBox } from '@/lib/yard'
import { CAD_COMMANDS } from '@/lib/cadEdit'
import { annotationFont, paperFont, placeFlowLabel, placeLineLabels, routeStrokeBoxes } from '@/lib/annotations'
import { CadItem, CadMenu, CadSep, Flyout, Segmented } from './CadMenu'

const barBtn = (active) => ({
  height: 26,
  padding: '0 8px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  borderRadius: 7,
  border: '1px solid transparent',
  background: active ? '#134e4a' : 'transparent',
  color: active ? '#ccfbf1' : '#e7e5e4',
  fontSize: 12,
  fontWeight: 650,
  cursor: 'pointer',
  flexShrink: 0,
  transform: 'none',
  whiteSpace: 'nowrap',
})

const fieldStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #d6d3d1',
  fontSize: 13,
  background: '#fff',
  color: '#1c1917',
}

export function ServiceBar({
  plan,
  system,
  kindId,
  tool,
  floorHeating,
  onSystem,
  onKind,
  onTool,
  onLayer,
  onRoute,
  onRewire,
  onSchedule,
  onDiagram,
  onRewireWater,
  onRewireHeat,
  onHeatTable,
  onHeatSchematic,
  onFloorHeating,
  onFinish,
  onPdf,
  drawing,
}) {
  const services = ensureServices(plan)
  const balance = airflowBalance(services.nodes)
  const placeables = PLACEABLES.filter((item) => item.system === system && item.mode === (tool === 'run' ? 'run' : 'node'))
  const hasAir = services.nodes.some((item) => item.system === 'iv' && item.flow)
  return (
    <div style={{ minHeight: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: '#111827', color: '#e7e5e4', flexShrink: 0, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 750, letterSpacing: 0.4, color: '#a8a29e' }}>KERROKSET</span>
      {SERVICE_SYSTEMS.map((item) => {
        const on = layerVisible(plan, item.id)
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`layer-${item.id}`}
            aria-pressed={on}
            style={barBtn(on)}
            onClick={() => onLayer(item.id, !on)}
          >
            <span style={{ width: 8, height: 8, borderRadius: 8, background: on ? '#5eead4' : '#57534e' }} />
            {item.name}
          </button>
        )
      })}
      <span style={{ width: 1, height: 16, background: '#44403c' }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        Järjestelmä
        <select data-testid="service-system" value={system} onChange={(event) => onSystem(event.target.value)} style={{ ...fieldStyle, width: 'auto', padding: '3px 6px' }}>
          {SERVICE_SYSTEMS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <button type="button" data-testid="service-tool-node" style={barBtn(tool === 'node')} onClick={() => onTool('node')}>Piste</button>
      <button type="button" data-testid="service-tool-run" style={barBtn(tool === 'run')} onClick={() => onTool('run')}>Linja</button>
      <select data-testid="service-kind" value={placeables.some((item) => item.id === kindId) ? kindId : (placeables[0]?.id || '')} onChange={(event) => onKind(event.target.value)} style={{ ...fieldStyle, width: 'auto', padding: '3px 6px' }}>
        {placeables.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {drawing && <button type="button" data-testid="service-finish" style={barBtn(false)} onClick={onFinish}>Valmis</button>}
      <button type="button" data-testid="route-services" style={barBtn(false)} onClick={onRoute}>Reititä automaattisesti</button>
      {system === 'electric' && (
        <>
          <button type="button" data-testid="rewire-electric" style={barBtn(false)} onClick={onRewire}>Johdota</button>
          <button type="button" data-testid="open-schedule" style={barBtn(false)} onClick={onSchedule}>Ryhmäluettelo</button>
          <button type="button" data-testid="open-diagram" style={barBtn(false)} onClick={onDiagram}>Pääkaavio</button>
        </>
      )}
      {system === 'water' && (
        <button type="button" data-testid="rewire-water" style={barBtn(false)} onClick={onRewireWater}>Johdota käyttövesi</button>
      )}
      {system === 'heat' && (
        <>
          <button type="button" data-testid="rewire-heat" style={barBtn(false)} onClick={onRewireHeat}>Johdota lämmitys</button>
          <button type="button" data-testid="open-heat-table" style={barBtn(false)} onClick={onHeatTable}>Piiritaulukko</button>
          <button type="button" data-testid="open-heat-schematic" style={barBtn(false)} onClick={onHeatSchematic}>Periaatekaavio</button>
        </>
      )}
      {SERVICE_SYSTEMS.map((item) => (
        <button key={`pdf-${item.id}`} type="button" data-testid={`service-pdf-${item.id}`} style={barBtn(false)} onClick={() => onPdf(item.id)}>{item.name} PDF</button>
      ))}
      {hasAir && (
        <span data-testid="service-balance" style={{ fontSize: 12, fontWeight: 700, color: '#f5f5f4' }}>
          Tulo {balance.supply} l/s · Poisto {balance.extract} l/s
        </span>
      )}
    </div>
  )
}

function pointsOf(points, X, Y) {
  return (points || []).map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')
}

const RUN_SHIFT = { drain: -0.22, water: -0.08, electric: 0.08, iv: 0.22 }

function shiftPoints(points, system, multi, kind) {
  const base = points || []
  const kindShift = system === 'water' && kind === 'hot' ? 0.16 : system === 'water' && kind === 'circ' ? 0.32 : 0
  const shifted = kindShift ? base.map((point) => ({ ...point, x: point.x + kindShift, z: point.z + kindShift })) : base
  if (!multi || shifted.length < 2) return shifted
  const dist = RUN_SHIFT[system] || 0
  if (!dist) return shifted
  return shifted.map((point, index) => {
    const prev = shifted[Math.max(0, index - 1)]
    const next = shifted[Math.min(shifted.length - 1, index + 1)]
    let dx = next.x - prev.x
    let dz = next.z - prev.z
    const len = Math.hypot(dx, dz) || 1
    dx /= len
    dz /= len
    return { x: point.x - dz * dist, z: point.z + dx * dist }
  })
}

function SlopeMark({ run, X, Y, show = true, size = 8 }) {
  const pts = run.points || []
  if (!show || !run.slope || pts.length < 2) return null
  let best = null
  for (let i = 1; i < pts.length; i += 1) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
    if (!best || len > best.len) best = { len, a: pts[i - 1], b: pts[i] }
  }
  if (!best || best.len < 0.3) return null
  const lower = (best.b.y ?? 0) <= (best.a.y ?? 0) ? best.b : best.a
  const higher = lower === best.b ? best.a : best.b
  const x1 = X(higher.x)
  const y1 = Y(higher.z)
  const x2 = X(lower.x)
  const y2 = Y(lower.z)
  const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
  const label = `${Number(run.slope).toFixed(1).replace('.', ',')} %`
  return (
    <g transform={`translate(${(x1 + x2) / 2} ${(y1 + y2) / 2}) rotate(${ang})`} style={{ pointerEvents: 'none' }}>
      <polygon points="9,0 -3,-3.2 -3,3.2" fill="#44403c" />
      <text x="12" y="-3" fontSize={size} fill="#292524">{label}</text>
    </g>
  )
}

function NodeSymbol({ node, tagSize = 8 }) {
  const color = nodeColor(node)
  if (node.kind === 'ahu') {
    return (
      <g>
        <rect x={-16} y={-10} width={32} height={20} rx={3} fill="#f8fafc" stroke={color} strokeWidth={1.6} />
        <path d="M-8,-4 L0,4 L8,-4" fill="none" stroke="#dc2626" strokeWidth={1.2} />
        <path d="M-8,4 L0,-4 L8,4" fill="none" stroke="#2563eb" strokeWidth={1.2} />
        <text x="0" y="18" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#1c1917">IV</text>
      </g>
    )
  }
  if (node.kind === 'hood') {
    return (
      <g>
        <rect x={-12} y={-7} width={24} height={14} fill="#fff7ed" stroke={color} strokeWidth={1.4} />
        <text x="0" y="4" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill={color}>LK</text>
      </g>
    )
  }
  if (node.kind === 'silencer') {
    return (
      <g>
        <rect x={-11} y={-5} width={22} height={10} fill="#f8fafc" stroke="#334155" strokeWidth={1.2} />
        <path d="M-8,-5 L-2,5 M-2,-5 L4,5 M4,-5 L10,5" stroke="#64748b" strokeWidth={0.8} />
      </g>
    )
  }
  if (node.kind === 'valve') {
    return (
      <g>
        <circle r="7" fill="#fff" stroke={color} strokeWidth="1.6" />
        <path d={node.role === 'poisto' ? 'M0,-4 L3.4,3 L-3.4,3 Z' : 'M0,4 L3.4,-3 L-3.4,-3 Z'} fill={color} />
      </g>
    )
  }
  if (node.kind === 'manifold') {
    return (
      <g>
        <rect x={-12} y={-6} width={24} height={12} fill="#eff6ff" stroke="#1d4ed8" strokeWidth={1.3} />
        <text x="0" y="3.5" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#1d4ed8">JT</text>
      </g>
    )
  }
  if (node.kind === 'shutoff' || node.kind === 'inlet') {
    return (
      <g>
        <circle r="5" fill={node.kind === 'inlet' ? '#1d4ed8' : '#fff'} stroke="#1d4ed8" strokeWidth="1.4" />
        {node.kind === 'shutoff' && <path d="M-3,-3 L3,3 M3,-3 L-3,3" stroke="#1d4ed8" strokeWidth="1.2" />}
      </g>
    )
  }
  if (node.kind === 'outdoor-tap' || node.kind === 'fixture') {
    return <circle r="4.5" fill="#fff" stroke={color} strokeWidth="1.5" />
  }
  if (node.kind === 'floor-drain') {
    return (
      <g>
        <circle r="6.5" fill="#fff" stroke="#44403c" strokeWidth="1.3" />
        <path d="M-4,0 H4 M0,-4 V4" stroke="#44403c" strokeWidth="1" />
      </g>
    )
  }
  if (node.kind === 'cleanout') {
    return (
      <g>
        <rect x={-6} y={-6} width={12} height={12} fill="#fff" stroke="#44403c" strokeWidth={1.2} />
        <text x="0" y="3" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#44403c">PL</text>
      </g>
    )
  }
  if (node.kind === 'drain-point') return <circle r="3.5" fill="#44403c" />
  if (node.kind === 'panel') {
    return (
      <g>
        <rect x={-11} y={-8} width={22} height={16} fill="#fff" stroke="#1c1917" strokeWidth={1.4} />
        <text x="0" y="3.5" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#1c1917">SK</text>
      </g>
    )
  }
  if (node.kind === 'light') {
    return (
      <g>
        <circle r="6" fill="#fff" stroke="#1c1917" strokeWidth="1.2" />
        <path d="M-4,-4 L4,4 M4,-4 L-4,4" stroke="#1c1917" strokeWidth="1" />
      </g>
    )
  }
  if (node.kind === 'switch') {
    return (
      <g>
        <circle r="5" fill="#fff" stroke="#1c1917" strokeWidth="1.2" />
        <path d="M0,0 L5,-6" stroke="#1c1917" strokeWidth="1.2" />
      </g>
    )
  }
  if (node.kind === 'socket') {
    return (
      <g>
        <circle r="5.5" fill="#fff" stroke="#1c1917" strokeWidth="1.2" />
        <path d="M2,-2.5 V2.5 M4.2,-2.5 V2.5" stroke="#1c1917" strokeWidth="1" />
      </g>
    )
  }
  if (node.kind === 'junction') {
    return (
      <g data-testid="junction-symbol">
        <rect x="-3.4" y="-3.4" width="6.8" height="6.8" fill="#fff" stroke="#1c1917" strokeWidth="1.15" />
      </g>
    )
  }
  if (node.kind === 'heater-control') {
    return (
      <g data-testid="heater-control-symbol">
        <rect x="-7" y="-5" width="14" height="10" fill="#fff" stroke="#1c1917" strokeWidth="1.1" />
        <text x="0" y="3" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#1c1917">OK</text>
      </g>
    )
  }
  if (node.kind === 'data') return <polygon points="0,-6 6,5 -6,5" fill="#fff" stroke="#1c1917" strokeWidth="1.1" />
  if (node.kind === 'antenna') {
    return (
      <g>
        <polygon points="0,-7 5,2 -5,2" fill="none" stroke="#1c1917" strokeWidth="1.1" />
        <path d="M0,2 V7" stroke="#1c1917" strokeWidth="1.1" />
      </g>
    )
  }
  if (node.kind === 'stove' || node.kind === 'heater') {
    return (
      <g>
        <rect x={-8} y={-6} width={16} height={12} fill="#fff" stroke="#1c1917" strokeWidth={1.2} />
        <text x="0" y="3" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#1c1917">{node.kind === 'heater' ? 'K' : 'L'}</text>
      </g>
    )
  }
  const badge = {
    oven: ['U', 18],
    radiator: ['P', 18],
    ev: ['EV', 24],
    heatpump: ['LP', 24],
    'iv-unit': ['IV', 24],
    boiler: ['V', 18],
    washer: ['PK', 24],
    dishwasher: ['AP', 24],
    fridge: ['JK', 22],
    dryer: ['KR', 22],
    microwave: ['M', 18],
    tv: ['TV', 22],
    towel: ['PK', 22],
    spa: ['PA', 22],
  }[node.kind]
  if (badge) {
    const [label, width] = badge
    return (
      <g>
        <rect x={-width / 2} y={-7} width={width} height={14} fill="#fff" stroke="#1c1917" strokeWidth={1.2} />
        <text x="0" y="3.5" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#1c1917">{label}</text>
      </g>
    )
  }
  if (node.kind === 'water-point') {
    const both = node.supply !== 'cold'
    return (
      <g>
        <circle r="6" fill="#fff" stroke={both ? '#dc2626' : '#1d4ed8'} strokeWidth="1.4" />
        <text x="0" y="3" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#1c1917">{both ? 'KL' : 'KV'}</text>
      </g>
    )
  }
  if (node.kind === 'dhw-tank' || node.kind === 'buffer-tank') {
    return (
      <g>
        <rect x={-11} y={-8} width={22} height={16} rx="3" fill="#fff" stroke="#dc2626" strokeWidth="1.3" />
        <text x="0" y="3" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#dc2626">{node.kind === 'buffer-tank' ? 'PV' : 'LV'}</text>
      </g>
    )
  }
  if (node.kind === 'kv-manifold' || node.kind === 'lv-manifold' || node.kind === 'floor-manifold') {
    const label = node.kind === 'floor-manifold' ? 'LJT' : node.kind === 'lv-manifold' ? 'LV' : 'KV'
    return (
      <g>
        <rect x={-12} y={-5} width={24} height={10} fill="#fff" stroke="#1d4ed8" strokeWidth="1.2" />
        <text x="0" y="3" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#1d4ed8">{label}</text>
      </g>
    )
  }
  if (node.kind === 'heat-source' || node.kind === 'air-air') {
    return (
      <g>
        <rect x={-12} y={-8} width={24} height={16} fill="#fff7ed" stroke="#c2410c" strokeWidth="1.3" />
        <text x="0" y="3" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#c2410c">{node.kind === 'air-air' ? 'ILP' : 'LL'}</text>
      </g>
    )
  }
  if (node.kind === 'heater-rad') {
    return (
      <g>
        <rect x={-9} y={-6} width={18} height={12} fill="#fff" stroke="#dc2626" strokeWidth="1.2" />
        <path d="M-5,-6 V6 M-1,-6 V6 M3,-6 V6" stroke="#dc2626" strokeWidth="0.7" />
      </g>
    )
  }
  if (node.kind === 'actuator') {
    return (
      <g data-testid="actuator-tag">
        <rect x={-3} y={-3} width={6} height={6} rx={0.8} fill="#fff" stroke="#0f766e" strokeWidth={0.7} />
        <text x="0" y="1.7" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#0f766e">A</text>
      </g>
    )
  }
  if (node.kind === 'thermostat') {
    return (
      <g>
        <rect x={-6} y={-6} width={12} height={12} fill="#fff" stroke="#0f766e" strokeWidth="1.1" />
        <text x="0" y="3" textAnchor="middle" fontSize={tagSize} fontWeight="700" fill="#0f766e">T</text>
      </g>
    )
  }
  return <circle r="4" fill={color} />
}

function cableMark(run) {
  if (!run.marking || !run.showMark) return ''
  if (run.system === 'electric' || run.system === 'water' || run.system === 'heat') return run.marking
  return ''
}

function CableMark({ points, text, X, Y, show = true, side = 1, along = 0.5, gap = 0.55, size = 8 }) {
  if (!show || !text || !points || points.length < 2) return null
  let best = null
  for (let i = 1; i < points.length; i += 1) {
    const len = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
    if (!best || len > best.len) best = { len, a: points[i - 1], b: points[i] }
  }
  if (!best || best.len < 0.35) return null
  const dx = best.b.x - best.a.x
  const dz = best.b.z - best.a.z
  const len = Math.hypot(dx, dz) || 1
  const ox = (-dz / len) * gap * side
  const oz = (dx / len) * gap * side
  return (
    <text
      data-testid="cable-mark"
      x={X(best.a.x + dx * along + ox)}
      y={Y(best.a.z + dz * along + oz)}
      textAnchor="middle"
      fontSize={size}
      fontWeight="650"
      fill="#1c1917"
      stroke="#fbfaf7"
      strokeWidth="2.6"
      paintOrder="stroke"
      style={{ pointerEvents: 'none' }}
    >
      {text}
    </text>
  )
}

function Jakotukki({ node, count, X, Y }) {
  const n = Math.max(1, count)
  const pitch = 0.2
  const span = pitch * Math.max(0, n - 1)
  const bar = 0.1
  const stub = 0.16
  const px = (metres) => X(node.x + metres) - X(node.x)
  const pz = (metres) => Y(node.z + metres) - Y(node.z)
  const z0 = -span / 2
  return (
    <g data-testid="jakotukki">
      <rect
        x={px(-bar / 2)}
        y={pz(z0 - 0.07)}
        width={Math.abs(px(bar))}
        height={Math.abs(pz(span + 0.14))}
        fill="#fff"
        stroke="#1d4ed8"
        strokeWidth={1.15}
      />
      {Array.from({ length: n }, (_, index) => {
        const z = z0 + index * pitch
        return (
          <g key={index}>
            <line x1={px(bar / 2)} y1={pz(z)} x2={px(bar / 2 + stub)} y2={pz(z)} stroke="#c2410c" strokeWidth={1.15} />
            <rect
              data-testid="actuator-tag"
              x={px(bar / 2 + stub) - 2.6}
              y={pz(z) - 2.6}
              width={5.2}
              height={5.2}
              rx={0.8}
              fill="#fff"
              stroke="#0f766e"
              strokeWidth={0.7}
            />
          </g>
        )
      })}
    </g>
  )
}

function LoopTag({ points, label, X, Y, size = 8 }) {
  if (!points?.length || label == null) return null
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const cz = points.reduce((sum, point) => sum + point.z, 0) / points.length
  const text = String(label)
  const width = Math.max(14, text.length * 6.5 + 8)
  return (
    <g data-testid="loop-tag" transform={`translate(${X(cx)} ${Y(cz)})`} style={{ pointerEvents: 'none' }}>
      <rect x={-width / 2} y={-7} width={width} height={12} rx={2} fill="#fff" stroke="#c2410c" strokeWidth={0.8} />
      <text x={0} y={2.4} textAnchor="middle" fontSize={size} fontWeight="700" fill="#9a3412">{text}</text>
    </g>
  )
}

function insideHouse(plan, x, z) {
  const box = houseBox(plan)
  if (!box) return false
  return x >= box.minX - 0.15 && x <= box.maxX + 0.15 && z >= box.minZ - 0.15 && z <= box.maxZ + 0.15
}

function siteRun(plan, run) {
  if (run.kind === 'collector' || String(run.linkedFrom || '').startsWith('yard:')) return true
  return (run.points || []).some((point) => !insideHouse(plan, point.x, point.z))
}

export function ServiceDrawing({ plan, X, Y, sheet, legendBox, interactive, preview, onContext, selected, onRouteDown, quietLabels = false, siteMode = false, flashId = null, activeSystems = null, legendSystems = null, zoom = 1, camera = null, viewport = null, roomLabels = [], dimensions = [] }) {
  const { t } = usePlanLocale(plan)
  const services = ensureServices(plan)
  const visibleRuns = services.runs.filter((run) => serviceItemVisible(plan, run) && (!siteMode || siteRun(plan, run)))
  const visibleNodes = services.nodes.filter((node) => serviceItemVisible(plan, node) && (!siteMode || node.system === 'ground' || !insideHouse(plan, node.x, node.z)))
  const manifold = visibleNodes.find((node) => node.system === 'heat' && node.kind === 'floor-manifold')
  const loopCount = services.runs.filter((run) => run.system === 'heat' && (run.kind === 'floorheat' || run.role === 'loop')).length
  const drawnNodes = visibleNodes.filter((node) => {
    if (!manifold || node.system !== 'heat') return true
    if (node.kind === 'actuator') return false
    if (node.kind !== 'heat-source' && node.kind !== 'thermostat') return true
    return Math.hypot(node.x - manifold.x, node.z - manifold.z) > 1.25
  })
  const order = { drain: 0, water: 1, heat: 2, electric: 3, iv: 4 }
  const runs = [...visibleRuns].sort((a, b) => (order[a.system] ?? 9) - (order[b.system] ?? 9))
  const multi = new Set(runs.map((run) => run.system)).size > 1
  const drawn = runs.map((run) => ({ run, points: shiftPoints(run.points, run.system, multi, run.kind) }))
  const fittings = collectFittings(drawn
    .filter(({ run }) => run.kind !== 'floorheat' && run.kind !== 'efloor' && run.role !== 'loop')
    .map((item) => ({ ...item.run, points: item.points })))
  const legend = SERVICE_SYSTEMS.filter((item) => (
    (!Array.isArray(legendSystems) || legendSystems.includes(item.id))
    && layerVisible(plan, item.id)
    && (services.runs.some((run) => run.system === item.id) || services.nodes.some((node) => node.system === item.id))
  )).flatMap((item) => serviceLegend(item.id).map((row) => ({ ...row, system: item.id })))
  const live = (system) => !Array.isArray(activeSystems) || activeSystems.includes(system)
  const open = (event, hit) => {
    event.preventDefault()
    event.stopPropagation()
    onContext(event, hit)
  }
  const leaders = []
  const labelFont = annotationFont(sheet?.k || 1, zoom, 2.3, 14)
  const flowFont = annotationFont(sheet?.k || 1, zoom, 2, 11)
  const tagFont = paperFont(sheet?.k || 1, zoom, 2.5)
  const nameFont = paperFont(sheet?.k || 1, zoom, 3.5)
  const areaFont = paperFont(sheet?.k || 1, zoom, 2.5)
  const ink = Math.min(0.45, 1.1 / Math.max(zoom, 0.2))
  const view = viewport && camera ? {
    x: (0 - (camera.x || 0)) / Math.max(zoom, 0.2),
    y: (0 - (camera.y || 0)) / Math.max(zoom, 0.2),
    w: (viewport.w || 0) / Math.max(zoom, 0.2),
    h: (viewport.h || 0) / Math.max(zoom, 0.2),
  } : null
  const chrome = view ? {
    x: view.x + view.w * 0.22,
    y: view.y,
    w: view.w * 0.56,
    h: Math.max(18, 44 / Math.max(zoom, 0.2)),
    kind: 'chrome',
  } : null
  const obstacles = []
  if (chrome) obstacles.push(chrome)
  roomLabels.forEach((label) => {
    const cx = X(label.x)
    const cy = Y(label.z)
    const nameW = Math.max(nameFont * 2, String(label.text || '').length * nameFont * 0.58)
    const areaW = label.area ? String(label.area).length * areaFont * 0.55 : 0
    const w = Math.max(nameW, areaW) * 1.08
    const h = ((label.text ? nameFont : 0) + (label.area ? areaFont + nameFont * 0.2 : 0)) * 1.25
    obstacles.push({ x: cx - w / 2, y: cy - h / 2, w, h, kind: 'room' })
  })
  const dimFont = paperFont(sheet?.k || 1, zoom, 2.5)
  dimensions.forEach((dim) => {
    const off = Number.isFinite(dim.offset) ? dim.offset : 0
    const x1 = X(dim.x1 + (dim.nx || 0) * off)
    const y1 = Y(dim.z1 + (dim.nz || 0) * off)
    const x2 = X(dim.x2 + (dim.nx || 0) * off)
    const y2 = Y(dim.z2 + (dim.nz || 0) * off)
    const textT = Number.isFinite(dim.textT) ? dim.textT : 0.5
    const cx = x1 + (x2 - x1) * textT
    const cy = y1 + (y2 - y1) * textT
    const w = Math.max(dimFont * 1.8, String(dim.label || '').length * dimFont * 0.62)
    const h = dimFont * 1.35
    obstacles.push({ x: cx - w / 2, y: cy - h / 2, w, h, kind: 'dim' })
  })
  const routeSegs = []
  drawn.forEach(({ run, points }) => {
    if (!live(run.system)) return
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]
      const b = points[i]
      const riser = Math.hypot(b.x - a.x, b.z - a.z) < 0.05 && Math.abs((b.y || 0) - (a.y || 0)) > 0.08
      routeSegs.push({ key: `${run.id}:${i}`, x1: X(a.x), y1: Y(a.z), x2: X(b.x), y2: Y(b.z), riser })
    }
  })
  obstacles.push(...routeStrokeBoxes(routeSegs))
  const flowAnchor = new Map()
  drawnNodes.forEach((node) => {
    if (!live(node.system)) return
    const cx = X(node.x)
    const cy = Y(node.z)
    const wide = node.kind === 'ahu' ? 40 : node.kind === 'hood' ? 30 : node.kind === 'silencer' ? 26 : 20
    const tall = node.kind === 'ahu' ? 36 : 22
    obstacles.push({ x: cx - wide / 2, y: cy - tall / 2, w: wide, h: tall, kind: 'symbol' })
    if (!node.flow || quietLabels) return
    const place = placeFlowLabel(cx, cy, `${node.flow} l/s`, flowFont, Math.max(wide, tall) / 2 + 3, obstacles)
    flowAnchor.set(node.id, place)
    obstacles.push({ ...place.box, kind: 'label' })
  })
  const callouts = quietLabels ? [] : manifoldCallouts(plan)
  const legendFont = 10
  const legendStep = legendFont * 1.3
  const legendTitle = legendFont * 1.05
  const legendX = legendBox?.x ?? (sheet.x + sheet.w - 176)
  const legendW = Math.max(108, legendBox?.w ?? 160)
  const legendH = legend.length ? legendTitle + legend.length * legendStep + legendFont * 0.4 : 0
  let legendY = legendBox?.y ?? (sheet.y + 74)
  if (legendBox?.maxBottom && legendY + legendH > legendBox.maxBottom) {
    legendY = Math.max(legendBox.y ?? sheet.y + 8, legendBox.maxBottom - legendH)
  }
  const legendScale = Math.min(1, 13 / (10 * Math.max(zoom, 0.2)))
  if (legendH > 0) obstacles.push({ x: legendX, y: legendY, w: legendW * legendScale, h: legendH * legendScale, kind: 'legend' })
  if (!quietLabels) {
    const segments = []
    drawn.forEach(({ run, points }) => {
      if (!live(run.system) || !['trunk', 'main', 'header'].includes(run.role) || !run.size || points.length < 2) return
      let best = null
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i]
        const b = points[i + 1]
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        if (!best || len > best.len) best = { len, a, b, index: i }
      }
      if (!best || best.len < 0.7) return
      const sizeText = run.system === 'drain' ? `DN${run.size}` : run.system === 'water' ? `PEX ${run.size}` : `Ø${run.size}`
      const text = run.system === 'iv' && run.flow ? `${sizeText}  ${Math.round(run.flow)} l/s` : sizeText
      segments.push({
        key: run.id,
        routeKey: `${run.id}:${(best.index || 0) + 1}`,
        kind: run.kind,
        text,
        color: runColor(run),
        ax: X(best.a.x),
        ay: Y(best.a.z),
        bx: X(best.b.x),
        by: Y(best.b.z),
        len: best.len,
      })
    })
    const kindOrder = { tulo: 0, poisto: 1, ulko: 2, jate: 3 }
    segments.sort((a, b) => (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) || b.len - a.len)
    const labelBounds = view ? {
      x: view.x + 4,
      y: view.y + (chrome?.h || 0) + 2,
      w: Math.max(40, view.w - 8),
      h: Math.max(40, view.h - (chrome?.h || 0) - 8),
    } : null
    placeLineLabels(segments, obstacles, {
      font: labelFont,
      minLength: labelFont * 2,
      bounds: labelBounds,
    }).forEach((item) => leaders.push(item))
  }
  return (
    <g data-testid="service-layer">
      {drawn.map(({ run, points }) => {
        const color = runColor(run)
        const heatFloor = run.system === 'heat' && (run.dashed || run.kind === 'floorheat' || run.kind === 'efloor' || run.kind === 'ceiling' || run.kind === 'sensor' || run.kind === 'heat-zone' || run.role === 'feeder' || run.role === 'loop')
        const dashed = run.system === 'electric' || heatFloor || Boolean(run.dashed)
        const width = multi
          ? (run.system === 'iv' ? 1.15 : run.system === 'drain' ? 1.05 : 0.8)
          : (run.system === 'iv' ? 2.05 : run.system === 'drain' ? 1.85 : dashed ? 1.15 : 1.45)
        const runSelected = selected?.service?.target === 'run' && selected?.service?.id === run.id
        const showText = !quietLabels || runSelected
        return (
          <g key={run.id} opacity={live(run.system) ? 1 : 0.22} style={{ pointerEvents: live(run.system) ? 'auto' : 'none' }}>
            <polyline
              points={pointsOf(points, X, Y)}
              fill="none"
              stroke={color}
              strokeWidth={width}
              strokeDasharray={run.role === 'switch-drop' || run.role === 'traveler' ? '2 2' : (run.kind === 'floorheat' || run.role === 'loop' || run.kind === 'efloor' ? '3.2 1.8' : dashed ? '6 4' : undefined)}
              data-wire-role={run.role || ''}
              data-heat-kind={run.system === 'heat' ? run.kind : undefined}
              data-testid={run.kind === 'collector' ? 'collector-pipe' : (String(run.linkedFrom || '').includes(':sewer') ? 'sewer-line' : (run.system === 'heat' && (run.kind === 'floorheat' || run.kind === 'efloor') ? 'heat-loop' : undefined))}
              strokeLinejoin="round"
              strokeLinecap={run.kind === 'floorheat' || run.role === 'loop' || run.kind === 'efloor' ? 'butt' : 'round'}
              style={{ pointerEvents: 'none' }}
            />
            <polyline
              points={pointsOf(points, X, Y)}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ pointerEvents: interactive ? 'auto' : 'none' }}
              onContextMenu={(event) => open(event, { target: 'run', id: run.id, system: run.system })}
            />
            {points.map((point, index) => {
              if (!index) return null
              const prev = points[index - 1]
              const vertical = Math.hypot(point.x - prev.x, point.z - prev.z) < 0.05 && Math.abs((point.y || 0) - (prev.y || 0)) > 0.08
              if (!vertical) return null
              const up = (point.y || 0) > (prev.y || 0)
              return (
                <g key={`riser-${run.id}-${index}`} data-testid="route-riser" style={{ pointerEvents: 'none' }}>
                  <circle cx={X(point.x)} cy={Y(point.z)} r={5.5} fill="#fff" stroke={color} strokeWidth={1.6} />
                  {showText && <text x={X(point.x) + 8} y={Y(point.z) - 4} fontSize={tagFont} fontWeight="700" fill={color}>{up ? 'nousu' : 'lasku'}</text>}
                </g>
              )
            })}
            {run.locked && runSelected && points.length > 1 && (
              <g
                data-testid="route-lock-badge"
                transform={`translate(${X((points[0].x + points[1].x) / 2)} ${Y((points[0].z + points[1].z) / 2) - 10})`}
                style={{ pointerEvents: 'none' }}
              >
                <rect x={-6} y={-3} width={12} height={9} rx={1.5} fill="#fff" stroke="#0f766e" strokeWidth={1} />
                <path d="M-3.5,-3 v-2.4 a3.5,3.5 0 0 1 7,0 v2.4" fill="none" stroke="#0f766e" strokeWidth={1} />
              </g>
            )}
            {interactive && selected?.service?.target === 'run' && selected?.service?.id === run.id && points.map((point, index) => (
              <g key={`edit-${run.id}-${index}`}>
                <circle
                  data-testid={`route-vertex-${index}`}
                  cx={X(point.x)}
                  cy={Y(point.z)}
                  r={5}
                  fill="#fff"
                  stroke="#0f766e"
                  strokeWidth={1.6}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    event.preventDefault()
                    onRouteDown?.(event, { id: run.id, mode: 'vertex', index })
                  }}
                />
                {index < points.length - 1 && (
                  <rect
                    data-testid={`route-segment-${index}`}
                    x={X((point.x + points[index + 1].x) / 2) - 4}
                    y={Y((point.z + points[index + 1].z) / 2) - 4}
                    width={8}
                    height={8}
                    fill="#0f766e"
                    style={{ cursor: 'move' }}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      event.preventDefault()
                      onRouteDown?.(event, { id: run.id, mode: 'segment', index })
                    }}
                  />
                )}
              </g>
            ))}
            <SlopeMark run={{ ...run, points }} X={X} Y={Y} show={showText} size={tagFont} />
            <CableMark
              points={points}
              text={cableMark(run)}
              X={X}
              Y={Y}
              show={showText && run.kind !== 'floorheat' && !(callouts.length && run.system === 'heat' && (run.role === 'supply' || run.role === 'return'))}
              side={run.role === 'return' ? -1 : 1}
              along={run.role === 'return' ? 0.18 : run.role === 'supply' ? 0.82 : 0.5}
              gap={run.system === 'heat' ? 0.9 : 0.55}
              size={tagFont}
            />
            {(run.kind === 'floorheat' || run.role === 'loop') && (
              <LoopTag points={points} label={run.loopIndex || run.outlet} X={X} Y={Y} size={tagFont} />
            )}
          </g>
        )
      })}
      {callouts.map((item) => {
        const ax = X(item.anchor.x)
        const ay = Y(item.anchor.z)
        const tx = X(item.x)
        const ty = Y(item.z)
        const fontSize = tagFont
        const half = Math.max(fontSize * 2, String(item.text).length * fontSize * 0.3)
        const shoulder = tx >= ax ? tx - half : tx + half
        return (
          <g key={`callout-${item.role}`} data-testid="manifold-callout" data-role={item.role} style={{ pointerEvents: 'none' }}>
            <polyline points={`${ax},${ay} ${ax},${ty} ${shoulder},${ty}`} fill="none" stroke="#9a3412" strokeWidth={0.75} />
            <circle cx={ax} cy={ay} r={1.35} fill="#9a3412" />
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontWeight="650"
              fill="#1c1917"
              stroke="#fbfaf7"
              strokeWidth="1.5"
              paintOrder="stroke"
            >
              {item.text}
            </text>
          </g>
        )
      })}
      {!quietLabels && leaders.map((item) => (
        <g key={item.key || item.text} style={{ pointerEvents: 'none' }}>
          {item.leader && (
            <line x1={item.anchorX} y1={item.anchorY} x2={item.x} y2={item.y} stroke={item.color} strokeWidth={ink} />
          )}
          <text data-testid="duct-label" x={item.x} y={item.y} textAnchor="middle" dominantBaseline="central" fontSize={labelFont} fontWeight="650" fill={item.color} stroke="#fbfaf7" strokeWidth={ink} paintOrder="stroke">{item.text}</text>
        </g>
      ))}
      {fittings.bends.map((point, index) => (
        <circle key={`bend-${index}`} cx={X(point.x)} cy={Y(point.z)} r="2.2" fill="#fff" stroke="#1c1917" strokeWidth="0.8" style={{ pointerEvents: 'none' }} />
      ))}
      {fittings.tees.map((point, index) => (
        <circle key={`tee-${index}`} cx={X(point.x)} cy={Y(point.z)} r="3.3" fill="#1c1917" style={{ pointerEvents: 'none' }} />
      ))}
      {drawnNodes.map((node) => (
        <g
          key={node.id}
          data-testid={`svc-node-${node.kind}`}
          data-service-id={node.id}
          transform={`translate(${X(node.x)} ${Y(node.z)})`}
          opacity={live(node.system) ? 1 : 0.22}
          style={{ pointerEvents: interactive && live(node.system) ? 'auto' : 'none' }}
          onContextMenu={(event) => open(event, { target: 'node', id: node.id, system: node.system })}
        >
          {flashId === node.id && <circle data-testid="place-flash" r="16" fill="none" stroke="#ea580c" strokeWidth="2.4" />}
          {node.kind === 'floor-manifold'
            ? <Jakotukki node={node} count={loopCount || 1} X={X} Y={Y} />
            : <NodeSymbol node={node} tagSize={tagFont} />}
          {node.flow && (!quietLabels || (selected?.service?.target === 'node' && selected?.service?.id === node.id)) ? (
            <text data-testid="valve-flow" x={flowAnchor.get(node.id)?.x ?? 12} y={flowAnchor.get(node.id)?.y ?? 0} textAnchor={flowAnchor.get(node.id)?.anchor || 'start'} dominantBaseline="middle" fontSize={flowFont} fontWeight="650" fill={nodeColor(node)} stroke="#fbfaf7" strokeWidth={ink} paintOrder="stroke">{node.flow} l/s</text>
          ) : null}
          {node.system === 'electric' && node.circuit && node.kind !== 'panel' && (!quietLabels || (selected?.service?.target === 'node' && selected?.service?.id === node.id)) ? (
            <text data-testid="circuit-badge" x="11" y="-2" fontSize={tagFont} fontWeight="700" fill="#1c1917" stroke="#fbfaf7" strokeWidth={ink} paintOrder="stroke">{`R${node.circuit}`}</text>
          ) : null}
        </g>
      ))}
      {preview?.points?.length > 0 && (
        <polyline
          points={[...preview.points, ...(preview.cursor ? [preview.cursor] : [])].map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')}
          fill="none"
          stroke="#0f766e"
          strokeWidth="1.4"
          strokeDasharray="4 3"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {legendH > 0 && (
        <g data-testid="service-legend" transform={`translate(${legendX} ${legendY}) scale(${legendScale})`} style={{ pointerEvents: 'none' }}>
          <rect width={legendW} height={legendH} fill="#ffffff" stroke="#1c1917" strokeWidth={1 / legendScale} />
          <text x={8} y={legendTitle} fontSize={legendFont} fontWeight="700" fill="#1c1917">{t('legend.title')}</text>
          {legend.map((item, index) => {
            const y = legendTitle + legendStep * (index + 1)
            const label = item.key && t(item.key) !== item.key ? t(item.key) : item.name
            return (
              <g key={`${item.system}-${item.key || item.name}`}>
                <rect x={8} y={y - legendFont * 0.72} width="12" height={legendFont * 0.7} fill={item.color} stroke="#44403c" strokeWidth="0.5" />
                <text x={26} y={y} fontSize={legendFont} fill="#1c1917">{label}</text>
              </g>
            )
          })}
        </g>
      )}
    </g>
  )
}

const LOAD_KINDS = ['socket', 'switch', 'light', 'stove', 'oven', 'heater', 'radiator', 'ev', 'heatpump', 'iv-unit', 'boiler', 'washer', 'dishwasher']
const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25]

function NumberField({ testid, label, value, onCommit, step = '0.1' }) {
  const [text, setText] = useState(value == null ? '' : String(value))
  useEffect(() => {
    setText(value == null ? '' : String(value))
  }, [value])
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
      {label}
      <input
        data-testid={testid}
        style={fieldStyle}
        inputMode="decimal"
        step={step}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const next = Number(String(text).replace(',', '.'))
          if (Number.isFinite(next)) onCommit(next)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </label>
  )
}

function DeviceFields({ node, onPatch }) {
  const cores = Number(node.voltage) >= 300 ? 5 : 3
  const circuitValue = node.circuitMode === 'manual' && node.circuit ? String(node.circuit) : 'auto'
  return (
    <div data-testid="device-fields">
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Jännite
        <select data-testid="device-voltage" style={fieldStyle} value={Number(node.voltage) >= 300 ? 400 : 230} onChange={(event) => onPatch({ voltage: Number(event.target.value) })}>
          <option value={230}>230 V (1~ L+N+PE)</option>
          <option value={400}>400 V (3~ L1–L3+N+PE)</option>
        </select>
      </label>
      <NumberField testid="device-power" label="Teho (W)" value={node.power ?? 0} step="1" onCommit={(power) => onPatch({ power })} />
      <NumberField testid="device-cos" label="cos φ" value={node.cosPhi ?? 1} onCommit={(cosPhi) => onPatch({ cosPhi })} />
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Liitäntä
        <select data-testid="device-connection" style={fieldStyle} value={node.connection === 'socket' ? 'socket' : 'fixed'} onChange={(event) => onPatch({ connection: event.target.value })}>
          <option value="socket">Pistorasia</option>
          <option value="fixed">Kiinteä</option>
        </select>
      </label>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Ryhmä
        <select
          data-testid="device-circuit"
          style={fieldStyle}
          value={circuitValue}
          onChange={(event) => {
            if (event.target.value === 'auto') onPatch({ circuitMode: 'auto' })
            else onPatch({ circuitMode: 'manual', circuit: Number(event.target.value) })
          }}
        >
          <option value="auto">Automaattinen{node.circuit ? ` (R${node.circuit})` : ''}</option>
          {Array.from({ length: 16 }, (_, index) => index + 1).map((id) => (
            <option key={id} value={id}>R{id}</option>
          ))}
        </select>
      </label>
      {node.kind === 'switch' && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
          Kytkin
          <select data-testid="switch-style" style={fieldStyle} value={node.switchStyle || 'single'} onChange={(event) => onPatch({ switchStyle: event.target.value })}>
            <option value="single">Yksinkertainen</option>
            <option value="two-way">Vaihtokytkin</option>
            <option value="series">Sarjakytkin</option>
          </select>
        </label>
      )}
      {node.kind === 'socket' && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
          Syöttö
          <select data-testid="socket-feed" style={fieldStyle} value={node.feed === 'radial' ? 'radial' : 'chain'} onChange={(event) => onPatch({ feed: event.target.value })}>
            <option value="chain">Ketjutus</option>
            <option value="radial">Säteittäinen</option>
          </select>
        </label>
      )}
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Sulake
        <select
          data-testid="device-fuse"
          style={fieldStyle}
          value={node.fuseManual ? String(node.fuse) : 'auto'}
          onChange={(event) => {
            if (event.target.value === 'auto') onPatch({ fuseManual: false })
            else onPatch({ fuseManual: true, fuse: Number(event.target.value) })
          }}
        >
          <option value="auto">Automaattinen ({node.recommendedFuse || node.fuse || '—'} A)</option>
          {FUSE_SERIES.map((amp) => <option key={amp} value={amp}>{amp} A</option>)}
        </select>
      </label>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Kaapeli
        <select
          data-testid="device-cable"
          style={fieldStyle}
          value={node.cableManual ? String(node.section) : 'auto'}
          onChange={(event) => {
            if (event.target.value === 'auto') onPatch({ cableManual: false })
            else onPatch({ cableManual: true, section: Number(event.target.value) })
          }}
        >
          <option value="auto">Automaattinen ({node.cable || '—'})</option>
          {SECTIONS.map((section) => (
            <option key={section} value={section}>{cores}x{String(section).replace('.', ',')}</option>
          ))}
        </select>
      </label>
      <div data-testid="device-size" style={{ fontSize: 12, color: '#44403c', marginBottom: 8, lineHeight: 1.45 }}>
        {`${Number(node.current || 0).toFixed(1).replace('.', ',')} A`}
        {node.phase ? ` · ${node.phase}` : ''}
        {node.cable ? ` · ${node.cable}` : ''}
        {node.marking ? ` · ${node.marking}` : ''}
        {node.rcd ? ' · vikavirtasuoja 30 mA' : ''}
        {node.dropPct ? ` · jännitehäviö ${String(node.dropPct).replace('.', ',')} %` : ''}
      </div>
      {node.warning ? (
        <div data-testid="size-warning" style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>{node.warning}</div>
      ) : null}
    </div>
  )
}

function MenuBtn({ children, onClick, testid }) {
  return (
    <button type="button" data-testid={testid} onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 8px', border: 'none', background: 'transparent', color: '#1c1917', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', transform: 'none' }}>
      {children}
    </button>
  )
}

function RouteFields({ plan, run, segmentIndex = 0, onPatch, onCommit }) {
  const metres = routeLength(run.points)
  const materials = materialOptions(run.system)
  const insulations = insulationOptions(run.system)
  const cableChoices = run.system === 'electric'
    ? [...new Set([run.cable, run.marking, ...materials].filter(Boolean))]
    : materials
  const segment = Math.min(segmentIndex || 0, Math.max(0, (run.points || []).length - 2))
  const a = run.points?.[segment]
  const b = run.points?.[segment + 1]
  const segmentMetres = a && b ? Math.hypot(b.x - a.x, b.z - a.z) : metres
  return (
    <div data-testid="route-fields">
      <div style={{ fontSize: 12, color: '#44403c', marginBottom: 8 }}>
        {`Pituus ${metres.toFixed(1).replace('.', ',')} m`}
        {run.locked ? ' · manuaalinen' : ''}
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Nimi
        <input data-testid="route-label" style={fieldStyle} defaultValue={run.label || ''} onBlur={(event) => onPatch({ label: event.target.value })} />
      </label>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Korkeus
        <select
          data-testid="route-height"
          style={fieldStyle}
          value={run.heightMode || ''}
          onChange={(event) => onCommit(updateServiceRun(plan, run.id, { heightMode: event.target.value }))}
        >
          <option value="">Oma</option>
          {HEIGHT_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Osuuden korkeus
        <select
          data-testid="route-segment-height"
          style={fieldStyle}
          value=""
          onChange={(event) => {
            if (!event.target.value) return
            onCommit(updateServiceRun(plan, run.id, { segmentHeight: { index: segment, mode: event.target.value } }))
          }}
        >
          <option value="">Valitse osuudelle</option>
          {HEIGHT_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Osuuden pituus (m)
        <input
          data-testid="route-length"
          type="number"
          step="0.1"
          min="0.05"
          style={fieldStyle}
          defaultValue={Number(segmentMetres.toFixed(2))}
          onBlur={(event) => onCommit(updateServiceRun(plan, run.id, { segmentLength: { index: segment, metres: Number(event.target.value) } }))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onCommit(updateServiceRun(plan, run.id, { segmentLength: { index: segment, metres: Number(event.target.value) } }))
          }}
        />
      </label>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        {run.system === 'electric' ? 'Kaapeli' : 'Materiaali'}
        <select
          data-testid="route-material"
          style={fieldStyle}
          value={run.system === 'electric' ? (run.cable || '') : (run.material || '')}
          onChange={(event) => onCommit(updateServiceRun(plan, run.id, run.system === 'electric' ? { cable: event.target.value } : { material: event.target.value }))}
        >
          <option value="">—</option>
          {cableChoices.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        Eristys
        <select data-testid="route-insulation" style={fieldStyle} value={run.insulation || ''} onChange={(event) => onCommit(updateServiceRun(plan, run.id, { insulation: event.target.value }))}>
          <option value="">—</option>
          {insulations.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <div style={{ fontSize: 11, color: '#78716c', marginBottom: 8 }}>
        {`Asennuskorkeus ${heightMetres(plan, run.heightMode || 'ceiling', run.system) ?? '—'} m`}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        <input data-testid="service-lock" type="checkbox" checked={Boolean(run.locked)} onChange={(event) => onCommit(updateServiceRun(plan, run.id, { locked: event.target.checked }))} />
        Manuaalinen
      </label>
      <MenuBtn testid="route-reroute" onClick={() => onCommit(rerouteRun(plan, run.id))}>Reititä uudelleen</MenuBtn>
      <MenuBtn testid="route-reroute-system" onClick={() => onCommit(rerouteSystem(plan, run.system))}>Reititä järjestelmä uudelleen</MenuBtn>
    </div>
  )
}

export function ServiceMenu({ menu, plan, onApply, onCommit, onClose, onProperties, onRedraw, onCad, docked = false }) {
  if (!menu || menu.kind !== 'service') return null
  const services = ensureServices(plan)
  const node = menu.service?.target === 'node' ? services.nodes.find((item) => item.id === menu.service.id) : null
  const run = menu.service?.target === 'run' ? services.runs.find((item) => item.id === menu.service.id) : null
  const target = node || run
  if (!target) return null
  const write = onCommit || onApply
  const patchNode = (patch) => onApply(updateServiceNode(plan, node.id, patch))
  const patchRun = (patch) => write(updateServiceRun(plan, run.id, patch))
  const segmentIndex = menu.service?.segmentIndex || 0
  const remove = () => {
    onApply(node ? deleteServiceNode(plan, node.id) : deleteServiceRun(plan, run.id))
    onClose()
  }
  if (!docked) {
    const sizeOptions = run && run.system !== 'electric'
      ? (run.system === 'iv' ? [100, 125, 160] : run.system === 'water' ? [16, 20, 25] : [50, 75, 110]).map((size) => ({
        value: size,
        label: run.system === 'drain' ? `DN${size}` : run.system === 'water' ? `${size}` : `Ø${size}`,
        testid: `ctx-size-${size}`,
      }))
      : null
    return (
      <CadMenu x={menu.x} y={menu.y} testid="service-menu" kind="service" title={serviceObjectTitle(target)}>
        {sizeOptions && (
          <Segmented
            label="Koko"
            value={Number(run.size) || sizeOptions[0].value}
            options={sizeOptions}
            onChange={(size) => patchRun({ size })}
          />
        )}
        <CadItem testid="ctx-properties" onClick={() => (onProperties ? onProperties() : onClose())}>Ominaisuudet…</CadItem>
        {onCad && (
          <Flyout label="Muokkaa" testid="ctx-cad">
            {CAD_COMMANDS.map((cmd) => (
              <CadItem key={cmd.id} testid={`ctx-${cmd.testid}`} shortcut={cmd.short} onClick={() => { onCad(cmd.id); onClose() }}>{cmd.label}</CadItem>
            ))}
          </Flyout>
        )}
        {run && (
          <>
            <CadSep />
            <CadItem testid="route-add-vertex" onClick={() => {
              const index = segmentIndex
              const pts = run.points || []
              const a = pts[index]
              const b = pts[Math.min(pts.length - 1, index + 1)]
              if (!a || !b) return
              write(updateServiceRun(plan, run.id, { points: pts.flatMap((point, i) => (i === index ? [point, { x: (a.x + b.x) / 2, y: ((a.y || 0) + (b.y || 0)) / 2, z: (a.z + b.z) / 2 }] : [point])) }))
            }}>Lisää taitepiste</CadItem>
            <CadItem testid="route-remove-vertex" onClick={() => {
              if ((run.points || []).length <= 2) return
              const index = Math.min((run.points || []).length - 2, segmentIndex + 1)
              write(updateServiceRun(plan, run.id, { points: run.points.filter((_, i) => i !== index) }))
            }}>Poista piste</CadItem>
            <CadItem testid="route-split" onClick={() => write(splitServiceRun(plan, run.id, segmentIndex, 0.5))}>Jaa reitti</CadItem>
            <CadItem testid="route-join" onClick={() => write(joinServiceRuns(plan, run.id))}>Yhdistä</CadItem>
            <CadItem testid="route-redraw" onClick={() => onRedraw?.(run)}>Piirrä uudelleen</CadItem>
            <CadItem testid="route-reroute" onClick={() => { write(rerouteRun(plan, run.id)); onClose() }}>Reititä uudelleen</CadItem>
            <Segmented
              label="Korkeus"
              value={run.heightMode || 'ceiling'}
              options={HEIGHT_PRESETS.map((item) => ({ value: item.id, label: item.label, testid: `ctx-height-${item.id}` }))}
              onChange={(heightMode) => write(updateServiceRun(plan, run.id, { heightMode }))}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, padding: '4px 8px' }}>
              <input data-testid="service-lock" type="checkbox" checked={Boolean(run.locked)} onChange={(event) => write(updateServiceRun(plan, run.id, { locked: event.target.checked }))} />
              Manuaalinen
            </label>
          </>
        )}
        <CadSep />
        <CadItem testid="service-delete" danger shortcut="Del" onClick={remove}>Poista</CadItem>
      </CadMenu>
    )
  }
  return (
    <div
      data-testid="service-form"
      style={{ position: 'relative', width: '100%', background: 'transparent', padding: 0 }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {node && (
        <>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
            Nimi
            <input data-testid="service-name" style={fieldStyle} value={node.name || ''} onChange={(event) => patchNode({ name: event.target.value })} />
          </label>
          {(node.kind === 'valve' || node.kind === 'hood') && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Ilmavirta l/s
              <input data-testid="service-flow" type="number" min="0" style={fieldStyle} value={node.flow ?? 0} onChange={(event) => patchNode({ flow: Number(event.target.value) || 0 })} />
            </label>
          )}
          {node.kind === 'valve' && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Tehtävä
              <select data-testid="service-role" style={fieldStyle} value={node.role || 'tulo'} onChange={(event) => patchNode({ role: event.target.value })}>
                <option value="tulo">Tulo</option>
                <option value="poisto">Poisto</option>
              </select>
            </label>
          )}
          {node.system === 'electric' && LOAD_KINDS.includes(node.kind) && (
            <DeviceFields node={node} onPatch={patchNode} />
          )}
          {node.system === 'electric' && !LOAD_KINDS.includes(node.kind) && node.kind !== 'panel' && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Virtapiiri
              <select data-testid="service-circuit" style={fieldStyle} value={node.circuit || 1} onChange={(event) => patchNode({ circuit: Number(event.target.value), circuitMode: 'manual' })}>
                {Array.from({ length: 16 }, (_, index) => index + 1).map((id) => <option key={id} value={id}>R{id}</option>)}
              </select>
            </label>
          )}
          {node.kind === 'water-point' && (
            <div data-testid="water-fields">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
                Vesi
                <select data-testid="water-supply" style={fieldStyle} value={node.supply === 'cold' ? 'cold' : 'both'} onChange={(event) => patchNode({ supply: event.target.value, flowManual: false })}>
                  <option value="both">KV + LV</option>
                  <option value="cold">Vain KV</option>
                </select>
              </label>
              <NumberField testid="water-flow" label="Normivirtaama KV (l/s)" value={node.flowCold ?? 0} onCommit={(flowCold) => patchNode({ flowManual: true, flowCold })} />
              {node.supply !== 'cold' && (
                <NumberField testid="water-flow-hot" label="Normivirtaama LV (l/s)" value={node.flowHot ?? 0} onCommit={(flowHot) => patchNode({ flowManual: true, flowHot })} />
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
                <input data-testid="water-circ" type="checkbox" checked={Boolean(node.circulation)} onChange={(event) => patchNode({ circulation: event.target.checked })} />
                Lämpimän veden kierto
              </label>
              <div data-testid="water-size" style={{ fontSize: 12, color: '#44403c', marginBottom: 8 }}>
                {`Haara PEX ${pexSize(node.supply === 'cold' ? node.flowCold : Math.max(node.flowCold || 0, node.flowHot || 0))}`}
                {node.roomName ? ` · ${node.roomName}` : ''}
              </div>
            </div>
          )}
          {(node.kind === 'dhw-tank' || node.kind === 'buffer-tank') && (
            <div data-testid="tank-fields">
              <NumberField testid="tank-litres" label="Tilavuus (l)" step="10" value={node.litres || 300} onCommit={(litres) => patchNode({ litres })} />
              {node.kind === 'dhw-tank' && (
                <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
                  Lämmitys
                  <select data-testid="tank-mode" style={fieldStyle} value={node.tankMode || 'electric'} onChange={(event) => patchNode({ tankMode: event.target.value })}>
                    <option value="electric">Sähkövastus</option>
                    <option value="source">Lämmönlähteestä</option>
                  </select>
                </label>
              )}
            </div>
          )}
          {node.kind === 'heat-source' && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Lämmönlähde
              <select data-testid="source-kind" style={fieldStyle} value={node.source || 'district'} onChange={(event) => patchNode({ source: event.target.value, name: HEAT_SOURCES.find((item) => item.id === event.target.value)?.name })}>
                {HEAT_SOURCES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
          {node.kind === 'heater-rad' && (
            <NumberField testid="radiator-power" label="Teho (W)" step="10" value={node.power || 0} onCommit={(power) => patchNode({ power })} />
          )}
          {node.size && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Koko
              <input data-testid="service-size" type="number" style={fieldStyle} value={node.size} onChange={(event) => patchNode({ size: Number(event.target.value) || node.size })} />
            </label>
          )}
        </>
      )}
      {run && (
        <>
          <RouteFields plan={plan} run={run} segmentIndex={segmentIndex} onPatch={patchRun} onCommit={write} />
          {run.system === 'iv' && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Kanava
              <select data-testid="service-kind-field" style={fieldStyle} value={run.kind} onChange={(event) => patchRun({ kind: event.target.value })}>
                <option value="tulo">Tulo</option>
                <option value="poisto">Poisto</option>
                <option value="ulko">Ulko</option>
                <option value="jate">Jäte</option>
              </select>
            </label>
          )}
          {run.system === 'water' && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Putki
              <select data-testid="service-kind-field" style={fieldStyle} value={run.kind} onChange={(event) => patchRun({ kind: event.target.value })}>
                <option value="cold">Kylmä</option>
                <option value="hot">Lämmin</option>
                <option value="circ">Kierto</option>
                <option value="floorheat">Lattialämmitys</option>
              </select>
            </label>
          )}
          {run.system !== 'electric' && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Koko
              <select data-testid="service-size" style={fieldStyle} value={run.size || 100} onChange={(event) => patchRun({ size: Number(event.target.value) })}>
                {(run.system === 'iv' ? [100, 125, 160] : run.system === 'water' ? [16, 20, 25] : [50, 75, 110]).map((size) => (
                  <option key={size} value={size}>{run.system === 'drain' ? `DN${size}` : run.system === 'water' ? `PEX ${size}` : `Ø${size}`}</option>
                ))}
              </select>
            </label>
          )}
          {run.system === 'drain' && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Kaato %
              <input data-testid="service-slope" type="number" step="0.1" style={fieldStyle} value={run.slope ?? 1} onChange={(event) => patchRun({ slope: Number(event.target.value) || 0 })} />
            </label>
          )}
          {run.system === 'electric' && (
            <>
              {run.marking ? <div style={{ fontSize: 12, color: '#44403c', marginBottom: 8 }}>{run.marking}</div> : null}
              <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
                Virtapiiri
                <select data-testid="service-circuit" style={fieldStyle} value={run.circuit || 1} onChange={(event) => patchRun({ circuit: Number(event.target.value) })}>
                  {Array.from({ length: 16 }, (_, index) => index + 1).map((id) => <option key={id} value={id}>R{id}</option>)}
                </select>
              </label>
            </>
          )}
          <MenuBtn testid="route-add-vertex" onClick={() => {
            const index = segmentIndex
            const pts = run.points || []
            const a = pts[index]
            const b = pts[Math.min(pts.length - 1, index + 1)]
            if (!a || !b) return
            write(updateServiceRun(plan, run.id, { points: pts.flatMap((point, i) => (i === index ? [point, { x: (a.x + b.x) / 2, y: ((a.y || 0) + (b.y || 0)) / 2, z: (a.z + b.z) / 2 }] : [point])) }))
          }}>Lisää taitepiste</MenuBtn>
          <MenuBtn testid="route-split" onClick={() => write(splitServiceRun(plan, run.id, segmentIndex, 0.5))}>Jaa reitti</MenuBtn>
          <MenuBtn testid="route-join" onClick={() => write(joinServiceRuns(plan, run.id))}>Yhdistä</MenuBtn>
          <MenuBtn testid="route-redraw" onClick={() => onRedraw?.(run)}>Piirrä uudelleen</MenuBtn>
        </>
      )}
      <MenuBtn testid="service-form-delete" onClick={remove}>Poista</MenuBtn>
    </div>
  )
}
