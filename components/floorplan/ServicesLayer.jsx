'use client'

import {
  CIRCUITS,
  PLACEABLES,
  SERVICE_SYSTEMS,
  airflowBalance,
  collectFittings,
  deleteServiceNode,
  deleteServiceRun,
  ensureServices,
  layerVisible,
  nodeColor,
  runColor,
  serviceLegend,
  updateServiceNode,
  updateServiceRun,
} from '@/lib/services'

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
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <input data-testid="floor-heating" type="checkbox" checked={floorHeating} onChange={(event) => onFloorHeating(event.target.checked)} />
        Lattialämmitys
      </label>
      <button type="button" data-testid="route-services" style={barBtn(false)} onClick={onRoute}>Reititä automaattisesti</button>
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

function shiftPoints(points, system, multi) {
  if (!multi || !points || points.length < 2) return points || []
  const dist = RUN_SHIFT[system] || 0
  if (!dist) return points
  return points.map((point, index) => {
    const prev = points[Math.max(0, index - 1)]
    const next = points[Math.min(points.length - 1, index + 1)]
    let dx = next.x - prev.x
    let dz = next.z - prev.z
    const len = Math.hypot(dx, dz) || 1
    dx /= len
    dz /= len
    return { x: point.x - dz * dist, z: point.z + dx * dist }
  })
}

function SlopeMark({ run, X, Y }) {
  const pts = run.points || []
  if (!run.slope || pts.length < 2) return null
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
      <text x="12" y="-3" fontSize="10" fill="#292524">{label}</text>
    </g>
  )
}

function NodeSymbol({ node }) {
  const color = nodeColor(node)
  if (node.kind === 'ahu') {
    return (
      <g>
        <rect x={-16} y={-10} width={32} height={20} rx={3} fill="#f8fafc" stroke={color} strokeWidth={1.6} />
        <path d="M-8,-4 L0,4 L8,-4" fill="none" stroke="#dc2626" strokeWidth={1.2} />
        <path d="M-8,4 L0,-4 L8,4" fill="none" stroke="#2563eb" strokeWidth={1.2} />
        <text x="0" y="18" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1c1917">IV</text>
      </g>
    )
  }
  if (node.kind === 'hood') {
    return (
      <g>
        <rect x={-12} y={-7} width={24} height={14} fill="#fff7ed" stroke={color} strokeWidth={1.4} />
        <text x="0" y="4" textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>LK</text>
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
        <text x="0" y="3.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1d4ed8">JT</text>
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
        <text x="0" y="3" textAnchor="middle" fontSize="7" fontWeight="700" fill="#44403c">PL</text>
      </g>
    )
  }
  if (node.kind === 'drain-point') return <circle r="3.5" fill="#44403c" />
  if (node.kind === 'panel') {
    return (
      <g>
        <rect x={-11} y={-8} width={22} height={16} fill="#fff" stroke="#1c1917" strokeWidth={1.4} />
        <text x="0" y="3.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1c1917">SK</text>
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
  if (node.kind === 'junction') return <circle r="3.4" fill="#1c1917" />
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
        <text x="0" y="3" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1c1917">{node.kind === 'heater' ? 'K' : 'L'}</text>
      </g>
    )
  }
  return <circle r="4" fill={color} />
}

export function ServiceDrawing({ plan, X, Y, sheet, legendBox, interactive, preview, onContext }) {
  const services = ensureServices(plan)
  const visibleRuns = services.runs.filter((run) => layerVisible(plan, run.system))
  const visibleNodes = services.nodes.filter((node) => layerVisible(plan, node.system))
  const order = { drain: 0, water: 1, electric: 2, iv: 3 }
  const runs = [...visibleRuns].sort((a, b) => (order[a.system] ?? 9) - (order[b.system] ?? 9))
  const multi = new Set(runs.map((run) => run.system)).size > 1
  const drawn = runs.map((run) => ({ run, points: shiftPoints(run.points, run.system, multi) }))
  const fittings = collectFittings(drawn.map((item) => ({ ...item.run, points: item.points })))
  const legend = SERVICE_SYSTEMS.filter((item) => layerVisible(plan, item.id) && (services.runs.some((run) => run.system === item.id) || services.nodes.some((node) => node.system === item.id))).flatMap((item) => serviceLegend(item.id).map((row) => ({ ...row, system: item.id })))
  const open = (event, hit) => {
    event.preventDefault()
    event.stopPropagation()
    onContext(event, hit)
  }
  const leaders = []
  const bestTrunk = new Map()
  drawn.forEach(({ run, points }) => {
    if (!['trunk', 'main', 'header'].includes(run.role) || !run.size || points.length < 2) return
    let longest = 0
    let mid = null
    let normal = { x: 0, z: -1 }
    for (let i = 0; i < points.length - 1; i += 1) {
      const dx = points[i + 1].x - points[i].x
      const dz = points[i + 1].z - points[i].z
      const len = Math.hypot(dx, dz)
      if (len <= longest) continue
      longest = len
      mid = { x: (points[i].x + points[i + 1].x) / 2, z: (points[i].z + points[i + 1].z) / 2 }
      normal = { x: -dz / (len || 1), z: dx / (len || 1) }
    }
    if (!mid || longest < 1.1) return
    const prev = bestTrunk.get(run.system)
    if (!prev || longest > prev.longest) {
      const text = run.system === 'drain' ? `DN${run.size}` : run.system === 'water' ? `PEX ${run.size}` : `Ø${run.size}`
      bestTrunk.set(run.system, { longest, mid, normal, text, color: runColor(run) })
    }
  })
  bestTrunk.forEach((item) => leaders.push(item))
  const legendX = legendBox?.x ?? (sheet.x + sheet.w - 176)
  const legendY = legendBox?.y ?? (sheet.y + 74)
  const legendW = Math.max(108, legendBox?.w ?? 160)
  const legendH = legend.length ? 22 + legend.length * 15 : 0
  return (
    <g data-testid="service-layer">
      {drawn.map(({ run, points }) => {
        const color = runColor(run)
        const dashed = run.system === 'electric'
        const width = multi
          ? (run.system === 'iv' ? 1.15 : run.system === 'drain' ? 1.05 : 0.8)
          : (run.system === 'iv' ? 2.05 : run.system === 'drain' ? 1.85 : dashed ? 1.15 : 1.45)
        return (
          <g key={run.id}>
            <polyline
              points={pointsOf(points, X, Y)}
              fill="none"
              stroke={color}
              strokeWidth={width}
              strokeDasharray={dashed ? '5 3' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
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
            <SlopeMark run={{ ...run, points }} X={X} Y={Y} />
          </g>
        )
      })}
      {leaders.map((item) => {
        const ax = X(item.mid.x)
        const ay = Y(item.mid.z)
        const bx = ax + item.normal.x * 22
        const by = ay + item.normal.z * 22
        return (
          <g key={item.text} style={{ pointerEvents: 'none' }}>
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke={item.color} strokeWidth={0.7} />
            <text x={bx} y={by - 3} fontSize="9" fontWeight="700" fill={item.color} stroke="#fbfaf7" strokeWidth="2.4" paintOrder="stroke">{item.text}</text>
          </g>
        )
      })}
      {fittings.bends.map((point, index) => (
        <circle key={`bend-${index}`} cx={X(point.x)} cy={Y(point.z)} r="2.2" fill="#fff" stroke="#1c1917" strokeWidth="0.8" style={{ pointerEvents: 'none' }} />
      ))}
      {fittings.tees.map((point, index) => (
        <circle key={`tee-${index}`} cx={X(point.x)} cy={Y(point.z)} r="3.3" fill="#1c1917" style={{ pointerEvents: 'none' }} />
      ))}
      {visibleNodes.map((node) => (
        <g
          key={node.id}
          data-testid={`svc-node-${node.kind}`}
          data-service-id={node.id}
          transform={`translate(${X(node.x)} ${Y(node.z)})`}
          style={{ pointerEvents: interactive ? 'auto' : 'none' }}
          onContextMenu={(event) => open(event, { target: 'node', id: node.id, system: node.system })}
        >
          <NodeSymbol node={node} />
          {node.flow ? (
            <g style={{ pointerEvents: 'none' }}>
              <line x1="5" y1="-3" x2="14" y2="-14" stroke={nodeColor(node)} strokeWidth="0.7" />
              <text x="16" y="-14" fontSize="8" fontWeight="700" fill={nodeColor(node)} stroke="#fbfaf7" strokeWidth="2.2" paintOrder="stroke">{node.flow} l/s</text>
            </g>
          ) : null}
          {!multi && node.system === 'electric' && node.circuit && (node.kind === 'panel' || node.kind === 'stove' || node.kind === 'heater') ? (
            <text x="10" y="4" fontSize="8" fill="#44403c" stroke="#fbfaf7" strokeWidth="2" paintOrder="stroke">{node.circuit}</text>
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
        <g data-testid="service-legend" style={{ pointerEvents: 'none' }}>
          <rect x={legendX} y={legendY} width={legendW} height={legendH} fill="#ffffff" stroke="#1c1917" strokeWidth="1" />
          <text x={legendX + 8} y={legendY + 14} fontSize="10" fontWeight="700" fill="#1c1917">Selite</text>
          {legend.map((item, index) => (
            <g key={`${item.system}-${item.name}`} transform={`translate(${legendX + 8} ${legendY + 22 + index * 15})`}>
              <rect width="12" height="8" fill={item.color} stroke="#44403c" strokeWidth="0.5" />
              <text x="18" y="8" fontSize="10" fill="#1c1917">{item.name}</text>
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

function MenuBtn({ children, onClick, testid }) {
  return (
    <button type="button" data-testid={testid} onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 8px', border: 'none', background: 'transparent', color: '#1c1917', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', transform: 'none' }}>
      {children}
    </button>
  )
}

export function ServiceMenu({ menu, plan, onApply, onClose }) {
  if (!menu || menu.kind !== 'service') return null
  const services = ensureServices(plan)
  const node = menu.service?.target === 'node' ? services.nodes.find((item) => item.id === menu.service.id) : null
  const run = menu.service?.target === 'run' ? services.runs.find((item) => item.id === menu.service.id) : null
  const target = node || run
  if (!target) return null
  const left = Math.max(8, Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 280))
  const top = Math.max(8, Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320))
  const systemName = SERVICE_SYSTEMS.find((item) => item.id === target.system)?.title || 'Talotekniikka'
  const patchNode = (patch) => onApply(updateServiceNode(plan, node.id, patch))
  const patchRun = (patch) => onApply(updateServiceRun(plan, run.id, patch))
  const remove = () => {
    onApply(node ? deleteServiceNode(plan, node.id) : deleteServiceRun(plan, run.id))
    onClose()
  }
  return (
    <div
      data-testid="service-menu"
      style={{ position: 'fixed', left, top, zIndex: 60, width: 260, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.16)', padding: 8 }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 6px 8px' }}>{systemName}</div>
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
          {node.system === 'electric' && (
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Virtapiiri
              <select data-testid="service-circuit" style={fieldStyle} value={node.circuit || 1} onChange={(event) => patchNode({ circuit: Number(event.target.value) })}>
                {CIRCUITS.map((item) => <option key={item.id} value={item.id}>{item.id} {item.name}</option>)}
              </select>
            </label>
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
            <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
              Virtapiiri
              <select data-testid="service-circuit" style={fieldStyle} value={run.circuit || 1} onChange={(event) => patchRun({ circuit: Number(event.target.value) })}>
                {CIRCUITS.map((item) => <option key={item.id} value={item.id}>{item.id} {item.name}</option>)}
              </select>
            </label>
          )}
        </>
      )}
      <MenuBtn testid="service-delete" onClick={remove}>Poista</MenuBtn>
    </div>
  )
}
