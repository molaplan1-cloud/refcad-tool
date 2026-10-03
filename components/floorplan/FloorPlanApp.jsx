'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  FIXTURES,
  MATERIALS,
  ROOF_TYPES,
  addFixture,
  addOpening,
  addWall,
  claddingAreas,
  cornerAngles,
  cornerJoint,
  deleteOpening,
  facadeSide,
  deleteRoom,
  deleteWall,
  detectRoomAt,
  detectRooms,
  dimensionRotation,
  faceSide,
  resolveFaceMaterial,
  drawRoom,
  emptyPlan,
  exampleHouse,
  familyHouse,
  formatArea,
  formatMm,
  formatQuantity,
  hitTest,
  materialOf,
  materialsList,
  moveFixture,
  moveOpening,
  moveRoomLabel,
  openingSymbol,
  openingTags,
  planBounds,
  planDimensions,
  structureMarks,
  pointInPolygon,
  duplicateFixture,
  furnishAll,
  furnishRoom,
  removeFixture,
  rotateFixture,
  segmentLength,
  viewLayout,
  wallDirection,
  visibleRooms,
  wallQuads,
  thicknessOf,
  claddingOf,
} from '@/lib/floorplan'
import { wallFigures } from '@/lib/wall-outline'
import { layerFaces, resolveWallStructure, structureCatalog } from '@/lib/structures'
import { FixtureSymbol } from './FixtureSymbol'
import { FURNITURE_GROUPS, layoutFor, resolveFixture, scheduleRows, suggestionsFor } from '@/lib/furniture'
import { fixtureServiceKey, syncFixtureServices } from '@/lib/fixtureServices'
import { bindFlues, drawingOf, flueWarnings } from '@/lib/chimney'
import {
  FLOOR_CLIPBOARD_KEY,
  changeLayer,
  deleteSelection,
  expandGroups,
  floorClipboard,
  groupSelection,
  hideSelection,
  isolateSelection,
  matchProperties,
  measureReadout,
  mergeSelection,
  pasteFloorClipboard,
  patchShared,
  runCommand,
  selectionBounds,
  selectionBox,
  setCadFlag,
  showAll,
  similarTargets,
  targetsByType,
  targetsInBox,
  ungroupSelection,
} from '@/lib/cadEdit'
import { CadPrompt, CadToolbar } from './CadTools'
import { buildPlanPdf } from '@/lib/roominfo'
import { applyDisplay, layoutRoomLabels, normalizeDisplay } from '@/lib/display'
import { DisplayPanel } from './DisplayPanel'
import { FloorMenu, HouseSettings, SelectionPanel, selectionLabel } from './FloorMenus'
import { LibraryDialog, ShellDialog, StartDialog } from './ProjectDialogs'
import FacadeView from './FacadeView'
import { ServiceBar, ServiceDrawing, ServiceMenu } from './ServicesLayer'
import { ElectricPanel } from './ElectricPanel'
import { HeatingPanel } from './HeatingPanel'
import YardLayer, { YARD_DRAW_TOOLS, yardToolLabel } from './YardLayer'
import {
  BUILDINGS,
  OBJECTS,
  PLANTS,
  addBed,
  addBuilding,
  addFence,
  addObject,
  addPath,
  addPlant,
  addTerrace,
  applyExampleYard,
  buildSitePdf,
  deleteYardItem,
  ensureYard,
  formatSquare,
  hitTestYard,
  moveYardItem,
  plotMetrics,
  rotateYardItem,
  setPlot,
  siteViewLayout,
  snapYardPoint,
  syncYardServices,
  updateYardItem,
} from '@/lib/yard'
import {
  PLACEABLES,
  addServiceNode,
  addServiceRun,
  deleteServiceNode,
  deleteServiceRun,
  autoRouteAll,
  applyHeating,
  assignDeviceCircuit,
  commitRunGeometry,
  dragServiceRun,
  refreshHeat,
  buildElectricPdf,
  buildHydronicPdf,
  buildServicePdf,
  rewireElectric,
  rewireWater,
  SERVICE_SYSTEMS,
  ensureServices,
  hitService,
  layerVisible,
  roomKind,
  setServiceLayer,
  snapServicePoint,
  updateServiceNode,
} from '@/lib/services'
import {
  CURRENT_KEY,
  LIBRARY_KEY,
  deleteProject,
  exportPlanJson,
  importPlanJson,
  loadLibrary,
  projectById,
  renameProject,
  saveProject,
  shellPlan,
} from '@/lib/projects'
import { snapAlongWall, snapFixturePoint, snapPoint } from '@/lib/snap'
import { FIT_CAMERA, panBy, wheelZoomFactor, zoomAt, zoomPercent } from '@/lib/zoom'

const HouseScene = dynamic(() => import('./HouseScene'), { ssr: false })

const textBtn = (active) => ({
  height: 32,
  padding: '0 10px',
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 8,
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

const sideBtn = (active) => ({
  width: '100%',
  textAlign: 'left',
  padding: '7px 8px',
  borderRadius: 8,
  border: active ? '1px solid #0f766e' : '1px solid transparent',
  background: active ? '#f0fdfa' : 'transparent',
  color: '#1c1917',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transform: 'none',
})

function DrawFields({ draft, end, onLength, onAngle, onCommit }) {
  const lengthMm = Math.max(0, Math.round(segmentLength(draft, end) * 1000))
  const angle = wallDirection({ a: draft, b: end })
  const [len, setLen] = useState(String(lengthMm))
  const [ang, setAng] = useState(String(angle))
  const lenFocus = useRef(false)
  const angFocus = useRef(false)
  useEffect(() => { if (!lenFocus.current) setLen(String(lengthMm)) }, [lengthMm])
  useEffect(() => { if (!angFocus.current) setAng(String(angle)) }, [angle])
  const field = { width: 72, marginLeft: 4, padding: '2px 6px', borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12 }
  const commitOnEnter = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onCommit()
    }
  }
  return (
    <span data-testid="wall-draw-input" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <label>Pituus
        <input data-testid="draw-length" inputMode="decimal" value={len} style={field} onChange={(event) => { setLen(event.target.value); onLength(Number(event.target.value)) }} onFocus={(event) => { lenFocus.current = true; event.target.select() }} onBlur={() => { lenFocus.current = false }} onKeyDown={commitOnEnter} />
        {' '}mm
      </label>
      <label>Kulma
        <input data-testid="draw-angle" inputMode="decimal" value={ang} style={field} onChange={(event) => { setAng(event.target.value); onAngle(Number(event.target.value)) }} onFocus={(event) => { angFocus.current = true; event.target.select() }} onBlur={() => { angFocus.current = false }} onKeyDown={commitOnEnter} />
        °
      </label>
    </span>
  )
}

function AngleMarks({ marks, X, Y, zoom }) {
  const scale = 1 / (zoom || 1)
  return (marks || []).filter((mark) => Math.abs(mark.degrees - 90) > 1).map((mark) => {
    const cx = X(mark.x)
    const cy = Y(mark.z)
    const r = 28 * scale
    const a0 = mark.start
    const a1 = mark.start + mark.sweep
    const p0 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r }
    const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r }
    const mid = a0 + mark.sweep / 2
    const lx = cx + Math.cos(mid) * (r + 14 * scale)
    const ly = cy + Math.sin(mid) * (r + 14 * scale)
    return (
      <g key={`${mark.x}-${mark.z}-${mark.degrees}`} data-testid="angle-arc" data-degrees={mark.degrees} style={{ pointerEvents: 'none' }}>
        <path d={`M ${p0.x} ${p0.y} A ${r} ${r} 0 ${mark.sweep > Math.PI ? 1 : 0} 1 ${p1.x} ${p1.y}`} fill="none" stroke="#0f766e" strokeWidth={1.3 * scale} />
        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={12 * scale} fontWeight={700} fill="#0f766e">{mark.degrees}°</text>
      </g>
    )
  })
}

function SnapMark({ snap, X, Y, zoom }) {
  if (!snap?.point || !snap.kind || snap.kind === 'grid') return null
  const s = 1 / (zoom || 1)
  return (
    <g data-testid="snap-indicator" data-kind={snap.kind} style={{ pointerEvents: 'none' }}>
      {(snap.guides || []).map((guide, index) => (
        <line
          key={`${guide.x1}-${guide.z1}-${index}`}
          x1={X(guide.x1)}
          y1={Y(guide.z1)}
          x2={X(guide.x2)}
          y2={Y(guide.z2)}
          stroke="#0f766e"
          strokeWidth={1.15 * s}
          strokeDasharray={`${6 * s} ${4 * s}`}
        />
      ))}
      <g transform={`translate(${X(snap.point.x)} ${Y(snap.point.z)}) scale(${s})`}>
        {snap.kind === 'corner' && <rect data-testid="snap-corner" x={-6} y={-6} width={12} height={12} fill="#f0fdfa" stroke="#0f766e" strokeWidth={2} />}
        {snap.kind === 'midpoint' && <polygon data-testid="snap-midpoint" points="0,-8 7,6 -7,6" fill="#f0fdfa" stroke="#0f766e" strokeWidth={1.7} />}
        {snap.kind === 'perpendicular' && <path data-testid="snap-perpendicular" d="M-8 0 V-8 H0" fill="none" stroke="#0f766e" strokeWidth={2} />}
        {snap.kind !== 'corner' && snap.kind !== 'midpoint' && snap.kind !== 'perpendicular' && (
          <circle r={6} fill="none" stroke="#0f766e" strokeWidth={2} />
        )}
      </g>
    </g>
  )
}

function sheetPixels(size, plan, site = false) {
  const layout = site ? siteViewLayout(plan) : viewLayout(plan)
  const pad = 14
  const availW = Math.max(280, size.w - pad * 2)
  const availH = Math.max(200, size.h - pad * 2)
  const aspect = layout.pageW / layout.pageH
  let w = availW
  let h = w / aspect
  if (h > availH) {
    h = availH
    w = h * aspect
  }
  return {
    x: (size.w - w) / 2,
    y: (size.h - h) / 2,
    w,
    h,
    k: w / layout.pageW,
    layout,
  }
}

function SheetRoomLabel({ label, X, Y, nameSize, areaSize }) {
  const cx = X(label.x)
  const cy = Y(label.z)
  const name = label.text || ''
  const area = label.area || ''
  const block = (name ? nameSize : 0) + (area ? areaSize + 1 : 0)
  const nameY = cy - block / 2 + nameSize * 0.35
  const areaY = name ? nameY + nameSize + 1 : cy + areaSize * 0.15
  return (
    <>
      {label.leader && (
        <line data-testid="room-leader" x1={X(label.leader.x)} y1={Y(label.leader.z)} x2={cx} y2={cy} stroke="#78716c" strokeWidth={0.7} />
      )}
      {name && (
        <text x={cx} y={nameY} textAnchor="middle" fontSize={nameSize} fontWeight={700} fill="#1c1917">{name}</text>
      )}
      {area && (
        <text x={cx} y={areaY} textAnchor="middle" fontSize={areaSize} fill="#57534e">{area}</text>
      )}
    </>
  )
}

function DimLine({ dim, X, Y, fontSize, ppm }) {
  const off = Number.isFinite(dim.offset) ? dim.offset : 0
  const x1 = X(dim.x1 + (dim.nx || 0) * off)
  const y1 = Y(dim.z1 + (dim.nz || 0) * off)
  const x2 = X(dim.x2 + (dim.nx || 0) * off)
  const y2 = Y(dim.z2 + (dim.nz || 0) * off)
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const tick = Math.max(3.2, fontSize * 0.42)
  const tx = Math.cos(ang + Math.PI / 4) * tick
  const ty = Math.sin(ang + Math.PI / 4) * tick
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
  const textW = Math.max(fontSize * 1.6, String(dim.label).length * fontSize * 0.58)
  const textSide = dim.textSide || 0
  const textT = Number.isFinite(dim.textT) ? dim.textT : 0.5
  const gap = !textSide && len > textW + fontSize ? textW : 0
  const alongX = x1 + (x2 - x1) * textT
  const alongY = y1 + (y2 - y1) * textT
  const side = textSide * 0.16 * ppm
  const labelX = alongX - uy * side
  const labelY = alongY + ux * side
  const ax1 = X(dim.ax ?? dim.x1)
  const ay1 = Y(dim.az ?? dim.z1)
  const ax2 = X(dim.bx ?? dim.x2)
  const ay2 = Y(dim.bz ?? dim.z2)
  const gapLine = (sx, sy, ex, ey) => {
    const dx = ex - sx
    const dy = ey - sy
    const span = Math.hypot(dx, dy) || 1
    const inset = Math.min(fontSize * 0.7, span * 0.35)
    return { x1: sx + (dx / span) * inset, y1: sy + (dy / span) * inset, x2: ex, y2: ey }
  }
  const ext1 = gapLine(ax1, ay1, x1, y1)
  const ext2 = gapLine(ax2, ay2, x2, y2)
  const breakAt = gap ? textT : 0.5
  const bx = x1 + (x2 - x1) * breakAt
  const by = y1 + (y2 - y1) * breakAt
  return (
    <g data-testid={`dim-${dim.kind || 'dim'}`} data-label={dim.label} stroke="#44403c" fill="#292524" strokeWidth={0.6}>
      {Math.hypot(ax1 - x1, ay1 - y1) > 6 && <line x1={ext1.x1} y1={ext1.y1} x2={ext1.x2} y2={ext1.y2} stroke="#a8a29e" strokeWidth={0.4} />}
      {Math.hypot(ax2 - x2, ay2 - y2) > 6 && <line x1={ext2.x1} y1={ext2.y1} x2={ext2.x2} y2={ext2.y2} stroke="#a8a29e" strokeWidth={0.4} />}
      <line x1={x1} y1={y1} x2={bx - ux * gap / 2} y2={by - uy * gap / 2} />
      <line x1={bx + ux * gap / 2} y1={by + uy * gap / 2} x2={x2} y2={y2} />
      <line x1={x1 - tx} y1={y1 - ty} x2={x1 + tx} y2={y1 + ty} />
      <line x1={x2 - tx} y1={y2 - ty} x2={x2 + tx} y2={y2 + ty} />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fill="#292524"
        transform={vertical ? `rotate(${dimensionRotation(true)} ${labelX} ${labelY})` : undefined}
      >
        {dim.label}
      </text>
    </g>
  )
}

function worldPath(points, X, Y) {
  if (!points?.length) return ''
  return `${points.map((point, index) => `${index ? 'L' : 'M'}${X(point.x)} ${Y(point.z)}`).join(' ')} Z`
}

function FaceLines({ plan, X, Y, selected, onSelect }) {
  return (
    <g data-testid="face-lines">
      {visibleRooms(plan).map((room) => (room.walls || []).map((edge, index) => {
        const wall = (plan.walls || []).find((item) => item.id === edge.wallId)
        const side = wall ? faceSide(wall, edge.a, edge.b) : 'left'
        const material = wall ? resolveFaceMaterial(plan, wall, side) : (room.interiorId || 'paint')
        const color = materialOf('interior', material).color
        const a = room.polygon?.[index]
        const b = room.polygon?.[(index + 1) % (room.polygon?.length || 1)]
        if (!a || !b) return null
        const active = selected?.id === room.id && selected?.wallId === edge.wallId
        const dashed = material === 'gypsum' || material === 'tile' || material === 'wallpaper' || material === 'concrete-paint'
        return (
          <line
            key={`${room.id}-${index}`}
            data-testid={`face-line-${room.id}-${index}`}
            x1={X(a.x)}
            y1={Y(a.z)}
            x2={X(b.x)}
            y2={Y(b.z)}
            stroke={active ? '#0f766e' : color}
            strokeWidth={active ? 5 : 3}
            strokeDasharray={dashed ? '5 3' : undefined}
            strokeLinecap="butt"
            onPointerDown={(event) => {
              event.stopPropagation()
              event.preventDefault()
              onSelect({ kind: 'room', id: room.id, wallId: edge.wallId, side })
            }}
          />
        )
      }))}
    </g>
  )
}

function HatchDefs() {
  const pattern = (id, w, h, node) => (
    <pattern id={id} width={w} height={h} patternUnits="userSpaceOnUse">{node}</pattern>
  )
  return (
    <>
      {pattern('hatch-insulation', 10, 8, <>
        <rect width="10" height="8" fill="#fde68a" />
        <polyline points="0,6 2.5,2 5,6 7.5,2 10,6" fill="none" stroke="#d97706" strokeWidth="0.8" />
      </>)}
      {pattern('hatch-brick', 12, 8, <>
        <rect width="12" height="8" fill="#c2410c" />
        <path d="M0 0 H12 M0 4 H12 M0 8 H12 M0 0 V4 M6 4 V8" fill="none" stroke="#7c2d12" strokeWidth="0.45" />
      </>)}
      {pattern('hatch-concrete', 8, 8, <>
        <rect width="8" height="8" fill="#d6d3d1" />
        <circle cx="2" cy="2" r="0.6" fill="#78716c" />
        <circle cx="6" cy="5" r="0.6" fill="#57534e" />
      </>)}
      {pattern('hatch-wood', 8, 8, <>
        <rect width="8" height="8" fill="#e7d3b0" />
        <path d="M0 2 Q4 1 8 2 M0 6 Q4 5 8 6" fill="none" stroke="#a16207" strokeWidth="0.55" />
      </>)}
      {pattern('hatch-gypsum', 8, 8, <rect width="8" height="8" fill="#fafaf9" />)}
      {pattern('hatch-membrane', 8, 8, <rect width="8" height="8" fill="#bfdbfe" />)}
      {pattern('hatch-vent', 8, 8, <>
        <rect width="8" height="8" fill="#ffffff" />
        <path d="M0 4 H8" stroke="#a8a29e" strokeWidth="0.4" strokeDasharray="1.2 1" />
      </>)}
      {pattern('hatch-render', 8, 8, <rect width="8" height="8" fill="#e7e5e4" />)}
      {pattern('hatch-board', 8, 8, <rect width="8" height="8" fill="#e5e7eb" />)}
      {pattern('hatch-block', 10, 8, <>
        <rect width="10" height="8" fill="#d4d4d8" />
        <path d="M0 0 H10 M0 8 H10 M0 0 V8 M5 0 V8" fill="none" stroke="#71717a" strokeWidth="0.4" />
      </>)}
      {pattern('hatch-gravel', 8, 8, <>
        <rect width="8" height="8" fill="#d6d3d1" />
        <circle cx="2" cy="3" r="0.9" fill="#78716c" />
        <circle cx="5" cy="6" r="0.7" fill="#57534e" />
        <circle cx="7" cy="2" r="0.6" fill="#a8a29e" />
      </>)}
    </>
  )
}

function WallOutlines({ plan, X, Y, selectedIds = [] }) {
  const walls = (plan.walls || []).filter((wall) => !wall.hidden)
  const openings = (plan.openings || []).filter((opening) => !opening.hidden && walls.some((wall) => wall.id === opening.wallId))
  const figures = useMemo(
    () => wallFigures(walls, openings, (wall) => thicknessOf(wall, plan)),
    // Hidden walls drop out of the drawing; rooms still use the full plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan],
  )
  const paint = (loops, fill) => loops.map((loop, index) => (
    <path key={`${loop.role}-${index}`} d={worldPath(loop.points, X, Y)} fill={fill} stroke="none" />
  ))
  const pointsOf = (pts) => pts.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')
  return (
    <g data-testid="wall-outlines">
      {paint(figures.exterior, 'url(#poche)')}
      {paint(figures.interior, '#e7e5e4')}
      {paint(figures.insulation, 'rgba(214,211,209,0.9)')}
      {paint(figures.cladding, claddingOf(plan.exteriorId).color)}
      {walls.map((wall) => {
        const spec = resolveWallStructure(plan, wall)
        if (!spec) return null
        const faces = layerFaces(wall, walls, spec.layers)
        const quads = wallQuads(wall, openings, walls, plan)
        if (!faces.length || !quads.length) return null
        const clipId = `hatch-clip-${wall.id}`
        return (
          <g key={`hatch-${wall.id}`} style={{ pointerEvents: 'none' }}>
            <clipPath id={clipId}>
              {quads.map((quad, index) => <polygon key={index} points={pointsOf(quad)} />)}
            </clipPath>
            <g clipPath={`url(#${clipId})`}>
              {faces.map((face, index) => (
                <polygon
                  key={index}
                  data-testid="structure-hatch"
                  data-hatch={face.hatch}
                  data-wall={wall.id}
                  points={pointsOf(face.points)}
                  fill={`url(#hatch-${face.hatch || 'gypsum'})`}
                  stroke="#a8a29e"
                  strokeWidth={0.25}
                />
              ))}
            </g>
          </g>
        )
      })}
      {figures.core.map((loop, index) => (
        <path
          key={`edge-${index}`}
          data-testid="wall-quad"
          d={worldPath(loop.points, X, Y)}
          fill="none"
          stroke="#1c1917"
          strokeWidth={1.05}
          strokeLinejoin="miter"
          strokeLinecap="square"
        />
      ))}
      {walls.filter((wall) => selectedIds.includes(wall.id)).flatMap((wall) => wallQuads(wall, openings, walls, plan).map((quad, index) => (
        <polygon key={`sel-${wall.id}-${index}`} points={quad.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')} fill="rgba(15,118,110,0.18)" stroke="#0f766e" strokeWidth={2.6} />
      )))}
      {walls.map((wall) => (
        <line
          key={`axis-${wall.id}`}
          data-testid="wall-axis"
          data-wall={wall.id}
          data-kind={wall.kind}
          data-thickness={thicknessOf(wall, plan)}
          data-structure={wall.structureId || ''}
          x1={X(wall.a.x)}
          y1={Y(wall.a.z)}
          x2={X(wall.b.x)}
          y2={Y(wall.b.z)}
          stroke="transparent"
          strokeWidth={10}
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </g>
  )
}

export default function FloorPlanApp() {
  const [plan, setPlan] = useState(() => emptyPlan())
  const [hydrated, setHydrated] = useState(false)
  const [ready, setReady] = useState(false)
  const [startOpen, setStartOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [library, setLibrary] = useState(() => ({ projects: [] }))
  const [hover, setHover] = useState(null)
  const [tool, setTool] = useState('select')
  const [placing, setPlacing] = useState(null)
  const [fixtureQuery, setFixtureQuery] = useState('')
  const [draft, setDraft] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedFixture, setSelectedFixture] = useState(null)
  const [pick, setPick] = useState(null)
  const [picks, setPicks] = useState([])
  const [command, setCommand] = useState(null)
  const [marquee, setMarquee] = useState(null)
  const [panel, setPanel] = useState('materials')
  const [menu, setMenu] = useState(null)
  const [roomShape, setRoomShape] = useState('rect')
  const [poly, setPoly] = useState([])
  const [partitions, setPartitions] = useState(true)
  const [view, setView] = useState('2d')
  const [facadeSideId, setFacadeSideId] = useState('north')
  const [svcSystem, setSvcSystem] = useState('iv')
  const [svcKind, setSvcKind] = useState('valve-tulo')
  const [svcTool, setSvcTool] = useState(null)
  const [svcPoints, setSvcPoints] = useState([])
  const [floorHeating, setFloorHeating] = useState(false)
  const [electricView, setElectricView] = useState(null)
  const [heatView, setHeatView] = useState(null)
  const [sheetMode, setSheetMode] = useState('plan')
  const [displayOpen, setDisplayOpen] = useState(false)
  const [yardTool, setYardTool] = useState(null)
  const [yardPoints, setYardPoints] = useState([])
  const [wallMode, setWallMode] = useState('solid')
  const [roofMode, setRoofMode] = useState('solid')
  const [fitToken, setFitToken] = useState(1)
  const [size, setSize] = useState({ w: 960, h: 680 })
  const [camera, setCamera] = useState(FIT_CAMERA)
  const [gridStep, setGridStep] = useState(0.1)
  const [angleStep, setAngleStep] = useState(90)
  const [drawGuide, setDrawGuide] = useState(null)
  const angleMemory = useRef(90)
  const [altDown, setAltDown] = useState(false)
  const [snapVisual, setSnapVisual] = useState(null)
  const [cursorPpm, setCursorPpm] = useState(40)
  const history = useRef([])
  const redo = useRef([])
  const originPlan = useRef(null)
  const commandRef = useRef(null)
  commandRef.current = command
  const pending = useRef(null)
  const dragBefore = useRef(null)
  const routeDrag = useRef(null)
  const dragNode = useRef(null)
  const [redrawId, setRedrawId] = useState(null)
  const dragId = useRef(null)
  const dragOpen = useRef(null)
  const dragYard = useRef(null)
  const dragLabel = useRef(null)
  const clip = useRef(null)
  const hostRef = useRef(null)
  const svgRef = useRef(null)
  const panRef = useRef(null)
  const dragGrab = useRef(null)
  const spaceRef = useRef(false)
  const suppressMenu = useRef(false)
  const altRef = useRef(false)
  altRef.current = altDown

  useEffect(() => {
    const storedLibrary = loadLibrary(window.localStorage.getItem(LIBRARY_KEY))
    setLibrary(storedLibrary)
    try {
      const raw = window.localStorage.getItem(CURRENT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.walls)) {
          setPlan({
            ...emptyPlan(),
            ...parsed,
            services: ensureServices(parsed),
            yard: ensureYard(parsed),
            rooms: detectRooms(parsed.walls, parsed.rooms || []),
          })
          setSelectedRoom(parsed.rooms?.[0]?.id || null)
          setReady(true)
          setHydrated(true)
          setFitToken((token) => token + 1)
          return
        }
      }
    } catch (err) {
      console.error(err)
    }
    setStartOpen(true)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem(CURRENT_KEY, JSON.stringify(plan))
  }, [plan, ready])

  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
  }, [library, ready])

  useEffect(() => {
    const node = hostRef.current
    if (!node) return undefined
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      const w = Math.max(320, rect.width)
      const h = Math.max(240, rect.height)
      setSize((prev) => (Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w, h }))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [view])

  const commit = useCallback((next) => {
    setPlan((current) => {
      history.current = [...history.current, current].slice(-40)
      redo.current = []
      const bound = bindFlues(next)
      return fixtureServiceKey(current) === fixtureServiceKey(bound) ? bound : syncFixtureServices(bound)
    })
  }, [])

  const undo = useCallback(() => {
    const prev = history.current.pop()
    if (!prev) return
    setPlan((current) => {
      redo.current = [...redo.current, current].slice(-40)
      return prev
    })
  }, [])

  const redoChange = useCallback(() => {
    const next = redo.current.pop()
    if (!next) return
    setPlan((current) => {
      history.current = [...history.current, current].slice(-40)
      return next
    })
  }, [])

  const sheet = useMemo(() => sheetPixels(size, plan, sheetMode === 'site'), [size, plan, sheetMode])
  const { layout, k } = sheet
  const X = useCallback((x) => sheet.x + (layout.ox + (x - layout.box.minX) * layout.scale) * k, [sheet, layout, k])
  const Y = useCallback((z) => sheet.y + (layout.oy + (z - layout.box.minZ) * layout.scale) * k, [sheet, layout, k])

  const toWorld = useCallback((event) => {
    const rect = svgRef.current.getBoundingClientRect()
    const zoom = camera.zoom || 1
    const px = (event.clientX - rect.left - camera.x) / zoom
    const py = (event.clientY - rect.top - camera.y) / zoom
    const mx = (px - sheet.x) / sheet.k
    const my = (py - sheet.y) / sheet.k
    return {
      x: (mx - layout.ox) / layout.scale + layout.box.minX,
      z: (my - layout.oy) / layout.scale + layout.box.minZ,
    }
  }, [sheet, layout, camera])

  const ppm2d = layout.scale * k * (camera.zoom || 1)

  const describeSnap = useCallback((world, ppm) => {
    const radius = 12 / Math.max(ppm || ppm2d, 0.001)
    const enabled = !altRef.current
    const walls = plan.walls || []
    if (svcTool) return null
    if (tool === 'exterior' || tool === 'interior') {
      return snapPoint(world, { walls, grid: gridStep, radius, origin: draft, ortho: angleStep === 90, angleStep, enabled })
    }
    if (tool === 'room') {
      const origin = roomShape === 'poly' ? poly[poly.length - 1] : draft
      return snapPoint(world, { walls, grid: gridStep, radius, origin: origin || null, ortho: angleStep === 90, angleStep, enabled })
    }
    if (tool === 'door' || tool === 'window') {
      const along = snapAlongWall(world, walls, Math.max(radius, 0.35), enabled)
      return along.wall ? { point: along.point, kind: 'edge', guides: [], wall: along.wall } : { point: world, kind: null, guides: [] }
    }
    if (placing) {
      const tpl = FIXTURES.find((item) => item.id === placing)
      const placed = snapFixturePoint(world, walls, { radius: Math.max(radius, 0.45), enabled, grid: gridStep, depth: tpl?.d || 0.6 })
      return { point: { x: placed.x, z: placed.z }, kind: placed.kind, guides: [], rotation: placed.rotation }
    }
    if (yardTool) {
      const origin = yardPoints[yardPoints.length - 1] || null
      return snapYardPoint(world, plan, { grid: gridStep, radius, origin, ortho: angleStep === 90 && Boolean(origin) })
    }
    return null
  }, [ppm2d, plan, tool, draft, angleStep, gridStep, roomShape, poly, placing, svcTool, yardTool, yardPoints])

  useEffect(() => {
    if (view !== '2d') return undefined
    const node = hostRef.current
    if (!node) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const factor = wheelZoomFactor(event.deltaY, event.ctrlKey || event.metaKey)
      setCamera((current) => zoomAt(current, px, py, factor))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [view])

  const remember = (items) => {
    const list = items || []
    setPicks(list)
    const last = list[list.length - 1]
    if (!last) {
      setPick(null)
      setSelectedRoom(null)
      setSelectedFixture(null)
      return
    }
    const panelPick = last.kind === 'node' || last.kind === 'run'
      ? { kind: 'service', id: last.id, service: last.service || { target: last.kind, id: last.id } }
      : last
    setPick(panelPick)
    setSelectedRoom(last.kind === 'room' ? last.id : null)
    setSelectedFixture(last.kind === 'fixture' ? last.id : null)
    if (last.kind === 'fixture') {
      const fixture = (plan.fixtures || []).find((item) => item.id === last.id)
      if (fixture) clip.current = { ...fixture }
    }
    setPanel('object')
  }

  const selectHits = (hits, mods) => {
    const base = mods?.shift || mods?.ctrl ? picks : []
    remember(expandGroups(plan, mergeSelection(base, hits, mods || {})))
  }

  const choose = (hit, mods) => {
    if (!hit || hit.kind === 'canvas') {
      if (!mods?.shift && !mods?.ctrl) remember([])
      return
    }
    if (hit.kind === 'house') {
      remember([])
      setPick({ kind: 'house', id: 'house' })
      setSelectedRoom(null)
      setSelectedFixture(null)
      setPanel('house')
      return
    }
    const item = hit.kind === 'service'
      ? { kind: hit.service?.target === 'run' ? 'run' : 'node', id: hit.service?.id, service: hit.service }
      : { kind: hit.kind, id: hit.id || hit.kind, collection: hit.collection }
    selectHits([item], mods)
  }

  const snappedPoint = (world) => describeSnap(world, ppm2d)?.point || world

  const beginCommand = (name, extra) => {
    const selected = picks
    if (name === 'delete') {
      commit(deleteSelection(plan, selected))
      remember([])
      setMenu(null)
      return
    }
    if (name === 'group') { commit(groupSelection(plan, selected)); setMenu(null); return }
    if (name === 'ungroup') { commit(ungroupSelection(plan, selected)); setMenu(null); return }
    if (name === 'lock') { commit(setCadFlag(plan, selected, 'cadLock', true)); setMenu(null); return }
    if (name === 'unlock') { commit(setCadFlag(plan, selected, 'cadLock', false)); setMenu(null); return }
    if (name === 'hide') { commit(hideSelection(plan, selected)); remember([]); setMenu(null); return }
    if (name === 'isolate') { commit(isolateSelection(plan, selected)); setMenu(null); return }
    if (name === 'show') { commit(showAll(plan)); setMenu(null); return }
    if (name === 'similar') { remember(similarTargets(plan, selected)); setMenu(null); return }
    if (name === 'layer') { commit(changeLayer(plan, selected, extra)); setMenu(null); return }
    if (name === 'rotate90') {
      const box = selectionBounds(plan, selected)
      const center = { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 }
      commit(runCommand(plan, selected, { name: 'rotate', base: center, value: '90' }, center))
      setMenu(null)
      return
    }
    if (!selected.length && name !== 'stretch' && name !== 'measure' && name !== 'match') return
    originPlan.current = plan
    setCommand({
      name,
      step: name === 'stretch' ? 'window' : name === 'match' ? 'source' : 'base',
      copies: 1,
      count: 3,
      cols: 3,
      rows: 2,
      arrayMode: 'linear',
      edge: 'left',
      value: '',
    })
    setTool('select')
    setPlacing(null)
    setMenu(null)
  }

  const cancelCommand = () => {
    commandRef.current = null
    if (originPlan.current) setPlan(originPlan.current)
    originPlan.current = null
    setCommand(null)
    setMarquee(null)
    pending.current = null
  }

  const confirmCommand = (point) => {
    const active = commandRef.current || command
    commandRef.current = null
    if (!active || !originPlan.current) return
    if (active.name === 'measure') {
      originPlan.current = null
      setCommand(null)
      return
    }
    const next = runCommand(originPlan.current, picks, active, point)
    history.current = [...history.current, originPlan.current].slice(-40)
    redo.current = []
    originPlan.current = null
    setPlan(next)
    setCommand(null)
  }

  const copyClipboard = () => {
    if (!picks.length) return
    window.localStorage.setItem(FLOOR_CLIPBOARD_KEY, JSON.stringify(floorClipboard(plan, picks)))
  }

  const pasteClipboard = (at) => {
    let payload = null
    try { payload = JSON.parse(window.localStorage.getItem(FLOOR_CLIPBOARD_KEY) || 'null') } catch (err) { payload = null }
    if (!payload) return
    const point = at || { x: (payload.origin?.x || 0) + 0.4, z: (payload.origin?.z || 0) + 0.4 }
    commit(pasteFloorClipboard(plan, payload, point))
  }

  const openHitMenu = (hit, event, spot) => {
    if (spot) {
      const joint = cornerJoint(plan.walls, spot, Math.max(0.32, 18 / Math.max(spot.ppm || ppm2d, 0.001)))
      if (joint) {
        setMenu({ x: event.clientX, y: event.clientY, kind: 'corner', id: 'corner', at: { x: joint.x, z: joint.z } })
        return
      }
    }
    const point = hit || { kind: 'house', id: 'house' }
    if (point.kind === 'service') {
      setMenu({ x: event.clientX, y: event.clientY, kind: 'service', service: point.service })
    } else {
      setMenu({
        x: event.clientX,
        y: event.clientY,
        kind: point.kind,
        id: point.id || point.kind,
        collection: point.collection,
        at: point.at,
      })
    }
    if (point.kind !== 'canvas') choose(point)
  }

  const onPointerMove = (event) => {
    if (view !== '2d' || !svgRef.current) return
    if (panRef.current) {
      const dx = event.clientX - panRef.current.x
      const dy = event.clientY - panRef.current.y
      panRef.current.x = event.clientX
      panRef.current.y = event.clientY
      if (Math.hypot(dx, dy) > 0) panRef.current.moved = true
      setCamera((current) => panBy(current, dx, dy))
      return
    }
    const world = toWorld(event)
    const typingDraw = document.activeElement?.getAttribute('data-testid') === 'draw-length' || document.activeElement?.getAttribute('data-testid') === 'draw-angle'
    const visual = describeSnap(world, ppm2d)
    setSnapVisual(visual)
    setCursor(world)
    if (pending.current && Math.hypot(world.x - pending.current.x, world.z - pending.current.z) > 0.08) {
      pending.current.moved = true
      const box = selectionBox({ x: pending.current.x, z: pending.current.z }, world)
      pending.current.box = pending.current.stretch ? { ...box, mode: 'crossing' } : box
      setMarquee(pending.current.box)
    }
    const active = commandRef.current
    if (active?.step === 'to' && originPlan.current && active.name !== 'measure') {
      setPlan(runCommand(originPlan.current, picks, active, snappedPoint(world)))
    } else if (active?.name === 'measure' && active.step === 'to') {
      setCommand((current) => (current ? { ...current, readout: measureReadout(current, world) } : current))
    }
    if (!typingDraw) setDrawGuide(null)
    const radius = Math.max(12 / Math.max(ppm2d, 0.001), 0.45)
    if (dragId.current) setPlan((current) => moveFixture(current, dragId.current, world.x, world.z, radius))
    if (dragYard.current) setPlan((current) => moveYardItem(current, dragYard.current.collection, dragYard.current.id, world.x, world.z))
    if (dragOpen.current) setPlan((current) => moveOpening(current, dragOpen.current, world))
    if (dragLabel.current) setPlan((current) => moveRoomLabel(current, dragLabel.current, world.x, world.z))
    if (routeDrag.current && Math.hypot(world.x - routeDrag.current.origin.x, world.z - routeDrag.current.origin.z) > 0.02) {
      routeDrag.current.moved = true
      const drag = routeDrag.current.mode === 'run' || event.shiftKey ? { ...routeDrag.current, mode: 'run' } : routeDrag.current
      setPlan((current) => dragServiceRun(current, drag, world, { ortho: angleStep === 90 && !event.shiftKey, grid: gridStep, free: altRef.current }))
    }
    if (dragNode.current && Math.hypot(world.x - dragNode.current.origin.x, world.z - dragNode.current.origin.z) > 0.02) {
      dragNode.current.moved = true
      const snapped = altRef.current ? world : snapServicePoint(world, plan, { grid: gridStep, mode: 'free' })
      setPlan((current) => updateServiceNode(current, dragNode.current.id, { x: snapped.x, z: snapped.z }))
    }
  }

  const onPointerUp = () => {
    if (pending.current?.stretch && pending.current.box) {
      const box = pending.current.box
      const hits = targetsInBox(plan, box)
      remember(hits)
      setCommand((current) => (current ? { ...current, step: 'base', box } : current))
      pending.current = null
      setMarquee(null)
    } else if (pending.current?.moved && pending.current.box) {
      selectHits(targetsInBox(plan, pending.current.box), { shift: pending.current.shift, ctrl: pending.current.ctrl })
      pending.current = null
      setMarquee(null)
    } else if (pending.current) {
      choose(pending.current.hit, { shift: pending.current.shift, ctrl: pending.current.ctrl })
      pending.current = null
      setMarquee(null)
    }
    if (panRef.current?.button === 2 && panRef.current.moved) suppressMenu.current = true
    panRef.current = null
    const movedYard = dragYard.current
    const movedRoute = routeDrag.current?.moved
    const movedNode = dragNode.current?.moved
    const draggedFixture = Boolean(dragId.current)
    if ((dragId.current || dragLabel.current || dragOpen.current || movedYard || movedRoute || movedNode) && dragBefore.current) history.current = [...history.current, dragBefore.current].slice(-40)
    dragId.current = null
    dragOpen.current = null
    dragLabel.current = null
    dragYard.current = null
    routeDrag.current = null
    dragNode.current = null
    dragBefore.current = null
    if (movedYard?.collection === 'objects') setPlan((current) => syncYardServices(current))
    if (draggedFixture) {
      setPlan((current) => {
        const bound = bindFlues(current)
        return fixtureServiceKey(current) === fixtureServiceKey(bound) ? bound : syncFixtureServices(bound)
      })
    }
  }

  const closeRoom = (points) => {
    if (!points || points.length < 3) return
    const next = refreshHeat(drawRoom(plan, points, { partitions, name: 'Huone', type: 'huone' }))
    commit(next)
    const mid = points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 })
    mid.x /= points.length
    mid.z /= points.length
    const created = (next.rooms || []).find((item) => pointInPolygon(mid.x, mid.z, item.polygon || []))
    if (created) choose({ kind: 'room', id: created.id })
    setDraft(null)
    setPoly([])
  }

  const openServiceMenu = (event, service) => {
    setMenu({ x: event.clientX, y: event.clientY, kind: 'service', service })
    choose({ kind: 'service', service })
  }

  const finishServiceRun = () => {
    if (svcPoints.length < 2) return
    if (redrawId) {
      commit(commitRunGeometry(plan, redrawId, svcPoints))
      setRedrawId(null)
      setSvcPoints([])
      setSvcTool(null)
      return
    }
    const spec = PLACEABLES.find((item) => item.id === svcKind) || PLACEABLES.find((item) => item.mode === 'run')
    commit(addServiceRun(plan, {
      system: spec.system,
      kind: spec.kind,
      size: spec.size,
      slope: spec.slope,
      circuit: spec.circuit,
      points: svcPoints,
    }))
    setSvcPoints([])
  }

  const beginRouteDrag = (id, mode, index, world) => {
    const run = ensureServices(plan).runs.find((item) => item.id === id)
    if (!run) return
    choose({ kind: 'service', service: { target: 'run', id, system: run.system, segmentIndex: index } })
    routeDrag.current = {
      id,
      mode,
      index,
      origin: { x: world.x, z: world.z },
      basePoints: (run.points || []).map((point) => ({ ...point })),
      moved: false,
    }
    dragBefore.current = plan
  }

  const beginRedraw = (run) => {
    if (!run) return
    setRedrawId(run.id)
    setSvcTool('run')
    setSvcSystem(run.system)
    setSvcKind(run.kind)
    setSvcPoints([])
    setMenu(null)
    choose({ kind: 'service', service: { target: 'run', id: run.id, system: run.system } })
  }

  const onContextMenu = (event) => {
    if (suppressMenu.current) {
      event.preventDefault()
      suppressMenu.current = false
      return
    }
    event.preventDefault()
    const world = toWorld(event)
    const joint = cornerJoint(plan.walls, world, Math.max(0.32, 18 / Math.max(ppm2d, 0.001)))
    if (joint) {
      setMenu({ x: event.clientX, y: event.clientY, kind: 'corner', id: 'corner', at: { x: joint.x, z: joint.z } })
      return
    }
    const serviceHit = hitService(plan, world)
    if (serviceHit) {
      openServiceMenu(event, serviceHit)
      return
    }
    const hit = hitTest(plan, world)
    const yardHit = sheetMode === 'site' ? hitTestYard(plan, world, Math.max(0.28, 12 / Math.max(ppm2d, 0.001))) : null
    if (hit.kind !== 'opening' && hit.kind !== 'wall' && yardHit && (yardHit.collection !== 'plot' || hit.kind === 'canvas')) {
      setMenu({ x: event.clientX, y: event.clientY, kind: 'yard', id: yardHit.id, collection: yardHit.collection, at: world })
      choose(yardHit)
      return
    }
    setMenu({ x: event.clientX, y: event.clientY, kind: hit.kind, id: hit.id, at: world })
    if (hit.kind !== 'canvas') choose(hit)
  }

  const finishYard = (points) => {
    if (!yardTool) return
    let next = plan
    if (yardTool === 'plot') next = setPlot(plan, points)
    else if (yardTool === 'terrace') next = addTerrace(plan, points, { railing: true, steps: true })
    else if (yardTool === 'lawn' || yardTool === 'flowerbed') next = addBed(plan, points, yardTool)
    else if (yardTool === 'path' || yardTool === 'drive' || yardTool === 'parking') next = addPath(plan, points, { kind: yardTool })
    else if (yardTool === 'fence') next = addFence(plan, points, {})
    else return
    commit(next)
    setYardPoints([])
  }

  const placeAt = (world, ppm) => {
    const visual = describeSnap(world, ppm)
    const point = visual?.point || world
    if (yardTool) {
      if (yardTool.startsWith('plant:')) {
        commit(addPlant(plan, yardTool.slice(6), point.x, point.z))
        return
      }
      if (yardTool.startsWith('object:')) {
        commit(addObject(plan, yardTool.slice(7), point.x, point.z))
        return
      }
      if (yardTool.startsWith('building:')) {
        commit(addBuilding(plan, yardTool.slice(9), point.x, point.z))
        return
      }
      const closed = yardTool === 'plot' || yardTool === 'terrace' || yardTool === 'lawn' || yardTool === 'flowerbed'
      if (closed && yardPoints.length >= 3 && segmentLength(point, yardPoints[0]) < Math.max(0.45, 16 / Math.max(ppm, 0.001))) {
        finishYard(yardPoints)
        return
      }
      setYardPoints((points) => {
        const prev = points[points.length - 1]
        if (prev && segmentLength(prev, point) < 0.05) return points
        return [...points, point]
      })
      return
    }
    if (svcTool) {
      const spec = PLACEABLES.find((item) => item.id === svcKind) || PLACEABLES[0]
      const snapped = snapServicePoint(world, plan, { mode: spec.wall ? 'wall' : 'free', system: spec.system })
      if (svcTool === 'node') {
        commit(addServiceNode(plan, {
          system: spec.system,
          kind: spec.kind,
          role: spec.role,
          flow: spec.flow,
          size: spec.size,
          circuit: spec.circuit,
          name: spec.name,
          pointType: spec.pointType,
          x: snapped.x,
          z: snapped.z,
        }))
        return
      }
      setSvcPoints((points) => {
        const prev = points[points.length - 1]
        if (prev && Math.hypot(prev.x - snapped.x, prev.z - snapped.z) < 0.05) return points
        return [...points, { x: snapped.x, z: snapped.z }]
      })
      return
    }
    if (tool === 'room') {
      if (roomShape === 'poly') {
        if (poly.length >= 3 && segmentLength(point, poly[0]) < 0.35) closeRoom(poly)
        else setPoly((points) => [...points, point])
      } else if (!draft) setDraft(point)
      else {
        closeRoom([
          draft,
          { x: point.x, z: draft.z },
          point,
          { x: draft.x, z: point.z },
        ])
      }
      return
    }
    if (tool === 'detect') {
      const roomHit = (plan.rooms || []).find((item) => pointInPolygon(world.x, world.z, item.polygon || []))
      if (roomHit) {
        commit(refreshHeat(detectRoomAt(plan, world)))
        choose({ kind: 'room', id: roomHit.id })
      }
      return
    }
    if (tool === 'exterior' || tool === 'interior') {
      const next = drawGuide || point
      if (!draft) setDraft(next)
      else {
        commit(refreshHeat(addWall(plan, draft, next, tool)))
        setDraft(null)
        setDrawGuide(null)
      }
      return
    }
    if (tool === 'door' || tool === 'window') {
      const along = visual?.wall ? visual : snapAlongWall(world, plan.walls, Math.max(12 / Math.max(ppm, 0.001), 0.35), !altRef.current)
      if (along?.wall) commit(refreshHeat(addOpening(plan, along.wall.id, along.point || point, tool)))
      return
    }
    if (placing) {
      const radius = Math.max(12 / Math.max(ppm, 0.001), 0.45)
      const next = addFixture(plan, placing, point.x, point.z, radius)
      commit(next)
      const created = next.fixtures[next.fixtures.length - 1]
      setSelectedFixture(created?.id || null)
      setPick(created ? { kind: 'fixture', id: created.id } : null)
      setPlacing(null)
    }
  }

  const beginPan = (event) => {
    panRef.current = { x: event.clientX, y: event.clientY, moved: false, button: event.button }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerDown = (event) => {
    if (view !== '2d') return
    if (event.button === 1 || (event.button === 0 && spaceRef.current)) {
      beginPan(event)
      return
    }
    if (event.button === 2) {
      const world = toWorld(event)
      const hit = hitTest(plan, world)
      const serviceHit = hitService(plan, world)
      if ((!hit || hit.kind === 'canvas') && !serviceHit) beginPan(event)
      return
    }
    if (event.button !== 0) return
    setMenu(null)
    const world = toWorld(event)
    if (command && !svcTool && !yardTool && !placing && (tool === 'select' || tool === 'detect')) {
      const point = snappedPoint(world)
      if (command.name === 'stretch' && command.step === 'window') {
        pending.current = { x: point.x, z: point.z, stretch: true, moved: false }
        return
      }
      if (command.name === 'match' && command.step === 'source') {
        const serviceHit = hitService(plan, world)
        const hit = serviceHit
          ? { kind: 'service', service: serviceHit }
          : (sheetMode === 'site' ? hitTestYard(plan, world) : null) || hitTest(plan, world)
        if (hit && hit.kind !== 'canvas') {
          const source = hit.kind === 'service'
            ? { kind: hit.service?.target === 'run' ? 'run' : 'node', id: hit.service?.id, service: hit.service }
            : { kind: hit.kind, id: hit.id, collection: hit.collection }
          commit(matchProperties(originPlan.current || plan, source, picks))
          originPlan.current = null
          setCommand(null)
        }
        return
      }
      if (command.step === 'base') {
        originPlan.current = originPlan.current || plan
        const next = { ...command, step: 'to', base: point }
        commandRef.current = next
        setCommand(next)
        return
      }
      if (command.step === 'to') confirmCommand(point)
      return
    }
    if (svcTool || yardTool || tool === 'room' || tool === 'detect' || tool === 'exterior' || tool === 'interior' || tool === 'door' || tool === 'window' || placing) {
      placeAt(world, ppm2d)
      return
    }
    const serviceHit = hitService(plan, world)
    if (serviceHit?.target === 'node') {
      choose({ kind: 'service', service: serviceHit })
      dragNode.current = { id: serviceHit.id, origin: { x: world.x, z: world.z }, moved: false }
      dragBefore.current = plan
      return
    }
    if (serviceHit?.target === 'run') {
      const mode = event.shiftKey ? 'run' : serviceHit.vertexIndex != null ? 'vertex' : 'segment'
      const index = serviceHit.vertexIndex != null ? serviceHit.vertexIndex : (serviceHit.segmentIndex || 0)
      beginRouteDrag(serviceHit.id, mode, index, world)
      return
    }
    const yardHit = sheetMode === 'site' ? hitTestYard(plan, world, Math.max(0.28, 12 / Math.max(ppm2d, 0.001))) : null
    const hit = hitTest(plan, world)
    if (yardHit && hit.kind !== 'opening' && hit.kind !== 'wall' && (yardHit.collection !== 'plot' || hit.kind === 'canvas')) {
      choose(yardHit)
      if (yardHit.movable) {
        dragYard.current = yardHit
        dragBefore.current = plan
      }
      return
    }
    if (hit.kind === 'opening') {
      dragOpen.current = hit.id
      dragBefore.current = plan
      choose(hit, { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey })
      return
    }
    pending.current = {
      x: world.x,
      z: world.z,
      hit,
      shift: event.shiftKey,
      ctrl: event.ctrlKey || event.metaKey,
      moved: false,
    }
  }

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (event.key === 'Shift' && !event.repeat) {
        setAngleStep((value) => {
          if (value === 0) return angleMemory.current || 90
          angleMemory.current = value
          return 0
        })
        return
      }
      if (event.key === ' ' && !event.repeat) {
        event.preventDefault()
        spaceRef.current = true
        return
      }
      if (view === '2d' && (event.key === '+' || event.key === '=')) {
        event.preventDefault()
        const rect = hostRef.current?.getBoundingClientRect()
        setCamera((current) => zoomAt(current, (rect?.width || 0) / 2, (rect?.height || 0) / 2, 1.25))
        return
      }
      if (view === '2d' && (event.key === '-' || event.key === '_')) {
        event.preventDefault()
        const rect = hostRef.current?.getBoundingClientRect()
        setCamera((current) => zoomAt(current, (rect?.width || 0) / 2, (rect?.height || 0) / 2, 0.8))
        return
      }
      if (view === '2d' && event.key === '0') {
        setCamera(FIT_CAMERA)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        remember(targetsByType(plan, 'all'))
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copyClipboard()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
        event.preventDefault()
        copyClipboard()
        commit(deleteSelection(plan, picks))
        remember([])
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        pasteClipboard(cursor)
        return
      }
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        event.preventDefault()
        redoChange()
        return
      }
      if (event.key === 'Escape') {
        if (command) cancelCommand()
        setDraft(null)
        setPoly([])
        setPlacing(null)
        setMenu(null)
        setSvcPoints([])
        setSvcTool(null)
        setRedrawId(null)
        setYardPoints([])
        setYardTool(null)
        setElectricView(null)
        setHeatView(null)
        if (!command) remember([])
      } else if (event.key === 'Enter' && command?.step === 'to') {
        confirmCommand(snappedPoint(cursor || command.base || { x: 0, z: 0 }))
      } else if (event.key === 'Enter' && svcTool === 'run' && svcPoints.length >= 2) {
        finishServiceRun()
      } else if (event.key === 'Enter' && tool === 'room' && poly.length >= 3) {
        closeRoom(poly)
      } else if (event.key === 'Enter' && yardTool && yardPoints.length >= ((yardTool === 'path' || yardTool === 'drive' || yardTool === 'parking' || yardTool === 'fence') ? 2 : 3)) {
        finishYard(yardPoints)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && picks.length) {
        commit(deleteSelection(plan, picks))
        remember([])
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && pick?.kind === 'yard') {
        commit(deleteYardItem(plan, pick.collection, pick.id))
        choose(null)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && pick?.kind === 'wall') {
        commit(refreshHeat(deleteWall(plan, pick.id)))
        choose(null)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && pick?.kind === 'opening') {
        commit(refreshHeat(deleteOpening(plan, pick.id)))
        choose(null)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && pick?.kind === 'room') {
        commit(deleteRoom(plan, pick.id))
        choose(null)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedFixture) {
        commit(removeFixture(plan, selectedFixture))
        setSelectedFixture(null)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && pick?.kind === 'service' && pick.service) {
        const next = pick.service.target === 'node'
          ? deleteServiceNode(plan, pick.service.id)
          : deleteServiceRun(plan, pick.service.id)
        commit(next)
        choose(null)
      } else if ((event.key === 'd' || event.key === 'D') && (event.metaKey || event.ctrlKey) && selectedFixture) {
        event.preventDefault()
        commit(duplicateFixture(plan, selectedFixture))
      } else if ((event.key === 'r' || event.key === 'R') && pick?.kind === 'yard' && (pick.collection === 'objects' || pick.collection === 'buildings')) {
        commit(rotateYardItem(plan, pick.collection, pick.id))
      } else if ((event.key === 'r' || event.key === 'R') && selectedFixture) {
        commit(rotateFixture(plan, selectedFixture))
      } else if (event.altKey && !event.ctrlKey && !event.metaKey && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault()
        const preset = event.key === '1' ? 'plain' : event.key === '2' ? 'measure' : 'all'
        const sheet = sheetMode === 'site' ? 'site' : 'plan'
        setPlan((current) => applyDisplay(current, { preset }, sheet))
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'v' && !command && tool === 'select') {
        event.preventDefault()
        setDisplayOpen((open) => !open)
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !command && tool === 'select') {
        const key = event.key.toLowerCase()
        const shortcut = { m: 'move', c: 'copy', e: 'rotate', s: 'scale', f: 'mirror', b: 'array', o: 'offset', t: 'stretch', n: 'align', d: 'measure' }[key]
        if (shortcut) beginCommand(shortcut)
      } else if ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        undo()
      }
    }
    const onKeyUp = (event) => {
      if (event.key === ' ') spaceRef.current = false
      if (event.key === 'Alt') setAltDown(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Alt') {
        event.preventDefault()
        setAltDown(true)
      }
      onKey(event)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [commit, plan, selectedFixture, undo, redoChange, tool, poly, pick, picks, command, cursor, partitions, svcTool, svcPoints, svcKind, view, yardTool, yardPoints, sheetMode])

  const loadHouse = (house, roomName, panel) => {
    const next = { ...house, services: ensureServices(house) }
    commit(next)
    setDraft(null)
    setPoly([])
    const room = (next.rooms || []).find((item) => item.name === roomName) || next.rooms?.[0]
    setSelectedRoom(room?.id || null)
    setPick(room ? { kind: 'room', id: room.id } : null)
    setSelectedFixture(null)
    setMenu(null)
    setView('2d')
    setSheetMode('plan')
    setYardTool(null)
    setYardPoints([])
    setPanel(panel || (room ? 'object' : 'house'))
    setReady(true)
    setStartOpen(false)
    setNewOpen(false)
    setLibraryOpen(false)
    setCamera(FIT_CAMERA)
    setFitToken((token) => token + 1)
  }

  const createShell = (options) => loadHouse(shellPlan(options), null, 'house')

  const storeCurrent = () => setLibrary((current) => saveProject(current, plan))

  const openStored = (id) => {
    const entry = projectById(library, id)
    if (entry) loadHouse(entry.plan, entry.plan.rooms?.[0]?.name)
  }

  const renameStored = (id, name) => {
    setLibrary((current) => renameProject(current, id, name))
    if (plan.projectId === id) setPlan((current) => ({ ...current, name }))
  }

  const exportJson = () => {
    const blob = new Blob([exportPlanJson(plan)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(plan.name || 'pohja').replace(/\s+/g, '-')}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importJson = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        loadHouse(importPlanJson(String(reader.result || '')), null, 'house')
      } catch (err) {
        window.alert(err?.message || 'Tuonti epäonnistui')
      }
    }
    reader.readAsText(file)
  }

  const onPreview3d = (spot) => {
    const world = { x: spot.x, z: spot.z }
    const visual = describeSnap(world, spot.ppm)
    setSnapVisual(visual)
    setCursor(world)
    setCursorPpm(spot.ppm || 40)
  }

  const onPlace3d = (spot) => {
    setMenu(null)
    placeAt({ x: spot.x, z: spot.z }, spot.ppm)
  }

  const onFixtureDrag3d = (id, spot, phase) => {
    const fixture = (plan.fixtures || []).find((item) => item.id === id)
    if (!dragGrab.current && fixture) {
      dragBefore.current = plan
      dragGrab.current = { id, ox: fixture.x - spot.x, oz: fixture.z - spot.z }
    }
    const grab = dragGrab.current?.id === id ? dragGrab.current : { ox: 0, oz: 0 }
    const radius = Math.max(12 / Math.max(spot.ppm, 0.001), 0.45)
    setPlan((current) => moveFixture(current, id, spot.x + grab.ox, spot.z + grab.oz, radius))
    setSelectedFixture(id)
    setPick({ kind: 'fixture', id })
    if (phase === 'end') {
      if (dragBefore.current) history.current = [...history.current, dragBefore.current].slice(-40)
      dragBefore.current = null
      dragGrab.current = null
      setPlan((current) => {
        const bound = bindFlues(current)
        return fixtureServiceKey(current) === fixtureServiceKey(bound) ? bound : syncFixtureServices(bound)
      })
    }
  }

  const onOpeningDrag3d = (id, spot, phase) => {
    if (!dragBefore.current) dragBefore.current = plan
    setPlan((current) => moveOpening(current, id, { x: spot.x, z: spot.z }))
    setPick({ kind: 'opening', id })
    if (phase === 'end') {
      history.current = [...history.current, dragBefore.current].slice(-40)
      dragBefore.current = null
    }
  }

  const onServiceDrag3d = (service, spot, phase) => {
    if (!service) return
    if (service.target === 'node') {
      if (phase === 'start') {
        if (!dragBefore.current) dragBefore.current = plan
        return
      }
      const snapped = snapServicePoint(spot, plan, { grid: gridStep, mode: 'free' })
      setPlan((current) => updateServiceNode(current, service.id, { x: snapped.x, z: snapped.z }))
      choose({ kind: 'service', service: { target: 'node', id: service.id, system: service.system } })
      if (phase === 'end') {
        if (dragBefore.current) history.current = [...history.current, dragBefore.current].slice(-40)
        dragBefore.current = null
      }
      return
    }
    if (phase === 'start') {
      const run = ensureServices(plan).runs.find((item) => item.id === service.id)
      if (!run) return
      if (!dragBefore.current) dragBefore.current = plan
      routeDrag.current = {
        id: service.id,
        mode: service.target === 'vertex' ? 'vertex' : service.target === 'segment' ? 'segment' : 'run',
        index: service.index || 0,
        origin: { x: spot.x, z: spot.z },
        basePoints: (run.points || []).map((point) => ({ ...point })),
      }
      return
    }
    if (!routeDrag.current || routeDrag.current.id !== service.id) {
      const run = ensureServices(plan).runs.find((item) => item.id === service.id)
      if (!run) return
      if (!dragBefore.current) dragBefore.current = plan
      routeDrag.current = {
        id: service.id,
        mode: service.target === 'vertex' ? 'vertex' : service.target === 'segment' ? 'segment' : 'run',
        index: service.index || 0,
        origin: { x: spot.x, z: spot.z },
        basePoints: (run.points || []).map((point) => ({ ...point })),
      }
    }
    const drag = routeDrag.current
    setPlan((current) => dragServiceRun(current, drag, spot, { ortho: angleStep === 90, grid: gridStep }))
    choose({ kind: 'service', service: { target: 'run', id: service.id, system: service.system, segmentIndex: service.index || 0 } })
    if (phase === 'end') {
      if (dragBefore.current) history.current = [...history.current, dragBefore.current].slice(-40)
      dragBefore.current = null
      routeDrag.current = null
    }
  }

  const onYardDrag3d = (hit, spot, phase) => {
    if (!dragBefore.current) dragBefore.current = plan
    setPlan((current) => moveYardItem(current, hit.collection, hit.id, spot.x, spot.z))
    setPick(hit)
    if (phase === 'end') {
      history.current = [...history.current, dragBefore.current].slice(-40)
      dragBefore.current = null
      if (hit.collection === 'objects') setPlan((current) => syncYardServices(current))
    }
  }

  const onDropFixture3d = (type, spot) => {
    const radius = Math.max(12 / Math.max(spot.ppm, 0.001), 0.45)
    const next = addFixture(plan, type, spot.x, spot.z, radius)
    commit(next)
    const created = next.fixtures[next.fixtures.length - 1]
    if (created) {
      setSelectedFixture(created.id)
      setPick({ kind: 'fixture', id: created.id })
    }
    setPlacing(null)
  }

  const onHover3d = (hit) => {
    setHover((current) => {
      if (!hit) return null
      const next = hit.kind === 'service'
        ? { kind: 'service', id: hit.service?.id, service: hit.service }
        : { kind: hit.kind, id: hit.id }
      if (current?.kind === next.kind && current?.id === next.id && current?.service?.id === next.service?.id && current?.service?.target === next.service?.target) return current
      return next
    })
  }

  const loadExample = () => loadHouse(syncYardServices(applyExampleYard(exampleHouse())), 'Olohuone')

  const loadFamily = () => loadHouse(familyHouse(), 'Eteinen')

  const onMenuNavigate = (action) => {
    if (action === 'close') {
      setMenu(null)
      return
    }
    if (typeof action === 'string' && action.startsWith('cad:')) {
      beginCommand(action.slice(4))
      return
    }
    if (action === 'house' || action === 'focus' || action === 'properties') {
      setPanel(action === 'house' ? 'house' : 'object')
      setMenu(null)
      if (action === 'properties') {
        requestAnimationFrame(() => document.querySelector('[data-testid="selection-title"]')?.scrollIntoView({ block: 'nearest' }))
      }
      return
    }
    if (action === 'wall') {
      setTool('exterior')
      setPlacing(null)
      setMenu(null)
      return
    }
    if (action === 'room') {
      setTool('room')
      setRoomShape('rect')
      setPlacing(null)
      setMenu(null)
      return
    }
    if (action === 'facade') {
      const wall = (plan.walls || []).find((item) => item.id === menu?.id)
      if (wall) setFacadeSideId(facadeSide(wall, planBounds(plan)))
      setView('facade')
      setMenu(null)
    }
    if (action === 'paste' && clip.current && menu?.at) {
      const next = addFixture(plan, clip.current.type, menu.at.x, menu.at.z)
      const fixture = next.fixtures[next.fixtures.length - 1]
      if (fixture && clip.current.w) {
        commit({
          ...next,
          fixtures: next.fixtures.map((item) => (item.id === fixture.id ? { ...item, ...clip.current, id: item.id, x: item.x, z: item.z } : item)),
        })
      } else commit(next)
      setMenu(null)
    }
  }

  const exportPdf = () => {
    buildPlanPdf(plan).save(`${(plan.name || 'pohjakuva').replace(/\s+/g, '-')}.pdf`)
  }

  const exportPng = () => {
    const svg = svgRef.current
    if (!svg) return
    const clone = svg.cloneNode(true)
    clone.setAttribute('width', String(svg.clientWidth))
    clone.setAttribute('height', String(svg.clientHeight))
    const xml = new XMLSerializer().serializeToString(clone)
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = svg.clientWidth * 2
      canvas.height = svg.clientHeight * 2
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#d6d3d1'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = 'pohjakuva.png'
      link.click()
      URL.revokeObjectURL(url)
    }
    image.src = url
  }

  const room = (plan.rooms || []).find((item) => item.id === selectedRoom) || null
  const sheetKey = sheetMode === 'site' ? 'site' : 'plan'
  const display = normalizeDisplay(plan.sheetDisplay?.[sheetKey] || plan.display)
  const setDisplay = (patch) => setPlan((current) => applyDisplay(current, patch, sheetKey))
  const rows = materialsList(plan)
  const query = fixtureQuery.trim().toLowerCase()
  const matchesQuery = (item) => !query || item.name.toLowerCase().includes(query) || item.group.toLowerCase().includes(query)
  const roomKindId = room ? roomKind(room) : ''
  const suggested = suggestionsFor(roomKindId).filter(matchesQuery)
  const groups = FURNITURE_GROUPS.map((id) => ({
    id,
    items: FIXTURES.filter((item) => item.group === id && matchesQuery(item)),
  })).filter((group) => group.items.length)
  const schedule = scheduleRows(plan.fixtures, (fixture) => {
    const host = visibleRooms(plan).find((item) => pointInPolygon(fixture.x, fixture.z, item.polygon || item.gross || []))
    return host?.name || ''
  })
  const chimneyNotes = flueWarnings(plan)
  const totalArea = visibleRooms(plan).reduce((sum, item) => sum + item.area, 0)
  const dimLines = planDimensions(plan, display)
  const roomLabels = layoutRoomLabels(visibleRooms(plan), {
    ratio: layout.ratio,
    showNames: display.roomNames,
    showAreas: display.areas,
  })
  const activeSystems = SERVICE_SYSTEMS.filter((item) => layerVisible(plan, item.id) && ensureServices(plan).runs.some((run) => run.system === item.id))
  const sheetTitle = sheetMode === 'site' ? 'Asemapiirros' : (activeSystems.length === 1 ? activeSystems[0].title : 'Pohjakuva')
  const liveEnd = draft && (tool === 'exterior' || tool === 'interior') ? (drawGuide || snapVisual?.point || null) : null
  const roomCursor = tool === 'room' ? snapVisual?.point || null : null
  const liveLength = draft && liveEnd ? segmentLength(draft, liveEnd) : 0
  const spec = PLACEABLES.find((item) => item.id === svcKind)
  const status = redrawId
    ? 'Piirrä reitti uudelleen. Enter päättää, Escape peruuttaa.'
    : svcTool === 'run'
    ? 'Linja: napsauta pisteet. Enter tai Valmis päättää. Escape peruuttaa.'
    : svcTool === 'node'
      ? `${spec?.name || 'Piste'}: napsauta paikka. Piste tarttuu verkkoon ja lähellä olevaan osaan.`
    : liveEnd
    ? `Pituus ${formatMm(liveLength)} mm`
    : yardTool
      ? yardToolLabel(yardTool)
      : placing
      ? 'Napsauta pohjaan kalusteen paikka'
      : tool === 'room' && roomShape === 'poly'
        ? 'Huone: napsauta kulmat. Sulje ensimmäiseen pisteeseen tai paina Enter.'
        : tool === 'room'
          ? 'Huone: vedä suorakulmio kahdella napsautuksella. Nurkat tarttuvat seiniin.'
          : tool === 'detect'
            ? 'Tunnista: napsauta seinien rajaamaa aluetta.'
            : tool === 'exterior'
        ? 'Ulkoseinä: napsauta alkupiste ja loppupiste'
        : tool === 'interior'
          ? 'Väliseinä: napsauta alkupiste ja loppupiste'
          : tool === 'door'
            ? 'Ovi: napsauta seinää'
            : tool === 'window'
              ? 'Ikkuna: napsauta seinää'
              : 'Valitse: vedä vasemmalta oikealle ikkuna, oikealta vasemmalle ylitys. Shift tai Ctrl lisää ja poistaa. Esc tyhjentää.'

  const px = (metres) => metres * layout.scale * k

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#e7e5e4', color: '#1c1917' }} onPointerDown={() => setMenu(null)}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '6px 10px',
        background: '#14181f', color: '#f5f5f4', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <Link href="/" style={{ color: '#99f6e4', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>RefCAD</Link>
        <Link href="/" style={{ color: '#a8a29e', textDecoration: 'none', fontSize: 12, fontWeight: 650 }}>Kylmätilat</Link>
        <input
          aria-label="Piirustuksen nimi"
          value={plan.name}
          onChange={(event) => setPlan({ ...plan, name: event.target.value })}
          style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 650, fontSize: 13, width: 160 }}
        />
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b' }}>
          <button type="button" data-testid="tool-select" style={textBtn(tool === 'select' && !placing)} onClick={() => { setTool('select'); setPlacing(null); setDraft(null) }}>Valitse</button>
          <button type="button" data-testid="tool-exterior" style={textBtn(tool === 'exterior')} onClick={() => { setTool('exterior'); setPlacing(null) }}>Ulkoseinä</button>
          <button type="button" data-testid="tool-interior" style={textBtn(tool === 'interior')} onClick={() => { setTool('interior'); setPlacing(null) }}>Väliseinä</button>
          <button type="button" data-testid="tool-door" style={textBtn(tool === 'door')} onClick={() => { setTool('door'); setPlacing(null); setDraft(null) }}>Ovi</button>
          <button type="button" data-testid="tool-window" style={textBtn(tool === 'window')} onClick={() => { setTool('window'); setPlacing(null); setDraft(null) }}>Ikkuna</button>
          <button type="button" data-testid="tool-room" style={textBtn(tool === 'room' && roomShape === 'rect')} onClick={() => { setTool('room'); setRoomShape('rect'); setPlacing(null); setPoly([]) }}>Huone</button>
          <button type="button" data-testid="tool-room-poly" style={textBtn(tool === 'room' && roomShape === 'poly')} onClick={() => { setTool('room'); setRoomShape('poly'); setPlacing(null); setDraft(null) }}>Monikulmio</button>
          <button type="button" data-testid="tool-detect" style={textBtn(tool === 'detect')} onClick={() => { setTool('detect'); setPlacing(null); setDraft(null); setPoly([]) }}>Tunnista</button>
        </div>
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b' }}>
          <button type="button" data-testid="view-floor-2d" style={textBtn(view === '2d' && sheetMode !== 'site')} onClick={() => { setView('2d'); setSheetMode('plan'); setYardTool(null); setYardPoints([]) }}>2D</button>
          <button type="button" data-testid="view-site" style={textBtn(view === '2d' && sheetMode === 'site')} onClick={() => { setView('2d'); setSheetMode('site'); setCamera(FIT_CAMERA); setYardTool(null); setYardPoints([]) }}>Piha</button>
          <button type="button" data-testid="view-floor-3d" style={textBtn(view === '3d')} onClick={() => setView('3d')}>3D</button>
          <button type="button" data-testid="view-facade" style={textBtn(view === 'facade')} onClick={() => setView('facade')}>Julkisivu</button>
        </div>
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b' }}>
          <button type="button" style={textBtn(plan.paper !== 'a4')} onClick={() => setPlan({ ...plan, paper: 'a3' })}>A3</button>
          <button type="button" style={textBtn(plan.paper === 'a4')} onClick={() => setPlan({ ...plan, paper: 'a4' })}>A4</button>
        </div>
        <button type="button" title="Kumoa" data-testid="undo" onClick={undo} style={textBtn(false)}>Kumoa</button>
        <button type="button" title="Tee uudelleen" data-testid="redo" onClick={redoChange} style={textBtn(false)}>Tee uudelleen</button>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="plan-new" onClick={() => { setMenu(null); setNewOpen(true) }} style={textBtn(false)}>Uusi</button>
        <button type="button" data-testid="plan-open" onClick={() => { setMenu(null); setLibraryOpen(true) }} style={textBtn(false)}>Avaa/Tallenna</button>
        <button type="button" data-testid="house-settings" onClick={() => { setPanel('house'); setMenu(null) }} style={textBtn(panel === 'house')}>Talon asetukset</button>
        <button type="button" data-testid="open-display" onClick={() => setDisplayOpen((open) => !open)} style={textBtn(displayOpen)}>Näytä</button>
        <button type="button" data-testid="toolbar-preset-plain" title="Pelkistetty (Alt+1)" onClick={() => setDisplay({ preset: 'plain' })} style={textBtn(display.preset === 'plain')}>Pelkistetty</button>
        <button type="button" data-testid="toolbar-preset-measure" title="Mitoitus (Alt+2)" onClick={() => setDisplay({ preset: 'measure' })} style={textBtn(display.preset === 'measure')}>Mitoitus</button>
        <button type="button" data-testid="toolbar-preset-all" title="Kaikki (Alt+3)" onClick={() => setDisplay({ preset: 'all' })} style={textBtn(display.preset === 'all')}>Kaikki</button>
        <button type="button" data-testid="example-house" onClick={loadExample} style={textBtn(false)}>Esimerkkitalo</button>
        <button type="button" data-testid="family-house" onClick={loadFamily} style={textBtn(false)}>Huoneisto</button>
        <button type="button" data-testid="export-floor-pdf" onClick={exportPdf} style={textBtn(false)}>PDF</button>
        <button type="button" data-testid="export-site-pdf" onClick={() => buildSitePdf(plan).save(`${(plan.name || 'asemapiirros').replace(/\s+/g, '-')}-asemapiirros.pdf`)} style={textBtn(false)}>Asemapiirros</button>
        <button type="button" data-testid="export-floor-png" onClick={exportPng} style={textBtn(false)}>PNG</button>
      </header>
      <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', background: '#1c212b', color: '#e7e5e4', flexShrink: 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input data-testid="room-partitions" type="checkbox" checked={partitions} onChange={(event) => setPartitions(event.target.checked)} />
          Luo väliseinät (120 mm)
        </label>
        {tool === 'room' && roomShape === 'poly' && poly.length >= 3 && (
          <button type="button" data-testid="close-room" style={textBtn(false)} onClick={() => closeRoom(poly)}>Sulje huone</button>
        )}
        {sheetMode === 'site' && YARD_DRAW_TOOLS.map(([id, label]) => (
          <button key={id} type="button" data-testid={`yard-tool-${id}`} style={textBtn(yardTool === id)} onClick={() => { setYardTool(id); setTool('select'); setPlacing(null); setYardPoints([]) }}>{label}</button>
        ))}
        {sheetMode === 'site' && (
          <>
            <select data-testid="yard-plant-tool" value={yardTool?.startsWith('plant:') ? yardTool : ''} onChange={(event) => { setYardTool(event.target.value || null); setTool('select'); setYardPoints([]) }} style={{ fontSize: 12, borderRadius: 6 }}>
              <option value="">Kasvi</option>
              {PLANTS.map((item) => <option key={item.id} value={`plant:${item.id}`}>{item.name}</option>)}
            </select>
            <select data-testid="yard-object-tool" value={yardTool?.startsWith('object:') ? yardTool : ''} onChange={(event) => { setYardTool(event.target.value || null); setTool('select'); setYardPoints([]) }} style={{ fontSize: 12, borderRadius: 6 }}>
              <option value="">Pihaesine</option>
              {OBJECTS.map((item) => <option key={item.id} value={`object:${item.id}`}>{item.name}</option>)}
            </select>
            <select data-testid="yard-building-tool" value={yardTool?.startsWith('building:') ? yardTool : ''} onChange={(event) => { setYardTool(event.target.value || null); setTool('select'); setYardPoints([]) }} style={{ fontSize: 12, borderRadius: 6 }}>
              <option value="">Ulkorakennus</option>
              {BUILDINGS.map((item) => <option key={item.id} value={`building:${item.id}`}>{item.name}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              Pohjoinen
              <input data-testid="north-angle" type="number" value={ensureYard(plan).north} onChange={(event) => commit(updateYardItem(plan, 'north', 'north', { north: Number(event.target.value) || 0 }))} style={{ width: 52, padding: '2px 4px', borderRadius: 6, border: '1px solid #44403c', background: '#111827', color: '#fff' }} />
              °
            </label>
          </>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#a8a29e' }}>Tartunta</span>
        <button type="button" data-testid="snap-100" title="Ruudukko 100 mm" style={textBtn(gridStep === 0.1)} onClick={() => setGridStep(0.1)}>100</button>
        <button type="button" data-testid="snap-50" title="Ruudukko 50 mm" style={textBtn(gridStep === 0.05)} onClick={() => setGridStep(0.05)}>50</button>
        <button type="button" data-testid="snap-10" title="Ruudukko 10 mm" style={textBtn(gridStep === 0.01)} onClick={() => setGridStep(0.01)}>10</button>
        <span style={{ fontSize: 11, color: '#a8a29e', marginLeft: 6 }}>Kulma</span>
        <button type="button" data-testid="angle-90" data-ortho="true" title="90° (Shift)" aria-pressed={angleStep === 90} style={textBtn(angleStep === 90)} onClick={() => setAngleStep(90)}>90°</button>
        <button type="button" data-testid="angle-45" aria-pressed={angleStep === 45} style={textBtn(angleStep === 45)} onClick={() => setAngleStep(45)}>45°</button>
        <button type="button" data-testid="angle-15" aria-pressed={angleStep === 15} style={textBtn(angleStep === 15)} onClick={() => setAngleStep(15)}>15°</button>
        <button type="button" data-testid="angle-free" aria-pressed={angleStep === 0} style={textBtn(angleStep === 0)} onClick={() => setAngleStep(0)}>Vapaa</button>
        {view === '2d' && (
          <>
            <button type="button" data-testid="zoom-out" title="Loitonna (−)" style={textBtn(false)} onClick={() => {
              const rect = hostRef.current?.getBoundingClientRect()
              setCamera((current) => zoomAt(current, (rect?.width || 0) / 2, (rect?.height || 0) / 2, 0.8))
            }}>−</button>
            <span data-testid="zoom-percent" style={{ minWidth: 44, textAlign: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{zoomPercent(camera)}%</span>
            <button type="button" data-testid="zoom-in" title="Lähennä (+)" style={textBtn(false)} onClick={() => {
              const rect = hostRef.current?.getBoundingClientRect()
              setCamera((current) => zoomAt(current, (rect?.width || 0) / 2, (rect?.height || 0) / 2, 1.25))
            }}>+</button>
            <button type="button" data-testid="zoom-fit" title="Sovita arkki (0)" style={textBtn(false)} onClick={() => setCamera(FIT_CAMERA)}>Sovita</button>
          </>
        )}
      </div>
      <ServiceBar
        plan={plan}
        system={svcSystem}
        kindId={svcKind}
        tool={svcTool}
        floorHeating={floorHeating}
        drawing={svcTool === 'run' && svcPoints.length >= 2}
        onSystem={(id) => {
          setSvcSystem(id)
          const next = PLACEABLES.find((item) => item.system === id && item.mode === (svcTool === 'run' ? 'run' : 'node'))
          if (next) setSvcKind(next.id)
        }}
        onKind={setSvcKind}
        onTool={(next) => {
          setSvcTool(next)
          setTool('select')
          setPlacing(null)
          setDraft(null)
          setPoly([])
          const current = PLACEABLES.find((item) => item.id === svcKind)
          if (!current || current.system !== svcSystem || current.mode !== next) {
            const match = PLACEABLES.find((item) => item.system === svcSystem && item.mode === next)
            if (match) setSvcKind(match.id)
          }
        }}
        onLayer={(id, visible) => setPlan((current) => {
          const services = ensureServices(current)
          return { ...current, services: { ...services, layers: { ...services.layers, [id]: visible } } }
        })}
        onRoute={() => {
          commit(syncYardServices(autoRouteAll(plan, { floorHeating })))
          setSvcPoints([])
          setView('2d')
        }}
        onRewire={() => {
          commit(rewireElectric(plan))
          setSvcPoints([])
          setView('2d')
          setElectricView(null)
        }}
        onSchedule={() => {
          setView('2d')
          setElectricView('list')
        }}
        onDiagram={() => {
          setView('2d')
          setElectricView('diagram')
        }}
        onRewireWater={() => {
          commit(rewireWater(plan))
          setView('2d')
          setHeatView(null)
        }}
        onRewireHeat={() => {
          commit(applyHeating(plan, {}))
          setView('2d')
          setSvcSystem('heat')
          setHeatView(null)
        }}
        onHeatTable={() => {
          setView('2d')
          setHeatView('table')
          setElectricView(null)
        }}
        onHeatSchematic={() => {
          setView('2d')
          setHeatView('schematic')
          setElectricView(null)
        }}
        onFloorHeating={setFloorHeating}
        onFinish={finishServiceRun}
        onPdf={(id) => {
          const doc = id === 'electric' ? buildElectricPdf(plan) : id === 'heat' || id === 'water' ? buildHydronicPdf(plan) : buildServicePdf(plan, id)
          doc.save(`${(plan.name || 'talotekniikka').replace(/\s+/g, '-')}-${id}.pdf`)
        }}
      />

      <CadToolbar
        active={command?.name}
        onCommand={beginCommand}
        onSelectType={(type) => remember(targetsByType(plan, type))}
        onLayer={(layer) => beginCommand('layer', layer)}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 232, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderRight: '1px solid #d6d3d1', padding: '10px 10px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '4px 4px 8px' }}>KALUSTEET</div>
          <input
            data-testid="fixture-search"
            value={fixtureQuery}
            placeholder="Hae kalustetta"
            aria-label="Hae kalustetta"
            onChange={(event) => setFixtureQuery(event.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: '6px 8px', borderRadius: 8, border: '1px solid #d6d3d1', fontSize: 12 }}
          />
          <button type="button" data-testid="furnish-all" style={{ ...sideBtn(false), marginBottom: 6 }} onClick={() => commit(furnishAll(plan))}>Kalusta tyypillisesti</button>
          {room && layoutFor(roomKindId).length > 0 && (
            <button type="button" data-testid="furnish-room" style={{ ...sideBtn(false), marginBottom: 8 }} onClick={() => commit(furnishRoom(plan, room.id))}>Kalusta {room.name}</button>
          )}
          {suggested.length > 0 && (
            <div style={{ marginBottom: 10 }} data-testid="fixture-suggestions">
              <div style={{ fontSize: 12, fontWeight: 750, margin: '0 4px 4px' }}>Ehdotukset{room ? `: ${room.name}` : ''}</div>
              {suggested.map((item) => (
                <button
                  key={`sug-${item.id}`}
                  type="button"
                  data-testid={`suggest-${item.id}`}
                  style={sideBtn(placing === item.id)}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-fixture', item.id)
                    event.dataTransfer.setData('text/plain', item.id)
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => { setPlacing(item.id); setTool('select'); setDraft(null) }}
                >
                  {item.name}
                  <span style={{ display: 'block', fontWeight: 500, color: '#78716c', fontSize: 11 }}>{Math.round(item.w * 1000)} × {Math.round(item.d * 1000)} mm</span>
                </button>
              ))}
            </div>
          )}
          {groups.map((group) => (
            <div key={group.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 750, margin: '0 4px 4px' }}>{group.id}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`fixture-${item.id}`}
                  style={sideBtn(placing === item.id)}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-fixture', item.id)
                    event.dataTransfer.setData('text/plain', item.id)
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => { setPlacing(item.id); setTool('select'); setDraft(null) }}
                >
                  {item.name}
                  <span style={{ display: 'block', fontWeight: 500, color: '#78716c', fontSize: 11 }}>{Math.round(item.w * 1000)} × {Math.round(item.d * 1000)} mm</span>
                </button>
              ))}
            </div>
          ))}
          {chimneyNotes.length > 0 && (
            <div data-testid="chimney-warnings" style={{ margin: '8px 0', padding: '8px 8px 4px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8 }}>
              {chimneyNotes.map((item, index) => (
                <div key={`${item.id}-${item.code}-${index}`} style={{ fontSize: 11, color: '#9a3412', marginBottom: 4 }}>{item.text}</div>
              ))}
            </div>
          )}
          {schedule.length > 0 && (
            <div data-testid="furniture-schedule" style={{ marginTop: 12, borderTop: '1px solid #e7e5e4', paddingTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '0 4px 6px' }}>KALUSTELUETTELO</div>
              {schedule.map((row) => (
                <div key={row.key} style={{ fontSize: 11, padding: '3px 4px', borderBottom: '1px solid #f5f5f4' }}>
                  <div style={{ fontWeight: 700 }}>{row.count} × {row.name}{row.variant ? ` ${row.variant}` : ''}</div>
                  <div style={{ color: '#78716c' }}>{row.room} · {Math.round(row.w * 1000)} × {Math.round(row.d * 1000)} mm</div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
          <div style={{ minHeight: 28, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12, color: '#44403c', background: '#f5f5f4', borderBottom: '1px solid #e7e5e4' }}>
            {command ? (
              <CadPrompt
                command={command}
                readout={command.readout}
                onChange={(patch) => {
                  setCommand((current) => {
                    if (!current) return current
                    const next = { ...current, ...patch }
                    commandRef.current = next
                    if (next.step === 'to' && originPlan.current && cursor && next.name !== 'measure') {
                      setPlan(runCommand(originPlan.current, picks, next, snappedPoint(cursor)))
                    }
                    return next
                  })
                }}
                onApply={() => { if (command.step === 'to') confirmCommand(snappedPoint(cursor || command.base || { x: 0, z: 0 })) }}
                onCancel={cancelCommand}
              />
            ) : draft && liveEnd && (tool === 'exterior' || tool === 'interior') ? (
              <DrawFields
                draft={draft}
                end={liveEnd}
                onLength={(mm) => {
                  if (!Number.isFinite(mm) || mm < 50) return
                  const ang = Math.atan2(liveEnd.z - draft.z, liveEnd.x - draft.x)
                  const metres = mm / 1000
                  setDrawGuide({ x: draft.x + Math.cos(ang) * metres, z: draft.z + Math.sin(ang) * metres })
                }}
                onAngle={(deg) => {
                  if (!Number.isFinite(deg)) return
                  const metres = Math.max(0.2, segmentLength(draft, liveEnd))
                  const rad = deg * Math.PI / 180
                  setDrawGuide({ x: draft.x + Math.cos(rad) * metres, z: draft.z + Math.sin(rad) * metres })
                }}
                onCommit={() => {
                  const end = drawGuide || liveEnd
                  if (!draft || !end) return
                  commit(refreshHeat(addWall(plan, draft, end, tool)))
                  setDraft(null)
                  setDrawGuide(null)
                }}
              />
            ) : status}
          </div>
          {view === 'facade' ? (
            <FacadeView plan={plan} side={facadeSideId} onSide={setFacadeSideId} onApply={setPlan} onCommit={commit} />
          ) : view === '2d' ? (
            <div ref={hostRef} style={{ flex: 1, minHeight: 0, background: '#d6d3d1', position: 'relative' }}>
              <svg
                ref={svgRef}
                data-testid="floor-plan-svg"
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                height="100%"
                onPointerMove={onPointerMove}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onContextMenu={onContextMenu}
                style={{ display: 'block', cursor: tool === 'select' && !placing && !svcTool && !yardTool ? 'default' : 'crosshair', touchAction: 'none' }}
              >
                <defs>
                  <pattern id="poche" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="5" height="5" fill="#3f3834" />
                    <line x1="0" y1="0" x2="0" y2="5" stroke="#2a241f" strokeWidth="0.6" />
                  </pattern>
                  <HatchDefs />
                </defs>
                <g data-testid="plan-camera" transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
                <rect x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} fill="#fbfaf7" stroke="#1c1917" strokeWidth={1.4} />
                <rect x={sheet.x + 4} y={sheet.y + 4} width={sheet.w - 8} height={sheet.h - 8} fill="none" stroke="#a8a29e" strokeWidth={0.6} />
                {visibleRooms(plan).map((item) => (
                  <polygon
                    key={item.id}
                    points={item.polygon.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')}
                    fill={materialOf('floor', item.floorId).color}
                    fillOpacity={item.id === selectedRoom ? 0.78 : 0.5}
                    stroke={item.id === selectedRoom ? '#0f766e' : 'none'}
                    strokeWidth={1.2}
                  />
                ))}
                {sheetMode === 'site' && (
                  <YardLayer
                    plan={plan}
                    X={X}
                    Y={Y}
                    px={px}
                    sheet={sheet}
                    selected={pick}
                    preview={yardPoints.length ? { points: yardPoints, cursor: snapVisual?.point || cursor } : null}
                  />
                )}
                <WallOutlines plan={plan} X={X} Y={Y} selectedIds={picks.filter((item) => item.kind === 'wall').map((item) => item.id)} />
                {(plan.openings || []).filter((opening) => !opening.hidden).map((opening) => {
                  const wall = plan.walls.find((item) => item.id === opening.wallId)
                  if (!wall || wall.hidden) return null
                  const fig = openingSymbol(wall, opening, plan)
                  const selectedOpening = picks.some((item) => item.kind === 'opening' && item.id === opening.id)
                  if (fig.kind === 'window') {
                    return (
                      <g key={opening.id} stroke={selectedOpening ? '#0f766e' : '#1c1917'} strokeWidth={1.15} fill="none">
                        {fig.glass.map((line, index) => (
                          <line key={index} x1={X(line.x1)} y1={Y(line.z1)} x2={X(line.x2)} y2={Y(line.z2)} />
                        ))}
                        <line x1={X(fig.jambA[0].x)} y1={Y(fig.jambA[0].z)} x2={X(fig.jambA[1].x)} y2={Y(fig.jambA[1].z)} />
                        <line x1={X(fig.jambB[0].x)} y1={Y(fig.jambB[0].z)} x2={X(fig.jambB[1].x)} y2={Y(fig.jambB[1].z)} />
                      </g>
                    )
                  }
                  return (
                    <g key={opening.id} stroke={selectedOpening ? '#0f766e' : '#1c1917'} strokeWidth={1.15} fill="none">
                      <polyline points={fig.arc.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')} />
                      <line x1={X(fig.hinge.x)} y1={Y(fig.hinge.z)} x2={X(fig.leaf.x)} y2={Y(fig.leaf.z)} />
                    </g>
                  )
                })}
                {sheetMode !== 'site' && display.fixtures && (plan.fixtures || []).filter((fixture) => !fixture.hidden).map((fixture) => {
                  const spec = resolveFixture(fixture)
                  const draw = drawingOf(fixture)
                  const w = px(spec.w)
                  const d = px(spec.d)
                  const zone = draw.clearance
                  const side = px(zone?.side || 0)
                  const rear = px(zone?.rear || 0)
                  const front = px(zone?.front || 0)
                  const hearth = draw.hearth
                  return (
                    <g
                      key={fixture.id}
                      data-testid={`placed-${fixture.type}`}
                      transform={`translate(${X(fixture.x)} ${Y(fixture.z)}) rotate(${fixture.rotation || 0})${fixture.mirror ? ' scale(-1 1)' : ''}`}
                      style={{ pointerEvents: tool === 'select' && !placing && !svcTool ? 'auto' : 'none' }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        if (commandRef.current) return
                        event.stopPropagation()
                        choose({ kind: 'fixture', id: fixture.id }, { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey })
                        setTool('select')
                        setPlacing(null)
                        dragId.current = fixture.id
                        dragBefore.current = plan
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        clip.current = { ...fixture }
                        choose({ kind: 'fixture', id: fixture.id })
                        setMenu({ x: event.clientX, y: event.clientY, kind: 'fixture', id: fixture.id, at: { x: fixture.x, z: fixture.z } })
                      }}
                    >
                      {hearth && (
                        <rect
                          data-testid="hearth-plate"
                          x={-w / 2 - px(hearth.side || 0)}
                          y={-d / 2}
                          width={w + px(hearth.side || 0) * 2}
                          height={d + px(hearth.front || 0)}
                          fill="#f5f5f4"
                          stroke="#57534e"
                          strokeWidth={0.8}
                        />
                      )}
                      <FixtureSymbol symbol={spec.symbol} w={w} d={d} color={fixture.color} flues={draw.flues} />
                      {draw.shield && (
                        <rect
                          data-testid="heat-shield"
                          x={-w / 2 - px(0.02)}
                          y={-d / 2 - px(0.04)}
                          width={w + px(0.04)}
                          height={px(0.03)}
                          fill="#e7e5e4"
                          stroke="#44403c"
                          strokeWidth={0.7}
                        />
                      )}
                      {zone && (side > 0 || rear > 0 || front > 0) && (
                        <rect
                          data-testid="clearance-zone"
                          x={-w / 2 - side}
                          y={-d / 2 - rear}
                          width={w + side * 2}
                          height={d + rear + front}
                          fill="none"
                          stroke="#c2410c"
                          strokeWidth={0.9}
                          strokeDasharray="6 4"
                        />
                      )}
                      {picks.some((item) => item.kind === 'fixture' && item.id === fixture.id) && (
                        <rect x={-w / 2 - 3} y={-d / 2 - 3} width={w + 6} height={d + 6} fill="none" stroke="#0f766e" strokeWidth={1.4} />
                      )}
                    </g>
                  )
                })}
                <FaceLines plan={plan} X={X} Y={Y} selected={pick?.kind === 'room' ? pick : null} onSelect={(face) => {
                  setPick(face)
                  setSelectedRoom(face.id)
                  setPanel('object')
                  setMenu(null)
                }} />
                {sheetMode !== 'site' && plan.walls.length > 0 && (
                  <g style={{ pointerEvents: 'none' }} data-testid="dimension-chains">
                    {dimLines.map((dim, index) => (
                      <DimLine key={`${dim.kind || 'dim'}-${dim.id || index}-${dim.label}-${dim.x1}`} dim={dim} X={X} Y={Y} fontSize={Math.max(6.5, 2.35 * k)} ppm={layout.scale * k} />
                    ))}
                  </g>
                )}
                {sheetMode !== 'site' && display.openingSizes && openingTags(plan).map((tag) => (
                  <text
                    key={`tag-${tag.id}`}
                    data-testid="opening-tag"
                    x={X(tag.x)}
                    y={Y(tag.z)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.max(6, 2 * k)}
                    fill="#44403c"
                    transform={tag.vertical ? `rotate(-90 ${X(tag.x)} ${Y(tag.z)})` : undefined}
                    style={{ pointerEvents: 'none' }}
                  >
                    {tag.label}
                  </text>
                ))}
                {sheetMode !== 'site' && display.structures && structureMarks(plan).map((mark) => (
                  <text
                    key={`mark-${mark.id}`}
                    data-testid="structure-mark"
                    data-code={mark.code}
                    x={X(mark.x)}
                    y={Y(mark.z)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.max(6, 1.9 * k)}
                    fill="#0f766e"
                    fontWeight={700}
                    transform={mark.vertical ? `rotate(-90 ${X(mark.x)} ${Y(mark.z)})` : undefined}
                    style={{ pointerEvents: 'none' }}
                  >
                    {mark.code}
                  </text>
                ))}
                {sheetMode !== 'site' && display.structures && structureCatalog(plan).length > 0 && (
                  <g data-testid="structure-legend" style={{ pointerEvents: 'none' }}>
                    {(() => {
                      const rows = structureCatalog(plan)
                      const font = Math.max(8, 2.4 * k)
                      const rowH = font + 4
                      const widest = Math.max(...rows.map((row) => `${row.code}  ${row.name}  U ${Number(row.u).toFixed(2)}`.length), 16)
                      const boxW = Math.min(sheet.w * 0.46, Math.max(168, widest * font * 0.58 + 16))
                      const boxH = rowH * (rows.length + 1) + 8
                      const x = sheet.x + 8 * k
                      const y = Math.max(sheet.y + 8, sheet.y + sheet.h - boxH - 8 * k)
                      return (
                        <>
                          <rect x={x} y={y} width={boxW} height={boxH} fill="#fbfaf7" stroke="#1c1917" strokeWidth={0.6} />
                          <text x={x + 6} y={y + rowH} fontSize={font} fontWeight={700} fill="#1c1917">Rakennetyypit</text>
                          {rows.map((row, index) => (
                            <text key={row.key} data-testid="legend-row" data-code={row.code} x={x + 6} y={y + rowH * (index + 2)} fontSize={font} fill="#1c1917">
                              {row.code}  {row.name}  U {Number(row.u).toFixed(2).replace('.', ',')}
                            </text>
                          ))}
                        </>
                      )
                    })()}
                  </g>
                )}
                {liveEnd && tool !== 'room' && (
                  <g style={{ pointerEvents: 'none' }}>
                    <line x1={X(draft.x)} y1={Y(draft.z)} x2={X(liveEnd.x)} y2={Y(liveEnd.z)} stroke="#0f766e" strokeWidth={1.5 / camera.zoom} strokeDasharray={`${6 / camera.zoom} ${4 / camera.zoom}`} />
                    <text x={(X(draft.x) + X(liveEnd.x)) / 2} y={(Y(draft.z) + Y(liveEnd.z)) / 2 - 10 / camera.zoom} textAnchor="middle" fontSize={13 / camera.zoom} fontWeight={700} fill="#0f766e">{formatMm(liveLength)}</text>
                  </g>
                )}
                {tool === 'room' && roomShape === 'rect' && draft && roomCursor && (
                  <polygon
                    points={[
                      [draft.x, draft.z],
                      [roomCursor.x, draft.z],
                      [roomCursor.x, roomCursor.z],
                      [draft.x, roomCursor.z],
                    ].map(([x, z]) => `${X(x)},${Y(z)}`).join(' ')}
                    fill="#0f766e22"
                    stroke="#0f766e"
                    strokeWidth={1.2}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {tool === 'room' && roomShape === 'poly' && poly.length > 0 && (
                  <polyline
                    points={[...poly, ...(roomCursor ? [roomCursor] : [])].map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')}
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth={1.2}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                <g style={{ pointerEvents: 'none' }} data-testid="north-arrow" data-north={ensureYard(plan).north || 0}>
                  {(() => {
                    const ax = sheet.x + sheet.w - 52
                    const ay = sheet.y + 48
                    const north = sheetMode === 'site' ? (ensureYard(plan).north || 0) : 0
                    return (
                      <g transform={`rotate(${north} ${ax} ${ay})`}>
                        <circle cx={ax} cy={ay} r={15} fill="#fff" stroke="#1c1917" strokeWidth={0.8} />
                        <polygon points={`${ax},${ay - 10} ${ax + 4},${ay + 5} ${ax},${ay + 2} ${ax - 4},${ay + 5}`} fill="#1c1917" />
                        <text x={ax} y={ay - 20} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1c1917">N</text>
                      </g>
                    )
                  })()}
                </g>
                <g style={{ pointerEvents: 'none' }}>
                  {(() => {
                    const tx = sheet.x + (layout.title.x * k)
                    const ty = sheet.y + (layout.title.y * k)
                    const tw = layout.title.w * k
                    const th = layout.title.h * k
                    const roofName = (ROOF_TYPES.find((item) => item.id === plan.roofType) || ROOF_TYPES[0]).name
                    const yard = ensureYard(plan)
                    const lines = sheetMode === 'site' ? [
                      plan.name || 'Omakotitalo',
                      `Mittakaava 1:${layout.ratio}`,
                      plan.paper === 'a4' ? 'A4 vaaka' : 'A3 vaaka',
                      `Tontti ${formatSquare(plotMetrics(plan).area)}`,
                      `Pohjoinen ${Math.round(yard.north || 0)}°`,
                      `Ulkorakennukset ${yard.buildings.length}`,
                    ] : [
                      plan.name || 'Omakotitalo',
                      `Mittakaava 1:${layout.ratio}`,
                      plan.paper === 'a4' ? 'A4 vaaka' : 'A3 vaaka',
                      roofName,
                      `Huoneita ${visibleRooms(plan).length}`,
                      `Pinta-ala ${formatArea(totalArea)}`,
                    ]
                    const header = Math.min(22, th * 0.28)
                    const top = ty + header + 12
                    const bottom = ty + th - 22
                    const step = lines.length > 1 ? (bottom - top) / (lines.length - 1) : 0
                    return (
                      <g data-testid="title-block">
                        <rect x={tx} y={ty} width={tw} height={th} fill="#fff" stroke="#1c1917" strokeWidth={1} />
                        <line x1={tx} y1={ty + header} x2={tx + tw} y2={ty + header} stroke="#1c1917" strokeWidth={0.7} />
                        <text x={tx + 8} y={ty + header * 0.68} fontSize={13} fontWeight={750} fill="#1c1917">{sheetTitle}</text>
                        {lines.map((line, index) => (
                          <text key={`${index}-${line}`} x={tx + 8} y={top + step * index} fontSize={10} fill="#292524">{line}</text>
                        ))}
                        <g data-testid="scale-bar">
                          {(() => {
                            const metres = layout.worldW >= 8 ? 5 : 2
                            const maxW = tw - 28
                            const natural = metres * layout.scale * k
                            const bar = Math.min(maxW, Math.max(36, natural))
                            const sy = ty + th - 12
                            return (
                              <>
                                <text x={tx + 8} y={sy - 3} fontSize={8} fill="#1c1917">0</text>
                                <text x={tx + 8 + bar} y={sy - 3} textAnchor="end" fontSize={8} fill="#1c1917">{metres} m</text>
                                {Array.from({ length: metres }, (_, index) => (
                                  <rect key={index} x={tx + 8 + (bar / metres) * index} y={sy} width={bar / metres} height={5} fill={index % 2 ? '#fff' : '#1c1917'} stroke="#1c1917" strokeWidth={0.4} />
                                ))}
                              </>
                            )
                          })()}
                        </g>
                      </g>
                    )
                  })()}
                </g>
                <ServiceDrawing
                  plan={plan}
                  X={X}
                  Y={Y}
                  sheet={sheet}
                  legendBox={{
                    x: sheet.x + layout.title.x * k,
                    y: sheet.y + 70,
                    w: layout.title.w * k,
                  }}
                  interactive={!svcTool}
                  selected={pick}
                  onRouteDown={(event, hit) => beginRouteDrag(hit.id, hit.mode, hit.index, toWorld(event))}
                  preview={svcTool === 'run' ? { points: svcPoints, cursor: cursor ? snapServicePoint(cursor, plan, { mode: 'free', system: svcSystem }) : null } : null}
                  onContext={openServiceMenu}
                />
                {roomLabels.map((label) => (
                  <g
                    key={`label-${label.id}`}
                    data-testid="room-label"
                    data-name={label.roomName}
                    data-text={label.text}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const world = toWorld(event)
                      choose({ kind: 'room', id: label.id })
                      setMenu({ x: event.clientX, y: event.clientY, kind: 'room', id: label.id, at: world })
                    }}
                    style={{ pointerEvents: tool === 'select' && !placing && !svcTool ? 'auto' : 'none', cursor: 'move' }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return
                      if (commandRef.current) return
                      event.stopPropagation()
                      choose({ kind: 'room', id: label.id })
                      setSelectedRoom(label.id)
                      setSelectedFixture(null)
                      dragLabel.current = label.id
                      dragBefore.current = plan
                    }}
                  >
                    <SheetRoomLabel label={label} X={X} Y={Y} nameSize={Math.max(7, 2.8 * k)} areaSize={Math.max(6, 2.15 * k)} />
                  </g>
                ))}
                {plan.walls.length === 0 && (
                  <text x={sheet.x + sheet.w / 2} y={sheet.y + sheet.h / 2} textAnchor="middle" fontSize={15} fill="#78716c">Piirrä ulkoseinät tai avaa esimerkkitalo</text>
                )}
                {marquee && (
                  <rect
                    data-testid={marquee.mode === 'crossing' ? 'select-crossing' : 'select-window'}
                    data-mode={marquee.mode}
                    x={X(marquee.minX)}
                    y={Y(marquee.minZ)}
                    width={Math.max(0, X(marquee.maxX) - X(marquee.minX))}
                    height={Math.max(0, Y(marquee.maxZ) - Y(marquee.minZ))}
                    fill={marquee.mode === 'crossing' ? 'rgba(217,119,6,0.12)' : 'rgba(15,118,110,0.12)'}
                    stroke={marquee.mode === 'crossing' ? '#d97706' : '#0f766e'}
                    strokeWidth={1.4}
                    strokeDasharray={marquee.mode === 'crossing' ? '7 4' : undefined}
                  />
                )}
                {command?.base && cursor && (
                  <line
                    data-testid="cad-preview"
                    x1={X(command.base.x)}
                    y1={Y(command.base.z)}
                    x2={X((snapVisual?.point || cursor).x)}
                    y2={Y((snapVisual?.point || cursor).z)}
                    stroke="#0f766e"
                    strokeWidth={2.4}
                    strokeDasharray="8 4"
                  />
                )}
                <SnapMark snap={snapVisual} X={X} Y={Y} zoom={camera.zoom} />
                <AngleMarks marks={cornerAngles(plan.walls)} X={X} Y={Y} zoom={camera.zoom} />
                </g>
              </svg>
              {displayOpen && (
                <DisplayPanel
                  plan={plan}
                  display={display}
                  onChange={setDisplay}
                  onLayer={(id, visible) => setPlan((current) => setServiceLayer(current, id, visible))}
                />
              )}
            </div>
          ) : (
            <div ref={hostRef} data-testid="floor-3d" style={{ flex: 1, minHeight: 0, position: 'relative', background: '#e7e5e4' }}>
              <HouseScene
                plan={plan}
                wallMode={wallMode}
                roofMode={roofMode}
                fitToken={fitToken}
                selected={pick}
                hovered={hover}
                drawMode={!svcTool && (tool !== 'select' || Boolean(placing))}
                cursor={snapVisual?.point || cursor}
                cursorPpm={cursorPpm}
                snapKind={snapVisual?.kind || null}
                draft={(tool === 'exterior' || tool === 'interior') ? draft : null}
                liveEnd={liveEnd}
                liveLabel={liveEnd ? `${formatMm(liveLength)} mm` : ''}
                roomDraft={tool === 'room' && roomShape === 'rect' ? draft : null}
                roomCursor={roomCursor}
                onSelect={(hit) => { setMenu(null); choose(hit) }}
                onHover={onHover3d}
                onContext={openHitMenu}
                onPreview={onPreview3d}
                onPlace={onPlace3d}
                onFixtureDrag={onFixtureDrag3d}
                onOpeningDrag={onOpeningDrag3d}
                onYardDrag={onYardDrag3d}
                onServiceDrag={onServiceDrag3d}
                onDropFixture={onDropFixture3d}
              />
              <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4, background: '#14181f', padding: 4, borderRadius: 10 }}>
                  <span style={{ color: '#a8a29e', fontSize: 11, alignSelf: 'center', padding: '0 6px' }}>Seinät</span>
                  <button type="button" data-testid="wall-solid" style={textBtn(wallMode === 'solid')} onClick={() => setWallMode('solid')}>Näkyvissä</button>
                  <button type="button" data-testid="wall-ghost" aria-pressed={wallMode === 'ghost'} style={textBtn(wallMode === 'ghost')} onClick={() => setWallMode('ghost')}>Läpinäkyvä</button>
                  <button type="button" data-testid="wall-hidden" style={textBtn(wallMode === 'hidden')} onClick={() => setWallMode('hidden')}>Piilossa</button>
                </div>
                <div style={{ display: 'flex', gap: 4, background: '#14181f', padding: 4, borderRadius: 10 }}>
                  <span style={{ color: '#a8a29e', fontSize: 11, alignSelf: 'center', padding: '0 6px' }}>Katto</span>
                  <button type="button" data-testid="roof-solid" style={textBtn(roofMode === 'solid')} onClick={() => setRoofMode('solid')}>Näkyvissä</button>
                  <button type="button" data-testid="roof-ghost" style={textBtn(roofMode === 'ghost')} onClick={() => setRoofMode('ghost')}>Läpinäkyvä</button>
                  <button type="button" data-testid="roof-hidden" aria-pressed={roofMode === 'hidden'} style={textBtn(roofMode === 'hidden')} onClick={() => setRoofMode('hidden')}>Piilossa</button>
                </div>
              </div>
            </div>
          )}
          {electricView && (
            <ElectricPanel
              plan={plan}
              mode={electricView}
              onMode={setElectricView}
              onClose={() => setElectricView(null)}
              onPrint={() => buildElectricPdf(plan).save(`${(plan.name || 'sahko').replace(/\s+/g, '-')}-sahko.pdf`)}
              onAssign={(deviceId, circuitId) => commit(assignDeviceCircuit(plan, deviceId, circuitId))}
            />
          )}
          {heatView && (
            <HeatingPanel
              plan={plan}
              mode={heatView}
              onMode={setHeatView}
              onClose={() => setHeatView(null)}
              onPrint={() => buildHydronicPdf(plan).save(`${(plan.name || 'lammitys').replace(/\s+/g, '-')}-lammitys.pdf`)}
            />
          )}
        </div>

        <aside data-testid="materials-panel" style={{ width: 280, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderLeft: '1px solid #d6d3d1', padding: '12px 12px 20px' }}>
          {pick && panel !== 'house' ? (
            <div data-testid="panel-heading" style={{ marginBottom: 10 }}>
              <button type="button" data-testid="panel-back-house" onClick={() => setPanel('house')} style={{ display: 'block', padding: 0, border: 'none', background: 'transparent', color: '#0f766e', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}>← Talon asetukset</button>
              <div data-testid="selection-title" style={{ fontSize: 15, fontWeight: 750 }}>{picks.length > 1 ? `${picks.length} kohdetta` : selectionLabel(plan, pick)}</div>
            </div>
          ) : (
            <button type="button" data-testid="open-house-panel" style={{ ...sideBtn(panel === 'house'), marginBottom: 10 }} onClick={() => setPanel(panel === 'house' ? 'object' : 'house')}>Talon asetukset</button>
          )}
          {panel === 'house' ? (
            <HouseSettings plan={plan} onApply={setPlan} />
          ) : (
            <SelectionPanel plan={plan} selection={pick} picks={picks} onApply={setPlan} onCommit={commit} onPatchMany={(patch) => commit(patchShared(plan, picks, patch))} onClear={() => { remember([]); setMenu(null) }} onRedrawRoute={beginRedraw} />
          )}
          {pick?.kind === 'room' && room && (
            <div style={{ fontSize: 12, color: '#57534e', margin: '4px 0 12px' }}>{formatArea(room.area)}</div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '8px 0' }}>MATERIAALILUETTELO</div>
          {rows.length === 0 && <div style={{ fontSize: 12, color: '#78716c' }}>Ei pintoja vielä.</div>}
          {rows.map((row) => (
            <div key={row.key} data-testid={row.group === 'structure' ? 'structure-bom' : undefined} data-code={row.code || undefined} data-unit={row.unit || undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: row.color, border: '1px solid #a8a29e', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{row.group === 'structure' ? `${row.code} ${row.structureName}: ${row.name}` : `${row.roomName ? `${row.roomName}: ` : ''}${row.groupLabel}: ${row.name}`}</span>
              <span style={{ color: '#78716c' }}>{row.unit ? formatQuantity(row.area || 0, row.unit) : formatArea(row.area || 0)}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '14px 0 8px' }}>SELITE</div>
          {[
            ['Lattia', 'floor'],
            ['Sisäseinä', 'interior'],
            ['Sisäkatto', 'ceiling'],
            ['Ulkoseinä', 'exterior'],
            ['Katto', 'roof'],
          ].map(([label, group]) => (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{label}</div>
              {MATERIALS[group].map((item) => (
                <div key={`${group}-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#44403c', marginBottom: 3 }}>
                  <span style={{ width: 12, height: 12, background: item.color, border: '1px solid #d6d3d1' }} />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          ))}
          {claddingAreas(plan).length > 0 && (
            <div data-testid="facade-area-legend" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>Julkisivu</div>
              {claddingAreas(plan).map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#44403c', marginBottom: 3 }}>
                  <span style={{ width: 12, height: 12, background: item.color, border: '1px solid #d6d3d1' }} />
                  <span style={{ flex: 1 }}>{item.group}: {item.name}</span>
                  <span>{formatArea(item.area)}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
      {startOpen && !newOpen && (
        <StartDialog
          library={library}
          onEmpty={() => { setStartOpen(false); setNewOpen(true) }}
          onExample={loadExample}
          onOpen={openStored}
        />
      )}
      {newOpen && (
        <ShellDialog
          title="Uusi pohja"
          onCancel={() => { setNewOpen(false); if (!ready) setStartOpen(true) }}
          onCreate={createShell}
          onExample={loadExample}
        />
      )}
      {libraryOpen && (
        <LibraryDialog
          library={library}
          onClose={() => setLibraryOpen(false)}
          onSave={storeCurrent}
          onOpen={openStored}
          onRename={renameStored}
          onDelete={(id) => setLibrary((current) => deleteProject(current, id))}
          onExport={exportJson}
          onImport={importJson}
        />
      )}
      <FloorMenu menu={menu} plan={plan} onApply={setPlan} onCommit={commit} onNavigate={onMenuNavigate} />
      <ServiceMenu menu={menu} plan={plan} onApply={commit} onCommit={commit} onClose={() => setMenu(null)} onProperties={() => onMenuNavigate('properties')} onRedraw={beginRedraw} onCad={beginCommand} />
    </div>
  )
}
