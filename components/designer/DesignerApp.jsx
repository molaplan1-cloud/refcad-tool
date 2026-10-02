'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import PlanView from './PlanView'
import HeatLoadPanel from './HeatLoadPanel'
import { ROOM_TYPES, TEMPLATE_GROUPS, getTemplate, isRefrigerated } from '@/lib/catalog'
import {
  buildEnquiryExample,
  createRoom,
  descendantIds,
  findContainer,
  genId,
  makeEquipment,
  normalizeRooms,
} from '@/lib/geometry'
import { decorateExample } from '@/lib/exampleScene'
import { templatesForGroup } from '@/lib/selection'
import { REFRIGERANT_IDS } from '@/lib/pipeSizing'
import { INTERNAL_LIQUID_TRAIN, PIPE_STYLES, autoCircuit, validateRoute } from '@/lib/pipeTopology'
import {
  defaultElevation,
  doorOnWall,
  insideRefrigerated,
  isOutdoorCategory,
  rotateDoorWall,
  snapOutdoorUnit,
} from '@/lib/placement'
import { applyOutline, bboxOf, clampGroupTranslation, cleanOrthogonal, isRectangleOutline, scaleOutline, selfIntersects, translateOutline } from '@/lib/cadDraw'
import { calculateProject, resultFor } from '@/lib/heatLoad'
import { buildDxf, dxfFilename } from '@/lib/dxf'
import { buildPdf, pdfFilename } from '@/lib/pdfExport'
import SchematicView from './SchematicView'

const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false })

const iconBtn = (active) => ({
  width: 32,
  height: 32,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  border: '1px solid transparent',
  background: active ? '#134e4a' : 'transparent',
  color: active ? '#ccfbf1' : '#e7e5e4',
  cursor: 'pointer',
  flexShrink: 0,
  transform: 'none',
})

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
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
  transform: 'none',
  whiteSpace: 'nowrap',
})

function Icon({ children }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

const stroke = { stroke: 'currentColor', strokeWidth: 1.45, strokeLinecap: 'round', strokeLinejoin: 'round' }

const sectionHead = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  background: 'transparent',
  border: 'none',
  color: '#44403c',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  cursor: 'pointer',
  transform: 'none',
}

function TemplateThumb({ item }) {
  const category = item?.category
  const box = { width: 28, height: 28, viewBox: '0 0 28 28', 'aria-hidden': true, style: { flexShrink: 0, display: 'block' } }
  if (category === 'evaporator' && item?.style === 'slant') {
    return (
      <svg {...box}>
        <rect x="3" y="6" width="22" height="16" fill="#f8fafc" stroke="#64748b" />
        <path d="M3 11 H25" stroke="#94a3b8" />
        <rect x="4" y="4" width="2.2" height="3" fill="#94a3b8" />
        <rect x="21.8" y="4" width="2.2" height="3" fill="#94a3b8" />
        <circle cx="10" cy="16" r="2.6" fill="#eff6ff" stroke="#1d4ed8" />
        <circle cx="18" cy="16" r="2.6" fill="#eff6ff" stroke="#1d4ed8" />
        <circle cx="14" cy="20" r="1" fill="#64748b" />
      </svg>
    )
  }
  if (category === 'combo' || category === 'unit') {
    return (
      <svg {...box}>
        <rect x="3" y="7" width="22" height="14" fill="#f8fafc" stroke="#334155" />
        <circle cx="9" cy="14" r="3.2" fill="#1f2937" />
        <path d="M14 10 H23 M14 13 H23 M14 16 H23" stroke="#64748b" />
        <circle cx="18" cy="14" r="2" fill="none" stroke="#0f172a" />
        <circle cx="8" cy="7" r="1.1" fill="#b45309" />
        <circle cx="20" cy="7" r="1.1" fill="#b45309" />
      </svg>
    )
  }
  if (category === 'compressor') {
    return (
      <svg {...box}>
        <rect x="4" y="6" width="20" height="16" fill="#f5f5f4" stroke="#44403c" />
        <circle cx="10" cy="14" r="3" fill="#1f2937" />
        <circle cx="18" cy="14" r="3" fill="#1f2937" />
        <path d="M8 8 H20" stroke="#94a3b8" strokeWidth="1.4" />
      </svg>
    )
  }
  if (category === 'sensor') {
    return (
      <svg {...box}>
        <circle cx="14" cy="14" r="6" fill="#fff" stroke="#0369a1" strokeWidth="1.4" />
        <text x="14" y="17" textAnchor="middle" fontSize="8" fill="#0369a1">T</text>
      </svg>
    )
  }
  if (category === 'controller') {
    return (
      <svg {...box}>
        <rect x="6" y="8" width="16" height="12" rx="2" fill="#ccfbf1" stroke="#0f766e" />
        <text x="14" y="17" textAnchor="middle" fontSize="8" fill="#0f766e">S</text>
      </svg>
    )
  }
  if (category === 'column') {
    return (
      <svg {...box}>
        <rect x="10" y="4" width="8" height="20" fill="#d6d3d1" stroke="#57534e" />
      </svg>
    )
  }
  if (category === 'door') {
    return (
      <svg {...box}>
        <rect x="5" y="3" width="12" height="22" rx="1" fill="#f5f5f4" stroke="#44403c" />
        <path d="M17 25 A14 14 0 0 0 17 3" fill="none" stroke="#9a3412" strokeWidth="1.2" />
        <rect x="13.5" y="13" width="1.6" height="4.5" rx="0.4" fill="#292524" />
      </svg>
    )
  }
  if (category === 'evaporator') {
    return (
      <svg {...box}>
        <rect x="2" y="8" width="24" height="12" rx="2" fill="#f8fafc" stroke="#334155" />
        <circle cx="9" cy="14" r="3.1" fill="#0f172a" />
        <circle cx="19" cy="14" r="3.1" fill="#0f172a" />
        <circle cx="9" cy="14" r="1" fill="#e2e8f0" />
        <circle cx="19" cy="14" r="1" fill="#e2e8f0" />
      </svg>
    )
  }
  if (category === 'condenser') {
    return (
      <svg {...box}>
        <rect x="3" y="6" width="22" height="16" rx="2" fill="#e2e8f0" stroke="#475569" />
        <path d="M6 9 H22 M6 12 H22 M6 15 H22 M6 18 H22" stroke="#64748b" strokeWidth="1" />
        <circle cx="14" cy="13" r="3" fill="#fff" stroke="#0f172a" />
        <circle cx="7" cy="6" r="1.1" fill="#b45309" />
        <circle cx="21" cy="6" r="1.1" fill="#b45309" />
      </svg>
    )
  }
  if (category === 'rack') {
    return (
      <svg {...box}>
        <path d="M6 4 V24 M22 4 V24 M6 8 H22 M6 14 H22 M6 20 H22" stroke="#78716c" strokeWidth="1.4" />
      </svg>
    )
  }
  return (
    <svg {...box}>
      <rect x="6" y="5" width="16" height="18" rx="1.5" fill="#e2e8f0" stroke="#334155" />
      <rect x="9" y="8" width="10" height="3" fill="#64748b" />
    </svg>
  )
}

export default function DesignerApp({
  initialName = 'Uusi projekti',
  initialRooms = [],
  initialUnitSystem = 'SI',
  initialPipes = [],
  initialCables = [],
  initialSchematic = null,
  onPersist,
  user = null,
  persistLabel = 'selaimeen',
}) {
  const [name, setName] = useState(initialName || 'Uusi projekti')
  const [rooms, setRooms] = useState(() => normalizeRooms(initialRooms))
  const [pipes, setPipes] = useState(initialPipes || [])
  const [cables, setCables] = useState(initialCables || [])
  const [schematic, setSchematic] = useState(() => ({
    refrigerant: 'R449A',
    teC: -8,
    tcC: 40,
    theme: 'light',
    drawing: 'technical',
    drawingNo: 'KA-01',
    revision: 'A',
    designer: '',
    overrides: {},
    ...(initialSchematic || {}),
  }))
  const [unitSystem, setUnitSystem] = useState(initialUnitSystem === 'IP' ? 'IP' : 'SI')
  const [pipeKind, setPipeKind] = useState('suction')
  const [refrigerant, setRefrigerant] = useState('R449A')
  const [teC, setTeC] = useState(-8)
  const [tcC, setTcC] = useState(40)
  const [showAllSizes, setShowAllSizes] = useState(false)
  const [menu, setMenu] = useState(null)
  const [tool, setTool] = useState('select')
  const [drawType, setDrawType] = useState('chilled')
  const [view, setView] = useState('2d')
  const [selectedIds, setSelectedIds] = useState([])
  const [placingId, setPlacingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [pipeOffer, setPipeOffer] = useState(null)
  const [snapOn, setSnapOn] = useState(true)
  const [gridSize, setGridSize] = useState(0.1)
  const [fitToken, setFitToken] = useState(1)
  const [saveState, setSaveState] = useState('saved')
  const [exportOpen, setExportOpen] = useState(false)
  const [roomsOpen, setRoomsOpen] = useState(true)
  const [templatesOpen, setTemplatesOpen] = useState(true)
  const roomsRef = useRef(rooms)
  const pipesRef = useRef(pipes)
  const cablesRef = useRef(cables)
  const selectedRef = useRef(selectedIds)
  const undoRef = useRef([])
  const redoRef = useRef([])
  const editSnap = useRef(null)
  const fileRef = useRef(null)
  roomsRef.current = rooms
  pipesRef.current = pipes
  cablesRef.current = cables
  selectedRef.current = selectedIds
  const selectedId = selectedIds[selectedIds.length - 1] || null
  const snapFlags = { grid: snapOn, endpoint: true, midpoint: true, wall: true, ortho: true }

  const result = useMemo(() => calculateProject(rooms), [rooms])
  const placing = placingId ? getTemplate(placingId) : null

  const selectedRoom = rooms.find((room) => room.id === selectedId)
    || rooms.find((room) => (room.equipment || []).some((eq) => eq.id === selectedId))
    || null
  const selectedEquipment = selectedRoom?.equipment?.find((eq) => eq.id === selectedId) || null
  const roomResult = selectedRoom ? resultFor(result, selectedRoom.id) : null

  const snapshot = useCallback(() => ({
    rooms: structuredClone(roomsRef.current),
    pipes: structuredClone(pipesRef.current),
    cables: structuredClone(cablesRef.current),
  }), [])

  const restore = useCallback((shot) => {
    setRooms(shot.rooms)
    setPipes(shot.pipes || [])
    setCables(shot.cables || [])
  }, [])

  const pushUndo = useCallback(() => {
    undoRef.current.push(snapshot())
    if (undoRef.current.length > 80) undoRef.current.shift()
    redoRef.current = []
  }, [snapshot])

  const undo = useCallback(() => {
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push(snapshot())
    restore(prev)
  }, [restore, snapshot])

  const redo = useCallback(() => {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(snapshot())
    restore(next)
  }, [restore, snapshot])

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (e.key === 'Escape') {
        setPlacingId(null)
        setTool('select')
        setNotice('')
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      } else if (e.key.toLowerCase() === 'v') setTool('select')
      else if (e.key.toLowerCase() === 'r') setTool('draw')
      else if (e.key.toLowerCase() === 'p') setTool('polygon')
      else if (e.key.toLowerCase() === 'w') setTool('partition')
      else if (e.key.toLowerCase() === 'f') setFitToken((token) => token + 1)
      else if (e.key.toLowerCase() === 'g') setSnapOn((value) => !value)
      else if (e.key.toLowerCase() === 'l') setTool('pipe')
      else if (e.key.toLowerCase() === 'k') setTool('cable')
      else if (e.key === ']' || e.key === '[') rotateSelected(e.key === ']' ? 90 : -90)
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelected()
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        nudgeElevation(e.key === 'ArrowUp' ? 0.1 : -0.1)
      } else if ((e.ctrlKey || e.metaKey) && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
        nudgeSize(e.key)
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
        const step = snapOn ? gridSize : 0.1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dz = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        const ids = new Set(selectedRef.current)
        if (!ids.size) return
        const current = roomsRef.current
        selectedRef.current.forEach((id) => descendantIds(current, id).forEach((child) => ids.add(child)))
        const limited = clampGroupTranslation(current, ids, dx, dz)
        if (Math.abs(limited.dx) < 1e-6 && Math.abs(limited.dz) < 1e-6) return
        pushUndo()
        setRooms(current.map((room) => (
          ids.has(room.id) ? { ...room, x: room.x + limited.dx, z: room.z + limited.dz, outline: translateOutline(room.outline, limited.dx, limited.dz) } : room
        )))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (!exportOpen) return undefined
    const close = () => setExportOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [exportOpen])

  useEffect(() => {
    if (!onPersist) return undefined
    setSaveState('saving')
    const timer = setTimeout(() => {
      try {
        onPersist({ name, rooms, unitSystem, pipes, cables, schematic })
        setSaveState('saved')
      } catch (err) {
        console.error(err)
        setSaveState('error')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [name, rooms, unitSystem, pipes, cables, schematic, onPersist])

  function deleteSelected() {
    const ids = selectedRef.current
    if (!ids.length) return
    const current = roomsRef.current
    const roomIds = new Set(current.map((room) => room.id))
    const pipeIds = new Set(pipesRef.current.map((pipe) => pipe.id))
    const cableIds = new Set(cablesRef.current.map((cable) => cable.id))
    pushUndo()
    if (ids.some((id) => pipeIds.has(id) || cableIds.has(id))) {
      setPipes(pipesRef.current.filter((pipe) => !ids.includes(pipe.id)))
      setCables(cablesRef.current.filter((cable) => !ids.includes(cable.id)))
      const rest = ids.filter((id) => !pipeIds.has(id) && !cableIds.has(id))
      if (!rest.length) {
        setSelectedIds([])
        setMenu(null)
        return
      }
    }
    const equipmentIds = ids.filter((id) => !roomIds.has(id) && !pipeIds.has(id) && !cableIds.has(id))
    if (equipmentIds.length && equipmentIds.length === ids.filter((id) => !pipeIds.has(id) && !cableIds.has(id)).length) {
      setRooms(current.map((room) => ({
        ...room,
        equipment: (room.equipment || []).filter((eq) => !equipmentIds.includes(eq.id)),
      })))
      setSelectedIds([])
      return
    }
    const drop = new Set()
    ids.forEach((id) => {
      if (!roomIds.has(id)) return
      drop.add(id)
      descendantIds(current, id).forEach((child) => drop.add(child))
    })
    setRooms(current.filter((item) => !drop.has(item.id)))
    setSelectedIds([])
  }

  function onCreateRect(x1, z1, x2, z2) {
    const width = Math.abs(x2 - x1)
    const depth = Math.abs(z2 - z1)
    if (width < 0.8 || depth < 0.8) {
      setNotice('Vedä vähintään 0,8 m × 0,8 m kokoinen alue.')
      return
    }
    const rect = {
      left: Math.min(x1, x2),
      right: Math.max(x1, x2),
      top: Math.min(z1, z2),
      bottom: Math.max(z1, z2),
    }
    const current = roomsRef.current
    let parent = null
    if (tool === 'partition' && isRefrigerated(drawType)) {
      parent = findContainer(current, rect)
      if (!parent) {
        setNotice('Väliseinä piirretään olemassa olevan huoneen sisään.')
        return
      }
    }
    const room = createRoom({
      typeId: drawType,
      x: (rect.left + rect.right) / 2,
      z: (rect.top + rect.bottom) / 2,
      width,
      depth,
      rooms: current,
      parentId: parent?.id || null,
      parent,
    })
    pushUndo()
    setRooms([...current, room])
    setSelectedIds([room.id])
    setTool('select')
    setNotice(`${room.label} lisätty. Sisämitat tulevat ulkomitasta miinus seinät.`)
  }

  function onCreatePolygon(points) {
    const clean = cleanOrthogonal(points)
    if (clean.length < 4 || selfIntersects(clean)) {
      setNotice('Monikulmio tarvitsee vähintään neljä nurkkaa, eikä seinät saa risteytyä.')
      return
    }
    const box = bboxOf(clean)
    if (box.width < 0.8 || box.depth < 0.8) {
      setNotice('Vedä vähintään 0,8 m × 0,8 m kokoinen alue.')
      return
    }
    const current = roomsRef.current
    const rect = { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
    const container = findContainer(current, rect)
    const inside = container && box.width < container.width - 0.3 && box.depth < container.depth - 0.3
    const room = createRoom({
      typeId: drawType,
      x: box.x,
      z: box.z,
      width: box.width,
      depth: box.depth,
      rooms: current,
      parentId: inside ? container.id : null,
      parent: inside ? container : null,
    })
    const placed = isRectangleOutline(clean) ? room : { ...room, outline: clean }
    pushUndo()
    setRooms([...current, placed])
    setSelectedIds([placed.id])
    setTool('select')
    setNotice(inside ? `${placed.label} lisättiin väliseinänä.` : `${placed.label} lisätty. Reuna on monikulmio.`)
  }

  function onPlace(roomId, x, z) {
    if (!placingId) return
    const current = roomsRef.current
    const room = current.find((item) => item.id === roomId)
    if (!room) return
    const eq = makeEquipment(placingId, room, x, z, current)
    const warning = eq.warning
    delete eq.warning
    pushUndo()
    setRooms(current.map((item) => (
      item.id === roomId ? { ...item, equipment: [...item.equipment, eq] } : item
    )))
    setSelectedIds([eq.id])
    setPlacingId(null)
    setNotice(warning || `${eq.name} sijoitettiin huoneeseen ${room.label}.`)
  }

  function commitPipes(result) {
    pushUndo()
    const kept = pipesRef.current.filter((pipe) => pipe.kind === 'cable')
    setPipes([...kept, ...result.pipes])
    setSelectedIds(result.pipes[0] ? [result.pipes[0].id] : [])
    setNotice(result.notice)
    setPipeOffer(null)
  }

  function runAutoPipe() {
    const result = autoCircuit(roomsRef.current, { refrigerant, teC, tcC, id: genId })
    if (result.offerMove) {
      setPipeOffer(result.moves)
      setNotice(result.hint)
      return
    }
    if (!result.ok) {
      setPipeOffer(null)
      setNotice(result.hint)
      return
    }
    commitPipes(result)
  }

  function acceptOutdoorMove() {
    if (!pipeOffer?.length) return
    const next = roomsRef.current.map((room) => ({
      ...room,
      equipment: (room.equipment || []).map((eq) => {
        const move = pipeOffer.find((item) => item.roomId === room.id && item.eqId === eq.id)
        if (!move) return eq
        return {
          ...eq,
          x: move.x - room.x,
          z: move.z - room.z,
          rotation: move.rotation,
          mount: move.mount,
          elevation: move.elevation,
        }
      }),
    }))
    const result = autoCircuit(next, { refrigerant, teC, tcC, id: genId })
    if (!result.ok) {
      setPipeOffer(null)
      setNotice(result.hint)
      return
    }
    commitPipes(result)
    setRooms(next)
  }

  function onCreateRoute(points) {
    if (!points || points.length < 2) return
    const clean = points.filter((point, index) => index === 0 || Math.hypot(point.x - points[index - 1].x, point.z - points[index - 1].z) > 0.05)
    if (clean.length < 2) return
    if (tool === 'cable') {
      pushUndo()
      const cable = { id: genId(), points: clean }
      setCables([...cablesRef.current, cable])
      setSelectedIds([cable.id])
      setNotice('Kaapeli lisättiin.')
      return
    }
    const room = [...roomsRef.current].filter((item) => {
      const hw = item.width / 2
      const hd = item.depth / 2
      return Math.abs(clean[0].x - item.x) <= hw && Math.abs(clean[0].z - item.z) <= hd
    }).sort((a, b) => a.width * a.depth - b.width * b.depth)[0]
    const check = validateRoute(pipeKind, clean, roomsRef.current)
    if (!check.ok) {
      setNotice(check.hint)
      return
    }
    pushUndo()
    const pipe = {
      id: genId(),
      kind: pipeKind,
      segment: check.segment || null,
      points: clean,
      refrigerant,
      teC,
      tcC,
      riseM: pipeKind === 'suction' ? 3 : 0,
      roomTempC: room?.temp ?? 2,
    }
    setPipes([...pipesRef.current, pipe])
    setSelectedIds([pipe.id])
    setTool('select')
    setNotice(pipe.kind === 'drain' && pipe.roomTempC < 0
      ? 'Kondenssivesiputki lisättiin. Pakastetilassa se merkitään eristetyksi ja lämmityskaapelilla.'
      : 'Putki lisättiin. Koko lasketaan kuormasta, kylmäaineesta ja pituudesta.')
  }

  function patchSelected(patch) {
    if (!selectedRoom) return
    setRooms((current) => current.map((room) => {
      if (room.id !== selectedRoom.id) return room
      const next = { ...room, ...patch }
      if (room.outline && ('width' in patch || 'depth' in patch || 'x' in patch || 'z' in patch)) {
        next.outline = scaleOutline(room, next)
      }
      return next
    }))
  }

  function loadExample() {
    if (rooms.length && !window.confirm('Korvataanko nykyinen pohja esimerkillä 8 × 12 × 6 m?')) return
    pushUndo()
    const scene = decorateExample(buildEnquiryExample())
    setRooms(normalizeRooms(scene.rooms))
    setPipes(scene.pipes)
    setCables(scene.cables)
    setSelectedIds([scene.rooms[0].id])
    setView('2d')
    setFitToken((token) => token + 1)
    setNotice('Esimerkki: kylmähuoneet, varasto, konehuone ja putket. Kuorma on oikealla.')
  }

  function patchEquipment(id, patch) {
    setRooms((current) => current.map((room) => ({
      ...room,
      equipment: (room.equipment || []).map((eq) => (eq.id === id ? { ...eq, ...patch } : eq)),
    })))
  }

  function selectedTarget() {
    const id = selectedRef.current[selectedRef.current.length - 1]
    if (!id) return null
    const room = roomsRef.current.find((item) => item.id === id)
    if (room) return { kind: 'room', room }
    for (const host of roomsRef.current) {
      const eq = (host.equipment || []).find((item) => item.id === id)
      if (eq) return { kind: 'equipment', room: host, eq }
    }
    const pipe = pipesRef.current.find((item) => item.id === id)
    if (pipe) return { kind: 'pipe', pipe }
    const cable = cablesRef.current.find((item) => item.id === id)
    if (cable) return { kind: 'cable', cable }
    return null
  }

  function rotateSelected(delta) {
    const target = selectedTarget()
    if (!target) return
    pushUndo()
    if (target.kind === 'equipment') {
      if (target.eq.category === 'door') {
        const wall = rotateDoorWall(target.eq.wall, delta)
        patchEquipment(target.eq.id, doorOnWall(target.room, target.eq, wall))
        return
      }
      patchEquipment(target.eq.id, { rotation: ((target.eq.rotation || 0) + delta + 360) % 360 })
      return
    }
    if (target.kind === 'room') {
      const quarter = delta >= 0 ? 90 : -90
      setRooms((current) => current.map((room) => {
        if (room.id !== target.room.id) return room
        const turned = quarter === 90 || quarter === -90
        return {
          ...room,
          width: turned ? room.depth : room.width,
          depth: turned ? room.width : room.depth,
          outline: room.outline ? room.outline.map((point) => {
            const dx = point.x - room.x
            const dz = point.z - room.z
            const t = (quarter * Math.PI) / 180
            const c = Math.cos(t)
            const s = Math.sin(t)
            return { x: room.x + dx * c - dz * s, z: room.z + dx * s + dz * c }
          }) : room.outline,
          equipment: (room.equipment || []).map((eq) => {
            const t = (quarter * Math.PI) / 180
            const c = Math.cos(t)
            const s = Math.sin(t)
            return {
              ...eq,
              x: eq.x * c - eq.z * s,
              z: eq.x * s + eq.z * c,
              rotation: ((eq.rotation || 0) + quarter + 360) % 360,
            }
          }),
        }
      }))
    }
  }

  function nudgeElevation(delta) {
    const target = selectedTarget()
    if (!target) return
    pushUndo()
    if (target.kind === 'equipment') {
      const current = Number.isFinite(target.eq.elevation) ? target.eq.elevation : defaultElevation(target.room, target.eq)
      patchEquipment(target.eq.id, { elevation: Math.max(0, current + delta), mount: target.eq.mount || 'wall' })
    } else if (target.kind === 'room') {
      setRooms((current) => current.map((room) => (room.id === target.room.id ? { ...room, height: Math.max(0.4, room.height + delta) } : room)))
    }
  }

  function nudgeSize(key) {
    const target = selectedTarget()
    if (target?.kind !== 'equipment') return
    const step = 0.1
    const patch = {}
    if (key === 'ArrowRight') patch.width = Math.max(0.1, target.eq.width + step)
    if (key === 'ArrowLeft') patch.width = Math.max(0.1, target.eq.width - step)
    if (key === 'ArrowDown') patch.depth = Math.max(0.1, target.eq.depth + step)
    if (key === 'ArrowUp') patch.depth = Math.max(0.1, target.eq.depth - step)
    if (target.eq.mount === 'ceiling' || target.eq.category === 'evaporator') {
      const height = patch.height || target.eq.height
      patch.elevation = Math.max(0, (target.room.height - (target.room.ceilingThickness || target.room.wallThickness || 0.1)) - height)
    }
    pushUndo()
    patchEquipment(target.eq.id, patch)
  }

  function duplicateSelected() {
    const target = selectedTarget()
    if (!target) return
    pushUndo()
    if (target.kind === 'equipment') {
      const copy = { ...target.eq, id: genId(), x: target.eq.x + 0.45, z: target.eq.z + 0.45 }
      setRooms((current) => current.map((room) => (
        room.id === target.room.id ? { ...room, equipment: [...room.equipment, copy] } : room
      )))
      setSelectedIds([copy.id])
      return
    }
    if (target.kind === 'pipe') {
      const copy = { ...target.pipe, id: genId(), points: target.pipe.points.map((point) => ({ x: point.x + 0.4, z: point.z + 0.4 })) }
      setPipes([...pipesRef.current, copy])
      setSelectedIds([copy.id])
      return
    }
    if (target.kind === 'cable') {
      const copy = { ...target.cable, id: genId(), points: target.cable.points.map((point) => ({ x: point.x + 0.3, z: point.z + 0.3 })) }
      setCables([...cablesRef.current, copy])
      setSelectedIds([copy.id])
      return
    }
    if (target.kind === 'room') {
      const copy = {
        ...structuredClone(target.room),
        id: genId(),
        label: '',
        x: target.room.x + 1,
        z: target.room.z + 1,
        equipment: (target.room.equipment || []).map((eq) => ({ ...eq, id: genId() })),
      }
      const normalized = normalizeRooms([...roomsRef.current, copy])
      setRooms(normalized)
      setSelectedIds([normalized[normalized.length - 1].id])
    }
  }

  function exportPdf() {
    const doc = buildPdf({ projectName: name, userEmail: user?.email || '', rooms, unitSystem, pipes, cables, schematic })
    doc.save(pdfFilename(name))
  }

  function exportDxf() {
    const text = buildDxf({ projectName: name, rooms, pipes, cables, schematic })
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i)
      bytes[i] = code > 255 ? 63 : code
    }
    const blob = new Blob([bytes], { type: 'application/dxf' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = dxfFilename(name)
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ projectName: name, rooms, unitSystem, pipes, cables, schematic }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${(name || 'refcad').replace(/\s+/g, '_')}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function importJson(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (!Array.isArray(data.rooms)) throw new Error('rooms')
        pushUndo()
        setName(data.projectName || data.name || name)
        setRooms(normalizeRooms(data.rooms))
        setPipes(Array.isArray(data.pipes) ? data.pipes : [])
        setCables(Array.isArray(data.cables) ? data.cables : [])
        if (data.schematic && typeof data.schematic === 'object') setSchematic((current) => ({ ...current, ...data.schematic }))
        if (data.unitSystem === 'IP' || data.unitSystem === 'SI') setUnitSystem(data.unitSystem)
        setNotice('Tuotu JSON-tiedosto.')
      } catch {
        setNotice('Tiedosto ei ole RefCAD-projekti.')
      }
    }
    reader.readAsText(file)
  }

  const saveText = saveState === 'saving' ? 'Tallentaa…' : saveState === 'error' ? 'Tallennus epäonnistui' : `Tallennettu ${persistLabel}`
  const planProps = {
    rooms,
    selectedIds,
    tool,
    placing,
    unitSystem,
    gridSize,
    snapOn,
    snapFlags,
    fitToken,
    onSelect: setSelectedIds,
    onPreview: setRooms,
    onGestureStart: pushUndo,
    onGestureEnd: () => {
      setRooms((current) => current.map((room) => ({
        ...room,
        equipment: (room.equipment || []).map((eq) => {
          if (!isOutdoorCategory(eq.category)) return eq
          const wx = room.x + eq.x
          const wz = room.z + eq.z
          if (!insideRefrigerated(current, wx, wz)) return eq
          const snapped = snapOutdoorUnit(current, eq, wx, wz, { mount: eq.mount || 'wall' })
          setNotice(snapped.warning || 'Ulkoyksikkö siirrettiin kylmähuoneen ulkopuolelle.')
          return { ...eq, x: snapped.x - room.x, z: snapped.z - room.z, rotation: snapped.rotation, mount: eq.mount || snapped.mount }
        }),
      })))
    },
    onCreateRect,
    onCreatePolygon,
    onCreateRoute,
    onPlace,
    onContextMenu: (hit) => {
      setSelectedIds([hit.id])
      setMenu(hit)
    },
    pipes,
    cables,
    pipeKind,
    notice,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#e7e5e4', color: '#1c1917' }}>
      <header style={{
        display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 8,
        height: 48, padding: '0 10px', overflow: 'hidden',
        background: '#14181f', borderBottom: '1px solid #0c0f14', color: '#f5f5f4',
      }}>
        <Link href="/projects" style={{ color: '#99f6e4', fontWeight: 800, textDecoration: 'none', fontSize: 14, letterSpacing: -0.2, flexShrink: 0 }}>RefCAD</Link>
        <input
          aria-label="Projektin nimi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            background: 'transparent', border: 'none', color: '#fff',
            fontWeight: 650, fontSize: 13, width: 148, minWidth: 72, flex: '0 1 160px',
            padding: '4px 2px',
          }}
        />
        <span title={saveText} style={{ fontSize: 11, color: saveState === 'error' ? '#fca5a5' : '#86efac', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {saveState === 'error' ? 'Virhe' : saveState === 'saving' ? 'Tallentaa' : 'Tallennettu'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b', flexShrink: 0 }}>
          <button type="button" data-testid="tool-select" title="Valitse (V)" style={iconBtn(tool === 'select' && !placing)} onClick={() => { setTool('select'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M4 2.4 L4 13.2 L7.1 9.8 L10.4 14 L11.8 13.2 L8.5 9 L12.8 8.4 Z" /></Icon>
          </button>
          <button type="button" data-testid="tool-draw" title="Huone, suorakulmio (R)" style={iconBtn(tool === 'draw')} onClick={() => { setTool('draw'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3.2 3.6 H12.8 V12.4 H3.2 Z" /></Icon>
          </button>
          <button type="button" data-testid="tool-polygon" title="Monikulmio (P)" style={iconBtn(tool === 'polygon')} onClick={() => { setTool('polygon'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3.2 11.2 L6.2 3 L13 5.2 L11 13 Z" /></Icon>
          </button>
          <button type="button" data-testid="tool-partition" title="Väliseinä (W)" style={iconBtn(tool === 'partition')} onClick={() => { setTool('partition'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3 3.2 H13 V12.8 H8.2 V3.2" /></Icon>
          </button>
          <button type="button" data-testid="tool-pipe" title="Putki (L)" style={iconBtn(tool === 'pipe')} onClick={() => { setTool('pipe'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3 12.2 H7 V4.2 H13" /></Icon>
          </button>
          <button type="button" data-testid="auto-pipe" title="Luo kylmäainepiiri laitteista" style={textBtn(false)} onClick={runAutoPipe}>Autoputkitus</button>
          <button type="button" data-testid="tool-cable" title="Kaapeli (K)" style={iconBtn(tool === 'cable')} onClick={() => { setTool('cable'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3 4.2 H6.2 V8 H9.8 V4.2 H13 V12.2" /></Icon>
          </button>
        </div>
        <select aria-label="Huonetyyppi" value={drawType} onChange={(e) => setDrawType(e.target.value)} style={{ background: '#1c212b', color: '#f5f5f4', border: '1px solid transparent', borderRadius: 8, height: 32, padding: '0 8px', fontSize: 12, maxWidth: 132, flexShrink: 1 }}>
          {ROOM_TYPES.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b', flexShrink: 0 }}>
          <button type="button" title="Pohjakuva" style={textBtn(view === '2d')} onClick={() => setView('2d')}>2D</button>
          <button type="button" data-testid="view-3d" title="Kolmiulotteinen näkymä" style={textBtn(view === '3d')} onClick={() => setView('3d')}>3D</button>
          <button type="button" data-testid="view-split" title="Pohja ja 3D rinnakkain" style={textBtn(view === 'split')} onClick={() => setView('split')}>Jaettu</button>
          <button type="button" data-testid="view-schematic" title="Periaatekaavio" style={textBtn(view === 'schematic')} onClick={() => setView('schematic')}>Kaavio</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b', flexShrink: 0 }}>
          <button type="button" data-testid="unit-si" title="SI-yksiköt" style={textBtn(unitSystem === 'SI')} onClick={() => setUnitSystem('SI')}>SI</button>
          <button type="button" data-testid="unit-ip" title="IP-yksiköt" style={textBtn(unitSystem === 'IP')} onClick={() => setUnitSystem('IP')}>IP</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button type="button" title="Kumoa (Ctrl+Z)" onClick={undo} style={iconBtn(false)}>
            <Icon><path {...stroke} d="M4 7.5 H11 A3.2 3.2 0 1 1 11 11.2" /><path {...stroke} d="M4 4.6 V7.8 H7.2" /></Icon>
          </button>
          <button type="button" title="Tee uudelleen (Ctrl+Y)" onClick={redo} style={iconBtn(false)}>
            <Icon><path {...stroke} d="M12 7.5 H5 A3.2 3.2 0 1 0 5 11.2" /><path {...stroke} d="M12 4.6 V7.8 H8.8" /></Icon>
          </button>
          <button type="button" title="Sovita näkymä (F)" onClick={() => setFitToken((token) => token + 1)} style={iconBtn(false)}>
            <Icon><path {...stroke} d="M3.2 6.2 V3.2 H6.2 M9.8 3.2 H12.8 V6.2 M12.8 9.8 V12.8 H9.8 M6.2 12.8 H3.2 V9.8" /></Icon>
          </button>
        </div>
        <span style={{ flex: 1, minWidth: 8 }} />
        <button type="button" data-testid="example-enquiry" title="Esimerkki 8 × 12 × 6 m" onClick={loadExample} style={textBtn(false)}>Esimerkki</button>
        <div style={{ position: 'relative', flexShrink: 0 }} onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" title="Vie ja tuo" aria-expanded={exportOpen} onClick={() => setExportOpen((open) => !open)} style={textBtn(exportOpen)}>Vie</button>
          {exportOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 36, width: 188, zIndex: 30,
              background: '#1c212b', border: '1px solid #3f3f46', borderRadius: 10,
              padding: 4, boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
            }}>
              {[
                { id: 'pdf', test: 'export-pdf', label: 'PDF-tarjous', run: exportPdf },
                { id: 'dxf', test: 'export-dxf', label: 'DXF-pohja', run: exportDxf },
                { id: 'json', test: undefined, label: 'JSON', run: exportJson },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={item.test}
                  onClick={() => { setExportOpen(false); item.run() }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                    background: 'transparent', color: '#f5f5f4', border: 'none', borderRadius: 7,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transform: 'none',
                  }}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setExportOpen(false); fileRef.current?.click() }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                  background: 'transparent', color: '#f5f5f4', border: 'none', borderRadius: 7,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transform: 'none',
                }}
              >
                Tuo JSON
              </button>
              {user && (
                <form action="/api/auth/logout" method="POST">
                  <button type="submit" style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                    background: 'transparent', color: '#fecaca', border: 'none', borderRadius: 7,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transform: 'none',
                  }}>Poistu</button>
                </form>
              )}
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside data-testid="template-library" style={{ width: 248, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderRight: '1px solid #e7e5e4' }}>
          <button type="button" onClick={() => setRoomsOpen((open) => !open)} style={sectionHead}>
            <span>Huoneet</span><span>{roomsOpen ? '−' : '+'}</span>
          </button>
          {roomsOpen && (
            <div style={{ padding: '4px 8px 8px' }}>
              {rooms.length === 0 && <div style={{ fontSize: 12, color: '#78716c', margin: '4px 4px 8px', lineHeight: 1.4 }}>Piirrä huone tai avaa esimerkki.</div>}
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => { setSelectedIds([room.id]); setTool('select') }}
                  style={{
                    width: '100%', textAlign: 'left', marginBottom: 4, padding: '6px 8px',
                    borderRadius: 8, cursor: 'pointer', color: '#1c1917', transform: 'none',
                    border: selectedRoom?.id === room.id ? '1px solid #0f766e' : '1px solid #e7e5e4',
                    background: selectedRoom?.id === room.id ? '#f0fdfa' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 8, height: 28, borderRadius: 2, background: room.color, flexShrink: 0 }} />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 12 }}>{room.label}</strong> <span style={{ fontSize: 12 }}>{room.name}</span>
                      <div style={{ fontSize: 10, color: '#78716c' }}>{room.temp}°C · {room.width.toFixed(1)}×{room.depth.toFixed(1)} m{room.parentId ? ' · väliseinä' : ''}</div>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button type="button" onClick={() => setTemplatesOpen((open) => !open)} style={{ ...sectionHead, borderTop: '1px solid #e7e5e4' }}>
            <span>Mallikirjasto</span><span>{templatesOpen ? '−' : '+'}</span>
          </button>
          {templatesOpen && (
            <div style={{ padding: '2px 8px 10px' }}>
              <div style={{ fontSize: 11, color: '#78716c', margin: '2px 4px 8px', lineHeight: 1.4 }}>Valitse malli ja klikkaa huonetta. Lauhdutin ja koneikko asettuvat ulkoseinälle.</div>
              {roomResult && (
                <div data-testid="capacity-banner" style={{ margin: '0 4px 8px', padding: '8px 8px', borderRadius: 8, background: '#f0fdfa', border: '1px solid #99f6e4', fontSize: 11, color: '#115e59', lineHeight: 1.4 }}>
                  <strong>Tarve {roomResult.total / 1000 < 10 ? (roomResult.total / 1000).toFixed(2) : (roomResult.total / 1000).toFixed(1)} kW</strong>
                  <div>Näytetään koot, jotka kattavat kuorman. Lauhdutin mitoitetaan lämmönluovutukselle (noin 1,25 ×).</div>
                  <button type="button" data-testid="show-all-sizes" onClick={() => setShowAllSizes((value) => !value)} style={{ marginTop: 6, border: 'none', background: 'transparent', color: '#0f766e', fontWeight: 700, cursor: 'pointer', padding: 0, transform: 'none' }}>
                    {showAllSizes ? 'Näytä vain sopivat koot' : 'Näytä kaikki koot'}
                  </button>
                </div>
              )}
              {TEMPLATE_GROUPS.map((group) => {
                const items = templatesForGroup(group.id, roomResult ? roomResult.total / 1000 : null, { showAll: showAllSizes || !roomResult })
                if (!items.length) return null
                return (
                <div key={group.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#a8a29e', margin: '2px 4px 4px', fontWeight: 700, letterSpacing: 0.4 }}>{group.label}</div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`template-${item.id}`}
                      onClick={() => { setPlacingId(item.id); setTool('select'); setNotice(`Klikkaa huonetta: ${item.name}`) }}
                      style={{
                        width: '100%', textAlign: 'left', marginBottom: 3, padding: '4px 6px',
                        borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#1c1917', transform: 'none',
                        display: 'flex', alignItems: 'center', gap: 8,
                        border: placingId === item.id ? '1px solid #0f766e' : '1px solid #e7e5e4',
                        background: placingId === item.id ? '#f0fdfa' : '#fff',
                      }}
                    >
                      <TemplateThumb item={item} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600 }}>{item.name}</span>
                        {item.capacityKw ? <span style={{ fontSize: 10, color: '#78716c' }}>{item.capacityKw} kW</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              )})}
            </div>
          )}
          <div style={{ padding: '0 8px 12px' }}>
            <button
              type="button"
              onClick={() => setGridSize((g) => (g === 0.1 ? 0.25 : g === 0.25 ? 0.5 : 0.1))}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #e7e5e4', background: '#fff', color: '#44403c', fontSize: 12, transform: 'none' }}
            >
              Ruutu {snapOn ? `${gridSize} m` : 'pois'}
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {pipeOffer && (
            <div data-testid="outdoor-move-offer" style={{ position: 'absolute', top: 12, left: 12, zIndex: 6, maxWidth: 420, padding: '10px 12px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.4 }}>{notice}</div>
              <button type="button" data-testid="accept-outdoor-move" onClick={acceptOutdoorMove} style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                Siirrä ulkoseinälle ja putkita
              </button>
            </div>
          )}
          {view === 'schematic' ? (
            <SchematicView
              rooms={rooms}
              projectName={name}
              settings={schematic}
              onChange={setSchematic}
              loads={Object.fromEntries((result.rooms || []).map((room) => [room.id, room.total]))}
            />
          ) : view === 'split' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
              <PlanView {...planProps} />
              <div style={{ borderLeft: '1px solid #d6d3d1' }}>
                <Scene3D rooms={rooms} pipes={pipes} selectedId={selectedId} onSelect={(id) => setSelectedIds(id ? [id] : [])} onContext={(hit) => { setSelectedIds([hit.id]); setMenu(hit) }} unitSystem={unitSystem} />
              </div>
            </div>
          ) : view === '3d' ? (
            <Scene3D rooms={rooms} pipes={pipes} selectedId={selectedId} onSelect={(id) => setSelectedIds(id ? [id] : [])} onContext={(hit) => { setSelectedIds([hit.id]); setMenu(hit) }} unitSystem={unitSystem} />
          ) : (
            <PlanView {...planProps} />
          )}
          {(tool === 'pipe' || tool === 'cable') && view !== '3d' && view !== 'schematic' && (
            <div data-testid="pipe-settings" style={{ position: 'absolute', top: 12, right: 12, zIndex: 4, display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,0.96)', border: '1px solid #e7e5e4', borderRadius: 10, padding: '6px 8px' }}>
              {tool === 'pipe' && (
                <select aria-label="Putkityyppi" value={pipeKind} onChange={(e) => setPipeKind(e.target.value)} style={{ height: 28, borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12 }}>
                  <option value="suction">Imuputki</option>
                  <option value="liquid">Nesteputki</option>
                  <option value="hotgas">Kuumakaasu</option>
                  <option value="drain">Kondenssivesi</option>
                </select>
              )}
              {tool === 'pipe' && pipeKind !== 'drain' && (
                <>
                  <select aria-label="Kylmäaine" value={refrigerant} onChange={(e) => setRefrigerant(e.target.value)} style={{ height: 28, borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12 }}>
                    {REFRIGERANT_IDS.map((id) => <option key={id} value={id}>{id === 'R744' ? 'R744 / CO2' : id}</option>)}
                  </select>
                  <label style={{ fontSize: 11, color: '#44403c' }}>Te
                    <input aria-label="Höyrystymislämpötila" type="number" value={teC} onChange={(e) => setTeC(parseFloat(e.target.value) || 0)} style={{ width: 52, marginLeft: 4, height: 26, borderRadius: 6, border: '1px solid #d6d3d1' }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#44403c' }}>Tc
                    <input aria-label="Lauhtumislämpötila" type="number" value={tcC} onChange={(e) => setTcC(parseFloat(e.target.value) || 0)} style={{ width: 52, marginLeft: 4, height: 26, borderRadius: 6, border: '1px solid #d6d3d1' }} />
                  </label>
                </>
              )}
            </div>
          )}
          {pipes.length > 0 && view !== '3d' && view !== 'schematic' && (
            <div data-testid="pipe-legend" style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 4, background: 'rgba(255,255,255,0.94)', border: '1px solid #e7e5e4', borderRadius: 10, padding: '8px 10px', maxWidth: 320 }}>
              {['suction', 'liquid', 'liquidReturn', 'hotgas', 'drain', 'drainHeat'].map((key) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#44403c', marginBottom: 3 }}>
                  <span style={{ width: 28, height: 0, borderTop: `3px ${key === 'liquid' || key === 'suction' ? 'solid' : 'dashed'} ${PIPE_STYLES[key].color}` }} />
                  <span>{PIPE_STYLES[key].legend}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: '#78716c', marginTop: 4, lineHeight: 1.35 }}>{INTERNAL_LIQUID_TRAIN}</div>
            </div>
          )}
          {rooms.length === 0 && view !== '3d' && view !== 'schematic' && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 72, textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#292524' }}>Piirrä kylmähuone pohjaan</div>
              <div style={{ fontSize: 13, color: '#78716c', marginTop: 6 }}>Huone (R), monikulmio (P) tai esimerkki 12 m × 8 m × 6 m.</div>
            </div>
          )}
        </main>

        {view !== 'schematic' && <aside style={{ width: 340, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderLeft: '1px solid #e7e5e4' }}>
          <HeatLoadPanel
            room={selectedRoom}
            rooms={rooms}
            result={result}
            roomResult={roomResult}
            unitSystem={unitSystem}
            onPatch={patchSelected}
            onFocusEdit={() => { editSnap.current = snapshot() }}
            onBlurEdit={() => {
              if (editSnap.current) {
                undoRef.current.push(editSnap.current)
                editSnap.current = null
              }
            }}
            selectedEquipment={selectedEquipment}
            selectedPipe={pipes.find((pipe) => pipe.id === selectedId) || null}
            pipes={pipes}
            onPatchEquipment={(patch) => {
              if (!selectedEquipment) return
              patchEquipment(selectedEquipment.id, patch)
            }}
            onPatchPipe={(patch) => {
              if (!selectedId) return
              setPipes((current) => current.map((pipe) => (pipe.id === selectedId ? { ...pipe, ...patch } : pipe)))
            }}
            onDeleteEquipment={deleteSelected}
          />
        </aside>}
      </div>
      {menu && (
        <ContextMenu
          menu={menu}
          rooms={rooms}
          pipes={pipes}
          onClose={() => setMenu(null)}
          onRotate={(delta) => { rotateSelected(delta); }}
          onAngle={(angle) => {
            const target = selectedTarget()
            if (target?.kind === 'equipment' && target.eq.category !== 'door') {
              pushUndo()
              patchEquipment(target.eq.id, { rotation: ((angle % 360) + 360) % 360 })
            } else rotateSelected(90)
          }}
          onResize={(patch) => {
            const target = selectedTarget()
            if (!target) return
            pushUndo()
            if (target.kind === 'equipment') patchEquipment(target.eq.id, patch)
            if (target.kind === 'room') patchSelected(patch)
          }}
          onElevation={(elevation, mount) => {
            const target = selectedTarget()
            if (target?.kind !== 'equipment') return
            pushUndo()
            const next = { elevation, mount: mount || target.eq.mount }
            if (mount === 'ceiling') next.elevation = defaultElevation(target.room, { ...target.eq, mount: 'ceiling' })
            if (mount === 'floor') next.elevation = 0
            if (mount === 'roof') next.elevation = target.room.height
            patchEquipment(target.eq.id, next)
          }}
          onDuplicate={() => { duplicateSelected(); setMenu(null) }}
          onDelete={() => { deleteSelected(); setMenu(null) }}
        />
      )}
    </div>
  )
}

function ContextMenu({ menu, rooms, pipes, onClose, onRotate, onAngle, onResize, onElevation, onDuplicate, onDelete }) {
  const host = rooms.find((room) => room.id === menu.id) || rooms.find((room) => (room.equipment || []).some((eq) => eq.id === menu.id))
  const eq = host?.equipment?.find((item) => item.id === menu.id) || null
  const pipe = pipes.find((item) => item.id === menu.id) || null
  const [angle, setAngle] = useState(eq?.rotation || 0)
  const [width, setWidth] = useState(eq?.width || host?.width || 1)
  const [depth, setDepth] = useState(eq?.depth || host?.depth || 1)
  const [height, setHeight] = useState(eq?.height || host?.height || 1)
  const [elevation, setElevation] = useState(eq ? (Number.isFinite(eq.elevation) ? eq.elevation : defaultElevation(host, eq)) : 0)
  const [mount, setMount] = useState(eq?.mount || 'floor')
  const left = Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 280)
  const top = Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 420)
  return (
    <div data-testid="context-menu" style={{ position: 'fixed', left, top, zIndex: 40, width: 260, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.16)', padding: 8 }} onMouseDown={(event) => event.stopPropagation()}>
      <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 6px 8px' }}>{eq?.name || pipe?.kind || host?.name || 'Kohde'}</div>
      {menu.kind !== 'pipe' && menu.kind !== 'cable' && (
        <>
          <MenuBtn testid="ctx-rotate-cw" onClick={() => onRotate(90)}>Käännä 90° myötäpäivään  ]</MenuBtn>
          <MenuBtn testid="ctx-rotate-ccw" onClick={() => onRotate(-90)}>Käännä 90° vastapäivään  [</MenuBtn>
          {eq && eq.category !== 'door' && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '4px 6px' }}>
              Kulma
              <input data-testid="ctx-angle" type="number" value={angle} onChange={(e) => setAngle(parseFloat(e.target.value) || 0)} style={{ width: 72 }} />
              <button type="button" onClick={() => onAngle(angle)} style={mini}>Aseta</button>
            </label>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, padding: '4px 6px' }}>
            <Tiny label="Lev" value={width} onChange={setWidth} />
            <Tiny label="Syv" value={depth} onChange={setDepth} />
            <Tiny label="Kork" value={height} onChange={setHeight} />
          </div>
          <MenuBtn testid="ctx-resize" onClick={() => onResize(eq ? { width, depth, height } : { width, depth, height })}>Aseta koko  Ctrl+nuolet</MenuBtn>
          {eq && (
            <>
              <label style={{ display: 'block', fontSize: 12, padding: '4px 6px' }}>
                Kiinnitys
                <select data-testid="ctx-mount" value={mount} onChange={(e) => setMount(e.target.value)} style={{ marginLeft: 6 }}>
                  <option value="floor">Lattia</option>
                  <option value="wall">Seinä</option>
                  <option value="ceiling">Katto</option>
                  <option value="roof">Vesikatto</option>
                </select>
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '4px 6px' }}>
                Korkeusasema m
                <input data-testid="ctx-elevation" type="number" step="0.05" value={elevation} onChange={(e) => setElevation(parseFloat(e.target.value) || 0)} style={{ width: 72 }} />
              </label>
              <MenuBtn testid="ctx-apply-elevation" onClick={() => onElevation(elevation, mount)}>Aseta korkeus  Alt+↑↓</MenuBtn>
            </>
          )}
        </>
      )}
      <MenuBtn testid="ctx-duplicate" onClick={onDuplicate}>Kopioi  Ctrl+D</MenuBtn>
      <MenuBtn testid="ctx-delete" onClick={onDelete}>Poista  Del</MenuBtn>
      <MenuBtn onClick={onClose}>Sulje</MenuBtn>
    </div>
  )
}

function MenuBtn({ children, onClick, testid }) {
  return (
    <button type="button" data-testid={testid} onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 8px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#1c1917', transform: 'none' }}>
      {children}
    </button>
  )
}

function Tiny({ label, value, onChange }) {
  return (
    <label style={{ fontSize: 10, color: '#78716c' }}>
      {label}
      <input type="number" step="0.05" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} style={{ width: '100%', marginTop: 2 }} />
    </label>
  )
}

const mini = { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, transform: 'none' }
