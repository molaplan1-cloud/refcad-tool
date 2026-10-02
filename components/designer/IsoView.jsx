'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatTemp } from '@/lib/units'

const COS30 = Math.cos(Math.PI / 6)
const SIN30 = Math.sin(Math.PI / 6)
const WALL_SHADE = { south: 0.78, north: 0.62, east: 1, west: 0.5 }

function projectPoint(x, y, z, cam) {
  const dx = x - cam.cx
  const dz = z - cam.cz
  const cos = Math.cos(cam.azimuth)
  const sin = Math.sin(cam.azimuth)
  const rx = dx * cos - dz * sin
  const rz = dx * sin + dz * cos
  return {
    x: (rx - rz) * COS30 * cam.zoom + cam.panX,
    y: ((rx + rz) * SIN30 - y) * cam.zoom + cam.panY,
    depth: rx + rz,
  }
}

function tint(hex, factor) {
  const raw = String(hex || '#94a3b8').replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw
  const n = Number.parseInt(full, 16)
  if (!Number.isFinite(n)) return hex
  const channel = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)))
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}

function screenArea(points) {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return Math.abs(area) / 2
}

function poly(id, points, fill, opacity) {
  const depth = points.reduce((sum, point) => sum + point.depth, 0) / points.length
  return { id, points, fill, opacity, depth }
}

/** Roof plus the two walls that face the camera. Opposite walls share a winding, so visibility is by depth. */
function boxFaces(origin, size, y0, color, cam, topColor = '#f8fafc') {
  const [ox, oy, oz] = origin
  const [sx, sy, sz] = size
  const p = (x, y, z) => projectPoint(ox + x, oy + y, oz + z, cam)
  const faces = [
    { id: 'south', pts: [p(0, y0, sz), p(sx, y0, sz), p(sx, y0 + sy, sz), p(0, y0 + sy, sz)] },
    { id: 'east', pts: [p(sx, y0, 0), p(sx, y0, sz), p(sx, y0 + sy, sz), p(sx, y0 + sy, 0)] },
    { id: 'north', pts: [p(0, y0, 0), p(sx, y0, 0), p(sx, y0 + sy, 0), p(0, y0 + sy, 0)] },
    { id: 'west', pts: [p(0, y0, 0), p(0, y0, sz), p(0, y0 + sy, sz), p(0, y0 + sy, 0)] },
    { id: 'top', pts: [p(0, y0 + sy, 0), p(sx, y0 + sy, 0), p(sx, y0 + sy, sz), p(0, y0 + sy, sz)] },
  ].map((face) => poly(
    face.id,
    face.pts,
    face.id === 'top' ? topColor : tint(color, WALL_SHADE[face.id]),
    face.id === 'top' ? 0.55 : 0.92
  )).filter((face) => screenArea(face.points) > 12)
  const walls = faces.filter((face) => face.id !== 'top')
  walls.sort((a, b) => a.depth - b.depth)
  const roof = faces.find((face) => face.id === 'top')
  return [...walls.slice(0, 2), ...(roof ? [roof] : [])]
}

export default function IsoView({ rooms, selectedId, onSelect, unitSystem }) {
  const hostRef = useRef(null)
  const drag = useRef(null)
  const [cam, setCam] = useState({
    azimuth: Math.PI,
    zoom: 22,
    panX: 360,
    panY: 280,
    cx: 0,
    cz: 0,
  })
  const [size, setSize] = useState({ w: 800, h: 600 })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const measure = () => setSize({ w: host.clientWidth, h: host.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const roomIds = rooms.map((room) => room.id).join('|')

  useEffect(() => {
    if (!rooms.length || size.w < 40) return
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    let maxH = 1
    rooms.forEach((room) => {
      minX = Math.min(minX, room.x - room.width / 2)
      maxX = Math.max(maxX, room.x + room.width / 2)
      minZ = Math.min(minZ, room.z - room.depth / 2)
      maxZ = Math.max(maxZ, room.z + room.depth / 2)
      maxH = Math.max(maxH, room.height)
    })
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const span = Math.max(maxX - minX, maxZ - minZ, maxH) + 2
    const zoom = Math.max(8, Math.min(48, Math.min(size.w, size.h) / (span * 1.6)))
    setCam((current) => ({ ...current, cx, cz, zoom, panX: size.w / 2, panY: size.h * 0.58 }))
  }, [roomIds, size.w, size.h])

  const scene = useMemo(() => {
    const items = []
    rooms.forEach((room) => {
      const selected = room.id === selectedId
      const faces = boxFaces(
        [room.x - room.width / 2, 0, room.z - room.depth / 2],
        [room.width, room.height, room.depth],
        0,
        room.color || '#3b82f6',
        cam
      )
      faces.forEach((face) => items.push({
        ...face,
        roomId: room.id,
        stroke: selected ? '#22d3ee' : '#1e293b',
        opacity: face.id === 'top' ? 0.34 : 0.72,
      }))
      const label = projectPoint(room.x, room.height + 0.35, room.z, cam)
      items.push({
        kind: 'label',
        depth: label.depth - 5,
        x: label.x,
        y: label.y,
        text: `${room.label}  ${formatTemp(room.temp, unitSystem, 0)}`,
        roomId: room.id,
      })
      ;(room.equipment || []).forEach((eq) => {
        const alongX = eq.rotation !== 90
        const w = alongX ? eq.width : eq.depth
        const d = alongX ? eq.depth : eq.width
        const y0 = eq.category === 'evaporator' || eq.category === 'condenser'
          ? Math.max(0.2, room.height - eq.height - 0.2)
          : 0
        const color = eq.category === 'door' ? '#b45309' : eq.category === 'evaporator' ? '#38bdf8' : eq.category === 'rack' ? '#a78bfa' : '#fbbf24'
        const eqFaces = boxFaces(
          [room.x + eq.x - w / 2, 0, room.z + eq.z - d / 2],
          [w, eq.height, d],
          y0,
          color,
          cam,
          color
        )
        eqFaces.forEach((face) => items.push({
          ...face,
          roomId: room.id,
          eqId: eq.id,
          stroke: '#0f172a',
          opacity: 1,
          depth: face.depth - 0.35,
        }))
      })
    })
    return items.sort((a, b) => a.depth - b.depth)
  }, [rooms, cam, selectedId, unitSystem])

  return (
    <div
      ref={hostRef}
      data-testid="iso-canvas"
      onMouseDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, azimuth: cam.azimuth, panX: cam.panX, panY: cam.panY, shift: e.shiftKey || e.button === 1 }
      }}
      onMouseMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        if (drag.current.shift) setCam((current) => ({ ...current, panX: drag.current.panX + dx, panY: drag.current.panY + dy }))
        else setCam((current) => ({ ...current, azimuth: drag.current.azimuth + dx * 0.01 }))
      }}
      onMouseUp={() => { drag.current = null }}
      onMouseLeave={() => { drag.current = null }}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={(e) => {
        e.preventDefault()
        setCam((current) => ({ ...current, zoom: Math.max(6, Math.min(70, current.zoom * (e.deltaY > 0 ? 0.9 : 1.12))) }))
      }}
      style={{ position: 'relative', width: '100%', height: '100%', background: '#070b16', overflow: 'hidden', cursor: 'grab' }}
    >
      <svg style={{ width: '100%', height: '100%' }}>
        {scene.map((item, index) => {
          if (item.kind === 'label') {
            return (
              <text key={index} x={item.x} y={item.y} textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="700">
                {item.text}
              </text>
            )
          }
          const points = item.points.map((point) => `${point.x},${point.y}`).join(' ')
          return (
            <polygon
              key={index}
              points={points}
              fill={item.fill}
              fillOpacity={item.opacity}
              stroke={item.stroke}
              strokeWidth="1.4"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(item.eqId || item.roomId || null)
              }}
            />
          )
        })}
      </svg>
      <div style={{
        position: 'absolute', left: 10, bottom: 10, padding: '8px 10px',
        background: 'rgba(15,23,42,0.92)', border: '1px solid #334155', borderRadius: 8,
        fontSize: 11, color: '#94a3b8',
      }}>
        Vedä kiertää · Shift+vedä siirtää · rulla zoomaa
      </div>
    </div>
  )
}
