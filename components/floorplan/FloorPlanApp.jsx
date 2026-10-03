'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  FIXTURES,
  MATERIALS,
  addFixture,
  addOpening,
  addWall,
  duplicateFixture,
  detectRooms,
  dimensionChains,
  emptyPlan,
  exampleHouse,
  formatArea,
  formatMm,
  materialOf,
  materialsList,
  moveFixture,
  moveRoomLabel,
  nearestWall,
  openingSymbol,
  pointInPolygon,
  removeFixture,
  renameRoom,
  roomLabelPoint,
  rotateFixture,
  segmentLength,
  setRoofType,
  setSurface,
  viewLayout,
  snapDrawPoint,
  wallQuads,
  buildFloorPlanPdf,
} from '@/lib/floorplan'

const HouseScene = dynamic(() => import('./HouseScene'), { ssr: false })

const STORAGE_KEY = 'refcad-floorplan-v1'

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
        transform={vertical ? `rotate(-90 ${labelX} ${labelY})` : undefined}
      >
        {dim.label}
      </text>
    </g>
  )
}

function FixtureMark({ type, w, d }) {
  const stroke = '#1c1917'
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

function Swatches({ group, value, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {MATERIALS[group].map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.name}
          aria-label={item.name}
          aria-pressed={value === item.id}
          onClick={() => onPick(item.id)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: item.color,
            border: value === item.id ? '2px solid #0f766e' : '1px solid #a8a29e',
            cursor: 'pointer',
            transform: 'none',
            padding: 0,
          }}
        />
      ))}
    </div>
  )
}

export default function FloorPlanApp() {
  const [plan, setPlan] = useState(() => emptyPlan())
  const [hydrated, setHydrated] = useState(false)
  const [tool, setTool] = useState('select')
  const [placing, setPlacing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedFixture, setSelectedFixture] = useState(null)
  const [menu, setMenu] = useState(null)
  const [view, setView] = useState('2d')
  const [wallMode, setWallMode] = useState('solid')
  const [roofMode, setRoofMode] = useState('solid')
  const [fitToken, setFitToken] = useState(1)
  const [size, setSize] = useState({ w: 960, h: 680 })
  const history = useRef([])
  const dragBefore = useRef(null)
  const dragId = useRef(null)
  const dragLabel = useRef(null)
  const hostRef = useRef(null)
  const svgRef = useRef(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.walls)) {
          setPlan({
            ...emptyPlan(),
            ...parsed,
            rooms: detectRooms(parsed.walls, parsed.rooms || []),
          })
          setSelectedRoom(parsed.rooms?.[0]?.id || null)
        }
      }
    } catch (err) {
      console.error(err)
    }
    setHydrated(true)
    setFitToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
  }, [plan, hydrated])

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
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const mx = (px - sheet.x) / sheet.k
    const my = (py - sheet.y) / sheet.k
    return {
      x: (mx - layout.ox) / layout.scale + layout.box.minX,
      z: (my - layout.oy) / layout.scale + layout.box.minZ,
    }
  }, [sheet, layout])

  const snappedCursor = cursor ? snapDrawPoint(cursor, draft, plan.walls) : null

  const onPointerMove = (event) => {
    if (view !== '2d' || !svgRef.current) return
    const world = toWorld(event)
    setCursor(world)
    if (dragId.current) setPlan((current) => moveFixture(current, dragId.current, world.x, world.z))
    if (dragLabel.current) setPlan((current) => moveRoomLabel(current, dragLabel.current, world.x, world.z))
  }

  const onPointerUp = () => {
    if ((dragId.current || dragLabel.current) && dragBefore.current) history.current = [...history.current, dragBefore.current].slice(-40)
    dragId.current = null
    dragLabel.current = null
    dragBefore.current = null
  }

  const onPointerDown = (event) => {
    if (view !== '2d' || event.button !== 0) return
    setMenu(null)
    const world = toWorld(event)
    if (tool === 'exterior' || tool === 'interior') {
      const point = snapDrawPoint(world, draft, plan.walls)
      if (!draft) setDraft(point)
      else {
        commit(addWall(plan, draft, point, tool))
        setDraft(null)
      }
      return
    }
    if (tool === 'door' || tool === 'window') {
      const hit = nearestWall(plan.walls, world, 0.55)
      if (hit) commit(addOpening(plan, hit.wall.id, world, tool))
      return
    }
    if (placing) {
      const next = addFixture(plan, placing, world.x, world.z)
      commit(next)
      setSelectedFixture(next.fixtures[next.fixtures.length - 1]?.id || null)
      setPlacing(null)
      return
    }
    const room = (plan.rooms || []).find((item) => pointInPolygon(world.x, world.z, item.polygon))
    setSelectedRoom(room?.id || null)
    setSelectedFixture(null)
  }

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (event.key === 'Escape') {
        setDraft(null)
        setPlacing(null)
        setMenu(null)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedFixture) {
        commit(removeFixture(plan, selectedFixture))
        setSelectedFixture(null)
      } else if ((event.key === 'r' || event.key === 'R') && selectedFixture) {
        commit(rotateFixture(plan, selectedFixture))
      } else if ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey)) {
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit, plan, selectedFixture, undo])

  const loadExample = () => {
    const house = exampleHouse()
    commit(house)
    setDraft(null)
    setSelectedRoom(house.rooms.find((room) => room.name === 'Olohuone')?.id || house.rooms[0]?.id || null)
    setSelectedFixture(null)
    setView('2d')
    setFitToken((token) => token + 1)
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
  const totalArea = (plan.rooms || []).reduce((sum, item) => sum + item.area, 0)
  const dims = dimensionChains(plan)
  const liveEnd = draft && snappedCursor ? snappedCursor : null
  const liveLength = draft && liveEnd ? segmentLength(draft, liveEnd) : 0
  const status = liveEnd
    ? `Pituus ${formatMm(liveLength)} mm`
    : placing
      ? 'Napsauta pohjaan kalusteen paikka'
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
        display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 10px',
        background: '#14181f', color: '#f5f5f4', flexShrink: 0,
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
        </div>
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b' }}>
          <button type="button" data-testid="view-floor-2d" style={textBtn(view === '2d')} onClick={() => setView('2d')}>2D</button>
          <button type="button" data-testid="view-floor-3d" style={textBtn(view === '3d')} onClick={() => setView('3d')}>3D</button>
        </div>
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b' }}>
          <button type="button" style={textBtn(plan.paper !== 'a4')} onClick={() => setPlan({ ...plan, paper: 'a3' })}>A3</button>
          <button type="button" style={textBtn(plan.paper === 'a4')} onClick={() => setPlan({ ...plan, paper: 'a4' })}>A4</button>
        </div>
        <button type="button" title="Kumoa" onClick={undo} style={textBtn(false)}>Kumoa</button>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="example-house" onClick={loadExample} style={textBtn(false)}>Esimerkkitalo</button>
        <button type="button" data-testid="export-floor-pdf" onClick={exportPdf} style={textBtn(false)}>PDF</button>
        <button type="button" data-testid="export-floor-png" onClick={exportPng} style={textBtn(false)}>PNG</button>
      </header>

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
          {view === '2d' ? (
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
                onContextMenu={(event) => event.preventDefault()}
                style={{ display: 'block', cursor: tool === 'select' && !placing ? 'default' : 'crosshair', touchAction: 'none' }}
              >
                <defs>
                  <pattern id="poche" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="5" height="5" fill="#241f1c" />
                    <line x1="0" y1="0" x2="0" y2="5" stroke="#0c0a09" strokeWidth="1.35" />
                  </pattern>
                </defs>
                <rect x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} fill="#fbfaf7" stroke="#1c1917" strokeWidth={1.4} />
                <rect x={sheet.x + 4} y={sheet.y + 4} width={sheet.w - 8} height={sheet.h - 8} fill="none" stroke="#a8a29e" strokeWidth={0.6} />
                {(plan.rooms || []).map((item) => (
                  <polygon
                    key={item.id}
                    points={item.polygon.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')}
                    fill={materialOf('floor', item.floorId).color}
                    fillOpacity={item.id === selectedRoom ? 0.78 : 0.5}
                    stroke="none"
                  />
                ))}
                {(plan.walls || []).map((wall) => wallQuads(wall, plan.openings).map((quad, index) => (
                  <polygon
                    key={`${wall.id}-${index}`}
                    points={quad.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')}
                    fill={wall.kind === 'exterior' ? 'url(#poche)' : '#6b6560'}
                  />
                )))}
                {(plan.openings || []).map((opening) => {
                  const wall = plan.walls.find((item) => item.id === opening.wallId)
                  if (!wall) return null
                  const fig = openingSymbol(wall, opening)
                  if (fig.kind === 'window') {
                    return (
                      <g key={opening.id} stroke="#1c1917" strokeWidth={1.15} fill="none">
                        {fig.glass.map((line, index) => (
                          <line key={index} x1={X(line.x1)} y1={Y(line.z1)} x2={X(line.x2)} y2={Y(line.z2)} />
                        ))}
                        <line x1={X(fig.jambA[0].x)} y1={Y(fig.jambA[0].z)} x2={X(fig.jambA[1].x)} y2={Y(fig.jambA[1].z)} />
                        <line x1={X(fig.jambB[0].x)} y1={Y(fig.jambB[0].z)} x2={X(fig.jambB[1].x)} y2={Y(fig.jambB[1].z)} />
                      </g>
                    )
                  }
                  return (
                    <g key={opening.id} stroke="#1c1917" strokeWidth={1.15} fill="none">
                      <polyline points={fig.arc.map((point) => `${X(point.x)},${Y(point.z)}`).join(' ')} />
                      <line x1={X(fig.hinge.x)} y1={Y(fig.hinge.z)} x2={X(fig.leaf.x)} y2={Y(fig.leaf.z)} />
                    </g>
                  )
                })}
                {(plan.fixtures || []).map((fixture) => {
                  const tpl = FIXTURES.find((item) => item.id === fixture.type) || FIXTURES[0]
                  const w = px(tpl.w)
                  const d = px(tpl.d)
                  return (
                    <g
                      key={fixture.id}
                      transform={`translate(${X(fixture.x)} ${Y(fixture.z)}) rotate(${fixture.rotation || 0})`}
                      style={{ pointerEvents: tool === 'select' && !placing ? 'auto' : 'none' }}
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
                        setSelectedFixture(fixture.id)
                        setMenu({ x: event.clientX, y: event.clientY, id: fixture.id })
                      }}
                    >
                      <FixtureMark type={fixture.type} w={w} d={d} />
                      {fixture.id === selectedFixture && (
                        <rect x={-w / 2 - 3} y={-d / 2 - 3} width={w + 6} height={d + 6} fill="none" stroke="#0f766e" strokeWidth={1.4} />
                      )}
                    </g>
                  )
                })}
                {(plan.rooms || []).map((item) => {
                  const label = roomLabelPoint(item, plan.fixtures, plan.openings, plan.walls)
                  return (
                    <g
                      key={`label-${item.id}`}
                      data-testid="room-label"
                      data-name={item.name}
                      style={{ pointerEvents: tool === 'select' && !placing ? 'auto' : 'none', cursor: 'move' }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        event.stopPropagation()
                        setSelectedRoom(item.id)
                        setSelectedFixture(null)
                        dragLabel.current = item.id
                        dragBefore.current = plan
                      }}
                    >
                      <rect x={X(label.x) - 46} y={Y(label.z) - 16} width={92} height={34} fill="transparent" />
                      <text x={X(label.x)} y={Y(label.z) - 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1c1917">{item.name}</text>
                      <text x={X(label.x)} y={Y(label.z) + 13} textAnchor="middle" fontSize={11} fill="#44403c">{formatArea(item.area)}</text>
                    </g>
                  )
                })}
                {plan.walls.length > 0 && (
                  <g style={{ pointerEvents: 'none' }} data-testid="dimension-chains">
                    {dims.rooms.map((dim, index) => <DimLine key={`room-${index}-${dim.label}`} dim={dim} offset={0.4} X={X} Y={Y} />)}
                    {dims.chains.map((dim, index) => <DimLine key={`chain-${index}-${dim.label}`} dim={dim} offset={0.72} X={X} Y={Y} />)}
                    {dims.overall.map((dim, index) => <DimLine key={`overall-${index}`} dim={dim} offset={1.4} X={X} Y={Y} />)}
                  </g>
                )}
                {liveEnd && (
                  <g style={{ pointerEvents: 'none' }}>
                    <line x1={X(draft.x)} y1={Y(draft.z)} x2={X(liveEnd.x)} y2={Y(liveEnd.z)} stroke="#0f766e" strokeWidth={1.4} strokeDasharray="5 4" />
                    <text x={(X(draft.x) + X(liveEnd.x)) / 2} y={(Y(draft.z) + Y(liveEnd.z)) / 2 - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0f766e">{formatMm(liveLength)}</text>
                  </g>
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
                    const lines = [
                      plan.name || 'Omakotitalo',
                      `Mittakaava 1:${Math.round(1000 / layout.scale)}`,
                      plan.paper === 'a4' ? 'A4 vaaka' : 'A3 vaaka',
                      plan.roofType === 'flat' ? 'Tasakatto' : 'Harjakatto',
                      `Huoneita ${(plan.rooms || []).length}`,
                      `Pinta-ala ${formatArea(totalArea)}`,
                    ]
                    return (
                      <g>
                        <rect x={tx} y={ty} width={tw} height={th} fill="#fff" stroke="#1c1917" strokeWidth={1} />
                        <line x1={tx} y1={ty + th * 0.22} x2={tx + tw} y2={ty + th * 0.22} stroke="#1c1917" strokeWidth={0.7} />
                        <text x={tx + 8} y={ty + th * 0.15} fontSize={13} fontWeight={750} fill="#1c1917">Pohjakuva</text>
                        {lines.map((line, index) => (
                          <text key={line} x={tx + 8} y={ty + th * 0.36 + index * 11} fontSize={10} fill="#292524">{line}</text>
                        ))}
                      </g>
                    )
                  })()}
                </g>
                {plan.walls.length === 0 && (
                  <text x={sheet.x + sheet.w / 2} y={sheet.y + sheet.h / 2} textAnchor="middle" fontSize={15} fill="#78716c">Piirrä ulkoseinät tai avaa esimerkkitalo</text>
                )}
              </svg>
            </div>
          ) : (
            <div ref={hostRef} data-testid="floor-3d" style={{ flex: 1, minHeight: 0, position: 'relative', background: '#e7e5e4' }}>
              <HouseScene plan={plan} wallMode={wallMode} roofMode={roofMode} fitToken={fitToken} />
              <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4, background: '#14181f', padding: 4, borderRadius: 10 }}>
                  <span style={{ color: '#a8a29e', fontSize: 11, alignSelf: 'center', padding: '0 6px' }}>Seinät</span>
                  <button type="button" data-testid="wall-solid" style={textBtn(wallMode === 'solid')} onClick={() => setWallMode('solid')}>Näkyvissä</button>
                  <button type="button" data-testid="wall-ghost" style={textBtn(wallMode === 'ghost')} onClick={() => setWallMode('ghost')}>Läpinäkyvä</button>
                  <button type="button" data-testid="wall-hidden" style={textBtn(wallMode === 'hidden')} onClick={() => setWallMode('hidden')}>Piilossa</button>
                </div>
                <div style={{ display: 'flex', gap: 4, background: '#14181f', padding: 4, borderRadius: 10 }}>
                  <span style={{ color: '#a8a29e', fontSize: 11, alignSelf: 'center', padding: '0 6px' }}>Katto</span>
                  <button type="button" data-testid="roof-solid" style={textBtn(roofMode === 'solid')} onClick={() => setRoofMode('solid')}>Näkyvissä</button>
                  <button type="button" data-testid="roof-ghost" style={textBtn(roofMode === 'ghost')} onClick={() => setRoofMode('ghost')}>Läpinäkyvä</button>
                  <button type="button" data-testid="roof-hidden" style={textBtn(roofMode === 'hidden')} onClick={() => setRoofMode('hidden')}>Piilossa</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside data-testid="materials-panel" style={{ width: 280, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderLeft: '1px solid #d6d3d1', padding: '12px 12px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', marginBottom: 8 }}>PINNAT</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Kattomuoto</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button type="button" style={{ ...sideBtn(plan.roofType !== 'flat'), width: 'auto', padding: '6px 10px' }} onClick={() => setPlan(setRoofType(plan, 'gable'))}>Harjakatto</button>
            <button type="button" style={{ ...sideBtn(plan.roofType === 'flat'), width: 'auto', padding: '6px 10px' }} onClick={() => setPlan(setRoofType(plan, 'flat'))}>Tasakatto</button>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Ulkoseinä</div>
          <Swatches group="exterior" value={plan.exteriorId} onPick={(id) => commit(setSurface(plan, null, 'exterior', id))} />
          <div style={{ fontSize: 12, color: '#57534e', margin: '4px 0 12px' }}>{materialOf('exterior', plan.exteriorId).name}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Katto</div>
          <Swatches group="roof" value={plan.roofId} onPick={(id) => commit(setSurface(plan, null, 'roof', id))} />
          <div style={{ fontSize: 12, color: '#57534e', margin: '4px 0 12px' }}>{materialOf('roof', plan.roofId).name}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Huone</div>
          {room ? (
            <div>
              <input
                aria-label="Huoneen nimi"
                value={room.name}
                onChange={(event) => setPlan(renameRoom(plan, room.id, event.target.value))}
                style={{ width: '100%', marginBottom: 8, padding: '6px 8px', borderRadius: 8, border: '1px solid #d6d3d1', fontSize: 13 }}
              />
              <div style={{ fontSize: 12, color: '#57534e', marginBottom: 8 }}>{formatArea(room.area)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Lattia</div>
              <Swatches group="floor" value={room.floorId} onPick={(id) => commit(setSurface(plan, room.id, 'floor', id))} />
              <div style={{ fontSize: 12, color: '#57534e', margin: '4px 0 10px' }}>{materialOf('floor', room.floorId).name}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Sisäseinä</div>
              <Swatches group="interior" value={room.interiorId} onPick={(id) => commit(setSurface(plan, room.id, 'interior', id))} />
              <div style={{ fontSize: 12, color: '#57534e', margin: '4px 0 12px' }}>{materialOf('interior', room.interiorId).name}</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#78716c', marginBottom: 12 }}>Valitse huone pohjasta.</div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#78716c', margin: '8px 0' }}>MATERIAALILUETTELO</div>
          {rows.length === 0 && <div style={{ fontSize: 12, color: '#78716c' }}>Ei pintoja vielä.</div>}
          {rows.map((row) => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: row.color, border: '1px solid #a8a29e', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{row.groupLabel}: {row.name}</span>
              <span style={{ color: '#78716c' }}>{row.count}</span>
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
        </aside>
      </div>
      {menu && (
        <div
          style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 50, background: '#1c212b', color: '#f5f5f4', borderRadius: 8, padding: 4, minWidth: 140, boxShadow: '0 12px 32px rgba(0,0,0,0.28)' }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {[
            ['Kierrä', () => commit(rotateFixture(plan, menu.id))],
            ['Monista', () => commit(duplicateFixture(plan, menu.id))],
            ['Poista', () => { commit(removeFixture(plan, menu.id)); setSelectedFixture(null) }],
          ].map(([label, run]) => (
            <button
              key={label}
              type="button"
              onClick={() => { run(); setMenu(null) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', color: '#f5f5f4', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', transform: 'none' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
