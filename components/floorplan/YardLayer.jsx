'use client'

import { COVER_TYPES, coverPosts } from '@/lib/covers'
import { CLEARANCE_RADII, GROUND_TOOLS, groundWarnings } from '@/lib/groundworks'
import { layerVisible } from '@/lib/services'
import {
  BEDS,
  FENCE_KINDS,
  PATH_KINDS,
  PATH_MATERIALS,
  PLANTS,
  TERRACE_MATERIALS,
  buildingSpec,
  centroid,
  ensureYard,
  formatMetres,
  formatSquare,
  objectSpec,
  plantSpec,
  formatTerraceLevels,
  plotMetrics,
  setbackList,
  terraceRailingEnabled,
  terraceSteps,
} from '@/lib/yard'

function pts(points, X, Y) {
  return (points || []).map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')
}

function mid(a, b) {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
}

function separateSheetLabels(labels) {
  const placed = labels.map((item) => ({ ...item, place: { ...item.place } }))
  for (let pass = 0; pass < 6; pass += 1) {
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i].place
        const b = placed[j].place
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        if (dist >= 42) continue
        const push = (42 - dist) / 2
        const ux = dx / dist
        const uy = dy / dist
        a.x -= ux * push
        a.y -= uy * push
        b.x += ux * push
        b.y += uy * push
      }
    }
  }
  return placed
}

function labelOffset(at, center, dist, X, Y) {
  const sx = X(at.x)
  const sy = Y(at.z)
  const dx = X(center.x) - sx
  const dy = Y(center.z) - sy
  const len = Math.hypot(dx, dy) || 1
  return { x: sx + (dx / len) * dist, y: sy + (dy / len) * dist }
}

export function yardLegendHeight() {
  return 26 + PLANTS.length * 16 + 4 + BEDS.length * 14 + 18
}

function inset(points, ratio) {
  const center = centroid(points)
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * ratio,
    z: center.z + (point.z - center.z) * ratio,
  }))
}

function fencePieces(fence) {
  const pieces = []
  const points = fence.points || []
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const gate = (fence.gates || []).find((item) => (item.segment ?? 0) === i)
    if (!gate) {
      pieces.push({ line: [a, b] })
      continue
    }
    const width = Math.min(len * 0.8, Math.max(0.8, gate.width || 1))
    const offset = Math.max(0, Math.min(len - width, gate.offset || 0))
    const ux = (b.x - a.x) / len
    const uz = (b.z - a.z) / len
    const g0 = { x: a.x + ux * offset, z: a.z + uz * offset }
    const g1 = { x: a.x + ux * (offset + width), z: a.z + uz * (offset + width) }
    pieces.push({ line: [a, g0] })
    pieces.push({ gate: [g0, g1], nx: -uz, nz: ux })
    pieces.push({ line: [g1, b] })
  }
  return pieces
}

function PlantMark({ kind, r }) {
  if (kind === 'conifer') {
    return (
      <g fill="none" stroke="#1c1917" strokeWidth={1.05}>
        <circle r={r} />
        <circle r={r * 0.42} />
        {Array.from({ length: 8 }, (_, index) => {
          const a = (index / 8) * Math.PI * 2
          return <line key={index} x1={Math.cos(a) * r * 0.2} y1={Math.sin(a) * r * 0.2} x2={Math.cos(a) * r * 0.92} y2={Math.sin(a) * r * 0.92} />
        })}
      </g>
    )
  }
  if (kind === 'fruit') {
    return (
      <g fill="none" stroke="#1c1917" strokeWidth={1.05}>
        <circle r={r} />
        <circle r={2.1} cx={-r * 0.28} cy={-r * 0.1} />
        <circle r={2.1} cx={r * 0.32} cy={r * 0.05} />
        <circle r={1.7} cx={0} cy={r * 0.38} />
      </g>
    )
  }
  if (kind === 'bush') {
    return (
      <g fill="none" stroke="#1c1917" strokeWidth={1.05}>
        <circle r={r} />
        <circle r={r * 0.45} cx={-r * 0.35} />
        <circle r={r * 0.42} cx={r * 0.38} cy={r * 0.1} />
        <circle r={r * 0.36} cy={r * 0.4} />
      </g>
    )
  }
  if (kind === 'hedge') {
    return (
      <g fill="none" stroke="#1c1917" strokeWidth={1.05}>
        <ellipse rx={r} ry={r * 0.62} />
        <line x1={-r * 0.7} x2={r * 0.7} />
        <line y1={-r * 0.28} y2={r * 0.28} />
      </g>
    )
  }
  return (
    <g fill="none" stroke="#1c1917" strokeWidth={1.05}>
      <circle r={r} />
      <circle r={Math.max(1.4, r * 0.12)} fill="#1c1917" stroke="none" />
      <path d={`M ${-r * 0.15} ${-r * 0.2} Q 0 ${-r * 0.85} ${r * 0.45} ${-r * 0.15}`} />
      <path d={`M ${r * 0.1} ${r * 0.05} Q ${r * 0.7} ${r * 0.15} ${r * 0.2} ${r * 0.7}`} />
    </g>
  )
}

function ObjectMark({ kind, w, h }) {
  const common = { fill: 'none', stroke: '#1c1917', strokeWidth: 1.05 }
  if (kind === 'well' || kind === 'rainwell') {
    return (
      <g {...common}>
        <circle r={Math.min(w, h) * 0.42} strokeDasharray={kind === 'rainwell' ? '3 2' : undefined} />
        <circle r={Math.min(w, h) * 0.16} />
        <line x1={-w * 0.28} x2={w * 0.28} />
        <line y1={-h * 0.28} y2={h * 0.28} />
      </g>
    )
  }
  if (kind === 'light-pole' || kind === 'light-bollard') {
    const r = kind === 'light-bollard' ? 4.5 : 6
    return (
      <g {...common}>
        <circle r={r} />
        <line x1={-r} x2={r} />
        <line y1={-r} y2={r} />
        {kind === 'light-pole' && <line y1={r} y2={r + 8} />}
      </g>
    )
  }
  if (kind === 'mailbox') {
    return (
      <g {...common}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} />
        <path d={`M ${w / 2} ${-h / 2} l 7 -6 l 0 8 z`} />
      </g>
    )
  }
  if (kind === 'flagpole') {
    return (
      <g {...common}>
        <circle r={3} />
        <line y1={-3} y2={-16} />
        <path d="M 0 -16 l 10 3 l -10 3 z" fill="#1c1917" />
      </g>
    )
  }
  if (kind === 'hottub') {
    return (
      <g {...common}>
        <circle r={Math.min(w, h) * 0.46} />
        <circle r={Math.min(w, h) * 0.28} />
        <path d={`M ${-w * 0.15} 0 q ${w * 0.15} ${-h * 0.12} ${w * 0.3} 0`} />
      </g>
    )
  }
  if (kind === 'gazebo') {
    return (
      <g {...common}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} />
        <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} />
        <line x1={w / 2} y1={-h / 2} x2={-w / 2} y2={h / 2} />
        <circle r={2.2} cx={-w / 2} cy={-h / 2} fill="#1c1917" />
        <circle r={2.2} cx={w / 2} cy={-h / 2} fill="#1c1917" />
        <circle r={2.2} cx={w / 2} cy={h / 2} fill="#1c1917" />
        <circle r={2.2} cx={-w / 2} cy={h / 2} fill="#1c1917" />
      </g>
    )
  }
  if (kind === 'playground') {
    return (
      <g {...common}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} />
        <path d={`M ${-w * 0.2} ${h * 0.2} l ${w * 0.18} ${-h * 0.45} l ${w * 0.18} ${h * 0.45}`} />
        <line x1={-w * 0.02} x2={w * 0.16} y1={-h * 0.08} y2={-h * 0.08} />
      </g>
    )
  }
  if (kind === 'charger' || kind === 'gate-opener') {
    return (
      <g {...common}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} />
        <path d={`M ${-w * 0.12} ${-h * 0.2} l ${w * 0.16} ${h * 0.28} l ${-w * 0.05} 0 l ${w * 0.14} ${h * 0.22}`} />
      </g>
    )
  }
  if (kind === 'firepit') {
    const r = Math.min(w, h) * 0.28
    return (
      <g {...common}>
        <circle r={r + 5} />
        {Array.from({ length: 8 }, (_, index) => {
          const a = (index / 8) * Math.PI * 2
          return <circle key={index} r={2.1} cx={Math.cos(a) * (r + 5)} cy={Math.sin(a) * (r + 5)} />
        })}
      </g>
    )
  }
  return (
    <g {...common}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} />
      {kind === 'grill' && Array.from({ length: 3 }, (_, index) => (
        <line key={index} x1={-w * 0.35} x2={w * 0.35} y1={-h * 0.22 + index * h * 0.22} y2={-h * 0.22 + index * h * 0.22} />
      ))}
      {kind === 'trash' && <path d={`M ${-w / 2} ${-h / 2} L 0 ${-h / 2 - 6} L ${w / 2} ${-h / 2}`} />}
      {kind === 'compost' && <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} />}
      {kind === 'bench' && <line x1={-w / 2} x2={w / 2} y1={-h / 2 - 3} y2={-h / 2 - 3} />}
      {kind === 'table' && (
        <>
          <circle r={2} cx={-w * 0.32} cy={-h * 0.32} />
          <circle r={2} cx={w * 0.32} cy={-h * 0.32} />
          <circle r={2} cx={w * 0.32} cy={h * 0.32} />
          <circle r={2} cx={-w * 0.32} cy={h * 0.32} />
        </>
      )}
    </g>
  )
}

function BuildingMark({ item, px }) {
  const spec = { ...buildingSpec(item.kind), ...item }
  const w = px(spec.w)
  const d = px(spec.d)
  const open = item.kind === 'carport'
  return (
    <g fill="none" stroke="#1c1917" strokeWidth={open ? 1 : 1.35}>
      <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={open ? '#f5f5f4' : '#f7f4ef'} />
      {!open && <rect x={-w / 2 + 3} y={-d / 2 + 3} width={Math.max(2, w - 6)} height={Math.max(2, d - 6)} />}
      <line x1={-w / 2} y1={0} x2={w / 2} y2={0} strokeDasharray={spec.roof === 'flat' ? '4 3' : undefined} />
      {open && (
        <>
          <circle r={2.4} cx={-w / 2 + 4} cy={-d / 2 + 4} fill="#1c1917" />
          <circle r={2.4} cx={w / 2 - 4} cy={-d / 2 + 4} fill="#1c1917" />
          <circle r={2.4} cx={w / 2 - 4} cy={d / 2 - 4} fill="#1c1917" />
          <circle r={2.4} cx={-w / 2 + 4} cy={d / 2 - 4} fill="#1c1917" />
        </>
      )}
      {!open && <path d={`M ${-w * 0.12} ${d / 2} v ${-Math.min(14, d * 0.28)} h ${w * 0.24} v ${Math.min(14, d * 0.28)}`} />}
      <text y={4} textAnchor="middle" fontSize={10} fill="#1c1917" stroke="none">{buildingSpec(item.kind).name}</text>
    </g>
  )
}

function selected(selectedHit, collection, id) {
  return selectedHit?.kind === 'yard' && selectedHit.collection === collection && selectedHit.id === id
}

export default function YardLayer({ plan, X, Y, px, sheet, selected: selectedHit, preview, showClearances = false, legendAt }) {
  const source = ensureYard(plan)
  const keep = (list) => (list || []).filter((item) => !item.hidden)
  const yard = {
    ...source,
    terraces: keep(source.terraces),
    paths: keep(source.paths),
    fences: keep(source.fences),
    plants: keep(source.plants),
    beds: keep(source.beds),
    objects: keep(source.objects),
    buildings: keep(source.buildings),
    covers: keep(source.covers),
    plot: source.plot?.hidden ? null : source.plot,
  }
  const metrics = plotMetrics(plan)
  const setbacks = setbackList(plan)
  const sw = 1.15
  return (
    <g data-testid="site-plan" style={{ pointerEvents: 'none' }}>
      {yard.beds.map((bed) => (
        <polygon
          key={bed.id}
          data-testid={`yard-bed-${bed.kind}`}
          points={pts(bed.points, X, Y)}
          fill={bed.kind === 'flowerbed' ? '#f6e7a8' : '#e5f0d4'}
          stroke={bed.kind === 'flowerbed' ? '#a16207' : '#4d7c0f'}
          strokeWidth={sw}
          strokeDasharray={bed.kind === 'lawn' ? '5 3' : undefined}
        />
      ))}
      {yard.beds.filter((bed) => bed.kind === 'flowerbed').map((bed) => {
        const center = centroid(bed.points)
        return (
          <g key={`${bed.id}-flowers`} transform={`translate(${X(center.x)} ${Y(center.z)})`} stroke="#9a3412" fill="none" strokeWidth={0.9}>
            <circle r={3.2} cx={-8} />
            <circle r={3.2} cx={8} />
            <circle r={3.2} cy={7} />
            <circle r={2.2} cy={-7} cx={1} />
          </g>
        )
      })}
      {yard.terraces.map((item) => {
        const material = TERRACE_MATERIALS.find((entry) => entry.id === item.material) || TERRACE_MATERIALS[0]
        const ring = inset(item.points, 0.9)
        const center = centroid(item.points)
        const level = formatTerraceLevels(item)
        const steps = terraceSteps(item, plan)
        const edge = steps.edge
        return (
          <g key={item.id} data-testid="yard-terrace" data-level={level}>
            <defs>
              <clipPath id={`terrace-${item.id}`}>
                <polygon points={pts(item.points, X, Y)} />
              </clipPath>
            </defs>
            <polygon points={pts(item.points, X, Y)} fill={material.color} stroke="#1c1917" strokeWidth={sw + (selected(selectedHit, 'terraces', item.id) ? 0.8 : 0)} />
            <g clipPath={`url(#terrace-${item.id})`} stroke="#6b4f36" strokeWidth={0.7} opacity={0.85}>
              {item.material === 'paving' || item.material === 'concrete'
                ? Array.from({ length: 8 }, (_, index) => (
                  <line key={index} x1={X(item.points[0].x)} x2={X(item.points[0].x) + 80} y1={Y(item.points[0].z) + index * 7} y2={Y(item.points[0].z) + index * 7} />
                ))
                : Array.from({ length: 10 }, (_, index) => (
                  <line key={index} x1={X(item.points[0].x) - 20} x2={X(item.points[2]?.x || item.points[0].x) + 20} y1={Y(item.points[0].z) + index * 6} y2={Y(item.points[0].z) + index * 6} />
                ))}
            </g>
            {terraceRailingEnabled(item) && <polygon points={pts(ring, X, Y)} fill="none" stroke="#1c1917" strokeWidth={0.9} />}
            {steps.enabled && edge && (
              <g data-testid="terrace-steps" stroke="#1c1917" strokeWidth={0.9}>
                {steps.treads.map((tread, index) => {
                  const hx = edge.ux * steps.width / 2
                  const hz = edge.uz * steps.width / 2
                  return <line key={index} x1={X(tread.x - hx)} y1={Y(tread.z - hz)} x2={X(tread.x + hx)} y2={Y(tread.z + hz)} />
                })}
              </g>
            )}
            <text data-testid="terrace-level" data-level={level} x={X(center.x)} y={Y(center.z)} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1c1917" stroke="#fbfaf7" strokeWidth={3} paintOrder="stroke">{level}</text>
          </g>
        )
      })}
      {yard.paths.map((item) => {
        const material = PATH_MATERIALS.find((entry) => entry.id === item.material) || PATH_MATERIALS[0]
        return (
          <polyline
            key={item.id}
            data-testid={`yard-path-${item.kind}`}
            points={pts(item.points, X, Y)}
            fill="none"
            stroke={material.color}
            strokeWidth={Math.max(3, px(item.width || 1))}
            strokeLinecap="square"
            strokeLinejoin="miter"
            opacity={0.95}
          />
        )
      })}
      {yard.paths.map((item) => (
        <polyline
          key={`${item.id}-edge`}
          points={pts(item.points, X, Y)}
          fill="none"
          stroke="#1c1917"
          strokeWidth={sw}
          strokeDasharray={item.material === 'gravel' || item.material === 'grass' ? '4 3' : undefined}
        />
      ))}
      {yard.plot && (
        <g data-testid="yard-plot">
          <polygon points={pts(yard.plot.points, X, Y)} fill="none" stroke="#1c1917" strokeWidth={1.6} />
          {separateSheetLabels(metrics.edges.map((edge) => ({
            key: `edge-${edge.index}`,
            text: formatMetres(edge.length),
            place: labelOffset(mid(edge.a, edge.b), centroid(yard.plot.points), -16, X, Y),
          }))).map((label) => (
            <text key={label.key} x={label.place.x} y={label.place.y} textAnchor="middle" fontSize={10} fontWeight={650} fill="#1c1917" stroke="#fbfaf7" strokeWidth={2.4} paintOrder="stroke">{label.text}</text>
          ))}
          {separateSheetLabels(setbacks.map((edge) => ({
            key: `set-${edge.index}`,
            text: edge.label,
            place: labelOffset(mid(edge.a, edge.b), centroid(yard.plot.points), 16, X, Y),
          }))).map((label) => (
            <text key={label.key} data-testid="yard-setback" x={label.place.x} y={label.place.y} textAnchor="middle" fontSize={8} fill="#57534e" stroke="#fbfaf7" strokeWidth={2} paintOrder="stroke">{label.text}</text>
          ))}
        </g>
      )}
      {yard.fences.map((fence) => {
        const kind = FENCE_KINDS.find((entry) => entry.id === fence.kind) || FENCE_KINDS[0]
        const stroke = fence.kind === 'hedge' ? '#3f6212' : fence.kind === 'stone' ? '#57534e' : '#1c1917'
        return (
          <g key={fence.id} data-testid={`yard-fence-${fence.kind}`} stroke={stroke} fill="none" strokeWidth={fence.kind === 'hedge' ? 3.2 : 1.25}>
            {fencePieces(fence).map((piece, index) => {
              if (piece.gate) {
                const [a, b] = piece.gate
                return (
                  <g key={index} data-testid="yard-gate">
                    <line x1={X(a.x)} y1={Y(a.z)} x2={X(b.x)} y2={Y(b.z)} strokeDasharray="2 2" />
                    <path d={`M ${X(a.x)} ${Y(a.z)} Q ${X((a.x + b.x) / 2 + piece.nx * 0.7)} ${Y((a.z + b.z) / 2 + piece.nz * 0.7)} ${X(b.x)} ${Y(b.z)}`} />
                  </g>
                )
              }
              const [a, b] = piece.line
              const len = Math.hypot(b.x - a.x, b.z - a.z)
              const ticks = []
              const step = fence.kind === 'stone' ? 1.1 : 0.8
              for (let t = step; t < len; t += step) {
                const x = a.x + ((b.x - a.x) * t) / len
                const z = a.z + ((b.z - a.z) * t) / len
                const nx = -(b.z - a.z) / len
                const nz = (b.x - a.x) / len
                ticks.push({ x, z, nx, nz })
              }
              return (
                <g key={index}>
                  <line x1={X(a.x)} y1={Y(a.z)} x2={X(b.x)} y2={Y(b.z)} />
                  {fence.kind === 'stone' && <line x1={X(a.x)} y1={Y(a.z)} x2={X(b.x)} y2={Y(b.z)} transform="translate(0 3)" />}
                  {ticks.map((tick, tickIndex) => (
                    <line
                      key={tickIndex}
                      x1={X(tick.x - tick.nx * 0.18)}
                      y1={Y(tick.z - tick.nz * 0.18)}
                      x2={X(tick.x + tick.nx * 0.18)}
                      y2={Y(tick.z + tick.nz * 0.18)}
                    />
                  ))}
                </g>
              )
            })}
            {selected(selectedHit, 'fences', fence.id) && (
              <text x={X(fence.points[0].x)} y={Y(fence.points[0].z) - 8} fontSize={9} fill={stroke} stroke="#fbfaf7" strokeWidth={2} paintOrder="stroke">{kind.name}</text>
            )}
          </g>
        )
      })}
      {yard.plants.map((item) => {
        const spec = plantSpec(item.kind)
        const r = Math.max(7, px((item.canopy || spec.canopy) / 2))
        return (
          <g key={item.id} data-testid={`yard-plant-${item.kind}`} transform={`translate(${X(item.x)} ${Y(item.z)})`}>
            <PlantMark kind={item.kind} r={r} />
            {selected(selectedHit, 'plants', item.id) && <circle r={r + 4} fill="none" stroke="#0f766e" strokeWidth={1.6} />}
            {selected(selectedHit, 'plants', item.id) && (
              <text y={r + 12} textAnchor="middle" fontSize={9} fill="#1c1917" stroke="#fbfaf7" strokeWidth={2} paintOrder="stroke">{spec.name}</text>
            )}
          </g>
        )
      })}
      {yard.objects.map((item) => {
        const spec = objectSpec(item.kind)
        const w = Math.max(10, px(item.w || spec.w))
        const h = Math.max(10, px(item.d || spec.d))
        return (
          <g key={item.id} data-testid={`yard-object-${item.kind}`} transform={`translate(${X(item.x)} ${Y(item.z)}) rotate(${item.rotation || 0})`}>
            <ObjectMark kind={item.kind} w={w} h={h} />
            {selected(selectedHit, 'objects', item.id) && <rect x={-w / 2 - 4} y={-h / 2 - 4} width={w + 8} height={h + 8} fill="none" stroke="#0f766e" strokeWidth={1.5} />}
          </g>
        )
      })}
      {yard.buildings.map((item) => (
        <g key={item.id} data-testid={`yard-building-${item.kind}`} transform={`translate(${X(item.x)} ${Y(item.z)}) rotate(${item.rotation || 0})`}>
          <BuildingMark item={item} px={px} />
          {selected(selectedHit, 'buildings', item.id) && (
            <rect
              x={-px(item.w) / 2 - 4}
              y={-px(item.d) / 2 - 4}
              width={px(item.w) + 8}
              height={px(item.d) + 8}
              fill="none"
              stroke="#0f766e"
              strokeWidth={1.6}
            />
          )}
        </g>
      ))}
      {yard.covers.map((item) => {
        const wall = (plan.walls || []).find((entry) => entry.id === item.wallId) || null
        const posts = coverPosts(item, wall)
        const mark = Math.max(4, px(item.postSize || 0.12))
        const active = selected(selectedHit, 'covers', item.id)
        return (
          <g key={item.id} data-testid={`yard-cover-${item.kind}`}>
            <polygon
              points={pts(item.points, X, Y)}
              fill={active ? 'rgba(15,118,110,0.08)' : 'none'}
              stroke={active ? '#0f766e' : '#1c1917'}
              strokeWidth={active ? sw + 0.7 : sw}
              strokeDasharray="8 4"
            />
            {posts.map((post, index) => (
              <rect
                key={index}
                x={X(post.x) - mark / 2}
                y={Y(post.z) - mark / 2}
                width={mark}
                height={mark}
                fill="#1c1917"
                stroke="none"
              />
            ))}
          </g>
        )
      })}
      {layerVisible(plan, 'ground') && yard.ground.wells.filter((item) => !item.hidden).map((item) => (
        <g key={item.id} data-testid="energy-well" data-depth={item.depth}>
          {(showClearances || selected(selectedHit, 'wells', item.id)) && CLEARANCE_RADII.map((radius) => (
            <circle
              key={radius}
              data-testid="clearance-circle"
              data-radius={radius}
              cx={X(item.x)}
              cy={Y(item.z)}
              r={px(radius)}
              fill="none"
              stroke={radius === 3 ? '#b45309' : radius === 7.5 ? '#0f766e' : '#1d4ed8'}
              strokeWidth={0.6}
              strokeDasharray="4 3"
              opacity={0.55}
            />
          ))}
          <circle cx={X(item.x)} cy={Y(item.z)} r={Math.max(7, px(0.45))} fill="#ccfbf1" stroke="#0f766e" strokeWidth={1.6} />
          <line x1={X(item.x) - 5} y1={Y(item.z)} x2={X(item.x) + 5} y2={Y(item.z)} stroke="#0f766e" strokeWidth={1.2} />
          <line x1={X(item.x)} y1={Y(item.z) - 5} x2={X(item.x)} y2={Y(item.z) + 5} stroke="#0f766e" strokeWidth={1.2} />
          <text x={X(item.x) + 10} y={Y(item.z) - 8} fontSize={9} fill="#0f766e">{`EK ${Math.round(item.depth || 0)} m`}</text>
        </g>
      ))}
      {layerVisible(plan, 'ground') && yard.ground.mode === 'loop' && yard.ground.loop && (
        <polygon data-testid="ground-loop" points={pts(yard.ground.loop.points, X, Y)} fill="rgba(15,118,110,0.12)" stroke="#0f766e" strokeWidth={sw} strokeDasharray="8 4" />
      )}
      {layerVisible(plan, 'ground') && yard.ground.water.map((item) => (
        <polygon key={item.id} data-testid="water-body" points={pts(item.points, X, Y)} fill="rgba(37,99,235,0.18)" stroke="#1d4ed8" strokeWidth={sw} />
      ))}
      {layerVisible(plan, 'ground') && yard.waste.areas.map((item) => {
        const center = centroid(item.points || [])
        const caption = item.kind === 'sandfilter' ? 'Maasuodatin' : item.kind === 'loop' ? 'Vaakaputkisto' : 'Imeytys'
        return (
          <g key={item.id} data-testid={item.kind === 'sandfilter' ? 'yard-waste-sandfilter' : 'yard-waste-field'}>
            <polygon points={pts(item.points, X, Y)} fill="rgba(146,64,14,0.16)" stroke="#9a3412" strokeWidth={sw} strokeDasharray="4 3" />
            <text x={X(center.x)} y={Y(center.z)} textAnchor="middle" fontSize={9} fill="#7c2d12" stroke="#fbfaf7" strokeWidth={2.4} paintOrder="stroke">{caption}</text>
          </g>
        )
      })}
      {layerVisible(plan, 'ground') && yard.waste.units.map((item) => {
        const caption = item.kind === 'holding' ? `${item.volume} m³` : item.kind === 'septic' ? 'Saostus' : item.kind === 'plant' ? 'Puhdistamo' : ''
        return (
          <g key={item.id} data-testid={`yard-waste-${item.kind}`} transform={`translate(${X(item.x)} ${Y(item.z)}) rotate(${item.rotation || 0})`}>
            <rect x={-px(item.w) / 2} y={-px(item.d) / 2} width={px(item.w)} height={px(item.d)} fill="#f5f5f4" stroke="#44403c" strokeWidth={1.3} />
            {item.kind === 'septic' && Array.from({ length: Math.max(2, Math.min(3, item.chambers || 3)) - 1 }, (_, index) => (
              <line key={index} x1={-px(item.w) / 2 + (px(item.w) * (index + 1)) / (item.chambers || 3)} y1={-px(item.d) / 2} x2={-px(item.w) / 2 + (px(item.w) * (index + 1)) / (item.chambers || 3)} y2={px(item.d) / 2} stroke="#44403c" strokeWidth={0.8} />
            ))}
            {caption && (
              <text x={px(item.w || 1) / 2 + 4} y={3} fontSize={8} fill="#44403c" stroke="#fbfaf7" strokeWidth={2} paintOrder="stroke">{caption}</text>
            )}
          </g>
        )
      })}
      {layerVisible(plan, 'ground') && (showClearances || ['wells', 'waste-units', 'waste-areas', 'waste-lines'].includes(selectedHit?.collection)) && groundWarnings(plan).length > 0 && (
        <g data-testid="ground-warnings">
          {groundWarnings(plan).slice(0, 4).map((warning, index) => (
            <text key={`${warning.code}-${index}`} x={sheet.x + 16} y={sheet.y + sheet.h - 28 - index * 9 * 1.3} fontSize={9} fill={warning.level === 'fail' ? '#b91c1c' : '#b45309'}>{warning.text}</text>
          ))}
        </g>
      )}
      {preview?.points?.length > 0 && (
        <polyline
          points={pts([...preview.points, ...(preview.cursor ? [preview.cursor] : [])], X, Y)}
          fill="none"
          stroke="#0f766e"
          strokeWidth={1.4}
          strokeDasharray="6 4"
        />
      )}
      <g data-testid="yard-legend" transform={`translate(${legendAt?.x ?? sheet.x + 12} ${legendAt?.y ?? sheet.y + 12})`}>
        {(() => {
          const plantY = 26
          const bedY = plantY + PLANTS.length * 16 + 4
          const areaY = bedY + BEDS.length * 14 + 2
          const height = yardLegendHeight()
          return (
            <>
              <rect width={legendAt?.w ?? 158} height={height} fill="#fff" stroke="#1c1917" strokeWidth={0.8} />
              <text x={8} y={14} fontSize={10} fontWeight={750} fill="#1c1917">Kasvillisuus</text>
              {PLANTS.map((item, index) => (
                <g key={item.id} transform={`translate(16 ${plantY + index * 16})`}>
                  <PlantMark kind={item.id} r={5.5} />
                  <text x={14} y={3} fontSize={8} fill="#1c1917">{item.name}</text>
                </g>
              ))}
              {BEDS.map((item, index) => (
                <text key={item.id} x={8} y={bedY + index * 14} fontSize={8} fill="#1c1917">{item.name}</text>
              ))}
              <text data-testid="yard-area" x={8} y={areaY + 10} fontSize={8} fill="#44403c">{formatSquare(metrics.area)}</text>
            </>
          )
        })()}
      </g>
    </g>
  )
}

export function yardToolLabel(tool) {
  if (!tool) return ''
  if (tool === 'plot') return 'Tontti: napsauta kulmat, sulje ensimmäiseen pisteeseen tai paina Enter.'
  if (tool === 'terrace') return 'Terassi: piirrä monikulmio. Korkeus lattiaan nähden, oletus −50 mm.'
  if (tool === 'path' || tool === 'drive' || tool === 'parking') {
    const name = PATH_KINDS.find((item) => item.id === tool)?.name || 'Reitti'
    return `${name}: napsauta pisteet, päätä Enterillä.`
  }
  if (tool === 'fence') return 'Aita: napsauta pisteet, päätä Enterillä. Portin lisäät ominaisuuksista.'
  if (tool === 'lawn' || tool === 'flowerbed') return `${BEDS.find((item) => item.id === tool)?.name}: piirrä alue.`
  if (tool.startsWith('plant:')) return `${plantSpec(tool.slice(6)).name}: napsauta paikka.`
  if (tool.startsWith('object:')) return `${objectSpec(tool.slice(7)).name}: napsauta paikka.`
  if (tool.startsWith('building:')) return `${buildingSpec(tool.slice(9)).name}: napsauta paikka.`
  if (tool.startsWith('cover:')) {
    const name = COVER_TYPES.find((item) => item.id === tool.slice(6))?.name || 'Katos'
    return `${name}: piirrä suorakulmio tai monikulmio. Se voi tarttua seinään.`
  }
  if (tool.startsWith('ground:')) {
    const spec = GROUND_TOOLS.find((item) => item.id === tool.slice(7))
    if (!spec) return 'Maanalaiset'
    if (spec.mode === 'point') return `${spec.name}: napsauta paikka.`
    if (spec.mode === 'line') return `${spec.name}: napsauta pisteet, päätä Enterillä.`
    return `${spec.name}: piirrä alue.`
  }
  return 'Piha'
}

export const YARD_DRAW_TOOLS = [
  ['plot', 'Tontti'],
  ['terrace', 'Terassi'],
  ['path', 'Kävely'],
  ['drive', 'Ajotie'],
  ['parking', 'Pysäköinti'],
  ['fence', 'Aita'],
  ['lawn', 'Nurmikko'],
  ['flowerbed', 'Kukkapenkki'],
]
