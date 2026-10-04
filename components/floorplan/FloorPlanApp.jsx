'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  FIXTURES,
  MATERIALS,
  ROOF_TYPES,
  addFixture,
  addedFixture,
  addOpening,
  addWall,
  claddingAreas,
  cornerAngles,
  cornerJoint,
  deleteOpening,
  facadeSide,
  facadeHitFromWorld,
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
  moveCorner,
  moveFixture,
  moveOpening,
  nearestEndpoint,
  moveRoomLabel,
  openingSymbol,
  openingTags,
  planBounds,
  planDimensions,
  dedupeDimensions,
  straightenWalls,
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
import { faceOffsets, wallFigures } from '@/lib/wall-outline'
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
  mirrorOpenings,
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
import { CadPrompt } from './CadTools'
import { LayerDock, PlanChrome } from './PlanChrome'
import { buildPlanPdf } from '@/lib/roominfo'
import { applyDisplay, labelObstacles, layoutRoomLabels, normalizeDisplay } from '@/lib/display'
import { blockHeightForLines, dimensionFont, fitLines, LINE_LEADING, paperFont, placeDimensionText } from '@/lib/annotations'
import { DisplayPanel } from './DisplayPanel'
import { FloorMenu, HouseSettings, SelectionPanel, selectionLabel } from './FloorMenus'
import { LibraryDialog, ShellDialog, StartDialog } from './ProjectDialogs'
import FacadeView from './FacadeView'
import { ServiceDrawing, ServiceMenu } from './ServicesLayer'
import { ModeChip, PlaceToast, modeChipText, placeFrame } from '@/components/mode/PlaceMode'
import { judgePlacement, placeServiceNode, removeStacked, fixtureKey } from '@/lib/placeOnce'
import { ElectricPanel } from './ElectricPanel'
import { HeatingPanel } from './HeatingPanel'
import { COVER_TYPES } from '@/lib/covers'
import { GROUND_TOOLS } from '@/lib/groundworks'
import YardLayer, { yardLegendHeight, yardToolLabel } from './YardLayer'
import { PihaTerraceLevels } from './YardPanel'
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
  addCover,
  addGroundDraw,
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
  hasYard,
  sceneBounds,
  siteViewLayout,
  snapYardPoint,
  syncYardServices,
  updateYardItem,
} from '@/lib/yard'
import {
  PLACEABLES,
  addServiceRun,
  deleteServiceNode,
  deleteServiceRun,
  acceptEquipment,
  autoRoute,
  suggestEquipment,
  assignDeviceCircuit,
  commitRunGeometry,
  dragServiceRun,
  refreshHeat,
  buildElectricPdf,
  buildHydronicPdf,
  buildServicePdf,
  SERVICE_SYSTEMS,
  ensureServices,
  hitService,
  layerVisible,
  roomKind,
  setServiceLayer,
  removeAutoAdded,
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
import { pointAtLength, shouldCloseChain, snapAlongWall, snapFixturePoint, snapPoint, snapRadius, wallHeadings } from '@/lib/snap'
import { WORKSPACES, applyWorkspaceSwitch, workspaceAllows, workspaceSystems } from '@/lib/workspaces'
import { FIT_CAMERA, fitRect, panBy, wheelZoomFactor, zoomAt, zoomPercent } from '@/lib/zoom'
import { LanguageSwitch, usePlanLocale } from '@/components/i18n/Locale'
import { wallBearing } from '@/lib/orientation'
import { text } from '@/lib/i18n'

const HouseScene = dynamic(() => import('./HouseScene'), { ssr: false })

const sideBtn = (active) => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  textAlign: 'left',
  padding: '7px 8px',
  borderRadius: 8,
  border: active ? '1px solid #c2410c' : '1px solid transparent',
  background: active ? '#fff7ed' : 'transparent',
  boxShadow: active ? 'inset 3px 0 0 #ea580c' : 'none',
  color: '#1c1917',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transform: 'none',
})

function deviceColor(item) {
  if (item.system === 'iv') {
    if (item.role === 'poisto' || item.kind === 'hood' || item.kind === 'exhaust-terminal') return '#ca8a04'
    if (item.role === 'ulko' || item.kind === 'outdoor-terminal') return '#2563eb'
    if (item.role === 'jate') return '#166534'
    return '#dc2626'
  }
  if (item.system === 'electric') return '#1c1917'
  if (item.system === 'water') return '#1d4ed8'
  if (item.system === 'drain') return '#57534e'
  if (item.system === 'heat') return '#d97706'
  return '#44403c'
}

function DeviceMark({ item }) {
  const color = deviceColor(item)
  const down = item.role === 'poisto' || item.kind === 'hood' || item.kind === 'exhaust-terminal'
  const boxed = item.kind === 'ahu' || item.kind === 'panel' || item.kind === 'manifold' || item.kind === 'floor-manifold' || item.kind === 'dhw-tank' || item.kind === 'heat-source'
  return (
    <svg data-testid="device-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: '0 0 auto' }}>
      {item.kind === 'valve' || item.kind === 'hood' ? (
        <>
          <circle cx="8" cy="8" r="5.2" fill="none" stroke={color} strokeWidth="1.4" />
          <path d={down ? 'M8 11.2 L4.8 5.6 H11.2 Z' : 'M8 4.8 L11.2 10.4 H4.8 Z'} fill={color} />
        </>
      ) : boxed ? (
        <rect x="2.4" y="3.4" width="11.2" height="9.2" rx="1.6" fill="none" stroke={color} strokeWidth="1.5" />
      ) : (
        <circle cx="8" cy="8" r="4.2" fill={color} />
      )}
    </svg>
  )
}

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
  const accent = '#ea580c'
  const label = snap.label || ''
  const onWall = snap.kind === 'perpendicular' || snap.kind === 'face'
  return (
    <g data-testid="snap-indicator" data-kind={snap.kind} style={{ pointerEvents: 'none' }}>
      {(snap.guides || []).map((guide, index) => (
        <g key={`${guide.x1}-${guide.z1}-${index}`}>
          <line
            x1={X(guide.x1)}
            y1={Y(guide.z1)}
            x2={X(guide.x2)}
            y2={Y(guide.z2)}
            stroke="#fff"
            strokeWidth={5 * s}
            strokeLinecap="butt"
          />
          <line
            data-testid="align-guide"
            x1={X(guide.x1)}
            y1={Y(guide.z1)}
            x2={X(guide.x2)}
            y2={Y(guide.z2)}
            stroke={accent}
            strokeWidth={2 * s}
            strokeDasharray={`${9 * s} ${5 * s}`}
          />
        </g>
      ))}
      <g transform={`translate(${X(snap.point.x)} ${Y(snap.point.z)}) scale(${s})`}>
        <circle r={11} fill="#fff" stroke="#fff" strokeWidth={2} />
        {snap.kind === 'corner' && <rect data-testid="snap-corner" x={-6} y={-6} width={12} height={12} fill="#fff7ed" stroke={accent} strokeWidth={2} />}
        {snap.kind === 'midpoint' && <polygon data-testid="snap-midpoint" points="0,-8 7,6 -7,6" fill="#fff7ed" stroke={accent} strokeWidth={2} />}
        {onWall && <path data-testid="snap-perpendicular" d="M-8 4 H4 V-8" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="square" />}
        {snap.kind === 'intersection' && (
          <g data-testid="snap-intersection" stroke={accent} strokeWidth={2} strokeLinecap="square">
            <line x1="-6" y1="-6" x2="6" y2="6" />
            <line x1="-6" y1="6" x2="6" y2="-6" />
          </g>
        )}
        {snap.kind !== 'corner' && snap.kind !== 'midpoint' && !onWall && snap.kind !== 'intersection' && (
          <circle r={6} fill="#fff7ed" stroke={accent} strokeWidth={2} />
        )}
        {label && (
          <g data-testid="snap-tooltip" transform="translate(14 -22)">
            <rect x="0" y="-12" width={label.length * 7.2 + 12} height="18" rx="3" fill="#fff" stroke={accent} strokeWidth="2" />
            <text x="6" y="1" fontSize="12" fontWeight="700" fill="#9a3412">{label}</text>
          </g>
        )}
      </g>
    </g>
  )
}

function yardPlacesOne(id) {
  if (!id) return false
  if (id.startsWith('plant:') || id.startsWith('object:') || id.startsWith('building:')) return true
  if (id.startsWith('ground:')) return GROUND_TOOLS.find((item) => item.id === id.slice(7))?.mode === 'point'
  return false
}

const TOOL_LABELS = {
  exterior: 'Ulkoseinä',
  interior: 'Väliseinä',
  door: 'Ovi',
  window: 'Ikkuna',
  room: 'Huone',
  detect: 'Tunnista huone',
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

function cameraForBuilding(plan, mode, viewport) {
  const w = Math.max(80, viewport?.w || 0)
  const h = Math.max(80, viewport?.h || 0)
  const bounds = mode === 'site' && hasYard(plan) ? sceneBounds(plan) : planBounds(plan)
  const spanX = (bounds?.maxX || 0) - (bounds?.minX || 0)
  const spanZ = (bounds?.maxZ || 0) - (bounds?.minZ || 0)
  if (!Number.isFinite(spanX) || !Number.isFinite(spanZ) || (spanX < 0.2 && spanZ < 0.2)) return FIT_CAMERA
  const padM = 0.55
  const box = {
    minX: bounds.minX - padM,
    maxX: bounds.maxX + padM,
    minZ: bounds.minZ - padM,
    maxZ: bounds.maxZ + padM,
  }
  const sheet = sheetPixels({ w, h }, plan, mode === 'site')
  const { layout, k } = sheet
  const Xb = (x) => sheet.x + (layout.ox + (x - layout.box.minX) * layout.scale) * k
  const Yb = (z) => sheet.y + (layout.oy + (z - layout.box.minZ) * layout.scale) * k
  const left = Math.min(Xb(box.minX), Xb(box.maxX))
  const right = Math.max(Xb(box.minX), Xb(box.maxX))
  const top = Math.min(Yb(box.minZ), Yb(box.maxZ))
  const bottom = Math.max(Yb(box.minZ), Yb(box.maxZ))
  if (right - left < 8 || bottom - top < 8) return FIT_CAMERA
  return fitRect({ left, top, right, bottom }, { w, h }, 28)
}

function SheetRoomLabel({ label, X, Y, nameSize, areaSize }) {
  const cx = X(label.x)
  const cy = Y(label.z)
  const name = label.text || ''
  const area = label.area || ''
  const leading = Math.max(nameSize || 0, areaSize || 0) * LINE_LEADING
  const nameY = name && area ? cy - leading / 2 + nameSize * 0.15 : cy + (nameSize || areaSize) * 0.15
  const areaY = name ? nameY + leading : cy + areaSize * 0.15
  const ink = label.halo ? '#fbfaf7' : 'none'
  const haloW = label.halo ? Math.max(1.1, nameSize * 0.28) : 0
  return (
    <>
      {label.leader && (
        <line data-testid="room-leader" x1={X(label.leader.x)} y1={Y(label.leader.z)} x2={cx} y2={cy} stroke="#78716c" strokeWidth={0.7} />
      )}
      {name && (
        <text x={cx} y={nameY} textAnchor="middle" fontSize={nameSize} fontWeight={700} fill="#1c1917" stroke={ink} strokeWidth={haloW} strokeLinejoin="round" paintOrder="stroke">{name}</text>
      )}
      {area && (
        <text x={cx} y={areaY} textAnchor="middle" fontSize={areaSize} fill="#57534e" stroke={ink} strokeWidth={haloW} strokeLinejoin="round" paintOrder="stroke">{area}</text>
      )}
    </>
  )
}

function DimLine({ dim, X, Y, zoom }) {
  const view = Math.max(0.2, zoom || 1)
  const fontSize = dimensionFont(view)
  const stroke = 1 / view
  const thin = 0.8 / view
  const off = Number.isFinite(dim.offset) ? dim.offset : 0
  const x1 = X(dim.x1 + (dim.nx || 0) * off)
  const y1 = Y(dim.z1 + (dim.nz || 0) * off)
  const x2 = X(dim.x2 + (dim.nx || 0) * off)
  const y2 = Y(dim.z2 + (dim.nz || 0) * off)
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const place = placeDimensionText(len, dim.label, fontSize)
  const tick = Math.max(4 / view, fontSize * 0.42)
  const tx = (ux - uy) * tick * 0.7
  const ty = (uy + ux) * tick * 0.7
  let px = -uy
  let py = ux
  const midWorldX = (dim.x1 + dim.x2) / 2
  const midWorldZ = (dim.z1 + dim.z2) / 2
  const ox = X(midWorldX + (dim.nx || 0)) - X(midWorldX)
  const oy = Y(midWorldZ + (dim.nz || 0)) - Y(midWorldZ)
  if (Math.hypot(dim.nx || 0, dim.nz || 0) > 0.2) {
    if (px * ox + py * oy < 0) { px = -px; py = -py }
  } else if (py > 0) {
    px = -px
    py = -py
  }
  const label = String(dim.label ?? '')
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  let labelX = midX
  let labelY = midY
  let leader = null
  const lift = Number(dim.lift) || 0
  let gap = place.mode === 'gap' && lift < 0.5 ? place.gap : 0
  if (place.mode === 'leader') {
    const rise = fontSize * 1.25 + lift
    const extra = place.textW / 2 + fontSize * 0.35
    labelX = x2 + ux * extra + px * rise
    labelY = y2 + uy * extra + py * rise
    leader = {
      x1: x2,
      y1: y2,
      x2: labelX - ux * (place.textW / 2 + fontSize * 0.15) - px * fontSize * 0.2,
      y2: labelY - uy * (place.textW / 2 + fontSize * 0.15) - py * fontSize * 0.2,
    }
  } else if (lift >= 0.5) {
    labelX = midX + px * (lift + fontSize * 0.15)
    labelY = midY + py * (lift + fontSize * 0.15)
    leader = {
      x1: midX,
      y1: midY,
      x2: labelX - px * fontSize * 0.55,
      y2: labelY - py * fontSize * 0.55,
    }
    gap = 0
  }
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
  const rot = vertical ? `rotate(${dimensionRotation(true)} ${labelX} ${labelY})` : null
  const haloW = place.textW + fontSize * 0.7
  const haloH = fontSize * 1.45
  const ax1 = X(dim.ax ?? dim.x1)
  const ay1 = Y(dim.az ?? dim.z1)
  const ax2 = X(dim.bx ?? dim.x2)
  const ay2 = Y(dim.bz ?? dim.z2)
  const gapLine = (sx, sy, ex, ey) => {
    const dx = ex - sx
    const dy = ey - sy
    const span = Math.hypot(dx, dy) || 1
    const inset = Math.min(fontSize * 0.55, span * 0.35)
    return { x1: sx + (dx / span) * inset, y1: sy + (dy / span) * inset, x2: ex, y2: ey }
  }
  const ext1 = gapLine(ax1, ay1, x1, y1)
  const ext2 = gapLine(ax2, ay2, x2, y2)
  const breakX = x1 + (x2 - x1) * 0.5
  const breakY = y1 + (y2 - y1) * 0.5
  return (
    <g data-testid={`dim-${dim.kind || 'dim'}`} data-label={dim.label} data-place={place.mode} fill="#292524">
      {Math.hypot(ax1 - x1, ay1 - y1) > 4 / view && <line x1={ext1.x1} y1={ext1.y1} x2={ext1.x2} y2={ext1.y2} stroke="#a8a29e" strokeWidth={thin} />}
      {Math.hypot(ax2 - x2, ay2 - y2) > 4 / view && <line x1={ext2.x1} y1={ext2.y1} x2={ext2.x2} y2={ext2.y2} stroke="#a8a29e" strokeWidth={thin} />}
      <line x1={x1} y1={y1} x2={breakX - ux * gap / 2} y2={breakY - uy * gap / 2} stroke="#44403c" strokeWidth={stroke} />
      <line x1={breakX + ux * gap / 2} y1={breakY + uy * gap / 2} x2={x2} y2={y2} stroke="#44403c" strokeWidth={stroke} />
      <line x1={x1 - tx} y1={y1 - ty} x2={x1 + tx} y2={y1 + ty} stroke="#44403c" strokeWidth={stroke} />
      <line x1={x2 - tx} y1={y2 - ty} x2={x2 + tx} y2={y2 + ty} stroke="#44403c" strokeWidth={stroke} />
      {leader && <line data-testid="dim-leader" x1={leader.x1} y1={leader.y1} x2={leader.x2} y2={leader.y2} stroke="#44403c" strokeWidth={thin} />}
      <g transform={rot || undefined}>
        <rect data-testid="dim-halo" x={labelX - haloW / 2} y={labelY - haloH / 2} width={haloW} height={haloH} fill="#fbfaf7" stroke="none" />
        <text
          data-testid="dim-text"
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight={600}
          fill="#292524"
          stroke="none"
        >
          {label}
        </text>
      </g>
    </g>
  )
}

function stackDimensionLabels(dims, X, Y, zoom) {
  const view = Math.max(0.2, zoom || 1)
  const font = dimensionFont(view)
  const boxes = []
  const hits = (box) => boxes.some((item) => (
    item.x < box.x + box.w && item.x + item.w > box.x && item.y < box.y + box.h && item.y + item.h > box.y
  ))
  return (dims || []).map((dim) => {
    const off = Number.isFinite(dim.offset) ? dim.offset : 0
    const x1 = X(dim.x1 + (dim.nx || 0) * off)
    const y1 = Y(dim.z1 + (dim.nz || 0) * off)
    const x2 = X(dim.x2 + (dim.nx || 0) * off)
    const y2 = Y(dim.z2 + (dim.nz || 0) * off)
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    const ux = (x2 - x1) / len
    const uy = (y2 - y1) / len
    let px = -uy
    let py = ux
    const mx = (dim.x1 + dim.x2) / 2
    const mz = (dim.z1 + dim.z2) / 2
    const ox = X(mx + (dim.nx || 0)) - X(mx)
    const oy = Y(mz + (dim.nz || 0)) - Y(mz)
    if (Math.hypot(dim.nx || 0, dim.nz || 0) > 0.2) {
      if (px * ox + py * oy < 0) { px = -px; py = -py }
    } else if (py > 0) { px = -px; py = -py }
    const place = placeDimensionText(len, dim.label, font)
    const textW = place.textW
    let lift = 0
    let box = { x: 0, y: 0, w: textW, h: font * 1.4 }
    for (let step = 0; step < 6; step += 1) {
      lift = step * font * 1.2
      const along = place.mode === 'leader' ? 1 : 0.5
      const extra = place.mode === 'leader' ? textW / 2 + font * 0.35 : 0
      const rise = (place.mode === 'leader' ? font * 1.25 : 0) + lift
      const cx = x1 + (x2 - x1) * along + ux * extra + px * rise
      const cy = y1 + (y2 - y1) * along + uy * extra + py * rise
      const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
      const bw = vertical ? font * 1.4 : textW
      const bh = vertical ? textW : font * 1.4
      box = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh }
      if (!hits(box)) break
    }
    boxes.push(box)
    return lift > 0.5 ? { ...dim, lift } : dim
  })
}

function worldPath(points, X, Y) {
  if (!points?.length) return ''
  return `${points.map((point, index) => `${index ? 'L' : 'M'}${X(point.x)} ${Y(point.z)}`).join(' ')} Z`
}

function faceInk(color) {
  const hex = String(color || '').replace('#', '')
  if (hex.length < 6) return color || '#44403c'
  return `#${hex.slice(0, 6)}`
}

function FaceLines({ plan, X, Y, selected, onSelect }) {
  return (
    <g data-testid="face-lines">
      {visibleRooms(plan).map((room) => (room.walls || []).map((edge, index) => {
        const wall = (plan.walls || []).find((item) => item.id === edge.wallId)
        const side = wall ? faceSide(wall, edge.a, edge.b) : 'left'
        const material = wall ? resolveFaceMaterial(plan, wall, side) : (room.interiorId || 'paint')
        const color = materialOf('interior', material).color
        const a0 = room.polygon?.[index]
        const b0 = room.polygon?.[(index + 1) % (room.polygon?.length || 1)]
        if (!a0 || !b0) return null
        const midX = (a0.x + b0.x) / 2
        const midZ = (a0.z + b0.z) / 2
        const edx = b0.x - a0.x
        const edz = b0.z - a0.z
        const elen = Math.hypot(edx, edz) || 1
        let ox = -edz / elen
        let oz = edx / elen
        const poly = room.polygon || []
        const cx = poly.reduce((sum, point) => sum + point.x, 0) / (poly.length || 1)
        const cz = poly.reduce((sum, point) => sum + point.z, 0) / (poly.length || 1)
        if ((cx - midX) * ox + (cz - midZ) * oz < 0) { ox = -ox; oz = -oz }
        const shift = 0.012
        const a = { x: a0.x + ox * shift, z: a0.z + oz * shift }
        const b = { x: b0.x + ox * shift, z: b0.z + oz * shift }
        const active = selected?.id === room.id && selected?.wallId === edge.wallId
        const hatch = material === 'tile' ? '2 1.6' : material === 'panel' ? '7 2' : material === 'gypsum' || material === 'wallpaper' ? '4 2.5' : undefined
        return (
          <line
            key={`${room.id}-${index}`}
            data-testid={`face-line-${room.id}-${index}`}
            data-material={material}
            x1={X(a.x)}
            y1={Y(a.z)}
            x2={X(b.x)}
            y2={Y(b.z)}
            stroke={active ? '#0f766e' : faceInk(color)}
            strokeWidth={active ? 1.8 : 0.55}
            strokeDasharray={hatch}
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

function selectionRibbon(wall, plan) {
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const len = Math.hypot(dx, dz) || 1
  const nx = -dz / len
  const nz = dx / len
  const offsets = faceOffsets(wall, thicknessOf(wall, plan))
  return [
    { x: wall.a.x + nx * offsets.left, z: wall.a.z + nz * offsets.left },
    { x: wall.b.x + nx * offsets.left, z: wall.b.z + nz * offsets.left },
    { x: wall.b.x + nx * offsets.right, z: wall.b.z + nz * offsets.right },
    { x: wall.a.x + nx * offsets.right, z: wall.a.z + nz * offsets.right },
  ]
}

function WallOutlines({ plan, X, Y, selectedIds = [], simple = false, zoom = 1 }) {
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
      {paint(figures.exterior, simple ? '#1c1917' : 'url(#poche)')}
      {!simple && paint(figures.interior, '#e7e5e4')}
      {!simple && paint(figures.insulation, 'rgba(214,211,209,0.9)')}
      {!simple && paint(figures.cladding, claddingOf(plan.exteriorId).color)}
      {!simple && walls.map((wall) => {
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
                  stroke="none"
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
      {walls.filter((wall) => selectedIds.includes(wall.id)).map((wall) => (
        <polygon
          key={`sel-${wall.id}`}
          data-testid="wall-selection"
          points={selectionRibbon(wall, plan).map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')}
          fill="rgba(15,118,110,0.18)"
          stroke="#0f766e"
          strokeWidth={2 / Math.max(zoom || 1, 0.2)}
        />
      ))}
      {walls.map((wall) => (
        <line
          key={`axis-${wall.id}`}
          data-testid="wall-axis"
          data-wall={wall.id}
          data-kind={wall.kind}
          data-thickness={thicknessOf(wall, plan)}
          data-structure={wall.structureId || ''}
          data-ax={wall.a.x}
          data-az={wall.a.z}
          data-bx={wall.b.x}
          data-bz={wall.b.z}
          data-compass={wall.kind === 'interior' ? '' : wallBearing(plan, wall).code}
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
  const { locale, setLocale, t, num } = usePlanLocale(plan)
  const [hydrated, setHydrated] = useState(false)
  const [ready, setReady] = useState(false)
  const [startOpen, setStartOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [library, setLibrary] = useState(() => ({ projects: [] }))
  const [hover, setHover] = useState(null)
  const [tool, setTool] = useState('select')
  const [doorHand, setDoorHand] = useState({ swing: 1, inward: false })
  const [placing, setPlacing] = useState(null)
  const [repeatPlace, setRepeatPlace] = useState(false)
  const [toast, setToast] = useState('')
  const [flashId, setFlashId] = useState(null)
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
  const [workspace, setWorkspace] = useState('rakenne')
  const [ghosts, setGhosts] = useState([])
  const [fixtureGroup, setFixtureGroup] = useState('Kaikki')
  const [displayOpen, setDisplayOpen] = useState(false)
  const [showClearances, setShowClearances] = useState(false)
  const [layersOpen, setLayersOpen] = useState(true)
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
  const [typedLen, setTypedLen] = useState('')
  const [chainStart, setChainStart] = useState(null)
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
  const dragCorner = useRef(null)
  const northDrag = useRef(null)
  const clip = useRef(null)
  const hostRef = useRef(null)
  const svgRef = useRef(null)
  const panRef = useRef(null)
  const dragGrab = useRef(null)
  const spaceRef = useRef(false)
  const lastPlace = useRef(null)
  const toastTimer = useRef(0)
  const flashTimer = useRef(0)
  const fitRequest = useRef({ plan: null, mode: 'plan', token: 0 })
  const fittedToken = useRef(null)
  const [fitTick, setFitTick] = useState(0)
  const endDrawingRef = useRef(() => {})
  const suppressMenu = useRef(false)
  const altRef = useRef(false)
  altRef.current = altDown
  const shiftRef = useRef(false)
  const chainRef = useRef(null)
  const typedRef = useRef('')
  const draftRef = useRef(null)
  const liveRef = useRef(null)
  const commitWallRef = useRef(() => {})

  useEffect(() => {
    if (hydrated && plan.locale) setLocale(plan.locale)
  }, [hydrated, plan.locale, setLocale])

  useEffect(() => {
    const storedLibrary = loadLibrary(window.localStorage.getItem(LIBRARY_KEY))
    setLibrary(storedLibrary)
    try {
      const raw = window.localStorage.getItem(CURRENT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.walls)) {
          const loaded = {
            ...emptyPlan(),
            ...parsed,
            services: ensureServices(parsed),
            yard: ensureYard(parsed),
            rooms: detectRooms(parsed.walls, parsed.rooms || []),
          }
          setPlan(straightenWalls(loaded, 0.5))
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

  const exitToSelect = useCallback(() => {
    setTool('select')
    setPlacing(null)
    setSvcTool(null)
    setYardTool(null)
    setDraft(null)
    setPoly([])
    setSvcPoints([])
    setYardPoints([])
    setDrawGuide(null)
    chainRef.current = null
    setChainStart(null)
    typedRef.current = ''
    setTypedLen('')
    setRedrawId(null)
  }, [])

  const showToast = useCallback((text) => {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  const requestFit = useCallback((nextPlan, mode) => {
    const token = fitRequest.current.token + 1
    fitRequest.current = { plan: nextPlan, mode: mode === 'site' ? 'site' : 'plan', token }
    setFitTick(token)
  }, [])

  useEffect(() => {
    if (!ready || view !== '2d') return
    const node = hostRef.current
    if (!node || node.clientWidth < 80 || node.clientHeight < 80) return
    const w = Math.max(320, Math.round(node.clientWidth))
    const h = Math.max(240, Math.round(node.clientHeight))
    if (Math.abs(size.w - w) > 2 || Math.abs(size.h - h) > 2) {
      setSize({ w, h })
      return
    }
    const req = fitRequest.current
    if (fittedToken.current != null && fittedToken.current === req.token) return
    fittedToken.current = req.token
    setCamera(cameraForBuilding(req.plan || plan, req.plan ? req.mode : sheetMode, { w, h }))
  }, [ready, view, fitTick, size, plan, sheetMode])

  const flashItem = useCallback((id) => {
    setFlashId(id || null)
    window.clearTimeout(flashTimer.current)
    if (id) flashTimer.current = window.setTimeout(() => setFlashId(null), 900)
  }, [])

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
    const radius = snapRadius(ppm || ppm2d, 14)
    const enabled = !altRef.current
    const walls = plan.walls || []
    const freeAngle = shiftRef.current
    if (svcTool) return null
    if (tool === 'exterior' || tool === 'interior') {
      const origin = draft
      return snapPoint(world, {
        walls,
        grid: gridStep,
        radius,
        origin,
        headings: wallHeadings(origin, walls),
        extraPoints: chainStart && origin ? [chainStart] : [],
        polarAperture: freeAngle ? null : (7 * Math.PI) / 180,
        freeAngle,
        joinWalls: true,
        enabled,
      })
    }
    if (tool === 'room') {
      const origin = roomShape === 'poly' ? poly[poly.length - 1] : draft
      return snapPoint(world, {
        walls,
        grid: gridStep,
        radius,
        origin: origin || null,
        headings: wallHeadings(origin, walls),
        polarAperture: freeAngle ? null : (7 * Math.PI) / 180,
        freeAngle,
        joinWalls: true,
        enabled,
      })
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
      return snapYardPoint(world, plan, { grid: gridStep, radius, origin, ortho: angleStep === 90 && !shiftRef.current && Boolean(origin) })
    }
    return null
  }, [ppm2d, plan, tool, draft, angleStep, gridStep, roomShape, poly, placing, svcTool, yardTool, yardPoints, chainStart])

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
      : {
        kind: hit.kind,
        id: hit.id || hit.kind,
        collection: hit.collection,
        side: hit.side,
        u0: hit.u0,
        u1: hit.u1,
        y0: hit.y0,
        y1: hit.y1,
        materialId: hit.materialId,
        zoneId: hit.zoneId,
      }
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
    if (name === 'mirror' && selected.length > 0 && selected.every((item) => item.kind === 'opening')) {
      const direction = Boolean(extra && typeof extra === 'object' && (extra.shiftKey || extra.shift))
      commit(mirrorOpenings(plan, selected, { direction }))
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
    const placingOne = Boolean(placing || svcTool === 'node' || tool === 'door' || tool === 'window' || yardPlacesOne(yardTool))
    const drawing = Boolean(tool === 'exterior' || tool === 'interior' || tool === 'room' || tool === 'detect' || svcTool === 'run' || (yardTool && !yardPlacesOne(yardTool)))
    if (placingOne) {
      event.preventDefault()
      exitToSelect()
      return
    }
    if (drawing) {
      event.preventDefault()
      setMenu({ x: event.clientX, y: event.clientY, kind: 'tool' })
      return
    }
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
      const face = point.point ? facadeHitFromWorld(plan, point.point) : null
      setMenu({
        x: event.clientX,
        y: event.clientY,
        kind: point.kind,
        id: point.id || point.kind,
        collection: point.collection,
        at: point.at,
        side: point.side || face?.side,
        u0: point.u0,
        u1: point.u1,
        y0: point.y0,
        y1: point.y1,
        materialId: point.materialId,
        zoneId: point.zoneId,
        u: face?.u,
        y: face?.y ?? point.point?.y,
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
    if (typedRef.current && draft && (tool === 'exterior' || tool === 'interior')) {
      const mm = Number(typedRef.current)
      const toward = visual?.point || world
      if (mm >= 50) setDrawGuide(pointAtLength(draft, toward, mm))
    } else if (!typingDraw) setDrawGuide(null)
    const radius = Math.max(12 / Math.max(ppm2d, 0.001), 0.45)
    if (dragCorner.current) {
      const snap = altRef.current
        ? { point: world }
        : snapPoint(world, { walls: plan.walls, grid: gridStep, radius: snapRadius(ppm2d, 14), enabled: true, ignore: dragCorner.current.from })
      const to = snap.point
      if (Math.hypot(to.x - dragCorner.current.from.x, to.z - dragCorner.current.from.z) > 0.001) {
        dragCorner.current.moved = true
        const from = dragCorner.current.from
        dragCorner.current.from = { x: to.x, z: to.z }
        setPlan((current) => moveCorner(current, from, to))
      }
    }
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
    const movedCorner = dragCorner.current?.moved
    if ((dragId.current || dragLabel.current || dragOpen.current || movedYard || movedRoute || movedNode || movedCorner) && dragBefore.current) history.current = [...history.current, dragBefore.current].slice(-40)
    dragId.current = null
    dragCorner.current = null
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
    const placingOne = Boolean(placing || svcTool === 'node' || tool === 'door' || tool === 'window' || yardPlacesOne(yardTool))
    const drawing = Boolean(tool === 'exterior' || tool === 'interior' || tool === 'room' || tool === 'detect' || svcTool === 'run' || (yardTool && !yardPlacesOne(yardTool)))
    if (placingOne) {
      event.preventDefault()
      event.stopPropagation()
      exitToSelect()
      return
    }
    if (drawing) {
      event.preventDefault()
      event.stopPropagation()
      setMenu({ x: event.clientX, y: event.clientY, kind: 'tool' })
      return
    }
    if (suppressMenu.current) {
      event.preventDefault()
      suppressMenu.current = false
      return
    }
    event.preventDefault()
    const world = toWorld(event)
    const joint = cornerJoint(plan.walls, world, Math.max(0.32, 18 / Math.max(ppm2d, 0.001)))
    if (joint && workspace === 'rakenne') {
      setMenu({ x: event.clientX, y: event.clientY, kind: 'corner', id: 'corner', at: { x: joint.x, z: joint.z } })
      return
    }
    const serviceHit = hitService(plan, world)
    if (serviceHit && workspaceAllows(workspace, serviceHit)) {
      openServiceMenu(event, serviceHit)
      return
    }
    const hit = hitTest(plan, world)
    const yardHit = sheetMode === 'site' ? hitTestYard(plan, world, Math.max(0.28, 12 / Math.max(ppm2d, 0.001))) : null
    if (workspace === 'piha' && hit.kind !== 'opening' && hit.kind !== 'wall' && yardHit && (yardHit.collection !== 'plot' || hit.kind === 'canvas')) {
      setMenu({ x: event.clientX, y: event.clientY, kind: 'yard', id: yardHit.id, collection: yardHit.collection, at: world })
      choose(yardHit)
      return
    }
    if (!workspaceAllows(workspace, hit)) return
    setMenu({ x: event.clientX, y: event.clientY, kind: hit.kind, id: hit.id, at: world })
    if (hit.kind !== 'canvas') choose(hit)
  }

  const finishYard = (points) => {
    if (!yardTool) return
    let next = plan
    if (yardTool === 'plot') next = setPlot(plan, points)
    else if (yardTool === 'terrace') next = addTerrace(plan, points)
    else if (yardTool === 'lawn' || yardTool === 'flowerbed') next = addBed(plan, points, yardTool)
    else if (yardTool === 'path' || yardTool === 'drive' || yardTool === 'parking') next = addPath(plan, points, { kind: yardTool })
    else if (yardTool === 'fence') next = addFence(plan, points, {})
    else if (yardTool.startsWith('cover:')) next = addCover(plan, points, { kind: yardTool.slice(6) })
    else if (yardTool.startsWith('ground:')) next = addGroundDraw(plan, yardTool.slice(7), points)
    else return
    commit(next)
    setYardPoints([])
  }

  const placeAt = (world, ppm, gesture = null) => {
    const stamp = gesture || { at: Date.now(), px: NaN, py: NaN, shift: false }
    const visual = describeSnap(world, ppm)
    const point = visual?.point || world
    const keep = Boolean(stamp.shift || repeatPlace)
    const blocked = (items, candidate, keyFn, onHit) => {
      const verdict = judgePlacement({ items, candidate, last: lastPlace.current, gesture: stamp, key: keyFn })
      if (verdict.action === 'ignore') return true
      if (verdict.action === 'duplicate') {
        lastPlace.current = stamp
        showToast(`${candidate.name || 'Kohde'} on jo tässä`)
        flashItem(verdict.existing?.id)
        onHit?.(verdict.existing)
        return true
      }
      lastPlace.current = stamp
      return false
    }
    const finishSingle = () => { if (!keep) exitToSelect() }
    if (yardTool) {
      if (yardTool.startsWith('plant:') || yardTool.startsWith('object:') || yardTool.startsWith('building:')) {
        const kind = yardTool.startsWith('plant:') ? yardTool.slice(6) : yardTool.startsWith('object:') ? yardTool.slice(7) : yardTool.slice(9)
        const collection = yardTool.startsWith('plant:') ? 'plants' : yardTool.startsWith('object:') ? 'objects' : 'buildings'
        const list = ensureYard(plan)[collection] || []
        const name = yardTool.startsWith('plant:') ? (PLANTS.find((item) => item.id === kind)?.name || 'Kasvi') : yardTool.startsWith('object:') ? (OBJECTS.find((item) => item.id === kind)?.name || 'Kaluste') : (BUILDINGS.find((item) => item.id === kind)?.name || 'Rakennus')
        if (blocked(list, { kind, x: point.x, z: point.z, name }, (item) => item.kind, (existing) => choose({ kind: 'yard', id: existing.id, collection }))) return
        const next = yardTool.startsWith('plant:') ? addPlant(plan, kind, point.x, point.z) : yardTool.startsWith('object:') ? addObject(plan, kind, point.x, point.z) : addBuilding(plan, kind, point.x, point.z)
        commit(next)
        const created = (ensureYard(next)[collection] || []).slice(-1)[0]
        if (created) choose({ kind: 'yard', id: created.id, collection })
        finishSingle()
        return
      }
      if (yardTool.startsWith('ground:')) {
        const spec = GROUND_TOOLS.find((item) => item.id === yardTool.slice(7))
        if (spec?.mode === 'point') {
          commit(addGroundDraw(plan, spec.id, [point]))
          finishSingle()
          return
        }
      }
      const groundMode = yardTool.startsWith('ground:') ? GROUND_TOOLS.find((item) => item.id === yardTool.slice(7))?.mode : ''
      const closed = yardTool === 'plot' || yardTool === 'terrace' || yardTool === 'lawn' || yardTool === 'flowerbed' || yardTool.startsWith('cover:') || groundMode === 'area'
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
        const node = {
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
        }
        const result = placeServiceNode(plan, node, stamp, lastPlace.current)
        if (!result.placed) {
          if (result.verdict.action === 'duplicate') {
            lastPlace.current = stamp
            showToast(`${spec.name || 'Kohde'} on jo tässä`)
            flashItem(result.verdict.existing?.id)
            if (result.verdict.existing) choose({ kind: 'service', service: { target: 'node', id: result.verdict.existing.id, system: result.verdict.existing.system } })
          }
          return
        }
        lastPlace.current = result.last
        commit(result.plan)
        if (result.created) choose({ kind: 'service', service: { target: 'node', id: result.created.id, system: result.created.system } })
        finishSingle()
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
      if (!draft) {
        chainRef.current = { start: next, count: 0 }
        setChainStart(next)
        setDraft(next)
        typedRef.current = ''
        setTypedLen('')
        return
      }
      commitWallRef.current(draft, next)
      return
    }
    if (tool === 'door' || tool === 'window') {
      const along = visual?.wall ? visual : snapAlongWall(world, plan.walls, Math.max(12 / Math.max(ppm, 0.001), 0.35), !altRef.current)
      if (!along?.wall) return
      if (blocked([], { name: tool === 'door' ? 'Ovi' : 'Ikkuna', x: 0, z: 0 }, () => 'opening')) return
      const before = (plan.openings || []).length
      const next = refreshHeat(addOpening(plan, along.wall.id, along.point || point, tool, tool === 'door' ? doorHand : {}))
      if ((next.openings || []).length === before) {
        showToast(`${tool === 'door' ? 'Ovi' : 'Ikkuna'} on jo tässä`)
        return
      }
      commit(next)
      const created = next.openings[next.openings.length - 1]
      if (created) choose({ kind: 'opening', id: created.id })
      finishSingle()
      return
    }
    if (placing) {
      const radius = Math.max(12 / Math.max(ppm, 0.001), 0.45)
      const drafted = addFixture(plan, placing, point.x, point.z, radius)
      const created = addedFixture(plan, drafted, placing)
      const spec = FIXTURES.find((item) => item.id === placing)
      if (!created) return
      if (blocked(plan.fixtures || [], { ...created, name: spec?.name || 'Kaluste' }, fixtureKey, (existing) => {
        setSelectedFixture(existing.id)
        setPick({ kind: 'fixture', id: existing.id })
      })) return
      commit(drafted)
      setSelectedFixture(created.id)
      setPick({ kind: 'fixture', id: created.id })
      setPanel('object')
      finishSingle()
    }
  }

  commitWallRef.current = (start, end) => {
    const chain = chainRef.current || (chainStart ? { start: chainStart, count: 0 } : null)
    const closing = shouldCloseChain(chain, end)
    const target = closing ? chain.start : end
    if (!start || !target || segmentLength(start, target) <= 0.05) {
      if (closing) {
        chainRef.current = null
        setChainStart(null)
        setDraft(null)
      }
      return
    }
    commit(refreshHeat(addWall(plan, start, target, tool)))
    setDrawGuide(null)
    typedRef.current = ''
    setTypedLen('')
    if (closing) {
      chainRef.current = null
      setChainStart(null)
      setDraft(null)
      return
    }
    chainRef.current = { start: chain?.start || start, count: (chain?.count || 0) + 1 }
    setDraft(target)
  }

  endDrawingRef.current = (world) => {
    if ((tool === 'exterior' || tool === 'interior') && draft) {
      const end = drawGuide || snapVisual?.point || world
      if (end && segmentLength(draft, end) > 0.05) commitWallRef.current(draft, end)
      else {
        chainRef.current = null
        setChainStart(null)
        setDraft(null)
      }
    } else if (tool === 'room' && roomShape === 'poly' && poly.length >= 3) {
      closeRoom(poly)
    } else if (tool === 'room' && draft && world) {
      closeRoom([
        draft,
        { x: world.x, z: draft.z },
        world,
        { x: draft.x, z: world.z },
      ])
    } else if (svcTool === 'run' && svcPoints.length >= 2) {
      finishServiceRun()
    } else if (yardTool && !yardPlacesOne(yardTool) && yardPoints.length >= 2) {
      finishYard(yardPoints)
    }
    exitToSelect()
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
      if (placing || svcTool || yardTool || tool !== 'select') return
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
      const drawing = tool === 'room' || tool === 'exterior' || tool === 'interior' || svcTool === 'run' || (yardTool && !yardPlacesOne(yardTool))
      if (event.detail >= 2 && drawing) {
        endDrawingRef.current(world)
        return
      }
      placeAt(world, ppm2d, { at: Date.now(), px: event.clientX, py: event.clientY, shift: event.shiftKey })
      return
    }
    let serviceHit = hitService(plan, world)
    if (serviceHit && !workspaceAllows(workspace, serviceHit)) serviceHit = null
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
    const yardHit = workspace === 'piha' && sheetMode === 'site' ? hitTestYard(plan, world, Math.max(0.28, 12 / Math.max(ppm2d, 0.001))) : null
    const corner = workspace === 'rakenne' ? nearestEndpoint(plan.walls, world, snapRadius(ppm2d, 14)) : null
    if (corner && !yardHit) {
      dragCorner.current = { from: { x: corner.x, z: corner.z }, moved: false }
      dragBefore.current = plan
      choose({ kind: 'corner', id: 'corner', at: { x: corner.x, z: corner.z } })
      return
    }
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
      if (!workspaceAllows(workspace, hit)) {
        pending.current = { x: world.x, z: world.z, hit: { kind: 'canvas' }, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, moved: false }
        return
      }
      dragOpen.current = hit.id
      dragBefore.current = plan
      choose(hit, { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey })
      return
    }
    if (!workspaceAllows(workspace, hit)) {
      pending.current = { x: world.x, z: world.z, hit: { kind: 'canvas' }, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, moved: false }
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
      if (event.key === 'Shift') {
        shiftRef.current = true
        return
      }
      const drawingWall = (tool === 'exterior' || tool === 'interior') && draftRef.current
      if (drawingWall && !event.ctrlKey && !event.metaKey && !event.altKey && (/^[0-9]$/.test(event.key) || event.key === '.' || event.key === ',')) {
        event.preventDefault()
        const next = `${typedRef.current}${event.key === ',' ? '.' : event.key}`.replace(/^0+(?=\d)/, '').slice(0, 7)
        typedRef.current = next
        setTypedLen(next)
        const mm = Number(next)
        const origin = draftRef.current
        const toward = liveRef.current
        if (origin && toward && Number.isFinite(mm) && mm >= 50) setDrawGuide(pointAtLength(origin, toward, mm))
        return
      }
      if (drawingWall && event.key === 'Backspace' && typedRef.current) {
        event.preventDefault()
        const next = typedRef.current.slice(0, -1)
        typedRef.current = next
        setTypedLen(next)
        if (!next) setDrawGuide(null)
        else if (draftRef.current && liveRef.current) setDrawGuide(pointAtLength(draftRef.current, liveRef.current, Number(next)))
        return
      }
      if (drawingWall && event.key === 'Enter' && typedRef.current) {
        event.preventDefault()
        const mm = Number(typedRef.current)
        const origin = draftRef.current
        const toward = liveRef.current || origin
        if (origin && toward && Number.isFinite(mm) && mm >= 50) commitWallRef.current(origin, pointAtLength(origin, toward, mm))
        return
      }
      const engaged = Boolean(placing || svcTool || yardTool || tool !== 'select')
      if (event.key === ' ' && !event.repeat) {
        event.preventDefault()
        if (engaged) exitToSelect()
        else spaceRef.current = true
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
        requestFit(plan, sheetMode)
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
        setGhosts([])
        exitToSelect()
        setMenu(null)
        setElectricView(null)
        setHeatView(null)
        if (!command) remember([])
      } else if (event.key === 'Enter' && command?.step === 'to') {
        confirmCommand(snappedPoint(cursor || command.base || { x: 0, z: 0 }))
      } else if (event.key === 'Enter' && engaged && !command) {
        event.preventDefault()
        endDrawingRef.current(cursor)
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
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'f' && !command && picks.length > 0 && picks.every((item) => item.kind === 'opening') && picks.every((item) => (plan.openings || []).find((opening) => opening.id === item.id)?.kind === 'door')) {
        event.preventDefault()
        commit(mirrorOpenings(plan, picks, { direction: Boolean(event.shiftKey) }))
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        if (engaged) exitToSelect()
        else if (!command && tool === 'select') setDisplayOpen((open) => !open)
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !command && tool === 'select') {
        const key = event.key.toLowerCase()
        const shortcut = { m: 'move', c: 'copy', e: 'rotate', s: 'scale', f: 'mirror', b: 'array', o: 'offset', t: 'stretch', n: 'align', d: 'measure' }[key]
        if (shortcut) beginCommand(shortcut, { shift: event.shiftKey })
      } else if ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        undo()
      }
    }
    const onKeyUp = (event) => {
      if (event.key === ' ') spaceRef.current = false
      if (event.key === 'Alt') {
        altRef.current = false
        setAltDown(false)
      }
      if (event.key === 'Shift') shiftRef.current = false
    }
    const onKeyDown = (event) => {
      if (event.key === 'Alt') {
        event.preventDefault()
        altRef.current = true
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
  }, [commit, plan, selectedFixture, undo, redoChange, tool, placing, poly, pick, picks, command, cursor, partitions, svcTool, svcPoints, svcKind, view, yardTool, yardPoints, sheetMode, exitToSelect, requestFit])

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
    requestFit(next, 'plan')
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
    placeAt({ x: spot.x, z: spot.z }, spot.ppm, { at: spot.at || Date.now(), px: spot.px, py: spot.py, shift: Boolean(spot.shift) })
  }

  const onFixtureDrag3d = (id, spot, phase) => {
    if (workspace !== 'kalusteet') return
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
    if (workspace !== 'rakenne') return
    if (!dragBefore.current) dragBefore.current = plan
    setPlan((current) => moveOpening(current, id, { x: spot.x, z: spot.z }))
    setPick({ kind: 'opening', id })
    if (phase === 'end') {
      history.current = [...history.current, dragBefore.current].slice(-40)
      dragBefore.current = null
    }
  }

  const onServiceDrag3d = (service, spot, phase) => {
    if (!workspaceAllows(workspace, { kind: 'service', service })) return
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
    if (workspace !== 'piha') return
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
    const created = addedFixture(plan, next, type)
    if (created) {
      setSelectedFixture(created.id)
      setPick({ kind: 'fixture', id: created.id })
      setPanel('object')
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
      const fixture = addedFixture(plan, next, clip.current.type)
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
  const groups = FURNITURE_GROUPS.filter((id) => fixtureGroup === 'Kaikki' || fixtureGroup === id).map((id) => ({
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
    obstacles: labelObstacles(plan, layout.scale * k),
  })
  const activeSystems = SERVICE_SYSTEMS.filter((item) => layerVisible(plan, item.id) && ensureServices(plan).runs.some((run) => run.system === item.id))
  const sheetTitle = sheetMode === 'site' ? t('sheet.site') : (activeSystems.length === 1 ? text(locale, `service.${activeSystems[0].id}`, activeSystems[0].title) : t('sheet.plan'))
  const liveEnd = draft && (tool === 'exterior' || tool === 'interior') ? (drawGuide || snapVisual?.point || null) : null
  draftRef.current = draft
  liveRef.current = liveEnd
  const roomCursor = tool === 'room' ? snapVisual?.point || null : null
  const liveLength = draft && liveEnd ? segmentLength(draft, liveEnd) : 0
  const spec = PLACEABLES.find((item) => item.id === svcKind)
  const placingOne = Boolean(placing || svcTool === 'node' || tool === 'door' || tool === 'window' || yardPlacesOne(yardTool))
  const drawingTool = Boolean(!placingOne && (tool === 'exterior' || tool === 'interior' || tool === 'room' || tool === 'detect' || svcTool === 'run' || (yardTool && !yardPlacesOne(yardTool))))
  const activeName = placing
    ? (FIXTURES.find((item) => item.id === placing)?.name || 'Kaluste')
    : svcTool
      ? (spec?.name || 'Talotekniikka')
      : yardTool
        ? yardToolLabel(yardTool)
        : (TOOL_LABELS[tool] || null)
  const workspaceName = WORKSPACES.find((item) => item.id === workspace)?.name || ''
  const modeLabel = modeChipText({ workspace: workspaceName, name: activeName, repeat: repeatPlace && placingOne, drawing: drawingTool })
  const engaged = Boolean(activeName)
  const status = engaged
    ? `${modeLabel}${liveEnd ? ` · ${formatMm(liveLength)}` : ''}`
    : t('status.select')

  const px = (metres) => metres * layout.scale * k

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#e7e5e4', color: '#1c1917' }} onPointerDown={() => setMenu(null)}>
      <PlanChrome
        t={t}
        plan={plan}
        locale={locale}
        setLocale={(next) => { setLocale(next); setPlan((current) => ({ ...current, locale: next })) }}
        mode={view === '3d' ? '3d' : view === 'facade' ? 'facade' : sheetMode === 'site' ? 'site' : 'plan'}
        tool={tool}
        doorHand={doorHand}
        onDoorHand={setDoorHand}
        placing={placing}
        roomShape={roomShape}
        yardTool={yardTool}
        partitions={partitions}
        polyReady={poly.length >= 3}
        gridStep={gridStep}
        angleStep={angleStep}
        camera={camera}
        display={display}
        panel={panel}
        command={command}
        svcSystem={svcSystem}
        svcKind={svcKind}
        svcTool={svcTool}
        floorHeating={floorHeating}
        drawing={svcTool === 'run' && svcPoints.length >= 2}
        wallMode={wallMode}
        roofMode={roofMode}
        showClearances={showClearances}
        onName={(name) => setPlan({ ...plan, name })}
        onMode={(next) => {
          if (next === '3d') setView('3d')
          else if (next === 'facade') setView('facade')
          else if (next === 'site') { setWorkspace('piha'); setView('2d'); setSheetMode('site'); requestFit(plan, 'site'); setYardTool(null); setYardPoints([]) }
          else {
            const entering = view !== '2d' || sheetMode !== 'plan' || workspace === 'piha'
            if (workspace === 'piha') setWorkspace('rakenne')
            setView('2d')
            setSheetMode('plan')
            if (entering) requestFit(plan, 'plan')
            setYardTool(null)
            setYardPoints([])
          }
        }}
        onTool={(next) => {
          if (next === 'select' || (next === tool && !placing && !svcTool && !yardTool)) {
            exitToSelect()
            return
          }
          setTool(next)
          setPlacing(null)
          setSvcTool(null)
          setYardTool(null)
          if (next === 'select' || next === 'door' || next === 'window') setDraft(null)
          if (next === 'detect') { setDraft(null); setPoly([]) }
        }}
        onRoomRect={() => {
          if (tool === 'room' && roomShape === 'rect') { exitToSelect(); return }
          setTool('room'); setRoomShape('rect'); setPlacing(null); setSvcTool(null); setYardTool(null); setPoly([])
        }}
        onRoomPoly={() => {
          if (tool === 'room' && roomShape === 'poly') { exitToSelect(); return }
          setTool('room'); setRoomShape('poly'); setPlacing(null); setSvcTool(null); setYardTool(null); setDraft(null)
        }}
        onUndo={undo}
        onRedo={redoChange}
        onNew={() => { setMenu(null); setNewOpen(true) }}
        onOpen={() => { setMenu(null); setLibraryOpen(true) }}
        onHouse={() => { setPanel('house'); setMenu(null) }}
        onDisplay={() => setDisplayOpen((open) => !open)}
        onPreset={(preset) => setDisplay({ preset })}
        onExample={loadExample}
        onFamily={loadFamily}
        onPaper={(paper) => setPlan({ ...plan, paper })}
        onPartitions={setPartitions}
        onCloseRoom={() => closeRoom(poly)}
        onYardTool={(id) => {
          if (!id || id === yardTool) { exitToSelect(); return }
          setYardTool(id); setTool('select'); setPlacing(null); setSvcTool(null); setYardPoints([])
        }}
        onNorth={(north) => commit(updateYardItem(plan, 'north', 'north', { north }))}
        onGrid={setGridStep}
        onAngle={setAngleStep}
        onZoomOut={() => {
          const rect = hostRef.current?.getBoundingClientRect()
          setCamera((current) => zoomAt(current, (rect?.width || 0) / 2, (rect?.height || 0) / 2, 0.8))
        }}
        onZoomIn={() => {
          const rect = hostRef.current?.getBoundingClientRect()
          setCamera((current) => zoomAt(current, (rect?.width || 0) / 2, (rect?.height || 0) / 2, 1.25))
        }}
        onZoomFit={() => requestFit(plan, sheetMode)}
        onClearances={setShowClearances}
        onWallMode={setWallMode}
        onRoofMode={setRoofMode}
        onSceneStyle={(sceneStyle) => setPlan({ ...plan, sceneStyle })}
        onSystem={(id) => {
          setSvcSystem(id)
          const next = PLACEABLES.find((item) => item.system === id && item.mode === (svcTool === 'run' ? 'run' : 'node'))
          if (next) setSvcKind(next.id)
        }}
        onKind={setSvcKind}
        onSvcTool={(next) => {
          if (!next || next === svcTool) { exitToSelect(); return }
          setSvcTool(next)
          setTool('select')
          setPlacing(null)
          setYardTool(null)
          setDraft(null)
          setPoly([])
          const current = PLACEABLES.find((item) => item.id === svcKind)
          if (!current || current.system !== svcSystem || current.mode !== next) {
            const match = PLACEABLES.find((item) => item.system === svcSystem && item.mode === next)
            if (match) setSvcKind(match.id)
          }
        }}
        onFloorHeating={setFloorHeating}
        onFinish={finishServiceRun}
        onRoute={() => {
          const systems = workspaceSystems(workspace)
          if (!systems.length) {
            showToast('Reititys on Sähkö-, IV- ja LVI-työtiloissa')
            return
          }
          let next = plan
          const notes = []
          systems.forEach((system) => {
            const routed = autoRoute(next, system, { floorHeating: workspace === 'lvi' && floorHeating })
            if (routed.routeNotice) notes.push(`${system === 'electric' ? 'Sähkö' : system === 'iv' ? 'IV' : system === 'water' ? 'Vesi' : system === 'drain' ? 'Viemäri' : 'Lämmitys'}: ${routed.routeNotice}`)
            next = routed
          })
          const clean = { ...next }
          delete clean.routeNotice
          const changed = JSON.stringify(clean.services?.runs || []) !== JSON.stringify(plan.services?.runs || [])
          if (notes.length) showToast(notes.join(' · '))
          else if (changed) showToast('Reitit päivitetty')
          else showToast('Reitit olivat jo ajan tasalla')
          if (changed) commit(syncYardServices(clean))
          setSvcPoints([])
        }}
        workspace={workspace}
        onWorkspace={(id) => {
          const nextPlan = applyWorkspaceSwitch(plan, id)
          if (nextPlan !== plan) setPlan(nextPlan)
          setWorkspace(id)
          setGhosts([])
          exitToSelect()
          if (id === 'piha') {
            setView('2d')
            setSheetMode('site')
            requestFit(plan, 'site')
          } else {
            if (sheetMode === 'site') setSheetMode('plan')
            requestFit(plan, 'plan')
          }
          const systems = workspaceSystems(id)
          if (systems[0]) {
            setSvcSystem(systems[0])
            const next = PLACEABLES.find((item) => item.system === systems[0] && item.mode === 'node')
            if (next) setSvcKind(next.id)
          }
        }}
        onPlaceDevice={(item) => {
          if (!item) return
          const mode = item.drawing || item.mode === 'run' ? 'run' : 'node'
          if (svcTool === mode && svcKind === item.id) { exitToSelect(); return }
          setSvcSystem(item.system)
          setSvcKind(item.id)
          setSvcTool(mode)
          setTool('select')
          setPlacing(null)
          setYardTool(null)
          setDraft(null)
          setPoly([])
        }}
        onSuggest={() => {
          const systems = workspaceSystems(workspace)
          const proposals = systems.flatMap((system) => suggestEquipment(plan, system, { floorHeating }).proposals)
          if (!proposals.length) {
            setGhosts([])
            showToast('Ei uusia laite-ehdotuksia')
            return
          }
          setGhosts(proposals)
          showToast('Ehdotukset näkyvät katkoviivalla. Hyväksy tai paina Esc.')
        }}
        onAccept={() => {
          const systems = workspaceSystems(workspace)
          let next = plan
          systems.forEach((system) => { next = acceptEquipment(next, system, { floorHeating }) })
          if (next === plan) { setGhosts([]); return }
          commit(next)
          setGhosts([])
          showToast('Ehdotetut laitteet lisätty')
        }}
        ghostCount={ghosts.length}
        onRewire={() => {
          const routed = autoRoute(plan, 'electric')
          if (routed.routeNotice) showToast(routed.routeNotice)
          const clean = { ...routed }
          delete clean.routeNotice
          if (JSON.stringify(clean.services?.runs || []) !== JSON.stringify(plan.services?.runs || [])) commit(clean)
          setSvcPoints([])
          setElectricView(null)
        }}
        onSchedule={() => { setView('2d'); setElectricView('list') }}
        onDiagram={() => { setView('2d'); setElectricView('diagram') }}
        onRewireWater={() => {
          const routed = autoRoute(plan, 'water', { floorHeating })
          if (routed.routeNotice) showToast(routed.routeNotice)
          const clean = { ...routed }
          delete clean.routeNotice
          if (JSON.stringify(clean.services?.runs || []) !== JSON.stringify(plan.services?.runs || [])) commit(clean)
          setHeatView(null)
        }}
        onRewireHeat={() => {
          const routed = autoRoute(plan, 'heat')
          if (routed.routeNotice) showToast(routed.routeNotice)
          const clean = { ...routed }
          delete clean.routeNotice
          if (JSON.stringify(clean.services?.runs || []) !== JSON.stringify(plan.services?.runs || [])) commit(clean)
          setSvcSystem('heat')
          setHeatView(null)
        }}
        onHeatTable={() => { setView('2d'); setHeatView('table'); setElectricView(null) }}
        onHeatSchematic={() => { setView('2d'); setHeatView('schematic'); setElectricView(null) }}
        onPdf={exportPdf}
        onServicePdf={(id) => {
          if (id === 'site') {
            buildSitePdf(plan).save(`${(plan.name || 'site').replace(/\s+/g, '-')}-site.pdf`)
            return
          }
          if (id === 'png') { exportPng(); return }
          const doc = id === 'electric' ? buildElectricPdf(plan) : id === 'heat' || id === 'water' ? buildHydronicPdf(plan) : buildServicePdf(plan, id)
          doc.save(`${(plan.name || 'talotekniikka').replace(/\s+/g, '-')}-${id}.pdf`)
        }}
        onCommand={beginCommand}
        onSelectType={(type) => remember(targetsByType(plan, type))}
        onCadLayer={(layer) => beginCommand('layer', layer)}
        repeat={repeatPlace}
        onRepeat={setRepeatPlace}
        onCleanup={() => {
          const result = removeStacked(plan)
          if (!result.removed) { showToast('Päällekkäisiä ei löytynyt'); return }
          commit(result.plan)
          showToast(`Poistettiin ${result.removed} päällekkäistä`)
        }}
        onRemoveAuto={() => {
          const next = removeAutoAdded(plan)
          const before = (plan.services?.nodes?.length || 0) + (plan.services?.runs?.length || 0)
          const after = (next.services?.nodes?.length || 0) + (next.services?.runs?.length || 0)
          if (before === after) { showToast('Automaattisesti lisättyjä ei löytynyt'); return }
          commit(next)
          showToast('Automaattisesti lisätyt poistettiin')
        }}
        onStraighten={() => {
          const next = straightenWalls(plan, 2)
          if (next === plan) { showToast('Seinät ovat jo suorassa'); return }
          commit(next)
          showToast('Seinät suoristettiin')
        }}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 232, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderRight: '1px solid #d6d3d1', padding: '10px 10px 18px' }}>
          <div data-testid="workspace-side-title" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#0f766e', margin: '0 4px 8px' }}>{workspaceName}</div>
          {workspace === 'rakenne' && (
            <p style={{ margin: '0 4px 8px', fontSize: 12, lineHeight: 1.45, color: '#44403c' }}>Seinät, huoneet, ovet, ikkunat, katto ja rakenteet. Muut tasot ovat himmennettyjä ja lukittuja.</p>
          )}
          {workspace === 'piha' && (
            <>
              <p style={{ margin: '0 4px 8px', fontSize: 12, lineHeight: 1.45, color: '#44403c' }}>Asemapiirros ja piha. Työkalut ovat nauhassa. Talo ja talotekniikka ovat lukittuja.</p>
              <PihaTerraceLevels plan={plan} selection={pick} onCommit={commit} />
            </>
          )}
          {(workspace === 'sahko' || workspace === 'iv' || workspace === 'lvi') && (
            <div data-testid="device-library">
              <p style={{ margin: '0 4px 8px', fontSize: 12, lineHeight: 1.45, color: '#44403c' }}>Vain tämän järjestelmän laitteet ja reitit. Muut tasot ovat himmennettyjä.</p>
              {PLACEABLES.filter((item) => workspaceSystems(workspace).includes(item.system) && item.mode === 'node').map((item) => (
                <button key={item.id} type="button" data-testid={`side-device-${item.id}`} style={sideBtn(svcTool === 'node' && svcKind === item.id)} onClick={() => {
                  if (svcTool === 'node' && svcKind === item.id) { exitToSelect(); return }
                  setSvcSystem(item.system)
                  setSvcKind(item.id)
                  setSvcTool('node')
                  setTool('select')
                  setPlacing(null)
                  setYardTool(null)
                }}><DeviceMark item={item} />{item.name}</button>
              ))}
            </div>
          )}
          {workspace === 'kalusteet' && (
          <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {['Kaikki', ...FURNITURE_GROUPS].map((id) => (
              <button key={id} type="button" data-testid={`fixture-cat-${id}`} aria-pressed={fixtureGroup === id} onClick={() => setFixtureGroup(id)} style={{ ...sideBtn(fixtureGroup === id), width: 'auto', padding: '4px 8px' }}>{id}</button>
            ))}
          </div>
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
                  onClick={() => {
                    if (placing === item.id) { exitToSelect(); return }
                    setPlacing(item.id); setTool('select'); setSvcTool(null); setYardTool(null); setDraft(null)
                  }}
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
                  onClick={() => {
                    if (placing === item.id) { exitToSelect(); return }
                    setPlacing(item.id); setTool('select'); setSvcTool(null); setYardTool(null); setDraft(null)
                  }}
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
          </>
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
                  commitWallRef.current(draft, end)
                }}
              />
            ) : <span data-testid="status-tool">{status}</span>}
          </div>
          {view === 'facade' ? (
            <FacadeView
              plan={plan}
              side={facadeSideId}
              selected={pick}
              onSide={setFacadeSideId}
              onApply={setPlan}
              onCommit={commit}
              onSelect={(cell) => {
                setPicks([{ kind: 'zone', id: cell.id }])
                setPick({ kind: 'zone', ...cell })
                setPanel('object')
              }}
            />
          ) : view === '2d' ? (
            <div ref={hostRef} data-testid="plan-canvas-frame" data-active={engaged ? 'place' : 'select'} style={{ flex: 1, minHeight: 0, background: '#d6d3d1', position: 'relative', ...placeFrame(engaged) }}>
              <ModeChip workspace={workspaceName} name={activeName} repeat={repeatPlace && placingOne} drawing={drawingTool} />
              <PlaceToast text={toast} />
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
                style={{ display: 'block', cursor: engaged ? 'crosshair' : 'default', touchAction: 'none' }}
              >
                <defs>
                  <pattern id="poche" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="#f4f2ef" />
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#c8c2ba" strokeWidth="0.7" />
                  </pattern>
                  <HatchDefs />
                </defs>
                <g data-testid="plan-camera" transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
                <rect x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} fill="#fbfaf7" stroke="#1c1917" strokeWidth={1.4} />
                <rect x={sheet.x + 4} y={sheet.y + 4} width={sheet.w - 8} height={sheet.h - 8} fill="none" stroke="#a8a29e" strokeWidth={0.6} />
                <g data-testid="structure-layer" opacity={workspace === 'rakenne' ? 1 : 0.32} style={{ pointerEvents: workspace === 'rakenne' ? 'auto' : 'none' }}>
                {sheetMode !== 'site' && visibleRooms(plan).map((item) => (
                  <polygon
                    key={item.id}
                    points={item.polygon.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')}
                    fill={materialOf('floor', item.floorId).color}
                    fillOpacity={item.id === selectedRoom ? 0.78 : 0.5}
                    stroke={item.id === selectedRoom ? '#0f766e' : 'none'}
                    strokeWidth={1.2}
                  />
                ))}
                </g>
                {sheetMode === 'site' && (
                  <g data-testid="yard-layer" opacity={workspace === 'piha' ? 1 : 0.28} style={{ pointerEvents: workspace === 'piha' ? 'auto' : 'none' }}>
                  <YardLayer
                    plan={plan}
                    X={X}
                    Y={Y}
                    px={px}
                    sheet={sheet}
                    selected={pick}
                    showClearances={showClearances}
                    legendAt={{ x: sheet.x + layout.title.x * k, y: sheet.y + 52, w: Math.max(140, layout.title.w * k) }}
                    preview={yardPoints.length ? { points: yardPoints, cursor: snapVisual?.point || cursor } : null}
                  />
                  </g>
                )}
                <g data-testid="structure-shell" opacity={workspace === 'rakenne' ? 1 : 0.32} style={{ pointerEvents: workspace === 'rakenne' ? 'auto' : 'none' }}>
                <WallOutlines plan={plan} X={X} Y={Y} zoom={camera.zoom || 1} simple={sheetMode === 'site'} selectedIds={picks.filter((item) => item.kind === 'wall').map((item) => item.id)} />
                {sheetMode !== 'site' && (plan.openings || []).filter((opening) => !opening.hidden).map((opening) => {
                  const wall = plan.walls.find((item) => item.id === opening.wallId)
                  if (!wall || wall.hidden) return null
                  const fig = openingSymbol(wall, opening, plan)
                  const selectedOpening = picks.some((item) => item.kind === 'opening' && item.id === opening.id)
                  if (fig.kind === 'window') {
                    const compass = wallBearing(plan, wall).code
                    return (
                      <g key={opening.id} data-testid="window-mark" data-compass={compass} stroke={selectedOpening ? '#0f766e' : '#1c1917'} strokeWidth={1.15} fill="none">
                        {fig.glass.map((line, index) => (
                          <line key={index} x1={X(line.x1)} y1={Y(line.z1)} x2={X(line.x2)} y2={Y(line.z2)} />
                        ))}
                        <line x1={X(fig.jambA[0].x)} y1={Y(fig.jambA[0].z)} x2={X(fig.jambA[1].x)} y2={Y(fig.jambA[1].z)} />
                        <line x1={X(fig.jambB[0].x)} y1={Y(fig.jambB[0].z)} x2={X(fig.jambB[1].x)} y2={Y(fig.jambB[1].z)} />
                      </g>
                    )
                  }
                  return (
                    <g key={opening.id} data-testid="door-mark" data-swing={opening.swing >= 0 ? 'left' : 'right'} data-leaf={opening.inward ? 'in' : 'out'} stroke={selectedOpening ? '#0f766e' : '#1c1917'} strokeWidth={1.05} fill="none">
                      <line data-testid="door-jamb" x1={X(fig.jambA[0].x)} y1={Y(fig.jambA[0].z)} x2={X(fig.jambA[1].x)} y2={Y(fig.jambA[1].z)} />
                      <line data-testid="door-jamb" x1={X(fig.jambB[0].x)} y1={Y(fig.jambB[0].z)} x2={X(fig.jambB[1].x)} y2={Y(fig.jambB[1].z)} />
                      <polyline points={fig.arc.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')} />
                      <line x1={X(fig.hinge.x)} y1={Y(fig.hinge.z)} x2={X(fig.leaf.x)} y2={Y(fig.leaf.z)} />
                    </g>
                  )
                })}
                </g>
                <g data-testid="fixture-layer" opacity={workspace === 'kalusteet' ? 1 : 0.28} style={{ pointerEvents: workspace === 'kalusteet' ? 'auto' : 'none' }}>
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
                      style={{ pointerEvents: workspace === 'kalusteet' && tool === 'select' && !placing && !svcTool ? 'auto' : 'none' }}
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
                      {flashId === fixture.id && <circle data-testid="place-flash" r={Math.max(w, d) / 2 + 8} fill="none" stroke="#ea580c" strokeWidth={2.4} />}
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
                </g>
                <g opacity={workspace === 'rakenne' ? 1 : 0.32} style={{ pointerEvents: workspace === 'rakenne' ? 'auto' : 'none' }}>
                {sheetMode !== 'site' && <FaceLines plan={plan} X={X} Y={Y} selected={pick?.kind === 'room' ? pick : null} onSelect={(face) => {
                  setPick(face)
                  setSelectedRoom(face.id)
                  setPanel('object')
                  setMenu(null)
                }} />}
                </g>
                {sheetMode !== 'site' && plan.walls.length > 0 && (
                  <g style={{ pointerEvents: 'none' }} data-testid="dimension-chains">
                    {stackDimensionLabels(dedupeDimensions(dimLines, 18 / (Math.max(camera.zoom || 1, 0.2) * Math.max(layout.scale * k, 0.001))), X, Y, camera.zoom || 1).map((dim, index) => (
                      <DimLine key={`${dim.kind || 'dim'}-${dim.id || index}-${dim.label}-${dim.x1}-${dim.z1}`} dim={dim} X={X} Y={Y} zoom={camera.zoom || 1} />
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
                    fontSize={paperFont(k, camera.zoom || 1, 2.5)}
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
                    fontSize={paperFont(k, camera.zoom || 1, 2.5)}
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
                      const font = paperFont(k, camera.zoom || 1, 2.5)
                      const rowH = font * LINE_LEADING
                      const widest = Math.max(...rows.map((row) => `${row.code}  ${row.name}  U ${Number(row.u).toFixed(2)}`.length), 16)
                      const boxW = Math.min(sheet.w * 0.46, Math.max(168, widest * font * 0.58 + 16))
                      const boxH = rowH * (rows.length + 1) + font * 0.45
                      const x = sheet.x + 8 * k
                      const y = Math.max(sheet.y + 8, sheet.y + sheet.h - boxH - 8 * k)
                      return (
                        <>
                          <rect x={x} y={y} width={boxW} height={boxH} fill="#fbfaf7" stroke="#1c1917" strokeWidth={0.6} />
                          <text x={x + 6} y={y + rowH} fontSize={font} fontWeight={700} fill="#1c1917">{t('sheet.structures')}</text>
                          {rows.map((row, index) => (
                            <text key={row.key} data-testid="legend-row" data-code={row.code} x={x + 6} y={y + rowH * (index + 2)} fontSize={font} fill="#1c1917">
                              {row.code}  {text(locale, `struct.${row.id}`, row.name)}  U {num(row.u, 2)}
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
                    <g data-testid="draw-readout" data-length={typedLen || String(Math.round(liveLength * 1000))} data-angle={wallDirection({ a: draft, b: liveEnd })} transform={`translate(${X(liveEnd.x)} ${Y(liveEnd.z)}) scale(${1 / (camera.zoom || 1)})`}>
                      <rect x="14" y="8" width="128" height="18" rx="3" fill="#fbfaf7" stroke="#0f766e" strokeWidth="1" />
                      <text x="78" y="21" textAnchor="middle" fontSize="12" fontWeight={700} fill="#0f766e">{typedLen || formatMm(liveLength)} mm  {wallDirection({ a: draft, b: liveEnd })}°</text>
                    </g>
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
                <g
                  data-testid="north-arrow"
                  data-north={ensureYard(plan).north || 0}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    northDrag.current = { x: event.clientX, north: ensureYard(plan).north || 0, plan }
                  }}
                  onPointerMove={(event) => {
                    if (!northDrag.current || !event.currentTarget.hasPointerCapture?.(event.pointerId)) return
                    const next = Math.round(northDrag.current.north + (event.clientX - northDrag.current.x))
                    const north = ((next % 360) + 360) % 360
                    setPlan(updateYardItem(northDrag.current.plan, 'north', 'north', { north }))
                  }}
                  onPointerUp={(event) => {
                    if (!northDrag.current) return
                    const next = Math.round(northDrag.current.north + (event.clientX - northDrag.current.x))
                    const north = ((next % 360) + 360) % 360
                    const base = northDrag.current.plan
                    northDrag.current = null
                    history.current = [...history.current, base].slice(-40)
                    redo.current = []
                    setPlan(updateYardItem(base, 'north', 'north', { north }))
                  }}
                >
                  {(() => {
                    const columnX = sheet.x + layout.title.x * k
                    const columnW = layout.title.w * k
                    const ax = sheetMode === 'site' ? columnX + columnW - 22 : sheet.x + sheet.w - 52
                    const ay = sheetMode === 'site' ? sheet.y + 26 : sheet.y + 48
                    const north = ensureYard(plan).north || 0
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
                    const roofItem = ROOF_TYPES.find((item) => item.id === plan.roofType) || ROOF_TYPES[0]
                    const roofName = text(locale, `roof.${roofItem.id}`, roofItem.name)
                    const yard = ensureYard(plan)
                    const lines = sheetMode === 'site' ? [
                      plan.name || t('sheet.defaultName'),
                      t('sheet.scale', { ratio: layout.ratio }),
                      plan.paper === 'a4' ? t('sheet.a4') : t('sheet.a3'),
                      t('sheet.plot', { area: formatSquare(plotMetrics(plan).area) }),
                      t('sheet.north', { deg: Math.round(yard.north || 0) }),
                      t('sheet.buildings', { count: yard.buildings.length }),
                    ] : [
                      plan.name || t('sheet.defaultName'),
                      t('sheet.scale', { ratio: layout.ratio }),
                      plan.paper === 'a4' ? t('sheet.a4') : t('sheet.a3'),
                      roofName,
                      t('sheet.rooms', { count: visibleRooms(plan).length }),
                      t('sheet.area', { area: formatArea(totalArea) }),
                    ]
                    const preferred = 2.8 * k
                    const header = 8 * k
                    const footer = 9 * k
                    const topInset = header + 1.4 * k
                    const need = blockHeightForLines({ count: lines.length, font: preferred, top: topInset, bottom: footer })
                    let boxY = ty
                    let boxH = th
                    if (need > boxH + 0.5) {
                      const limit = boxY + boxH - (sheet.y + 4)
                      const grown = Math.min(Math.max(boxH, need), Math.max(boxH, limit))
                      boxY = boxY + boxH - grown
                      boxH = grown
                    }
                    const stack = fitLines({ height: boxH, count: lines.length, font: preferred, top: topInset, bottom: footer })
                    const heading = Math.min(preferred * 1.25, header * 0.62)
                    return (
                      <g data-testid="title-block" data-font={stack.font} data-step={stack.step}>
                        <rect x={tx} y={boxY} width={tw} height={boxH} fill="#fff" stroke="#1c1917" strokeWidth={1} />
                        <line x1={tx} y1={boxY + header} x2={tx + tw} y2={boxY + header} stroke="#1c1917" strokeWidth={0.7} />
                        <text x={tx + 8} y={boxY + header * 0.72} fontSize={heading} fontWeight={750} fill="#1c1917">{sheetTitle}</text>
                        {lines.map((line, index) => (
                          <text key={`${index}-${line}`} data-testid="title-line" x={tx + 8} y={boxY + stack.ys[index]} fontSize={stack.font} fill="#292524">{line}</text>
                        ))}
                        <g data-testid="scale-bar">
                          {(() => {
                            const metres = layout.worldW >= 8 ? 5 : 2
                            const maxW = tw - 28
                            const natural = metres * layout.scale * k
                            const bar = Math.min(maxW, Math.max(28, natural))
                            const barFont = Math.min(stack.font, 2.1 * k)
                            const barH = Math.max(3, 1.5 * k)
                            const sy = boxY + boxH - barH - 1.2 * k
                            return (
                              <>
                                <text x={tx + 8} y={sy - barFont * 0.35} fontSize={barFont} fill="#1c1917">0</text>
                                <text x={tx + 8 + bar} y={sy - barFont * 0.35} textAnchor="end" fontSize={barFont} fill="#1c1917">{metres} m</text>
                                {Array.from({ length: metres }, (_, index) => (
                                  <rect key={index} x={tx + 8 + (bar / metres) * index} y={sy} width={bar / metres} height={barH} fill={index % 2 ? '#fff' : '#1c1917'} stroke="#1c1917" strokeWidth={0.4} />
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
                  quietLabels={sheetMode === 'site' || (display.preset === 'all' ? activeSystems.length > 1 : workspaceSystems(workspace).length !== 1)}
                  legendSystems={display.preset === 'all' ? null : workspaceSystems(workspace)}
                  siteMode={sheetMode === 'site'}
                  legendBox={sheetMode === 'site' ? {
                    x: sheet.x + layout.title.x * k,
                    y: sheet.y + 52 + yardLegendHeight() + 8,
                    w: Math.max(140, layout.title.w * k),
                    maxBottom: sheet.y + layout.title.y * k - 6,
                  } : {
                    x: sheet.x + layout.title.x * k,
                    y: sheet.y + 16,
                    w: layout.title.w * k,
                    maxBottom: sheet.y + layout.title.y * k - 6,
                  }}
                  interactive={!svcTool}
                  selected={pick}
                  onRouteDown={(event, hit) => beginRouteDrag(hit.id, hit.mode, hit.index, toWorld(event))}
                  preview={svcTool === 'run' ? { points: svcPoints, cursor: cursor ? snapServicePoint(cursor, plan, { mode: 'free', system: svcSystem }) : null } : null}
                  onContext={openServiceMenu}
                  flashId={flashId}
                  activeSystems={workspace === 'sahko' || workspace === 'iv' || workspace === 'lvi' ? workspaceSystems(workspace) : []}
                  zoom={camera.zoom || 1}
                  camera={camera}
                  viewport={size}
                  roomLabels={sheetMode === 'site' ? [] : roomLabels}
                  dimensions={sheetMode === 'site' ? [] : dimLines}
                />
                {ghosts.map((node) => (
                  <g key={node.id} data-testid="equip-ghost" opacity={0.9} style={{ pointerEvents: 'none' }}>
                    <circle cx={X(node.x)} cy={Y(node.z)} r={11} fill="rgba(234,88,12,0.12)" stroke="#ea580c" strokeWidth={1.4} strokeDasharray="3 2" />
                    <text x={X(node.x) + 14} y={Y(node.z) - 8} fontSize={9} fontWeight={700} fill="#9a3412">{node.name}</text>
                  </g>
                ))}
                {sheetMode !== 'site' && roomLabels.map((label) => (
                  <g
                    key={`label-${label.id}`}
                    data-testid="room-label"
                    data-name={label.roomName}
                    data-text={label.text}
                    data-halo={label.halo ? '1' : '0'}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const world = toWorld(event)
                      choose({ kind: 'room', id: label.id })
                      setMenu({ x: event.clientX, y: event.clientY, kind: 'room', id: label.id, at: world })
                    }}
                    style={{ pointerEvents: workspace === 'rakenne' && tool === 'select' && !placing && !svcTool ? 'auto' : 'none', cursor: 'move' }}
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
                    <SheetRoomLabel label={label} X={X} Y={Y} nameSize={paperFont(k, camera.zoom || 1, 3.5)} areaSize={paperFont(k, camera.zoom || 1, 2.5)} />
                  </g>
                ))}
                {plan.walls.length === 0 && (
                  <text x={sheet.x + sheet.w / 2} y={sheet.y + sheet.h / 2} textAnchor="middle" fontSize={15} fill="#78716c">{t('sheet.empty')}</text>
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
                {engaged && cursor && (
                  <g data-testid="place-ghost" style={{ pointerEvents: 'none' }} transform={`translate(${X((svcTool ? snapServicePoint(cursor, plan, { mode: spec?.wall ? 'wall' : 'free', system: spec?.system }) : (snapVisual?.point || cursor)).x)} ${Y((svcTool ? snapServicePoint(cursor, plan, { mode: spec?.wall ? 'wall' : 'free', system: spec?.system }) : (snapVisual?.point || cursor)).z)})`}>
                    <circle r={12 / Math.max(camera.zoom, 0.2)} fill="#fff7ed" fillOpacity="0.55" stroke="#ea580c" strokeWidth={1.6 / Math.max(camera.zoom, 0.2)} strokeDasharray={`${4 / Math.max(camera.zoom, 0.2)} ${3 / Math.max(camera.zoom, 0.2)}`} />
                    {placing && (
                      <rect
                        x={-px((FIXTURES.find((item) => item.id === placing)?.w || 0.6)) / 2}
                        y={-px((FIXTURES.find((item) => item.id === placing)?.d || 0.6)) / 2}
                        width={px(FIXTURES.find((item) => item.id === placing)?.w || 0.6)}
                        height={px(FIXTURES.find((item) => item.id === placing)?.d || 0.6)}
                        fill="#ea580c22"
                        stroke="#ea580c"
                        strokeWidth={1 / Math.max(camera.zoom, 0.2)}
                      />
                    )}
                  </g>
                )}
                {sheetMode !== 'site' && <AngleMarks marks={cornerAngles(plan.walls)} X={X} Y={Y} zoom={camera.zoom} />}
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
            <div ref={hostRef} data-testid="floor-3d" data-active={engaged ? 'place' : 'select'} style={{ flex: 1, minHeight: 0, position: 'relative', background: '#e7e5e4', ...placeFrame(engaged) }}>
              <ModeChip workspace={workspaceName} name={activeName} repeat={repeatPlace && placingOne} drawing={drawingTool} />
              <PlaceToast text={toast} />
              <HouseScene
                plan={plan}
                wallMode={wallMode}
                roofMode={roofMode}
                fitToken={fitToken}
                selected={pick}
                hovered={hover}
                drawMode={engaged}
                placeGhost={placingOne}
                cursor={snapVisual?.point || cursor}
                cursorPpm={cursorPpm}
                snapKind={snapVisual?.kind || null}
                draft={(tool === 'exterior' || tool === 'interior') ? draft : null}
                liveEnd={liveEnd}
                liveLabel={liveEnd ? `${formatMm(liveLength)} mm` : ''}
                roomDraft={tool === 'room' && roomShape === 'rect' ? draft : null}
                roomCursor={roomCursor}
                onSelect={(hit) => { if (!workspaceAllows(workspace, hit)) return; setMenu(null); choose(hit) }}
                onHover={onHover3d}
                onContext={openHitMenu}
                onPreview={onPreview3d}
                onPlace={onPlace3d}
                onFixtureDrag={onFixtureDrag3d}
                onOpeningDrag={onOpeningDrag3d}
                onYardDrag={onYardDrag3d}
                onServiceDrag={onServiceDrag3d}
                onDropFixture={onDropFixture3d}
                activeSystems={workspace === 'sahko' || workspace === 'iv' || workspace === 'lvi' ? workspaceSystems(workspace) : []}
                dimFixtures={workspace !== 'kalusteet'}
              />
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
              <button type="button" data-testid="panel-back-house" onClick={() => setPanel('house')} style={{ display: 'block', padding: 0, border: 'none', background: 'transparent', color: '#0f766e', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}>{t('select.back')}</button>
              <div data-testid="selection-title" style={{ fontSize: 15, fontWeight: 750 }}>{picks.length > 1 ? t('select.many', { count: picks.length }) : selectionLabel(plan, pick)}</div>
            </div>
          ) : (
            <button type="button" data-testid="open-house-panel" style={{ ...sideBtn(panel === 'house'), marginBottom: 10 }} onClick={() => setPanel(panel === 'house' ? 'object' : 'house')}>{t('file.house')}</button>
          )}
          {panel === 'house' ? (
            <HouseSettings plan={plan} onApply={setPlan} />
          ) : (
            <SelectionPanel plan={plan} selection={pick} picks={picks} onApply={setPlan} onCommit={commit} onPatchMany={(patch) => commit(patchShared(plan, picks, patch))} onClear={() => { remember([]); setMenu(null) }} onRedrawRoute={beginRedraw} />
          )}
          {pick?.kind === 'room' && room && (
            <div style={{ fontSize: 12, color: '#57534e', margin: '4px 0 12px' }}>{formatArea(room.area)}</div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '8px 0' }}>{t('bom.title')}</div>
          {rows.length === 0 && <div style={{ fontSize: 12, color: '#78716c' }}>{t('bom.empty')}</div>}
          {rows.map((row) => (
            <div key={row.key} data-testid={row.group === 'structure' ? 'structure-bom' : row.group === 'cover' ? 'cover-bom' : row.group === 'ground' ? 'ground-bom' : undefined} data-code={row.code || undefined} data-unit={row.unit || undefined} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 12, lineHeight: 1.3 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: row.color, border: '1px solid #a8a29e', flexShrink: 0 }} />
              <span data-testid={row.group === 'plinth' ? 'plinth-bom' : 'bom-line'} data-code={row.code || ''} style={{ flex: 1 }}>{row.group === 'structure' ? `${row.code} ${text(locale, `struct.${row.structureId}`, row.structureName)}: ${text(locale, `layer.${row.materialId}`, row.name)}` : `${row.roomName ? `${row.roomName}: ` : ''}${text(locale, `group.${row.group}`, row.groupLabel)}: ${text(locale, `mat.${row.group}.${row.id}`, row.name)}${row.code ? ` ${row.code}` : ''}`}</span>
              <span style={{ color: '#78716c' }}>{row.unit ? `${num(row.area || 0, row.unit === 'm³' ? 2 : 1)} ${row.unit}` : `${num(row.area || 0, 1)} m²`}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '14px 0 8px' }}>{t('bom.legend')}</div>
          {['floor', 'interior', 'ceiling', 'exterior', 'roof'].map((group) => (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{t(`group.${group}`)}</div>
              {MATERIALS[group].map((item) => (
                <div key={`${group}-${item.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, lineHeight: 1.3, color: '#44403c', marginBottom: 3 }}>
                  <span style={{ width: 12, height: 12, background: item.color, border: '1px solid #d6d3d1' }} />
                  <span>{text(locale, `mat.${group}.${item.id}`, item.name)}</span>
                </div>
              ))}
            </div>
          ))}
          {claddingAreas(plan).length > 0 && (
            <div data-testid="facade-area-legend" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{t('house.facade')}</div>
              {claddingAreas(plan).map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, lineHeight: 1.3, color: '#44403c', marginBottom: 3 }}>
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
          title={t('start.newTitle')}
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
      {menu?.kind === 'tool' && (
        <div
          data-testid="tool-menu"
          style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 80, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, boxShadow: '0 12px 28px rgba(28,25,23,0.16)', padding: 6 }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" data-testid="ctx-finish" onClick={() => { endDrawingRef.current(cursor); setMenu(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'transparent', fontWeight: 700, cursor: 'pointer' }}>Lopeta</button>
        </div>
      )}
      <ServiceMenu menu={menu} plan={plan} onApply={commit} onCommit={commit} onClose={() => setMenu(null)} onProperties={() => onMenuNavigate('properties')} onRedraw={beginRedraw} onCad={beginCommand} />
    </div>
  )
}
