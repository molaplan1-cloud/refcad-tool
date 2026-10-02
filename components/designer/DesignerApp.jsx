'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import PlanView from './PlanView'
import IsoView from './IsoView'
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
import { calculateProject, resultFor } from '@/lib/heatLoad'
import { buildDxf, dxfFilename } from '@/lib/dxf'
import { buildPdf, pdfFilename } from '@/lib/pdfExport'

const toolBtn = (active) => ({
  padding: '6px 10px',
  borderRadius: 6,
  border: active ? '1px solid #22d3ee' : '1px solid #334155',
  background: active ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : 'transparent',
  color: '#f8fafc',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
})

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
  const [selectedId, setSelectedId] = useState(null)
  const [placingId, setPlacingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [snapOn, setSnapOn] = useState(true)
  const [gridSize, setGridSize] = useState(0.1)
  const [saveState, setSaveState] = useState('saved')
  const roomsRef = useRef(rooms)
  const undoRef = useRef([])
  const editSnap = useRef(null)
  const fileRef = useRef(null)
  roomsRef.current = rooms

  const result = useMemo(() => calculateProject(rooms), [rooms])
  const placing = placingId ? getTemplate(placingId) : null

  const selectedRoom = rooms.find((room) => room.id === selectedId)
    || rooms.find((room) => (room.equipment || []).some((eq) => eq.id === selectedId))
    || null
  const selectedEquipment = selectedRoom?.equipment?.find((eq) => eq.id === selectedId) || null
  const roomResult = selectedRoom ? resultFor(result, selectedRoom.id) : null

  const pushUndo = useCallback(() => {
    undoRef.current.push(structuredClone(roomsRef.current))
    if (undoRef.current.length > 40) undoRef.current.shift()
  }, [])

  const undo = useCallback(() => {
    const prev = undoRef.current.pop()
    if (prev) setRooms(prev)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (e.key === 'Escape') {
        setPlacingId(null)
        setTool('select')
        setNotice('')
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      } else if (e.key.toLowerCase() === 'v') setTool('select')
      else if (e.key.toLowerCase() === 'r') setTool('draw')
      else if (e.key.toLowerCase() === 'p') setTool('partition')
      else if (e.key.toLowerCase() === 'g') setSnapOn((v) => !v)
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
    const current = roomsRef.current
    const room = current.find((item) => item.id === selectedId)
      || current.find((item) => (item.equipment || []).some((eq) => eq.id === selectedId))
    if (!room) return
    const eq = room.equipment.find((item) => item.id === selectedId)
    pushUndo()
    if (eq) {
      setRooms(current.map((item) => (
        item.id === room.id ? { ...item, equipment: item.equipment.filter((piece) => piece.id !== eq.id) } : item
      )))
      setSelectedId(room.id)
      return
    }
    const drop = descendantIds(current, room.id)
    drop.add(room.id)
    setRooms(current.filter((item) => !drop.has(item.id)))
    setSelectedId(null)
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
    setSelectedId(room.id)
    setTool('select')
    setNotice(`${room.label} lisätty. Sisämitat tulevat ulkomitasta miinus seinät.`)
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
    setSelectedId(eq.id)
    setPlacingId(null)
    setNotice(`${eq.name} sijoitettiin huoneeseen ${room.label}.`)
  }

  function patchSelected(patch) {
    if (!selectedRoom) return
    setRooms((current) => current.map((room) => (
      room.id === selectedRoom.id ? { ...room, ...patch } : room
    )))
  }

  function loadExample() {
    if (rooms.length && !window.confirm('Korvataanko nykyinen pohja esimerkillä 8 × 12 × 6 m?')) return
    pushUndo()
    const sample = buildEnquiryExample()
    setRooms(sample)
    setSelectedId(sample[0].id)
    setView('split')
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0f1e', color: '#f1f5f9' }}>
      <header style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        padding: '8px 12px', background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/projects" style={{ color: '#67e8f9', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>RefCAD</Link>
        <input
          aria-label="Projektin nimi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            background: 'transparent', border: '1px solid transparent', color: '#fff',
            fontWeight: 700, fontSize: 14, minWidth: 160, padding: '4px 6px', borderRadius: 6,
          }}
        />
        <span style={{ fontSize: 10, color: saveState === 'error' ? '#fca5a5' : '#4ade80' }}>{saveText}</span>
        <span style={{ width: 1, height: 22, background: '#334155' }} />
        <button type="button" data-testid="tool-select" style={toolBtn(tool === 'select' && !placing)} onClick={() => { setTool('select'); setPlacingId(null) }}>Valitse</button>
        <button type="button" data-testid="tool-draw" style={toolBtn(tool === 'draw')} onClick={() => { setTool('draw'); setPlacingId(null) }}>Piirrä huone</button>
        <button type="button" data-testid="tool-partition" style={toolBtn(tool === 'partition')} onClick={() => { setTool('partition'); setPlacingId(null) }}>Väliseinä</button>
        <select value={drawType} onChange={(e) => setDrawType(e.target.value)} style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}>
          {ROOM_TYPES.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <span style={{ width: 1, height: 22, background: '#334155' }} />
        <button type="button" style={toolBtn(view === '2d')} onClick={() => setView('2d')}>2D</button>
        <button type="button" data-testid="view-3d" style={toolBtn(view === '3d')} onClick={() => setView('3d')}>3D</button>
        <button type="button" data-testid="view-split" style={toolBtn(view === 'split')} onClick={() => setView('split')}>2D + 3D</button>
        <button type="button" data-testid="unit-si" style={toolBtn(unitSystem === 'SI')} onClick={() => setUnitSystem('SI')}>SI</button>
        <button type="button" data-testid="unit-ip" style={toolBtn(unitSystem === 'IP')} onClick={() => setUnitSystem('IP')}>IP</button>
        <button type="button" onClick={undo} style={toolBtn(false)}>Kumoa</button>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="example-enquiry" onClick={loadExample} style={toolBtn(false)}>Esimerkki 8×12×6</button>
        <button type="button" data-testid="export-pdf" onClick={exportPdf} style={{ ...toolBtn(false), background: 'linear-gradient(135deg, #dc2626, #b91c1c)', border: 'none' }}>PDF</button>
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
        <aside style={{ width: 250, flexShrink: 0, overflowY: 'auto', background: '#0f172a', borderRight: '1px solid rgba(255,255,255,0.06)', padding: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', fontWeight: 700, marginBottom: 8 }}>HUONEET</div>
          {rooms.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>Piirrä ensimmäinen huone tai avaa esimerkki.</div>}
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => { setSelectedId(room.id); setTool('select') }}
              style={{
                width: '100%', textAlign: 'left', marginBottom: 6, padding: '8px 8px',
                borderRadius: 8, cursor: 'pointer', color: '#f8fafc',
                border: selectedRoom?.id === room.id ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.06)',
                background: selectedRoom?.id === room.id ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 8, alignSelf: 'stretch', borderRadius: 2, background: room.color }} />
                <span>
                  <strong>{room.label}</strong> {room.name}
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{room.temp}°C · {room.width.toFixed(1)}×{room.depth.toFixed(1)} m{room.parentId ? ' · väliseinä' : ''}</div>
                </span>
              </div>
            </button>
          ))}

          <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', fontWeight: 700, margin: '14px 0 8px' }}>MALLIT</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Valitse malli ja klikkaa huonetta pohjassa. Ovi tarttuu seinään, höyrystin jää sisälle.</div>
          {TEMPLATE_GROUPS.map((group) => (
            <div key={group.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{group.label}</div>
              {TEMPLATES.filter((item) => item.category === group.id).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`template-${item.id}`}
                  onClick={() => { setPlacingId(item.id); setTool('select'); setNotice(`Klikkaa huonetta: ${item.name}`) }}
                  style={{
                    width: '100%', textAlign: 'left', marginBottom: 4, padding: '6px 8px',
                    borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#f8fafc',
                    border: placingId === item.id ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.08)',
                    background: placingId === item.id ? 'rgba(34,211,238,0.15)' : 'transparent',
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
            style={{ ...toolBtn(false), width: '100%', marginTop: 8 }}
          >
            Ruutu {snapOn ? `${gridSize} m` : 'pois'} (G)
          </button>
        </aside>

        <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {view === 'split' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
              <PlanView
                rooms={rooms}
                selectedId={selectedId}
                tool={tool}
                placing={placing}
                unitSystem={unitSystem}
                gridSize={gridSize}
                snapOn={snapOn}
                onSelect={setSelectedId}
                onPreview={setRooms}
                onGestureStart={pushUndo}
                onGestureEnd={() => {}}
                onCreateRect={onCreateRect}
                onPlace={onPlace}
                notice={notice}
              />
              <div style={{ borderLeft: '1px solid #1e293b' }}>
                <IsoView rooms={rooms} selectedId={selectedId} onSelect={setSelectedId} unitSystem={unitSystem} />
              </div>
            </div>
          ) : view === '3d' ? (
            <IsoView rooms={rooms} selectedId={selectedId} onSelect={setSelectedId} unitSystem={unitSystem} />
          ) : (
            <PlanView
              rooms={rooms}
              selectedId={selectedId}
              tool={tool}
              placing={placing}
              unitSystem={unitSystem}
              gridSize={gridSize}
              snapOn={snapOn}
              onSelect={setSelectedId}
              onPreview={setRooms}
              onGestureStart={pushUndo}
              onGestureEnd={() => {}}
              onCreateRect={onCreateRect}
              onPlace={onPlace}
              notice={notice}
            />
          )}
          {rooms.length === 0 && view !== '3d' && (
            <div style={{
              position: 'absolute', inset: '80px 40px auto', textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Piirrä kylmähuone pohjaan</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>Työkalu Piirrä huone, tai esimerkki 12 m × 8 m × 6 m vihanneksille.</div>
            </div>
          )}
        </main>

        <aside style={{ width: 340, flexShrink: 0, overflowY: 'auto', background: '#0f172a', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
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
