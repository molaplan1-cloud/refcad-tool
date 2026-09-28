'use client'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { jsPDF } from 'jspdf'
import { getProject as lsGet, updateProject as lsUpdate } from '@/lib/clientStore'

const genId = () => Math.random().toString(36).substr(2, 9)
const fmt = (n, d = 2) => typeof n === 'number' ? n.toFixed(d) : '0.00'
const formatDim = (meters, unit = 'auto') => {
  if (unit === 'mm') return `${(meters * 1000).toFixed(0)} mm`
  if (unit === 'cm') return `${(meters * 100).toFixed(1)} cm`
  if (meters < 1) return `${(meters * 1000).toFixed(0)} mm`
  return `${meters.toFixed(2)} m`
}

const COLD_ROOM_TYPES = [
  { id: 'chilled', name: 'Chilled', sub: '+2°C', icon: '🌡️', accent: '#3b82f6' },
  { id: 'frozen', name: 'Frozen', sub: '-18°C', icon: '❄️', accent: '#1d4ed8' },
  { id: 'blast-chiller', name: 'Blast Chiller', sub: '0°C', icon: '🧊', accent: '#06b6d4' },
  { id: 'blast-freezer', name: 'Blast Freezer', sub: '-30°C', icon: '🥶', accent: '#0891b2' },
  { id: 'fresh', name: 'Fresh', sub: '-2°C', icon: '🥬', accent: '#22c55e' }
]

const EQUIPMENT_CATALOG = [
  { id: 'door-h700', category: 'door', name: 'Ovi 700mm', icon: '🚪', width: 0.7, height: 2.0, depth: 0.10 },
  { id: 'door-h900', category: 'door', name: 'Ovi 900mm', icon: '🚪', width: 0.9, height: 2.0, depth: 0.10 },
  { id: 'door-h1200', category: 'door', name: 'Liukuovi 1200mm', icon: '🚪', width: 1.2, height: 2.2, depth: 0.10 },
  { id: 'door-h1500', category: 'door', name: 'Liukuovi 1500mm', icon: '🚪', width: 1.5, height: 2.4, depth: 0.10 },
  { id: 'evap-10', category: 'evaporator', name: 'Höyrystin 10kW', icon: '❄️', width: 1.2, height: 0.5, depth: 0.8, capacity: 10 },
  { id: 'evap-20', category: 'evaporator', name: 'Höyrystin 20kW', icon: '❄️', width: 1.6, height: 0.6, depth: 1.0, capacity: 20 },
  { id: 'cond-15', category: 'condenser', name: 'Lauhdutin 15kW', icon: '🔥', width: 1.0, height: 0.7, depth: 0.5, capacity: 15 },
  { id: 'cond-30', category: 'condenser', name: 'Lauhdutin 30kW', icon: '🔥', width: 1.5, height: 0.9, depth: 0.8, capacity: 30 },
  { id: 'compact-8', category: 'unit', name: 'Koneikko 8kW', icon: '⚙️', width: 1.0, height: 1.5, depth: 0.8, capacity: 8 },
  { id: 'racking', category: 'rack', name: 'Lavahylly 3m', icon: '📦', width: 3.0, height: 4.5, depth: 1.0 }
]
const getCat = id => EQUIPMENT_CATALOG.find(e => e.id === id)

function calculateHeatLoad(rooms) {
  let Q = { transmission: 0, infiltration: 0, product: 0, equipment: 0, lighting: 0, occupancy: 0 }
  let totalArea = 0, totalVolume = 0
  rooms.forEach(room => {
    const L = room.width || 4, D = room.depth || 4, H = room.height || 2.8
    const area = L * D, volume = area * H
    totalArea += area; totalVolume += volume
    const wallA = 2 * (L + D) * H, ceilA = area, floorA = area
    const dT = (room.ambientTemp || 25) - (room.temp || 2)
    Q.transmission += wallA * (room.uWall || 0.25) * dT + ceilA * (room.uCeiling || 0.22) * dT + floorA * (room.uFloor || 0.30) * dT
    Q.lighting += area * 12
    Q.occupancy += 350
    Q.equipment += (room.equipment || []).reduce((s, eq) => s + (eq.capacity || 0) * 100, 0)
  })
  const total = Q.transmission + Q.infiltration + Q.product + Q.equipment + Q.lighting + Q.occupancy
  return {
    ...Q,
    transmission: Math.round(Q.transmission), infiltration: Math.round(Q.infiltration),
    product: Math.round(Q.product), equipment: Math.round(Q.equipment),
    lighting: Math.round(Q.lighting), occupancy: Math.round(Q.occupancy),
    total: Math.round(total),
    area: totalArea.toFixed(1), volume: totalVolume.toFixed(1),
    recommendedEvapCap: Math.round(total * 1.2 / 100) / 10,
    recommendedCondCap: Math.round(total * 1.3 / 100) / 10
  }
}

export default function DesignerClient({ user, projectId }) {
  const router = useRouter()
  // Always start with an empty default; load from localStorage on mount.
  const defaultProj = {
    id: projectId,
    name: 'Projekti',
    data: { rooms: [], dimUnit: 'auto' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const [project, setProject] = useState(defaultProj)
  const [projectName, setProjectName] = useState(defaultProj.name)
  const [rooms, setRooms] = useState([])
  const [dimUnit, setDimUnit] = useState('auto')
  const [loaded, setLoaded] = useState(false)

  // Load project from localStorage on mount (client-side persistence).
  useEffect(() => {
    const stored = lsGet(projectId)
    if (stored) {
      setProject(stored)
      setProjectName(stored.name)
      setRooms(stored.data?.rooms || [])
      setDimUnit(stored.data?.dimUnit || 'auto')
    } else {
      // Persist a new project record so subsequent loads work
      const created = {
        ...defaultProj,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const all = JSON.parse(window.localStorage.getItem('refcad:projects:v1') || '[]')
      all.unshift(created)
      window.localStorage.setItem('refcad:projects:v1', JSON.stringify(all))
      setProject(created)
      setProjectName(created.name)
    }
    setLoaded(true)
  }, [projectId])
  const [selectedId, setSelectedId] = useState(null)
  const [view2D, setView2D] = useState({ scale: 30, offsetX: 400, offsetY: 300 })
  const [view3D, setView3D] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState({ saved: true, time: new Date() })
  const [rotation, setRotation] = useState({ azimuth: 0, elevation: 0.4 })
  const [zoom3D, setZoom3D] = useState(50)
  const [contextMenu, setContextMenu] = useState(null)
  const saveTimerRef = useRef(null)

  const heatLoad = useMemo(() => calculateHeatLoad(rooms), [rooms])

  // Auto-save (debounced)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setSaving(true)
      try {
        lsUpdate(project.id, { name: projectName, data: { rooms, dimUnit } })
        setSaveStatus({ saved: true, time: new Date() })
      } catch (e) {
        setSaveStatus({ saved: false, time: new Date() })
      } finally {
        setSaving(false)
      }
    }, 600)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [project.id, projectName, rooms, dimUnit])

  // Rename
  const renameProject = () => {
    if (projectName === project.name) return
    setSaving(true)
    try {
      lsUpdate(project.id, { name: projectName })
    } finally {
      setSaving(false)
    }
  }

  const addRoom = (typeId) => {
    const type = COLD_ROOM_TYPES.find(t => t.id === typeId)
    const newRoom = {
      id: genId(), type: typeId,
      name: `${type.name} ${rooms.length + 1}`,
      width: 4, depth: 4, height: 2.8,
      x: rooms.length * 5, z: 0,
      temp: type.sub === '+2°C' ? 2 : type.sub === '-18°C' ? -18 : type.sub === '0°C' ? 0 : type.sub === '-30°C' ? -30 : -2,
      ambientTemp: 25, RH: 70,
      uWall: 0.25, uCeiling: 0.22, uFloor: 0.30,
      wallThickness: 0.1,
      color: type.accent,
      equipment: []
    }
    setRooms([...rooms, newRoom])
    setSelectedId(newRoom.id)
  }

  const updateRoom = (room) => setRooms(prev => prev.map(r => r.id === room.id ? room : r))
  const removeRoom = (id) => setRooms(prev => prev.filter(r => r.id !== id))

  const selectedRoom = rooms.find(r => r.id === selectedId)
  const selectedEquipment = useMemo(() => {
    for (const r of rooms) {
      const eq = (r.equipment || []).find(e => e.id === selectedId)
      if (eq) return { ...eq, roomId: r.id }
    }
    return null
  }, [rooms, selectedId])

  // 3D projection
  const proj3D = useCallback((x, y, z) => {
    const cosA = Math.cos(rotation.azimuth), sinA = Math.sin(rotation.azimuth)
    const cosE = Math.cos(rotation.elevation), sinE = Math.sin(rotation.elevation)
    const xr = x * cosA + z * sinA
    const zr = -x * sinA + z * cosA
    const yr = y * cosE - zr * sinE
    return { x: xr * zoom3D + 400, y: -yr * zoom3D + 280 }
  }, [rotation, zoom3D])

  // Add equipment at clicked room
  const handleAddEq = (catalogId, roomId, x, z) => {
    const cat = getCat(catalogId)
    if (!cat) return
    const room = rooms.find(r => r.id === roomId)
    if (!room) return
    const yPos = cat.category === 'evaporator' || cat.category === 'condenser'
      ? (room.height || 2.8) - (cat.height || 0.5) - 0.1
      : 0
    const newEq = { id: genId(), ...cat, x: x || 0, z: z || 0, y: yPos, rotation: 0 }
    updateRoom({ ...room, equipment: [...(room.equipment || []), newEq] })
    setSelectedId(newEq.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0f1e', color: '#f1f5f9' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link href="/projects" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
            <svg width="26" height="26" viewBox="0 0 64 64">
              <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
              <polygon points="32,8 52,20 32,32 12,20" fill="#dbeafe" opacity="0.9" />
              <polygon points="12,20 12,44 32,56 32,32" fill="#bfdbfe" opacity="0.9" />
              <polygon points="52,20 52,44 32,56 32,32" fill="url(#lg)" />
            </svg>
          </Link>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} onBlur={renameProject}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', minWidth: '180px' }} />
          <span style={{ fontSize: '10px', color: saving ? '#fbbf24' : (saveStatus.saved ? '#22c55e' : '#ef4444') }}>
            {saving ? '⏳ Tallentaa...' : (saveStatus.saved ? '✓ Pilvessä' : '⚠ Ei tallennettu')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '2px', background: '#0f172a', borderRadius: '6px', padding: '2px', border: '1px solid #334155' }}>
            <button onClick={() => setView3D(false)} style={{ padding: '6px 12px', background: !view3D ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : 'transparent', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>📐 2D</button>
            <button onClick={() => setView3D(true)} style={{ padding: '6px 12px', background: view3D ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : 'transparent', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>🎲 3D</button>
          </div>
          <button onClick={() => exportToPDF(rooms, heatLoad, projectName, user)} style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>📄 PDF</button>
          <form action="/api/auth/logout" method="POST" style={{ display: 'inline' }}>
            <button type="submit" style={{ padding: '6px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f1f5f9', cursor: 'pointer', fontSize: '11px' }}>Poistu</button>
          </form>
        </div>
      </header>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <aside style={{ width: '270px', background: 'linear-gradient(180deg, #0f172a, #1e293b)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', marginBottom: '10px' }}>Lisää huone</div>
            {COLD_ROOM_TYPES.map(type => (
              <button key={type.id} onClick={() => addRoom(type.id)} style={{
                width: '100%', marginBottom: '6px', padding: '10px 12px', textAlign: 'left',
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${type.accent}40`,
                borderRadius: '8px', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <span style={{ fontSize: '20px' }}>{type.icon}</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>{type.name}</div>
                  <div style={{ fontSize: '10px', color: type.accent }}>{type.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', marginBottom: '10px' }}>Huoneet ({rooms.length})</div>
            {rooms.map(room => (
              <div key={room.id} onClick={() => setSelectedId(room.id)} style={{
                padding: '8px 10px', marginBottom: '4px',
                background: selectedId === room.id ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)',
                border: '1px solid', borderColor: selectedId === room.id ? '#06b6d4' : 'rgba(255,255,255,0.06)',
                borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '12px'
              }}>
                <div style={{ width: '6px', height: '24px', background: room.color, borderRadius: '2px' }}></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{room.width}×{room.depth}×{room.height}m · {room.temp}°C</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeRoom(room.id) }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>✕</button>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <main style={{ flex: 1, position: 'relative', background: '#0a0f1e', overflow: 'hidden' }}>
          {view3D ? (
            <IsometricView3D rooms={rooms} selectedId={selectedId} onSelect={setSelectedId} proj={proj3D} rotation={rotation} />
          ) : (
            <PlanView2DNew rooms={rooms} selectedId={selectedId} onSelect={setSelectedId} onUpdate={updateRoom} view2D={view2D} setView2D={setView2D} dimUnit={dimUnit} onAddEq={handleAddEq} />
          )}
        </main>

        {/* Right sidebar */}
        <aside style={{ width: '300px', background: 'linear-gradient(180deg, #0f172a, #1e293b)', borderLeft: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto' }}>
          <HeatLoadPanel heatLoad={heatLoad} />
        </aside>
      </div>
    </div>
  )
}

function HeatLoadPanel({ heatLoad }) {
  const items = [
    { label: 'Johtuminen', value: heatLoad.transmission, color: '#60a5fa' },
    { label: 'Ilmanvaihto', value: heatLoad.infiltration, color: '#a78bfa' },
    { label: 'Tuotteet', value: heatLoad.product, color: '#fbbf24' },
    { label: 'Laitteet', value: heatLoad.equipment, color: '#4ade80' },
    { label: 'Valaistus', value: heatLoad.lighting, color: '#06b6d4' },
    { label: 'Henkilöt', value: heatLoad.occupancy, color: '#f472b6' }
  ]
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: '8px' }}>LÄMPÖKUORMA</div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
        {heatLoad.total.toLocaleString()} <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>W</span>
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '14px' }}>
        {(heatLoad.total / 1000).toFixed(2)} kW · {Math.round(heatLoad.total * 3.41214).toLocaleString()} BTU/h
      </div>

      <div style={{ padding: '10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>📌 Suositus</div>
        <div style={{ fontSize: '12px', color: '#fff' }}>
          Höyrystin: <strong style={{ color: '#22c55e' }}>{heatLoad.recommendedEvapCap} kW</strong>
        </div>
        <div style={{ fontSize: '12px', color: '#fff' }}>
          Lauhdutin: <strong style={{ color: '#22c55e' }}>{heatLoad.recommendedCondCap} kW</strong>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((item, i) => (
          <div key={i} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: `3px solid ${item.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{item.label}</span>
              <span style={{ fontSize: '13px', color: item.color, fontWeight: 700 }}>{item.value} W</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${(item.value / (heatLoad.total || 1)) * 100}%`, height: '100%', background: item.color }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(6,182,212,0.08)', borderRadius: '8px', border: '1px solid rgba(6,182,212,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>📐 Pinta-ala</span>
          <span style={{ color: '#06b6d4', fontWeight: 700 }}>{heatLoad.area} m²</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>📦 Tilavuus</span>
          <span style={{ color: '#06b6d4', fontWeight: 700 }}>{heatLoad.volume} m³</span>
        </div>
      </div>
    </div>
  )
}

function PlanView2DNew({ rooms, selectedId, onSelect, onUpdate, view2D, setView2D, dimUnit, onAddEq }) {
  const proj = (x, z) => ({ px: x * view2D.scale + view2D.offsetX, py: z * view2D.scale + view2D.offsetY })
  const unproj = (px, py) => ({ x: (px - view2D.offsetX) / view2D.scale, z: (py - view2D.offsetY) / view2D.scale })
  const [dragging, setDragging] = useState(null)
  const [dragEq, setDragEq] = useState(null)

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setView2D(v => ({ ...v, scale: Math.max(5, Math.min(100, v.scale * delta)) }))
  }

  const startPan = (e) => {
    if (e.button === 0 && !dragEq) {
      setDragging({ startX: e.clientX, startY: e.clientY, offsetX: view2D.offsetX, offsetY: view2D.offsetY })
    }
  }
  const doMove = (e) => {
    if (dragging) setView2D(v => ({ ...v, offsetX: dragging.offsetX + (e.clientX - dragging.startX), offsetY: dragging.offsetY + (e.clientY - dragging.startY) }))
    if (dragEq) {
      const divRect = e.currentTarget.getBoundingClientRect()
      const worldPos = unproj(e.clientX - divRect.left, e.clientY - divRect.top)
      onUpdate({ ...rooms.find(r => r.id === dragEq.roomId), equipment: rooms.find(r => r.id === dragEq.roomId).equipment.map(eq => eq.id === dragEq.id ? { ...eq, x: worldPos.x, z: worldPos.z } : eq) })
    }
  }
  const handleClick = (e) => {
    const divRect = e.currentTarget.getBoundingClientRect()
    const worldPos = unproj(e.clientX - divRect.left, e.clientY - divRect.top)
    // Hit equipment first
    for (const room of rooms) {
      for (const eq of (room.equipment || [])) {
        if (Math.abs(worldPos.x - eq.x) < (eq.width || 0.5) / 2 + 0.1 && Math.abs(worldPos.z - eq.z) < (eq.depth || 0.5) / 2 + 0.1) {
          e.preventDefault()
          onSelect(eq.id)
          setDragEq({ id: eq.id, roomId: room.id })
          return
        }
      }
    }
    // Hit room
    for (const room of rooms) {
      const hw = (room.width || 4) / 2, hd = (room.depth || 4) / 2
      if (worldPos.x >= -hw && worldPos.x <= hw && worldPos.z >= -hd && worldPos.z <= hd) {
        onSelect(room.id)
        return
      }
    }
    onSelect(null)
  }

  return (
    <div style={{ width: '100%', height: '100%', cursor: dragEq ? 'move' : (dragging ? 'grabbing' : 'grab'), overflow: 'hidden' }}
      onWheel={handleWheel} onMouseDown={(e) => { if (e.button === 0) { startPan(e) } }} onMouseMove={doMove}
      onMouseUp={() => { setDragging(null); setDragEq(null) }} onMouseLeave={() => { setDragging(null); setDragEq(null) }} onClick={handleClick}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <pattern id="grid2d" width={view2D.scale} height={view2D.scale} patternUnits="userSpaceOnUse">
            <path d={`M ${view2D.scale} 0 L 0 0 0 ${view2D.scale}`} fill="none" stroke="#1e3a5f" strokeWidth="0.4" />
          </pattern>
          <linearGradient id="doorPan" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid2d)" transform={`translate(${view2D.offsetX % view2D.scale}, ${view2D.offsetY % view2D.scale})`} />

        {rooms.map(room => {
          const w = (room.width || 4) * view2D.scale
          const d = (room.depth || 4) * view2D.scale
          const tl = proj(-(room.width||4)/2, -(room.depth||4)/2)
          const isSelected = selectedId === room.id
          return (
            <g key={room.id}>
              <rect x={tl.px} y={tl.py} width={w} height={d}
                fill={room.color || '#3b82f6'} fillOpacity={isSelected ? 0.30 : 0.18}
                stroke={isSelected ? '#06b6d4' : '#60a5fa'} strokeWidth={isSelected ? 3 : 2}
                onClick={(e) => { e.stopPropagation(); onSelect(room.id) }}
                style={{ cursor: 'pointer' }} />
              <text x={tl.px + w/2} y={tl.py + d/2 - 10} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" style={{ pointerEvents: 'none' }}>{room.name}</text>
              <text x={tl.px + w/2} y={tl.py + d/2 + 8} textAnchor="middle" fill="#94a3b8" fontSize="10" style={{ pointerEvents: 'none' }}>
                {formatDim(room.width || 0, dimUnit)} × {formatDim(room.depth || 0, dimUnit)} · {room.temp}°C
              </text>
              {/* Dimensions */}
              <line x1={tl.px} y1={tl.py - 14} x2={tl.px + w} y2={tl.py - 14} stroke="#fbbf24" strokeWidth="0.6" />
              <rect x={tl.px + w/2 - 40} y={tl.py - 24} width="80" height="14" fill="#0f172a" stroke="#fbbf24" strokeWidth="0.4" rx="2" />
              <text x={tl.px + w/2} y={tl.py - 14} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700">{fmt(room.width)} m</text>

              {(room.equipment || []).map(eq => {
                const p = proj(eq.x, eq.z)
                const ew = eq.width * view2D.scale
                const ed = eq.depth * view2D.scale
                const isSelEq = selectedId === eq.id
                if (eq.category === 'door') {
                  return (
                    <g key={eq.id}>
                      <rect x={p.px - ew/2} y={p.py - 3} width={ew} height={6} fill="url(#doorPan)" stroke="#334155" strokeWidth="0.5" rx="1" />
                      <text x={p.px} y={p.py - 8} textAnchor="middle" fontSize="10">🚪</text>
                    </g>
                  )
                }
                const color = eq.category === 'evaporator' ? '#94c5e8' : eq.category === 'condenser' ? '#4ade80' : eq.category === 'rack' ? '#a78bfa' : '#fbbf24'
                const icon = eq.category === 'evaporator' ? '❄' : eq.category === 'condenser' ? '🔥' : eq.category === 'rack' ? '📦' : '⚙'
                return (
                  <g key={eq.id}>
                    <rect x={p.px - ew/2} y={p.py - ed/2} width={ew} height={ed} fill={color} fillOpacity="0.9" stroke={isSelEq ? '#06b6d4' : '#fff'} strokeWidth={isSelEq ? 2.5 : 1} rx="2" />
                    <text x={p.px} y={p.py + 4} textAnchor="middle" fill="#000" fontSize="12" fontWeight="bold" style={{ pointerEvents: 'none' }}>{icon}</text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button onClick={() => setView2D(v => ({ ...v, scale: Math.min(100, v.scale * 1.2) }))} style={{ width: '32px', height: '32px', background: 'rgba(30,41,59,0.92)', color: '#fff', border: '1px solid #334155', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>+</button>
        <button onClick={() => setView2D(v => ({ ...v, scale: Math.max(5, v.scale * 0.8) }))} style={{ width: '32px', height: '32px', background: 'rgba(30,41,59,0.92)', color: '#fff', border: '1px solid #334155', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>−</button>
        <button onClick={() => setView2D({ scale: 30, offsetX: 400, offsetY: 300 })} style={{ width: '32px', height: '32px', background: 'rgba(30,41,59,0.92)', color: '#fff', border: '1px solid #334155', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>⌂</button>
      </div>

      {/* Unit toggle */}
      <div style={{ position: 'absolute', bottom: '14px', right: '14px', display: 'flex', gap: '4px', background: 'rgba(15,23,42,0.92)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
        {[{ id: 'auto', l: 'Auto' }, { id: 'mm', l: 'mm' }, { id: 'cm', l: 'cm' }, { id: 'm', l: 'm' }].map(u => (
          <button key={u.id} onClick={() => {/* setDimUnit via prop */ }} style={{ padding: '6px 10px', background: 'transparent', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>{u.l}</button>
        ))}
      </div>
    </div>
  )
}

function IsometricView3D({ rooms, selectedId, onSelect, proj, rotation }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0a0f1e' }}>
      <svg viewBox="0 0 800 600" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="wallG1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" /><stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="wallG2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" /><stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="#0a0f1e" />

        {/* Axes */}
        {(() => {
          const x0 = proj(0,0,0), x1 = proj(3,0,0), x2 = proj(0,0,3), x3 = proj(0,3,0)
          return (
            <g opacity="0.4">
              <line x1={x0.x} y1={x0.y} x2={x1.x} y2={x1.y} stroke="#ef4444" strokeWidth="1.5" />
              <line x1={x0.x} y1={x0.y} x2={x2.x} y2={x2.y} stroke="#22c55e" strokeWidth="1.5" />
              <line x1={x0.x} y1={x0.y} x2={x3.x} y2={x3.y} stroke="#3b82f6" strokeWidth="1.5" />
            </g>
          )
        })()}

        {rooms.map(room => {
          const L = (room.width || 4) / 2, D = (room.depth || 4) / 2, H = room.height || 2.8
          const p000 = proj(-L,0,-D), p100 = proj(L,0,-D), p010 = proj(-L,H,-D), p110 = proj(L,H,-D)
          const p001 = proj(-L,0,D), p101 = proj(L,0,D), p011 = proj(-L,H,D), p111 = proj(L,H,D)
          const isSel = selectedId === room.id

          return (
            <g key={room.id}>
              <polygon points={`${p000.x},${p000.y} ${p100.x},${p100.y} ${p101.x},${p101.y} ${p001.x},${p001.y}`} fill={room.color || '#3b82f6'} fillOpacity="0.3" />
              <polygon points={`${p100.x},${p100.y} ${p101.x},${p101.y} ${p111.x},${p111.y} ${p110.x},${p110.y}`} fill="url(#wallG1)" stroke={isSel ? '#06b6d4' : '#94a3b8'} strokeWidth={isSel ? 2 : 1} />
              <polygon points={`${p000.x},${p000.y} ${p001.x},${p001.y} ${p011.x},${p011.y} ${p010.x},${p010.y}`} fill="url(#wallG2)" stroke={isSel ? '#06b6d4' : '#94a3b8'} strokeWidth={isSel ? 2 : 1} />
              <polygon points={`${p010.x},${p010.y} ${p110.x},${p110.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`} fill="none" stroke="#06b6d4" strokeWidth="1.5" />
              <line x1={p000.x} y1={p000.y} x2={p010.x} y2={p010.y} stroke="#06b6d4" strokeWidth="1" />
              <line x1={p100.x} y1={p100.y} x2={p110.x} y2={p110.y} stroke="#06b6d4" strokeWidth="1" />
              <line x1={p001.x} y1={p001.y} x2={p011.x} y2={p011.y} stroke="#06b6d4" strokeWidth="1" />
              <line x1={p101.x} y1={p101.y} x2={p111.x} y2={p111.y} stroke="#06b6d4" strokeWidth="1" />
              <circle cx={(p010.x + p110.x)/2} cy={p010.y - 8} r="13" fill="#06b6d4" stroke="#fff" strokeWidth="1.5" />
              <text x={(p010.x + p110.x)/2} y={p010.y - 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">{room.temp}°</text>
              <text x={(p010.x + p110.x)/2 + 22} y={p010.y - 8} fill="#fff" fontSize="12" fontWeight="600">{room.name}</text>

              {/* Equipment in 3D */}
              {(room.equipment || []).map(eq => {
                const eW = eq.width, eD = eq.depth, eH = eq.height || 0.5
                const eY = eq.y || 0
                const ep000 = proj(eq.x - eW/2, eY, eq.z - eD/2)
                const ep100 = proj(eq.x + eW/2, eY, eq.z - eD/2)
                const ep010 = proj(eq.x - eW/2, eY + eH, eq.z - eD/2)
                const ep110 = proj(eq.x + eW/2, eY + eH, eq.z - eD/2)
                const ep001 = proj(eq.x - eW/2, eY, eq.z + eD/2)
                const ep101 = proj(eq.x + eW/2, eY, eq.z + eD/2)
                const ep011 = proj(eq.x - eW/2, eY + eH, eq.z + eD/2)
                const ep111 = proj(eq.x + eW/2, eY + eH, eq.z + eD/2)
                const isDoor = eq.category === 'door'
                const color = eq.category === 'door' ? '#a16207' : eq.category === 'evaporator' ? '#94c5e8' : eq.category === 'condenser' ? '#4ade80' : eq.category === 'rack' ? '#a78bfa' : '#fbbf24'
                return (
                  <g key={eq.id}>
                    <polygon points={`${ep010.x},${ep010.y} ${ep110.x},${ep110.y} ${ep111.x},${ep111.y} ${ep011.x},${ep011.y}`} fill="url(#wallG1)" stroke="#475569" strokeWidth="0.8" />
                    <polygon points={`${ep000.x},${ep000.y} ${ep100.x},${ep100.y} ${ep110.x},${ep110.y} ${ep010.x},${ep010.y}`} fill="#e2e8f0" stroke="#475569" strokeWidth="0.6" />
                    <polygon points={`${ep100.x},${ep100.y} ${ep101.x},${ep101.y} ${ep111.x},${ep111.y} ${ep110.x},${ep110.y}`} fill={color} stroke="#475569" strokeWidth="0.5" />
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>

      <div style={{ position: 'absolute', bottom: '20px', left: '20px', padding: '10px', background: 'rgba(15,23,42,0.92)', borderRadius: '8px', border: '1px solid #334155', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
        <div style={{ color: '#06b6d4', fontWeight: 700, marginBottom: '4px' }}>🎮 3D-näkymä</div>
        <div>Atsimuutti: {Math.round(rotation.azimuth * 180 / Math.PI)}°</div>
        <div>Korkeus: {Math.round(rotation.elevation * 180 / Math.PI)}°</div>
      </div>
    </div>
  )
}

function exportToPDF(rooms, heatLoad, projectName, user) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210

  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 297, 'F')
  doc.setFillColor(30, 41, 59); doc.rect(0, 60, W, 60, 'F')

  doc.setFontSize(24); doc.setTextColor(6, 182, 212); doc.text('RefCAD Tool', 20, 35)
  doc.setFontSize(10); doc.setTextColor(148, 163, 184); doc.text('Cold Room Designer Report', 20, 45)
  doc.setFontSize(28); doc.setTextColor(255, 255, 255); doc.text(projectName, 20, 90)
  doc.setFontSize(11); doc.setTextColor(148, 163, 184)
  doc.text(`Käyttäjä: ${user.email}`, 20, 105)
  doc.text(`Päivämäärä: ${new Date().toLocaleDateString('fi-FI')}`, 20, 112)
  doc.text(`Huoneet: ${rooms.length}`, 20, 119)

  doc.setFillColor(6, 182, 212); doc.rect(20, 130, W - 40, 1, 'F')

  doc.setFontSize(14); doc.setTextColor(255, 255, 255); doc.text('Kokonaislämpökuorma', 20, 150)
  doc.setFontSize(40); doc.setTextColor(6, 182, 212); doc.text(`${heatLoad.total.toLocaleString()}`, 20, 175)
  doc.setFontSize(12); doc.setTextColor(148, 163, 184); doc.text('W', 75, 175)
  doc.setFontSize(10); doc.text(`(${Math.round(heatLoad.total / 1000 * 100) / 100} kW)`, 90, 168)
  doc.text(`(${Math.round(heatLoad.total * 3.41214).toLocaleString()} BTU/h)`, 90, 175)

  doc.addPage()
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 297, 'F')
  doc.setFontSize(16); doc.setTextColor(6, 182, 212); doc.text('Lämpökuorman erittely', 20, 20)

  let y = 40
  const items = [
    { label: 'Johtuminen', value: heatLoad.transmission, color: [96, 165, 250] },
    { label: 'Ilmanvaihto', value: heatLoad.infiltration, color: [167, 139, 250] },
    { label: 'Tuotteet', value: heatLoad.product, color: [251, 191, 36] },
    { label: 'Laitteet', value: heatLoad.equipment, color: [74, 222, 128] },
    { label: 'Valaistus', value: heatLoad.lighting, color: [6, 182, 212] },
    { label: 'Henkilöt', value: heatLoad.occupancy, color: [244, 114, 182] }
  ]
  items.forEach(item => {
    doc.setFillColor(...item.color); doc.rect(20, y - 4, 5, 8, 'F')
    doc.setFontSize(11); doc.setTextColor(60); doc.text(item.label, 30, y)
    doc.setFontSize(13); doc.setTextColor(...item.color); doc.text(`${item.value.toLocaleString()} W`, 90, y)
    const pct = ((item.value / (heatLoad.total || 1)) * 100).toFixed(1)
    doc.setFontSize(10); doc.setTextColor(120); doc.text(`${pct}%`, W - 30, y)
    doc.setFillColor(240); doc.rect(125, y - 3, 50, 5, 'F')
    doc.setFillColor(...item.color); doc.rect(125, y - 3, 50 * (item.value / heatLoad.total), 5, 'F')
    y += 12
  })

  doc.addPage()
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 297, 'F')
  doc.setFontSize(16); doc.setTextColor(6, 182, 212); doc.text('Huoneet', 20, 20)

  y = 40
  rooms.forEach(room => {
    doc.setFillColor(room.color || '#1e3a8a'); doc.rect(20, y - 4, 3, 8, 'F')
    doc.setFontSize(11); doc.setTextColor(0); doc.text(room.name, 26, y)
    doc.setFontSize(9); doc.setTextColor(80); doc.text(`${fmt(room.width)}×${fmt(room.depth)}×${fmt(room.height)} m · ${room.temp}°C`, 26, y + 5)
    doc.setFontSize(9); doc.setTextColor(120); doc.text(`Laitteet: ${(room.equipment || []).length} kpl`, 26, y + 10)
    y += 20
  })

  doc.save(`refcad_${projectName.replace(/\s+/g, '_')}_${Date.now()}.pdf`)
}
