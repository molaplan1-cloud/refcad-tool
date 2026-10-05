'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
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
  resizeDimension,
  wallForDimension,
  moveFixture,
  moveOpening,
  nearestEndpoint,
  nearestWall,
  moveRoomLabel,
  openingSymbol,
  doorSchedule,
  openingTags,
  planBounds,
  extensionWitnesses,
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
import { accessFor } from '@/lib/access'
import { stampDemoWatermark } from '@/lib/watermark'
import { applyDisplay, labelObstacles, layoutRoomLabels, normalizeDisplay } from '@/lib/display'
import { blockHeightForLines, dimensionFont, fitLines, LINE_LEADING, paperFont, placeDimensionText } from '@/lib/annotations'
import { DisplayPanel } from './DisplayPanel'
import { DoorPlaceControls, FloorMenu, HouseSettings, SelectionPanel, WallToolSettings, selectionLabel } from './FloorMenus'
import { LibraryDialog, ProjectInfoDialog, ProjectSettingsDialog, ShellDialog, StartDialog } from './ProjectDialogs'
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
import { normalizeHeating } from '@/lib/hydronic'
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
import { registerDrawingFlush } from '@/lib/staleDeploy'
import { shouldCloseChain, snapAlongWall, snapFixturePoint, snapPoint, snapRadius, wallHeadings } from '@/lib/snap'
import { alignForReference, drawStepText, lockOrthoPoint, parseDrawFields, pointFromDraw } from '@/lib/drawInput'
import { dropDegenerateWalls, guidesAllowed, visibleSnap } from '@/lib/guides'
import {
  applyTemporaryDimension,
  defaultOpeningWidth,
  nextTrackAxis,
  offsetForEndGap,
  placementGaps,
  pointAtOffset,
  temporaryDimensions,
  trackedPoint,
  wallAxes,
  wallShiftMetres,
} from '@/lib/tracking'
import { WORKSPACES, applyWorkspaceSwitch, workspaceAllows, workspaceSystems } from '@/lib/workspaces'
import { applyProjectType, hasHouseElements, isColdProject, stripHouseElements } from '@/lib/projectMode'
import ColdWorkspace from './ColdWorkspace'
import { FIT_CAMERA, fitRect, panBy, pinchZoom, wheelZoomFactor, zoomAt, zoomPercent } from '@/lib/zoom'
import { touchAction } from '@/lib/touch'
import { useViewport } from '@/components/useViewport'
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

function cardClearsSegment(left, top, cardW, cardH, ax, ay, bx, by, pad) {
  if (ax == null || ay == null || bx == null || by == null) return true
  const steps = 24
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const px = ax + (bx - ax) * t
    const py = ay + (by - ay) * t
    if (px >= left - pad && px <= left + cardW + pad && py >= top - pad && py <= top + cardH + pad) return false
  }
  return true
}

function DrawCursor({ x, y, frameW, frameH, ax, ay, bx, by, clearance, step, field, showInput, lengthValue, angleValue, lengthLabel = 'Length', angleLabel = 'Angle', lengthRef, angleRef, onLength, onAngle, onCommit, onSwitch, onCancel, onUndo }) {
  const cardW = 268
  const lines = Math.max(1, Math.ceil(String(step || '').length / 34))
  const cardH = 14 + lines * 17 + (showInput ? 54 : 0)
  const maxL = Math.max(8, (frameW || 800) - cardW - 8)
  const maxT = Math.max(8, (frameH || 600) - cardH - 8)
  const clamp = (left, top) => ({
    left: Math.min(Math.max(8, left), maxL),
    top: Math.min(Math.max(8, top), maxT),
  })
  const spots = showInput ? [
    [x + 28, y + 28],
    [x - cardW - 28, y + 28],
    [x + 28, y - cardH - 28],
    [x - cardW - 28, y - cardH - 28],
    [x - cardW / 2, y + 36],
    [x - cardW / 2, y - cardH - 36],
    [8, 8],
    [maxL, 8],
  ] : [[x + 18, y + 18]]
  let placed = clamp(spots[0][0], spots[0][1])
  const pad = Math.max(12, clearance || 16)
  for (const [left, top] of spots) {
    const next = clamp(left, top)
    if (cardClearsSegment(next.left, next.top, cardW, cardH, ax, ay, bx, by, pad)) {
      placed = next
      break
    }
  }
  const { left, top } = placed
  const box = {
    width: 92,
    height: 28,
    padding: '2px 6px',
    borderRadius: 6,
    border: '1px solid #d6d3d1',
    fontSize: 16,
    fontWeight: 700,
    color: '#134e4a',
    background: '#fff',
    boxSizing: 'border-box',
  }
  const onKey = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      onCommit()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      onSwitch(event.currentTarget.getAttribute('data-testid') === 'draw-cursor-length' ? 'angle' : 'length')
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    } else if (event.key === 'Backspace' && !event.currentTarget.value) {
      event.preventDefault()
      event.stopPropagation()
      onUndo()
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      onUndo()
    }
  }
  return (
    <div
      data-testid="draw-hud"
      style={{
        position: 'absolute',
        left,
        top,
        zIndex: 6,
        width: cardW,
        pointerEvents: 'none',
        padding: '8px 10px',
        borderRadius: 8,
        background: '#fff',
        border: '1px solid #0f766e',
        boxShadow: '0 8px 18px rgba(28,25,23,0.16)',
      }}
    >
      <div data-testid="draw-step" style={{ fontSize: 12, fontWeight: 700, lineHeight: '17px', color: '#134e4a' }}>{step}</div>
      {showInput && (
        <div data-testid="wall-draw-input" style={{ display: 'flex', gap: 8, marginTop: 6, pointerEvents: 'auto' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#134e4a', lineHeight: '14px' }}>{lengthLabel}
            <input ref={lengthRef} data-testid="draw-cursor-length" inputMode="decimal" value={lengthValue} style={{ ...box, display: 'block', marginTop: 2, borderColor: field === 'length' ? '#0f766e' : '#d6d3d1' }} onChange={(event) => onLength(event.target.value)} onFocus={(event) => { event.target.select(); onLength(event.target.value) }} onKeyDown={onKey} onPointerDown={(event) => event.stopPropagation()} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#134e4a', lineHeight: '14px' }}>{angleLabel}
            <input ref={angleRef} data-testid="draw-cursor-angle" inputMode="decimal" value={angleValue} style={{ ...box, display: 'block', marginTop: 2, width: 72, borderColor: field === 'angle' ? '#0f766e' : '#d6d3d1' }} onChange={(event) => onAngle(event.target.value)} onFocus={(event) => { event.target.select(); onAngle(event.target.value) }} onKeyDown={onKey} onPointerDown={(event) => event.stopPropagation()} />
          </label>
        </div>
      )}
    </div>
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
        {label && snap.kind !== 'angle' && (
          <g data-testid="snap-tooltip" transform="translate(14 -22)">
            <rect x="0" y="-12" width={label.length * 7.2 + 12} height="18" rx="3" fill="#fff" stroke={accent} strokeWidth="2" />
            <text x="6" y="1" fontSize="12" fontWeight="700" fill="#9a3412">{label}</text>
          </g>
        )}
      </g>
    </g>
  )
}

const statusBtn = {
  border: '1px solid #d6d3d1',
  background: '#fff',
  color: '#1c1917',
  borderRadius: 6,
  padding: '2px 8px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

function TempDim({ dim, X, Y, zoom, editing, onEdit, onChange, onCommit, onCancel }) {
  const s = 1 / (zoom || 1)
  const label = dim.text
  return (
    <g data-testid="temp-dim" data-role={dim.role} data-mm={dim.mm}>
      <line x1={X(dim.x1)} y1={Y(dim.z1)} x2={X(dim.x2)} y2={Y(dim.z2)} stroke="#b45309" strokeWidth={1.3 * s} style={{ pointerEvents: 'none' }} />
      <g transform={`translate(${X(dim.labelX)} ${Y(dim.labelZ)}) scale(${s})`}>
        {editing != null ? (
          <foreignObject x={-40} y={-16} width={84} height={30}>
            <div xmlns="http://www.w3.org/1999/xhtml">
              <input
                data-testid="temp-dim-input"
                autoFocus
                value={editing}
                onFocus={(event) => event.target.select()}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onCommit()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    onCancel()
                  }
                }}
                onPointerDown={(event) => event.stopPropagation()}
                style={{ width: 72, height: 22, fontSize: 12, fontWeight: 700, border: '1px solid #b45309', borderRadius: 4, boxSizing: 'border-box' }}
              />
            </div>
          </foreignObject>
        ) : (
          <g
            data-testid="temp-dim-label"
            style={{ cursor: 'text' }}
            onPointerDown={(event) => {
              if (event.pointerType === 'touch') return
              event.stopPropagation()
              event.preventDefault()
              onEdit(dim)
            }}
          >
            <rect x={-34} y={-14} width={68} height={20} rx={3} fill="#fffbeb" stroke="#b45309" strokeWidth={1} />
            <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={700} fill="#9a3412" style={{ pointerEvents: 'none' }}>{label}</text>
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
  const padM = mode === 'site' ? 0.55 : 2.35
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
  return fitRect({ left, top, right, bottom }, { w, h }, mode === 'site' ? 28 : 64)
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

function DimLine({ dim, X, Y, zoom, onEdit, witnesses = [] }) {
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
  const breakX = x1 + (x2 - x1) * 0.5
  const breakY = y1 + (y2 - y1) * 0.5
  const editDim = (event) => {
    if (!onEdit || !dim.wallId) return
    event.stopPropagation()
    event.preventDefault()
    onEdit(dim, event)
  }
  return (
    <g data-testid={`dim-${dim.kind || 'dim'}`} data-label={dim.label} data-place={place.mode} data-wall={dim.wallId || ''} fill="#292524" style={{ pointerEvents: 'none' }}>
      {(witnesses || []).map((line, index) => (
        <line
          key={`ext-${index}`}
          data-testid="dim-extension"
          x1={X(line.x1)}
          y1={Y(line.z1)}
          x2={X(line.x2)}
          y2={Y(line.z2)}
          stroke="#a8a29e"
          strokeWidth={thin}
        />
      ))}
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
      {onEdit && dim.wallId && (
        <rect
          data-testid="dim-hit"
          data-wall={dim.wallId}
          x={labelX - haloW / 2}
          y={labelY - haloH / 2}
          width={haloW}
          height={haloH}
          fill="transparent"
          transform={rot || undefined}
          style={{ cursor: 'text', pointerEvents: 'all' }}
          onPointerDown={editDim}
        />
      )}
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

function FaceLines({ plan, X, Y, selected, onSelect, interactive = true }) {
  return (
    <g data-testid="face-lines">
      {visibleRooms(plan).map((room) => (room.walls || []).map((edge, index) => {
        const wall = (plan.walls || []).find((item) => item.id === edge.wallId)
        const side = wall ? faceSide(wall, edge.a, edge.b) : 'left'
        const material = wall ? resolveFaceMaterial(plan, wall, side) : (room.interiorId || 'paint')
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
            stroke={active ? '#0f766e' : 'transparent'}
            strokeWidth={active ? 1.8 : 6}
            strokeDasharray={hatch}
            strokeLinecap="butt"
            style={{ pointerEvents: interactive ? 'stroke' : 'none' }}
            onPointerDown={(event) => {
              if (event.pointerType === 'touch') return
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
          data-align={wall.align || 'center'}
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
  const [doorHand, setDoorHand] = useState({ swing: 1, inward: false, doorStyle: 'hinged', slideMount: 'pocket', panels: 1 })
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
  const [infoOpen, setInfoOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [view, setView] = useState('2d')
  const [typeAsk, setTypeAsk] = useState(false)
  const [facadeSideId, setFacadeSideId] = useState('north')
  const [svcSystem, setSvcSystem] = useState('iv')
  const [svcKind, setSvcKind] = useState('valve-tulo')
  const [svcTool, setSvcTool] = useState(null)
  const [svcPoints, setSvcPoints] = useState([])
  const floorHeating = ['floor', 'both'].includes(normalizeHeating(plan).distribution)
  const [electricView, setElectricView] = useState(null)
  const [heatView, setHeatView] = useState(null)
  const [sheetMode, setSheetMode] = useState('plan')
  const [workspace, setWorkspace] = useState('rakenne')
  const [account, setAccount] = useState(null)
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
  const { compact } = useViewport()
  const [hand, setHand] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [drawer, setDrawer] = useState(null)
  const [gridStep, setGridStep] = useState(0.1)
  const [angleStep, setAngleStep] = useState(90)
  const [drawGuide, setDrawGuide] = useState(null)
  const angleMemory = useRef(90)
  const [altDown, setAltDown] = useState(false)
  const [typedLen, setTypedLen] = useState('')
  const [drawAngle, setDrawAngle] = useState('')
  const [drawEdited, setDrawEdited] = useState(false)
  const [drawField, setDrawField] = useState('length')
  const [chainCount, setChainCount] = useState(0)
  const [wallRefMode, setWallRefMode] = useState('outer')
  const [refSide, setRefSide] = useState('left')
  const [pointerPx, setPointerPx] = useState(null)
  const [wallLenEdit, setWallLenEdit] = useState(null)
  const [focusDraw, setFocusDraw] = useState(0)
  const [track, setTrack] = useState(null)
  const [dimEdit, setDimEdit] = useState(null)
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
  const pointers = useRef(new Map())
  const pinchRef = useRef(null)
  const armTouch = useRef(null)
  const handRef = useRef(false)
  const drawingTouchRef = useRef(false)
  const cameraRef = useRef(camera)
  cameraRef.current = camera
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
  const drawAngleRef = useRef('')
  const drawEditedRef = useRef(false)
  const drawFieldRef = useRef('length')
  const lockAngleRef = useRef(null)
  const segmentUndo = useRef([])
  const angleStepRef = useRef(90)
  const drawLenRef = useRef(null)
  const drawAngRef = useRef(null)
  const undoSegmentRef = useRef(() => {})
  const closeChainRef = useRef(() => {})
  const trackRef = useRef(null)
  const toolRef = useRef(tool)
  const placingRef = useRef(placing)
  const yardToolRef = useRef(yardTool)
  const pointerInsideRef = useRef(true)
  const [pointerInside, setPointerInside] = useState(true)
  toolRef.current = tool
  placingRef.current = placing
  yardToolRef.current = yardTool
  const draftRef = useRef(null)
  const liveRef = useRef(null)
  const commitWallRef = useRef(() => {})

  useEffect(() => {
    if (hydrated && plan.locale) setLocale(plan.locale)
  }, [hydrated, plan.locale, setLocale])

  useEffect(() => {
    if (!focusDraw) return
    drawLenRef.current?.focus()
    drawLenRef.current?.select()
  }, [focusDraw])

  useEffect(() => {
    let cancel = false
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => { if (!cancel) setAccount(data.user || null) })
      .catch(() => { if (!cancel) setAccount(null) })
    return () => { cancel = true }
  }, [])

  useEffect(() => {
    const storedLibrary = loadLibrary(window.localStorage.getItem(LIBRARY_KEY))
    setLibrary(storedLibrary)
    try {
      const raw = window.localStorage.getItem(CURRENT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.walls)) {
          const cleaned = dropDegenerateWalls(parsed)
          const loaded = {
            ...emptyPlan(),
            ...parsed,
            walls: cleaned.walls,
            openings: cleaned.openings,
            services: ensureServices(parsed),
            yard: ensureYard(parsed),
            rooms: detectRooms(cleaned.walls, parsed.rooms || [], cleaned.openings || []),
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

  const planRef = useRef(plan)
  const libraryRef = useRef(library)
  const readyRef = useRef(ready)
  planRef.current = plan
  libraryRef.current = library
  readyRef.current = ready
  useEffect(() => registerDrawingFlush(() => {
    if (!readyRef.current) return
    window.localStorage.setItem(CURRENT_KEY, JSON.stringify(planRef.current))
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(libraryRef.current))
  }), [])

  useEffect(() => {
    const node = hostRef.current
    if (!node) return undefined
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      if (w < 40 || h < 40) return
      setSize((prev) => (Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w, h }))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [view])

  const clearGuides = useCallback(() => {
    setSnapVisual(null)
    setDrawGuide(null)
    trackRef.current = null
    setTrack(null)
  }, [])

  const exitToSelect = useCallback(() => {
    toolRef.current = 'select'
    placingRef.current = null
    yardToolRef.current = null
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
    setChainCount(0)
    typedRef.current = ''
    setTypedLen('')
    drawAngleRef.current = ''
    setDrawAngle('')
    drawEditedRef.current = false
    setDrawEdited(false)
    drawFieldRef.current = 'length'
    setDrawField('length')
    lockAngleRef.current = null
    segmentUndo.current = []
    setWallLenEdit(null)
    clearGuides()
    setDimEdit(null)
    setRedrawId(null)
  }, [clearGuides])

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
    const w = Math.round(node.clientWidth)
    const h = Math.round(node.clientHeight)
    if (Math.abs(size.w - w) > 2 || Math.abs(size.h - h) > 2) {
      setSize({ w, h })
      return
    }
    const req = fitRequest.current
    const key = `${req.token}:${w}x${h}`
    if (fittedToken.current === key) return
    fittedToken.current = key
    setCamera(cameraForBuilding(req.plan || plan, req.plan ? req.mode : sheetMode, { w, h }))
  }, [ready, view, fitTick, size, plan, sheetMode])

  const flashItem = useCallback((id) => {
    setFlashId(id || null)
    window.clearTimeout(flashTimer.current)
    if (id) flashTimer.current = window.setTimeout(() => setFlashId(null), 900)
  }, [])

  const commit = useCallback((next) => {
    clearGuides()
    setPlan((current) => {
      history.current = [...history.current, current].slice(-40)
      redo.current = []
      const bound = bindFlues(next)
      return fixtureServiceKey(current) === fixtureServiceKey(bound) ? bound : syncFixtureServices(bound)
    })
  }, [clearGuides])

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
    const freeAngle = shiftRef.current || angleStep === 0
    if (svcTool) return null
    if (tool === 'exterior' || tool === 'interior') {
      const origin = draft
      const ortho = !freeAngle && angleStep === 90
      return snapPoint(world, {
        walls,
        grid: gridStep,
        radius,
        origin,
        headings: wallHeadings(origin, walls),
        extraPoints: chainStart && origin ? [chainStart] : [],
        angleStep: freeAngle ? 0 : angleStep,
        ortho,
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
    if (tool === 'door' || tool === 'window' || tool === 'passage') {
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
      setSettingsOpen(true)
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
    if (name === 'shift-wall') {
      const wallPick = pick?.kind === 'wall' ? pick : selected.find((item) => item.kind === 'wall')
      if (!wallPick) return
      originPlan.current = plan
      const next = {
        name: 'shift-wall',
        step: 'from',
        wallId: wallPick.id,
        value: '',
        distanceMode: 'offset',
        readout: '',
      }
      commandRef.current = next
      setCommand(next)
      setTool('select')
      setPlacing(null)
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
    const next = runCommand(originPlan.current, picks, { ...active, ortho: angleStep === 90 && !shiftRef.current }, point)
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
    const placingOne = Boolean(placing || svcTool === 'node' || tool === 'door' || tool === 'window' || tool === 'passage' || yardPlacesOne(yardTool))
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

  handRef.current = hand
  drawingTouchRef.current = Boolean(placing || svcTool || yardTool || (tool && tool !== 'select'))

  const beginTouch = (event) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try { event.currentTarget?.setPointerCapture?.(event.pointerId) } catch { /* synthetic pointers have no capture */ }
    if (pointers.current.size >= 2) {
      const rect = event.currentTarget.getBoundingClientRect()
      const pts = [...pointers.current.values()].map((point) => ({ x: point.x - rect.left, y: point.y - rect.top }))
      pinchRef.current = { a: pts[0], b: pts[1], camera: cameraRef.current }
      panRef.current = null
      if (armTouch.current?.timer) window.clearTimeout(armTouch.current.timer)
      armTouch.current = null
      return
    }
    const drawing = drawingTouchRef.current
    const arm = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, long: false, drawing, timer: 0 }
    armTouch.current = arm
    if (drawing && !handRef.current) {
      arm.timer = window.setTimeout(() => {
        if (!armTouch.current || armTouch.current !== arm || arm.moved) return
        arm.long = true
        panRef.current = { x: arm.x, y: arm.y, moved: false, button: 0 }
      }, 480)
    }
  }

  const endTouch = (event) => {
    pointers.current.delete(event.pointerId)
    const fingersLeft = pointers.current.size
    if (fingersLeft < 1) pinchRef.current = null
    const arm = armTouch.current
    if (arm?.timer) window.clearTimeout(arm.timer)
    const tap = arm && arm.id === event.pointerId && fingersLeft === 0 && touchAction({
      pointerType: 'touch',
      hand: handRef.current,
      drawing: arm.drawing,
      moved: arm.moved,
      longPress: arm.long,
    }) === 'tap'
    if (arm?.id === event.pointerId) armTouch.current = null
    panRef.current = null
    return tap
  }

  const onPointerMove = (event) => {
    if (view !== '2d' || !svgRef.current) return
    if (event.pointerType === 'touch') {
      if (event.nativeEvent?.__refcadMove && event.eventPhase !== 1) return
      if (event.nativeEvent) event.nativeEvent.__refcadMove = true
      if (pointers.current.has(event.pointerId)) {
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }
      if (pointers.current.size >= 2 && pinchRef.current) {
        const rect = event.currentTarget.getBoundingClientRect()
        const pts = [...pointers.current.values()].map((point) => ({ x: point.x - rect.left, y: point.y - rect.top }))
        setCamera(pinchZoom(pinchRef.current.camera, pinchRef.current, { a: pts[0], b: pts[1] }))
        return
      }
      const arm = armTouch.current
      if (arm && arm.id === event.pointerId) {
        if (Math.hypot(event.clientX - arm.x, event.clientY - arm.y) > 8) {
          arm.moved = true
          if (arm.timer) {
            window.clearTimeout(arm.timer)
            arm.timer = 0
          }
          const action = touchAction({ pointerType: 'touch', hand: handRef.current, drawing: arm.drawing, moved: true, longPress: arm.long })
          if (action === 'pan' && !panRef.current) {
            panRef.current = { x: arm.x, y: arm.y, moved: false, button: 0 }
          }
        }
        const action = touchAction({ pointerType: 'touch', hand: handRef.current, drawing: arm.drawing, moved: arm.moved, longPress: arm.long })
        if (action !== 'pan') return
      }
    }
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
    const typingId = document.activeElement?.getAttribute('data-testid') || ''
    const typingDraw = typingId === 'draw-length' || typingId === 'draw-angle' || typingId === 'draw-cursor-length' || typingId === 'draw-cursor-angle'
    const visual = describeSnap(world, ppm2d)
    pointerInsideRef.current = true
    if (!pointerInside) setPointerInside(true)
    const allowed = guidesAllowed({
      tool: toolRef.current,
      placing: placingRef.current,
      yardTool: yardToolRef.current,
      pointerInside: true,
    })
    setSnapVisual(allowed ? visual : null)
    setCursor(world)
    const canTrack = !draft && !commandRef.current && (tool === 'exterior' || tool === 'interior' || tool === 'door' || tool === 'window' || placing)
    if (canTrack) {
      const current = trackRef.current
      if (current?.armed !== 'pick' && current?.armed !== 'type' && !current?.text) {
        const corner = nearestEndpoint(plan.walls, world, snapRadius(ppm2d, 16))
        const kind = visual?.kind
        const snapped = corner
          ? { x: corner.x, z: corner.z }
          : ((kind === 'corner' || kind === 'intersection' || kind === 'midpoint') && visual?.point
            ? { x: visual.point.x, z: visual.point.z }
            : null)
        if (snapped && (!current?.base || Math.hypot(current.base.x - snapped.x, current.base.z - snapped.z) > 0.02)) {
          const next = { base: snapped, axis: current?.axis || 'along', text: '', armed: null }
          trackRef.current = next
          setTrack(next)
        }
      }
    }
    if (pending.current && Math.hypot(world.x - pending.current.x, world.z - pending.current.z) > 0.08) {
      pending.current.moved = true
      const box = selectionBox({ x: pending.current.x, z: pending.current.z }, world)
      pending.current.box = pending.current.stretch ? { ...box, mode: 'crossing' } : box
      setMarquee(pending.current.box)
    }
    const active = commandRef.current
    if (active?.step === 'to' && originPlan.current && active.name !== 'measure') {
      setPlan(runCommand(originPlan.current, picks, { ...active, ortho: angleStep === 90 && !shiftRef.current }, snappedPoint(world)))
    } else if (active?.name === 'measure' && active.step === 'to') {
      setCommand((current) => (current ? { ...current, readout: measureReadout(current, world) } : current))
    }
    if (hostRef.current) {
      const frame = hostRef.current.getBoundingClientRect()
      setPointerPx({ x: event.clientX - frame.left, y: event.clientY - frame.top })
    }
    if (drawEditedRef.current && draft && (tool === 'exterior' || tool === 'interior')) {
      const parsed = parseDrawFields(typedRef.current, drawAngleRef.current)
      const ortho = angleStepRef.current === 90 && !shiftRef.current
      const next = parsed ? pointFromDraw(draft, visual?.point || world, parsed, { ortho, lockAngle: lockAngleRef.current }) : null
      if (next) setDrawGuide(next)
    } else if (!typingDraw) setDrawGuide(null)
    const radius = Math.max(12 / Math.max(ppm2d, 0.001), 0.45)
    if (dragCorner.current) {
      const snap = altRef.current
        ? { point: world }
        : snapPoint(world, { walls: (dragBefore.current || plan).walls, grid: gridStep, radius: snapRadius(ppm2d, 14), enabled: true, ignore: dragCorner.current.origin })
      const to = snap.point
      const origin = dragCorner.current.origin
      if (Math.hypot(to.x - origin.x, to.z - origin.z) > 0.001) {
        dragCorner.current.moved = true
        const base = dragBefore.current || plan
        setPlan(moveCorner(base, origin, to, { free: shiftRef.current || angleStep === 0 }))
      } else if (dragCorner.current.moved && dragBefore.current) {
        dragCorner.current.moved = false
        setPlan(dragBefore.current)
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

  const onPointerUp = (event) => {
    if (event?.pointerType === 'touch') {
      if (event.nativeEvent?.__refcadUp && event.eventPhase !== 1) return
      if (event.nativeEvent) event.nativeEvent.__refcadUp = true
      const tap = endTouch(event)
      if (!tap) return
      onPointerDown({
        pointerType: 'mouse',
        button: 0,
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        detail: 1,
        preventDefault() {},
        currentTarget: event.currentTarget,
      })
    }
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
    const placingOne = Boolean(placing || svcTool === 'node' || tool === 'door' || tool === 'window' || tool === 'passage' || yardPlacesOne(yardTool))
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
        showToast(t('toast.already', { name: candidate.name || t('toast.target') }))
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
            showToast(t('toast.already', { name: spec.name || t('toast.target') }))
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
        setChainCount(0)
        setDraft(next)
        typedRef.current = ''
        setTypedLen('')
        drawAngleRef.current = ''
        setDrawAngle('')
        drawEditedRef.current = false
        setDrawEdited(false)
        lockAngleRef.current = null
        segmentUndo.current = []
        if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches) setFocusDraw((value) => value + 1)
        return
      }
      commitWallRef.current(draft, next)
      return
    }
    if (tool === 'door' || tool === 'window' || tool === 'passage') {
      const along = visual?.wall ? visual : snapAlongWall(world, plan.walls, Math.max(12 / Math.max(ppm, 0.001), 0.35), !altRef.current)
      if (!along?.wall) return
      const openingName = tool === 'door' ? t('tool.door') : tool === 'passage' ? t('tool.passage') : t('tool.window')
      if (blocked([], { name: openingName, x: 0, z: 0 }, () => 'opening')) return
      const before = (plan.openings || []).length
      const next = refreshHeat(addOpening(plan, along.wall.id, along.point || point, tool, tool === 'door' ? doorHand : {}))
      if ((next.openings || []).length === before) {
        showToast(t('toast.already', { name: openingName }))
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
      const created = drafted.fixtures[drafted.fixtures.length - 1]
      const spec = FIXTURES.find((item) => item.id === placing)
      if (!created) return
      if (blocked(plan.fixtures || [], { ...created, name: spec?.name || 'Kaluste' }, fixtureKey, (existing) => {
        setSelectedFixture(existing.id)
        setPick({ kind: 'fixture', id: existing.id })
      })) return
      commit(drafted)
      setSelectedFixture(created.id)
      setPick({ kind: 'fixture', id: created.id })
      finishSingle()
    }
  }

  commitWallRef.current = (start, end) => {
    const chain = chainRef.current || (chainStart ? { start: chainStart, count: 0 } : null)
    const locked = lockOrthoPoint(start, end, 2)
    const closing = shouldCloseChain(chain, end) || shouldCloseChain(chain, locked)
    const target = closing ? chain.start : locked
    if (!start || !target || segmentLength(start, target) <= 0.05) {
      clearGuides()
      if (closing) {
        chainRef.current = null
        setChainStart(null)
        setChainCount(0)
        setDraft(null)
      }
      return
    }
    segmentUndo.current.push({
      anchor: { x: start.x, z: start.z },
      chain: chain ? { start: { ...chain.start }, count: chain.count || 0 } : null,
      chainStart: chainStart ? { x: chainStart.x, z: chainStart.z } : (chain?.start ? { ...chain.start } : null),
    })
    commit(refreshHeat(addWall(plan, start, target, tool, {
      align: alignForReference(wallRefMode, refSide),
      axisDeg: 2,
    })))
    setDrawGuide(null)
    typedRef.current = ''
    setTypedLen('')
    drawAngleRef.current = ''
    setDrawAngle('')
    drawEditedRef.current = false
    setDrawEdited(false)
    lockAngleRef.current = null
    if (closing) {
      chainRef.current = null
      setChainStart(null)
      setChainCount(0)
      setDraft(null)
      return
    }
    chainRef.current = { start: chain?.start || start, count: (chain?.count || 0) + 1 }
    setChainCount((chain?.count || 0) + 1)
    setDraft(target)
  }

  undoSegmentRef.current = () => {
    const mark = segmentUndo.current.pop()
    typedRef.current = ''
    setTypedLen('')
    drawAngleRef.current = ''
    setDrawAngle('')
    drawEditedRef.current = false
    setDrawEdited(false)
    lockAngleRef.current = null
    setDrawGuide(null)
    if (!mark) {
      chainRef.current = null
      setChainStart(null)
      setChainCount(0)
      setDraft(null)
      return
    }
    const prev = history.current.pop()
    if (prev) {
      setPlan((current) => {
        redo.current = [...redo.current, current].slice(-40)
        return prev
      })
    }
    chainRef.current = mark.chain
    setChainStart(mark.chainStart)
    setChainCount(mark.chain?.count || 0)
    setDraft(mark.anchor)
  }

  closeChainRef.current = () => {
    const chain = chainRef.current
    const origin = draftRef.current
    if (!chain?.start || !origin || (chain.count || 0) < 2) return
    commitWallRef.current(origin, chain.start)
  }

  endDrawingRef.current = (world) => {
    if ((tool === 'exterior' || tool === 'interior') && draft) {
      const end = drawGuide || snapVisual?.point || world
      if (end && segmentLength(draft, end) > 0.05) commitWallRef.current(draft, end)
      else {
        chainRef.current = null
        setChainStart(null)
        setChainCount(0)
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
    if (event.target?.closest?.('[data-testid="dim-hit"]') || event.target?.closest?.('[data-testid="wall-length-edit"]') || event.target?.closest?.('[data-testid="wall-draw-input"]')) return
    if (event.pointerType === 'touch') {
      if (event.nativeEvent?.__refcadTouch && event.eventPhase !== 1) return
      if (event.nativeEvent) event.nativeEvent.__refcadTouch = true
      beginTouch(event)
      return
    }
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
      if (command.name === 'shift-wall' && command.step === 'from') {
        const host = (originPlan.current || plan).walls.find((item) => item.id === command.wallId)
        const hit = nearestWall(host ? [host] : [], point, 0.45)
        if (!hit) return
        const next = { ...command, step: 'to', from: { x: hit.x, z: hit.z } }
        commandRef.current = next
        setCommand(next)
        return
      }
      if (command.name === 'shift-wall' && command.step === 'to') {
        confirmCommand(point)
        return
      }
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
    if (svcTool || yardTool || tool === 'room' || tool === 'detect' || tool === 'exterior' || tool === 'interior' || tool === 'door' || tool === 'window' || tool === 'passage' || placing) {
      if (trackRef.current?.armed === 'pick' && (tool === 'exterior' || tool === 'interior' || tool === 'door' || tool === 'window' || tool === 'passage' || placing)) {
        const visual = describeSnap(world, ppm2d)
        const corner = nearestEndpoint(plan.walls, world, snapRadius(ppm2d, 16))
        const base = corner ? { x: corner.x, z: corner.z } : (visual?.point || world)
        const next = { base: { x: base.x, z: base.z }, axis: trackRef.current.axis || 'along', text: '', armed: 'type' }
        trackRef.current = next
        setTrack(next)
        return
      }
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
      dragCorner.current = { origin: { x: corner.x, z: corner.z }, moved: false }
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
      const drawingToolKey = tool === 'exterior' || tool === 'interior'
      if (drawingWall && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        undoSegmentRef.current()
        return
      }
      if (drawingWall && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'Tab') {
        event.preventDefault()
        const next = drawFieldRef.current === 'length' ? 'angle' : 'length'
        drawFieldRef.current = next
        setDrawField(next)
        const node = next === 'angle' ? drawAngRef.current : drawLenRef.current
        node?.focus()
        return
      }
      if (drawingWall && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        closeChainRef.current()
        return
      }
      const drawChar = event.key === ',' ? '.' : event.key
      const isDrawChar = /^[0-9.]$/.test(drawChar) || event.key === '<' || event.key === '@'
      if (drawingWall && !event.ctrlKey && !event.metaKey && !event.altKey && isDrawChar) {
        event.preventDefault()
        if (lockAngleRef.current == null && draftRef.current && liveRef.current) {
          lockAngleRef.current = Math.atan2(liveRef.current.z - draftRef.current.z, liveRef.current.x - draftRef.current.x)
        }
        if (event.key === '<' || drawFieldRef.current === 'angle') {
          if (event.key !== '<' && event.key !== '@') {
            drawAngleRef.current = `${drawAngleRef.current}${drawChar}`.slice(0, 8)
            setDrawAngle(drawAngleRef.current)
          }
          drawFieldRef.current = 'angle'
          setDrawField('angle')
        } else {
          const next = `${typedRef.current}${event.key === '@' ? '@' : drawChar}`.replace(/^@?0+(?=\d)/, (prefix) => (prefix.startsWith('@') ? '@' : '')).slice(0, 16)
          typedRef.current = next
          setTypedLen(next)
        }
        drawEditedRef.current = true
        setDrawEdited(true)
        const parsed = parseDrawFields(typedRef.current, drawAngleRef.current)
        const ortho = angleStepRef.current === 90 && !shiftRef.current
        const guide = parsed ? pointFromDraw(draftRef.current, liveRef.current, parsed, { ortho, lockAngle: lockAngleRef.current }) : null
        if (guide) setDrawGuide(guide)
        return
      }
      if (drawingWall && event.key === 'Backspace') {
        event.preventDefault()
        if (drawFieldRef.current === 'angle' && drawAngleRef.current) {
          drawAngleRef.current = drawAngleRef.current.slice(0, -1)
          setDrawAngle(drawAngleRef.current)
          return
        }
        if (typedRef.current) {
          typedRef.current = typedRef.current.slice(0, -1)
          setTypedLen(typedRef.current)
          if (!typedRef.current && !drawAngleRef.current) {
            drawEditedRef.current = false
            setDrawEdited(false)
            lockAngleRef.current = null
            setDrawGuide(null)
          }
          return
        }
        undoSegmentRef.current()
        return
      }
      if (drawingWall && event.key === 'Enter') {
        event.preventDefault()
        const parsed = drawEditedRef.current ? parseDrawFields(typedRef.current, drawAngleRef.current) : null
        const origin = draftRef.current
        const toward = liveRef.current || origin
        const ortho = angleStepRef.current === 90 && !shiftRef.current
        if (origin && parsed && parsed.lengthMm >= 50) {
          const guide = pointFromDraw(origin, toward, parsed, { ortho, lockAngle: lockAngleRef.current })
          if (guide) commitWallRef.current(origin, guide)
          return
        }
        exitToSelect()
        return
      }
      if (drawingToolKey && !draftRef.current && event.key === 'Escape') {
        exitToSelect()
        return
      }
      const trackingTool = !draftRef.current && (tool === 'exterior' || tool === 'interior' || tool === 'door' || tool === 'window' || placing)
      if (trackingTool && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === 'Tab') {
          event.preventDefault()
          setTrack((current) => {
            const next = {
              base: current?.base || null,
              axis: nextTrackAxis(current?.axis || 'along'),
              text: current?.text || '',
              armed: current?.armed || null,
            }
            trackRef.current = next
            return next
          })
          return
        }
        if (event.key.toLowerCase() === 'g') {
          event.preventDefault()
          const next = { base: null, axis: 'along', text: '', armed: 'pick' }
          trackRef.current = next
          setTrack(next)
          return
        }
        const trackNow = trackRef.current
        const canType = Boolean(trackNow?.base)
        if (canType && event.key === 'Backspace' && trackNow.text) {
          event.preventDefault()
          const next = { ...trackNow, text: trackNow.text.slice(0, -1) }
          trackRef.current = next
          setTrack(next)
          return
        }
        if (canType && (/^[0-9]$/.test(event.key) || event.key === '.' || event.key === ',' || event.key === ';' || event.key === '-')) {
          event.preventDefault()
          const next = { ...trackNow, text: `${trackNow.text || ''}${event.key}`.slice(0, 18) }
          trackRef.current = next
          setTrack(next)
          return
        }
        if (event.key === 'Enter' && canType && trackNow.text) {
          event.preventDefault()
          const live = trackedPoint(trackNow.base, cursor || trackNow.base, plan.walls, { axis: trackNow.axis || 'along', text: trackNow.text })
          const cleared = { ...trackNow, text: '' }
          trackRef.current = cleared
          setTrack(cleared)
          if (tool === 'exterior' || tool === 'interior') {
            chainRef.current = { start: live.point, count: 0 }
            setChainStart(live.point)
            setDraft(live.point)
            typedRef.current = ''
            setTypedLen('')
          } else if (tool === 'door' || tool === 'window') {
            const hit = nearestWall(plan.walls, live.point, 0.8)
            if (hit?.wall) {
              const nextPlan = refreshHeat(addOpening(plan, hit.wall.id, live.point, tool, tool === 'door' ? doorHand : {}))
              commit(nextPlan)
              const created = (nextPlan.openings || []).slice(-1)[0]
              if (created) choose({ kind: 'opening', id: created.id })
              trackRef.current = null
              setTrack(null)
              if (!repeatPlace) exitToSelect()
            }
          } else if (placing) {
            const drafted = addFixture(plan, placing, live.point.x, live.point.z, 0.45)
            const created = drafted.fixtures?.[drafted.fixtures.length - 1]
            if (created) {
              commit(drafted)
              setSelectedFixture(created.id)
              setPick({ kind: 'fixture', id: created.id })
              trackRef.current = null
              setTrack(null)
              if (!repeatPlace) exitToSelect()
            }
          }
          return
        }
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
        trackRef.current = null
        setTrack(null)
        setDimEdit(null)
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
  }, [commit, plan, selectedFixture, undo, redoChange, tool, placing, poly, pick, picks, command, cursor, partitions, svcTool, svcPoints, svcKind, view, yardTool, yardPoints, sheetMode, exitToSelect, requestFit, doorHand, repeatPlace])

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
    setPanel('object')
    if (panel === 'house') setSettingsOpen(true)
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
      if (action === 'house') setSettingsOpen(true)
      else setPanel('object')
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

  const access = accessFor(account, plan.projectType || null)
  useEffect(() => {
    if (access.workspaces.length && !access.workspaces.includes(workspace)) setWorkspace('rakenne')
  }, [account, plan.projectType, workspace, access.workspaces])
  const savePdf = (doc, name) => {
    if (access.watermark) stampDemoWatermark(doc, t('watermark.demo'))
    doc.save(name)
  }

  const exportPdf = () => {
    savePdf(buildPlanPdf(plan), `${(plan.name || 'pohjakuva').replace(/\s+/g, '-')}.pdf`)
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
  angleStepRef.current = angleStep
  const drawingWalls = tool === 'exterior' || tool === 'interior'
  const stepText = drawingWalls ? drawStepText(draft, chainCount, locale) : ''
  const drawAlign = alignForReference(wallRefMode, refSide)
  const liveMm = draft && liveEnd ? Math.max(0, Math.round(segmentLength(draft, liveEnd) * 1000)) : 0
  const liveDeg = draft && liveEnd ? wallDirection({ a: draft, b: liveEnd }) : 0
  useEffect(() => {
    if (view !== '2d' || !drawingWalls || !draft || !liveEnd) return
    const viewW = size.w
    const viewH = size.h
    if (viewW < 80 || viewH < 80) return
    const zoom = camera.zoom || 1
    const ax = camera.x + X(draft.x) * zoom
    const ay = camera.y + Y(draft.z) * zoom
    const bx = camera.x + X(liveEnd.x) * zoom
    const by = camera.y + Y(liveEnd.z) * zoom
    const edge = 88
    const availW = Math.max(40, viewW - edge * 2)
    const availH = Math.max(40, viewH - edge * 2)
    const spanX = Math.abs(bx - ax)
    const spanY = Math.abs(by - ay)
    if (spanX > availW + 8 || spanY > availH + 8) {
      const factor = Math.min(availW / Math.max(spanX, 1), availH / Math.max(spanY, 1), 0.92)
      const nextZoom = Math.max(0.2, zoom * factor)
      if (nextZoom < zoom - 0.01) {
        setCamera((current) => zoomAt(current, (ax + bx) / 2, (ay + by) / 2, nextZoom / zoom))
        return
      }
    }
    const minX = Math.min(ax, bx)
    const maxX = Math.max(ax, bx)
    const minY = Math.min(ay, by)
    const maxY = Math.max(ay, by)
    const inset = edge + 18
    let dx = 0
    let dy = 0
    if (spanX <= availW + 8) {
      if (minX < edge) dx = inset - minX
      else if (maxX > viewW - edge) dx = viewW - edge - maxX
    }
    if (spanY <= availH + 8) {
      if (minY < edge) dy = inset - minY
      else if (maxY > viewH - edge) dy = viewH - edge - maxY
    }
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) setCamera((current) => panBy(current, dx, dy))
  }, [view, drawingWalls, draft, liveEnd, size.w, size.h, camera, X, Y])
  trackRef.current = track
  const trackingActive = !draft && !command && (tool === 'exterior' || tool === 'interior' || tool === 'door' || tool === 'window' || placing)
  const trackLive = trackingActive && track?.base && cursor
    ? trackedPoint(track.base, cursor, plan.walls, { axis: track.axis || 'along', text: track.text || '' })
    : null
  const placeDims = (tool === 'door' || tool === 'window') && snapVisual?.wall
    ? placementGaps(snapVisual.wall, snapVisual.point || cursor, tool)
    : []
  const dimTarget = command?.name === 'shift-wall'
    ? { kind: 'wall', id: command.wallId }
    : (tool === 'select' && !placing
      ? (pick?.kind === 'wall' || pick?.kind === 'opening'
        ? pick
        : (selectedFixture ? { kind: 'fixture', id: selectedFixture } : (picks.find((item) => item.kind === 'wall' || item.kind === 'opening') || null)))
      : null)
  const selectedDims = dimTarget && placeDims.length === 0 ? temporaryDimensions(plan, dimTarget) : []
  const shownDims = [...placeDims, ...selectedDims]
  let shiftLive = null
  if (command?.name === 'shift-wall' && command.step === 'to' && command.from && cursor && originPlan.current) {
    const host = (originPlan.current.walls || []).find((item) => item.id === command.wallId)
    if (host) {
      const metres = wallShiftMetres(host, command.from, snapVisual?.point || cursor, command.value, command.distanceMode || 'offset')
      const axes = wallAxes(host)
      const mid = { x: (host.a.x + host.b.x) / 2, z: (host.a.z + host.b.z) / 2 }
      shiftLive = {
        x1: mid.x,
        z1: mid.z,
        x2: mid.x + axes.nx * metres,
        z2: mid.z + axes.nz * metres,
        mm: Math.abs(Math.round(metres * 1000)),
      }
    }
  }
  const applyDimValue = (dim, raw) => {
    const mm = Number(String(raw ?? '').replace(',', '.'))
    if (!Number.isFinite(mm)) return
    if (dim.role === 'place-start' || dim.role === 'place-end') {
      const wall = (plan.walls || []).find((item) => item.id === dim.wallId)
      if (!wall) return
      const kind = dim.kind || tool
      const width = defaultOpeningWidth(kind)
      const offset = offsetForEndGap(wall, width, dim.role === 'place-start' ? { fromStart: mm / 1000 } : { fromEnd: mm / 1000 })
      const point = pointAtOffset(wall, offset)
      const next = refreshHeat(addOpening(plan, wall.id, point, kind, kind === 'door' ? doorHand : {}))
      commit(next)
      const created = (next.openings || []).slice(-1)[0]
      if (created) choose({ kind: 'opening', id: created.id })
      setDimEdit(null)
      trackRef.current = null
      setTrack(null)
      if (!repeatPlace) exitToSelect()
      return
    }
    const source = command?.name === 'shift-wall' ? plan : (originPlan.current || plan)
    const next = applyTemporaryDimension(source, dim, mm)
    if (originPlan.current) {
      const baseline = originPlan.current
      history.current = [...history.current, baseline].slice(-40)
      redo.current = []
      originPlan.current = null
      commandRef.current = null
      setCommand(null)
      const bound = bindFlues(next)
      setPlan(fixtureServiceKey(baseline) === fixtureServiceKey(bound) ? bound : syncFixtureServices(bound))
    } else {
      commit(next)
    }
    setDimEdit(null)
  }
  const roomCursor = tool === 'room' ? snapVisual?.point || null : null
  const liveLength = draft && liveEnd ? segmentLength(draft, liveEnd) : 0
  const spec = PLACEABLES.find((item) => item.id === svcKind)
  const placingOne = Boolean(placing || svcTool === 'node' || tool === 'door' || tool === 'window' || tool === 'passage' || yardPlacesOne(yardTool))
  const drawingTool = Boolean(!placingOne && (tool === 'exterior' || tool === 'interior' || tool === 'room' || tool === 'detect' || svcTool === 'run' || (yardTool && !yardPlacesOne(yardTool))))
  const toolLabel = tool === 'detect' ? t('tool.detectRoom') : (t(`tool.${tool}`) === `tool.${tool}` ? null : t(`tool.${tool}`))
  const activeName = placing
    ? (FIXTURES.find((item) => item.id === placing)?.name || t('furniture.item'))
    : svcTool
      ? (spec?.name || t('service.device'))
      : yardTool
        ? yardToolLabel(yardTool)
        : (tool === 'select' ? null : toolLabel)
  const workspaceItem = WORKSPACES.find((item) => item.id === workspace)
  const workspaceName = workspaceItem ? t(`workspace.${workspaceItem.id}`) : ''
  const modeLabel = modeChipText({ workspace: workspaceName, name: activeName, repeat: repeatPlace && placingOne, drawing: drawingTool })
  const engaged = Boolean(activeName)
  const status = engaged
    ? `${modeLabel}${liveEnd ? ` · ${formatMm(liveLength)}` : ''}`
    : t('status.select')

  const px = (metres) => metres * layout.scale * k

  const onProjectType = (id) => {
    const current = planRef.current
    const currentId = current.projectType || 'omakotitalo'
    if (!id || id === currentId) return
    if (id === 'kylmio' && hasHouseElements(current)) {
      setTypeAsk(true)
      return
    }
    setTypeAsk(false)
    setView('2d')
    setSheetMode('plan')
    setWorkspace('rakenne')
    commit(applyProjectType(current, id))
  }
  const confirmColdType = (remove) => {
    const current = planRef.current
    const base = remove ? stripHouseElements(current) : current
    setView('2d')
    setSheetMode('plan')
    setWorkspace('rakenne')
    commit(applyProjectType(base, 'kylmio'))
    setTypeAsk(false)
  }

  if (isColdProject(plan)) {
    return (
      <ColdWorkspace
        plan={plan}
        onProjectType={onProjectType}
        onName={(name) => setPlan((current) => (current.name === name ? current : { ...current, name }))}
      />
    )
  }

  if (access.admin || !access.draw) {
    return (
      <div data-testid="draw-blocked" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#0f172a' }}>
        <div style={{ textAlign: 'center', maxWidth: 460 }}>
          <h1>{access.admin ? t('gate.admin') : t('gate.accountOff')}</h1>
          <a href={access.admin ? '/admin' : '/'}>{access.admin ? t('shell.admin') : t('shell.home')}</a>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="house-workspace" data-project-type={plan.projectType || 'omakotitalo'} className="plan-app" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#e7e5e4', color: '#1c1917' }} onPointerDown={() => setMenu(null)}>
      {infoOpen && (
        <ProjectInfoDialog
          projectType={plan.projectType || 'omakotitalo'}
          onCancel={() => setInfoOpen(false)}
          onConfirm={(id) => { setInfoOpen(false); onProjectType(id) }}
        />
      )}
      {settingsOpen && (
        <ProjectSettingsDialog title={t('file.projectSettings')} onClose={() => setSettingsOpen(false)}>
          <HouseSettings plan={plan} onApply={setPlan} />
        </ProjectSettingsDialog>
      )}
      {typeAsk && (
        <div data-testid="house-hide-ask" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(28,25,23,0.45)', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ width: 440, maxWidth: '100%', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 750, marginBottom: 8 }}>{t('cold.hideTitle')}</div>
            <p style={{ margin: 0, fontSize: 14, color: '#44403c', lineHeight: 1.45 }}>
              {t('cold.hideLead')}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" data-testid="house-hide-keep" onClick={() => confirmColdType(false)} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{t('cold.hide')}</button>
              <button type="button" data-testid="house-hide-remove" onClick={() => confirmColdType(true)} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #b91c1c', background: '#fff', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' }}>{t('cold.removeHouse')}</button>
              <button type="button" data-testid="house-hide-cancel" onClick={() => setTypeAsk(false)} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #d6d3d1', background: '#fff', color: '#1c1917', fontWeight: 650, cursor: 'pointer' }}>{t('projects.cancel')}</button>
            </div>
          </div>
        </div>
      )}
      {access.pending && (
        <div data-testid="order-thanks" style={{ background: '#f0fdf4', color: '#166534', textAlign: 'center', padding: '8px 12px', fontWeight: 650 }}>
          {t('price.thanks')}
        </div>
      )}
      <PlanChrome
        t={t}
        plan={plan}
        locale={locale}
        setLocale={(next) => { setLocale(next); setPlan((current) => ({ ...current, locale: next })) }}
        mode={view === '3d' ? '3d' : view === 'facade' ? 'facade' : sheetMode === 'site' ? 'site' : 'plan'}
        tool={tool}
        placing={placing}
        roomShape={roomShape}
        yardTool={yardTool}
        polyReady={poly.length >= 3}
        gridStep={gridStep}
        angleStep={angleStep}
        camera={camera}
        display={display}
        panel={settingsOpen ? 'house' : panel}
        command={command}
        svcSystem={svcSystem}
        svcKind={svcKind}
        svcTool={svcTool}
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
          toolRef.current = next
          placingRef.current = null
          yardToolRef.current = null
          clearGuides()
          setHand(false)
          setTool(next)
          setPlacing(null)
          setSvcTool(null)
          setYardTool(null)
          if (next === 'select' || next === 'door' || next === 'window') setDraft(null)
          if (next === 'exterior') setWallRefMode('outer')
          if (next === 'interior') setWallRefMode('center')
          if (next === 'detect') { setDraft(null); setPoly([]) }
        }}
        onRoomRect={() => {
          if (tool === 'room' && roomShape === 'rect') { exitToSelect(); return }
          toolRef.current = 'room'
          clearGuides()
          setHand(false)
          setTool('room'); setRoomShape('rect'); setPlacing(null); setSvcTool(null); setYardTool(null); setPoly([])
        }}
        onRoomPoly={() => {
          if (tool === 'room' && roomShape === 'poly') { exitToSelect(); return }
          toolRef.current = 'room'
          clearGuides()
          setHand(false)
          setTool('room'); setRoomShape('poly'); setPlacing(null); setSvcTool(null); setYardTool(null); setDraft(null)
        }}
        onUndo={undo}
        onRedo={redoChange}
        onNew={() => { setMenu(null); setNewOpen(true) }}
        onOpen={() => { setMenu(null); setLibraryOpen(true) }}
        onHouse={() => { setSettingsOpen(true); setMenu(null) }}
        onDisplay={() => setDisplayOpen((open) => !open)}
        onExample={loadExample}
        onFamily={loadFamily}
        onProjectInfo={() => setInfoOpen(true)}
        onCloseRoom={() => closeRoom(poly)}
        onYardTool={(id) => {
          if (!id || id === yardTool) { exitToSelect(); return }
          setHand(false)
          setYardTool(id); setTool('select'); setPlacing(null); setSvcTool(null); setYardPoints([])
        }}
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
          setHand(false)
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
        onFinish={finishServiceRun}
        onRoute={() => {
          const systems = workspaceSystems(workspace)
          if (!systems.length) {
            showToast(t('toast.routeWorkspace'))
            return
          }
          let next = plan
          const notes = []
          systems.forEach((system) => {
            const routed = autoRoute(next, system, { floorHeating: workspace === 'lvi' && floorHeating })
            if (routed.routeNotice) notes.push(`${t(`system.${system}`)}: ${routed.routeNotice}`)
            next = routed
          })
          const clean = { ...next }
          delete clean.routeNotice
          const changed = JSON.stringify(clean.services?.runs || []) !== JSON.stringify(plan.services?.runs || [])
          if (notes.length) showToast(notes.join(' · '))
          else if (changed) showToast(t('toast.routesUpdated'))
          else showToast(t('service.upToDate'))
          if (changed) commit(syncYardServices(clean))
          setSvcPoints([])
        }}
        workspace={workspace}
        access={access}
        onProjectType={onProjectType}
        onWorkspace={(id) => {
          if (!access.workspaces.includes(id)) return
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
          setHand(false)
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
            showToast(t('service.noSuggest'))
            return
          }
          setGhosts(proposals)
          showToast(t('toast.suggest'))
        }}
        onAccept={() => {
          const systems = workspaceSystems(workspace)
          let next = plan
          systems.forEach((system) => { next = acceptEquipment(next, system, { floorHeating }) })
          if (next === plan) { setGhosts([]); return }
          commit(next)
          setGhosts([])
          showToast(t('toast.suggested'))
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
            savePdf(buildSitePdf(plan), `${(plan.name || 'site').replace(/\s+/g, '-')}-site.pdf`)
            return
          }
          if (id === 'png') { exportPng(); return }
          const doc = id === 'electric' ? buildElectricPdf(plan) : id === 'heat' || id === 'water' ? buildHydronicPdf(plan) : buildServicePdf(plan, id)
          savePdf(doc, `${(plan.name || 'talotekniikka').replace(/\s+/g, '-')}-${id}.pdf`)
        }}
        compact={compact}
        toolsOpen={toolsOpen}
        onToggleTools={() => setToolsOpen((open) => !open)}
        onCommand={beginCommand}
        onSelectType={(type) => remember(targetsByType(plan, type))}
        onCadLayer={(layer) => beginCommand('layer', layer)}
        repeat={repeatPlace}
        onRepeat={setRepeatPlace}
        onCleanup={() => {
          const result = removeStacked(plan)
          if (!result.removed) { showToast(t('toast.noneStacked')); return }
          commit(result.plan)
          showToast(t('toast.removedStacked', { count: result.removed }))
        }}
        onRemoveAuto={() => {
          const next = removeAutoAdded(plan)
          const before = (plan.services?.nodes?.length || 0) + (plan.services?.runs?.length || 0)
          const after = (next.services?.nodes?.length || 0) + (next.services?.runs?.length || 0)
          if (before === after) { showToast(t('toast.noneAuto')); return }
          commit(next)
          showToast(t('toast.removedAuto'))
        }}
        onStraighten={() => {
          const next = straightenWalls(plan, 2)
          if (next === plan) { showToast(t('toast.alreadyStraight')); return }
          commit(next)
          showToast(t('toast.straightened'))
        }}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
        {compact && drawer && (
          <button type="button" className="drawer-backdrop" data-testid="drawer-backdrop" aria-label={t('panel.closeInfo')} onClick={() => setDrawer(null)} />
        )}
        <aside
          className="plan-drawer"
          data-testid="plan-side"
          data-open={compact && drawer === 'library' ? 'true' : 'false'}
          style={compact ? undefined : { width: 232, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderRight: '1px solid #d6d3d1', padding: '10px 10px 18px' }}
        >
          {compact && <button type="button" data-testid="close-drawer" onClick={() => setDrawer(null)}>{t('panel.close')}</button>}
          <div data-testid="workspace-side-title" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#0f766e', margin: '0 4px 8px' }}>{workspaceName}</div>
          {workspace === 'rakenne' && (
            <p style={{ margin: '0 4px 8px', fontSize: 12, lineHeight: 1.45, color: '#44403c' }}>{t('panel.structure')}</p>
          )}
          {workspace === 'rakenne' && doorSchedule(plan).length > 0 && (
            <div data-testid="door-schedule" style={{ margin: '4px 4px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', marginBottom: 4 }}>{t('opening.schedule')}</div>
              {doorSchedule(plan).map((row, index) => (
                <div key={row.id} data-testid="door-schedule-row" data-style={row.style} data-mount={row.mount || ''} data-panels={row.panels} style={{ fontSize: 11, padding: '3px 0', borderBottom: '1px solid #f5f5f4' }}>
                  <div style={{ fontWeight: 700 }}>{index + 1}. {t(row.nameKey)}</div>
                  <div style={{ color: '#57534e' }}>
                    {Math.round(row.width * 1000)}×{Math.round(row.height * 1000)}
                    {row.mount ? ` · ${t(row.mount === 'surface' ? 'opening.surface' : 'opening.pocket')}` : ''}
                    {row.style === 'sliding' && row.panels === 2 ? ` · ${t('opening.panelTwo')}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
          {workspace === 'piha' && (
            <>
              <p style={{ margin: '0 4px 8px', fontSize: 12, lineHeight: 1.45, color: '#44403c' }}>{t('panel.site')}</p>
              <PihaTerraceLevels plan={plan} selection={pick} onCommit={commit} />
            </>
          )}
          {(workspace === 'sahko' || workspace === 'iv' || workspace === 'lvi') && (
            <div data-testid="device-library">
              <p style={{ margin: '0 4px 8px', fontSize: 12, lineHeight: 1.45, color: '#44403c' }}>{t('panel.service')}</p>
              {PLACEABLES.filter((item) => workspaceSystems(workspace).includes(item.system) && item.mode === 'node').map((item) => (
                <button key={item.id} type="button" data-testid={`side-device-${item.id}`} style={sideBtn(svcTool === 'node' && svcKind === item.id)} onClick={() => {
                  if (svcTool === 'node' && svcKind === item.id) { exitToSelect(); return }
                  setSvcSystem(item.system)
                  setSvcKind(item.id)
                  setHand(false)
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
                    setHand(false)
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
                    setHand(false)
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
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '0 4px 6px' }}>{t('furniture.schedule')}</div>
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

        <div className="plan-stage" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
          <div className="plan-status" style={{ minHeight: 28, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12, color: '#44403c', background: '#f5f5f4', borderBottom: '1px solid #e7e5e4', minWidth: 0, overflow: 'hidden' }}>
            {command ? (
              <CadPrompt
                command={command}
                onChange={(patch) => {
                  setCommand((current) => {
                    if (!current) return current
                    const next = { ...current, ...patch }
                    commandRef.current = next
                    if (next.step === 'to' && originPlan.current && cursor && next.name !== 'measure') {
                      setPlan(runCommand(originPlan.current, picks, { ...next, ortho: angleStep === 90 && !shiftRef.current }, snappedPoint(cursor)))
                    }
                    return next
                  })
                }}
                readout={shiftLive ? `${shiftLive.mm} mm` : command.readout}
                onApply={() => { if (command.step === 'to') confirmCommand(snappedPoint(cursor || command.from || command.base || { x: 0, z: 0 })) }}
                onCancel={cancelCommand}
              />
            ) : drawingWalls ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, width: '100%', overflow: 'hidden' }}>
                <span data-testid="draw-status" style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{activeName} · {stepText}</span>
                <span data-testid="draw-ortho" style={{ flex: 'none' }}>{angleStep === 0 ? t('draw.free') : angleStep === 90 ? t('draw.ortho') : `${angleStep}°`}</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span data-testid="status-tool">{track?.armed === 'pick' ? t('draw.fromPoint') : status}</span>
                {trackLive && <span data-testid="track-status" data-label={trackLive.label}>{trackLive.label}</span>}
                {trackingActive && (
                  <button
                    type="button"
                    data-testid="from-base"
                    style={statusBtn}
                    onClick={() => {
                      const next = { base: null, axis: 'along', text: '', armed: 'pick' }
                      trackRef.current = next
                      setTrack(next)
                    }}
                  >{t('draw.from')}</button>
                )}
                {tool === 'select' && !command && picks.some((item) => item.kind === 'wall') && (
                  <button type="button" data-testid="shift-wall" style={statusBtn} onClick={() => beginCommand('shift-wall')}>{t('draw.shiftWall')}</button>
                )}
              </span>
            )}
          </div>
          {view === 'facade' ? (
            <FacadeView
              plan={plan}
              watermark={access.watermark}
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
            <div
              ref={hostRef}
              data-testid="plan-canvas-frame"
              data-active={engaged ? 'place' : 'select'}
              onPointerLeave={() => {
                pointerInsideRef.current = false
                setPointerInside(false)
                clearGuides()
              }}
              onPointerEnter={() => {
                pointerInsideRef.current = true
                setPointerInside(true)
              }}
              style={{ flex: 1, minHeight: 0, background: '#d6d3d1', position: 'relative', ...placeFrame(engaged) }}
            >
              {drawingWalls && draft && (
                <DrawCursor
                  x={pointerPx?.x ?? Math.min(120, Math.max(24, (size.w || 800) * 0.28))}
                  y={pointerPx?.y ?? Math.min(96, Math.max(24, (size.h || 600) * 0.22))}
                  frameW={size.w}
                  frameH={size.h}
                  ax={draft && liveEnd ? camera.x + X(draft.x) * (camera.zoom || 1) : null}
                  ay={draft && liveEnd ? camera.y + Y(draft.z) * (camera.zoom || 1) : null}
                  bx={draft && liveEnd ? camera.x + X(liveEnd.x) * (camera.zoom || 1) : null}
                  by={draft && liveEnd ? camera.y + Y(liveEnd.z) * (camera.zoom || 1) : null}
                  clearance={14 + (0.28 * ppm2d) / 2}
                  field={drawField}
                  step={stepText}
                  lengthLabel={t('draw.length')}
                  angleLabel={t('draw.angle')}
                  showInput={Boolean(draft)}
                  lengthValue={drawEdited ? typedLen : (draft ? String(liveMm) : '')}
                  angleValue={drawAngle !== '' ? drawAngle : (draft ? String(liveDeg) : '')}
                  lengthRef={drawLenRef}
                  angleRef={drawAngRef}
                  onLength={(value) => {
                    typedRef.current = value
                    setTypedLen(value)
                    drawEditedRef.current = true
                    setDrawEdited(true)
                    if (lockAngleRef.current == null && draft && liveEnd) lockAngleRef.current = Math.atan2(liveEnd.z - draft.z, liveEnd.x - draft.x)
                    const parsed = parseDrawFields(value, drawAngleRef.current)
                    const guide = draft && parsed ? pointFromDraw(draft, liveEnd, parsed, { ortho: angleStep === 90 && !shiftRef.current, lockAngle: lockAngleRef.current }) : null
                    if (guide) setDrawGuide(guide)
                  }}
                  onAngle={(value) => {
                    drawAngleRef.current = value
                    setDrawAngle(value)
                    drawEditedRef.current = true
                    setDrawEdited(true)
                    drawFieldRef.current = 'angle'
                    const parsed = parseDrawFields(typedRef.current || String(liveMm), value)
                    const guide = draft && parsed ? pointFromDraw(draft, liveEnd, parsed, { ortho: false, lockAngle: null }) : null
                    if (guide) setDrawGuide(guide)
                  }}
                  onCommit={() => {
                    const parsed = parseDrawFields(drawEdited ? typedLen : String(liveMm), drawAngle !== '' ? drawAngle : String(liveDeg))
                    if (!draft || !parsed || parsed.lengthMm < 50) return
                    const angle = lockAngleRef.current ?? (liveEnd ? Math.atan2(liveEnd.z - draft.z, liveEnd.x - draft.x) : 0)
                    const guide = pointFromDraw(draft, liveEnd || draft, parsed, { ortho: angleStep === 90 && !shiftRef.current && parsed.angleDeg == null, lockAngle: parsed.angleDeg == null ? angle : null })
                    if (guide) commitWallRef.current(draft, guide)
                  }}
                  onSwitch={(next) => {
                    drawFieldRef.current = next
                    setDrawField(next)
                    const node = next === 'angle' ? drawAngRef.current : drawLenRef.current
                    node?.focus()
                    node?.select()
                  }}
                  onCancel={exitToSelect}
                  onUndo={() => undoSegmentRef.current()}
                />
              )}
              {wallLenEdit && (
                <input
                  data-testid="wall-length-edit"
                  autoFocus
                  inputMode="decimal"
                  value={wallLenEdit.value}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setWallLenEdit((current) => (current ? { ...current, value: event.target.value } : current))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      const mm = Number(String(wallLenEdit.value).replace(',', '.'))
                      if (Number.isFinite(mm) && mm >= 50 && wallLenEdit.dim) commit(resizeDimension(plan, wallLenEdit.dim, mm / 1000))
                      setWallLenEdit(null)
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      setWallLenEdit(null)
                    }
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  style={{ position: 'absolute', left: wallLenEdit.x, top: wallLenEdit.y, zIndex: 30, width: 96, height: 32, padding: '2px 8px', fontSize: 16, fontWeight: 700, color: '#134e4a', background: '#fff', border: '2px solid #0f766e', borderRadius: 6, boxShadow: '0 8px 18px rgba(28,25,23,0.18)' }}
                />
              )}
              {!drawingWalls && !wallLenEdit && <ModeChip workspace={workspaceName} name={activeName} repeat={repeatPlace && placingOne} drawing={drawingTool} />}
              {!wallLenEdit && <PlaceToast text={toast} />}
              <svg
                ref={svgRef}
                data-testid="floor-plan-svg"
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                height="100%"
                onPointerDownCapture={(event) => { if (event.pointerType === 'touch') onPointerDown(event) }}
                onPointerMoveCapture={(event) => { if (event.pointerType === 'touch') onPointerMove(event) }}
                onPointerUpCapture={(event) => { if (event.pointerType === 'touch') onPointerUp(event) }}
                onPointerMove={(event) => { if (event.pointerType !== 'touch') onPointerMove(event) }}
                onPointerDown={(event) => { if (event.pointerType !== 'touch') onPointerDown(event) }}
                onPointerUp={(event) => { if (event.pointerType !== 'touch') onPointerUp(event) }}
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
                  if (fig.kind === 'passage') {
                    return (
                      <g key={opening.id} data-testid="passage-mark" data-merge={opening.mergeSpaces ? '1' : '0'} data-lintel={opening.lintel ? '1' : '0'} stroke="#1c1917" fill="none" strokeLinecap="butt">
                        {(fig.faces || []).map((line, index) => (
                          <line key={index} data-testid="passage-face" x1={X(line.x1)} y1={Y(line.z1)} x2={X(line.x2)} y2={Y(line.z2)} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
                        ))}
                        <line data-testid="passage-jamb" x1={X(fig.jambA[0].x)} y1={Y(fig.jambA[0].z)} x2={X(fig.jambA[1].x)} y2={Y(fig.jambA[1].z)} strokeWidth={2.6} vectorEffect="non-scaling-stroke" />
                        <line data-testid="passage-jamb" x1={X(fig.jambB[0].x)} y1={Y(fig.jambB[0].z)} x2={X(fig.jambB[1].x)} y2={Y(fig.jambB[1].z)} strokeWidth={2.6} vectorEffect="non-scaling-stroke" />
                        {!opening.mergeSpaces && (
                          <line data-testid="passage-boundary" x1={X(fig.boundary.x1)} y1={Y(fig.boundary.z1)} x2={X(fig.boundary.x2)} y2={Y(fig.boundary.z2)} strokeWidth={1.3} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                        )}
                      </g>
                    )
                  }
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
                  const arcs = fig.style === 'folding' ? [] : (fig.arcs?.length ? fig.arcs : (fig.arc?.length ? [fig.arc] : []))
                  return (
                    <g key={opening.id} data-testid="door-mark" data-style={fig.style || 'hinged'} data-mount={fig.mount || ''} data-panels={fig.panels || 1} data-swing={opening.swing >= 0 ? 'left' : 'right'} data-leaf={opening.inward ? 'in' : 'out'} stroke={selectedOpening ? '#0f766e' : '#1c1917'} strokeWidth={1.05} fill="none">
                      <line data-testid="door-jamb" x1={X(fig.jambA[0].x)} y1={Y(fig.jambA[0].z)} x2={X(fig.jambA[1].x)} y2={Y(fig.jambA[1].z)} />
                      <line data-testid="door-jamb" x1={X(fig.jambB[0].x)} y1={Y(fig.jambB[0].z)} x2={X(fig.jambB[1].x)} y2={Y(fig.jambB[1].z)} />
                      {(fig.glass || []).map((line, index) => (
                        <line key={`glass-${index}`} x1={X(line.x1)} y1={Y(line.z1)} x2={X(line.x2)} y2={Y(line.z2)} />
                      ))}
                      {(fig.leaves || []).map((line, index) => (
                        <line key={`leaf-${index}`} data-testid="door-leaf-line" x1={X(line.a.x)} y1={Y(line.a.z)} x2={X(line.b.x)} y2={Y(line.b.z)} />
                      ))}
                      {arcs.map((arc, index) => (
                        <polyline key={`arc-${index}`} data-testid="door-arc" points={arc.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')} />
                      ))}
                      {(fig.rails || []).map((rail, index) => (
                        <line key={`rail-${index}`} data-testid="door-rail" data-dashed={rail.dashed ? '1' : '0'} strokeDasharray={rail.dashed ? '5 3' : undefined} x1={X(rail.a.x)} y1={Y(rail.a.z)} x2={X(rail.b.x)} y2={Y(rail.b.z)} />
                      ))}
                      {(fig.arrows || []).map((arrow, index) => {
                        const len = Math.hypot(arrow.to.x - arrow.from.x, arrow.to.z - arrow.from.z) || 1
                        const ux = (arrow.to.x - arrow.from.x) / len
                        const uz = (arrow.to.z - arrow.from.z) / len
                        const head = 0.14
                        const left = { x: arrow.to.x - ux * head + uz * head * 0.45, z: arrow.to.z - uz * head - ux * head * 0.45 }
                        const right = { x: arrow.to.x - ux * head - uz * head * 0.45, z: arrow.to.z - uz * head + ux * head * 0.45 }
                        return (
                          <g key={`arrow-${index}`} data-testid="door-arrow">
                            <line x1={X(arrow.from.x)} y1={Y(arrow.from.z)} x2={X(arrow.to.x)} y2={Y(arrow.to.z)} />
                            <polyline points={`${X(left.x)},${Y(left.z)} ${X(arrow.to.x)},${Y(arrow.to.z)} ${X(right.x)},${Y(right.z)}`} />
                          </g>
                        )
                      })}
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
                        if (event.pointerType === 'touch') return
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
                {sheetMode !== 'site' && <FaceLines plan={plan} X={X} Y={Y} interactive={tool === 'select'} selected={pick?.kind === 'room' ? pick : null} onSelect={(face) => {
                  setPick(face)
                  setSelectedRoom(face.id)
                  setPanel('object')
                  setMenu(null)
                }} />}
                </g>
                {sheetMode !== 'site' && plan.walls.length > 0 && (
                  <g data-testid="dimension-chains">
                    {stackDimensionLabels(dedupeDimensions(dimLines, 18 / (Math.max(camera.zoom || 1, 0.2) * Math.max(layout.scale * k, 0.001))), X, Y, camera.zoom || 1).map((dim, index) => {
                      const host = tool === 'select' ? wallForDimension(plan, dim) : null
                      const next = host ? { ...dim, wallId: host.id } : dim
                      return (
                        <DimLine
                          key={`dim-${index}-${next.wallId || 'x'}-${next.label}-${next.x1}-${next.z1}`}
                          dim={next}
                          witnesses={extensionWitnesses(next, plan)}
                          X={X}
                          Y={Y}
                          zoom={camera.zoom || 1}
                          onEdit={tool === 'select' ? (item, event) => {
                            const wall = (plan.walls || []).find((entry) => entry.id === item.wallId)
                            if (!wall) return
                            const frame = hostRef.current?.getBoundingClientRect()
                            const width = 96
                            const height = 32
                            let x = event.clientX
                            let y = event.clientY
                            if (frame) {
                              x = event.clientX - frame.left - width / 2
                              y = event.clientY - frame.top - height / 2
                              x = Math.min(Math.max(8, x), Math.max(8, frame.width - width - 8))
                              y = Math.min(Math.max(8, y), Math.max(8, frame.height - height - 8))
                            }
                            setWallLenEdit({
                              dim: item,
                              value: String(item.label || Math.round(segmentLength(wall.a, wall.b) * 1000)),
                              x,
                              y,
                            })
                          } : null}
                        />
                      )
                    })}
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
                {liveEnd && drawingWalls && (
                  <g data-testid="draw-preview" data-length={String(liveMm)} data-angle={String(liveDeg)} style={{ pointerEvents: 'none' }}>
                    <polygon
                      points={selectionRibbon({ a: draft, b: liveEnd, align: drawAlign, kind: tool === 'interior' ? 'interior' : 'exterior' }, plan).map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')}
                      fill="rgba(15,118,110,0.55)"
                      stroke="#0f766e"
                      strokeWidth={1.8 / (camera.zoom || 1)}
                    />
                    <line
                      data-testid="draw-reference"
                      x1={X(draft.x)}
                      y1={Y(draft.z)}
                      x2={X(liveEnd.x)}
                      y2={Y(liveEnd.z)}
                      stroke="#134e4a"
                      strokeWidth={1.6 / (camera.zoom || 1)}
                      strokeDasharray={`${7 / (camera.zoom || 1)} ${4 / (camera.zoom || 1)}`}
                    />
                  </g>
                )}
                {chainStart && draft && drawingWalls && (
                  <rect
                    data-testid="draw-origin"
                    x={X(chainStart.x) - 6 / (camera.zoom || 1)}
                    y={Y(chainStart.z) - 6 / (camera.zoom || 1)}
                    width={12 / (camera.zoom || 1)}
                    height={12 / (camera.zoom || 1)}
                    fill="#fff"
                    stroke="#ea580c"
                    strokeWidth={2 / (camera.zoom || 1)}
                    style={{ pointerEvents: 'none' }}
                  />
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
                    if (event.pointerType === 'touch') return
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
                      if (event.pointerType === 'touch') return
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
                {plan.walls.length === 0 && !engaged && (
                  <text data-testid="sheet-empty" x={sheet.x + sheet.w / 2} y={sheet.y + sheet.h / 2} textAnchor="middle" fontSize={15} fill="#78716c">{t('sheet.empty')}</text>
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
                <SnapMark snap={visibleSnap(snapVisual, guidesAllowed({ tool, placing, yardTool, pointerInside }))} X={X} Y={Y} zoom={camera.zoom} />
                {track?.base && !draft && (
                  <g data-testid="track-base" style={{ pointerEvents: 'none' }}>
                    <circle cx={X(track.base.x)} cy={Y(track.base.z)} r={8 / (camera.zoom || 1)} fill="#fff" stroke="#0f766e" strokeWidth={2 / (camera.zoom || 1)} />
                    <circle cx={X(track.base.x)} cy={Y(track.base.z)} r={2.4 / (camera.zoom || 1)} fill="#0f766e" />
                  </g>
                )}
                {trackLive && track?.base && (
                  <g data-testid="track-readout" data-label={trackLive.label} data-axis={trackLive.axis} style={{ pointerEvents: 'none' }}>
                    <line
                      x1={X(track.base.x)}
                      y1={Y(track.base.z)}
                      x2={X(trackLive.point.x)}
                      y2={Y(trackLive.point.z)}
                      stroke="#0f766e"
                      strokeWidth={1.6 / (camera.zoom || 1)}
                      strokeDasharray={`${7 / (camera.zoom || 1)} ${4 / (camera.zoom || 1)}`}
                    />
                    <g transform={`translate(${X(trackLive.point.x)} ${Y(trackLive.point.z)}) scale(${1 / (camera.zoom || 1)})`}>
                      <rect x={10} y={-22} width={Math.max(88, trackLive.label.length * 7.4)} height={18} rx={3} fill="#fff" stroke="#0f766e" />
                      <text x={16} y={-9} fontSize={12} fontWeight={700} fill="#0f766e">{trackLive.label}</text>
                    </g>
                  </g>
                )}
                {shiftLive && (
                  <g data-testid="shift-live" data-mm={shiftLive.mm} style={{ pointerEvents: 'none' }}>
                    <line x1={X(shiftLive.x1)} y1={Y(shiftLive.z1)} x2={X(shiftLive.x2)} y2={Y(shiftLive.z2)} stroke="#0f766e" strokeWidth={1.6 / (camera.zoom || 1)} />
                    <g transform={`translate(${X((shiftLive.x1 + shiftLive.x2) / 2)} ${Y((shiftLive.z1 + shiftLive.z2) / 2)}) scale(${1 / (camera.zoom || 1)})`}>
                      <text x={8} y={-8} fontSize={12} fontWeight={700} fill="#0f766e">{shiftLive.mm} mm</text>
                    </g>
                  </g>
                )}
                {shownDims.map((dim) => (
                  <TempDim
                    key={dim.id}
                    dim={dim}
                    X={X}
                    Y={Y}
                    zoom={camera.zoom}
                    editing={dimEdit?.id === dim.id ? dimEdit.value : null}
                    onEdit={(item) => setDimEdit({ id: item.id, value: String(Math.max(0, Math.round(item.mm))), dim: item })}
                    onChange={(value) => setDimEdit((current) => (current ? { ...current, value } : current))}
                    onCommit={() => { if (dimEdit?.dim) applyDimValue(dimEdit.dim, dimEdit.value) }}
                    onCancel={() => setDimEdit(null)}
                  />
                ))}
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
              onPrint={() => savePdf(buildElectricPdf(plan), `${(plan.name || 'sahko').replace(/\s+/g, '-')}-sahko.pdf`)}
              onAssign={(deviceId, circuitId) => commit(assignDeviceCircuit(plan, deviceId, circuitId))}
            />
          )}
          {heatView && (
            <HeatingPanel
              plan={plan}
              mode={heatView}
              onMode={setHeatView}
              onClose={() => setHeatView(null)}
              onPrint={() => savePdf(buildHydronicPdf(plan), `${(plan.name || 'lammitys').replace(/\s+/g, '-')}-lammitys.pdf`)}
            />
          )}
          {compact && (
            <div className="hand-bar" data-testid="hand-bar">
              <button type="button" data-testid="toggle-tools" aria-expanded={toolsOpen} onClick={() => setToolsOpen((open) => !open)}>{t('edit.tools')}</button>
              <button type="button" data-testid="toggle-hand" aria-pressed={hand} onClick={() => setHand((value) => !value)}>{hand ? t('edit.draw') : t('edit.pan')}</button>
              <button type="button" data-testid="toggle-library" aria-pressed={drawer === 'library'} onClick={() => setDrawer((current) => current === 'library' ? null : 'library')}>{t('panel.library')}</button>
              <button type="button" data-testid="toggle-drawer" aria-pressed={drawer === 'info'} onClick={() => setDrawer((current) => current === 'info' ? null : 'info')}>{t('panel.info')}</button>
            </div>
          )}
        </div>

        <aside
          data-testid="materials-panel"
          className="plan-info"
          data-open={compact && drawer === 'info' ? 'true' : 'false'}
          style={compact ? undefined : { width: 280, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderLeft: '1px solid #d6d3d1', padding: '12px 12px 20px' }}
        >
          {compact && <button type="button" data-testid="close-info" onClick={() => setDrawer(null)}>{t('panel.close')}</button>}
          {(tool === 'room' || tool === 'detect' || tool === 'exterior' || tool === 'interior' || (tool === 'door' && pick?.kind !== 'door')) && (
            <div data-testid="tool-properties" style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #e7e5e4' }}>
              <div style={{ fontSize: 12, fontWeight: 750, marginBottom: 8 }}>{t('panel.tool')}</div>
              {(tool === 'room' || tool === 'detect' || tool === 'exterior' || tool === 'interior') && (
                <WallToolSettings
                  plan={plan}
                  tool={tool}
                  onApply={setPlan}
                  wallRefMode={wallRefMode}
                  onRefMode={setWallRefMode}
                  onFlip={() => setRefSide((side) => (side === 'left' ? 'right' : 'left'))}
                  partitions={partitions}
                  onPartitions={setPartitions}
                />
              )}
              {tool === 'door' && pick?.kind !== 'door' && (
                <DoorPlaceControls t={t} value={doorHand} onChange={setDoorHand} />
              )}
            </div>
          )}
          {pick && (
            <div data-testid="panel-heading" style={{ marginBottom: 10 }}>
              <div data-testid="selection-title" style={{ fontSize: 15, fontWeight: 750 }}>{picks.length > 1 ? t('select.many', { count: picks.length }) : selectionLabel(plan, pick)}</div>
            </div>
          )}
          {pick && (
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
          <button type="button" data-testid="ctx-finish" onClick={() => { endDrawingRef.current(cursor); setMenu(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'transparent', fontWeight: 700, cursor: 'pointer' }}>{t('draw.finish')}</button>
        </div>
      )}
      <ServiceMenu menu={menu} plan={plan} onApply={commit} onCommit={commit} onClose={() => setMenu(null)} onProperties={() => onMenuNavigate('properties')} onRedraw={beginRedraw} onCad={beginCommand} />
    </div>
  )
}
