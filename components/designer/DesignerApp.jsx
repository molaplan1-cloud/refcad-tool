'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import PlanView from './PlanView'
import HeatLoadPanel from './HeatLoadPanel'
import { ROOM_TYPES, TEMPLATE_GROUPS, TEMPLATES, getTemplate } from '@/lib/catalog'
import {
  buildEnquiryExample,
  createRoom,
  descendantIds,
  findContainer,
  makeEquipment,
  normalizeRooms,
} from '@/lib/geometry'
import { applyOutline, bboxOf, clampGroupTranslation, cleanOrthogonal, isRectangleOutline, scaleOutline, selfIntersects, translateOutline } from '@/lib/cadDraw'
import { calculateProject, resultFor } from '@/lib/heatLoad'
import { buildDxf, dxfFilename } from '@/lib/dxf'
import { buildPdf, pdfFilename } from '@/lib/pdfExport'

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

function TemplateThumb({ category }) {
  const box = { width: 28, height: 28, flexShrink: 0, display: 'block' }
  if (category === 'door') {
    return (
      <svg {...box} viewBox="0 0 28 28" aria-hidden="true">
        <rect x="5" y="3" width="12" height="22" rx="1" fill="#f5f5f4" stroke="#44403c" />
        <path d="M17 25 A14 14 0 0 0 17 3" fill="none" stroke="#9a3412" strokeWidth="1.2" />
        <rect x="13.5" y="13" width="1.6" height="4.5" rx="0.4" fill="#292524" />
      </svg>
    )
  }
  if (category === 'evaporator') {
    return (
      <svg {...box} viewBox="0 0 28 28" aria-hidden="true">
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
      <svg {...box} viewBox="0 0 28 28" aria-hidden="true">
        <rect x="3" y="6" width="22" height="16" rx="2" fill="#e2e8f0" stroke="#475569" />
        <path d="M6 9 H22 M6 12 H22 M6 15 H22 M6 18 H22" stroke="#64748b" strokeWidth="1" />
      </svg>
    )
  }
  if (category === 'rack') {
    return (
      <svg {...box} viewBox="0 0 28 28" aria-hidden="true">
        <path d="M6 4 V24 M22 4 V24 M6 8 H22 M6 14 H22 M6 20 H22" stroke="#78716c" strokeWidth="1.4" />
      </svg>
    )
  }
  return (
    <svg {...box} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="6" y="5" width="16" height="18" rx="1.5" fill="#e2e8f0" stroke="#334155" />
      <rect x="9" y="8" width="10" height="3" fill="#64748b" />
    </svg>
  )
}

export default function DesignerApp({
  initialName = 'Uusi projekti',
  initialRooms = [],
  initialUnitSystem = 'SI',
  onPersist,
  user = null,
  persistLabel = 'selaimeen',
}) {
  const [name, setName] = useState(initialName || 'Uusi projekti')
  const [rooms, setRooms] = useState(() => normalizeRooms(initialRooms))
  const [unitSystem, setUnitSystem] = useState(initialUnitSystem === 'IP' ? 'IP' : 'SI')
  const [tool, setTool] = useState('select')
  const [drawType, setDrawType] = useState('chilled')
  const [view, setView] = useState('2d')
  const [selectedIds, setSelectedIds] = useState([])
  const [placingId, setPlacingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [snapOn, setSnapOn] = useState(true)
  const [gridSize, setGridSize] = useState(0.1)
  const [fitToken, setFitToken] = useState(1)
  const [saveState, setSaveState] = useState('saved')
  const [exportOpen, setExportOpen] = useState(false)
  const [roomsOpen, setRoomsOpen] = useState(true)
  const [templatesOpen, setTemplatesOpen] = useState(true)
  const roomsRef = useRef(rooms)
  const selectedRef = useRef(selectedIds)
  const undoRef = useRef([])
  const redoRef = useRef([])
  const editSnap = useRef(null)
  const fileRef = useRef(null)
  roomsRef.current = rooms
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

  const pushUndo = useCallback(() => {
    undoRef.current.push(structuredClone(roomsRef.current))
    if (undoRef.current.length > 80) undoRef.current.shift()
    redoRef.current = []
  }, [])

  const undo = useCallback(() => {
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push(structuredClone(roomsRef.current))
    setRooms(prev)
  }, [])

  const redo = useCallback(() => {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(structuredClone(roomsRef.current))
    setRooms(next)
  }, [])

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
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
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
        onPersist({ name, rooms, unitSystem })
        setSaveState('saved')
      } catch (err) {
        console.error(err)
        setSaveState('error')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [name, rooms, unitSystem, onPersist])

  function deleteSelected() {
    const ids = selectedRef.current
    if (!ids.length) return
    const current = roomsRef.current
    const roomIds = new Set(current.map((room) => room.id))
    const equipmentIds = ids.filter((id) => !roomIds.has(id))
    pushUndo()
    if (equipmentIds.length && equipmentIds.length === ids.length) {
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
    if (tool === 'partition') {
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
    const eq = makeEquipment(placingId, room, x, z)
    pushUndo()
    setRooms(current.map((item) => (
      item.id === roomId ? { ...item, equipment: [...item.equipment, eq] } : item
    )))
    setSelectedIds([eq.id])
    setPlacingId(null)
    setNotice(`${eq.name} sijoitettiin huoneeseen ${room.label}.`)
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
    const sample = buildEnquiryExample()
    setRooms(sample)
    setSelectedIds([sample[0].id])
    setView('2d')
    setFitToken((token) => token + 1)
    setNotice('Esimerkki: jäähdytys 12 × 8 × 6 m ja pakastekulma. Kuorma on oikealla.')
  }

  function exportPdf() {
    const doc = buildPdf({ projectName: name, userEmail: user?.email || '', rooms, unitSystem })
    doc.save(pdfFilename(name))
  }

  function exportDxf() {
    const text = buildDxf({ projectName: name, rooms })
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
    const blob = new Blob([JSON.stringify({ projectName: name, rooms, unitSystem }, null, 2)], { type: 'application/json' })
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
    onGestureEnd: () => {},
    onCreateRect,
    onCreatePolygon,
    onPlace,
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
        </div>
        <select aria-label="Huonetyyppi" value={drawType} onChange={(e) => setDrawType(e.target.value)} style={{ background: '#1c212b', color: '#f5f5f4', border: '1px solid transparent', borderRadius: 8, height: 32, padding: '0 8px', fontSize: 12, maxWidth: 132, flexShrink: 1 }}>
          {ROOM_TYPES.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 10, background: '#1c212b', flexShrink: 0 }}>
          <button type="button" title="Pohjakuva" style={textBtn(view === '2d')} onClick={() => setView('2d')}>2D</button>
          <button type="button" data-testid="view-3d" title="Kolmiulotteinen näkymä" style={textBtn(view === '3d')} onClick={() => setView('3d')}>3D</button>
          <button type="button" data-testid="view-split" title="Pohja ja 3D rinnakkain" style={textBtn(view === 'split')} onClick={() => setView('split')}>Jaettu</button>
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
              <div style={{ fontSize: 11, color: '#78716c', margin: '2px 4px 8px', lineHeight: 1.4 }}>Valitse malli ja klikkaa huonetta.</div>
              {TEMPLATE_GROUPS.map((group) => (
                <div key={group.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#a8a29e', margin: '2px 4px 4px', fontWeight: 700, letterSpacing: 0.4 }}>{group.label}</div>
                  {TEMPLATES.filter((item) => item.category === group.id).map((item) => (
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
                      <TemplateThumb category={item.category} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600 }}>{item.name}</span>
                        {item.capacityKw ? <span style={{ fontSize: 10, color: '#78716c' }}>{item.capacityKw} kW</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
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
          {view === 'split' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
              <PlanView {...planProps} />
              <div style={{ borderLeft: '1px solid #d6d3d1' }}>
                <Scene3D rooms={rooms} selectedId={selectedId} onSelect={(id) => setSelectedIds(id ? [id] : [])} unitSystem={unitSystem} />
              </div>
            </div>
          ) : view === '3d' ? (
            <Scene3D rooms={rooms} selectedId={selectedId} onSelect={(id) => setSelectedIds(id ? [id] : [])} unitSystem={unitSystem} />
          ) : (
            <PlanView {...planProps} />
          )}
          {rooms.length === 0 && view !== '3d' && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 72, textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#292524' }}>Piirrä kylmähuone pohjaan</div>
              <div style={{ fontSize: 13, color: '#78716c', marginTop: 6 }}>Huone (R), monikulmio (P) tai esimerkki 12 m × 8 m × 6 m.</div>
            </div>
          )}
        </main>

        <aside style={{ width: 340, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderLeft: '1px solid #e7e5e4' }}>
          <HeatLoadPanel
            room={selectedRoom}
            rooms={rooms}
            result={result}
            roomResult={roomResult}
            unitSystem={unitSystem}
            onPatch={patchSelected}
            onFocusEdit={() => { editSnap.current = structuredClone(roomsRef.current) }}
            onBlurEdit={() => {
              if (editSnap.current) {
                undoRef.current.push(editSnap.current)
                editSnap.current = null
              }
            }}
            selectedEquipment={selectedEquipment}
            onDeleteEquipment={deleteSelected}
          />
        </aside>
      </div>
    </div>
  )
}
