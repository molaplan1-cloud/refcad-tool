'use client'

import { useEffect, useRef, useState } from 'react'
import { formatLength } from '@/lib/units'
import { externalRect, internalDims, roomsOverlap, snap, snapDoorToWall } from '@/lib/geometry'

const HANDLE = 7

function worldFromEvent(e, host, view) {
  const rect = host.getBoundingClientRect()
  const px = e.clientX - rect.left
  const py = e.clientY - rect.top
  return {
    x: (px - view.offsetX) / view.scale,
    z: (py - view.offsetY) / view.scale,
    px,
    py,
  }
}

export default function PlanView({
  rooms,
  selectedId,
  tool,
  placing,
  unitSystem,
  gridSize,
  snapOn,
  onSelect,
  onPreview,
  onGestureStart,
  onGestureEnd,
  onCreateRect,
  onPlace,
  notice,
}) {
  const hostRef = useRef(null)
  const viewRef = useRef({ scale: 28, offsetX: 420, offsetY: 280 })
  const [view, setView] = useState(viewRef.current)
  const [draft, setDraft] = useState(null)
  const [cursor, setCursor] = useState(null)
  const gesture = useRef(null)
  const propsRef = useRef({})
  propsRef.current = {
    rooms, selectedId, tool, placing, gridSize, snapOn,
    onSelect, onPreview, onGestureStart, onGestureEnd, onCreateRect, onPlace,
  }

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const fit = () => {
      const rect = host.getBoundingClientRect()
      setView((v) => ({ ...v, offsetX: rect.width / 2, offsetY: rect.height / 2 }))
    }
    fit()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onWheel = (e) => {
      e.preventDefault()
      const current = viewRef.current
      const rect = host.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const worldX = (px - current.offsetX) / current.scale
      const worldZ = (py - current.offsetY) / current.scale
      const nextScale = Math.max(8, Math.min(140, current.scale * (e.deltaY > 0 ? 0.9 : 1.1)))
      const next = {
        scale: nextScale,
        offsetX: px - worldX * nextScale,
        offsetY: py - worldZ * nextScale,
      }
      viewRef.current = next
      setView(next)
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const move = (e) => {
      const host = hostRef.current
      const g = gesture.current
      if (!host || !g) return
      const current = viewRef.current
      const world = worldFromEvent(e, host, current)
      setCursor(world)
      if (g.kind === 'pan') {
        const next = {
          ...current,
          offsetX: g.offsetX + (e.clientX - g.sx),
          offsetY: g.offsetY + (e.clientY - g.sy),
        }
        viewRef.current = next
        setView(next)
        return
      }
      if (g.kind === 'draw') {
        const grid = propsRef.current.snapOn ? propsRef.current.gridSize : 0
        setDraft({ x1: g.x1, z1: g.z1, x2: snap(world.x, grid), z2: snap(world.z, grid) })
        return
      }
      const dist = Math.hypot(world.x - g.startX, world.z - g.startZ)
      if (!g.started) {
        if (dist < 0.04) return
        g.started = true
        propsRef.current.onGestureStart()
      }
      const grid = propsRef.current.snapOn ? propsRef.current.gridSize : 0
      const origRooms = g.orig
      if (g.kind === 'move') {
        const orig = origRooms.find((r) => r.id === g.id)
        const x = snap(orig.x + (world.x - g.startX), grid)
        const z = snap(orig.z + (world.z - g.startZ), grid)
        const dx = x - orig.x
        const dz = z - orig.z
        const ids = new Set([g.id])
        let grew = true
        while (grew) {
          grew = false
          for (const room of origRooms) {
            if (room.parentId && ids.has(room.parentId) && !ids.has(room.id)) {
              ids.add(room.id)
              grew = true
            }
          }
        }
        propsRef.current.onPreview(origRooms.map((room) => (
          ids.has(room.id) ? { ...room, x: room.x + dx, z: room.z + dz } : room
        )))
      } else if (g.kind === 'resize') {
        const orig = origRooms.find((r) => r.id === g.id)
        const x = snap(world.x, grid)
        const z = snap(world.z, grid)
        let left = orig.x - orig.width / 2
        let right = orig.x + orig.width / 2
        let top = orig.z - orig.depth / 2
        let bottom = orig.z + orig.depth / 2
        if (g.corner.includes('w')) left = x
        if (g.corner.includes('e')) right = x
        if (g.corner.includes('n')) top = z
        if (g.corner.includes('s')) bottom = z
        if (right - left < 1) {
          if (g.corner.includes('w')) left = right - 1
          else right = left + 1
        }
        if (bottom - top < 1) {
          if (g.corner.includes('n')) top = bottom - 1
          else bottom = top + 1
        }
        propsRef.current.onPreview(origRooms.map((room) => (
          room.id === orig.id
            ? { ...room, x: (left + right) / 2, z: (top + bottom) / 2, width: right - left, depth: bottom - top }
            : room
        )))
      } else if (g.kind === 'equip') {
        const room = origRooms.find((r) => r.id === g.roomId)
        const eq = room.equipment.find((item) => item.id === g.eqId)
        const localX = snap(eq.x + (world.x - g.startX), grid)
        const localZ = snap(eq.z + (world.z - g.startZ), grid)
        const moved = eq.category === 'door'
          ? { ...eq, ...snapDoorToWall(room, localX, localZ, eq.width) }
          : { ...eq, x: localX, z: localZ }
        propsRef.current.onPreview(origRooms.map((item) => {
          if (item.id !== room.id) return item
          return {
            ...item,
            equipment: item.equipment.map((piece) => (piece.id === eq.id ? moved : piece)),
          }
        }))
      }
    }
    const up = (e) => {
      const host = hostRef.current
      const g = gesture.current
      gesture.current = null
      if (!g) return
      if (g.kind === 'draw' && host) {
        const world = worldFromEvent(e, host, viewRef.current)
        const grid = propsRef.current.snapOn ? propsRef.current.gridSize : 0
        const x2 = snap(world.x, grid)
        const z2 = snap(world.z, grid)
        setDraft(null)
        propsRef.current.onCreateRect(g.x1, g.z1, x2, z2)
      } else if (g.started) {
        propsRef.current.onGestureEnd()
      }
      setDraft(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [])

  const toScreen = (x, z) => ({
    px: x * view.scale + view.offsetX,
    py: z * view.scale + view.offsetY,
  })

  const hitEquipment = (x, z) => {
    const ordered = [...rooms].sort((a, b) => a.width * a.depth - b.width * b.depth)
    for (const room of ordered) {
      for (const eq of room.equipment || []) {
        const wx = room.x + eq.x
        const wz = room.z + eq.z
        const hw = (eq.width || 0.5) / 2
        const hd = (eq.depth || 0.5) / 2
        if (Math.abs(x - wx) <= hw + 0.08 && Math.abs(z - wz) <= hd + 0.08) return { room, eq }
      }
    }
    return null
  }

  const hitRoom = (x, z) => {
    const hits = rooms.filter((room) => {
      const rect = externalRect(room)
      return x >= rect.left && x <= rect.right && z >= rect.top && z <= rect.bottom
    })
    hits.sort((a, b) => a.width * a.depth - b.width * b.depth)
    return hits[0] || null
  }

  const onMouseDown = (e) => {
    if (e.button === 2 || e.button === 1) {
      gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, offsetX: view.offsetX, offsetY: view.offsetY }
      return
    }
    if (e.button !== 0) return
    const host = hostRef.current
    const world = worldFromEvent(e, host, view)
    const handle = e.target?.dataset?.handle
    const handleRoom = e.target?.dataset?.room
    const p = propsRef.current
    if (p.tool === 'draw' || p.tool === 'partition') {
      const grid = p.snapOn ? p.gridSize : 0
      const x1 = snap(world.x, grid)
      const z1 = snap(world.z, grid)
      gesture.current = { kind: 'draw', x1, z1, startX: x1, startZ: z1 }
      setDraft({ x1, z1, x2: x1, z2: z1 })
      return
    }
    if (p.placing) {
      const room = hitRoom(world.x, world.z)
      if (room) p.onPlace(room.id, world.x, world.z)
      return
    }
    if (handle && handleRoom) {
      gesture.current = {
        kind: 'resize',
        id: handleRoom,
        corner: handle,
        startX: world.x,
        startZ: world.z,
        orig: p.rooms.map((room) => ({ ...room, equipment: [...(room.equipment || [])] })),
        started: false,
      }
      p.onSelect(handleRoom)
      return
    }
    const eqHit = hitEquipment(world.x, world.z)
    if (eqHit) {
      p.onSelect(eqHit.eq.id)
      gesture.current = {
        kind: 'equip',
        roomId: eqHit.room.id,
        eqId: eqHit.eq.id,
        startX: world.x,
        startZ: world.z,
        orig: p.rooms.map((room) => ({ ...room, equipment: room.equipment.map((item) => ({ ...item })) })),
        started: false,
      }
      return
    }
    const room = hitRoom(world.x, world.z)
    if (room) {
      p.onSelect(room.id)
      gesture.current = {
        kind: 'move',
        id: room.id,
        startX: world.x,
        startZ: world.z,
        orig: p.rooms.map((item) => ({ ...item, equipment: [...(item.equipment || [])] })),
        started: false,
      }
      return
    }
    p.onSelect(null)
    gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, offsetX: view.offsetX, offsetY: view.offsetY }
  }

  const onMouseMove = (e) => {
    const host = hostRef.current
    if (!host) return
    setCursor(worldFromEvent(e, host, viewRef.current))
  }

  const roomKey = rooms.map((room) => room.id).join('|')
  const fit = () => {
    const host = hostRef.current
    const list = propsRef.current.rooms
    if (!host || !list.length) return
    let minX = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxZ = -Infinity
    list.forEach((room) => {
      const rect = externalRect(room)
      minX = Math.min(minX, rect.left)
      maxX = Math.max(maxX, rect.right)
      minZ = Math.min(minZ, rect.top)
      maxZ = Math.max(maxZ, rect.bottom)
    })
    const pad = 2
    minX -= pad
    minZ -= pad
    maxX += pad
    maxZ += pad
    const rect = host.getBoundingClientRect()
    const scale = Math.max(8, Math.min(80, Math.min(rect.width / (maxX - minX), (rect.height - 36) / (maxZ - minZ))))
    const next = {
      scale,
      offsetX: rect.width / 2 - ((minX + maxX) / 2) * scale,
      offsetY: (rect.height - 36) / 2 - ((minZ + maxZ) / 2) * scale,
    }
    viewRef.current = next
    setView(next)
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => fit())
    return () => cancelAnimationFrame(frame)
  }, [roomKey])

  const visible = () => {
    const host = hostRef.current
    const width = host?.clientWidth || 800
    const height = host?.clientHeight || 600
    return {
      x0: -view.offsetX / view.scale,
      z0: -view.offsetY / view.scale,
      x1: (width - view.offsetX) / view.scale,
      z1: (height - view.offsetY) / view.scale,
    }
  }
  const bounds = visible()
  const gridLines = []
  const startX = Math.floor(bounds.x0)
  const endX = Math.ceil(bounds.x1)
  const startZ = Math.floor(bounds.z0)
  const endZ = Math.ceil(bounds.z1)
  for (let x = startX; x <= endX; x += 1) {
    const p1 = toScreen(x, bounds.z0)
    const p2 = toScreen(x, bounds.z1)
    gridLines.push({ x1: p1.px, y1: p1.py, x2: p2.px, y2: p2.py, major: true })
  }
  for (let z = startZ; z <= endZ; z += 1) {
    const p1 = toScreen(bounds.x0, z)
    const p2 = toScreen(bounds.x1, z)
    gridLines.push({ x1: p1.px, y1: p1.py, x2: p2.px, y2: p2.py, major: true })
  }

  const ordered = [...rooms].sort((a, b) => b.width * b.depth - a.width * a.depth)
  const overlapIds = new Set()
  rooms.forEach((room) => {
    rooms.forEach((other) => {
      if (roomsOverlap(room, other)) {
        overlapIds.add(room.id)
        overlapIds.add(other.id)
      }
    })
  })

  const cursorLabel = tool === 'draw'
    ? 'Vedä suorakulmio uudeksi huoneeksi'
    : tool === 'partition'
      ? 'Vedä väliseinä olemassa olevan huoneen sisään'
      : placing
        ? `Sijoita: ${placing.name}. Esc peruuttaa.`
        : 'Vedä huonetta tai kahvaa. Tyhjä alue siirtää näkymää.'

  return (
    <div
      ref={hostRef}
      data-testid="plan-canvas"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#070b16',
        cursor: tool === 'draw' || tool === 'partition' ? 'crosshair' : placing ? 'copy' : 'default',
        userSelect: 'none',
      }}
    >
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {gridLines.map((seg, i) => (
          <line key={i} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke="#16324f" strokeWidth={seg.major ? 0.6 : 0.3} />
        ))}
        {ordered.map((room) => {
          const rect = externalRect(room)
          const tl = toScreen(rect.left, rect.top)
          const w = room.width * view.scale
          const d = room.depth * view.scale
          const selected = selectedId === room.id
          const dims = internalDims(room)
          const wallPx = Math.max(2, room.wallThickness * view.scale)
          const overlap = overlapIds.has(room.id)
          return (
            <g key={room.id}>
              <rect
                x={tl.px}
                y={tl.py}
                width={w}
                height={d}
                fill={room.color}
                fillOpacity={selected ? 0.22 : 0.1}
                stroke={overlap ? '#ef4444' : selected ? '#22d3ee' : '#94a3b8'}
                strokeWidth={selected ? 2.4 : 1.4}
              />
              <rect
                x={tl.px + wallPx}
                y={tl.py + wallPx}
                width={Math.max(0, w - wallPx * 2)}
                height={Math.max(0, d - wallPx * 2)}
                fill="none"
                stroke={room.color}
                strokeOpacity="0.85"
                strokeWidth="1.2"
              />
              <text x={tl.px + w / 2} y={tl.py + d / 2 - 8} textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="700">
                {room.label}
              </text>
              <text x={tl.px + w / 2} y={tl.py + d / 2 + 8} textAnchor="middle" fill="#cbd5e1" fontSize="11">
                {room.name} · {room.temp}°C
              </text>
              <text x={tl.px + w / 2} y={tl.py + d / 2 + 24} textAnchor="middle" fill="#67e8f9" fontSize="10">
                sisus {formatLength(dims.width, unitSystem)} × {formatLength(dims.depth, unitSystem)}
              </text>
              <line x1={tl.px} y1={tl.py - 16} x2={tl.px + w} y2={tl.py - 16} stroke="#fbbf24" strokeWidth="1" />
              <text x={tl.px + w / 2} y={tl.py - 20} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700">
                {formatLength(room.width, unitSystem)}
              </text>
              <text x={tl.px - 8} y={tl.py + d / 2} textAnchor="end" fill="#fbbf24" fontSize="11" fontWeight="700">
                {formatLength(room.depth, unitSystem)}
              </text>
              {(room.equipment || []).map((eq) => {
                const p = toScreen(room.x + eq.x, room.z + eq.z)
                const ew = eq.width * view.scale
                const ed = eq.depth * view.scale
                const selectedEq = selectedId === eq.id
                if (eq.category === 'door') {
                  const horizontal = eq.rotation !== 90
                  return (
                    <g key={eq.id}>
                      <rect
                        data-eq={eq.id}
                        x={p.px - (horizontal ? ew / 2 : 4)}
                        y={p.py - (horizontal ? 4 : ed / 2)}
                        width={horizontal ? ew : 8}
                        height={horizontal ? 8 : ed}
                        fill="#d6b48a"
                        stroke={selectedEq ? '#22d3ee' : '#78350f'}
                        strokeWidth={selectedEq ? 2 : 1}
                      />
                    </g>
                  )
                }
                const fill = eq.category === 'evaporator' ? '#7dd3fc' : eq.category === 'condenser' ? '#86efac' : eq.category === 'rack' ? '#c4b5fd' : '#fcd34d'
                return (
                  <g key={eq.id}>
                    <rect
                      data-eq={eq.id}
                      x={p.px - ew / 2}
                      y={p.py - ed / 2}
                      width={ew}
                      height={ed}
                      rx="2"
                      fill={fill}
                      stroke={selectedEq ? '#22d3ee' : '#0f172a'}
                      strokeWidth={selectedEq ? 2 : 1}
                    />
                    <text x={p.px} y={p.py + 3} textAnchor="middle" fontSize="9" fill="#0f172a">
                      {eq.category === 'evaporator' ? `${eq.capacityKw} kW` : eq.category === 'rack' ? 'HYLLY' : eq.category === 'condenser' ? 'LAUH' : 'KONE'}
                    </text>
                  </g>
                )
              })}
              {selected && tool === 'select' && !placing && ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((corner) => {
                const cx = corner.includes('w') ? tl.px : corner.includes('e') ? tl.px + w : tl.px + w / 2
                const cy = corner.includes('n') ? tl.py : corner.includes('s') ? tl.py + d : tl.py + d / 2
                return (
                  <rect
                    key={corner}
                    data-handle={corner}
                    data-room={room.id}
                    x={cx - HANDLE / 2}
                    y={cy - HANDLE / 2}
                    width={HANDLE}
                    height={HANDLE}
                    fill="#22d3ee"
                    stroke="#fff"
                    strokeWidth="1"
                  />
                )
              })}
            </g>
          )
        })}
        {draft && (
          <rect
            x={toScreen(Math.min(draft.x1, draft.x2), Math.min(draft.z1, draft.z2)).px}
            y={toScreen(Math.min(draft.x1, draft.x2), Math.min(draft.z1, draft.z2)).py}
            width={Math.abs(draft.x2 - draft.x1) * view.scale}
            height={Math.abs(draft.z2 - draft.z1) * view.scale}
            fill="#22d3ee"
            fillOpacity="0.15"
            stroke="#22d3ee"
            strokeDasharray="5 3"
          />
        )}
      </svg>

      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <ZoomButton onClick={() => setView((v) => ({ ...v, scale: Math.min(140, v.scale * 1.15) }))}>+</ZoomButton>
        <ZoomButton onClick={() => setView((v) => ({ ...v, scale: Math.max(8, v.scale * 0.87) }))}>−</ZoomButton>
        <ZoomButton onClick={fit}>⌂</ZoomButton>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 32,
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 12px',
        background: 'rgba(15,23,42,0.94)', borderTop: '1px solid rgba(255,255,255,0.08)',
        fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace, monospace',
      }}>
        <span>X {cursor ? cursor.x.toFixed(2) : '—'} m</span>
        <span>Y {cursor ? cursor.z.toFixed(2) : '—'} m</span>
        <span>{Math.round(view.scale / 28 * 100)}%</span>
        <span style={{ color: snapOn ? '#4ade80' : '#94a3b8' }}>{snapOn ? `ruutu ${gridSize} m` : 'ruutu pois'}</span>
        <span style={{ color: '#e2e8f0' }}>{notice || cursorLabel}</span>
      </div>
    </div>
  )
}

function ZoomButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        width: 32, height: 32, borderRadius: 6, border: '1px solid #334155',
        background: 'rgba(15,23,42,0.92)', color: '#f8fafc', fontSize: 16, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
