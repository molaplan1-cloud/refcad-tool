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
import { applyOutline, bboxOf, cleanOrthogonal, isRectangleOutline, scaleOutline, selfIntersects, translateOutline } from '@/lib/cadDraw'
import { calculateProject, resultFor } from '@/lib/heatLoad'
import { buildDxf, dxfFilename } from '@/lib/dxf'
import { buildPdf, pdfFilename } from '@/lib/pdfExport'

const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false })

const toolBtn = (active) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 9px',
  borderRadius: 8,
  border: active ? '1px solid #5eead4' : '1px solid transparent',
  background: active ? '#134e4a' : 'transparent',
  color: active ? '#f0fdfa' : '#e7e5e4',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transform: 'none',
})

function ToolIcon({ d }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
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
        pushUndo()
        setRooms(roomsRef.current.map((room) => (
          ids.has(room.id) ? { ...room, x: room.x + dx, z: room.z + dz, outline: translateOutline(room.outline, dx, dz) } : room
        )))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
    setView('split')
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
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        padding: '8px 12px', background: '#14181f', borderBottom: '1px solid #0c0f14', color: '#f5f5f4',
      }}>
        <Link href="/projects" style={{ color: '#99f6e4', fontWeight: 800, textDecoration: 'none', fontSize: 14, letterSpacing: 0.2 }}>RefCAD</Link>
        <input
          aria-label="Projektin nimi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            background: 'transparent', border: '1px solid transparent', color: '#fff',
            fontWeight: 700, fontSize: 14, minWidth: 140, padding: '4px 6px', borderRadius: 6,
          }}
        />
        <span style={{ fontSize: 10, color: saveState === 'error' ? '#fca5a5' : '#86efac' }}>{saveText}</span>
        <span style={{ width: 1, height: 22, background: '#3f3f46' }} />
        <button type="button" data-testid="tool-select" title="Valitse (V)" style={toolBtn(tool === 'select' && !placing)} onClick={() => { setTool('select'); setPlacingId(null) }}>
          <ToolIcon d="M4 2.5 L4 13 L7.2 9.6 L10.5 14 L12 13.2 L8.6 8.8 L13 8.2 Z" /> Valitse
        </button>
        <button type="button" data-testid="tool-draw" title="Suorakulmio (R)" style={toolBtn(tool === 'draw')} onClick={() => { setTool('draw'); setPlacingId(null) }}>
          <ToolIcon d="M3 4 H13 V12 H3 Z" /> Huone
        </button>
        <button type="button" data-testid="tool-polygon" title="Monikulmio (P)" style={toolBtn(tool === 'polygon')} onClick={() => { setTool('polygon'); setPlacingId(null) }}>
          <ToolIcon d="M3 11 L6 3 L13 5 L11 13 Z" /> Monikulmio
        </button>
        <button type="button" data-testid="tool-partition" title="Väliseinä (W)" style={toolBtn(tool === 'partition')} onClick={() => { setTool('partition'); setPlacingId(null) }}>
          <ToolIcon d="M3 3 H13 V13 H8 V3" /> Väliseinä
        </button>
        <select value={drawType} onChange={(e) => setDrawType(e.target.value)} style={{ background: '#1c1917', color: '#fff', border: '1px solid #44403c', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
          {ROOM_TYPES.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <span style={{ width: 1, height: 22, background: '#3f3f46' }} />
        <button type="button" style={toolBtn(view === '2d')} onClick={() => setView('2d')}>2D</button>
        <button type="button" data-testid="view-3d" style={toolBtn(view === '3d')} onClick={() => setView('3d')}>3D</button>
        <button type="button" data-testid="view-split" style={toolBtn(view === 'split')} onClick={() => setView('split')}>2D + 3D</button>
        <button type="button" data-testid="unit-si" style={toolBtn(unitSystem === 'SI')} onClick={() => setUnitSystem('SI')}>SI</button>
        <button type="button" data-testid="unit-ip" style={toolBtn(unitSystem === 'IP')} onClick={() => setUnitSystem('IP')}>IP</button>
        <button type="button" title="Kumoa (Ctrl+Z)" onClick={undo} style={toolBtn(false)}>Kumoa</button>
        <button type="button" title="Tee uudelleen (Ctrl+Y)" onClick={redo} style={toolBtn(false)}>Uudelleen</button>
        <button type="button" title="Sovita näkymä (F)" onClick={() => setFitToken((token) => token + 1)} style={toolBtn(false)}>Sovita</button>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="example-enquiry" onClick={loadExample} style={toolBtn(false)}>Esimerkki 8×12×6</button>
        <button type="button" data-testid="export-pdf" onClick={exportPdf} style={{ ...toolBtn(false), background: '#b91c1c', border: 'none' }}>PDF</button>
        <button type="button" data-testid="export-dxf" onClick={exportDxf} style={toolBtn(false)}>DXF</button>
        <button type="button" onClick={exportJson} style={toolBtn(false)}>JSON</button>
        <button type="button" onClick={() => fileRef.current?.click()} style={toolBtn(false)}>Tuo</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
        {user && (
          <form action="/api/auth/logout" method="POST">
            <button type="submit" style={toolBtn(false)}>Poistu</button>
          </form>
        )}
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 248, flexShrink: 0, overflowY: 'auto', background: '#fafaf9', borderRight: '1px solid #e7e5e4', padding: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.1, color: '#78716c', fontWeight: 700, marginBottom: 8 }}>HUONEET</div>
          {rooms.length === 0 && <div style={{ fontSize: 12, color: '#78716c', marginBottom: 10, lineHeight: 1.45 }}>Piirrä ensimmäinen huone tai avaa esimerkki.</div>}
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => { setSelectedIds([room.id]); setTool('select') }}
              style={{
                width: '100%', textAlign: 'left', marginBottom: 6, padding: '8px 8px',
                borderRadius: 8, cursor: 'pointer', color: '#1c1917', transform: 'none',
                border: selectedRoom?.id === room.id ? '1px solid #0f766e' : '1px solid #e7e5e4',
                background: selectedRoom?.id === room.id ? '#f0fdfa' : '#fff',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 8, alignSelf: 'stretch', borderRadius: 2, background: room.color }} />
                <span>
                  <strong>{room.label}</strong> {room.name}
                  <div style={{ fontSize: 10, color: '#78716c' }}>{room.temp}°C · {room.width.toFixed(1)}×{room.depth.toFixed(1)} m{room.outline ? ' · monikulmio' : ''}{room.parentId ? ' · väliseinä' : ''}</div>
                </span>
              </div>
            </button>
          ))}

          <div style={{ fontSize: 10, letterSpacing: 1.1, color: '#78716c', fontWeight: 700, margin: '14px 0 8px' }}>MALLIT</div>
          <div style={{ fontSize: 11, color: '#78716c', marginBottom: 8, lineHeight: 1.45 }}>Valitse malli ja klikkaa huonetta. Ovi tarttuu seinään, höyrystin jää sisälle.</div>
          {TEMPLATE_GROUPS.map((group) => (
            <div key={group.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#a8a29e', marginBottom: 4, fontWeight: 700 }}>{group.label}</div>
              {TEMPLATES.filter((item) => item.category === group.id).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`template-${item.id}`}
                  onClick={() => { setPlacingId(item.id); setTool('select'); setNotice(`Klikkaa huonetta: ${item.name}`) }}
                  style={{
                    width: '100%', textAlign: 'left', marginBottom: 4, padding: '6px 8px',
                    borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#1c1917', transform: 'none',
                    border: placingId === item.id ? '1px solid #0f766e' : '1px solid #e7e5e4',
                    background: placingId === item.id ? '#f0fdfa' : '#fff',
                  }}
                >
                  {item.name}{item.capacityKw ? ` · ${item.capacityKw} kW` : ''}
                </button>
              ))}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setGridSize((g) => (g === 0.1 ? 0.25 : g === 0.25 ? 0.5 : 0.1))}
            style={{ width: '100%', marginTop: 8, padding: '7px 8px', borderRadius: 8, border: '1px solid #d6d3d1', background: '#fff', color: '#44403c', fontSize: 12, transform: 'none' }}
          >
            Ruutu {snapOn ? `${gridSize} m` : 'pois'} (G)
          </button>
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
