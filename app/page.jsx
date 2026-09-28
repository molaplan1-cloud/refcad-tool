'use client'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { jsPDF } from 'jspdf'

// ====== HELPERS ======
const genId = () => Math.random().toString(36).substr(2, 9)

// Smart dimension formatting - shows mm for small values, m for larger
const formatDim = (meters, unit = 'auto') => {
  if (unit === 'm') return `${meters.toFixed(2)} m`
  if (unit === 'cm') return `${(meters * 100).toFixed(1)} cm`
  if (unit === 'mm') return `${(meters * 1000).toFixed(0)} mm`
  // Auto: use mm when value < 1m, otherwise meters
  if (meters < 1) return `${(meters * 1000).toFixed(0)} mm`
  if (meters < 10) return `${meters.toFixed(2)} m`
  return `${meters.toFixed(1)} m`
}
const fmt = (n, d = 2) => typeof n === 'number' ? n.toFixed(d) : '0.00'
const clone = obj => JSON.parse(JSON.stringify(obj))

// ====== COLD ROOM TEMPLATES ======
const COLD_ROOM_TYPES = [
  { id: 'chilled', name: 'Chilled Storage', nameSub: '+2°C', icon: '🌡️', gradient: 'from-blue-500 to-blue-700', accent: '#3b82f6', temp: 2, ambient: 25, shortDescription: 'Jäähdytysvarasto tuoreille tuotteille', features: ['Hengityslämpö tuoreille tuotteille', 'Kosteudenhallinta', 'Vakiintunut kuormapohja'], insulation: 80, uWall: 0.30, uCeiling: 0.25, uFloor: 0.35 },
  { id: 'frozen', name: 'Frozen Storage', nameSub: '-18°C', icon: '❄️', gradient: 'from-indigo-600 to-blue-900', accent: '#1d4ed8', temp: -18, ambient: 25, shortDescription: 'Pakasteiden pitkäaikaisvarasto', features: ['Paksu eristys', 'Vähäinen hengityslämpö', 'Säännöllinen ovikäyttö'], insulation: 120, uWall: 0.22, uCeiling: 0.20, uFloor: 0.28 },
  { id: 'blast-chiller', name: 'Blast Chiller', nameSub: '0°C', icon: '🧊', gradient: 'from-cyan-500 to-blue-600', accent: '#06b6d4', temp: 0, ambient: 25, shortDescription: 'Pikajäähdytin kuumatuotteille', features: ['Korkea ilmavirta', 'Voimakas eristys', 'Suuret lämpökuormat'], insulation: 100, uWall: 0.35, uCeiling: 0.28, uFloor: 0.40 },
  { id: 'blast-freezer', name: 'Blast Freezer', nameSub: '-30°C', icon: '🥶', gradient: 'from-cyan-700 to-indigo-900', accent: '#0891b2', temp: -30, ambient: 25, shortDescription: 'Pikapakastin raakatuotteille', features: ['Erittäin korkea ilmavirta', 'Massiivinen eristys', 'Erittäin suuret kuormat'], insulation: 150, uWall: 0.28, uCeiling: 0.22, uFloor: 0.32 },
  { id: 'fresh', name: 'Fresh Room', nameSub: '-2°C', icon: '🥬', gradient: 'from-green-500 to-emerald-700', accent: '#22c55e', temp: -2, ambient: 25, shortDescription: 'Tuoreiden kasvisten varasto', features: ['Korkea kosteus 85-90%', 'Hengityslämpö merkittävä', 'Tiivis ilmanvaihto'], insulation: 80, uWall: 0.32, uCeiling: 0.26, uFloor: 0.36 }
]

const PRODUCT_DATABASE = [
  { id: 'vegetables', name: 'Kasvikset', icon: '🥬', cp: 3.85, freezingPoint: -1.0, respiration: 0.10 },
  { id: 'meat', name: 'Naudanliha', icon: '🥩', cp: 3.50, freezingPoint: -1.7, respiration: 0 },
  { id: 'pork', name: 'Sianliha', icon: '🥓', cp: 3.40, freezingPoint: -2.2, respiration: 0 },
  { id: 'poultry', name: 'Siipikarja', icon: '🍗', cp: 3.30, freezingPoint: -2.8, respiration: 0 },
  { id: 'fish', name: 'Tuore kala', icon: '🐟', cp: 3.60, freezingPoint: -1.5, respiration: 0.05 },
  { id: 'dairy', name: 'Maitotuotteet', icon: '🥛', cp: 3.90, freezingPoint: -1.3, respiration: 0 },
  { id: 'frozen-meals', name: 'Valmisruoat', icon: '🍱', cp: 2.50, freezingPoint: -18, respiration: 0 },
  { id: 'ice-cream', name: 'Jäätelö', icon: '🍦', cp: 2.30, freezingPoint: -20, respiration: 0 },
  { id: 'bakery', name: 'Leivonnaiset', icon: '🍞', cp: 2.60, freezingPoint: -5, respiration: 0 },
  { id: 'fruits', name: 'Hedelmät', icon: '🍎', cp: 3.85, freezingPoint: -1.5, respiration: 0.08 },
  { id: 'pharma', name: 'Lääkkeet', icon: '💊', cp: 2.00, freezingPoint: -5, respiration: 0 },
  { id: 'flowers', name: 'Kukat', icon: '🌹', cp: 3.50, freezingPoint: -1.5, respiration: 0.20 }
]

const EQUIPMENT_CATALOG = [
  // Doors
  { id: 'door-h700', category: 'door', name: 'Kylmäovi 700mm', icon: '🚪', width: 0.7, height: 2.0, depth: 0.10, capacity: 0, desc: 'Kapea henkilökunnan ovi' },
  { id: 'door-h900', category: 'door', name: 'Kylmäovi 900mm', icon: '🚪', width: 0.9, height: 2.0, depth: 0.10, capacity: 0, desc: 'Henkilökunnan ovi' },
  { id: 'door-h1200', category: 'door', name: 'Liukuovi 1200mm', icon: '🚪', width: 1.2, height: 2.2, depth: 0.10, capacity: 0, desc: 'Liukuovi pienille lavoille' },
  { id: 'door-h1500', category: 'door', name: 'Liukuovi 1500mm', icon: '🚪', width: 1.5, height: 2.4, depth: 0.10, capacity: 0, desc: 'Liukuovi lavoille' },
  { id: 'door-h2000', category: 'door', name: 'Liukuovi 2000mm', icon: '🚪', width: 2.0, height: 2.6, depth: 0.10, capacity: 0, desc: 'Iso liukuovi' },
  { id: 'door-rapid', category: 'door', name: 'Pikaovi 1500mm', icon: '🚪', width: 1.5, height: 2.4, depth: 0.10, capacity: 0, desc: 'Pikaovi nopeaan liikenteeseen' },
  // Evaporators
  { id: 'evap-05', category: 'evaporator', name: 'Höyrystin 5kW', icon: '❄️', width: 0.8, height: 0.4, depth: 0.6, capacity: 5, desc: 'Pieni höyrystin pieniin huoneisiin' },
  { id: 'evap-10', category: 'evaporator', name: 'Höyrystin 10kW', icon: '❄️', width: 1.2, height: 0.5, depth: 0.8, capacity: 10, desc: 'Keskikokoinen höyrystin' },
  { id: 'evap-20', category: 'evaporator', name: 'Höyrystin 20kW', icon: '❄️', width: 1.6, height: 0.6, depth: 1.0, capacity: 20, desc: 'Tehokas höyrystin isoille huoneille' },
  { id: 'evap-35', category: 'evaporator', name: 'Höyrystin 35kW', icon: '❄️', width: 2.0, height: 0.8, depth: 1.2, capacity: 35, desc: 'Suurteho höyrystin' },
  // Condensers
  { id: 'cond-15', category: 'condenser', name: 'Lauhdutin 15kW', icon: '🔥', width: 1.0, height: 0.7, depth: 0.5, capacity: 15, desc: 'Ilmajäähdytteinen lauhdutin' },
  { id: 'cond-30', category: 'condenser', name: 'Lauhdutin 30kW', icon: '🔥', width: 1.5, height: 0.9, depth: 0.8, capacity: 30, desc: 'Keskioteho lauhdutin' },
  { id: 'cond-60', category: 'condenser', name: 'Lauhdutin 60kW', icon: '🔥', width: 2.0, height: 1.1, depth: 1.0, capacity: 60, desc: 'Suurteho lauhdutin' },
  // Units
  { id: 'compact-8', category: 'unit', name: 'Koneikko 8kW', icon: '⚙️', width: 1.0, height: 1.5, depth: 0.8, capacity: 8, desc: 'Kompakti hermeettinen' },
  { id: 'compact-15', category: 'unit', name: 'Koneikko 15kW', icon: '⚙️', width: 1.5, height: 1.6, depth: 1.0, capacity: 15, desc: 'Puolikompakti' },
  // Racking
  { id: 'racking', category: 'rack', name: 'Lavahylly 3m', icon: '📦', width: 3.0, height: 4.5, depth: 1.0, capacity: 0, desc: 'Vakiokokoinen lavahylly' }
]

const getEquipmentById = (id) => EQUIPMENT_CATALOG.find(e => e.id === id)

// ====== HEAT LOAD ENGINE ======
function calculateHeatLoad(rooms) {
  let Q = { transmission: 0, infiltration: 0, product: 0, equipment: 0, lighting: 0, occupancy: 0 }
  let totalArea = 0, totalVolume = 0

  rooms.forEach(room => {
    const L = room.width || 4
    const D = room.depth || 4
    const H = room.height || 2.8
    const area = L * D
    const volume = area * H
    totalArea += area
    totalVolume += volume

    const wallArea = 2 * (L + D) * H
    const ceilingArea = area
    const floorArea = area
    const dT = (room.ambientTemp || 25) - (room.temp || 2)

    Q.transmission += wallArea * (room.uWall || 0.25) * dT
    Q.transmission += ceilingArea * (room.uCeiling || 0.20) * dT
    Q.transmission += floorArea * (room.uFloor || 0.28) * dT

    Q.infiltration += (room.equipment || []).filter(e => e.category === 'door').length * 0.5 * 60 * 1.0 * 1.2 * 1005 * dT / 3600;
    (room.products || []).forEach(p => {
      if (p.dailyMass > 0) {
        Q.product += p.dailyMass * p.cp * (p.entryTemp - room.temp) / 24
        Q.product += p.dailyMass * (p.respiration || 0) * 1000 / 24
      }
    })
    Q.lighting += area * 12
    Q.occupancy += 350
    Q.equipment += (room.equipment || []).reduce((s, eq) => s + (eq.capacity || 0) * 100, 0)
  })

  const total = Object.values(Q).reduce((s, v) => s + v, 0)
  return {
    ...Q,
    transmission: Math.round(Q.transmission),
    infiltration: Math.round(Q.infiltration),
    product: Math.round(Q.product),
    equipment: Math.round(Q.equipment),
    lighting: Math.round(Q.lighting),
    occupancy: Math.round(Q.occupancy),
    total: Math.round(total),
    area: totalArea.toFixed(1),
    volume: totalVolume.toFixed(1),
    recommendedEvapCap: Math.round(total * 1.2 / 100) / 10,
    recommendedCondCap: Math.round(total * 1.3 / 100) / 10
  }
}

// ====== ISOMETRIC VIEW ======
function IsometricView({ rooms, selectedId, onSelect, onContextMenu3D }) {
  // Camera rotation state
  const [rotation, setRotation] = useState({ azimuth: 0, elevation: 0.4 })
  const [zoom, setZoom] = useState(50)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [dragState, setDragState] = useState(null)

  // Project 3D point to 2D screen given camera rotation
  const proj = (x, y, z) => {
    const cosA = Math.cos(rotation.azimuth)
    const sinA = Math.sin(rotation.azimuth)
    const cosE = Math.cos(rotation.elevation)
    const sinE = Math.sin(rotation.elevation)

    // Rotate around Y axis (azimuth)
    const xr = x * cosA + z * sinA
    const zr = -x * sinA + z * cosA

    // Tilt (elevation)
    const yr = y * cosE - zr * sinE
    const zr2 = y * sinE + zr * cosE

    // Orthographic projection
    return {
      x: xr * zoom + 400 + panX,
      y: -yr * zoom + 280 + panY,
      depth: zr2  // For sorting (closer to camera renders later)
    }
  }

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setDragState({
        startX: e.clientX, startY: e.clientY,
        startAzimuth: rotation.azimuth, startElevation: rotation.elevation,
        startPanX: panX, startPanY: panY,
        shiftKey: e.shiftKey
      })
    }
  }

  const handleMouseMove = (e) => {
    if (!dragState) return
    const dx = e.clientX - dragState.startX
    const dy = e.clientY - dragState.startY
    if (e.ctrlKey || dragState.shiftKey) {
      setPanX(dragState.startPanX + dx)
      setPanY(dragState.startPanY + dy)
    } else {
      setRotation({
        azimuth: dragState.startAzimuth + dx * 0.01,
        elevation: Math.max(-0.3, Math.min(1.2, dragState.startElevation + dy * 0.01))
      })
    }
  }

  const handleWheel = (e) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.max(15, Math.min(120, z * delta)))
  }

  const resetView = () => {
    setRotation({ azimuth: 0, elevation: 0.4 })
    setZoom(50)
    setPanX(0)
    setPanY(0)
  }

  const presetViews = [
    { label: 'Edestä', rot: { azimuth: 0, elevation: 0.2 } },
    { label: 'Sivulta', rot: { azimuth: Math.PI / 2, elevation: 0.2 } },
    { label: 'Ylhäältä', rot: { azimuth: 0, elevation: 0.9 } },
    { label: 'Isometric', rot: { azimuth: Math.PI / 4, elevation: 0.4 } }
  ]

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', cursor: dragState ? 'grabbing' : 'grab', overflow: 'hidden', background: '#0a0f1e' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDragState(null)}
      onMouseLeave={() => setDragState(null)}
      onWheel={handleWheel}
    >
      <svg viewBox="0 0 800 600" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="wallGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="wallGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="floorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="#0a0f1e" />

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
          const isSelected = selectedId === room.id

          return (
            <g key={room.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(room.id)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu3D && onContextMenu3D(e, room, null) }}>
              <polygon points={`${p000.x},${p000.y} ${p100.x},${p100.y} ${p101.x},${p101.y} ${p001.x},${p001.y}`} fill="url(#floorGrad)" stroke={room.color || '#3b82f6'} strokeWidth="0.5" />

              {/* Floor tiles pattern */}
              <g opacity="0.3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <line key={i} x1={p000.x + (p100.x - p000.x) * (i + 1) / 4} y1={p000.y}
                    x2={p001.x + (p101.x - p001.x) * (i + 1) / 4} y2={p001.y}
                    stroke="#1e3a5f" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 4 }).map((_, i) => (
                  <line key={i} x1={p100.x + (p101.x - p100.x) * (i + 1) / 4} y1={p100.y}
                    x2={p000.x + (p001.x - p000.x) * (i + 1) / 4} y2={p000.y}
                    stroke="#1e3a5f" strokeWidth="0.5" />
                ))}
              </g>

              <polygon points={`${p100.x},${p100.y} ${p101.x},${p101.y} ${p111.x},${p111.y} ${p110.x},${p110.y}`} fill="url(#wallGrad1)" stroke={isSelected ? "#06b6d4" : "#94a3b8"} strokeWidth={isSelected ? 2 : 1} />
              <polygon points={`${p000.x},${p000.y} ${p001.x},${p001.y} ${p011.x},${p011.y} ${p010.x},${p010.y}`} fill="url(#wallGrad2)" stroke={isSelected ? "#06b6d4" : "#94a3b8"} strokeWidth={isSelected ? 2 : 1} />
              <polygon points={`${p010.x},${p010.y} ${p110.x},${p110.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`} fill="none" stroke="#06b6d4" strokeWidth="1.5" />
              <line x1={p000.x} y1={p000.y} x2={p010.x} y2={p010.y} stroke="#06b6d4" strokeWidth="1" />
              <line x1={p100.x} y1={p100.y} x2={p110.x} y2={p110.y} stroke="#06b6d4" strokeWidth="1" />
              <line x1={p001.x} y1={p001.y} x2={p011.x} y2={p011.y} stroke="#06b6d4" strokeWidth="1" />
              <line x1={p101.x} y1={p101.y} x2={p111.x} y2={p111.y} stroke="#06b6d4" strokeWidth="1" />

              {/* Wall panels detail */}
              {(() => {
                const lines = []
                for (let i = 1; i < 4; i++) {
                  const xL = p000.x + (p001.x - p000.x) * (i / 4)
                  const yL = p000.y + (p001.y - p000.y) * (i / 4)
                  const xL2 = p010.x + (p011.x - p010.x) * (i / 4)
                  const yL2 = p010.y + (p011.y - p010.y) * (i / 4)
                  lines.push(<line key={`w1-${i}`} x1={xL} y1={yL} x2={xL2} y2={yL2} stroke="#475569" strokeWidth="0.4" opacity="0.6" />)
                }
                for (let i = 1; i < 3; i++) {
                  const yT = p000.y + (p010.y - p000.y) * (i / 3)
                  const xT = p000.x + (p010.x - p000.x) * (i / 3)
                  const yT2 = p001.y + (p011.y - p001.y) * (i / 3)
                  const xT2 = p001.x + (p011.x - p001.x) * (i / 3)
                  lines.push(<line key={`w2-${i}`} x1={xT} y1={yT} x2={xT2} y2={yT2} stroke="#475569" strokeWidth="0.4" opacity="0.6" />)
                }
                return lines
              })()}

              <circle cx={(p010.x + p110.x)/2} cy={p010.y - 8} r="14" fill="#06b6d4" stroke="#fff" strokeWidth="1.5" />
              <text x={(p010.x + p110.x)/2} y={p010.y - 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">{room.temp}°</text>
              <text x={(p010.x + p110.x)/2 + 25} y={p010.y - 8} fill="#fff" fontSize="12" fontWeight="600" dominantBaseline="middle">{room.name}</text>

              {/* Equipment in room with detailed rendering */}
              {(room.equipment || []).map(eq => {
                const eX = eq.x, eZ = eq.z, eH = (eq.height || 0.5)
                const eY = (eq.y || 0)
                const eW = eq.width, eD = eq.depth
                const ep100 = proj(eX + eW/2, eY, eZ - eD/2)
                const ep110 = proj(eX + eW/2, eY + eH, eZ - eD/2)
                const ep010 = proj(eX - eW/2, eY + eH, eZ - eD/2)
                const ep000 = proj(eX - eW/2, eY, eZ - eD/2)
                const ep001 = proj(eX - eW/2, eY, eZ + eD/2)
                const ep101 = proj(eX + eW/2, eY, eZ + eD/2)
                const ep011 = proj(eX - eW/2, eY + eH, eZ + eD/2)
                const ep111 = proj(eX + eW/2, eY + eH, eZ + eD/2)
                const isDoor = eq.category === 'door'

                return (
                  <g key={eq.id} onClick={(e) => { e.stopPropagation(); onSelect(eq.id) }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu3D && onContextMenu3D(e, room, eq) }} style={{ cursor: 'pointer' }}>
                    {isDoor ? (
                      <Door3DDetail ep100={ep100} ep110={ep110} ep010={ep010} ep000={ep000} ep011={ep011} isSelected={selectedId === eq.id} eW={eW} />
                    ) : eq.category === 'evaporator' ? (
                      <Evaporator3DDetail ep100={ep100} ep110={ep110} ep010={ep010} ep000={ep000} ep101={ep101} ep111={ep111} ep011={ep011} isSelected={selectedId === eq.id} eW={eW} eH={eH} />
                    ) : eq.category === 'condenser' ? (
                      <Condenser3DDetail ep100={ep100} ep110={ep110} ep010={ep010} ep000={ep000} ep101={ep101} ep111={ep111} ep011={ep011} cx={(ep010.x + ep110.x) / 2} cy={(ep010.y + ep110.y) / 2} isSelected={selectedId === eq.id} eW={eW} eH={eH} />
                    ) : eq.category === 'rack' ? (
                      <Rack3DDetail ep100={ep100} ep110={ep110} ep010={ep010} ep000={ep000} ep101={ep101} ep111={ep111} ep011={ep011} isSelected={selectedId === eq.id} />
                    ) : (
                      <Unit3DDetail ep100={ep100} ep110={ep110} ep010={ep010} ep000={ep000} ep101={ep101} ep111={ep111} ep011={ep011} isSelected={selectedId === eq.id} />
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Rotation controls */}
      <div style={{ position: 'absolute', top: '70px', right: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ background: 'rgba(15,23,42,0.92)', padding: '8px', borderRadius: '8px', border: '1px solid #334155', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>📷 Näkymä</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {presetViews.map((preset, i) => (
              <button key={i} onClick={() => setRotation(preset.rot)} style={{
                padding: '6px 8px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
                color: '#fff', fontSize: '10px', cursor: 'pointer'
              }}>
                {preset.label}
              </button>
            ))}
          </div>
          <button onClick={resetView} style={{
            width: '100%', marginTop: '6px', padding: '6px',
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', fontWeight: '700', cursor: 'pointer'
          }}>
            ↻ Palauta oletus
          </button>
          <div style={{ marginTop: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
            <div>Atsimuutti: {Math.round(rotation.azimuth * 180 / Math.PI)}°</div>
            <div>Korkeus: {Math.round(rotation.elevation * 180 / Math.PI)}°</div>
            <div>Zoom: {zoom.toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Help text */}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', padding: '8px 12px', background: 'rgba(15,23,42,0.92)', borderRadius: '8px', border: '1px solid #334155', fontSize: '11px', color: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)' }}>
        <div style={{ color: '#06b6d4', fontWeight: '600', marginBottom: '4px' }}>🎮 Ohjaus</div>
        <div>• <b>Vedä</b> pyörittääksesi näkymää</div>
        <div>• <b>Shift+vedä</b> panoroidaksesi</div>
        <div>• <b>Rulla</b> zoomataksesi</div>
        <div>• <b>Ctrl+vedä</b> myös panoroida</div>
      </div>
    </div>
  )
}

// ====== 3D Detail Renderers ======
function Door3DDetail({ ep100, ep110, ep010, ep000, ep011, isSelected, eW }) {
  const color = isSelected ? '#06b6d4' : '#94a3b8'
  return (
    <g>
      {/* Door frame */}
      <polygon points={`${ep000.x},${ep000.y} ${ep100.x},${ep100.y} ${ep110.x},${ep110.y} ${ep010.x},${ep010.y}`}
        fill={isSelected ? '#cbd5e1' : '#e2e8f0'} stroke={color} strokeWidth="1.5" />
      <polygon points={`${ep010.x},${ep010.y} ${ep110.x},${ep110.y} ${ep111.x},${ep111.y} ${ep011.x},${ep011.y}`}
        fill={isSelected ? '#a8b3c5' : '#cbd5e1'} stroke={color} strokeWidth="0.8" opacity="0.85" />
      {/* Top frame */}
      <line x1={ep010.x} y1={ep010.y} x2={ep110.x} y2={ep110.y} stroke="#fbbf24" strokeWidth="2" />
      {/* Door swing arc */}
      <line x1={ep100.x} y1={ep100.y} x2={ep110.x} y2={ep110.y} stroke="#fbbf24" strokeWidth="2" />
      <line x1={ep000.x} y1={ep000.y} x2={ep010.x} y2={ep010.y} stroke={color} strokeWidth="1" strokeDasharray="3,2" />
      {/* Handle */}
      <circle cx={(ep100.x + ep110.x) / 2} cy={(ep100.y + ep110.y) / 2} r="2" fill="#fbbf24" stroke="#1e293b" strokeWidth="0.5" />
      {/* Window */}
      {(() => {
        const xL = ep010.x + (ep110.x - ep010.x) * 0.6
        const xL2 = ep010.x + (ep110.x - ep010.x) * 0.85
        const yT = ep010.y + (ep110.y - ep010.y) * 0.3
        const yT2 = ep010.y + (ep110.y - ep010.y) * 0.55
        return <rect x={Math.min(xL, xL2)} y={Math.min(yT, yT2)} width={Math.abs(xL2 - xL)} height={Math.abs(yT2 - yT)} fill="#0ea5e9" fillOpacity="0.5" stroke={color} strokeWidth="0.5" />
      })()}
    </g>
  )
}

function Evaporator3DDetail({ ep100, ep110, ep010, ep000, ep101, ep111, ep011, isSelected, eW, eH }) {
  return (
    <g>
      {/* Ceiling mount bar */}
      <line x1={ep010.x - 3} y1={ep010.y - 2} x2={ep110.x + 3} y2={ep110.y - 2} stroke="#1e293b" strokeWidth="2" />
      {/* TOP face - air intake */}
      <polygon points={`${ep010.x},${ep010.y} ${ep110.x},${ep110.y} ${ep111.x},${ep111.y} ${ep011.x},${ep011.y}`}
        fill="url(#wallGrad1)" stroke={isSelected ? "#06b6d4" : "#475569"} strokeWidth="0.8" />
      {/* Top grille slats */}
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1={ep010.x + (ep110.x - ep010.x) * 0.1} y1={ep010.y + (ep011.y - ep010.y) * (i + 1) / 5}
          x2={ep110.x - (ep110.x - ep010.x) * 0.1} y2={ep010.y + (ep011.y - ep010.y) * (i + 1) / 5}
          stroke="#1e293b" strokeWidth="0.4" opacity="0.6" />
      ))}
      {/* FRONT face - cooling coils and fans */}
      <polygon points={`${ep000.x},${ep000.y} ${ep100.x},${ep100.y} ${ep110.x},${ep110.y} ${ep010.x},${ep010.y}`}
        fill="#e2e8f0" stroke={isSelected ? "#06b6d4" : "#475569"} strokeWidth="1" />
      {/* Cooling coils detail (vertical) */}
      {Array.from({ length: Math.floor(eW * 4) }).map((_, i) => {
        const x = ep010.x + (ep110.x - ep010.x) * ((i + 1) / (Math.floor(eW * 4) + 1))
        const yTop = ep010.y + (ep110.y - ep010.y) * 0.85
        const yBot = ep000.y + (ep100.y - ep000.y) * 0.25
        return <line key={i} x1={x} y1={yTop} x2={x} y2={yBot} stroke="#475569" strokeWidth="0.6" opacity="0.7" />
      })}
      {/* Horizontal fins */}
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={i} x1={ep010.x + (ep110.x - ep010.x) * 0.05} y1={ep010.y + (ep000.y - ep010.y) * (0.35 + i * 0.12)}
          x2={ep110.x - (ep110.x - ep010.x) * 0.05} y2={ep010.y + (ep000.y - ep010.y) * (0.35 + i * 0.12)}
          stroke="#94a3b8" strokeWidth="0.3" opacity="0.5" />
      ))}
      {/* SIDE face */}
      <polygon points={`${ep100.x},${ep100.y} ${ep101.x},${ep101.y} ${ep111.x},${ep111.y} ${ep110.x},${ep110.y}`}
        fill="#94a3b8" stroke="#475569" strokeWidth="0.5" />
      {/* Fans on front bottom */}
      {Array.from({ length: Math.max(1, Math.floor(eW / 1.5)) }).map((_, i) => {
        const fanCount = Math.max(1, Math.floor(eW / 1.5))
        const cx = ep010.x + (ep110.x - ep010.x) * ((i + 1) / (fanCount + 1))
        const cyM = ep010.y + (ep000.y - ep010.y) * 0.15
        const fanR = Math.min(Math.abs(ep110.x - ep010.x) / (fanCount + 1) / 2, 8)
        return (
          <g key={`fan-${i}`}>
            <circle cx={cx} cy={cyM} r={fanR} fill="#1e293b" stroke="#0f172a" strokeWidth="0.5" />
            <circle cx={cx} cy={cyM} r="1" fill="#94a3b8" />
            {[0, 60, 120, 180, 240, 300].map(a => (
              <line key={a} x1={cx} y1={cyM} x2={cx + fanR * 0.7 * Math.cos((a - 90) * Math.PI / 180)} y2={cyM + fanR * 0.7 * Math.sin((a - 90) * Math.PI / 180)} stroke="#475569" strokeWidth="0.3" opacity="0.7" />
            ))}
            <circle cx={cx} cy={cyM} r="0.5" fill="#0f172a" />
          </g>
        )
      })}
      {/* Brand label */}
      <rect x={(ep010.x + ep110.x) / 2 - 8} y={(ep010.y + ep000.y) / 2 - 18} width="16" height="6" fill="#1e293b" stroke="#06b6d4" strokeWidth="0.3" rx="0.5" />
      <text x={(ep010.x + ep110.x) / 2} y={(ep010.y + ep000.y) / 2 - 13} textAnchor="middle" fill="#06b6d4" fontSize="5" fontWeight="bold">EVAP</text>
      {/* Drip tray at bottom */}
      <line x1={ep010.x - 1} y1={ep000.y + 1} x2={ep100.x + 1} y2={ep000.y + 1} stroke="#475569" strokeWidth="3" />
    </g>
  )
}

function Condenser3DDetail({ ep100, ep110, ep010, ep000, ep101, ep111, ep011, cx, cy, isSelected, eW, eH }) {
  return (
    <g>
      {/* TOP face - coils */}
      <polygon points={`${ep010.x},${ep010.y} ${ep110.x},${ep110.y} ${ep111.x},${ep111.y} ${ep011.x},${ep011.y}`}
        fill="#f59e0b" stroke={isSelected ? "#06b6d4" : "#b45309"} strokeWidth="0.8" />
      {/* Coils on top */}
      {Array.from({ length: Math.floor(eW * 4) }).map((_, i) => (
        <line key={i} x1={ep010.x + (ep110.x - ep010.x) * ((i + 1) / (Math.floor(eW * 4) + 1))} y1={ep010.y}
          x2={ep010.x + (ep110.x - ep010.x) * ((i + 1) / (Math.floor(eW * 4) + 1))} y2={ep010.y - 3}
          stroke="#b45309" strokeWidth="0.6" />
      ))}
      {/* FRONT face */}
      <polygon points={`${ep000.x},${ep000.y} ${ep100.x},${ep100.y} ${ep110.x},${ep110.y} ${ep010.x},${ep010.y}`}
        fill="url(#wallGrad2)" stroke={isSelected ? "#06b6d4" : "#b45309"} strokeWidth="1" />
      {/* Coils on front */}
      {Array.from({ length: Math.floor(eW * 4) }).map((_, i) => {
        const x = ep010.x + (ep110.x - ep010.x) * ((i + 1) / (Math.floor(eW * 4) + 1))
        const yTop = ep010.y + (ep110.y - ep010.y) * 0.6
        const yBot = ep000.y + (ep100.y - ep000.y) * 0.4
        return <line key={i} x1={x} y1={yTop} x2={x} y2={yBot} stroke="#b45309" strokeWidth="0.7" opacity="0.75" />
      })}
      {/* SIDE face */}
      <polygon points={`${ep100.x},${ep100.y} ${ep101.x},${ep101.y} ${ep111.x},${ep111.y} ${ep110.x},${ep110.y}`}
        fill="#fbbf24" stroke="#b45309" strokeWidth="0.5" />
      {/* Side details - louver */}
      {Array.from({ length: 3 }).map((_, i) => (
        <line key={i} x1={ep100.x + (ep101.x - ep100.x) * 0.3} y1={ep100.y + (ep101.y - ep100.y) * (0.2 + i * 0.2)}
          x2={ep110.x + (ep111.x - ep110.x) * 0.3} y2={ep110.y + (ep111.y - ep110.y) * (0.2 + i * 0.2)}
          stroke="#b45309" strokeWidth="0.4" />
      ))}
      {/* Big fan grille on front */}
      <circle cx={cx} cy={cy} r={Math.min(Math.abs(ep110.x - ep010.x), Math.abs(ep010.y - ep000.y)) / 2.5}
        fill="#1e293b" stroke="#000" strokeWidth="0.6" />
      {/* Fan grille rings */}
      <circle cx={cx} cy={cy} r={Math.min(Math.abs(ep110.x - ep010.x), Math.abs(ep010.y - ep000.y)) / 3} fill="none" stroke="#475569" strokeWidth="0.3" />
      <circle cx={cx} cy={cy} r={Math.min(Math.abs(ep110.x - ep010.x), Math.abs(ep010.y - ep000.y)) / 4} fill="none" stroke="#475569" strokeWidth="0.3" />
      <circle cx={cx} cy={cy} r={Math.min(Math.abs(ep110.x - ep010.x), Math.abs(ep010.y - ep000.y)) / 7} fill="none" stroke="#475569" strokeWidth="0.3" />
      {/* Fan blades (5 blades) */}
      {[0, 72, 144, 216, 288].map(angle => (
        <path key={angle} d={`M ${cx} ${cy} L ${cx + Math.sin(angle * Math.PI / 180) * (Math.abs(ep110.x - ep010.x) / 3)} ${cy - Math.cos(angle * Math.PI / 180) * (Math.abs(ep010.y - ep000.y) / 3)}`}
          stroke="#475569" strokeWidth="0.5" opacity="0.6" />
      ))}
      <circle cx={cx} cy={cy} r="1.5" fill="#fbbf24" stroke="#000" strokeWidth="0.3" />
      {/* Pipes on top */}
      <line x1={(ep010.x + ep110.x) / 2 - 4} y1={ep010.y - 2} x2={(ep010.x + ep110.x) / 2 - 4} y2={ep010.y - 6} stroke="#22d3ee" strokeWidth="2" />
      <line x1={(ep010.x + ep110.x) / 2 + 4} y1={ep010.y - 2} x2={(ep010.x + ep110.x) / 2 + 4} y2={ep010.y - 6} stroke="#fb923c" strokeWidth="2" />
    </g>
  )
}

function Rack3DDetail({ ep100, ep110, ep010, ep000, ep101, ep111, ep011, isSelected }) {
  return (
    <g>
      {/* Uprights (3 vertical orange frames) */}
      {[0.05, 0.5, 0.95].map((t, i) => {
        const x1 = ep010.x + (ep110.x - ep010.x) * t
        const x2 = ep000.x + (ep100.x - ep000.x) * t
        return <line key={`up-${i}`} x1={x1} y1={ep010.y} x2={x2} y2={ep000.y} stroke="#ea580c" strokeWidth="2" />
      })}
      {/* TOP face */}
      <polygon points={`${ep010.x},${ep010.y} ${ep110.x},${ep110.y} ${ep111.x},${ep111.y} ${ep011.x},${ep011.y}`}
        fill="none" stroke="#fb923c" strokeWidth="0.5" />
      {/* SIDE uprights */}
      {[0.05, 0.95].map((t, i) => (
        <g key={`side-${i}`}>
          <line x1={ep010.x + (ep110.x - ep010.x) * t} y1={ep010.y}
            x2={ep011.x + (ep111.x - ep011.x) * t} y2={ep011.y}
            stroke="#ea580c" strokeWidth="2" />
        </g>
      ))}
      {/* Horizontal levels with pallets - more levels */}
      {[0.2, 0.4, 0.6, 0.8].map((t, i) => {
        const yFront = ep010.y + (ep000.y - ep010.y) * t
        const yBack = ep011.y + (ep001.y - ep011.y) * t
        return (
          <g key={`level-${i}`}>
            <line x1={ep010.x} y1={yFront} x2={ep110.x} y2={yFront} stroke="#fb923c" strokeWidth="1.5" />
            {/* Side beam */}
            <line x1={ep010.x} y1={yFront} x2={ep011.x} y2={yBack} stroke="#fb923c" strokeWidth="1" />
            {/* Pallet front */}
            <rect x={ep010.x + (ep110.x - ep010.x) * 0.1} y={yFront - 1} width={(ep110.x - ep010.x) * 0.35} height={2} fill="#a16207" stroke="#451a03" strokeWidth="0.3" />
            <rect x={ep010.x + (ep110.x - ep010.x) * 0.55} y={yFront - 1} width={(ep110.x - ep010.x) * 0.35} height={2} fill="#a16207" stroke="#451a03" strokeWidth="0.3" />
            {/* Box on top of pallet */}
            {i < 2 && (
              <rect x={ep010.x + (ep110.x - ep010.x) * 0.12} y={yFront - 6} width={(ep110.x - ep010.x) * 0.31} height={5} fill="#d97706" stroke="#451a03" strokeWidth="0.3" />
            )}
          </g>
        )
      })}
    </g>
  )
}

function Unit3DDetail({ ep100, ep110, ep010, ep000, ep101, ep111, ep011, isSelected }) {
  return (
    <g>
      {/* TOP face - brown/industrial */}
      <polygon points={`${ep010.x},${ep010.y} ${ep110.x},${ep110.y} ${ep111.x},${ep111.y} ${ep011.x},${ep011.y}`}
        fill="#475569" stroke={isSelected ? "#06b6d4" : "#1e293b"} strokeWidth="0.8" />
      {/* Top details - rivets, panel lines */}
      <rect x={ep010.x + (ep110.x - ep010.x) * 0.1} y={ep010.y + (ep011.y - ep010.y) * 0.2}
        width={(ep110.x - ep010.x) * 0.8} height={(ep011.y - ep010.y) * 0.6}
        fill="none" stroke="#1e293b" strokeWidth="0.4" opacity="0.7" />
      {/* Top fan vents - 2 circles */}
      {(() => {
        const fSize = Math.min(Math.abs(ep110.x - ep010.x), Math.abs(ep010.y - ep000.y)) * 0.12
        const cx1 = ep010.x + (ep110.x - ep010.x) * 0.3
        const cx2 = ep010.x + (ep110.x - ep010.x) * 0.7
        const cy = ep010.y + (ep011.y - ep010.y) * 0.5
        return [
          <g key="fan1">
            <circle cx={cx1} cy={cy} r={fSize} fill="#1e293b" />
            <circle cx={cx1} cy={cy} r={fSize * 0.7} fill="none" stroke="#94a3b8" strokeWidth="0.3" />
          </g>,
          <g key="fan2">
            <circle cx={cx2} cy={cy} r={fSize} fill="#1e293b" />
            <circle cx={cx2} cy={cy} r={fSize * 0.7} fill="none" stroke="#94a3b8" strokeWidth="0.3" />
          </g>
        ]
      })()}
      {/* FRONT face */}
      <polygon points={`${ep000.x},${ep000.y} ${ep100.x},${ep100.y} ${ep110.x},${ep110.y} ${ep010.x},${ep010.y}`}
        fill="url(#wallGrad2)" stroke={isSelected ? "#06b6d4" : "#334155"} strokeWidth="1" />
      {/* Compressor cylinder (hermetic) */}
      <ellipse cx={ep010.x + (ep110.x - ep010.x) * 0.25} cy={(ep010.y + ep000.y) / 2}
        rx={(ep110.x - ep010.x) * 0.18} ry={(ep000.y - ep010.y) * 0.32}
        fill="#94a3b8" stroke="#1e293b" strokeWidth="0.6" />
      {/* Compressor top cap */}
      <line x1={ep010.x + (ep110.x - ep010.x) * 0.07} y1={(ep010.y + ep000.y) / 2 - (ep000.y - ep010.y) * 0.32}
        x2={ep010.x + (ep110.x - ep010.x) * 0.43} y2={(ep010.y + ep000.y) / 2 - (ep000.y - ep010.y) * 0.32}
        stroke="#1e293b" strokeWidth="2" />
      {/* Compressor bottom */}
      <line x1={ep010.x + (ep110.x - ep010.x) * 0.07} y1={(ep010.y + ep000.y) / 2 + (ep000.y - ep010.y) * 0.32}
        x2={ep010.x + (ep110.x - ep010.x) * 0.43} y2={(ep010.y + ep000.y) / 2 + (ep000.y - ep010.y) * 0.32}
        stroke="#1e293b" strokeWidth="2" />
      {/* Compressor pipes */}
      <circle cx={ep010.x + (ep110.x - ep010.x) * 0.18} cy={ep010.y - 3} r="1.5" fill="#fb923c" stroke="#1e293b" strokeWidth="0.3" />
      <circle cx={ep010.x + (ep110.x - ep010.x) * 0.32} cy={ep010.y - 3} r="1.5" fill="#22d3ee" stroke="#1e293b" strokeWidth="0.3" />
      {/* Fan grille - circular on right side of front */}
      <circle cx={ep010.x + (ep110.x - ep010.x) * 0.7} cy={(ep010.y + ep000.y) / 2}
        r={Math.min(Math.abs(ep110.x - ep010.x) * 0.13, Math.abs(ep010.y - ep000.y) * 0.27)} fill="#1e293b" stroke="#000" strokeWidth="0.5" />
      <circle cx={ep010.x + (ep110.x - ep010.x) * 0.7} cy={(ep010.y + ep000.y) / 2}
        r={Math.min(Math.abs(ep110.x - ep010.x) * 0.1, Math.abs(ep010.y - ep000.y) * 0.2)} fill="none" stroke="#475569" strokeWidth="0.3" />
      <circle cx={ep010.x + (ep110.x - ep010.x) * 0.7} cy={(ep010.y + ep000.y) / 2}
        r={Math.min(Math.abs(ep110.x - ep010.x) * 0.06, Math.abs(ep010.y - ep000.y) * 0.12)} fill="none" stroke="#475569" strokeWidth="0.3" />
      <circle cx={ep010.x + (ep110.x - ep010.x) * 0.7} cy={(ep010.y + ep000.y) / 2} r="1" fill="#fbbf24" />
      {/* Fan blades */}
      {[0, 72, 144, 216, 288].map(angle => (
        <line key={angle} x1={ep010.x + (ep110.x - ep010.x) * 0.7} y1={(ep010.y + ep000.y) / 2}
          x2={ep010.x + (ep110.x - ep010.x) * 0.7 + Math.sin(angle * Math.PI / 180) * Math.abs(ep110.x - ep010.x) * 0.1}
          y2={(ep010.y + ep000.y) / 2 - Math.cos(angle * Math.PI / 180) * Math.abs(ep010.y - ep000.y) * 0.2}
          stroke="#94a3b8" strokeWidth="0.4" opacity="0.5" />
      ))}
      {/* SIDE face */}
      <polygon points={`${ep100.x},${ep100.y} ${ep101.x},${ep101.y} ${ep111.x},${ep111.y} ${ep110.x},${ep110.y}`}
        fill="#64748b" stroke="#334155" strokeWidth="0.5" />
      {/* Side vents louvers */}
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={i} x1={ep100.x + (ep101.x - ep100.x) * 0.2} y1={ep110.y + (ep111.y - ep110.y) * (0.2 + i * 0.15)}
          x2={ep110.x + (ep111.x - ep110.x) * 0.2} y2={ep110.y + (ep111.y - ep110.y) * (0.2 + i * 0.15)}
          stroke="#1e293b" strokeWidth="0.6" />
      ))}
      {/* Feet */}
      {(() => {
        const f = 1
        return [
          <rect key="f1" x={ep010.x - 1} y={ep000.y} width={f * 2} height={f * 3} fill="#1e293b" />,
          <rect key="f2" x={ep110.x - 1} y={ep000.y} width={f * 2} height={f * 3} fill="#1e293b" />
        ]
      })()}
    </g>
  )
}

// ====== CONTEXT MENU ======
function ContextMenu({ x, y, onClose, items }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 1000,
        background: 'rgba(15,23,42,0.98)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(6,182,212,0.4)', borderRadius: '10px',
        padding: '6px', minWidth: '220px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
      }}>
        {items.map((item, i) => (
          item.divider ? (
            <div key={i} style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
          ) : (
            <button
              key={i}
              onClick={() => { item.action(); onClose() }}
              disabled={item.disabled}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '12px', width: '100%', padding: '8px 10px',
                background: 'transparent', border: 'none', borderRadius: '6px',
                color: item.disabled ? 'rgba(255,255,255,0.3)' : '#fff',
                fontSize: '12px', textAlign: 'left',
                cursor: item.disabled ? 'not-allowed' : 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = item.disabled ? 'transparent' : 'rgba(6,182,212,0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px' }}>{item.icon}</span>
                <span>{item.label}</span>
              </span>
              {item.shortcut && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{item.shortcut}</span>}
            </button>
          )
        ))}
      </div>
    </>
  )
}

// ====== 2D TOP-DOWN PLAN VIEW (with context menu and drag-drop) ======
function PlanView2D({ rooms, selectedId, onSelect, onUpdateRoom, view2D, setView2D, clipboard, onCopy, onCut, onPaste, onDelete, onDuplicate, onAddEquipment, onQuickAction, contextMenu, setContextMenu, dimUnit = 'auto', movingItem, onPlaceMovingItem }) {
  const proj = (x, z) => ({
    px: x * view2D.scale + view2D.offsetX,
    py: z * view2D.scale + view2D.offsetY
  })
  const unproj = (px, py) => ({
    x: (px - view2D.offsetX) / view2D.scale,
    z: (py - view2D.offsetY) / view2D.scale
  })

  const [dragging, setDragging] = useState(null)
  const [itemDrag, setItemDrag] = useState(null)
  const [dropPreview, setDropPreview] = useState(null)
  const [resizing, setResizing] = useState(null)
  const [dragAddCatalog, setDragAddCatalog] = useState(null)

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setView2D(v => ({ ...v, scale: Math.max(5, Math.min(100, v.scale * delta)) }))
  }

  const findItemAtPos = (x, y) => {
    // Check equipment in rooms
    for (const room of rooms) {
      for (const eq of (room.equipment || [])) {
        if (Math.abs(x - eq.x) < (eq.width || 0.5) / 2 + 0.1 && Math.abs(y - eq.z) < (eq.depth || 0.5) / 2 + 0.1) {
          return { type: 'equipment', item: eq, room: room }
        }
      }
    }
    return null
  }

  const findRoomAtPos = (x, z) => {
    for (const room of rooms) {
      const hw = (room.width || 4) / 2
      const hd = (room.depth || 4) / 2
      if (x >= -hw && x <= hw && z >= -hd && z <= hd) return room
    }
    return null
  }

  const handleMouseDown = (e) => {
    const divRect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - divRect.left
    const my = e.clientY - divRect.top
    const worldPos = unproj(mx, my)

    // Move mode: click to place equipment at the clicked location
    if (movingItem && onPlaceMovingItem) {
      const targetRoom = findRoomAtPos(worldPos.x, worldPos.z)
      if (targetRoom) {
        onPlaceMovingItem(targetRoom.id, worldPos.x, worldPos.z)
        return
      }
    }

    // Detect resize handle on selected room
    if (selectedId && e.target.tagName === 'circle' && e.target.dataset?.handle) {
      const dir = e.target.dataset.handle
      setResizing({ id: selectedId, dir, startX: worldPos.x, startZ: worldPos.z, room: rooms.find(r => r.id === selectedId) })
      return
    }

    // Click on equipment → select and start drag (only with left mouse button)
    if (e.button === 0) {
      const hit = findItemAtPos(worldPos.x, worldPos.z)
      if (hit) {
        e.preventDefault()
        onSelect(hit.item.id)
        setItemDrag({ id: hit.item.id, startX: worldPos.x, startZ: worldPos.z, origX: hit.item.x, origZ: hit.item.z, roomId: hit.room.id })
        return
      }
    }

    // Click on room → select
    const room = findRoomAtPos(worldPos.x, worldPos.z)
    if (room) {
      onSelect(room.id)
    } else {
      onSelect(null)
    }

    // Pan
    if (e.button === 0) {
      setDragging({ startX: e.clientX, startY: e.clientY, offsetX: view2D.offsetX, offsetY: view2D.offsetY })
    }
  }

  const handleMouseMove = (e) => {
    const divRect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - divRect.left
    const my = e.clientY - divRect.top
    const worldPos = unproj(mx, my)

    if (resizing) {
      const dx = worldPos.x - resizing.startX
      const dz = worldPos.z - resizing.startZ
      const r = resizing.room
      const newRoom = { ...r }
      if (resizing.dir === 'e' || resizing.dir === 'se' || resizing.dir === 'ne') {
        newRoom.width = Math.max(1, r.width + dx * 2)
      }
      if (resizing.dir === 's' || resizing.dir === 'sw' || resizing.dir === 'se') {
        newRoom.depth = Math.max(1, r.depth + dz * 2)
      }
      onUpdateRoom(newRoom)
      setResizing({ ...resizing, startX: worldPos.x, startZ: worldPos.z })
      return
    }

    if (itemDrag) {
      const newX = itemDrag.origX + (worldPos.x - itemDrag.startX)
      const newZ = itemDrag.origZ + (worldPos.z - itemDrag.startZ)
      // Find the room this item belongs to and update its equipment position
      rooms.forEach(room => {
        if (room.id === itemDrag.roomId) {
          const newEquipment = room.equipment.map(eq => eq.id === itemDrag.id ? { ...eq, x: newX, z: newZ } : eq)
          onUpdateRoom({ ...room, equipment: newEquipment })
        }
      })
      return
    }

    if (dragAddCatalog) {
      setDropPreview({ ...worldPos, catalog: dragAddCatalog })
      return
    }

    if (dragging) {
      setView2D(v => ({ ...v, offsetX: dragging.offsetX + (e.clientX - dragging.startX), offsetY: dragging.offsetY + (e.clientY - dragging.startY) }))
    }
  }

  const handleMouseUp = (e) => {
    const divRect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - divRect.left
    const my = e.clientY - divRect.top
    const worldPos = unproj(mx, my)

    if (dragAddCatalog && dropPreview) {
      const room = findRoomAtPos(dropPreview.x, dropPreview.z)
      if (room) {
        onAddEquipment(room.id, dragAddCatalog.id, dropPreview.x, dropPreview.z)
      }
    }

    setItemDrag(null)
    setResizing(null)
    setDropPreview(null)
    setDragging(null)
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    const divRect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - divRect.left
    const my = e.clientY - divRect.top
    const worldPos = unproj(mx, my)
    const hit = findItemAtPos(worldPos.x, worldPos.z)
    const room = findRoomAtPos(worldPos.x, worldPos.z)

    if (hit) {
      // Context menu for equipment
      setContextMenu({
        x: e.clientX, y: e.clientY,
        target: { type: 'equipment', id: hit.item.id, category: hit.item.category },
        equipmentId: hit.item.id,
        roomId: hit.room.id
      })
    } else if (room) {
      // Context menu for room
      setContextMenu({
        x: e.clientX, y: e.clientY,
        target: { type: 'room', id: room.id },
        roomId: room.id,
        worldX: worldPos.x,
        worldZ: worldPos.z
      })
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, target: null })
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', cursor: movingItem ? 'crosshair' : (dragAddCatalog ? 'copy' : (itemDrag ? 'move' : (resizing ? 'nwse-resize' : (dragging ? 'grabbing' : 'grab')))), background: '#0a0f1e' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        const eqId = e.dataTransfer.getData('equipment')
        if (eqId) {
          const cat = getEquipmentById(eqId)
          if (cat) setDragAddCatalog(cat)
        }
      }}
      onDragLeave={(e) => {
        // Don't immediately reset - wait for drop or end
      }}
      onDrop={(e) => {
        e.preventDefault()
        const eqId = e.dataTransfer.getData('equipment')
        if (eqId) {
          const divRect = e.currentTarget.getBoundingClientRect()
          const mx = e.clientX - divRect.left
          const my = e.clientY - divRect.top
          const worldPos = unproj(mx, my)
          const room = findRoomAtPos(worldPos.x, worldPos.z)
          if (room) {
            onAddEquipment(room.id, eqId, worldPos.x, worldPos.z)
          }
        }
        setDragAddCatalog(null)
        setDropPreview(null)
      }}
    >
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <pattern id="grid2d" width={view2D.scale} height={view2D.scale} patternUnits="userSpaceOnUse">
            <path d={`M ${view2D.scale} 0 L 0 0 0 ${view2D.scale}`} fill="none" stroke="#1e3a5f" strokeWidth="0.4" />
          </pattern>
          <linearGradient id="doorPanelGrad2D" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid2d)" transform={`translate(${view2D.offsetX % view2D.scale}, ${view2D.offsetY % view2D.scale})`} />
        <line x1={view2D.offsetX} y1={0} x2={view2D.offsetX} y2="100%" stroke="#06b6d4" strokeWidth="1" opacity="0.4" />
        <line x1={0} y1={view2D.offsetY} x2="100%" y2={view2D.offsetY} stroke="#06b6d4" strokeWidth="1" opacity="0.4" />

        {rooms.map(room => {
          const w = (room.width || 4) * view2D.scale
          const d = (room.depth || 4) * view2D.scale
          const tl = proj(-(room.width||4)/2, -(room.depth||4)/2)
          const isSelected = selectedId === room.id

          return (
            <g key={room.id}>
              <rect
                x={tl.px} y={tl.py} width={w} height={d}
                fill={room.color || '#3b82f6'} fillOpacity={isSelected ? 0.30 : 0.18}
                stroke={isSelected ? '#06b6d4' : '#60a5fa'} strokeWidth={isSelected ? 3 : 2}
                onClick={() => onSelect(room.id)}
                style={{ cursor: 'pointer' }}
              />
              <rect x={tl.px} y={tl.py} width={w} height="3" fill={room.color || '#3b82f6'} fillOpacity="0.6" />
              <rect x={tl.px} y={tl.py} width="3" height={d} fill={room.color || '#3b82f6'} fillOpacity="0.6" />
              <rect x={tl.px + w - 3} y={tl.py} width="3" height={d} fill={room.color || '#3b82f6'} fillOpacity="0.6" />
              <rect x={tl.px} y={tl.py + d - 3} width={w} height="3" fill={room.color || '#3b82f6'} fillOpacity="0.6" />
              <text x={tl.px + w/2} y={tl.py + d/2 - 10} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" style={{ pointerEvents: 'none' }}>{room.name}</text>
              <text x={tl.px + w/2} y={tl.py + d/2 + 8} textAnchor="middle" fill="#94a3b8" fontSize="10" style={{ pointerEvents: 'none' }}>{room.width?.toFixed(1)} × {room.depth?.toFixed(1)} m</text>
              <text x={tl.px + w/2} y={tl.py + d/2 + 24} textAnchor="middle" fill="#06b6d4" fontSize="11" fontWeight="600" style={{ pointerEvents: 'none' }}>{room.temp}°C</text>

              {/* DIMENSION LINES - Always visible */}
              {/* Top width dimension */}
              <line x1={tl.px} y1={tl.py - 18} x2={tl.px + w} y2={tl.py - 18} stroke="#fbbf24" strokeWidth="0.8" />
              <line x1={tl.px} y1={tl.py - 22} x2={tl.px} y2={tl.py - 14} stroke="#fbbf24" strokeWidth="0.8" />
              <line x1={tl.px + w} y1={tl.py - 22} x2={tl.px + w} y2={tl.py - 14} stroke="#fbbf24" strokeWidth="0.8" />
              <rect x={tl.px + w/2 - 30} y={tl.py - 28} width="60" height="16" fill="#0f172a" stroke="#fbbf24" strokeWidth="0.5" rx="2" />
              <text x={tl.px + w/2} y={tl.py - 17} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700">{formatDim(room.width || 0, dimUnit)}</text>

              {/* Left depth dimension */}
              <line x1={tl.px - 18} y1={tl.py} x2={tl.px - 18} y2={tl.py + d} stroke="#fbbf24" strokeWidth="0.8" />
              <line x1={tl.px - 22} y1={tl.py} x2={tl.px - 14} y2={tl.py} stroke="#fbbf24" strokeWidth="0.8" />
              <line x1={tl.px - 22} y1={tl.py + d} x2={tl.px - 14} y2={tl.py + d} stroke="#fbbf24" strokeWidth="0.8" />
              <text x={tl.px - 28} y={tl.py + d/2} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700" transform={`rotate(-90, ${tl.px - 28}, ${tl.py + d/2})`}>{formatDim(room.depth || 0, dimUnit)}</text>

              {/* Wall labels */}
              <text x={tl.px + 6} y={tl.py + 12} fill="#fff" fontSize="9" opacity="0.4" style={{ pointerEvents: 'none' }}>Wall</text>
              <text x={tl.px + w - 6} y={tl.py + 12} fill="#fff" fontSize="9" opacity="0.4" textAnchor="end" style={{ pointerEvents: 'none' }}>Wall</text>

              {/* Height indicator on right */}
              <line x1={tl.px + w + 18} y1={tl.py} x2={tl.px + w + 18} y2={tl.py + d * (room.height || 2.8) / (room.width || 4)} stroke="#22d3ee" strokeWidth="1" />
              <text x={tl.px + w + 28} y={tl.py + d * (room.height || 2.8) / (room.width || 4) / 2} fill="#22d3ee" fontSize="9" fontWeight="700">H: {formatDim(room.height || 0, dimUnit)}</text>

              {/* Additional dimensions - inset dimensions */}
              {(() => {
                const inset = 14
                return (
                  <g opacity="0.7">
                    <line x1={tl.px + inset} y1={tl.py - 8} x2={tl.px + w - inset} y2={tl.py - 8} stroke="#06b6d4" strokeWidth="0.5" />
                    <line x1={tl.px + inset} y1={tl.py - 12} x2={tl.px + inset} y2={tl.py - 4} stroke="#06b6d4" strokeWidth="0.5" />
                    <line x1={tl.px + w - inset} y1={tl.py - 12} x2={tl.px + w - inset} y2={tl.py - 4} stroke="#06b6d4" strokeWidth="0.5" />
                    <text x={(tl.px + tl.px + w) / 2} y={tl.py - 8} textAnchor="middle" fill="#06b6d4" fontSize="8" fontWeight="600">{(room.width - 2 * (inset / view2D.scale)).toFixed(2)} m</text>
                  </g>
                )
              })()}

              {/* Equipment in this room */}
              {(room.equipment || []).map(eq => {
                const p = proj(eq.x, eq.z)
                const color = eq.category === 'door' ? '#a16207' : eq.category === 'evaporator' ? '#94c5e8' : eq.category === 'condenser' ? '#4ade80' : eq.category === 'rack' ? '#a78bfa' : '#fbbf24'
                const isSelected = selectedId === eq.id
                const w = eq.width * view2D.scale
                const d = eq.depth * view2D.scale

                if (eq.category === 'door') {
                  // Door with swing arc and detail
                  const swing = (eq.width || 0.9)
                  const arcR = swing * view2D.scale
                  const arcStart = { x: p.px - (eq.width * view2D.scale) / 2, y: p.py }
                  const arcEnd = { x: p.px - (eq.width * view2D.scale) / 2 + arcR, y: p.py - arcR }
                  const arcPath = `M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 0 1 ${arcEnd.x} ${arcEnd.y} L ${p.px + (eq.width * view2D.scale) / 2} ${p.py} Z`
                  return (
                    <g key={eq.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect(eq.id) }}>
                      <path d={arcPath} fill={isSelected ? '#06b6d4' : '#cbd5e1'} fillOpacity="0.25" stroke={isSelected ? '#06b6d4' : '#94a3b8'} strokeWidth="0.5" strokeDasharray="3,2" />
                      <rect x={p.px - (eq.width * view2D.scale) / 2} y={p.py - 4} width={eq.width * view2D.scale} height={8} fill="url(#doorPanelGrad2D)" stroke="#334155" strokeWidth="1.5" rx="1" />
                      <rect x={p.px + (eq.width * view2D.scale) / 2 - 8} y={p.py - 1} width="3" height="3" fill="#fbbf24" stroke="#1e293b" strokeWidth="0.3" />
                      <line x1={p.px - (eq.width * view2D.scale) / 2 - 6} y1={p.py} x2={p.px - (eq.width * view2D.scale) / 2 + arcR} y2={p.py - arcR} stroke={isSelected ? '#06b6d4' : '#94a3b8'} strokeWidth="1.5" strokeDasharray="4,3" />
                      {isSelected && (
                        <>
                          {['n','s','e','w','ne','nw','se','sw'].map(dir => {
                            const offX = (dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0) * (eq.width * view2D.scale) / 2
                            const offY = (dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0) * 6
                            return <circle key={dir} cx={p.px + offX} cy={p.py + offY} r="4" fill="#06b6d4" stroke="#fff" strokeWidth="1.5" style={{ cursor: 'pointer' }} data-handle={dir} />
                          })}
                        </>
                      )}
                    </g>
                  )
                }

                // Render other equipment as detailed SVG via foreignObject
                return (
                  <g key={eq.id} style={{ cursor: 'move' }} onClick={(e) => { e.stopPropagation(); onSelect(eq.id) }}>
                    <rect x={p.px - w / 2} y={p.py - d / 2} width={w} height={d} fill={color} fillOpacity="0.95" stroke={isSelected ? "#06b6d4" : "#fff"} strokeWidth={isSelected ? 2.5 : 1} rx="3" />
                    {/* Inner details */}
                    {eq.category === 'evaporator' && (
                      <g>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <line key={i} x1={p.px - w / 2 + (i + 1) * (w / 9)} y1={p.py - d / 2 + 2} x2={p.px - w / 2 + (i + 1) * (w / 9)} y2={p.py + d / 2 - 2} stroke="#475569" strokeWidth="0.8" opacity="0.7" />
                        ))}
                        {[w * 0.25, w * 0.5, w * 0.75].map((cx, i) => (
                          <g key={i}>
                            <circle cx={p.px - w / 2 + cx} cy={p.py} r={Math.min(d / 3, 8)} fill="#1e293b" stroke="#0f172a" strokeWidth="0.5" />
                            <circle cx={p.px - w / 2 + cx} cy={p.py} r="1.5" fill="#94a3b8" />
                          </g>
                        ))}
                      </g>
                    )}
                    {eq.category === 'condenser' && (
                      <g>
                        <circle cx={p.px} cy={p.py} r={Math.min(w, d) * 0.42} fill="#1e293b" stroke="#000" strokeWidth="1" />
                        <circle cx={p.px} cy={p.py} r={Math.min(w, d) * 0.32} fill="none" stroke="#475569" strokeWidth="0.4" />
                        <circle cx={p.px} cy={p.py} r={Math.min(w, d) * 0.22} fill="none" stroke="#475569" strokeWidth="0.4" />
                        <circle cx={p.px} cy={p.py} r="1.5" fill="#fbbf24" />
                        {[0, 72, 144, 216, 288].map(angle => (
                          <line key={angle} x1={p.px + Math.sin(angle * Math.PI / 180) * Math.min(w, d) * 0.05} y1={p.py - Math.cos(angle * Math.PI / 180) * Math.min(w, d) * 0.05} x2={p.px + Math.sin(angle * Math.PI / 180) * Math.min(w, d) * 0.4} y2={p.py - Math.cos(angle * Math.PI / 180) * Math.min(w, d) * 0.4} stroke="#94a3b8" strokeWidth="1" />
                        ))}
                      </g>
                    )}
                    {eq.category === 'unit' && (
                      <g>
                        <rect x={p.px - w / 2 + 2} y={p.py - d / 2 + 2} width={w * 0.3} height={d - 4} fill="#94a3b8" stroke="#1e293b" strokeWidth="0.5" rx="2" />
                        <circle cx={p.px + w / 4} cy={p.py} r={Math.min(w, d) * 0.3} fill="#1e293b" />
                        <circle cx={p.px + w / 4} cy={p.py} r={Math.min(w, d) * 0.18} fill="none" stroke="#94a3b8" strokeWidth="0.5" />
                        <circle cx={p.px + w / 4} cy={p.py} r="1.5" fill="#fbbf24" />
                        <line x1={p.px} y1={p.py - d / 2} x2={p.px} y2={p.py - d / 2 - 3} stroke="#ef4444" strokeWidth="1.5" />
                        <line x1={p.px + 4} y1={p.py - d / 2} x2={p.px + 4} y2={p.py - d / 2 - 3} stroke="#22d3ee" strokeWidth="1.5" />
                      </g>
                    )}
                    {eq.category === 'rack' && (
                      <g>
                        {[w * 0.25, w * 0.5, w * 0.75].map((cx, i) => (
                          <line key={i} x1={p.px - w / 2 + cx} y1={p.py - d / 2} x2={p.px - w / 2 + cx} y2={p.py + d / 2} stroke="#ea580c" strokeWidth="1.5" />
                        ))}
                        {[d * 0.33, d * 0.66].map((cy, i) => (
                          <line key={i} x1={p.px - w / 2} y1={p.py - d / 2 + cy} x2={p.px + w / 2} y2={p.py - d / 2 + cy} stroke="#fb923c" strokeWidth="1" />
                        ))}
                      </g>
                    )}
                    {/* Capacity label */}
                    {eq.capacity > 0 && (
                      <text x={p.px} y={p.py + d / 2 + 10} textAnchor="middle" fill="#06b6d4" fontSize="9" fontWeight="700" style={{ pointerEvents: 'none' }}>{eq.capacity}kW</text>
                    )}
                    {isSelected && (
                      <>
                        {['n','s','e','w','ne','nw','se','sw'].map(d => {
                          const offX = (d.includes('e') ? 1 : d.includes('w') ? -1 : 0) * w / 2
                          const offY = (d.includes('s') ? 1 : d.includes('n') ? -1 : 0) * d / 2
                          return <circle key={d} cx={p.px + offX} cy={p.py + offY} r="5" fill="#06b6d4" stroke="#fff" strokeWidth="1.5" style={{ cursor: 'pointer' }} data-handle={d} />
                        })}
                      </>
                    )}
                  </g>
                )
              })}

              {/* Resize handles for selected room */}
              {isSelected && (
                <>
                  <circle cx={tl.px} cy={tl.py} r="6" fill="#06b6d4" stroke="#fff" strokeWidth="2" data-handle="nw" style={{ cursor: 'nwse-resize' }} />
                  <circle cx={tl.px + w} cy={tl.py} r="6" fill="#06b6d4" stroke="#fff" strokeWidth="2" data-handle="ne" style={{ cursor: 'nesw-resize' }} />
                  <circle cx={tl.px} cy={tl.py + d} r="6" fill="#06b6d4" stroke="#fff" strokeWidth="2" data-handle="sw" style={{ cursor: 'nesw-resize' }} />
                  <circle cx={tl.px + w} cy={tl.py + d} r="6" fill="#06b6d4" stroke="#fff" strokeWidth="2" data-handle="se" style={{ cursor: 'nwse-resize' }} />
                  <circle cx={tl.px + w/2} cy={tl.py} r="6" fill="#06b6d4" stroke="#fff" strokeWidth="2" data-handle="n" style={{ cursor: 'ns-resize' }} />
                  <circle cx={tl.px + w/2} cy={tl.py + d} r="6" fill="#06b6d4" stroke="#fff" strokeWidth="2" data-handle="s" style={{ cursor: 'ns-resize' }} />
                  <circle cx={tl.px} cy={tl.py + d/2} r="6" fill="#06b6d4" stroke="#fff" strokeWidth="2" data-handle="w" style={{ cursor: 'ew-resize' }} />
                  <circle cx={tl.px + w} cy={tl.py + d/2} r="6" fill="#06b6d4" stroke="#fff" strokeWidth="2" data-handle="e" style={{ cursor: 'ew-resize' }} />
                </>
              )}
            </g>
          )
        })}

        {/* Drop preview */}
        {dropPreview && (() => {
          const p = proj(dropPreview.x, dropPreview.z)
          const cat = getEquipmentById(dropPreview.catalog.id)
          if (!cat) return null
          const w = cat.width * view2D.scale
          const d = cat.depth * view2D.scale
          return (
            <g>
              <rect x={p.px - w/2} y={p.py - d/2} width={w} height={d} fill="rgba(6,182,212,0.3)" stroke="#06b6d4" strokeWidth="2" strokeDasharray="5,3" rx="3" />
              <text x={p.px} y={p.py + 4} textAnchor="middle" fill="#06b6d4" fontSize="20" style={{ pointerEvents: 'none' }}>{cat.icon}</text>
            </g>
          )
        })()}
      </svg>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button onClick={() => setView2D(v => ({ ...v, scale: Math.min(100, v.scale * 1.2) }))} style={{ width: '32px', height: '32px', background: 'rgba(30,41,59,0.92)', color: '#f1f5f9', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', backdropFilter: 'blur(8px)' }}>+</button>
        <button onClick={() => setView2D(v => ({ ...v, scale: Math.max(5, v.scale * 0.8) }))} style={{ width: '32px', height: '32px', background: 'rgba(30,41,59,0.92)', color: '#f1f5f9', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', backdropFilter: 'blur(8px)' }}>−</button>
        <button onClick={() => setView2D({ scale: 30, offsetX: 400, offsetY: 300 })} style={{ width: '32px', height: '32px', background: 'rgba(30,41,59,0.92)', color: '#f1f5f9', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', backdropFilter: 'blur(8px)' }}>⌂</button>
      </div>

      {/* Move Mode Indicator */}
      {movingItem && (
        <div style={{ position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', color: '#fff', fontWeight: '700', zIndex: 200, boxShadow: '0 4px 16px rgba(245,158,11,0.4)' }}>
          📍 Siirtotila - klikkaa uutta paikkaa asettaaksesi laitteen (Esc peruuttaa)
        </div>
      )}

      {/* Hint */}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', padding: '8px 12px', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
        <div style={{ color: '#06b6d4', fontWeight: '600', marginBottom: '4px' }}>💡 Vinkit</div>
        <div>• <b>Vasen klikkaus+raahaus</b>: siirrä laitetta</div>
        <div>• <b>Oikea klikkaus</b>: kontekstivalikko (Siirrä, Kopioi, ...)</div>
        <div>• <b>Vedä laitetemplate</b>: lisää huoneeseen</div>
        <div>• <b>Vedä kulmakahvasta</b>: muuta huoneen kokoa</div>
      </div>
    </div>
  )
}

// ====== DETAILED EQUIPMENT ICONS ======
function EquipmentIcon({ category, size = 60, capacity = 0 }) {
  // Returns detailed SVG illustration of equipment
  const w = size, h = size * 0.6

  if (category === 'door') {
    return (
      <svg width={w} height={h} viewBox="0 0 100 60">
        <defs>
          <linearGradient id="doorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="doorPanelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>
        {/* Frame */}
        <rect x="2" y="2" width="96" height="56" fill="none" stroke="#475569" strokeWidth="3" rx="3" />
        {/* Door panel */}
        <rect x="6" y="6" width="88" height="48" fill="url(#doorPanelGrad)" stroke="#334155" strokeWidth="1.5" rx="2" />
        {/* Panel detail lines */}
        <line x1="14" y1="14" x2="86" y2="14" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
        <line x1="14" y1="46" x2="86" y2="46" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
        <line x1="50" y1="6" x2="50" y2="54" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
        {/* Window */}
        <rect x="60" y="18" width="22" height="14" fill="#0ea5e9" fillOpacity="0.4" stroke="#334155" strokeWidth="1" rx="1" />
        {/* Hinges */}
        <circle cx="8" cy="12" r="2" fill="#475569" />
        <circle cx="8" cy="48" r="2" fill="#475569" />
        {/* Handle */}
        <rect x="76" y="30" width="3" height="14" fill="#1e293b" rx="1" />
        <circle cx="77.5" cy="37" r="2.5" fill="#fbbf24" stroke="#1e293b" strokeWidth="0.5" />
        {/* Heater cable */}
        <line x1="50" y1="6" x2="50" y2="2" stroke="#ef4444" strokeWidth="1" />
        <line x1="60" y1="6" x2="60" y2="2" stroke="#ef4444" strokeWidth="1" />
      </svg>
    )
  }

  if (category === 'evaporator') {
    return (
      <svg width={w} height={h} viewBox="0 0 100 60">
        <defs>
          <linearGradient id="evapTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <radialGradient id="fanGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="70%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </radialGradient>
        </defs>
        {/* Housing top */}
        <rect x="2" y="2" width="96" height="48" fill="url(#evapTopGrad)" stroke="#334155" strokeWidth="2" rx="3" />
        {/* Coils (vertical lines) */}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1={8 + i * 7.5} y1="6" x2={8 + i * 7.5} y2="46" stroke="#64748b" strokeWidth="1.2" opacity="0.7" />
        ))}
        {/* Horizontal fins */}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={i} x1="4" y1={10 + i * 9} x2="96" y2={10 + i * 9} stroke="#94a3b8" strokeWidth="0.3" opacity="0.5" />
        ))}
        {/* Fans */}
        {[20, 50, 80].map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy={28} r={11} fill="url(#fanGrad)" stroke="#1e293b" strokeWidth="1" />
            <circle cx={cx} cy={28} r={3} fill="#475569" />
            {/* Fan blades */}
            {[0, 60, 120, 180, 240, 300].map(angle => (
              <ellipse key={angle} cx={cx} cy={28} rx={2} ry={9}
                transform={`rotate(${angle} ${cx} ${28})`}
                fill="#94a3b8" opacity="0.4" />
            ))}
            <circle cx={cx} cy={28} r={1.5} fill="#0f172a" />
          </g>
        ))}
        {/* Drip tray */}
        <rect x="2" y="50" width="96" height="4" fill="#475569" />
        <rect x="2" y="54" width="96" height="2" fill="#1e293b" />
        {/* Airflow arrows */}
        <path d="M 12 56 L 12 60" stroke="#06b6d4" strokeWidth="1.5" markerEnd="url(#af)" />
        <path d="M 50 56 L 50 60" stroke="#06b6d4" strokeWidth="1.5" />
        <path d="M 88 56 L 88 60" stroke="#06b6d4" strokeWidth="1.5" />
        {/* Brand label */}
        <rect x="40" y="8" width="20" height="6" fill="#1e293b" rx="1" />
        <text x="50" y="13" textAnchor="middle" fill="#06b6d4" fontSize="5" fontWeight="bold">EVAP</text>
      </svg>
    )
  }

  if (category === 'condenser') {
    return (
      <svg width={w} height={h} viewBox="0 0 100 60">
        <defs>
          <linearGradient id="condGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <radialGradient id="condFanGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="80%" stopColor="#0f172a" />
          </radialGradient>
        </defs>
        {/* Housing */}
        <rect x="2" y="2" width="96" height="50" fill="url(#condGrad)" stroke="#78350f" strokeWidth="2" rx="2" />
        {/* Coil lines (vertical) */}
        {Array.from({ length: 6 }).map((_, i) => (
          <rect key={i} x={6 + i * 15} y="4" width="10" height="46" fill="none" stroke="#78350f" strokeWidth="1" opacity="0.6" />
        ))}
        {/* Big fan grille */}
        <circle cx="50" cy="27" r="22" fill="url(#condFanGrad)" stroke="#000" strokeWidth="1.5" />
        <circle cx="50" cy="27" r="20" fill="none" stroke="#475569" strokeWidth="0.5" />
        <circle cx="50" cy="27" r="15" fill="none" stroke="#475569" strokeWidth="0.5" />
        <circle cx="50" cy="27" r="10" fill="none" stroke="#475569" strokeWidth="0.5" />
        {/* Big fan blades */}
        {[0, 72, 144, 216, 288].map(angle => (
          <path key={angle} d={`M 50 27 L 50 7 A 20 20 0 0 1 ${50 + 17 * Math.sin(angle * Math.PI / 180)} ${27 + 17 * Math.cos(angle * Math.PI / 180)} Z`}
            transform={`rotate(${angle} 50 27)`}
            fill="#475569" opacity="0.5" />
        ))}
        <circle cx="50" cy="27" r="4" fill="#fbbf24" stroke="#000" strokeWidth="0.5" />
        {/* Pipes */}
        <line x1="15" y1="0" x2="15" y2="6" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
        <line x1="85" y1="0" x2="85" y2="6" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" />
        {/* Mount base */}
        <rect x="2" y="52" width="96" height="4" fill="#78350f" />
      </svg>
    )
  }

  if (category === 'unit') {
    return (
      <svg width={w} height={h} viewBox="0 0 100 60">
        <defs>
          <linearGradient id="unitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>
        {/* Top panel */}
        <rect x="2" y="2" width="96" height="50" fill="url(#unitGrad)" stroke="#1e293b" strokeWidth="2" rx="3" />
        {/* Compressor cylinder */}
        <rect x="20" y="12" width="20" height="30" fill="#94a3b8" stroke="#1e293b" strokeWidth="1" rx="3" />
        <circle cx="30" cy="40" r="3" fill="#475569" />
        {/* Fan */}
        <circle cx="65" cy="27" r="13" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
        {[0, 90, 180, 270].map(angle => (
          <path key={angle} d={`M 65 27 L 65 14 A 13 13 0 0 1 ${65 + 13 * Math.sin(angle * Math.PI / 180)} ${27 + 13 * Math.cos(angle * Math.PI / 180)} Z`}
            transform={`rotate(${angle + 45} 65 27)`}
            fill="#94a3b8" opacity="0.4" />
        ))}
        <circle cx="65" cy="27" r="3" fill="#475569" />
        {/* Pipes */}
        <line x1="2" y1="15" x2="20" y2="15" stroke="#22d3ee" strokeWidth="3" />
        <line x1="2" y1="35" x2="20" y2="35" stroke="#fb923c" strokeWidth="3" />
        <line x1="78" y1="27" x2="98" y2="27" stroke="#94a3b8" strokeWidth="2" />
        {/* Vents */}
        {[10, 90].map(x => (
          <g key={x}>
            {[5, 25, 45].map(y => (
              <rect key={y} x={x-2} y={y} width="4" height="3" fill="#0f172a" rx="0.5" />
            ))}
          </g>
        ))}
        <rect x="2" y="52" width="96" height="2" fill="#1e293b" />
      </svg>
    )
  }

  if (category === 'rack') {
    return (
      <svg width={w} height={h} viewBox="0 0 100 60">
        <defs>
          <linearGradient id="rackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        {/* Uprights */}
        {[5, 50, 95].map(x => (
          <rect key={x} x={x-1} y="0" width="2" height="58" fill="url(#rackGrad)" />
        ))}
        {/* Cross beams */}
        {[15, 30, 45].map(y => (
          <rect key={y} x="3" y={y} width="94" height="2" fill="url(#rackGrad)" />
        ))}
        {/* Pallets */}
        {[15, 30, 45].map(y => (
          <g key={y}>
            <rect x="6" y={y+2} width="44" height="11" fill="#a16207" stroke="#451a03" strokeWidth="0.5" />
            <rect x="50" y={y+2} width="44" height="11" fill="#a16207" stroke="#451a03" strokeWidth="0.5" />
            <line x1="6" y1={y+5} x2="50" y2={y+5} stroke="#78350f" strokeWidth="0.3" />
            <line x1="6" y1={y+9} x2="50" y2={y+9} stroke="#78350f" strokeWidth="0.3" />
            <line x1="50" y1={y+5} x2="94" y2={y+5} stroke="#78350f" strokeWidth="0.3" />
            <line x1="50" y1={y+9} x2="94" y2={y+9} stroke="#78350f" strokeWidth="0.3" />
          </g>
        ))}
      </svg>
    )
  }

  return null
}

// ====== EQUIPMENT SIDEBAR ======
function EquipmentSidebar({ onAddEquipment, rooms }) {
  const categories = [
    { id: 'door', label: '🚪 Ovet', items: EQUIPMENT_CATALOG.filter(e => e.category === 'door') },
    { id: 'evaporator', label: '❄️ Höyrystimet', items: EQUIPMENT_CATALOG.filter(e => e.category === 'evaporator') },
    { id: 'condenser', label: '🔥 Lauhduttimet', items: EQUIPMENT_CATALOG.filter(e => e.category === 'condenser') },
    { id: 'unit', label: '⚙️ Koneikot', items: EQUIPMENT_CATALOG.filter(e => e.category === 'unit') },
    { id: 'rack', label: '📦 Hyllyt', items: EQUIPMENT_CATALOG.filter(e => e.category === 'rack') }
  ]

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '1px' }}>
        ⚙️ VEDÄ HUONEESEEN
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
        Valitse alta ja vedä laitteet huoneeseen 2D-näkymässä
      </div>
      {categories.map(cat => (
        <div key={cat.id}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
            {cat.label}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {cat.items.map(item => (
              <div key={item.id} draggable onDragStart={(e) => e.dataTransfer.setData('equipment', item.id)} style={{
                padding: '6px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
                cursor: 'grab', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center'
              }}>
                <EquipmentIcon category={item.category} size={70} capacity={item.capacity} />
                <div style={{ fontSize: '9px', color: '#fff', fontWeight: '600', textAlign: 'center', marginTop: '2px' }}>{item.name.replace(/🚪 |❄️ |🔥 |⚙️ |📦 /, '')}</div>
                {item.capacity > 0 && <div style={{ fontSize: '8px', color: '#06b6d4', fontWeight: '700' }}>{item.capacity}kW</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ padding: '10px', background: 'rgba(6,182,212,0.08)', borderRadius: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
        💡 <strong style={{ color: '#06b6d4' }}>Vinkki</strong>: Voit myös klikata huonetta hiiren oikealla → "Lisää..."
      </div>
    </div>
  )
}

// ====== EQUIPMENT PROPERTIES PANEL ======
function EquipmentPropertiesPanel({ equipment, rooms, onUpdate, onClose }) {
  if (!equipment) return null
  const parentRoom = rooms.find(r => r.id === equipment.roomId)

  const handleUpdate = (key, value) => {
    onUpdate({ ...equipment, [key]: parseFloat(value) || 0 })
  }

  return (
    <div style={{
      position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid #06b6d4', borderRadius: '12px',
      padding: '16px 20px', zIndex: 200, minWidth: '380px',
      boxShadow: '0 8px 32px rgba(6,182,212,0.3)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,182,212,0.2)', borderRadius: '6px', padding: '4px' }}>
            <EquipmentIcon category={equipment.category} size={28} capacity={equipment.capacity} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>{equipment.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>{parentRoom?.name || 'Ei huonetta'}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px', padding: '0 8px' }}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
        <div>
          <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Leveys (m)</label>
          <input
            type="number" step="0.1" min="0.1" value={equipment.width?.toFixed(2) || 0}
            onChange={(e) => handleUpdate('width', e.target.value)}
            style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Syvyys (m)</label>
          <input
            type="number" step="0.1" min="0.1" value={equipment.depth?.toFixed(2) || 0}
            onChange={(e) => handleUpdate('depth', e.target.value)}
            style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '10px', color: '#06b6d4', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '4px' }}>KORKEUS (m)</label>
          <input
            type="number" step="0.05" min="0.1" value={equipment.height?.toFixed(2) || 0}
            onChange={(e) => handleUpdate('height', e.target.value)}
            style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #06b6d4', borderRadius: '4px', color: '#06b6d4', fontSize: '12px', fontWeight: '700' }}
          />
        </div>
      </div>

      {/* Height presets */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '6px' }}>⚡ Korkeusvalinnat tyypin mukaan</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          {equipment.category === 'door' && [1.5, 1.8, 2.0, 2.2, 2.4, 2.6].map(h => (
            <button key={h} onClick={() => handleUpdate('height', h)} style={{
              padding: '4px', background: equipment.height === h ? '#06b6d4' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
              color: equipment.height === h ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer'
            }}>{h}m</button>
          ))}
          {equipment.category === 'evaporator' && [0.3, 0.4, 0.5, 0.7, 0.9, 1.1].map(h => (
            <button key={h} onClick={() => handleUpdate('height', h)} style={{
              padding: '4px', background: equipment.height === h ? '#06b6d4' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
              color: equipment.height === h ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer'
            }}>{h}m</button>
          ))}
          {equipment.category === 'condenser' && [0.6, 0.8, 1.0, 1.2, 1.5, 1.8].map(h => (
            <button key={h} onClick={() => handleUpdate('height', h)} style={{
              padding: '4px', background: equipment.height === h ? '#06b6d4' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
              color: equipment.height === h ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer'
            }}>{h}m</button>
          ))}
          {equipment.category === 'unit' && [1.0, 1.3, 1.5, 1.7, 1.9, 2.2].map(h => (
            <button key={h} onClick={() => handleUpdate('height', h)} style={{
              padding: '4px', background: equipment.height === h ? '#06b6d4' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
              color: equipment.height === h ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer'
            }}>{h}m</button>
          ))}
          {equipment.category === 'rack' && [3.0, 4.0, 4.5, 5.0, 5.5, 6.0].map(h => (
            <button key={h} onClick={() => handleUpdate('height', h)} style={{
              padding: '4px', background: equipment.height === h ? '#06b6d4' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
              color: equipment.height === h ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: '10px', cursor: 'pointer'
            }}>{h}m</button>
          ))}
        </div>
      </div>

      {/* Capacity */}
      {equipment.capacity !== undefined && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Teho (kW)</label>
            <input
              type="number" step="1" min="0" value={equipment.capacity || 0}
              onChange={(e) => handleUpdate('capacity', e.target.value)}
              style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Asento (°)</label>
            <input
              type="number" step="15" value={equipment.rotation || 0}
              onChange={(e) => handleUpdate('rotation', e.target.value)}
              style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
            />
          </div>
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', display: 'flex', gap: '8px', alignItems: 'center', padding: '8px', background: 'rgba(6,182,212,0.08)', borderRadius: '6px' }}>
        💡 <span>Vedä laitetta 2D-näkymässä siirtääksesi. Käytä kontekstivalikkoa (hiiren oikea) toimintoihin.</span>
      </div>
    </div>
  )
}

// ====== STEP ROOM TYPE ======
function Step1RoomType({ selectedType, setSelectedType, onCreate, count }) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Vaihe 1 / 6 — Valitse kylmähuonetyyppi</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff', lineHeight: 1.2 }}>
        Minkä tyyppistä kylmähuonetta suunnittelet?
      </div>

      {COLD_ROOM_TYPES.map(type => (
        <button key={type.id} onClick={() => setSelectedType(type.id)} style={{
          padding: '12px', textAlign: 'left', cursor: 'pointer', borderRadius: '12px',
          background: selectedType === type.id ? `linear-gradient(135deg, ${type.accent}30, ${type.accent}10)` : 'rgba(255,255,255,0.04)',
          border: selectedType === type.id ? `2px solid ${type.accent}` : '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '28px' }}>{type.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: '700' }}>{type.name}</div>
                <div style={{ color: type.accent, fontSize: '12px', fontWeight: '600' }}>{type.nameSub}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>{type.shortDescription}</div>
            </div>
          </div>
        </button>
      ))}

      {selectedType && (
        <button onClick={() => onCreate(selectedType)} style={{
          padding: '14px', marginTop: '8px',
          background: `linear-gradient(135deg, ${COLD_ROOM_TYPES.find(t => t.id === selectedType).accent}, ${COLD_ROOM_TYPES.find(t => t.id === selectedType).accent}dd)`,
          border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: '700',
          cursor: 'pointer', boxShadow: `0 4px 16px ${COLD_ROOM_TYPES.find(t => t.id === selectedType).accent}40`
        }}>
          ➕ Lisää huone {count + 1}
        </button>
      )}
    </div>
  )
}

// ====== STEP ROOM EDITOR ======
function StepRoomEditor({ room, onUpdate, step, setStep }) {
  if (!room) return null
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Vaihe {step} / 6 — {room.name}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>
        {step === 2 && '📏 Huoneen mitat'}
        {step === 3 && '🧱 Eristys ja seinät'}
        {step === 4 && '🚪 Ovien ja laitteiden sijoittelu'}
        {step === 5 && '⚙️ Varusteet'}
      </div>

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { label: 'Pituus (m)', key: 'width', min: 1, max: 30, step: 0.1 },
            { label: 'Leveys (m)', key: 'depth', min: 1, max: 20, step: 0.1 },
            { label: 'Korkeus (m)', key: 'height', min: 2, max: 6, step: 0.1 }
          ].map(item => (
            <div key={item.key}>
              <label style={labelStyle}>{item.label}</label>
              <input type="range" min={item.min} max={item.max} step={item.step} value={room[item.key]}
                onChange={(e) => onUpdate({ ...room, [item.key]: parseFloat(e.target.value) })} style={sliderStyle} />
              <div style={valueStyle}>{fmt(room[item.key])} m</div>
            </div>
          ))}
          <div style={summaryCard}>
            <div style={summaryRow}><span>Pinta-ala</span><span style={summaryValue}>{fmt(room.width * room.depth, 1)} m²</span></div>
            <div style={summaryRow}><span>Tilavuus</span><span style={summaryValue}>{fmt(room.width * room.depth * room.height, 1)} m³</span></div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Seinämäpaksuus (mm)</label>
            <input type="range" min="50" max="200" step="5" value={(room.wallThickness || 0.1) * 1000}
              onChange={(e) => onUpdate({ ...room, wallThickness: parseFloat(e.target.value) / 1000 })} style={sliderStyle} />
            <div style={valueStyle}>{Math.round((room.wallThickness || 0.1) * 1000)} mm</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><label style={labelStyle}>U seinä (W/m²K)</label><input type="number" step="0.01" value={room.uWall} onChange={(e) => onUpdate({ ...room, uWall: parseFloat(e.target.value) || 0 })} style={inputStyle} /></div>
            <div><label style={labelStyle}>U katto (W/m²K)</label><input type="number" step="0.01" value={room.uCeiling} onChange={(e) => onUpdate({ ...room, uCeiling: parseFloat(e.target.value) || 0 })} style={inputStyle} /></div>
            <div><label style={labelStyle}>U lattia (W/m²K)</label><input type="number" step="0.01" value={room.uFloor} onChange={(e) => onUpdate({ ...room, uFloor: parseFloat(e.target.value) || 0 })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Huone °C</label><input type="number" step="0.5" value={room.temp} onChange={(e) => onUpdate({ ...room, temp: parseFloat(e.target.value) || 0 })} style={inputStyle} /></div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
          Käytä <strong style={{ color: '#06b6d4' }}>oikeaa hiiren klikkausta</strong> huoneen päällä tai <strong style={{ color: '#06b6d4' }}>raahaa laitteita</strong> sivupaneelista huoneeseen.
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
            ← Edellinen
          </button>
        )}
        {step < 6 && (
          <button onClick={() => setStep(step + 1)} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            Seuraava →
          </button>
        )}
      </div>
    </div>
  )
}

const labelStyle = { fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', display: 'block', marginBottom: '6px' }
const valueStyle = { color: '#06b6d4', fontSize: '14px', fontWeight: '700', textAlign: 'center', marginTop: '4px' }
const sliderStyle = { width: '100%', accentColor: '#06b6d4' }
const inputStyle = { width: '100%', padding: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }
const summaryCard = { padding: '12px', background: 'rgba(6,182,212,0.08)', borderRadius: '8px', border: '1px solid rgba(6,182,212,0.3)' }
const summaryRow = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'rgba(255,255,255,0.6)', fontSize: '12px' }
const summaryValue = { color: '#06b6d4', fontWeight: '700' }

// ====== WORKFLOW STEPS ======
function WorkflowSteps({ currentStep, setStep }) {
  const steps = [
    { id: 1, label: 'Huonetyyppi', icon: '🏠' },
    { id: 2, label: 'Mitat', icon: '📏' },
    { id: 3, label: 'Eristys', icon: '🧱' },
    { id: 4, label: 'Ovet', icon: '🚪' },
    { id: 5, label: 'Laitteet', icon: '⚙️' },
    { id: 6, label: 'Laskelma', icon: '📊' }
  ]
  return (
    <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: '700' }}>SUUNNITTELU</div>
      {steps.map(step => (
        <button key={step.id} onClick={() => setStep(step.id)} style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
          background: currentStep === step.id ? 'rgba(6,182,212,0.15)' : 'transparent',
          border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
          borderLeft: currentStep === step.id ? '3px solid #06b6d4' : '3px solid transparent',
          width: '100%', marginBottom: '2px'
        }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: currentStep === step.id ? '#06b6d4' : 'rgba(255,255,255,0.08)',
            color: currentStep === step.id ? '#fff' : 'rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: '700'
          }}>
            {currentStep > step.id ? '✓' : step.id}
          </div>
          <div style={{ color: currentStep === step.id ? '#06b6d4' : 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: '600' }}>{step.icon} {step.label}</div>
        </button>
      ))}
    </div>
  )
}

// ====== HEAT LOAD SIDEBAR ======
function HeatLoadSidebar({ heatLoad, rooms, equipment, products }) {
  const items = [
    { label: 'Johtuminen', value: heatLoad.transmission, color: '#60a5fa' },
    { label: 'Ilmanvaihto', value: heatLoad.infiltration, color: '#a78bfa' },
    { label: 'Tuotteet', value: heatLoad.product, color: '#fbbf24' },
    { label: 'Laitteet', value: heatLoad.equipment, color: '#4ade80' },
    { label: 'Valaistus', value: heatLoad.lighting, color: '#06b6d4' },
    { label: 'Henkilöt', value: heatLoad.occupancy, color: '#f472b6' }
  ]
  const total = heatLoad.total || 1
  const withSafety = heatLoad.total * 1.1

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', marginBottom: '6px' }}>
          LÄMPÖKUORMA
        </div>
        <div style={{ fontSize: '32px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>
          {heatLoad.total.toLocaleString()}
          <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', fontWeight: '500', marginLeft: '6px' }}>W</span>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
          {(heatLoad.total / 1000).toFixed(2)} kW
        </div>
      </div>

      <div style={{ padding: '12px', background: 'rgba(6,182,212,0.1)', borderRadius: '8px', border: '1px solid rgba(6,182,212,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Suositus +10% varmuus</span>
          <span style={{ fontSize: '14px', color: '#06b6d4', fontWeight: '700' }}>{Math.round(withSafety).toLocaleString()} W</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((item, i) => (
          <div key={i} style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: `3px solid ${item.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>{item.label}</span>
              <span style={{ fontSize: '13px', color: item.color, fontWeight: '700' }}>{item.value} W</span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${(item.value / total) * 100}%`, height: '100%', background: item.color }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px' }}>
        <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>📌 SUOSITUS</div>
        <div style={{ fontSize: '13px', color: '#fff', lineHeight: 1.6 }}>
          Höyrystin: <strong style={{ color: '#22c55e' }}>{heatLoad.recommendedEvapCap} kW</strong><br />
          Lauhdutin: <strong style={{ color: '#22c55e' }}>{heatLoad.recommendedCondCap} kW</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={statCard}>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#06b6d4' }}>{heatLoad.area}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>m² pinta-ala</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#06b6d4' }}>{heatLoad.volume}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>m³ tilavuus</div>
        </div>
      </div>

      <button onClick={() => exportToPDF(rooms, equipment, products, heatLoad)} style={{
        padding: '14px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
        border: 'none', borderRadius: '10px', color: '#fff',
        fontSize: '13px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(220,38,38,0.3)'
      }}>
        📄 Vie PDF-raportti
      </button>
    </div>
  )
}

const statCard = {
  padding: '10px', background: 'rgba(6,182,212,0.08)',
  borderRadius: '8px', textAlign: 'center',
  border: '1px solid rgba(6,182,212,0.2)'
}

function exportToPDF(rooms, equipment, products, heatLoad) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210

  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 297, 'F')
  doc.setFillColor(30, 41, 59); doc.rect(0, 60, W, 80, 'F')
  doc.setFontSize(28); doc.setTextColor(6, 182, 212); doc.text('RefCAD Tool', 20, 35)
  doc.setFontSize(12); doc.setTextColor(148, 163, 184); doc.text('Professional Cold Room Design Report', 20, 45)
  doc.setFontSize(36); doc.setTextColor(255, 255, 255); doc.text('Lämpökuorma-analyysi', 25, 100)
  doc.setFontSize(11); doc.setTextColor(148, 163, 184)
  doc.text(`Luotu: ${new Date().toLocaleDateString('fi-FI')}`, 20, 140)
  doc.text(`Huoneet: ${rooms.length} · Laitteet: ${equipment.length}`, 20, 148)

  doc.setFontSize(14); doc.setTextColor(255, 255, 255); doc.text('Kokonaislämpökuorma', 20, 180)
  doc.setFontSize(48); doc.setTextColor(6, 182, 212); doc.text(`${heatLoad.total.toLocaleString()}`, 20, 210)
  doc.setFontSize(14); doc.setTextColor(148, 163, 184); doc.text('W', 80, 210)

  doc.addPage()
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 25, 'F')
  doc.setFontSize(18); doc.setTextColor(6, 182, 212); doc.text('Erittely', 20, 16)

  let y = 40
  const items = [
    { label: 'Johtuminen', value: heatLoad.transmission, total: heatLoad.total, color: [96, 165, 250] },
    { label: 'Ilmanvaihto', value: heatLoad.infiltration, total: heatLoad.total, color: [167, 139, 250] },
    { label: 'Tuotteet', value: heatLoad.product, total: heatLoad.total, color: [251, 191, 36] },
    { label: 'Laitteet', value: heatLoad.equipment, total: heatLoad.total, color: [74, 222, 128] },
    { label: 'Valaistus', value: heatLoad.lighting, total: heatLoad.total, color: [6, 182, 212] },
    { label: 'Henkilöt', value: heatLoad.occupancy, total: heatLoad.total, color: [244, 114, 182] }
  ]
  items.forEach(item => {
    doc.setFillColor(...item.color); doc.rect(20, y - 4, 5, 8, 'F')
    doc.setFontSize(11); doc.setTextColor(60); doc.text(item.label, 30, y)
    doc.setFontSize(13); doc.setTextColor(...item.color); doc.text(`${item.value.toLocaleString()} W`, 90, y)
    doc.setFontSize(10); doc.setTextColor(120); doc.text(`${((item.value / (heatLoad.total || 1)) * 100).toFixed(1)}%`, W - 30, y)
    doc.setFillColor(240); doc.rect(125, y - 3, 50, 5, 'F')
    doc.setFillColor(...item.color); doc.rect(125, y - 3, 50 * (item.value / heatLoad.total), 5, 'F')
    y += 12
  })

  doc.save(`refcad_lampokuorma_${Date.now()}.pdf`)
}

// ====== LOCAL STORAGE PERSISTENCE ======
const STORAGE_KEY = 'refcad-design-v1'

const loadSavedDesign = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed
    }
  } catch (e) {
    console.error('Failed to load saved design:', e)
  }
  return null
}

const saveDesign = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (e) {
    console.error('Failed to save design:', e)
    return false
  }
}

const clearSavedDesign = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch (e) {
    return false
  }
}

// ====== MAIN APP ======
export default function App() {
  // Load saved design on mount
  const savedData = useMemo(() => loadSavedDesign(), [])

  const [currentStep, setCurrentStep] = useState(1)
  const [selectedRoomType, setSelectedRoomType] = useState('chilled')
  const [projectName, setProjectName] = useState(savedData?.projectName || 'Uusi projekti')
  const [rooms, setRooms] = useState(savedData?.rooms || [])
  const [clipboard, setClipboard] = useState(null)
  const [cutItem, setCutItem] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [view3D, setView3D] = useState(false)
  const [view2D, setView2D] = useState({ scale: 30, offsetX: 400, offsetY: 300 })
  const [activeSidebar, setActiveSidebar] = useState('workflow')
  const [dimUnit, setDimUnit] = useState(savedData?.dimUnit || 'auto')
  const [contextMenu, setContextMenu] = useState(null)
  const [saveStatus, setSaveStatus] = useState({ saved: !!savedData, time: new Date() })
  const [savedProjects, setSavedProjects] = useState([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [movingItem, setMovingItem] = useState(null) // { id, roomId } for "Move mode"
  const [rightTab, setRightTab] = useState('heatload') // 'equipment' or 'heatload'

  const handleShowContextMenu = useCallback((e, room, eq) => {
    e.preventDefault()
    if (eq) {
      setContextMenu({
        x: e.clientX, y: e.clientY,
        target: { type: 'equipment', id: eq.id, category: eq.category },
        equipmentId: eq.id,
        roomId: room.id
      })
      setSelectedId(eq.id)
    } else if (room) {
      setContextMenu({
        x: e.clientX, y: e.clientY,
        target: { type: 'room', id: room.id },
        roomId: room.id,
        worldX: 0,
        worldZ: 0
      })
      setSelectedId(room.id)
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, target: null })
    }
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const heatLoad = useMemo(() => calculateHeatLoad(rooms), [rooms])

  // Auto-save effect - saves whenever rooms, projectName, or dimUnit changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const success = saveDesign({
        projectName,
        rooms,
        dimUnit,
        lastSaved: new Date().toISOString()
      })
      if (success) {
        setSaveStatus({ saved: true, time: new Date() })
      }
    }, 1000) // 1 second debounce
    return () => clearTimeout(timer)
  }, [rooms, projectName, dimUnit])

  // Load saved projects list on mount
  useEffect(() => {
    try {
      const list = localStorage.getItem('refcad-projects-list')
      if (list) {
        setSavedProjects(JSON.parse(list))
      }
    } catch (e) {
      console.error('Failed to load projects list:', e)
    }
  }, [])

  // Auto-switch to equipment tab when equipment is selected - declared after allEquipment

  const handleSaveAs = useCallback(() => {
    const name = prompt('Anna projektille nimi:', projectName)
    if (!name) return
    setProjectName(name)
    const success = saveDesign({
      projectName: name,
      rooms,
      dimUnit,
      lastSaved: new Date().toISOString()
    })
    if (success) {
      // Update projects list
      const newList = [...savedProjects.filter(p => p.name !== name), { name, date: new Date().toISOString() }]
      setSavedProjects(newList)
      try {
        localStorage.setItem('refcad-projects-list', JSON.stringify(newList))
        // Save with project-specific key
        localStorage.setItem(`refcad-project-${name}`, JSON.stringify({ rooms, dimUnit, lastSaved: new Date().toISOString() }))
      } catch (e) {}
      setSaveStatus({ saved: true, time: new Date() })
    }
  }, [projectName, rooms, dimUnit, savedProjects])

  const handleLoadProject = useCallback((name) => {
    try {
      const data = localStorage.getItem(`refcad-project-${name}`)
      if (data) {
        const parsed = JSON.parse(data)
        setProjectName(name)
        setRooms(parsed.rooms || [])
        setDimUnit(parsed.dimUnit || 'auto')
        setSaveStatus({ saved: true, time: new Date() })
      }
    } catch (e) {
      console.error('Failed to load project:', e)
    }
  }, [])

  const handleNewProject = useCallback(() => {
    if (rooms.length > 0 && !window.confirm('Haluatko varmasti aloittaa uuden projektin? Nykyinen projekti säilyy tallennettuna.')) {
      return
    }
    setProjectName('Uusi projekti')
    setRooms([])
    setSelectedId(null)
  }, [rooms])

  const handleDeleteProject = useCallback((name) => {
    if (!window.confirm(`Poistetaanko projekti "${name}"?`)) return
    try {
      localStorage.removeItem(`refcad-project-${name}`)
      const newList = savedProjects.filter(p => p.name !== name)
      setSavedProjects(newList)
      localStorage.setItem('refcad-projects-list', JSON.stringify(newList))
    } catch (e) {
      console.error('Failed to delete project:', e)
    }
  }, [savedProjects])

  const handleExportJson = useCallback(() => {
    const data = {
      projectName,
      rooms,
      dimUnit,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName.replace(/\s+/g, '_')}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [projectName, rooms, dimUnit])

  const handleImportJson = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.rooms && Array.isArray(data.rooms)) {
          setProjectName(data.projectName || 'Tuotu projekti')
          setRooms(data.rooms)
          setDimUnit(data.dimUnit || 'auto')
          setSaveStatus({ saved: true, time: new Date() })
        }
      } catch (err) {
        alert('Virheellinen tiedosto')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  // Place moving item at the new location
  const placeMovingItem = useCallback((roomId, x, z) => {
    if (!movingItem) return
    // Find which room currently has the item
    let sourceRoom = null
    if (movingItem.roomId) {
      sourceRoom = rooms.find(r => r.id === movingItem.roomId)
    }
    // If clicking the same room or no source found
    const targetRoom = rooms.find(r => r.id === roomId)
    if (!targetRoom) return

    if (sourceRoom && sourceRoom.id !== targetRoom.id) {
      // Move to different room
      const item = sourceRoom.equipment.find(e => e.id === movingItem.id)
      if (!item) return
      const updatedSource = { ...sourceRoom, equipment: sourceRoom.equipment.filter(e => e.id !== movingItem.id) }
      const updatedTarget = { ...targetRoom, equipment: [...(targetRoom.equipment || []), { ...item, x, z }] }
      setRooms(prev => prev.map(r => {
        if (r.id === sourceRoom.id) return updatedSource
        if (r.id === targetRoom.id) return updatedTarget
        return r
      }))
    } else {
      // Update position in same room
      const updatedRoom = { ...targetRoom, equipment: targetRoom.equipment.map(e => e.id === movingItem.id ? { ...e, x, z } : e) }
      setRooms(prev => prev.map(r => r.id === targetRoom.id ? updatedRoom : r))
    }
    setMovingItem(null)
  }, [movingItem, rooms])

  const createRoom = (typeId) => {
    const type = COLD_ROOM_TYPES.find(t => t.id === typeId)
    if (!type) return
    const newRoom = {
      id: genId(),
      type: typeId,
      name: `${type.name} ${rooms.length + 1}`,
      width: 4, depth: 4, height: 2.8,
      x: rooms.length * 5,
      z: 0,
      temp: type.temp,
      ambientTemp: type.ambient,
      rh: type.rh,
      uWall: type.uWall,
      uCeiling: type.uCeiling,
      uFloor: type.uFloor,
      wallThickness: 0.1,
      color: type.accent,
      equipment: [],
      products: []
    }
    setRooms(prev => [...prev, newRoom])
    setSelectedId(newRoom.id)
    setCurrentStep(2)
  }

  const updateRoom = (room) => setRooms(prev => prev.map(r => r.id === room.id ? room : r))

  const allEquipment = useMemo(() => rooms.flatMap(r => (r.equipment || []).map(e => ({ ...e, roomId: r.id }))), [rooms])
  const allProducts = useMemo(() => rooms.flatMap(r => (r.products || []).map(p => ({ ...p, roomId: r.id }))), [rooms])

  const selectedRoom = rooms.find(r => r.id === selectedId)

  // Auto-switch to equipment tab when equipment is selected (declared after allEquipment)
  useEffect(() => {
    const sel = allEquipment.find(e => e.id === selectedId)
    if (sel) setRightTab('equipment')
  }, [selectedId, allEquipment])

  // ====== Actions ======
  const handleAddEquipment = useCallback((roomId, catalogId, x, z) => {
    const cat = getEquipmentById(catalogId)
    if (!cat) return
    const room = rooms.find(r => r.id === roomId)
    if (!room) return

    const newEquipment = {
      id: genId(),
      catalogId: catalogId,
      ...cat,
      x: x || 0,
      z: z || 0,
      rotation: 0,
      y: cat.category === 'evaporator' ? (room.height || 2.8) - (cat.height || 0.4) - 0.1 :
         cat.category === 'condenser' ? (room.height || 2.8) - (cat.height || 0.8) - 0.2 :
         cat.category === 'rack' ? 0 :
         cat.category === 'door' ? 0 :
         0 // floor standing units
    }

    if (cat.category === 'door') {
      // Snap door to nearest wall
      const hw = (room.width || 4) / 2
      const hd = (room.depth || 4) / 2
      // Find closest wall to (x, z)
      const distFront = Math.abs(z + hd)
      const distBack = Math.abs(z - hd)
      const distLeft = Math.abs(x + hw)
      const distRight = Math.abs(x - hw)
      const minDist = Math.min(distFront, distBack, distLeft, distRight)

      if (minDist === distFront || minDist === distBack) {
        newEquipment.x = Math.max(-hw + 0.5, Math.min(hw - 0.5, x))
        newEquipment.z = minDist === distFront ? -hd : hd
        newEquipment.rotation = 0
      } else {
        newEquipment.z = Math.max(-hd + 0.5, Math.min(hd - 0.5, z))
        newEquipment.x = minDist === distLeft ? -hw : hw
        newEquipment.rotation = 90
      }
    }

    const updatedRoom = { ...room, equipment: [...(room.equipment || []), newEquipment] }
    updateRoom(updatedRoom)
    setSelectedId(newEquipment.id)
  }, [rooms])

  const handleCopy = useCallback((item) => {
    setCutItem(null)
    setClipboard(item)
  }, [])

  const handleCut = useCallback((item) => {
    setCutItem(item)
    setClipboard(item)
  }, [])

  const handlePaste = useCallback((worldX, worldZ) => {
    if (!clipboard) return
    if (clipboard.type === 'room') {
      const original = rooms.find(r => r.id === clipboard.id)
      if (!original) return
      const offset = 1
      const newRoom = { ...clone(original), id: genId(), name: `${original.name} (kopio)`, x: (original.x || 0) + offset, z: (original.z || 0) + offset }
      setRooms(prev => [...prev, newRoom])
      setSelectedId(newRoom.id)
    } else if (clipboard.type === 'equipment') {
      const room = rooms.find(r => r.id === clipboard.roomId)
      if (!room) return
      const original = room.equipment.find(e => e.id === clipboard.id)
      if (!original) return
      const newEq = { ...clone(original), id: genId(), name: `${original.name} (kopio)`, x: original.x + 0.5, z: original.z + 0.5 }
      const updatedRoom = { ...room, equipment: [...(room.equipment || []), newEq] }
      updateRoom(updatedRoom)
      setSelectedId(newEq.id)
    }
  }, [clipboard, rooms])

  const handleDuplicate = useCallback((id) => {
    const room = rooms.find(r => r.id === id)
    if (room) {
      const newRoom = { ...clone(room), id: genId(), name: `${room.name} (kopio)`, x: (room.x || 0) + 1, z: (room.z || 0) + 1 }
      setRooms(prev => [...prev, newRoom])
      setSelectedId(newRoom.id)
      return
    }
    // Equipment duplicate
    for (const r of rooms) {
      const eq = (r.equipment || []).find(e => e.id === id)
      if (eq) {
        const newEq = { ...clone(eq), id: genId(), name: `${eq.name} (kopio)`, x: eq.x + 0.5, z: eq.z + 0.5 }
        updateRoom({ ...r, equipment: [...(r.equipment || []), newEq] })
        setSelectedId(newEq.id)
        return
      }
    }
  }, [rooms])

  const handleDelete = useCallback((item) => {
    if (item.type === 'room') {
      setRooms(prev => prev.filter(r => r.id !== item.id))
      setSelectedId(null)
    } else if (item.type === 'equipment') {
      const room = rooms.find(r => r.id === item.roomId)
      if (room) {
        const updated = { ...room, equipment: room.equipment.filter(e => e.id !== item.equipmentId) }
        updateRoom(updated)
        setSelectedId(null)
      }
    }
  }, [rooms])

  const handleQuickAction = useCallback((action, context) => {
    if (action === 'add-door') {
      const room = rooms.find(r => r.id === context.roomId)
      if (!room) return
      const hw = (room.width || 4) / 2
      const hd = (room.depth || 4) / 2
      handleAddEquipment(room.id, 'door-h900', 0, -hd + 0.5)
    } else if (action === 'add-evap') {
      const room = rooms.find(r => r.id === context.roomId)
      if (room) handleAddEquipment(room.id, 'evap-10', context.worldX || 0, context.worldZ || 0)
    } else if (action === 'add-cond') {
      const room = rooms.find(r => r.id === context.roomId)
      if (room) handleAddEquipment(room.id, 'cond-15', context.worldX || 0, context.worldZ || 0)
    } else if (action === 'add-unit') {
      const room = rooms.find(r => r.id === context.roomId)
      if (room) handleAddEquipment(room.id, 'compact-8', context.worldX || 0, context.worldZ || 0)
    } else if (action === 'add-rack') {
      const room = rooms.find(r => r.id === context.roomId)
      if (room) handleAddEquipment(room.id, 'racking', context.worldX || 0, context.worldZ || 0)
    } else if (action === 'rotate') {
      const room = rooms.find(r => r.id === context.roomId)
      if (room) {
        const eq = room.equipment.find(e => e.id === context.equipmentId)
        if (eq) {
          const updated = room.equipment.map(e => e.id === context.equipmentId ? { ...e, rotation: (e.rotation || 0) + 90, width: eq.depth, depth: eq.width } : e)
          updateRoom({ ...room, equipment: updated })
        }
      }
    } else if (action === 'add-room-here') {
      createRoom(selectedRoomType || 'chilled')
    }
  }, [rooms, handleAddEquipment, selectedRoomType])

  // ====== Context menu builder (placed after all handle callbacks to avoid TDZ) ======
  const buildContextMenuItems = useCallback(() => {
    if (!contextMenu) return []
    if (contextMenu.target?.type === 'room') {
      return [
        { icon: '✏️', label: 'Muokkaa huonetta', action: () => setSelectedId(contextMenu.target.id) },
        { icon: '📋', label: 'Kopioi huone', shortcut: 'Ctrl+C', action: () => handleCopy({ type: 'room', id: contextMenu.target.id }) },
        { icon: '📑', label: 'Monista huone', action: () => handleDuplicate(contextMenu.target.id) },
        { divider: true },
        { icon: '🚪', label: 'Lisää ovi', action: () => handleQuickAction('add-door', contextMenu) },
        { icon: '❄️', label: 'Lisää höyrystin', action: () => handleQuickAction('add-evap', contextMenu) },
        { icon: '🔥', label: 'Lisää lauhdutin', action: () => handleQuickAction('add-cond', contextMenu) },
        { icon: '⚙️', label: 'Lisää koneikko', action: () => handleQuickAction('add-unit', contextMenu) },
        { icon: '📦', label: 'Lisää hylly', action: () => handleQuickAction('add-rack', contextMenu) },
        { divider: true },
        { icon: '🗑️', label: 'Poista huone', shortcut: 'Del', action: () => handleDelete({ type: 'room', id: contextMenu.target.id }) }
      ]
    }
    if (contextMenu.target?.type === 'equipment') {
      return [
        { icon: '✂️', label: 'Leikkaa', shortcut: 'Ctrl+X', action: () => handleCut({ type: 'equipment', id: contextMenu.equipmentId, roomId: contextMenu.roomId }) },
        { icon: '📋', label: 'Kopioi', shortcut: 'Ctrl+C', action: () => handleCopy({ type: 'equipment', id: contextMenu.equipmentId, roomId: contextMenu.roomId }) },
        { icon: '📑', label: 'Monista', shortcut: 'Ctrl+D', action: () => handleDuplicate(contextMenu.equipmentId) },
        { divider: true },
        { icon: '📍', label: 'Siirrä (aktivoi raahaus)', action: () => { setMovingItem({ id: contextMenu.equipmentId, roomId: contextMenu.roomId }); } },
        { icon: '↔️', label: 'Käännä 90°', shortcut: 'R', action: () => handleQuickAction('rotate', contextMenu) },
        { icon: '📏', label: 'Muuta kokoa...', action: () => handleQuickAction('resize', contextMenu) },
        { divider: true },
        { icon: '🗑️', label: 'Poista', shortcut: 'Del', action: () => handleDelete({ type: 'equipment', roomId: contextMenu.roomId, equipmentId: contextMenu.equipmentId }) }
      ]
    }
    return clipboard ? [
      { icon: '📋', label: 'Liitä tähän', shortcut: 'Ctrl+V', action: () => handlePaste(contextMenu.worldX || 0, contextMenu.worldZ || 0) }
    ] : [
      { icon: '🏠', label: 'Lisää huone tähän', action: () => createRoom(selectedRoomType || 'chilled') }
    ]
  }, [contextMenu, clipboard, selectedRoomType, handleCopy, handleCut, handleDuplicate, handleDelete, handlePaste, handleQuickAction])

  // ====== Keyboard shortcuts ======
  useEffect(() => {
    const handler = (e) => {
      // Detect right-click paste shortcut
      if (e.ctrlKey && e.key === 'c' && selectedId) {
        const eq = allEquipment.find(x => x.id === selectedId)
        if (eq) handleCopy({ type: 'equipment', id: eq.id, roomId: eq.roomId })
        else if (selectedRoom) handleCopy({ type: 'room', id: selectedRoom.id })
      }
      if (e.ctrlKey && e.key === 'v' && clipboard) {
        handlePaste(0, 0)
      }
      if (e.ctrlKey && e.key === 'd' && selectedId) {
        handleDuplicate(selectedId)
      }
      if (e.key === 'Escape') {
        if (movingItem) setMovingItem(null)
        if (contextMenu) closeContextMenu()
        return
      }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && selectedId) {
        const eq = allEquipment.find(x => x.id === selectedId)
        if (eq) handleQuickAction('rotate', { equipmentId: eq.id, roomId: eq.roomId })
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const eq = allEquipment.find(x => x.id === selectedId)
        if (eq) handleDelete({ type: 'equipment', roomId: eq.roomId, equipmentId: eq.id })
        else if (selectedRoom) handleDelete({ type: 'room', id: selectedRoom.id })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, clipboard, allEquipment, selectedRoom, movingItem, contextMenu, handleCopy, handleDelete, handleDuplicate, handlePaste, handleQuickAction, closeContextMenu])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0f1e', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <aside style={{ width: '280px', background: 'linear-gradient(180deg, #0f172a, #1e293b)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <svg width="28" height="28" viewBox="0 0 64 64">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <polygon points="32,8 52,20 32,32 12,20" fill="#dbeafe" opacity="0.9" />
              <polygon points="12,20 12,44 32,56 32,32" fill="#bfdbfe" opacity="0.9" />
              <polygon points="52,20 52,44 32,56 32,32" fill="url(#logoGrad)" />
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: '800', background: 'linear-gradient(135deg, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RefCAD</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>Cold Room Designer</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: saveStatus.saved ? '#22c55e' : '#fbbf24',
                boxShadow: saveStatus.saved ? '0 0 6px rgba(34,197,94,0.5)' : '0 0 6px rgba(251,191,36,0.5)'
              }} title={saveStatus.saved ? 'Tallennettu' : 'Tallentamatta'} />
            </div>
          </div>

          {/* Project name and save buttons */}
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Projektin nimi"
            style={{
              width: '100%', padding: '6px 10px',
              background: '#0f172a', border: '1px solid #334155', borderRadius: '6px',
              color: '#fff', fontSize: '11px', marginBottom: '6px'
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '4px' }}>
            <button onClick={handleNewProject} style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>
              📄 Uusi
            </button>
            <button onClick={() => setShowSaveDialog(true)} style={{ padding: '6px', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
              💾 Avaa
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <button onClick={() => exportToPDF(rooms, [], [], heatLoad)} style={{ padding: '6px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '4px', color: '#fca5a5', fontSize: '10px', cursor: 'pointer' }}>
              📄 PDF
            </button>
            <button onClick={handleExportJson} style={{ padding: '6px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '4px', color: '#86efac', fontSize: '10px', cursor: 'pointer' }}>
              📥 JSON
            </button>
          </div>
          <label style={{ display: 'block', marginTop: '4px', padding: '6px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', color: '#d8b4fe', fontSize: '10px', cursor: 'pointer', textAlign: 'center' }}>
            📤 Tuo JSON
            <input type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
          </label>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', textAlign: 'center' }}>
            Auto-tallennus päällä · {saveStatus.saved ? '✓' : '...'}
          </div>
        </div>

        {/* Sidebar tabs */}
        <div style={{ display: 'flex', padding: '8px 8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {[
            { id: 'workflow', label: '📋 Ohjattu' },
            { id: 'equipment', label: '⚙️ Laitteet' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveSidebar(tab.id)} style={{
              flex: 1, padding: '10px 4px', background: 'none',
              border: 'none', borderBottom: activeSidebar === tab.id ? '2px solid #06b6d4' : '2px solid transparent',
              color: activeSidebar === tab.id ? '#06b6d4' : 'rgba(255,255,255,0.5)',
              fontSize: '11px', fontWeight: '600', cursor: 'pointer'
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeSidebar === 'workflow' ? (
            <>
              <WorkflowSteps currentStep={currentStep} setStep={(s) => { if (selectedRoom || s === 1) setCurrentStep(s) }} />
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {currentStep === 1 && (
                  <Step1RoomType selectedType={selectedRoomType} setSelectedType={setSelectedRoomType} onCreate={createRoom} count={rooms.length} />
                )}
                {(currentStep >= 2 && currentStep <= 5) && (
                  <StepRoomEditor room={selectedRoom || rooms[0]} onUpdate={(r) => { if (selectedId) updateRoom(r) }} step={currentStep} setStep={setCurrentStep} />
                )}
                {currentStep === 6 && (
                  <div style={{ padding: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                    Laskelma oikealla. Kaikki päivittyy automaattisesti.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <EquipmentSidebar onAddEquipment={(id) => createRoom(selectedRoomType)} rooms={rooms} />
            </div>
          )}
        </div>
      </aside>

      {/* Main canvas */}
      <main
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
      >
        <div style={{
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
          padding: '6px', display: 'flex', gap: '4px', zIndex: 100, alignItems: 'center'
        }}>
          <button onClick={() => setView3D(false)} style={{
            padding: '8px 16px', background: !view3D ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : 'transparent',
            border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
          }}>
            📐 2D Pohjakuva
          </button>
          <button onClick={() => setView3D(true)} style={{
            padding: '8px 16px', background: view3D ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : 'transparent',
            border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
          }}>
            🎲 Isometrinen 3D
          </button>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px' }}>
            {[
              { id: 'auto', label: '📏 Auto' },
              { id: 'mm', label: 'mm' },
              { id: 'cm', label: 'cm' },
              { id: 'm', label: 'm' }
            ].map(u => (
              <button key={u.id} onClick={() => setDimUnit(u.id)} style={{
                padding: '6px 10px',
                background: dimUnit === u.id ? '#06b6d4' : 'transparent',
                border: 'none', borderRadius: '4px',
                color: dimUnit === u.id ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: '10px', fontWeight: '700', cursor: 'pointer'
              }}>{u.label}</button>
            ))}
          </div>
        </div>

        {view3D ? (
          <IsometricView rooms={rooms} selectedId={selectedId} onSelect={setSelectedId} onContextMenu3D={(e, room, eq) => handleShowContextMenu(e, room, eq)} />
        ) : (
          <PlanView2D
            rooms={rooms} selectedId={selectedId}
            onSelect={setSelectedId} onUpdateRoom={updateRoom}
            view2D={view2D} setView2D={setView2D}
            clipboard={clipboard} onCopy={handleCopy} onCut={handleCut}
            onPaste={handlePaste} onDelete={handleDelete} onDuplicate={handleDuplicate}
            onAddEquipment={handleAddEquipment}
            onQuickAction={handleQuickAction}
            contextMenu={contextMenu} setContextMenu={setContextMenu}
            dimUnit={dimUnit}
            movingItem={movingItem} onPlaceMovingItem={placeMovingItem}
          />
        )}

        {rooms.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 50, maxWidth: '400px' }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>❄️</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Aloita kylmähuoneen suunnittelu</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Valitse vasemmalta kylmähuonetyyppi ja lisää se projektiin.</div>
          </div>
        )}
      </main>

      {/* Save/Load Dialog */}
      {showSaveDialog && (
        <>
          <div onClick={() => setShowSaveDialog(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'rgba(15,23,42,0.98)', backdropFilter: 'blur(12px)',
            border: '1px solid #06b6d4', borderRadius: '12px',
            padding: '24px', zIndex: 9999, minWidth: '420px', maxWidth: '560px',
            boxShadow: '0 16px 64px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>💾 Projektit</div>
              <button onClick={() => setShowSaveDialog(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>

            <button onClick={() => { handleSaveAs(); setShowSaveDialog(false) }} style={{
              width: '100%', padding: '12px', marginBottom: '16px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(6,182,212,0.3)'
            }}>
              💾 Tallenna nykyinen nimellä...
            </button>

            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '8px' }}>
              📂 Tallennetut projektit ({savedProjects.length})
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {savedProjects.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  Ei tallennettuja projekteja vielä
                </div>
              ) : (
                savedProjects.map(p => (
                  <div key={p.name} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', marginBottom: '6px',
                    background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
                    border: projectName === p.name ? '2px solid #06b6d4' : '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{p.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                        {new Date(p.date).toLocaleString('fi-FI')}
                      </div>
                    </div>
                    <button onClick={() => { handleLoadProject(p.name); setShowSaveDialog(false) }} style={{
                      padding: '6px 12px', background: '#06b6d4', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                    }}>
                      Avaa
                    </button>
                    <button onClick={() => handleDeleteProject(p.name)} style={{
                      padding: '6px 10px', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '4px', color: '#fca5a5', fontSize: '11px', cursor: 'pointer'
                    }}>
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Global Context Menu (works for both 2D and 3D) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={buildContextMenuItems()}
        />
      )}

      {/* Right sidebar - tabbed: equipment properties OR heat load */}
      <aside style={{ width: '340px', background: 'linear-gradient(180deg, #0f172a, #1e293b)', borderLeft: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Tab header */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
          {(() => {
            const sel = allEquipment.find(e => e.id === selectedId)
            return [
              { id: 'equipment', label: '⚙️ Laite', show: !!sel },
              { id: 'heatload', label: '📊 Lämpö', show: true },
              { id: 'panel', label: sel?.name || '⚠️', show: !!sel }
            ].filter(t => t.show)
          })().map(tab => (
            <div key={tab.id} style={{
              padding: '10px 12px',
              color: rightTab === tab.id ? '#06b6d4' : 'rgba(255,255,255,0.5)',
              borderBottom: rightTab === tab.id ? '2px solid #06b6d4' : '2px solid transparent',
              fontSize: '11px', fontWeight: '600', cursor: 'pointer'
            }} onClick={() => setRightTab(tab.id)}>
              {tab.label}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {(() => {
            const sel = allEquipment.find(e => e.id === selectedId)
            // Show equipment properties if selected and tab matches
            if (sel && (rightTab === 'equipment' || rightTab === 'panel')) {
              return (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '8px' }}>
                    <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,182,212,0.2)', borderRadius: '6px', padding: '4px' }}>
                      <EquipmentIcon category={sel.category} size={36} capacity={sel.capacity} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>{sel.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>{sel.category}</div>
                    </div>
                    <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '3px' }}>L (m)</label>
                      <input type="number" step="0.05" min="0.1" value={sel.width?.toFixed(2) || 0}
                        onChange={(e) => updateRoom(rooms.find(r => r.id === sel.roomId) ? { ...rooms.find(r => r.id === sel.roomId), equipment: rooms.find(r => r.id === sel.roomId).equipment.map(eq => eq.id === sel.id ? { ...eq, width: parseFloat(e.target.value) || 0 } : eq) } : rooms[0])}
                        style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '3px' }}>S (m)</label>
                      <input type="number" step="0.05" min="0.1" value={sel.depth?.toFixed(2) || 0}
                        onChange={(e) => updateRoom(rooms.find(r => r.id === sel.roomId) ? { ...rooms.find(r => r.id === sel.roomId), equipment: rooms.find(r => r.id === sel.roomId).equipment.map(eq => eq.id === sel.id ? { ...eq, depth: parseFloat(e.target.value) || 0 } : eq) } : rooms[0])}
                        style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: '#06b6d4', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '3px' }}>K (m)</label>
                      <input type="number" step="0.05" min="0.1" value={sel.height?.toFixed(2) || 0}
                        onChange={(e) => updateRoom(rooms.find(r => r.id === sel.roomId) ? { ...rooms.find(r => r.id === sel.roomId), equipment: rooms.find(r => r.id === sel.roomId).equipment.map(eq => eq.id === sel.id ? { ...eq, height: parseFloat(e.target.value) || 0 } : eq) } : rooms[0])}
                        style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #06b6d4', borderRadius: '4px', color: '#06b6d4', fontSize: '12px', fontWeight: '700' }} />
                    </div>
                  </div>

                  {/* Height presets */}
                  <div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '5px' }}>⚡ Korkeusvalinnat</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
                      {(sel.category === 'door' ? [1.5, 1.8, 2.0, 2.2, 2.4, 2.6] :
                        sel.category === 'evaporator' ? [0.3, 0.4, 0.5, 0.7, 0.9, 1.1] :
                        sel.category === 'condenser' ? [0.6, 0.8, 1.0, 1.2, 1.5, 1.8] :
                        sel.category === 'rack' ? [3.0, 4.0, 4.5, 5.0, 5.5, 6.0] :
                        [1.0, 1.3, 1.5, 1.7, 1.9, 2.2]).map(h => (
                        <button key={h}
                          onClick={() => updateRoom(rooms.find(r => r.id === sel.roomId) ? { ...rooms.find(r => r.id === sel.roomId), equipment: rooms.find(r => r.id === sel.roomId).equipment.map(eq => eq.id === sel.id ? { ...eq, height: h } : eq) } : rooms[0])}
                          style={{
                            padding: '5px 2px',
                            background: Math.abs(sel.height - h) < 0.01 ? '#06b6d4' : 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
                            color: Math.abs(sel.height - h) < 0.01 ? '#fff' : 'rgba(255,255,255,0.7)',
                            fontSize: '10px', fontWeight: '600', cursor: 'pointer'
                          }}>{h}m</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Teho (kW)</label>
                      <input type="number" step="1" min="0" value={sel.capacity || 0}
                        onChange={(e) => updateRoom(rooms.find(r => r.id === sel.roomId) ? { ...rooms.find(r => r.id === sel.roomId), equipment: rooms.find(r => r.id === sel.roomId).equipment.map(eq => eq.id === sel.id ? { ...eq, capacity: parseFloat(e.target.value) || 0 } : eq) } : rooms[0])}
                        style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Asento °</label>
                      <input type="number" step="15" value={sel.rotation || 0}
                        onChange={(e) => updateRoom(rooms.find(r => r.id === sel.roomId) ? { ...rooms.find(r => r.id === sel.roomId), equipment: rooms.find(r => r.id === sel.roomId).equipment.map(eq => eq.id === sel.id ? { ...eq, rotation: parseFloat(e.target.value) || 0 } : eq) } : rooms[0])}
                        style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                    </div>
                  </div>

                  {/* Y position (elevation) */}
                  {sel.y !== undefined && (
                    <div>
                      <label style={{ fontSize: '9px', color: '#fbbf24', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '3px' }}>↑ Korkeus lattiasta (m)</label>
                      <input type="number" step="0.1" min="0" value={sel.y?.toFixed(2) || 0}
                        onChange={(e) => updateRoom(rooms.find(r => r.id === sel.roomId) ? { ...rooms.find(r => r.id === sel.roomId), equipment: rooms.find(r => r.id === sel.roomId).equipment.map(eq => eq.id === sel.id ? { ...eq, y: parseFloat(e.target.value) || 0 } : eq) } : rooms[0])}
                        style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #fbbf24', borderRadius: '4px', color: '#fbbf24', fontSize: '12px', fontWeight: '700' }} />
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                        Höyrystin ripustetaan kattoon: y = huoneen korkeus − laitteen korkeus
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <button onClick={() => { setMovingItem({ id: sel.id, roomId: sel.roomId }); }}
                      style={{ padding: '8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                      📍 Siirrä
                    </button>
                    <button onClick={() => handleDelete({ type: 'equipment', roomId: sel.roomId, equipmentId: sel.id })}
                      style={{ padding: '8px', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                      🗑️ Poista
                    </button>
                  </div>

                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', padding: '8px', background: 'rgba(6,182,212,0.05)', borderRadius: '6px', borderLeft: '3px solid #06b6d4' }}>
                    <strong style={{ color: '#06b6d4' }}>💡 Ohje:</strong> Vasemmalla raahaat kanvaksessa. Oikealla avautuu valikko jossa myös Kopioi, Kierrä, Koko, jne.
                  </div>
                </div>
              )
            }
            // Default: heat load sidebar
            return <HeatLoadSidebar heatLoad={heatLoad} rooms={rooms} equipment={allEquipment} products={allProducts} />
          })()}
        </div>
      </aside>
    </div>
  )
}

