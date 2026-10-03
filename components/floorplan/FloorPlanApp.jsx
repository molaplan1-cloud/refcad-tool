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
  deleteOpening,
  facadeSide,
  deleteRoom,
  deleteWall,
  detectRoomAt,
  detectRooms,
  dimensionChains,
  dimensionRotation,
  drawRoom,
  emptyPlan,
  exampleHouse,
  familyHouse,
  formatArea,
  formatMm,
  hitTest,
  materialOf,
  materialsList,
  moveFixture,
  moveOpening,
  moveRoomLabel,
  openingSymbol,
  planBounds,
  pointInPolygon,
  duplicateFixture,
  removeFixture,
  roomLabelPoint,
  rotateFixture,
  segmentLength,
  viewLayout,
  visibleRooms,
  wallQuads,
  buildFloorPlanPdf,
} from '@/lib/floorplan'
import { FloorMenu, HouseSettings, SelectionPanel, selectionLabel } from './FloorMenus'
import { LibraryDialog, ShellDialog, StartDialog } from './ProjectDialogs'
import FacadeView from './FacadeView'
import { ServiceBar, ServiceDrawing, ServiceMenu } from './ServicesLayer'
import {
  PLACEABLES,
  addServiceNode,
  addServiceRun,
  deleteServiceNode,
  deleteServiceRun,
  autoRouteAll,
  buildServicePdf,
  SERVICE_SYSTEMS,
  ensureServices,
  hitService,
  layerVisible,
  snapServicePoint,
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

function sheetPixels(size, plan) {
  const layout = viewLayout(plan)
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

function RoomName({ item, label, X, Y }) {
  const poly = item.polygon || []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  poly.forEach((point) => {
    const x = X(point.x)
    const y = Y(point.z)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  })
  const boxW = Math.max(16, maxX - minX - 8)
  const boxH = Math.max(16, maxY - minY - 6)
  const name = item.name || 'Huone'
  const whole = boxW / Math.max(name.length * 0.58, 1)
  const splitAt = whole >= 9.5 || name.length <= 8
    ? name.length
    : (name.indexOf('huone') > 2 ? name.indexOf('huone') : Math.ceil(name.length / 2))
  const lines = splitAt < name.length ? [name.slice(0, splitAt), name.slice(splitAt)] : [name]
  const longest = Math.max(...lines.map((line) => line.length), 1)
  const font = Math.max(7.5, Math.min(13, boxW / (longest * 0.6), boxH / (lines.length + 1.2)))
  const areaSize = Math.max(7, font - 1.5)
  const cx = X(label.x)
  const cy = Y(label.z)
  const lineH = font + 1
  const blockH = lines.length * lineH + areaSize + 3
  const top = cy - blockH / 2 + font
  return (
    <>
      {lines.map((line, index) => (
        <text key={`${line}-${index}`} x={cx} y={top + index * lineH} textAnchor="middle" fontSize={font} fontWeight={700} fill="#1c1917" stroke="#fbfaf7" strokeWidth={3.2} paintOrder="stroke">{line}</text>
      ))}
      <text x={cx} y={top + lines.length * lineH + 1} textAnchor="middle" fontSize={areaSize} fill="#44403c" stroke="#fbfaf7" strokeWidth={3} paintOrder="stroke">{formatArea(item.area)}</text>
    </>
  )
}

function DimLine({ dim, offset, X, Y }) {
  const off = Number.isFinite(dim.offset) ? dim.offset : offset
  const x1 = X(dim.x1 + (dim.nx || 0) * off)
  const y1 = Y(dim.z1 + (dim.nz || 0) * off)
  const x2 = X(dim.x2 + (dim.nx || 0) * off)
  const y2 = Y(dim.z2 + (dim.nz || 0) * off)
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const tick = 6
  const tx = Math.cos(ang + Math.PI / 4) * tick
  const ty = Math.sin(ang + Math.PI / 4) * tick
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
  const textW = Math.max(22, String(dim.label).length * 6.6)
  const gap = len > textW + 16 ? textW : 0
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const labelX = mx + (gap ? 0 : -uy * 11)
  const labelY = my + (gap ? 0 : ux * 11)
  const ax1 = X(dim.ax ?? dim.x1)
  const ay1 = Y(dim.az ?? dim.z1)
  const ax2 = X(dim.bx ?? dim.x2)
  const ay2 = Y(dim.bz ?? dim.z2)
  return (
    <g stroke="#292524" fill="#1c1917" strokeWidth={0.9}>
      {Math.hypot(ax1 - x1, ay1 - y1) > 1.5 && <line x1={ax1} y1={ay1} x2={x1} y2={y1} stroke="#a8a29e" strokeWidth={0.55} />}
      {Math.hypot(ax2 - x2, ay2 - y2) > 1.5 && <line x1={ax2} y1={ay2} x2={x2} y2={y2} stroke="#a8a29e" strokeWidth={0.55} />}
      <line x1={x1} y1={y1} x2={mx - ux * gap / 2} y2={my - uy * gap / 2} />
      <line x1={mx + ux * gap / 2} y1={my + uy * gap / 2} x2={x2} y2={y2} />
      <line x1={x1 - tx} y1={y1 - ty} x2={x1 + tx} y2={y1 + ty} />
      <line x1={x2 - tx} y1={y2 - ty} x2={x2 + tx} y2={y2 + ty} />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        stroke="none"
        transform={vertical ? `rotate(${dimensionRotation(true)} ${labelX} ${labelY})` : undefined}
      >
        {dim.label}
      </text>
    </g>
  )
}

function FixtureMark({ type, w, d, color }) {
  const stroke = color || '#1c1917'
  const sw = 1.05
  const box = { fill: '#fff', stroke, strokeWidth: sw }
  if (type === 'toilet') {
    return (
      <g>
        <rect x={-w * 0.34} y={-d / 2} width={w * 0.68} height={d * 0.28} rx={2} {...box} />
        <ellipse cx={0} cy={d * 0.06} rx={w * 0.36} ry={d * 0.32} {...box} />
      </g>
    )
  }
  if (type === 'basin' || type === 'sink') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        <ellipse cx={0} cy={0} rx={w * 0.28} ry={d * 0.28} fill="none" stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }
  if (type === 'stove') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        {[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x * w} cy={y * d} r={Math.min(w, d) * 0.12} fill="none" stroke={stroke} strokeWidth={sw} />
        ))}
      </g>
    )
  }
  if (type === 'bed') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        <rect x={-w * 0.42} y={-d / 2} width={w * 0.84} height={d * 0.22} fill="#f5f5f4" stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }
  if (type === 'sofa') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        <line x1={-w / 2} y1={-d * 0.18} x2={w / 2} y2={-d * 0.18} stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }
  if (type === 'table') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        <rect x={-w * 0.32} y={-d * 0.28} width={w * 0.64} height={d * 0.56} fill="none" stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }
  if (type === 'chair') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        <line x1={-w / 2} y1={-d * 0.2} x2={w / 2} y2={-d * 0.2} stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }
  if (type === 'shower') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        <line x1={-w / 2} y1={-d / 2} x2={w / 2} y2={d / 2} stroke={stroke} strokeWidth={sw} />
        <line x1={w / 2} y1={-d / 2} x2={-w / 2} y2={d / 2} stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }
  if (type === 'bath') {
    return <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={Math.min(w, d) * 0.35} {...box} />
  }
  if (type === 'bench') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }
  if (type === 'heater') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        <circle cx={0} cy={0} r={Math.min(w, d) * 0.22} fill="none" stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }
  if (type === 'fridge' || type === 'wardrobe' || type === 'dishwasher') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
        <line x1={-w / 2} y1={-d * 0.15} x2={w / 2} y2={-d * 0.15} stroke={stroke} strokeWidth={sw} />
      </g>
    )
  }
  return <rect x={-w / 2} y={-d / 2} width={w} height={d} {...box} />
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
  const [draft, setDraft] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedFixture, setSelectedFixture] = useState(null)
  const [pick, setPick] = useState(null)
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
  const [wallMode, setWallMode] = useState('solid')
  const [roofMode, setRoofMode] = useState('solid')
  const [fitToken, setFitToken] = useState(1)
  const [size, setSize] = useState({ w: 960, h: 680 })
  const [camera, setCamera] = useState(FIT_CAMERA)
  const [gridStep, setGridStep] = useState(0.1)
  const [ortho, setOrtho] = useState(false)
  const [altDown, setAltDown] = useState(false)
  const [snapVisual, setSnapVisual] = useState(null)
  const [cursorPpm, setCursorPpm] = useState(40)
  const history = useRef([])
  const dragBefore = useRef(null)
  const dragId = useRef(null)
  const dragOpen = useRef(null)
  const dragLabel = useRef(null)
  const clip = useRef(null)
  const hostRef = useRef(null)
  const svgRef = useRef(null)
  const panRef = useRef(null)
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
      return next
    })
  }, [])

  const undo = useCallback(() => {
    const prev = history.current.pop()
    if (prev) setPlan(prev)
  }, [])

  const sheet = useMemo(() => sheetPixels(size, plan), [size, plan])
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
      return snapPoint(world, { walls, grid: gridStep, radius, origin: draft, ortho, enabled })
    }
    if (tool === 'room') {
      const origin = roomShape === 'poly' ? poly[poly.length - 1] : draft
      return snapPoint(world, { walls, grid: gridStep, radius, origin: origin || null, ortho, enabled })
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
    return null
  }, [ppm2d, plan.walls, tool, draft, ortho, gridStep, roomShape, poly, placing, svcTool])

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

  const choose = (hit) => {
    if (!hit || hit.kind === 'canvas') {
      setPick(null)
      setSelectedRoom(null)
      setSelectedFixture(null)
      return
    }
    if (hit.kind === 'house') {
      setPick({ kind: 'house', id: 'house' })
      setSelectedRoom(null)
      setSelectedFixture(null)
      setPanel('house')
      return
    }
    const next = hit.kind === 'service'
      ? { kind: 'service', id: hit.service?.id, service: hit.service }
      : { kind: hit.kind, id: hit.id || hit.kind }
    setPick(next)
    setSelectedRoom(hit.kind === 'room' ? hit.id : null)
    setSelectedFixture(hit.kind === 'fixture' ? hit.id : null)
    if (hit.kind === 'fixture') {
      const fixture = (plan.fixtures || []).find((item) => item.id === hit.id)
      if (fixture) clip.current = { ...fixture }
    }
    setPanel(hit.kind === 'house' ? 'house' : 'object')
  }

  const openHitMenu = (hit, event) => {
    const point = hit || { kind: 'house', id: 'house' }
    if (point.kind === 'service') {
      setMenu({ x: event.clientX, y: event.clientY, kind: 'service', service: point.service })
    } else {
      setMenu({
        x: event.clientX,
        y: event.clientY,
        kind: point.kind,
        id: point.id || point.kind,
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
    const visual = describeSnap(world, ppm2d)
    setSnapVisual(visual)
    setCursor(world)
    const radius = Math.max(12 / Math.max(ppm2d, 0.001), 0.45)
    if (dragId.current) setPlan((current) => moveFixture(current, dragId.current, world.x, world.z, radius))
    if (dragOpen.current) setPlan((current) => moveOpening(current, dragOpen.current, world))
    if (dragLabel.current) setPlan((current) => moveRoomLabel(current, dragLabel.current, world.x, world.z))
  }

  const onPointerUp = () => {
    if (panRef.current?.button === 2 && panRef.current.moved) suppressMenu.current = true
    panRef.current = null
    if ((dragId.current || dragLabel.current || dragOpen.current) && dragBefore.current) history.current = [...history.current, dragBefore.current].slice(-40)
    dragId.current = null
    dragOpen.current = null
    dragLabel.current = null
    dragBefore.current = null
  }

  const closeRoom = (points) => {
    if (!points || points.length < 3) return
    const next = drawRoom(plan, points, { partitions, name: 'Huone', type: 'huone' })
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
  }

  const finishServiceRun = () => {
    if (svcPoints.length < 2) return
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

  const onContextMenu = (event) => {
    if (suppressMenu.current) {
      event.preventDefault()
      suppressMenu.current = false
      return
    }
    event.preventDefault()
    const world = toWorld(event)
    const serviceHit = hitService(plan, world)
    if (serviceHit) {
      openServiceMenu(event, serviceHit)
      return
    }
    const hit = hitTest(plan, world)
    setMenu({ x: event.clientX, y: event.clientY, kind: hit.kind, id: hit.id, at: world })
    if (hit.kind !== 'canvas') choose(hit)
  }

  const placeAt = (world, ppm) => {
    const visual = describeSnap(world, ppm)
    const point = visual?.point || world
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
        commit(detectRoomAt(plan, world))
        choose({ kind: 'room', id: roomHit.id })
      }
      return
    }
    if (tool === 'exterior' || tool === 'interior') {
      if (!draft) setDraft(point)
      else {
        commit(addWall(plan, draft, point, tool))
        setDraft(null)
      }
      return
    }
    if (tool === 'door' || tool === 'window') {
      const along = visual?.wall ? visual : snapAlongWall(world, plan.walls, Math.max(12 / Math.max(ppm, 0.001), 0.35), !altRef.current)
      if (along?.wall) commit(addOpening(plan, along.wall.id, along.point || point, tool))
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
    if (svcTool || tool === 'room' || tool === 'detect' || tool === 'exterior' || tool === 'interior' || tool === 'door' || tool === 'window' || placing) {
      placeAt(world, ppm2d)
      return
    }
    const hit = hitTest(plan, world)
    if (hit.kind === 'opening') {
      dragOpen.current = hit.id
      dragBefore.current = plan
      choose(hit)
      return
    }
    choose(hit.kind === 'canvas' ? null : hit)
  }

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (event.key === 'Shift' && !event.repeat) {
        setOrtho((value) => !value)
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
      if (event.key === 'Escape') {
        setDraft(null)
        setPoly([])
        setPlacing(null)
        setMenu(null)
        setSvcPoints([])
        setSvcTool(null)
      } else if (event.key === 'Enter' && svcTool === 'run' && svcPoints.length >= 2) {
        finishServiceRun()
      } else if (event.key === 'Enter' && tool === 'room' && poly.length >= 3) {
        closeRoom(poly)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && pick?.kind === 'wall') {
        commit(deleteWall(plan, pick.id))
        choose(null)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && pick?.kind === 'opening') {
        commit(deleteOpening(plan, pick.id))
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
      } else if ((event.key === 'r' || event.key === 'R') && selectedFixture) {
        commit(rotateFixture(plan, selectedFixture))
      } else if ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey)) {
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
  }, [commit, plan, selectedFixture, undo, tool, poly, pick, partitions, svcTool, svcPoints, svcKind, view])

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
    if (!dragBefore.current) dragBefore.current = plan
    const radius = Math.max(12 / Math.max(spot.ppm, 0.001), 0.45)
    setPlan((current) => moveFixture(current, id, spot.x, spot.z, radius))
    setSelectedFixture(id)
    setPick({ kind: 'fixture', id })
    if (phase === 'end') {
      history.current = [...history.current, dragBefore.current].slice(-40)
      dragBefore.current = null
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

  const loadExample = () => loadHouse(exampleHouse(), 'Olohuone')

  const loadFamily = () => loadHouse(familyHouse(), 'Eteinen')

  const onMenuNavigate = (action) => {
    if (action === 'close') {
      setMenu(null)
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
    buildFloorPlanPdf(plan).save(`${(plan.name || 'pohjakuva').replace(/\s+/g, '-')}.pdf`)
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
  const shownRooms = visibleRooms(plan).filter((item) => item.showLabel !== false)
  const rows = materialsList(plan)
  const groups = []
  FIXTURES.forEach((item) => {
    let group = groups.find((entry) => entry.id === item.group)
    if (!group) {
      group = { id: item.group, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  })
  const totalArea = visibleRooms(plan).reduce((sum, item) => sum + item.area, 0)
  const dims = dimensionChains(plan)
  const activeSystems = SERVICE_SYSTEMS.filter((item) => layerVisible(plan, item.id) && ensureServices(plan).runs.some((run) => run.system === item.id))
  const sheetTitle = activeSystems.length === 1 ? activeSystems[0].title : 'Pohjakuva'
  const liveEnd = draft && (tool === 'exterior' || tool === 'interior') && snapVisual?.point ? snapVisual.point : null
  const roomCursor = tool === 'room' ? snapVisual?.point || null : null
  const liveLength = draft && liveEnd ? segmentLength(draft, liveEnd) : 0
  const spec = PLACEABLES.find((item) => item.id === svcKind)
  const status = svcTool === 'run'
    ? 'Linja: napsauta pisteet. Enter tai Valmis päättää. Escape peruuttaa.'
    : svcTool === 'node'
      ? `${spec?.name || 'Piste'}: napsauta paikka. Piste tarttuu verkkoon ja lähellä olevaan osaan.`
    : liveEnd
    ? `Pituus ${formatMm(liveLength)} mm`
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
              : 'Valitse huone tai kaluste. Vedä huoneen nimeä. Hiiren oikea painike avaa valikon.'

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
          <button type="button" data-testid="view-floor-2d" style={textBtn(view === '2d')} onClick={() => setView('2d')}>2D</button>
          <button type="button" data-testid="view-floor-3d" style={textBtn(view === '3d')} onClick={() => setView('3d')}>3D</button>
          <button type="button" data-testid="view-facade" style={textBtn(view === 'facade')} onClick={() => setView('facade')}>Julkisivu</button>
        </div>
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b' }}>
          <button type="button" style={textBtn(plan.paper !== 'a4')} onClick={() => setPlan({ ...plan, paper: 'a3' })}>A3</button>
          <button type="button" style={textBtn(plan.paper === 'a4')} onClick={() => setPlan({ ...plan, paper: 'a4' })}>A4</button>
        </div>
        <button type="button" title="Kumoa" onClick={undo} style={textBtn(false)}>Kumoa</button>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="plan-new" onClick={() => { setMenu(null); setNewOpen(true) }} style={textBtn(false)}>Uusi</button>
        <button type="button" data-testid="plan-open" onClick={() => { setMenu(null); setLibraryOpen(true) }} style={textBtn(false)}>Avaa/Tallenna</button>
        <button type="button" data-testid="house-settings" onClick={() => { setPanel('house'); setMenu(null) }} style={textBtn(panel === 'house')}>Talon asetukset</button>
        <button type="button" data-testid="example-house" onClick={loadExample} style={textBtn(false)}>Esimerkkitalo</button>
        <button type="button" data-testid="family-house" onClick={loadFamily} style={textBtn(false)}>Huoneisto</button>
        <button type="button" data-testid="export-floor-pdf" onClick={exportPdf} style={textBtn(false)}>PDF</button>
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
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#a8a29e' }}>Tartunta</span>
        <button type="button" data-testid="snap-100" title="Ruudukko 100 mm" style={textBtn(gridStep === 0.1)} onClick={() => setGridStep(0.1)}>100</button>
        <button type="button" data-testid="snap-50" title="Ruudukko 50 mm" style={textBtn(gridStep === 0.05)} onClick={() => setGridStep(0.05)}>50</button>
        <button type="button" data-testid="snap-10" title="Ruudukko 10 mm" style={textBtn(gridStep === 0.01)} onClick={() => setGridStep(0.01)}>10</button>
        <button type="button" data-testid="snap-ortho" title="Suorakulma (Shift)" aria-pressed={ortho} style={textBtn(ortho)} onClick={() => setOrtho((value) => !value)}>Suora</button>
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
          commit(autoRouteAll(plan, { floorHeating }))
          setSvcPoints([])
          setView('2d')
        }}
        onFloorHeating={setFloorHeating}
        onFinish={finishServiceRun}
        onPdf={(id) => buildServicePdf(plan, id).save(`${(plan.name || 'talotekniikka').replace(/\s+/g, '-')}-${id}.pdf`)}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 232, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderRight: '1px solid #d6d3d1', padding: '10px 10px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '4px 4px 8px' }}>KALUSTEET</div>
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
        </aside>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12, color: '#44403c', background: '#f5f5f4', borderBottom: '1px solid #e7e5e4' }}>{status}</div>
          {view === 'facade' ? (
            <FacadeView plan={plan} side={facadeSideId} onSide={setFacadeSideId} onApply={setPlan} onCommit={commit} />
          ) : view === '2d' ? (
            <div ref={hostRef} style={{ flex: 1, minHeight: 0, background: '#d6d3d1' }}>
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
                style={{ display: 'block', cursor: tool === 'select' && !placing && !svcTool ? 'default' : 'crosshair', touchAction: 'none' }}
              >
                <defs>
                  <pattern id="poche" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="5" height="5" fill="#241f1c" />
                    <line x1="0" y1="0" x2="0" y2="5" stroke="#0c0a09" strokeWidth="1.35" />
                  </pattern>
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
                {(plan.walls || []).map((wall) => wallQuads(wall, plan.openings, plan.walls, plan).map((quad, index) => {
                  const interior = wall.kind === 'interior' || wall.kind === 'partition'
                  const selected = pick?.kind === 'wall' && pick.id === wall.id
                  return (
                    <polygon
                      key={`${wall.id}-${index}`}
                      points={quad.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')}
                      fill={wall.materialId
                        ? materialOf(interior ? 'interior' : 'exterior', wall.materialId).color
                        : (interior ? '#e7e5e4' : 'url(#poche)')}
                      stroke={selected ? '#0f766e' : '#1c1917'}
                      strokeWidth={interior ? 1.2 : 0.45}
                      strokeLinejoin="miter"
                    />
                  )
                }))}
                {(plan.openings || []).map((opening) => {
                  const wall = plan.walls.find((item) => item.id === opening.wallId)
                  if (!wall) return null
                  const fig = openingSymbol(wall, opening)
                  if (fig.kind === 'window') {
                    return (
                      <g key={opening.id} stroke={pick?.kind === 'opening' && pick.id === opening.id ? '#0f766e' : '#1c1917'} strokeWidth={1.15} fill="none">
                        {fig.glass.map((line, index) => (
                          <line key={index} x1={X(line.x1)} y1={Y(line.z1)} x2={X(line.x2)} y2={Y(line.z2)} />
                        ))}
                        <line x1={X(fig.jambA[0].x)} y1={Y(fig.jambA[0].z)} x2={X(fig.jambA[1].x)} y2={Y(fig.jambA[1].z)} />
                        <line x1={X(fig.jambB[0].x)} y1={Y(fig.jambB[0].z)} x2={X(fig.jambB[1].x)} y2={Y(fig.jambB[1].z)} />
                      </g>
                    )
                  }
                  return (
                    <g key={opening.id} stroke={pick?.kind === 'opening' && pick.id === opening.id ? '#0f766e' : '#1c1917'} strokeWidth={1.15} fill="none">
                      <polyline points={fig.arc.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')} />
                      <line x1={X(fig.hinge.x)} y1={Y(fig.hinge.z)} x2={X(fig.leaf.x)} y2={Y(fig.leaf.z)} />
                    </g>
                  )
                })}
                {(plan.fixtures || []).map((fixture) => {
                  const tpl = FIXTURES.find((item) => item.id === fixture.type) || FIXTURES[0]
                  const w = px(fixture.w || tpl.w)
                  const d = px(fixture.d || tpl.d)
                  return (
                    <g
                      key={fixture.id}
                      data-testid={`placed-${fixture.type}`}
                      transform={`translate(${X(fixture.x)} ${Y(fixture.z)}) rotate(${fixture.rotation || 0})${fixture.mirror ? ' scale(-1 1)' : ''}`}
                      style={{ pointerEvents: tool === 'select' && !placing && !svcTool ? 'auto' : 'none' }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        event.stopPropagation()
                        setSelectedFixture(fixture.id)
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
                      <FixtureMark type={fixture.type} w={w} d={d} color={fixture.color} />
                      {fixture.id === selectedFixture && (
                        <rect x={-w / 2 - 3} y={-d / 2 - 3} width={w + 6} height={d + 6} fill="none" stroke="#0f766e" strokeWidth={1.4} />
                      )}
                    </g>
                  )
                })}
                {plan.walls.length > 0 && (
                  <g style={{ pointerEvents: 'none' }} data-testid="dimension-chains">
                    {dims.rooms.map((dim, index) => <DimLine key={`room-${index}-${dim.label}`} dim={dim} offset={0} X={X} Y={Y} />)}
                    {dims.chains.map((dim, index) => <DimLine key={`chain-${index}-${dim.label}`} dim={dim} offset={0.48} X={X} Y={Y} />)}
                    {dims.overall.map((dim, index) => <DimLine key={`overall-${index}`} dim={dim} offset={0.82} X={X} Y={Y} />)}
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
                <g style={{ pointerEvents: 'none' }} data-testid="north-arrow">
                  {(() => {
                    const ax = sheet.x + sheet.w - 52
                    const ay = sheet.y + 48
                    const metres = layout.worldW >= 8 && layout.scale * 5 <= layout.title.w - 8 ? 5 : 2
                    const bar = metres * layout.scale * k
                    const bx = sheet.x + layout.title.x * k
                    const by = sheet.y + layout.title.y * k - 36
                    return (
                      <g>
                        <circle cx={ax} cy={ay} r={15} fill="#fff" stroke="#1c1917" strokeWidth={0.8} />
                        <polygon points={`${ax},${ay - 10} ${ax + 4},${ay + 5} ${ax},${ay + 2} ${ax - 4},${ay + 5}`} fill="#1c1917" />
                        <text x={ax} y={ay - 20} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1c1917">N</text>
                        <g data-testid="scale-bar">
                          <text x={bx} y={by - 5} fontSize={11} fill="#1c1917">0</text>
                          <text x={bx + bar} y={by - 5} textAnchor="end" fontSize={11} fill="#1c1917">{metres} m</text>
                          {Array.from({ length: metres }, (_, index) => (
                            <rect key={index} x={bx + (bar / metres) * index} y={by} width={bar / metres} height={7} fill={index % 2 ? '#fbfaf7' : '#1c1917'} stroke="#1c1917" strokeWidth={0.6} />
                          ))}
                        </g>
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
                    const lines = [
                      plan.name || 'Omakotitalo',
                      `Mittakaava 1:${layout.ratio}`,
                      plan.paper === 'a4' ? 'A4 vaaka' : 'A3 vaaka',
                      roofName,
                      `Huoneita ${visibleRooms(plan).length}`,
                      `Pinta-ala ${formatArea(totalArea)}`,
                    ]
                    const header = Math.min(22, th * 0.28)
                    const top = ty + header + 12
                    const bottom = ty + th - 8
                    const step = lines.length > 1 ? (bottom - top) / (lines.length - 1) : 0
                    return (
                      <g data-testid="title-block">
                        <rect x={tx} y={ty} width={tw} height={th} fill="#fff" stroke="#1c1917" strokeWidth={1} />
                        <line x1={tx} y1={ty + header} x2={tx + tw} y2={ty + header} stroke="#1c1917" strokeWidth={0.7} />
                        <text x={tx + 8} y={ty + header * 0.68} fontSize={13} fontWeight={750} fill="#1c1917">{sheetTitle}</text>
                        {lines.map((line, index) => (
                          <text key={`${index}-${line}`} x={tx + 8} y={top + step * index} fontSize={10} fill="#292524">{line}</text>
                        ))}
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
                  preview={svcTool === 'run' ? { points: svcPoints, cursor: cursor ? snapServicePoint(cursor, plan, { mode: 'free', system: svcSystem }) : null } : null}
                  onContext={openServiceMenu}
                />
                {shownRooms.map((item) => {
                  const label = roomLabelPoint(item, plan.fixtures, plan.openings, plan.walls)
                  return (
                    <g
                      key={`label-${item.id}`}
                      data-testid="room-label"
                      data-name={item.name}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        const world = toWorld(event)
                        choose({ kind: 'room', id: item.id })
                        setMenu({ x: event.clientX, y: event.clientY, kind: 'room', id: item.id, at: world })
                      }}
                      style={{ pointerEvents: tool === 'select' && !placing && !svcTool ? 'auto' : 'none', cursor: 'move' }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        event.stopPropagation()
                        setSelectedRoom(item.id)
                        setSelectedFixture(null)
                        dragLabel.current = item.id
                        dragBefore.current = plan
                      }}
                    >
                      <rect x={X(label.x) - 28} y={Y(label.z) - 16} width={56} height={34} fill="transparent" />
                      <RoomName item={item} label={label} X={X} Y={Y} />
                    </g>
                  )
                })}
                {plan.walls.length === 0 && (
                  <text x={sheet.x + sheet.w / 2} y={sheet.y + sheet.h / 2} textAnchor="middle" fontSize={15} fill="#78716c">Piirrä ulkoseinät tai avaa esimerkkitalo</text>
                )}
                <SnapMark snap={snapVisual} X={X} Y={Y} zoom={camera.zoom} />
                </g>
              </svg>
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
        </div>

        <aside data-testid="materials-panel" style={{ width: 280, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderLeft: '1px solid #d6d3d1', padding: '12px 12px 20px' }}>
          {pick && panel !== 'house' ? (
            <div data-testid="panel-heading" style={{ marginBottom: 10 }}>
              <button type="button" data-testid="panel-back-house" onClick={() => setPanel('house')} style={{ display: 'block', padding: 0, border: 'none', background: 'transparent', color: '#0f766e', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}>← Talon asetukset</button>
              <div data-testid="selection-title" style={{ fontSize: 15, fontWeight: 750 }}>{selectionLabel(plan, pick)}</div>
            </div>
          ) : (
            <button type="button" data-testid="open-house-panel" style={{ ...sideBtn(panel === 'house'), marginBottom: 10 }} onClick={() => setPanel(panel === 'house' ? 'object' : 'house')}>Talon asetukset</button>
          )}
          {panel === 'house' ? (
            <HouseSettings plan={plan} onApply={setPlan} />
          ) : (
            <SelectionPanel plan={plan} selection={pick} onApply={setPlan} onCommit={commit} onClear={() => { setPick(null); setMenu(null) }} />
          )}
          {pick?.kind === 'room' && room && (
            <div style={{ fontSize: 12, color: '#57534e', margin: '4px 0 12px' }}>{formatArea(room.area)}</div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '8px 0' }}>MATERIAALILUETTELO</div>
          {rows.length === 0 && <div style={{ fontSize: 12, color: '#78716c' }}>Ei pintoja vielä.</div>}
          {rows.map((row) => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: row.color, border: '1px solid #a8a29e', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{row.groupLabel}: {row.name}</span>
              <span style={{ color: '#78716c' }}>{row.area ? formatArea(row.area) : row.count}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '14px 0 8px' }}>SELITE</div>
          {[
            ['Lattia', 'floor'],
            ['Sisäseinä', 'interior'],
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
      <ServiceMenu menu={menu} plan={plan} onApply={setPlan} onClose={() => setMenu(null)} onProperties={() => onMenuNavigate('properties')} />
    </div>
  )
}
