'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { LanguageSwitch, useLocale } from '@/components/i18n/Locale'
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
import { heightMetres, insertRisers, moveVertexPoints, riseMetres, setRunMount, splitPoints } from '@/lib/routeEdit'
import {
  defaultElevation,
  doorOnWall,
  insideRefrigerated,
  isOutdoorCategory,
  outlinePoints,
  pointInOutline,
  rotateDoorWall,
  snapOutdoorUnit,
} from '@/lib/placement'
import { judgePlacement, removeStackedEquipment } from '@/lib/placeOnce'
import { ModeChip, PlaceToast, modeChipText, placeFrame } from '@/components/mode/PlaceMode'
import { applyOutline, bboxOf, clampGroupTranslation, cleanOrthogonal, isRectangleOutline, scaleOutline, selfIntersects, translateOutline } from '@/lib/cadDraw'
import {
  DESIGNER_CLIPBOARD_KEY,
  classifyDesignerIds,
  designerClipboard,
  designerHits,
  designerShared,
  pasteDesignerClipboard,
  patchDesigner,
  runDesignerCommand,
  selectionBox,
} from '@/lib/cadEdit'
import { registerDrawingFlush } from '@/lib/staleDeploy'
import { useViewport } from '@/components/useViewport'
import { CadPrompt, CadToolbar, MultiProperties } from '../floorplan/CadTools'
import { calculateProject, resultFor } from '@/lib/heatLoad'
import { panelSchedule } from '@/lib/sharedWalls'
import { doorChoices, doorEquipmentPatch, doorSchedule, doorTypeById } from '@/lib/doors'
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
  background: active ? '#9a3412' : 'transparent',
  color: active ? '#fff7ed' : '#e7e5e4',
  boxShadow: active ? '0 0 0 2px #fdba74' : 'none',
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

const compactBtn = (active) => {
  const style = textBtn(active)
  delete style.display
  return { ...style, minHeight: 44, minWidth: 44, height: 44, padding: '0 12px' }
}

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
  const { t, locale, setLocale } = useLocale()
  const { compact } = useViewport()
  const [hand, setHand] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [drawer, setDrawer] = useState(null)
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
  const [repeatPlace, setRepeatPlace] = useState(false)
  const [toast, setToast] = useState('')
  const [flashId, setFlashId] = useState(null)
  const [toolMenu, setToolMenu] = useState(null)
  const [drawType, setDrawType] = useState('chilled')
  const [view, setView] = useState('2d')
  const [selectedIds, setSelectedIds] = useState([])
  const [cad, setCad] = useState(null)
  const [placingId, setPlacingId] = useState(null)
  useEffect(() => {
    if ((tool && tool !== 'select') || placingId) setHand(false)
  }, [tool, placingId])
  const lastPlace = useRef(null)
  const toastTimer = useRef(0)
  const finishRef = useRef(null)
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
  const originScene = useRef(null)
  const cadRef = useRef(null)
  const undoRef = useRef([])
  const redoRef = useRef([])
  const editSnap = useRef(null)
  const fileRef = useRef(null)
  roomsRef.current = rooms
  pipesRef.current = pipes
  cablesRef.current = cables
  selectedRef.current = selectedIds
  cadRef.current = cad
  const nameRef = useRef(name)
  const unitRef = useRef(unitSystem)
  const schematicRef = useRef(schematic)
  nameRef.current = name
  unitRef.current = unitSystem
  schematicRef.current = schematic
  const selectedId = selectedIds[selectedIds.length - 1] || null
  const snapFlags = { grid: snapOn, endpoint: true, midpoint: true, wall: true, ortho: true }

  const result = useMemo(() => calculateProject(rooms), [rooms])
  const panels = useMemo(() => panelSchedule(rooms), [rooms])
  const doors = useMemo(() => doorSchedule(rooms), [rooms])
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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        const hits = designerHits(
          { rooms: roomsRef.current, pipes: pipesRef.current, cables: cablesRef.current },
          selectionBox({ x: -1e6, z: -1e6 }, { x: 1e6, z: 1e6 }),
        )
        setSelectedIds(hits.map((item) => item.id))
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        const payload = designerClipboard({ rooms: roomsRef.current, pipes: pipesRef.current, cables: cablesRef.current }, selectedRef.current)
        window.localStorage.setItem(DESIGNER_CLIPBOARD_KEY, JSON.stringify(payload))
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        const payload = designerClipboard({ rooms: roomsRef.current, pipes: pipesRef.current, cables: cablesRef.current }, selectedRef.current)
        window.localStorage.setItem(DESIGNER_CLIPBOARD_KEY, JSON.stringify(payload))
        deleteSelected()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        let payload = null
        try { payload = JSON.parse(window.localStorage.getItem(DESIGNER_CLIPBOARD_KEY) || 'null') } catch (err) { payload = null }
        if (!payload) return
        pushUndo()
        const next = pasteDesignerClipboard({ rooms: roomsRef.current, pipes: pipesRef.current, cables: cablesRef.current }, payload, { x: (payload.rooms?.[0]?.x || 0) + 1, z: payload.rooms?.[0]?.z || 0 })
        setRooms(next.rooms)
        setPipes(next.pipes)
        setCables(next.cables)
      }       else if (e.key === 'Escape') {
        if (cadRef.current) {
          cadRef.current = null
          if (originScene.current) {
            setRooms(originScene.current.rooms)
            setPipes(originScene.current.pipes)
            setCables(originScene.current.cables)
          }
          originScene.current = null
          setCad(null)
        } else setSelectedIds([])
        setPlacingId(null)
        setTool('select')
        setNotice('')
        setMenu(null)
      } else if (e.key === 'Enter' && cadRef.current?.step === 'to') {
        confirmCad(cadRef.current.base || { x: 0, z: 0 })
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !cadRef.current && e.key.toLowerCase() === 'm') beginCad('move')
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && !cadRef.current && e.key.toLowerCase() === 'c') beginCad('copy')
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && !cadRef.current && e.key.toLowerCase() === 'e') beginCad('rotate')
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && !cadRef.current && e.key.toLowerCase() === 's') beginCad('scale')
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && !cadRef.current && e.key.toLowerCase() === 'b') beginCad('array')
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && !cadRef.current && e.key.toLowerCase() === 'o') beginCad('offset')
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && !cadRef.current && e.key.toLowerCase() === 't') beginCad('stretch')
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && !cadRef.current && e.key.toLowerCase() === 'n') beginCad('align')
      else if (e.key === ' ' && !e.repeat && (placingId || tool !== 'select')) {
        e.preventDefault()
        setPlacingId(null)
        setTool('select')
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'v') {
        setPlacingId(null)
        setTool('select')
      }
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
    return registerDrawingFlush(() => {
      onPersist({
        name: nameRef.current,
        rooms: roomsRef.current,
        unitSystem: unitRef.current,
        pipes: pipesRef.current,
        cables: cablesRef.current,
        schematic: schematicRef.current,
      })
    })
  }, [onPersist])

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
      setNotice(t('designer.minRoom'))
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
        setNotice(t('designer.partitionInside'))
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
    setNotice(t('designer.roomAdded', { label: room.label }))
  }

  function onCreatePolygon(points) {
    const clean = cleanOrthogonal(points)
    if (clean.length < 4 || selfIntersects(clean)) {
      setNotice(t('designer.badPolygon'))
      return
    }
    const box = bboxOf(clean)
    if (box.width < 0.8 || box.depth < 0.8) {
      setNotice(t('designer.minRoom'))
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
    setNotice(inside ? t('designer.addedPartition', { label: placed.label }) : t('designer.addedOutline', { label: placed.label }))
  }

  function showToast(text) {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  function onPlace(roomId, x, z, gesture) {
    if (!placingId) return
    const stamp = gesture || { at: Date.now(), px: NaN, py: NaN, shift: false }
    const current = roomsRef.current
    const room = current.find((item) => item.id === roomId)
    if (!room) return
    const eq = makeEquipment(placingId, room, x, z, current)
    const warning = eq.warning
    delete eq.warning
    const candidate = { ...eq, x: room.x + eq.x, z: room.z + eq.z, w: eq.width, d: eq.depth, name: eq.name }
    const items = (room.equipment || []).map((item) => ({ ...item, x: room.x + item.x, z: room.z + item.z, w: item.width, d: item.depth }))
    const verdict = judgePlacement({
      items,
      candidate,
      last: lastPlace.current,
      gesture: stamp,
      key: (item) => item.catalogId || '',
    })
    if (verdict.action === 'ignore') return
    if (verdict.action === 'duplicate') {
      lastPlace.current = stamp
      showToast(`${eq.name} on jo tässä`)
      setFlashId(verdict.existing?.id || null)
      if (verdict.existing?.id) setSelectedIds([verdict.existing.id])
      window.setTimeout(() => setFlashId(null), 900)
      return
    }
    lastPlace.current = stamp
    pushUndo()
    setRooms(current.map((item) => (
      item.id === roomId ? { ...item, equipment: [...item.equipment, eq] } : item
    )))
    setSelectedIds([eq.id])
    setNotice(warning || t('designer.placedIn', { name: eq.name, room: room.label }))
    if (!stamp.shift && !repeatPlace) {
      setPlacingId(null)
      setTool('select')
    }
  }

  function commitPipes(result) {
    pushUndo()
    const locked = pipesRef.current.filter((pipe) => pipe.locked)
    const lockedKey = new Set(locked.map((pipe) => `${pipe.kind}:${pipe.segment || ''}`))
    const fresh = (result.pipes || []).filter((pipe) => !lockedKey.has(`${pipe.kind}:${pipe.segment || ''}`))
    const loose = pipesRef.current.filter((pipe) => pipe.kind === 'cable' && !pipe.locked)
    setPipes([...locked, ...loose, ...fresh])
    setSelectedIds(fresh[0] ? [fresh[0].id] : (locked[0] ? [locked[0].id] : []))
    setNotice(locked.length ? t('designer.pipesKept', { notice: result.notice || t('designer.pipesDone') }) : result.notice)
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
      setNotice(t('designer.cableAdded'))
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
      ? t('designer.drainHeated')
      : t('designer.pipeAdded'))
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
    if (rooms.length && !window.confirm(t('designer.replaceExample'))) return
    pushUndo()
    const scene = decorateExample(buildEnquiryExample())
    setRooms(normalizeRooms(scene.rooms))
    setPipes(scene.pipes)
    setCables(scene.cables)
    setSelectedIds([scene.rooms[0].id])
    setView('2d')
    setFitToken((token) => token + 1)
    setNotice(t('designer.exampleLoaded'))
  }

  const routeBase = useRef(null)
  function onRouteDrag(kind, id, index, at, phase) {
    if (phase === 'start') {
      pushUndo()
      const list = kind === 'cable' ? cablesRef.current : pipesRef.current
      const item = list.find((entry) => entry.id === id)
      routeBase.current = item ? item.points.map((point) => ({ ...point })) : null
      return
    }
    if (phase !== 'move' || !at || !routeBase.current) return
    const points = moveVertexPoints(routeBase.current, index, at, { ortho: true })
    const apply = (items) => items.map((item) => (item.id === id ? { ...item, points, riseM: riseMetres(points), locked: true, manual: true } : item))
    if (kind === 'cable') setCables(apply(cablesRef.current))
    else setPipes(apply(pipesRef.current))
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
        setNotice(t('designer.imported'))
      } catch {
        setNotice(t('designer.badFile'))
      }
    }
    reader.readAsText(file)
  }

  function sceneNow() {
    return { rooms: roomsRef.current, pipes: pipesRef.current, cables: cablesRef.current }
  }

  function applyScene(next) {
    setRooms(next.rooms)
    setPipes(next.pipes || [])
    setCables(next.cables || [])
  }

  function beginCad(name, extra) {
    const scene = sceneNow()
    const ids = selectedRef.current
    const picks = classifyDesignerIds(scene, ids)
    if (name === 'delete') { deleteSelected(); return }
    if (name === 'group') {
      pushUndo()
      applyScene(patchDesigner(scene, picks, { groupId: `grp-${genId()}` }))
      return
    }
    if (name === 'ungroup') { pushUndo(); applyScene(patchDesigner(scene, picks, { groupId: undefined })); return }
    if (name === 'lock') { pushUndo(); applyScene(patchDesigner(scene, picks, { cadLock: true })); return }
    if (name === 'unlock') { pushUndo(); applyScene(patchDesigner(scene, picks, { cadLock: false })); return }
    if (name === 'hide') { pushUndo(); applyScene(patchDesigner(scene, picks, { hidden: true })); setSelectedIds([]); return }
    if (name === 'show') {
      pushUndo()
      applyScene(patchDesigner(scene, classifyDesignerIds(scene, [
        ...scene.rooms.map((room) => room.id),
        ...scene.rooms.flatMap((room) => (room.equipment || []).map((eq) => eq.id)),
        ...scene.pipes.map((pipe) => pipe.id),
        ...scene.cables.map((cable) => cable.id),
      ]), { hidden: false }))
      return
    }
    if (name === 'isolate') {
      pushUndo()
      const keep = new Set(ids)
      setRooms(scene.rooms.map((room) => ({
        ...room,
        hidden: !keep.has(room.id),
        equipment: (room.equipment || []).map((eq) => ({ ...eq, hidden: !keep.has(eq.id) && !keep.has(room.id) })),
      })))
      setPipes(scene.pipes.map((pipe) => ({ ...pipe, hidden: !keep.has(pipe.id) })))
      setCables(scene.cables.map((cable) => ({ ...cable, hidden: !keep.has(cable.id) })))
      return
    }
    if (name === 'layer') { pushUndo(); applyScene(patchDesigner(scene, picks, { layer: extra })); return }
    if (name === 'rotate90') {
      const room = scene.rooms.find((item) => ids.includes(item.id)) || scene.rooms[0]
      const base = { x: room?.x || 0, z: room?.z || 0 }
      pushUndo()
      applyScene(runDesignerCommand(scene, ids, { name: 'rotate', base, value: '90' }, base))
      return
    }
    if (name === 'similar') {
      const kind = picks[0]?.kind
      if (!kind) return
      const hits = designerHits(scene, selectionBox({ x: -1e6, z: -1e6 }, { x: 1e6, z: 1e6 })).filter((item) => item.kind === kind)
      setSelectedIds(hits.map((item) => item.id))
      return
    }
    if (!ids.length && name !== 'stretch' && name !== 'measure') return
    originScene.current = scene
    setCad({
      name,
      step: name === 'stretch' ? 'window' : 'base',
      copies: 1,
      count: 3,
      cols: 3,
      rows: 2,
      arrayMode: 'linear',
      edge: 'left',
      value: '',
    })
    setTool('select')
    setMenu(null)
  }

  function confirmCad(point) {
    const origin = originScene.current
    const current = cadRef.current
    if (!origin || !current || current.name === 'measure') {
      cadRef.current = null
      originScene.current = null
      setCad(null)
      return
    }
    cadRef.current = null
    const next = runDesignerCommand(origin, selectedRef.current, current, point)
    undoRef.current.push({
      rooms: structuredClone(origin.rooms),
      pipes: structuredClone(origin.pipes),
      cables: structuredClone(origin.cables),
    })
    redoRef.current = []
    applyScene(next)
    originScene.current = null
    setCad(null)
  }

  const saveText = saveState === 'saving' ? t('designer.savingNow') : saveState === 'error' ? t('designer.saveFailed') : t('designer.savedAs', { where: persistLabel })
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
          setNotice(snapped.warning || t('designer.movedOut'))
          return { ...eq, x: snapped.x - room.x, z: snapped.z - room.z, rotation: snapped.rotation, mount: eq.mount || snapped.mount }
        }),
      })))
    },
    onCreateRect,
    onCreatePolygon,
    onCreateRoute,
    onPlace,
    onPreviewPipes: setPipes,
    onPreviewCables: setCables,
    cad,
    onCadDown: (world) => {
      const current = cadRef.current
      if (!current) return
      if (current.step === 'base') {
        originScene.current = originScene.current || sceneNow()
        const next = { ...current, step: 'to', base: world }
        cadRef.current = next
        setCad(next)
        return
      }
      if (current.step === 'to') confirmCad(world)
    },
    onCadMove: (world) => {
      const current = cadRef.current
      if (!current || current.step !== 'to' || !originScene.current) return
      if (current.name === 'measure') {
        setCad({ ...current, readout: `${Math.round(Math.hypot(world.x - current.base.x, world.z - current.base.z) * 1000)} mm` })
        return
      }
      applyScene(runDesignerCommand(originScene.current, selectedRef.current, current, world))
    },
    onCadStretch: (box) => {
      const hits = designerHits(sceneNow(), box)
      setSelectedIds(hits.map((item) => item.id))
      setCad((current) => (current ? { ...current, step: 'base', box } : current))
    },
    onContextMenu: (hit) => {
      setSelectedIds([hit.id])
      setMenu(hit)
    },
    pipes,
    cables,
    pipeKind,
    notice,
    flashId,
    finishRef,
    onExitPlace: () => { setPlacingId(null); setTool('select'); setToolMenu(null) },
    onToolMenu: (x, y) => setToolMenu({ x, y }),
    hand,
  }

  const designName = placing?.name || (tool === 'draw' ? t('designer.room') : tool === 'polygon' ? t('designer.polygon') : tool === 'partition' ? t('designer.partition') : tool === 'pipe' ? t('designer.pipe') : tool === 'cable' ? t('designer.cable') : null)
  const designDrawing = Boolean(designName && !placing)
  const designLabel = modeChipText({ name: designName, repeat: repeatPlace && Boolean(placing), drawing: designDrawing })

  return (
    <div className="designer-app" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#e7e5e4', color: '#1c1917' }}>
      <header className={`designer-header${toolsOpen ? ' tools-open' : ''}`} style={{
        display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 8,
        height: 48, padding: '0 10px', overflow: 'hidden',
        background: '#14181f', borderBottom: '1px solid #0c0f14', color: '#f5f5f4',
      }}>
        <Link href="/projects" style={{ color: '#99f6e4', fontWeight: 800, textDecoration: 'none', fontSize: 14, letterSpacing: -0.2, flexShrink: 0 }}>RefCAD</Link>
        <div className="designer-tool"><LanguageSwitch value={locale} onChange={setLocale} /></div>
        <LanguageSwitch className="compact-only" value={locale} onChange={setLocale} />
        <Link href="/pohjakuva" data-testid="open-floorplan" title={t('designer.floorplanTitle')} style={{ color: '#e7e5e4', textDecoration: 'none', fontSize: 12, fontWeight: 650, padding: '4px 8px', borderRadius: 8, background: '#1c212b', flexShrink: 0 }}>{t('designer.floorplan')}</Link>
        <input
          aria-label={t('designer.projectName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            background: 'transparent', border: 'none', color: '#fff',
            fontWeight: 650, fontSize: 13, width: 148, minWidth: 72, flex: '0 1 160px',
            padding: '4px 2px',
          }}
        />
        <span title={saveText} style={{ fontSize: 11, color: saveState === 'error' ? '#fca5a5' : '#86efac', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {saveState === 'error' ? t('designer.error') : saveState === 'saving' ? t('designer.saving') : t('designer.saved')}
        </span>
        <button type="button" className="compact-only" data-testid="designer-tools" aria-expanded={toolsOpen} onClick={() => setToolsOpen((open) => !open)} style={compactBtn(toolsOpen)}>{t('edit.tools')}</button>
        <button type="button" className="compact-only" data-testid="designer-hand" aria-pressed={hand} onClick={() => setHand((value) => !value)} style={compactBtn(hand)}>{hand ? t('edit.draw') : t('edit.pan')}</button>
        <button type="button" className="compact-only" data-testid="designer-rooms" aria-pressed={drawer === 'rooms'} onClick={() => setDrawer((current) => current === 'rooms' ? null : 'rooms')} style={compactBtn(drawer === 'rooms')}>{t('designer.rooms')}</button>
        <button type="button" className="compact-only" data-testid="designer-info" aria-pressed={drawer === 'info'} onClick={() => setDrawer((current) => current === 'info' ? null : 'info')} style={compactBtn(drawer === 'info')}>{t('designer.info')}</button>
        <div className="designer-tool" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b', flexShrink: 0 }}>
          <button type="button" data-testid="tool-select" aria-pressed={tool === 'select' && !placing} title={t('designer.selectTitle')} style={iconBtn(tool === 'select' && !placing)} onClick={() => { setTool('select'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M4 2.4 L4 13.2 L7.1 9.8 L10.4 14 L11.8 13.2 L8.5 9 L12.8 8.4 Z" /></Icon>
          </button>
          <button type="button" data-testid="tool-draw" aria-pressed={tool === 'draw'} title={t('designer.roomTitle')} style={iconBtn(tool === 'draw')} onClick={() => { if (tool === 'draw') { setTool('select'); return } setTool('draw'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3.2 3.6 H12.8 V12.4 H3.2 Z" /></Icon>
          </button>
          <button type="button" data-testid="tool-polygon" aria-pressed={tool === 'polygon'} title={t('designer.polygonTitle')} style={iconBtn(tool === 'polygon')} onClick={() => { if (tool === 'polygon') { setTool('select'); return } setTool('polygon'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3.2 11.2 L6.2 3 L13 5.2 L11 13 Z" /></Icon>
          </button>
          <button type="button" data-testid="tool-partition" aria-pressed={tool === 'partition'} title={t('designer.partitionTitle')} style={iconBtn(tool === 'partition')} onClick={() => { if (tool === 'partition') { setTool('select'); return } setTool('partition'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3 3.2 H13 V12.8 H8.2 V3.2" /></Icon>
          </button>
          <button type="button" data-testid="tool-pipe" aria-pressed={tool === 'pipe'} title={t('designer.pipeTitle')} style={iconBtn(tool === 'pipe')} onClick={() => { if (tool === 'pipe') { setTool('select'); return } setTool('pipe'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3 12.2 H7 V4.2 H13" /></Icon>
          </button>
          <button type="button" data-testid="auto-pipe" title={t('designer.autoPipeTitle')} style={textBtn(false)} onClick={runAutoPipe}>{t('designer.autoPipe')}</button>
          <button type="button" data-testid="tool-cable" aria-pressed={tool === 'cable'} title={t('designer.cableTitle')} style={iconBtn(tool === 'cable')} onClick={() => { if (tool === 'cable') { setTool('select'); return } setTool('cable'); setPlacingId(null) }}>
            <Icon><path {...stroke} d="M3 4.2 H6.2 V8 H9.8 V4.2 H13 V12.2" /></Icon>
          </button>
          <button type="button" data-testid="repeat-place" aria-pressed={repeatPlace} title={t('designer.repeatTitle')} style={{ ...textBtn(false), ...(repeatPlace ? { background: '#9a3412', color: '#fff7ed', boxShadow: '0 0 0 2px #fdba74' } : {}) }} onClick={() => setRepeatPlace((value) => !value)}>{t('designer.repeat')}</button>
          <button type="button" data-testid="cleanup-duplicates" title={t('designer.cleanupTitle')} style={textBtn(false)} onClick={() => {
            const result = removeStackedEquipment(roomsRef.current)
            if (!result.removed) { showToast(t('toast.noneStacked')); return }
            pushUndo()
            setRooms(result.rooms)
            showToast(t('toast.removedStacked', { count: result.removed }))
          }}>{t('edit.cleanup')}</button>
        </div>
        <div className="designer-tool">
          <select aria-label={t('designer.roomType')} value={drawType} onChange={(e) => setDrawType(e.target.value)} style={{ background: '#1c212b', color: '#f5f5f4', border: '1px solid transparent', borderRadius: 8, height: 44, padding: '0 8px', fontSize: 12, maxWidth: 160, flexShrink: 1 }}>
            {ROOM_TYPES.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </div>
        <div className="designer-tool" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b', flexShrink: 0 }}>
          <button type="button" title={t('designer.viewPlan')} style={textBtn(view === '2d')} onClick={() => setView('2d')}>2D</button>
          <button type="button" data-testid="view-3d" title={t('designer.view3d')} style={textBtn(view === '3d')} onClick={() => setView('3d')}>3D</button>
          <button type="button" data-testid="view-split" title={t('designer.splitTitle')} style={textBtn(view === 'split')} onClick={() => setView('split')}>{t('designer.split')}</button>
          <button type="button" data-testid="view-schematic" title={t('designer.schematicTitle')} style={textBtn(view === 'schematic')} onClick={() => setView('schematic')}>{t('designer.schematic')}</button>
        </div>
        <div className="designer-tool" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b', flexShrink: 0 }}>
          <button type="button" data-testid="unit-si" title={t('designer.unitsSi')} style={textBtn(unitSystem === 'SI')} onClick={() => setUnitSystem('SI')}>SI</button>
          <button type="button" data-testid="unit-ip" title={t('designer.unitsIp')} style={textBtn(unitSystem === 'IP')} onClick={() => setUnitSystem('IP')}>IP</button>
        </div>
        <div className="designer-tool" style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button type="button" title={t('designer.undoTitle')} onClick={undo} style={iconBtn(false)}>
            <Icon><path {...stroke} d="M4 7.5 H11 A3.2 3.2 0 1 1 11 11.2" /><path {...stroke} d="M4 4.6 V7.8 H7.2" /></Icon>
          </button>
          <button type="button" title={t('designer.redoTitle')} onClick={redo} style={iconBtn(false)}>
            <Icon><path {...stroke} d="M12 7.5 H5 A3.2 3.2 0 1 0 5 11.2" /><path {...stroke} d="M12 4.6 V7.8 H8.8" /></Icon>
          </button>
          <button type="button" title={t('designer.fitTitle')} onClick={() => setFitToken((token) => token + 1)} style={iconBtn(false)}>
            <Icon><path {...stroke} d="M3.2 6.2 V3.2 H6.2 M9.8 3.2 H12.8 V6.2 M12.8 9.8 V12.8 H9.8 M6.2 12.8 H3.2 V9.8" /></Icon>
          </button>
        </div>
        <span style={{ flex: 1, minWidth: 8 }} />
        <button type="button" className="designer-tool" data-testid="example-enquiry" title={t('designer.exampleTitle')} onClick={loadExample} style={textBtn(false)}>{t('designer.example')}</button>
        <div style={{ position: 'relative', flexShrink: 0 }} onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" title={t('designer.exportTitle')} aria-expanded={exportOpen} onClick={() => setExportOpen((open) => !open)} style={textBtn(exportOpen)}>{t('designer.export')}</button>
          {exportOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 36, width: 188, zIndex: 30,
              background: '#1c212b', border: '1px solid #3f3f46', borderRadius: 10,
              padding: 4, boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
            }}>
              {[
                { id: 'pdf', test: 'export-pdf', label: t('designer.pdf'), run: exportPdf },
                { id: 'dxf', test: 'export-dxf', label: t('designer.dxf'), run: exportDxf },
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
                {t('designer.import')}
              </button>
              {user && (
                <form action="/api/auth/logout" method="POST">
                  <button type="submit" style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                    background: 'transparent', color: '#fecaca', border: 'none', borderRadius: 7,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transform: 'none',
                  }}>{t('designer.signOut')}</button>
                </form>
              )}
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
      </header>

      <div className={`designer-cad${toolsOpen ? ' tools-open' : ''}`}>
      <CadToolbar
        active={cad?.name}
        onCommand={beginCad}
        onSelectType={(type) => {
          const hits = designerHits(sceneNow(), selectionBox({ x: -1e6, z: -1e6 }, { x: 1e6, z: 1e6 }))
          setSelectedIds(hits.filter((item) => {
            if (!type || type === 'all') return true
            if (type === 'room') return item.kind === 'room'
            if (type === 'door') {
              const room = roomsRef.current.find((entry) => (entry.equipment || []).some((eq) => eq.id === item.id))
              return room?.equipment?.find((eq) => eq.id === item.id)?.category === 'door'
            }
            if (type === 'electric') return item.kind === 'cable'
            return item.kind === 'room' || item.kind === type
          }).map((item) => item.id))
        }}
        onLayer={(layer) => beginCad('layer', layer)}
      />
      </div>
      {cad && (
        <div style={{ padding: '4px 10px', background: '#f5f5f4', borderBottom: '1px solid #e7e5e4' }}>
          <CadPrompt
            command={cad}
            readout={cad.readout}
            onChange={(patch) => setCad((current) => {
              if (!current) return current
              const next = { ...current, ...patch }
              cadRef.current = next
              return next
            })}
            onApply={() => { if (cad.step === 'to') confirmCad(cad.base || { x: 0, z: 0 }) }}
            onCancel={() => {
              cadRef.current = null
              if (originScene.current) applyScene(originScene.current)
              originScene.current = null
              setCad(null)
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
        {compact && drawer && (
          <button type="button" className="drawer-backdrop" data-testid="drawer-backdrop" aria-label="Sulje tiedot" onClick={() => setDrawer(null)} />
        )}
        <aside
          data-testid="template-library"
          className="designer-library"
          data-open={compact && drawer === 'rooms' ? 'true' : 'false'}
          style={compact ? undefined : { width: 248, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderRight: '1px solid #e7e5e4' }}
        >
          {compact && <button type="button" data-testid="close-rooms" onClick={() => setDrawer(null)}>Sulje</button>}
          <button type="button" onClick={() => setRoomsOpen((open) => !open)} style={sectionHead}>
            <span>Huoneet</span><span>{roomsOpen ? '−' : '+'}</span>
          </button>
          {roomsOpen && (
            <div style={{ padding: '4px 8px 8px' }}>
              {rooms.length === 0 && <div style={{ fontSize: 12, color: '#78716c', margin: '4px 4px 8px', lineHeight: 1.4 }}>Piirrä huone tai avaa esimerkki.</div>}
              {panels.count > 0 && (
                <div data-testid="panel-schedule" style={{ fontSize: 11, color: '#44403c', margin: '4px 4px 8px', lineHeight: 1.45 }}>
                  <strong>Paneelit</strong>
                  <div>{panels.count} kpl · {panels.net.toFixed(1)} m²</div>
                  <div>{panels.shared} yhteistä seinää, laskettu kerran</div>
                </div>
              )}
              {doors.length > 0 && (
                <div data-testid="door-schedule" style={{ fontSize: 11, color: '#44403c', margin: '4px 4px 8px', lineHeight: 1.45 }}>
                  <strong>Ovet</strong>
                  {doors.map((row) => (
                    <div key={`${row.name}-${row.uValue}`}>{row.count} × {row.name} · U {row.uValue}</div>
                  ))}
                </div>
              )}
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
                const items = templatesForGroup(group.id, roomResult ? roomResult.total / 1000 : null, { showAll: showAllSizes || !roomResult, room: selectedRoom, rooms })
                if (!items.length) return null
                return (
                <div key={group.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#a8a29e', margin: '2px 4px 4px', fontWeight: 700, letterSpacing: 0.4 }}>{group.label}</div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`template-${item.id}`}
                      onClick={() => {
                        if (placingId === item.id) { setPlacingId(null); setTool('select'); return }
                        setPlacingId(item.id); setTool('select'); setNotice(t('designer.clickRoom', { name: item.name }))
                      }}
                      style={{
                        width: '100%', textAlign: 'left', marginBottom: 3, padding: '4px 6px',
                        borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#1c1917', transform: 'none',
                        display: 'flex', alignItems: 'center', gap: 8,
                        border: placingId === item.id ? '1px solid #c2410c' : '1px solid #e7e5e4',
                        background: placingId === item.id ? '#fff7ed' : '#fff',
                        boxShadow: placingId === item.id ? 'inset 3px 0 0 #ea580c' : 'none',
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
              {t('designer.grid', { size: snapOn ? `${gridSize} m` : t('designer.gridOff') })}
            </button>
          </div>
        </aside>

        <main data-testid="designer-canvas-frame" data-active={designName ? 'place' : 'select'} style={{ flex: 1, minWidth: 0, position: 'relative', ...placeFrame(Boolean(designName)) }}>
          <ModeChip name={designName} repeat={repeatPlace && Boolean(placing)} drawing={designDrawing} />
          <PlaceToast text={toast} />
          <div data-testid="status-tool" style={{ position: 'absolute', left: 12, top: 48, zIndex: 6, pointerEvents: 'none', fontSize: 12, fontWeight: 700, color: '#44403c', background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '4px 8px' }}>{designLabel}</div>
          {pipeOffer && (
            <div data-testid="outdoor-move-offer" style={{ position: 'absolute', top: 12, left: 12, zIndex: 6, maxWidth: 420, padding: '10px 12px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.4 }}>{notice}</div>
              <button type="button" data-testid="accept-outdoor-move" onClick={acceptOutdoorMove} style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {t('designer.moveOutdoor')}
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
            <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gridTemplateRows: compact ? '1fr 1fr' : undefined, height: '100%' }}>
              <PlanView {...planProps} />
              <div style={{ borderLeft: '1px solid #d6d3d1' }}>
                <Scene3D rooms={rooms} pipes={pipes} cables={cables} selectedId={selectedId} placeMode={Boolean(placing)} onPlace={(spot) => {
                  const host = (rooms || []).find((room) => pointInOutline(spot.x, spot.z, outlinePoints(room))) || [...rooms].sort((a, b) => Math.hypot(a.x - spot.x, a.z - spot.z) - Math.hypot(b.x - spot.x, b.z - spot.z))[0]
                  if (host) onPlace(host.id, spot.x, spot.z, spot.gesture)
                }} onExitPlace={() => { setPlacingId(null); setTool('select') }} onSelect={(id) => setSelectedIds(id ? [id] : [])} onContext={(hit) => { setSelectedIds([hit.id]); setMenu(hit) }} onRouteDrag={onRouteDrag} unitSystem={unitSystem} />
              </div>
            </div>
          ) : view === '3d' ? (
            <Scene3D rooms={rooms} pipes={pipes} cables={cables} selectedId={selectedId} placeMode={Boolean(placing)} onPlace={(spot) => {
              const host = (rooms || []).find((room) => pointInOutline(spot.x, spot.z, outlinePoints(room))) || [...rooms].sort((a, b) => Math.hypot(a.x - spot.x, a.z - spot.z) - Math.hypot(b.x - spot.x, b.z - spot.z))[0]
              if (host) onPlace(host.id, spot.x, spot.z, spot.gesture)
            }} onExitPlace={() => { setPlacingId(null); setTool('select') }} onSelect={(id) => setSelectedIds(id ? [id] : [])} onContext={(hit) => { setSelectedIds([hit.id]); setMenu(hit) }} onRouteDrag={onRouteDrag} unitSystem={unitSystem} />
          ) : (
            <PlanView {...planProps} />
          )}
          {(tool === 'pipe' || tool === 'cable') && view !== '3d' && view !== 'schematic' && (
            <div data-testid="pipe-settings" style={{ position: 'absolute', top: 12, right: 12, zIndex: 4, display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,0.96)', border: '1px solid #e7e5e4', borderRadius: 10, padding: '6px 8px' }}>
              {tool === 'pipe' && (
                <select aria-label={t('designer.pipe')} value={pipeKind} onChange={(e) => setPipeKind(e.target.value)} style={{ height: 28, borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12 }}>
                  <option value="suction">{t('designer.pipeSuction')}</option>
                  <option value="liquid">{t('designer.pipeLiquid')}</option>
                  <option value="hotgas">{t('designer.pipeHot')}</option>
                  <option value="drain">{t('designer.pipeDrain')}</option>
                </select>
              )}
              {tool === 'pipe' && pipeKind !== 'drain' && (
                <>
                  <select aria-label={t('designer.refrigerant')} value={refrigerant} onChange={(e) => setRefrigerant(e.target.value)} style={{ height: 28, borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12 }}>
                    {REFRIGERANT_IDS.map((id) => <option key={id} value={id}>{id === 'R744' ? 'R744 / CO2' : id}</option>)}
                  </select>
                  <label style={{ fontSize: 11, color: '#44403c' }}>Te
                    <input aria-label={t('designer.te')} type="number" value={teC} onChange={(e) => setTeC(parseFloat(e.target.value) || 0)} style={{ width: 52, marginLeft: 4, height: 26, borderRadius: 6, border: '1px solid #d6d3d1' }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#44403c' }}>Tc
                    <input aria-label={t('designer.tc')} type="number" value={tcC} onChange={(e) => setTcC(parseFloat(e.target.value) || 0)} style={{ width: 52, marginLeft: 4, height: 26, borderRadius: 6, border: '1px solid #d6d3d1' }} />
                  </label>
                </>
              )}
            </div>
          )}
          {pipes.length > 0 && view !== '3d' && view !== 'schematic' && (
            <div className="pipe-legend" data-testid="pipe-legend" style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 4, background: 'rgba(255,255,255,0.94)', border: '1px solid #e7e5e4', borderRadius: 10, padding: '8px 10px', maxWidth: 320 }}>
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

        {view !== 'schematic' && <aside
          data-testid="designer-props"
          className="designer-props"
          data-open={compact && drawer === 'info' ? 'true' : 'false'}
          style={compact ? undefined : { width: 340, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderLeft: '1px solid #e7e5e4' }}
        >
          {compact && <button type="button" data-testid="close-info" onClick={() => setDrawer(null)}>Sulje</button>}
          {selectedIds.length > 1 && (
            <div style={{ padding: 12, borderBottom: '1px solid #e7e5e4' }}>
              <MultiProperties count={selectedIds.length}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 650 }}>
                  Lämpötila °C
                  <input
                    data-testid="multi-temp"
                    type="number"
                    defaultValue={designerShared(sceneNow(), selectedIds).temp ?? ''}
                    key={`temp-${selectedIds.join('-')}`}
                    onBlur={(event) => {
                      const temp = Number(event.target.value)
                      if (!Number.isFinite(temp)) return
                      pushUndo()
                      applyScene(patchDesigner(sceneNow(), classifyDesignerIds(sceneNow(), selectedIds).filter((item) => item.kind === 'room'), { temp }))
                    }}
                    style={{ display: 'block', width: '100%', marginTop: 4, height: 28, borderRadius: 6, border: '1px solid #d6d3d1' }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650 }}>
                  <input
                    data-testid="multi-lock"
                    type="checkbox"
                    checked={Boolean(designerShared(sceneNow(), selectedIds).cadLock)}
                    onChange={(event) => {
                      pushUndo()
                      applyScene(patchDesigner(sceneNow(), classifyDesignerIds(sceneNow(), selectedIds), { cadLock: event.target.checked }))
                    }}
                  />
                  Lukittu
                </label>
              </MultiProperties>
            </div>
          )}
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
            selectedCable={cables.find((cable) => cable.id === selectedId) || null}
            pipes={pipes}
            onPatchEquipment={(patch) => {
              if (!selectedEquipment) return
              patchEquipment(selectedEquipment.id, patch)
            }}
            onPatchPipe={(patch) => {
              if (!selectedId) return
              const pipe = pipesRef.current.find((item) => item.id === selectedId)
              const cable = cablesRef.current.find((item) => item.id === selectedId)
              const apply = (item) => {
                if (!item) return item
                const next = { ...item, ...patch }
                if (patch.points) next.points = insertRisers(patch.points)
                if (next.points) next.riseM = riseMetres(next.points)
                if (patch.heightMode) {
                  const host = roomsRef.current[0]
                  next.points = setRunMount(item.points, heightMetres({ floorHeight: host?.height || 3 }, patch.heightMode, 'iv'), patch.heightMode)
                  next.locked = true
                }
                if (patch.locked === false) next.locked = false
                else if (patch.points || patch.material || patch.insulation || patch.label || patch.heightMode) next.locked = true
                return next
              }
              if (cable) setCables((current) => current.map((item) => (item.id === selectedId ? apply(item) : item)))
              else if (pipe) setPipes((current) => current.map((item) => (item.id === selectedId ? apply(item) : item)))
            }}
            onReroutePipe={(id) => {
              const target = id || selectedId
              pipesRef.current = pipesRef.current.map((pipe) => (pipe.id === target ? { ...pipe, locked: false } : pipe))
              setPipes(pipesRef.current)
              runAutoPipe()
            }}
            onSplitPipe={(id) => {
              const pipe = pipesRef.current.find((item) => item.id === id)
              if (!pipe) return
              const parts = splitPoints(pipe.points, 0, 0.5)
              if (!parts) return
              pushUndo()
              const copy = { ...pipe, id: genId(), points: parts.right, locked: true, showMark: false }
              setPipes(pipesRef.current.map((item) => (item.id === id ? { ...item, points: parts.left, locked: true } : item)).concat(copy))
            }}
            onDeleteEquipment={deleteSelected}
          />
        </aside>}
      </div>
      {toolMenu && (
        <div data-testid="tool-menu" style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 80, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, padding: 6, boxShadow: '0 12px 28px rgba(28,25,23,0.16)' }} onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" data-testid="ctx-finish" onClick={() => { finishRef.current?.(); setToolMenu(null) }} style={{ display: 'block', padding: '7px 10px', border: 'none', background: 'transparent', fontWeight: 700, cursor: 'pointer' }}>Lopeta</button>
        </div>
      )}
      {menu && (
        <ContextMenu
          menu={menu}
          rooms={rooms}
          pipes={pipes}
          cables={cables}
          onClose={() => setMenu(null)}
          onReroute={() => {
            if (menu.kind === 'cable') {
              setCables((current) => current.map((cable) => (cable.id === menu.id ? { ...cable, locked: false } : cable)))
              setMenu(null)
              return
            }
            pipesRef.current = pipesRef.current.map((pipe) => (pipe.id === menu.id ? { ...pipe, locked: false } : pipe))
            setPipes(pipesRef.current)
            setMenu(null)
            runAutoPipe()
          }}
          onHeight={(heightMode) => {
            const patch = { heightMode }
            const pipe = pipesRef.current.find((item) => item.id === menu.id)
            const cable = cablesRef.current.find((item) => item.id === menu.id)
            const host = roomsRef.current[0]
            const points = setRunMount((pipe || cable)?.points || [], heightMetres({ floorHeight: host?.height || 3 }, heightMode, 'iv'), heightMode)
            if (cable) setCables((current) => current.map((item) => (item.id === menu.id ? { ...item, ...patch, points, locked: true } : item)))
            if (pipe) setPipes((current) => current.map((item) => (item.id === menu.id ? { ...item, ...patch, points, locked: true } : item)))
          }}
          onLock={(locked) => {
            if (menu.kind === 'cable') setCables((current) => current.map((item) => (item.id === menu.id ? { ...item, locked } : item)))
            else setPipes((current) => current.map((item) => (item.id === menu.id ? { ...item, locked } : item)))
          }}
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
          onCad={(name) => { beginCad(name); setMenu(null) }}
          onDuplicate={() => { duplicateSelected(); setMenu(null) }}
          onDelete={() => { deleteSelected(); setMenu(null) }}
          onDoorType={(id) => {
            const spec = doorTypeById(id)
            if (!spec) return
            pushUndo()
            patchEquipment(menu.id, doorEquipmentPatch(spec))
          }}
          onDoorFamily={(family) => {
            pushUndo()
            patchEquipment(menu.id, { doorFamily: family })
          }}
        />
      )}
    </div>
  )
}

function ContextMenu({ menu, rooms, pipes, cables = [], onClose, onRotate, onAngle, onResize, onElevation, onDuplicate, onDelete, onDoorType, onDoorFamily, onReroute, onHeight, onLock, onCad }) {
  const { t } = useLocale()
  const host = rooms.find((room) => room.id === menu.id) || rooms.find((room) => (room.equipment || []).some((eq) => eq.id === menu.id))
  const eq = host?.equipment?.find((item) => item.id === menu.id) || null
  const pipe = pipes.find((item) => item.id === menu.id) || cables.find((item) => item.id === menu.id) || null
  const [angle, setAngle] = useState(eq?.rotation || 0)
  const [width, setWidth] = useState(eq?.width || host?.width || 1)
  const [depth, setDepth] = useState(eq?.depth || host?.depth || 1)
  const [height, setHeight] = useState(eq?.height || host?.height || 1)
  const [elevation, setElevation] = useState(eq ? (Number.isFinite(eq.elevation) ? eq.elevation : defaultElevation(host, eq)) : 0)
  const [mount, setMount] = useState(eq?.mount || 'floor')
  const doorOptions = eq?.category === 'door' ? doorChoices(host, rooms, eq) : []
  const left = Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300)
  const top = Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 520)
  return (
    <div data-testid="context-menu" style={{ position: 'fixed', left, top, zIndex: 40, width: 280, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.16)', padding: 8 }} onMouseDown={(event) => event.stopPropagation()}>
      <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 6px 8px' }}>{eq?.name || pipe?.kind || host?.name || t('ctx.object')}</div>
      <MenuBtn testid="ctx-cad-move" onClick={() => onCad?.('move')}>{t('cad.move')}</MenuBtn>
      <MenuBtn testid="ctx-cad-copy" onClick={() => onCad?.('copy')}>{t('cad.copy')}</MenuBtn>
      <MenuBtn testid="ctx-cad-rotate" onClick={() => onCad?.('rotate')}>{t('cad.rotate')}</MenuBtn>
      <MenuBtn testid="ctx-cad-mirror" onClick={() => onCad?.('mirror')}>{t('cad.mirror')}</MenuBtn>
      {menu.kind !== 'pipe' && menu.kind !== 'cable' && (
        <>
          <MenuBtn testid="ctx-rotate-cw" onClick={() => onRotate(90)}>{t('designer.rotateCw')}  ]</MenuBtn>
          <MenuBtn testid="ctx-rotate-ccw" onClick={() => onRotate(-90)}>{t('designer.rotateCcw')}  [</MenuBtn>
          {eq?.category === 'door' && (
            <>
              <label style={{ display: 'block', fontSize: 12, padding: '4px 6px' }}>
                {t('designer.rule')}
                <select data-testid="ctx-door-family" value={eq.doorFamily === 'cold' || eq.doorFamily === 'ambient' ? eq.doorFamily : 'auto'} onChange={(e) => onDoorFamily(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4 }}>
                  <option value="auto">{t('designer.doorAuto')}</option>
                  <option value="cold">{t('designer.coldDoor')}</option>
                  <option value="ambient">{t('designer.ambientDoor')}</option>
                </select>
              </label>
              <label style={{ display: 'block', fontSize: 12, padding: '4px 6px' }}>
                {t('designer.doorType')}
                <select data-testid="ctx-door-type" value={doorOptions.some((item) => item.id === eq.catalogId) ? eq.catalogId : ''} onChange={(e) => onDoorType(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4 }}>
                  {!doorOptions.some((item) => item.id === eq.catalogId) && <option value="">{eq.name}</option>}
                  {doorOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
            </>
          )}
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
      {(menu.kind === 'pipe' || menu.kind === 'cable') && (
        <>
          <label style={{ display: 'block', fontSize: 12, padding: '4px 6px' }}>
            Korkeus
            <select data-testid="ctx-cold-height" value={pipe?.heightMode || ''} onChange={(event) => onHeight?.(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4 }}>
              <option value="">Oma</option>
              <option value="ceiling">Katossa</option>
              <option value="false-ceiling">Alakatossa</option>
              <option value="wall">Seinäkorkeus</option>
              <option value="floor">Lattiassa</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, padding: '4px 6px' }}>
            <input data-testid="ctx-cold-lock" type="checkbox" checked={Boolean(pipe?.locked)} onChange={(event) => onLock?.(event.target.checked)} />
            Manuaalinen
          </label>
          <MenuBtn testid="ctx-cold-reroute" onClick={onReroute}>Reititä uudelleen</MenuBtn>
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
