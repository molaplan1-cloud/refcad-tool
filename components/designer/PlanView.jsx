'use client'

import { useEffect, useRef, useState } from 'react'
import { formatLength, formatTemp } from '@/lib/units'
import { descendantIds, internalDims, snapDoorToWall } from '@/lib/geometry'
import {
  applyBox,
  applyOutline,
  bboxOf,
  clampGroupTranslation,
  clampResizeBox,
  cleanOrthogonal,
  doorSymbol,
  edgesOf,
  fitView,
  footprintInside,
  gridSpec,
  insetOrthogonal,
  isCustomOutline,
  outlineOf,
  pointInPolygon,
  polygonArea,
  polygonMetrics,
  scaleBarMetres,
  selfIntersects,
  snapLabel,
  snapWorld,
  translateOutline,
} from '@/lib/cadDraw'

const PAPER = '#f4f1ea'
const INK = '#292524'
const TEAL = '#0f766e'

function metricsOf(room) {
  return isCustomOutline(room) ? polygonMetrics(room).dims : internalDims(room)
}

function pathOf(points) {
  if (!points?.length) return ''
  return `${points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.z}`).join(' ')} Z`
}

function vertexAverage(points) {
  const n = points.length || 1
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / n,
    z: points.reduce((sum, point) => sum + point.z, 0) / n,
  }
}

function labelAnchor(room, inner, scale, line1, line2) {
  const box = bboxOf(inner)
  const center = vertexAverage(inner)
  const px = Math.max(line1.length, line2.length) * 7.1 + 22
  const chipW = Math.min(box.width * 0.78, px / Math.max(scale, 1))
  const chipH = 34 / Math.max(scale, 1)
  const candidates = [
    center,
    { x: center.x, z: box.top + box.depth * 0.22 },
    { x: center.x, z: box.bottom - box.depth * 0.22 },
    { x: box.left + box.width * 0.24, z: center.z },
    { x: box.right - box.width * 0.24, z: center.z },
    { x: box.left + box.width * 0.26, z: box.top + box.depth * 0.26 },
    { x: box.right - box.width * 0.26, z: box.bottom - box.depth * 0.26 },
  ]
  const blocks = (room.equipment || []).map((eq) => {
    const alongX = eq.rotation !== 90
    const halfW = (alongX ? eq.width : eq.depth) / 2 + 0.28
    const halfD = (alongX ? eq.depth : eq.width) / 2 + 0.28
    return { x: room.x + eq.x, z: room.z + eq.z, halfW, halfD }
  })
  const clear = (point) => {
    const corners = [
      [point.x - chipW / 2, point.z - chipH / 2],
      [point.x + chipW / 2, point.z - chipH / 2],
      [point.x - chipW / 2, point.z + chipH / 2],
      [point.x + chipW / 2, point.z + chipH / 2],
    ]
    if (corners.some(([x, z]) => !pointInPolygon(x, z, inner))) return false
    return !blocks.some((block) => (
      Math.abs(point.x - block.x) < chipW / 2 + block.halfW
      && Math.abs(point.z - block.z) < chipH / 2 + block.halfD
    ))
  }
  const point = candidates.find(clear) || center
  return { ...point, w: chipW, h: chipH }
}

function hitRoom(rooms, x, z) {
  const hits = rooms.filter((room) => pointInPolygon(x, z, outlineOf(room)))
  hits.sort((a, b) => polygonArea(outlineOf(a)) - polygonArea(outlineOf(b)))
  return hits[0] || null
}

function hitEquipment(rooms, x, z) {
  const ordered = [...rooms].sort((a, b) => a.width * a.depth - b.width * b.depth)
  for (const room of ordered) {
    for (const eq of room.equipment || []) {
      const wx = room.x + eq.x
      const wz = room.z + eq.z
      const verticalDoor = eq.category === 'door' && (
        eq.wall === 'e' || eq.wall === 'w' || (eq.rotation === 90 && eq.wall !== 'n' && eq.wall !== 's')
      )
      const alongX = eq.category === 'door' ? !verticalDoor : eq.rotation !== 90
      const hw = (alongX ? eq.width : eq.depth) / 2
      const hd = (alongX ? eq.depth : eq.width) / 2
      if (Math.abs(x - wx) <= hw + 0.08 && Math.abs(z - wz) <= hd + 0.08) return { room, eq }
    }
  }
  return null
}

function moveEdge(points, index, x, z) {
  const a = points[index]
  const b = points[(index + 1) % points.length]
  const horizontal = Math.abs(a.z - b.z) <= Math.abs(a.x - b.x)
  const next = points.map((point) => ({ ...point }))
  const end = (index + 1) % points.length
  if (horizontal) {
    next[index] = { ...next[index], z }
    next[end] = { ...next[end], z }
  } else {
    next[index] = { ...next[index], x }
    next[end] = { ...next[end], x }
  }
  return cleanOrthogonal(next)
}

function moveVertex(points, index, x, z) {
  const count = points.length
  const prevI = (index - 1 + count) % count
  const nextI = (index + 1) % count
  const prev = points[prevI]
  const current = points[index]
  const nextP = points[nextI]
  const prevHoriz = Math.abs(prev.z - current.z) <= Math.abs(prev.x - current.x)
  const nextHoriz = Math.abs(nextP.z - current.z) <= Math.abs(nextP.x - current.x)
  const out = points.map((point) => ({ ...point }))
  out[index] = { x, z }
  out[prevI] = prevHoriz ? { ...out[prevI], z } : { ...out[prevI], x }
  out[nextI] = nextHoriz ? { ...out[nextI], z } : { ...out[nextI], x }
  return cleanOrthogonal(out)
}

function DimLine({ x1, z1, x2, z2, scale, text }) {
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.hypot(dx, dz) || 1
  const tick = 5 / scale
  const mx = (x1 + x2) / 2
  const mz = (z1 + z2) / 2
  return (
    <g>
      <line x1={x1} y1={z1} x2={x2} y2={z2} stroke="#44403c" strokeWidth={0.9 / scale} />
      <line x1={x1 - (dz / len) * tick} y1={z1 + (dx / len) * tick} x2={x1 + (dz / len) * tick} y2={z1 - (dx / len) * tick} stroke="#44403c" strokeWidth={0.9 / scale} />
      <line x1={x2 - (dz / len) * tick} y1={z2 + (dx / len) * tick} x2={x2 + (dz / len) * tick} y2={z2 - (dx / len) * tick} stroke="#44403c" strokeWidth={0.9 / scale} />
      <g>
        <rect x={mx - (text.length * 3.1) / scale} y={mz - 6 / scale} width={(text.length * 6.2) / scale} height={12 / scale} fill={PAPER} opacity="0.92" />
        <text x={mx} y={mz} textAnchor="middle" dominantBaseline="middle" fill={INK} fontSize={11 / scale} fontFamily="ui-sans-serif, sans-serif">
          {text}
        </text>
      </g>
    </g>
  )
}

function edgeDimension(edge, points, scale, unitSystem) {
  const len = edge.len || 1
  let nx = -(edge.z2 - edge.z1) / len
  let nz = (edge.x2 - edge.x1) / len
  const mx = (edge.x1 + edge.x2) / 2
  const mz = (edge.z1 + edge.z2) / 2
  if (pointInPolygon(mx + nx * 0.05, mz + nz * 0.05, points)) {
    nx = -nx
    nz = -nz
  }
  const off = 0.42
  return (
    <DimLine
      x1={edge.x1 + nx * off}
      z1={edge.z1 + nz * off}
      x2={edge.x2 + nx * off}
      z2={edge.z2 + nz * off}
      scale={scale}
      text={formatLength(len, unitSystem)}
    />
  )
}

export default function PlanView({
  rooms,
  selectedIds = [],
  tool,
  placing,
  unitSystem,
  gridSize,
  snapOn,
  snapFlags,
  fitToken = 0,
  onSelect,
  onPreview,
  onGestureStart,
  onGestureEnd,
  onCreateRect,
  onCreatePolygon,
  onPlace,
  notice,
}) {
  const hostRef = useRef(null)
  const viewRef = useRef({ scale: 36, offsetX: 480, offsetY: 320 })
  const [view, setView] = useState(viewRef.current)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [cursor, setCursor] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [poly, setPoly] = useState([])
  const [polyHover, setPolyHover] = useState(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const gesture = useRef(null)
  const autoFit = useRef(true)
  const typed = useRef({ field: 'w', w: '', d: '' })
  const polyTyped = useRef('')
  const polyRef = useRef([])
  const propsRef = useRef({})
  polyRef.current = poly
  propsRef.current = {
    rooms, selectedIds, tool, placing, gridSize, snapOn, snapFlags,
    onSelect, onPreview, onGestureStart, onGestureEnd, onCreateRect, onCreatePolygon, onPlace,
  }

  const setCamera = (next) => {
    viewRef.current = next
    setView(next)
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const measure = () => {
      const next = { w: host.clientWidth, h: host.clientHeight }
      setSize(next)
      if (autoFit.current && next.w > 40 && next.h > 40) {
        setCamera(fitView(propsRef.current.rooms, next.w, next.h))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    autoFit.current = true
    const frame = requestAnimationFrame(() => {
      const host = hostRef.current
      if (!host) return
      setCamera(fitView(propsRef.current.rooms, host.clientWidth, host.clientHeight))
    })
    return () => cancelAnimationFrame(frame)
  }, [fitToken])

  const roomCount = rooms.length
  const seenRooms = useRef(0)
  useEffect(() => {
    if (seenRooms.current === 0 && roomCount > 0) {
      autoFit.current = true
      const frame = requestAnimationFrame(() => {
        const host = hostRef.current
        if (host) setCamera(fitView(propsRef.current.rooms, host.clientWidth, host.clientHeight))
      })
      seenRooms.current = roomCount
      return () => cancelAnimationFrame(frame)
    }
    seenRooms.current = roomCount
    return undefined
  }, [roomCount])

  useEffect(() => {
    if (tool !== 'polygon') {
      setPoly([])
      polyTyped.current = ''
    }
  }, [tool])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      autoFit.current = false
      const current = viewRef.current
      const rect = host.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const pinch = event.ctrlKey || event.metaKey
      const trackpad = !pinch && event.deltaMode === 0 && Math.abs(event.deltaY) < 40 && Math.abs(event.deltaX) < 40
      if ((trackpad && !event.shiftKey) || event.shiftKey) {
        const next = {
          ...current,
          offsetX: current.offsetX - (event.shiftKey ? event.deltaY : event.deltaX),
          offsetY: current.offsetY - (event.shiftKey ? 0 : event.deltaY),
        }
        setCamera(next)
        return
      }
      const worldX = (px - current.offsetX) / current.scale
      const worldZ = (py - current.offsetY) / current.scale
      const factor = Math.exp(-event.deltaY * (pinch ? 0.01 : 0.0016))
      const scale = Math.max(6, Math.min(220, current.scale * factor))
      setCamera({
        scale,
        offsetX: px - worldX * scale,
        offsetY: py - worldZ * scale,
      })
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (event.code === 'Space') {
        event.preventDefault()
        setSpaceDown(event.type === 'keydown')
        return
      }
      if (event.type !== 'keydown') return
      const drawing = gesture.current?.kind === 'draw'
      const points = polyRef.current
      if (event.key === 'Escape' && (drawing || points.length)) {
        gesture.current = null
        typed.current = { field: 'w', w: '', d: '' }
        polyTyped.current = ''
        setDraft(null)
        setPoly([])
        event.stopPropagation()
        return
      }
      if (event.key === 'Backspace' && points.length && !drawing) {
        event.preventDefault()
        event.stopPropagation()
        if (polyTyped.current) polyTyped.current = polyTyped.current.slice(0, -1)
        else setPoly(points.slice(0, -1))
        return
      }
      if (drawing && event.key === 'Tab') {
        event.preventDefault()
        typed.current.field = typed.current.field === 'w' ? 'd' : 'w'
        return
      }
      if ((drawing || points.length) && /^[0-9.,]$/.test(event.key)) {
        event.preventDefault()
        event.stopPropagation()
        if (drawing) {
          const field = typed.current.field
          typed.current[field] = `${typed.current[field]}${event.key}`.slice(0, 8)
        } else {
          polyTyped.current = `${polyTyped.current}${event.key}`.slice(0, 8)
        }
        return
      }
      if (event.key === 'Enter' && drawing) {
        event.preventDefault()
        event.stopPropagation()
        const g = gesture.current
        gesture.current = null
        setDraft(null)
        propsRef.current.onCreateRect(g.x1, g.z1, g.x2, g.z2)
        typed.current = { field: 'w', w: '', d: '' }
        return
      }
      if (event.key === 'Enter' && points.length) {
        event.preventDefault()
        event.stopPropagation()
        if (polyTyped.current && points.length) {
          const last = points[points.length - 1]
          const hover = snapWorld(last.x + 1, last.z, {
            origin: last,
            scale: viewRef.current.scale,
            grid: propsRef.current.snapOn ? propsRef.current.gridSize : 0,
            rooms: propsRef.current.rooms,
            flags: propsRef.current.snapFlags,
          })
          const length = parseFloat(polyTyped.current.replace(',', '.'))
          if (Number.isFinite(length) && length >= 0.3) {
            const dx = hover.x - last.x
            const dz = hover.z - last.z
            const mag = Math.hypot(dx, dz) || 1
            setPoly([...points, { x: last.x + (dx / mag) * length, z: last.z + (dz / mag) * length }])
          }
          polyTyped.current = ''
          return
        }
        if (points.length >= 4) {
          propsRef.current.onCreatePolygon(points)
          setPoly([])
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKey, true)
    }
  }, [])

  useEffect(() => {
    const move = (event) => {
      const host = hostRef.current
      if (!host) return
      const current = viewRef.current
      const rect = host.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const world = { x: (px - current.offsetX) / current.scale, z: (py - current.offsetY) / current.scale, px, py }
      const p = propsRef.current
      const g = gesture.current
      if (polyRef.current.length && p.tool === 'polygon') {
        const last = polyRef.current[polyRef.current.length - 1]
        let hover = snapWorld(world.x, world.z, {
          origin: last,
          scale: current.scale,
          grid: p.snapOn ? p.gridSize : 0,
          rooms: p.rooms,
          flags: { ...p.snapFlags, ortho: true },
        })
        const typedLength = parseFloat(polyTyped.current.replace(',', '.'))
        if (Number.isFinite(typedLength) && typedLength >= 0.3) {
          const dx = hover.x - last.x
          const dz = hover.z - last.z
          const mag = Math.hypot(dx, dz) || 1
          hover = { ...hover, x: last.x + (dx / mag) * typedLength, z: last.z + (dz / mag) * typedLength, kind: 'ortho' }
        }
        setPolyHover(hover)
      }
      if (!g) {
        setCursor({ ...world, kind: null })
        const eq = hitEquipment(p.rooms, world.x, world.z)
        setHoverId(eq?.room?.id || hitRoom(p.rooms, world.x, world.z)?.id || null)
        return
      }
      if (g.kind === 'pan') {
        autoFit.current = false
        setCamera({
          ...current,
          offsetX: g.offsetX + (event.clientX - g.sx),
          offsetY: g.offsetY + (event.clientY - g.sy),
        })
        return
      }
      if (g.kind === 'marquee') {
        setDraft({ kind: 'marquee', x1: g.x1, z1: g.z1, x2: world.x, z2: world.z })
        return
      }
      const snapped = snapWorld(world.x, world.z, {
        origin: g.kind === 'draw' ? { x: g.x1, z: g.z1 } : null,
        scale: current.scale,
        grid: p.snapOn ? p.gridSize : 0,
        rooms: p.rooms,
        flags: g.kind === 'draw' ? { ...p.snapFlags, ortho: false } : { ...p.snapFlags, ortho: false },
        ignoreIds: g.ignoreIds,
      })
      setCursor({ ...world, x: snapped.x, z: snapped.z, kind: snapped.kind })
      if (g.kind === 'draw') {
        let x2 = snapped.x
        let z2 = snapped.z
        const widthText = parseFloat(typed.current.w.replace(',', '.'))
        const depthText = parseFloat(typed.current.d.replace(',', '.'))
        if (Number.isFinite(widthText) && widthText >= 0.3) {
          const sign = snapped.x - g.x1 >= 0 ? 1 : -1
          x2 = g.x1 + sign * widthText
        }
        if (Number.isFinite(depthText) && depthText >= 0.3) {
          const sign = snapped.z - g.z1 >= 0 ? 1 : -1
          z2 = g.z1 + sign * depthText
        }
        g.x2 = x2
        g.z2 = z2
        setDraft({ kind: 'rect', x1: g.x1, z1: g.z1, x2, z2 })
        return
      }
      if (!g.started) {
        g.started = true
        p.onGestureStart()
      }
      if (g.kind === 'move') {
        const primary = g.orig.find((room) => room.id === g.id)
        const anchorX = primary.x - primary.width / 2
        const anchorZ = primary.z - primary.depth / 2
        const anchor = snapWorld(anchorX + (world.x - g.startX), anchorZ + (world.z - g.startZ), {
          scale: current.scale,
          grid: p.snapOn ? p.gridSize : 0,
          rooms: p.rooms,
          flags: { ...p.snapFlags, ortho: false },
          ignoreIds: g.ignoreIds,
        })
        const limited = clampGroupTranslation(g.orig, g.ids, anchor.x - anchorX, anchor.z - anchorZ)
        setCursor((prev) => ({ ...(prev || world), kind: anchor.kind }))
        p.onPreview(g.orig.map((room) => {
          if (!g.ids.has(room.id)) return room
          return {
            ...room,
            x: room.x + limited.dx,
            z: room.z + limited.dz,
            outline: translateOutline(room.outline, limited.dx, limited.dz),
          }
        }))
        return
      }
      if (g.kind === 'resize') {
        const room = g.orig.find((item) => item.id === g.id)
        const box = bboxOf(outlineOf(room))
        let left = box.left
        let right = box.right
        let top = box.top
        let bottom = box.bottom
        const handle = g.corner
        if (handle.includes('e')) right = snapped.x
        if (handle.includes('w')) left = snapped.x
        if (handle.includes('s')) bottom = snapped.z
        if (handle.includes('n')) top = snapped.z
        if (right - left < 1) {
          if (handle.includes('e')) right = left + 1
          else left = right - 1
        }
        if (bottom - top < 1) {
          if (handle.includes('s')) bottom = top + 1
          else top = bottom - 1
        }
        const limited = clampResizeBox(room, g.orig, left, top, right, bottom)
        if (!limited) return
        p.onPreview(g.orig.map((item) => (
          item.id === room.id ? applyBox(item, limited.left, limited.top, limited.right, limited.bottom) : item
        )))
        return
      }
      if (g.kind === 'edge' || g.kind === 'vertex') {
        const room = g.orig.find((item) => item.id === g.id)
        const points = g.kind === 'edge'
          ? moveEdge(outlineOf(room), g.index, snapped.x, snapped.z)
          : moveVertex(outlineOf(room), g.index, snapped.x, snapped.z)
        if (points.length < 4 || selfIntersects(points) || polygonArea(points) < 0.5) return
        const proposed = applyOutline(room, points)
        const parent = room.parentId ? g.orig.find((item) => item.id === room.parentId) : null
        if (parent && !footprintInside(parent, proposed)) return
        const children = g.orig.filter((item) => item.parentId === room.id)
        if (children.some((child) => !footprintInside(proposed, child))) return
        p.onPreview(g.orig.map((item) => (item.id === room.id ? proposed : item)))
        return
      }
      if (g.kind === 'equip') {
        const dx = world.x - g.startX
        const dz = world.z - g.startZ
        p.onPreview(g.orig.map((room) => {
          if (room.id !== g.roomId) return room
          return {
            ...room,
            equipment: room.equipment.map((eq) => {
              if (eq.id !== g.eqId) return eq
              const localX = eq.x + dx
              const localZ = eq.z + dz
              if (eq.category === 'door') return { ...eq, ...snapDoorToWall(room, localX, localZ, eq.width) }
              return { ...eq, x: localX, z: localZ }
            }),
          }
        }))
      }
    }
    const up = (event) => {
      const g = gesture.current
      gesture.current = null
      if (!g) return
      const p = propsRef.current
      if (g.kind === 'draw') {
        setDraft(null)
        typed.current = { field: 'w', w: '', d: '' }
        p.onCreateRect(g.x1, g.z1, g.x2 ?? g.x1, g.z2 ?? g.z1)
      } else if (g.kind === 'marquee') {
        setDraft(null)
        const host = hostRef.current
        const current = viewRef.current
        const rect = host.getBoundingClientRect()
        const x2 = (event.clientX - rect.left - current.offsetX) / current.scale
        const z2 = (event.clientY - rect.top - current.offsetY) / current.scale
        const left = Math.min(g.x1, x2)
        const right = Math.max(g.x1, x2)
        const top = Math.min(g.z1, z2)
        const bottom = Math.max(g.z1, z2)
        if (right - left < 0.15 && bottom - top < 0.15) {
          if (!g.shift) p.onSelect([])
          return
        }
        const hits = p.rooms.filter((room) => {
          const box = bboxOf(outlineOf(room))
          return box.right >= left && box.left <= right && box.bottom >= top && box.top <= bottom
        }).map((room) => room.id)
        p.onSelect(g.shift ? [...new Set([...p.selectedIds, ...hits])] : hits)
      } else if (g.started) {
        p.onGestureEnd()
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [])

  const onMouseDown = (event) => {
    if (event.button === 1 || event.button === 2 || spaceDown) {
      gesture.current = { kind: 'pan', sx: event.clientX, sy: event.clientY, offsetX: view.offsetX, offsetY: view.offsetY }
      return
    }
    if (event.button !== 0) return
    const host = hostRef.current
    const world = {
      x: (event.clientX - host.getBoundingClientRect().left - view.offsetX) / view.scale,
      z: (event.clientY - host.getBoundingClientRect().top - view.offsetY) / view.scale,
    }
    const p = propsRef.current
    const handle = event.target?.dataset?.handle
    const handleRoom = event.target?.dataset?.room
    if (p.tool === 'polygon') {
      if (event.detail >= 2 && polyRef.current.length >= 4) {
        p.onCreatePolygon(polyRef.current)
        setPoly([])
        polyTyped.current = ''
        return
      }
      const origin = polyRef.current.length ? polyRef.current[polyRef.current.length - 1] : null
      let point = snapWorld(world.x, world.z, {
        origin,
        scale: view.scale,
        grid: p.snapOn ? p.gridSize : 0,
        rooms: p.rooms,
        flags: { ...p.snapFlags, ortho: origin ? true : p.snapFlags?.ortho },
      })
      const typedLength = parseFloat(polyTyped.current.replace(',', '.'))
      if (origin && Number.isFinite(typedLength) && typedLength >= 0.3) {
        const dx = point.x - origin.x
        const dz = point.z - origin.z
        const mag = Math.hypot(dx, dz) || 1
        point = { x: origin.x + (dx / mag) * typedLength, z: origin.z + (dz / mag) * typedLength }
      }
      polyTyped.current = ''
      if (polyRef.current.length >= 3) {
        const first = polyRef.current[0]
        if (Math.hypot(point.x - first.x, point.z - first.z) < 16 / view.scale) {
          p.onCreatePolygon(polyRef.current)
          setPoly([])
          return
        }
      }
      setPoly([...polyRef.current, { x: point.x, z: point.z }])
      return
    }
    if (p.tool === 'draw' || p.tool === 'partition') {
      const point = snapWorld(world.x, world.z, {
        scale: view.scale,
        grid: p.snapOn ? p.gridSize : 0,
        rooms: p.rooms,
        flags: { ...p.snapFlags, ortho: false },
      })
      typed.current = { field: 'w', w: '', d: '' }
      gesture.current = { kind: 'draw', x1: point.x, z1: point.z, x2: point.x, z2: point.z }
      setDraft({ kind: 'rect', x1: point.x, z1: point.z, x2: point.x, z2: point.z })
      return
    }
    if (p.placing) {
      const room = hitRoom(p.rooms, world.x, world.z)
      if (room) p.onPlace(room.id, world.x, world.z)
      return
    }
    if (handle && handleRoom) {
      const orig = p.rooms.map((room) => ({ ...room, equipment: [...(room.equipment || [])], outline: room.outline ? room.outline.map((pt) => ({ ...pt })) : null }))
      if (handle.startsWith('v-') || handle.startsWith('e-')) {
        gesture.current = {
          kind: handle.startsWith('v-') ? 'vertex' : 'edge',
          id: handleRoom,
          index: Number(handle.slice(2)),
          orig,
          started: false,
        }
      } else {
        gesture.current = { kind: 'resize', id: handleRoom, corner: handle, orig, started: false }
      }
      p.onSelect([handleRoom])
      return
    }
    const eqHit = hitEquipment(p.rooms, world.x, world.z)
    if (eqHit) {
      p.onSelect([eqHit.eq.id])
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
    const room = hitRoom(p.rooms, world.x, world.z)
    if (room) {
      const next = event.shiftKey
        ? (p.selectedIds.includes(room.id) ? p.selectedIds.filter((id) => id !== room.id) : [...p.selectedIds, room.id])
        : (p.selectedIds.includes(room.id) ? p.selectedIds : [room.id])
      p.onSelect(next)
      const ids = new Set(next)
      next.forEach((id) => descendantIds(p.rooms, id).forEach((child) => ids.add(child)))
      gesture.current = {
        kind: 'move',
        id: room.id,
        ids,
        ignoreIds: ids,
        startX: world.x,
        startZ: world.z,
        orig: p.rooms.map((item) => ({ ...item, equipment: [...(item.equipment || [])], outline: item.outline ? item.outline.map((pt) => ({ ...pt })) : null })),
        started: false,
      }
      return
    }
    gesture.current = { kind: 'marquee', x1: world.x, z1: world.z, shift: event.shiftKey }
  }

  const { minor, major } = gridSpec(view.scale)
  const left = -view.offsetX / view.scale
  const top = -view.offsetY / view.scale
  const right = left + size.w / view.scale
  const bottom = top + size.h / view.scale
  const gridLines = []
  if (snapOn) {
    const startX = Math.floor(left / minor) * minor
    const startZ = Math.floor(top / minor) * minor
    for (let x = startX; x <= right; x += minor) {
      const majorLine = Math.abs(x / major - Math.round(x / major)) < 1e-6
      gridLines.push({ x1: x, z1: top, x2: x, z2: bottom, major: majorLine })
    }
    for (let z = startZ; z <= bottom; z += minor) {
      const majorLine = Math.abs(z / major - Math.round(z / major)) < 1e-6
      gridLines.push({ x1: left, z1: z, x2: right, z2: z, major: majorLine })
    }
  }
  const bar = scaleBarMetres(view.scale)
  const selected = new Set(selectedIds)
  const drawing = tool === 'draw' || tool === 'partition' || tool === 'polygon'
  const hint = tool === 'polygon'
    ? 'Klikkaa nurkat. Seinä pysyy suorassa. Enter sulkee, askelpalautin peruu pisteen.'
    : tool === 'draw' || tool === 'partition'
      ? 'Vedä huone. Näppäile mitta, Tab vaihtaa sivua, Enter vahvistaa.'
      : 'Vedä siirtää · kahvat mitoittavat · Shift monivalinta · rulla zoomaa · väli tai keskinäppäin panoroi'

  const rectDraft = draft?.kind === 'rect' ? draft : null
  const draftWidth = rectDraft ? Math.abs(rectDraft.x2 - rectDraft.x1) : 0
  const draftDepth = rectDraft ? Math.abs(rectDraft.z2 - rectDraft.z1) : 0

  return (
    <div
      ref={hostRef}
      data-testid="plan-canvas"
      onMouseDown={onMouseDown}
      onContextMenu={(event) => event.preventDefault()}
      onMouseLeave={() => { if (!gesture.current) setCursor(null) }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: PAPER,
        overflow: 'hidden',
        cursor: spaceDown ? 'grab' : drawing || placing ? 'crosshair' : hoverId ? 'move' : 'default',
        userSelect: 'none',
      }}
    >
      <svg width="100%" height="100%">
        <defs>
          <pattern id="panel-hatch" width="0.18" height="0.18" patternUnits="userSpaceOnUse">
            <path d="M0 0.18 L0.18 0" stroke="#d6d0c6" strokeWidth="0.012" />
          </pattern>
        </defs>
        <g transform={`translate(${view.offsetX} ${view.offsetY}) scale(${view.scale})`}>
          {gridLines.map((line, index) => (
            <line
              key={index}
              x1={line.x1}
              y1={line.z1}
              x2={line.x2}
              y2={line.z2}
              stroke={line.major ? '#d9d3c8' : '#ebe6dc'}
              strokeWidth={(line.major ? 1.1 : 0.7) / view.scale}
            />
          ))}
          {rooms.map((room) => {
            const outer = outlineOf(room)
            const inner = insetOrthogonal(outer, room.wallThickness) || outer
            const active = selected.has(room.id)
            const hot = hoverId === room.id
            const dims = metricsOf(room)
            const line1 = `${room.label}  ${formatTemp(room.temp, unitSystem, 0)}`
            const line2 = `${dims.area.toFixed(1)} m²`
            const label = labelAnchor(room, inner, view.scale, line1, line2)
            const showHandles = active && selectedIds.length === 1 && tool === 'select' && !placing
            const rectLike = !isCustomOutline(room)
            return (
              <g key={room.id}>
                <path
                  data-room={room.id}
                  d={`${pathOf(outer)} ${pathOf(inner)}`}
                  fillRule="evenodd"
                  fill="url(#panel-hatch)"
                  stroke={active ? TEAL : '#44403c'}
                  strokeWidth={(active ? 1.8 : 1.15) / view.scale}
                />
                <path
                  data-room={room.id}
                  d={pathOf(inner)}
                  fill={room.color || '#3b82f6'}
                  fillOpacity={active || hot ? 0.22 : 0.12}
                  stroke="none"
                />
                {(room.equipment || []).map((eq) => {
                  if (eq.category === 'door') {
                    const symbol = doorSymbol(room, eq)
                    const thickness = Math.max(room.wallThickness, 0.08)
                    const gapW = symbol.iz !== 0 ? symbol.width : thickness
                    const gapD = symbol.ix !== 0 ? symbol.width : thickness
                    const gx = (symbol.x1 + symbol.x2) / 2 + symbol.ix * thickness / 2
                    const gz = (symbol.z1 + symbol.z2) / 2 + symbol.iz * thickness / 2
                    return (
                      <g key={eq.id} data-eq={eq.id}>
                        <rect x={gx - gapW / 2} y={gz - gapD / 2} width={gapW} height={gapD} fill={PAPER} />
                        <polyline
                          points={symbol.arc.map((point) => `${point.x},${point.z}`).join(' ')}
                          fill="none"
                          stroke="#9a3412"
                          strokeWidth={1 / view.scale}
                        />
                        <line x1={symbol.hinge.x} y1={symbol.hinge.z} x2={symbol.open.x} y2={symbol.open.z} stroke="#9a3412" strokeWidth={1.4 / view.scale} />
                      </g>
                    )
                  }
                  const alongX = eq.rotation !== 90
                  const w = alongX ? eq.width : eq.depth
                  const d = alongX ? eq.depth : eq.width
                  const ex = room.x + eq.x
                  const ez = room.z + eq.z
                  const evap = eq.category === 'evaporator'
                  return (
                    <g key={eq.id}>
                      <rect
                        x={ex - w / 2}
                        y={ez - d / 2}
                        width={w}
                        height={d}
                        rx={evap ? 0.04 : 0.02}
                        fill={evap ? '#e0f2fe' : eq.category === 'rack' ? '#ede9fe' : '#fef3c7'}
                        stroke={evap ? '#0369a1' : '#57534e'}
                        strokeWidth={1 / view.scale}
                      />
                      {evap && (
                        <>
                          <circle cx={ex} cy={ez} r={Math.min(w, d) * 0.18} fill="none" stroke="#0369a1" strokeWidth={1 / view.scale} />
                          <path d={`M ${ex - w * 0.28} ${ez} l ${w * 0.16} ${-d * 0.12} l 0 ${d * 0.24} Z`} fill="#0369a1" />
                          <path d={`M ${ex - w * 0.05} ${ez} l ${w * 0.16} ${-d * 0.12} l 0 ${d * 0.24} Z`} fill="#0369a1" />
                        </>
                      )}
                    </g>
                  )
                })}
                <g style={{ pointerEvents: 'none' }}>
                  <rect
                    x={label.x - label.w / 2}
                    y={label.z - label.h / 2}
                    width={label.w}
                    height={label.h}
                    rx={0.08}
                    fill="rgba(255,255,255,0.94)"
                    stroke="#e7e5e4"
                    strokeWidth={1 / view.scale}
                  />
                  <text
                    x={label.x}
                    y={label.z - 4 / view.scale}
                    textAnchor="middle"
                    fill={INK}
                    fontSize={12 / view.scale}
                    fontWeight="700"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    {line1}
                  </text>
                  <text
                    x={label.x}
                    y={label.z + 8 / view.scale}
                    textAnchor="middle"
                    fill="#57534e"
                    fontSize={10 / view.scale}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    {line2}
                  </text>
                </g>
                {active && (rectLike ? (
                  <>
                    <DimLine
                      x1={bboxOf(outer).left}
                      z1={bboxOf(outer).top - 0.45}
                      x2={bboxOf(outer).right}
                      z2={bboxOf(outer).top - 0.45}
                      scale={view.scale}
                      text={formatLength(room.width, unitSystem)}
                    />
                    <DimLine
                      x1={bboxOf(outer).left - 0.45}
                      z1={bboxOf(outer).top}
                      x2={bboxOf(outer).left - 0.45}
                      z2={bboxOf(outer).bottom}
                      scale={view.scale}
                      text={formatLength(room.depth, unitSystem)}
                    />
                  </>
                ) : edgesOf(outer).map((edge) => (
                  <g key={edge.index}>{edgeDimension(edge, outer, view.scale, unitSystem)}</g>
                )))}
                {showHandles && (rectLike ? ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] : []).map((corner) => {
                  const box = bboxOf(outer)
                  const x = corner.includes('w') ? box.left : corner.includes('e') ? box.right : box.x
                  const z = corner.includes('n') ? box.top : corner.includes('s') ? box.bottom : box.z
                  return (
                    <circle key={corner} data-handle={corner} data-room={room.id} cx={x} cy={z} r={5.5 / view.scale} fill="#fff" stroke={TEAL} strokeWidth={1.4 / view.scale} />
                  )
                })}
                {showHandles && !rectLike && outlineOf(room).map((point, index) => (
                  <g key={index}>
                    <circle data-handle={`v-${index}`} data-room={room.id} cx={point.x} cy={point.z} r={5.5 / view.scale} fill="#fff" stroke={TEAL} strokeWidth={1.4 / view.scale} />
                    <rect
                      data-handle={`e-${index}`}
                      data-room={room.id}
                      x={(point.x + outer[(index + 1) % outer.length].x) / 2 - 4 / view.scale}
                      y={(point.z + outer[(index + 1) % outer.length].z) / 2 - 4 / view.scale}
                      width={8 / view.scale}
                      height={8 / view.scale}
                      fill={TEAL}
                    />
                  </g>
                ))}
              </g>
            )
          })}
          {rectDraft && (
            <g>
              <rect
                x={Math.min(rectDraft.x1, rectDraft.x2)}
                y={Math.min(rectDraft.z1, rectDraft.z2)}
                width={draftWidth}
                height={draftDepth}
                fill="rgba(15,118,110,0.08)"
                stroke={TEAL}
                strokeWidth={1.4 / view.scale}
                strokeDasharray={`${6 / view.scale} ${4 / view.scale}`}
              />
              <DimLine
                x1={Math.min(rectDraft.x1, rectDraft.x2)}
                z1={Math.min(rectDraft.z1, rectDraft.z2) - 0.35}
                x2={Math.max(rectDraft.x1, rectDraft.x2)}
                z2={Math.min(rectDraft.z1, rectDraft.z2) - 0.35}
                scale={view.scale}
                text={formatLength(draftWidth, unitSystem)}
              />
              <DimLine
                x1={Math.min(rectDraft.x1, rectDraft.x2) - 0.35}
                z1={Math.min(rectDraft.z1, rectDraft.z2)}
                x2={Math.min(rectDraft.x1, rectDraft.x2) - 0.35}
                z2={Math.max(rectDraft.z1, rectDraft.z2)}
                scale={view.scale}
                text={formatLength(draftDepth, unitSystem)}
              />
            </g>
          )}
          {poly.length > 0 && (
            <g>
              <polyline
                points={[...poly, polyHover].filter(Boolean).map((point) => `${point.x},${point.z}`).join(' ')}
                fill="none"
                stroke={TEAL}
                strokeWidth={1.6 / view.scale}
              />
              {poly.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.z} r={4 / view.scale} fill={TEAL} />
              ))}
              {polyHover && poly.length > 0 && (
                <DimLine
                  x1={poly[poly.length - 1].x}
                  z1={poly[poly.length - 1].z}
                  x2={polyHover.x}
                  z2={polyHover.z}
                  scale={view.scale}
                  text={formatLength(Math.hypot(polyHover.x - poly[poly.length - 1].x, polyHover.z - poly[poly.length - 1].z), unitSystem)}
                />
              )}
            </g>
          )}
          {draft?.kind === 'marquee' && (
            <rect
              x={Math.min(draft.x1, draft.x2)}
              y={Math.min(draft.z1, draft.z2)}
              width={Math.abs(draft.x2 - draft.x1)}
              height={Math.abs(draft.z2 - draft.z1)}
              fill="rgba(15,118,110,0.08)"
              stroke={TEAL}
              strokeWidth={1 / view.scale}
            />
          )}
          {cursor?.kind && (
            <g>
              <circle cx={cursor.x} cy={cursor.z} r={6 / view.scale} fill="none" stroke={TEAL} strokeWidth={1.5 / view.scale} />
              <text x={cursor.x + 10 / view.scale} y={cursor.z - 8 / view.scale} fill={TEAL} fontSize={11 / view.scale} fontWeight="700">
                {snapLabel(cursor.kind)}
              </text>
            </g>
          )}
        </g>
        {drawing && cursor && (
          <>
            <line x1={cursor.px} y1={0} x2={cursor.px} y2={size.h} stroke="#a8a29e" strokeWidth="0.6" opacity="0.55" />
            <line x1={0} y1={cursor.py} x2={size.w} y2={cursor.py} stroke="#a8a29e" strokeWidth="0.6" opacity="0.55" />
          </>
        )}
      </svg>
      <div style={{ position: 'absolute', left: 14, top: 12, display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 22, height: 22, border: '1.5px solid #44403c', borderRadius: 11, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 10, top: 2, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid #0f766e' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#44403c' }}>POHJOINEN</span>
      </div>
      {notice && (
        <div style={{ position: 'absolute', left: 14, top: 44, maxWidth: 420, padding: '6px 10px', background: 'rgba(255,251,235,0.95)', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 12, color: '#78350f' }}>
          {notice}
        </div>
      )}
      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 10, display: 'flex', justifyContent: 'space-between', gap: 12,
        alignItems: 'flex-end', pointerEvents: 'none', fontSize: 11, color: '#57534e',
      }}>
        <div>
          <div style={{ width: bar * view.scale, height: 8, borderLeft: '1.5px solid #44403c', borderRight: '1.5px solid #44403c', borderBottom: '1.5px solid #44403c' }} />
          <div style={{ marginTop: 2 }}>{formatLength(bar, unitSystem)}</div>
        </div>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>{hint}</div>
        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {cursor ? `X ${formatLength(cursor.x, unitSystem)}   Y ${formatLength(cursor.z, unitSystem)}` : 'X —   Y —'}
          {cursor?.kind ? ` · ${snapLabel(cursor.kind)}` : ''}
        </div>
      </div>
    </div>
  )
}
