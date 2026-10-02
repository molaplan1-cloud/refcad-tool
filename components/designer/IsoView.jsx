'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatTemp } from '@/lib/units'

function project(x, y, z, cam) {
  const cosA = Math.cos(cam.azimuth)
  const sinA = Math.sin(cam.azimuth)
  const cosE = Math.cos(cam.elevation)
  const sinE = Math.sin(cam.elevation)
  const dx = x - cam.cx
  const dy = y - cam.cy
  const dz = z - cam.cz
  const xr = dx * cosA + dz * sinA
  const zr = -dx * sinA + dz * cosA
  const yr = dy * cosE - zr * sinE
  const depth = dy * sinE + zr * cosE
  return { x: xr * cam.zoom + cam.panX, y: -yr * cam.zoom + cam.panY, depth }
}

function face(points, fill, stroke, opacity) {
  return { points, fill, stroke, opacity, depth: points.reduce((s, p) => s + p.depth, 0) / points.length }
}

export default function IsoView({ rooms, selectedId, onSelect, unitSystem }) {
  const [cam, setCam] = useState({
    azimuth: 0.7,
    elevation: 0.55,
    zoom: 28,
    panX: 360,
    panY: 250,
    cx: 0,
    cy: 1.5,
    cz: 0,
  })
  const drag = useRef(null)
  const hostRef = useRef(null)

  const roomKey = rooms.map((room) => room.id).join('|')
  useEffect(() => {
    if (!rooms.length) return
    const cx = rooms.reduce((sum, room) => sum + room.x, 0) / rooms.length
    const cz = rooms.reduce((sum, room) => sum + room.z, 0) / rooms.length
    const rect = hostRef.current?.getBoundingClientRect()
    setCam((current) => ({
      ...current,
      cx,
      cz,
      cy: 1.6,
      panX: (rect?.width || 700) / 2,
      panY: (rect?.height || 520) / 2,
    }))
  }, [roomKey])

  const faces = useMemo(() => {
    const list = []
    rooms.forEach((room) => {
      const L = room.width / 2
      const D = room.depth / 2
      const H = room.height
      const p = (x, y, z) => project(room.x + x, y, room.z + z, cam)
      const selected = selectedId === room.id
      const stroke = selected ? '#22d3ee' : '#475569'
      const floor = [p(-L, 0, -D), p(L, 0, -D), p(L, 0, D), p(-L, 0, D)]
      list.push(face(floor, room.color || '#3b82f6', stroke, 0.45))
      list.push(face([p(-L, 0, -D), p(L, 0, -D), p(L, H, -D), p(-L, H, -D)], '#cbd5e1', stroke, 0.55))
      list.push(face([p(L, 0, -D), p(L, 0, D), p(L, H, D), p(L, H, -D)], '#94a3b8', stroke, 0.7))
      list.push(face([p(-L, 0, D), p(L, 0, D), p(L, H, D), p(-L, H, D)], '#e2e8f0', stroke, 0.78))
      list.push(face([p(-L, 0, -D), p(-L, 0, D), p(-L, H, D), p(-L, H, -D)], '#94a3b8', stroke, 0.6))
      const roof = [p(-L, H, -D), p(L, H, -D), p(L, H, D), p(-L, H, D)]
      list.push(face(roof, '#f8fafc', stroke, 0.18))
      const label = p(0, H + 0.25, 0)
      list.push({
        kind: 'label',
        depth: label.depth,
        x: label.x,
        y: label.y,
        text: `${room.label}  ${formatTemp(room.temp, unitSystem, 0)}`,
        roomId: room.id,
      })
      ;(room.equipment || []).forEach((eq) => {
        const alongX = eq.rotation !== 90
        const hw = (alongX ? eq.width : eq.depth) / 2
        const hd = (alongX ? eq.depth : eq.width) / 2
        const y0 = eq.category === 'evaporator' || eq.category === 'condenser' ? Math.max(0, H - eq.height - 0.15) : 0
        const hh = eq.category === 'door' ? eq.height : eq.height
        const q = (x, y, z) => project(room.x + eq.x + x, y, room.z + eq.z + z, cam)
        const color = eq.category === 'door' ? '#b45309' : eq.category === 'evaporator' ? '#38bdf8' : eq.category === 'rack' ? '#a78bfa' : '#fbbf24'
        const box = [
          [q(-hw, y0, -hd), q(hw, y0, -hd), q(hw, y0 + hh, -hd), q(-hw, y0 + hh, -hd)],
          [q(hw, y0, -hd), q(hw, y0, hd), q(hw, y0 + hh, hd), q(hw, y0 + hh, -hd)],
          [q(-hw, y0, hd), q(hw, y0, hd), q(hw, y0 + hh, hd), q(-hw, y0 + hh, hd)],
          [q(-hw, y0 + hh, -hd), q(hw, y0 + hh, -hd), q(hw, y0 + hh, hd), q(-hw, y0 + hh, hd)],
        ]
        box.forEach((pts) => list.push({ ...face(pts, color, '#0f172a', 0.95), roomId: room.id, eqId: eq.id }))
      })
    })
    return list.sort((a, b) => b.depth - a.depth)
  }, [rooms, cam, selectedId, unitSystem])

  const onMouseDown = (e) => {
    drag.current = {
      kind: e.shiftKey || e.button === 1 ? 'pan' : 'rotate',
      sx: e.clientX,
      sy: e.clientY,
      cam: { ...cam },
    }
  }
  const onMouseMove = (e) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.sx
    const dy = e.clientY - drag.current.sy
    if (drag.current.kind === 'pan') {
      setCam({ ...drag.current.cam, panX: drag.current.cam.panX + dx, panY: drag.current.cam.panY + dy })
    } else {
      setCam({
        ...drag.current.cam,
        azimuth: drag.current.cam.azimuth + dx * 0.01,
        elevation: Math.max(0.15, Math.min(1.2, drag.current.cam.elevation + dy * 0.008)),
      })
    }
  }
  const onMouseUp = () => { drag.current = null }

  const fit = () => {
    if (!rooms.length) return
    const cx = rooms.reduce((s, r) => s + r.x, 0) / rooms.length
    const cz = rooms.reduce((s, r) => s + r.z, 0) / rooms.length
    const host = hostRef.current
    const rect = host?.getBoundingClientRect()
    setCam((c) => ({
      ...c,
      cx,
      cz,
      cy: 1.6,
      panX: (rect?.width || 700) / 2,
      panY: (rect?.height || 500) / 2,
      zoom: 26,
      azimuth: 0.7,
      elevation: 0.55,
    }))
  }

  return (
    <div
      ref={hostRef}
      data-testid="iso-canvas"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={(e) => {
        e.preventDefault()
        setCam((c) => ({ ...c, zoom: Math.max(8, Math.min(90, c.zoom * (e.deltaY > 0 ? 0.9 : 1.1))) }))
      }}
      style={{ position: 'relative', width: '100%', height: '100%', background: '#070b16', overflow: 'hidden', cursor: 'grab' }}
    >
      <svg style={{ width: '100%', height: '100%' }}>
        {faces.map((item, i) => {
          if (item.kind === 'label') {
            return (
              <text key={i} x={item.x} y={item.y} textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="700">
                {item.text}
              </text>
            )
          }
          const pts = item.points.map((p) => `${p.x},${p.y}`).join(' ')
          return (
            <polygon
              key={i}
              points={pts}
              fill={item.fill}
              fillOpacity={item.opacity}
              stroke={item.stroke}
              strokeWidth="1"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(item.eqId || item.roomId || null)
              }}
            />
          )
        })}
      </svg>
      <div style={{ position: 'absolute', top: 10, right: 10 }}>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={fit}
          style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid #334155',
            background: 'rgba(15,23,42,0.92)', color: '#e2e8f0', fontSize: 11, cursor: 'pointer',
          }}
        >
          Sovita 3D
        </button>
      </div>
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
