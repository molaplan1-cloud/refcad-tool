'use client'

import {
  MATERIALS,
  ROOM_TYPES,
  ROOF_TYPES,
  STANDARD_SCALES,
  addOpening,
  deleteOpening,
  deleteRoom,
  deleteWall,
  duplicateFixture,
  flipOpening,
  mirrorFixture,
  removeFixture,
  rotateFixture,
  segmentLength,
  setWallLength,
  splitWall,
  updateFixture,
  updateHouse,
  updateOpening,
  updateRoom,
  updateWall,
} from '@/lib/floorplan'

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #d6d3d1',
  fontSize: 13,
  background: '#fff',
  color: '#1c1917',
}

const menuBtn = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '7px 8px',
  border: 'none',
  background: 'transparent',
  color: '#1c1917',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 8,
  cursor: 'pointer',
  transform: 'none',
}

function MenuBtn({ children, onClick, testid }) {
  return (
    <button type="button" data-testid={testid} onClick={onClick} style={menuBtn}>
      {children}
    </button>
  )
}

function Field({ label, children, testid }) {
  return (
    <label data-testid={testid} style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8, color: '#44403c' }}>
      <span style={{ display: 'block', marginBottom: 3 }}>{label}</span>
      {children}
    </label>
  )
}

function mm(metres) {
  return Math.round((Number(metres) || 0) * 1000)
}

function fromMm(value) {
  return Math.max(0, (parseFloat(value) || 0) / 1000)
}

const BUILDINGS = [
  ['omakotitalo', 'Omakotitalo'],
  ['paritalo', 'Paritalo'],
  ['rivitalo', 'Rivitalo'],
  ['kerrostalo', 'Kerrostalo'],
  ['mokki', 'Mökki'],
]

const STRUCTURES = [
  ['puuranka', 'Puuranka'],
  ['harkko', 'Harkko'],
  ['betoni', 'Betoni'],
  ['hirsi', 'Hirsi'],
]

export function HouseSettings({ plan, onApply }) {
  const scale = STANDARD_SCALES.includes(plan.drawingScale) ? plan.drawingScale : null
  return (
    <div data-testid="house-panel">
      <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>Talon asetukset</div>
      <Field label="Nimi" testid="house-name-field">
        <input data-testid="house-name" style={inputStyle} value={plan.name || ''} onChange={(event) => onApply(updateHouse(plan, { name: event.target.value }))} />
      </Field>
      <Field label="Osoite">
        <input data-testid="house-address" style={inputStyle} value={plan.address || ''} onChange={(event) => onApply(updateHouse(plan, { address: event.target.value }))} />
      </Field>
      <Field label="Rakennustyyppi">
        <select data-testid="house-type" style={inputStyle} value={plan.buildingType || 'omakotitalo'} onChange={(event) => onApply(updateHouse(plan, { buildingType: event.target.value }))}>
          {BUILDINGS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </Field>
      <Field label="Kerroksia">
        <input style={inputStyle} type="number" min="1" max="8" value={plan.floors || 1} onChange={(event) => onApply(updateHouse(plan, { floors: Math.max(1, parseInt(event.target.value, 10) || 1) }))} />
      </Field>
      <Field label="Kerroskorkeus (mm)">
        <input style={inputStyle} type="number" min="2200" max="4000" value={mm(plan.floorHeight || 2.6)} onChange={(event) => onApply(updateHouse(plan, { floorHeight: fromMm(event.target.value) || 2.6 }))} />
      </Field>
      <Field label="Ulkoseinän rakenne">
        <select style={inputStyle} value={plan.exteriorStructure || 'puuranka'} onChange={(event) => onApply(updateHouse(plan, { exteriorStructure: event.target.value }))}>
          {STRUCTURES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </Field>
      <Field label="Ulkoseinän paksuus (mm)">
        <input style={inputStyle} type="number" min="80" max="600" value={mm(plan.exteriorThickness || 0.24)} onChange={(event) => onApply(updateHouse(plan, { exteriorThickness: fromMm(event.target.value) || 0.24 }))} />
      </Field>
      <Field label="Kattomuoto">
        <select data-testid="house-roof" style={inputStyle} value={plan.roofType || 'gable'} onChange={(event) => onApply(updateHouse(plan, { roofType: event.target.value }))}>
          {ROOF_TYPES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Kattokaltevuus (°)">
        <input style={inputStyle} type="number" min="0" max="60" value={plan.roofPitch ?? 25} onChange={(event) => onApply(updateHouse(plan, { roofPitch: parseFloat(event.target.value) || 0 }))} />
      </Field>
      <Field label="Räystään ylitys (mm)">
        <input style={inputStyle} type="number" min="0" max="1500" value={mm(plan.eaveOverhang ?? 0.5)} onChange={(event) => onApply(updateHouse(plan, { eaveOverhang: fromMm(event.target.value) }))} />
      </Field>
      <div style={{ fontSize: 12, fontWeight: 700, margin: '4px 0 6px' }}>Julkisivu</div>
      <SwatchRow group="exterior" value={plan.exteriorId} onPick={(id) => onApply({ ...plan, exteriorId: id })} />
      <div style={{ fontSize: 12, fontWeight: 700, margin: '8px 0 6px' }}>Katemateriaali</div>
      <SwatchRow group="roof" value={plan.roofId} onPick={(id) => onApply({ ...plan, roofId: id })} />
      <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>Mittakaava</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {STANDARD_SCALES.map((ratio) => (
          <button
            key={ratio}
            type="button"
            data-testid={`house-scale-${ratio}`}
            onClick={() => onApply(updateHouse(plan, { drawingScale: ratio }))}
            style={{
              ...menuBtn,
              width: 'auto',
              border: '1px solid #d6d3d1',
              background: scale === ratio ? '#f0fdfa' : '#fff',
              padding: '6px 10px',
            }}
          >
            1:{ratio}
          </button>
        ))}
      </div>
    </div>
  )
}

function SwatchRow({ group, value, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
      {MATERIALS[group].map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.name}
          aria-label={item.name}
          onClick={() => onPick(item.id)}
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: item.color,
            border: value === item.id ? '2px solid #0f766e' : '1px solid #a8a29e',
            cursor: 'pointer',
            transform: 'none',
            padding: 0,
          }}
        />
      ))}
    </div>
  )
}

export function SelectionPanel({ plan, selection, onApply, onCommit }) {
  if (!selection?.id) return <div style={{ fontSize: 12, color: '#78716c' }}>Valitse kohde pohjasta tai avaa talon asetukset.</div>
  if (selection.kind === 'wall') return <WallFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  if (selection.kind === 'opening') return <OpeningFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  if (selection.kind === 'room') return <RoomFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  if (selection.kind === 'fixture') return <FixtureFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  return null
}

function WallFields({ plan, id, onApply, onCommit, compact }) {
  const wall = (plan.walls || []).find((item) => item.id === id)
  if (!wall) return null
  const thick = Math.round(((wall.thicknessCustom && wall.thickness) || wall.thickness || (wall.kind === 'interior' ? 0.12 : plan.exteriorThickness || 0.24)) * 1000)
  const setKind = (kind) => onCommit(updateWall(plan, id, { kind }))
  const setThick = (metres, custom = true) => onCommit(updateWall(plan, id, { thickness: metres, thicknessCustom: custom }))
  const group = wall.kind === 'interior' ? 'interior' : 'exterior'
  return (
    <div>
      {!compact && <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>Seinä</div>}
      <div style={{ fontSize: 12, fontWeight: 650, marginBottom: 4 }}>Paksuus</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <MenuBtn testid="wall-thick-240" onClick={() => setThick(0.24)}>240</MenuBtn>
        <MenuBtn testid="wall-thick-120" onClick={() => setThick(0.12)}>120</MenuBtn>
      </div>
      <Field label="Oma paksuus (mm)">
        <input style={inputStyle} type="number" value={thick} onChange={(event) => setThick(fromMm(event.target.value) || 0.12)} />
      </Field>
      <Field label="Tyyppi">
        <select data-testid="wall-type" style={inputStyle} value={wall.kind === 'bearing' ? 'bearing' : wall.kind === 'interior' ? 'interior' : 'exterior'} onChange={(event) => setKind(event.target.value)}>
          <option value="exterior">Ulkoseinä</option>
          <option value="bearing">Kantava</option>
          <option value="interior">Väliseinä</option>
        </select>
      </Field>
      <Field label="Korkeus (mm)">
        <input style={inputStyle} type="number" value={mm(wall.height || plan.floorHeight || 2.6)} onChange={(event) => onApply(updateWall(plan, id, { height: fromMm(event.target.value) || 2.6, heightCustom: true }))} />
      </Field>
      <Field label="Materiaali">
        <select style={inputStyle} value={wall.materialId || ''} onChange={(event) => onApply(updateWall(plan, id, { materialId: event.target.value }))}>
          <option value="">Oletus</option>
          {MATERIALS[group].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Pituus (mm)">
        <input
          data-testid="wall-length"
          style={inputStyle}
          type="number"
          defaultValue={mm(segmentLength(wall.a, wall.b))}
          key={`${id}-${mm(segmentLength(wall.a, wall.b))}`}
          onBlur={(event) => onCommit(setWallLength(plan, id, fromMm(event.target.value)))}
        />
      </Field>
    </div>
  )
}

function OpeningFields({ plan, id, onApply, onCommit, compact }) {
  const opening = (plan.openings || []).find((item) => item.id === id)
  if (!opening) return null
  const patch = (next) => onApply(updateOpening(plan, id, next))
  return (
    <div>
      {!compact && <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>{opening.kind === 'window' ? 'Ikkuna' : 'Ovi'}</div>}
      <Field label="Leveys (mm)">
        <input style={inputStyle} type="number" value={mm(opening.width)} onChange={(event) => patch({ width: fromMm(event.target.value) || 0.6 })} />
      </Field>
      <Field label="Korkeus (mm)">
        <input style={inputStyle} type="number" value={mm(opening.height || (opening.kind === 'window' ? 1.2 : 2.1))} onChange={(event) => patch({ height: fromMm(event.target.value) || 1 })} />
      </Field>
      <Field label="Alareunan korkeus (mm)">
        <input style={inputStyle} type="number" value={mm(opening.sill || 0)} onChange={(event) => patch({ sill: fromMm(event.target.value) })} />
      </Field>
      <Field label="Tyyppi">
        <select style={inputStyle} value={opening.kind} onChange={(event) => {
          const kind = event.target.value
          patch({ kind, height: kind === 'window' ? 1.2 : 2.1, sill: kind === 'window' ? 0.9 : 0, width: kind === 'window' ? 1.2 : 0.9 })
        }}>
          <option value="door">Ovi</option>
          <option value="window">Ikkuna</option>
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 4 }}>
        <MenuBtn testid="opening-swing-left" onClick={() => onCommit(updateOpening(plan, id, { swing: 1 }))}>Aukeaa vasemmalle</MenuBtn>
        <MenuBtn testid="opening-swing-right" onClick={() => onCommit(updateOpening(plan, id, { swing: -1 }))}>Aukeaa oikealle</MenuBtn>
      </div>
    </div>
  )
}

function RoomFields({ plan, id, onApply, onCommit, compact }) {
  const room = (plan.rooms || []).find((item) => item.id === id)
  if (!room) return null
  const patch = (next) => onApply(updateRoom(plan, id, next))
  return (
    <div>
      {!compact && <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>Huone</div>}
      <Field label="Nimi">
        <input data-testid="room-name" aria-label="Huoneen nimi" style={inputStyle} value={room.name || ''} onChange={(event) => patch({ name: event.target.value })} />
      </Field>
      <Field label="Tyyppi">
        <select data-testid="room-type" style={inputStyle} value={room.type || 'huone'} onChange={(event) => {
          const type = ROOM_TYPES.find((item) => item.id === event.target.value)
          const previous = ROOM_TYPES.find((item) => item.id === (room.type || 'huone'))
          const keep = room.name && room.name !== previous?.name && room.name !== 'Huone'
          patch({ type: event.target.value, name: keep ? room.name : (type?.name || room.name) })
        }}>
          {ROOM_TYPES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Lattia</div>
      <SwatchRow group="floor" value={room.floorId} onPick={(material) => patch({ floorId: material })} />
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Seinä</div>
      <SwatchRow group="interior" value={room.interiorId} onPick={(material) => patch({ interiorId: material })} />
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Katto</div>
      <SwatchRow group="interior" value={room.ceilingId || 'paint'} onPick={(material) => patch({ ceilingId: material })} />
      <Field label="Huonekorkeus (mm)">
        <input style={inputStyle} type="number" value={mm(room.ceilingHeight || plan.floorHeight || 2.6)} onChange={(event) => patch({ ceilingHeight: fromMm(event.target.value) || 2.6 })} />
      </Field>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 8 }}>
        <input type="checkbox" checked={room.showLabel !== false} onChange={(event) => patch({ showLabel: event.target.checked })} />
        Näytä pinta-ala
      </label>
    </div>
  )
}

function FixtureFields({ plan, id, onApply, onCommit }) {
  const fixture = (plan.fixtures || []).find((item) => item.id === id)
  if (!fixture) return null
  const tplW = fixture.w || 0.6
  const tplD = fixture.d || 0.6
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>Kaluste</div>
      <Field label="Leveys (mm)">
        <input style={inputStyle} type="number" value={mm(fixture.w || tplW)} onChange={(event) => onApply(updateFixture(plan, id, { w: fromMm(event.target.value) || 0.3 }))} />
      </Field>
      <Field label="Syvyys (mm)">
        <input style={inputStyle} type="number" value={mm(fixture.d || tplD)} onChange={(event) => onApply(updateFixture(plan, id, { d: fromMm(event.target.value) || 0.3 }))} />
      </Field>
      <Field label="Väri">
        <input style={{ ...inputStyle, padding: 2, height: 32 }} type="color" value={fixture.color || '#1c1917'} onChange={(event) => onApply(updateFixture(plan, id, { color: event.target.value }))} />
      </Field>
      <MenuBtn onClick={() => onCommit(rotateFixture(plan, id))}>Kierrä 90°</MenuBtn>
      <MenuBtn onClick={() => onCommit(mirrorFixture(plan, id))}>Peilaa</MenuBtn>
    </div>
  )
}

export function FloorMenu({ menu, plan, onApply, onCommit, onNavigate }) {
  if (!menu) return null
  const left = Math.max(8, Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 276))
  const top = Math.max(8, Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 360))
  const wall = (plan.walls || []).find((item) => item.id === menu.id)
  const opening = (plan.openings || []).find((item) => item.id === menu.id)
  const room = (plan.rooms || []).find((item) => item.id === menu.id)
  const titles = { wall: 'Seinä', opening: opening?.kind === 'window' ? 'Ikkuna' : 'Ovi', room: room?.name || 'Huone', fixture: 'Kaluste', canvas: 'Pohja' }
  const act = (next) => {
    onCommit(next)
    onNavigate('close')
  }
  return (
    <div
      data-testid="context-menu"
      style={{ position: 'fixed', left, top, zIndex: 50, width: 260, maxHeight: '70vh', overflowY: 'auto', background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.16)', padding: 8 }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 6px 8px' }}>{titles[menu.kind] || 'Kohde'}</div>
      {menu.kind === 'wall' && wall && (
        <>
          <WallFields compact plan={plan} id={wall.id} onApply={onApply} onCommit={onCommit} />
          <MenuBtn testid="ctx-split" onClick={() => act(splitWall(plan, wall.id, menu.at || { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }))}>Jaa seinä</MenuBtn>
          <MenuBtn testid="ctx-door" onClick={() => act(addOpening(plan, wall.id, menu.at || wall.a, 'door'))}>Lisää ovi tähän</MenuBtn>
          <MenuBtn testid="ctx-window" onClick={() => act(addOpening(plan, wall.id, menu.at || wall.a, 'window'))}>Lisää ikkuna tähän</MenuBtn>
          <MenuBtn testid="ctx-delete" onClick={() => act(deleteWall(plan, wall.id))}>Poista</MenuBtn>
        </>
      )}
      {menu.kind === 'opening' && opening && (
        <>
          <OpeningFields compact plan={plan} id={opening.id} onApply={onApply} onCommit={onCommit} />
          <MenuBtn testid="ctx-flip" onClick={() => act(flipOpening(plan, opening.id))}>Käännä</MenuBtn>
          <MenuBtn testid="ctx-delete" onClick={() => act(deleteOpening(plan, opening.id))}>Poista</MenuBtn>
        </>
      )}
      {menu.kind === 'room' && room && (
        <>
          <RoomFields compact plan={plan} id={room.id} onApply={onApply} onCommit={onCommit} />
          <MenuBtn testid="ctx-delete" onClick={() => act(deleteRoom(plan, room.id))}>Poista</MenuBtn>
        </>
      )}
      {menu.kind === 'fixture' && (
        <>
          <MenuBtn testid="ctx-rotate" onClick={() => act(rotateFixture(plan, menu.id))}>Kierrä 90°</MenuBtn>
          <MenuBtn testid="ctx-mirror" onClick={() => act(mirrorFixture(plan, menu.id))}>Peilaa</MenuBtn>
          <MenuBtn testid="ctx-dimensions" onClick={() => onNavigate('focus')}>Mitat</MenuBtn>
          <Field label="Väri">
            <input style={{ ...inputStyle, padding: 2, height: 32 }} type="color" value={(plan.fixtures || []).find((item) => item.id === menu.id)?.color || '#1c1917'} onChange={(event) => onApply(updateFixture(plan, menu.id, { color: event.target.value }))} />
          </Field>
          <MenuBtn testid="ctx-duplicate" onClick={() => act(duplicateFixture(plan, menu.id))}>Monista</MenuBtn>
          <MenuBtn testid="ctx-delete" onClick={() => act(removeFixture(plan, menu.id))}>Poista</MenuBtn>
        </>
      )}
      {menu.kind === 'canvas' && (
        <>
          <MenuBtn testid="ctx-paste" onClick={() => onNavigate('paste')}>Liitä</MenuBtn>
          <MenuBtn testid="ctx-draw-wall" onClick={() => onNavigate('wall')}>Piirrä seinä</MenuBtn>
          <MenuBtn testid="ctx-draw-room" onClick={() => onNavigate('room')}>Piirrä huone</MenuBtn>
          <MenuBtn testid="ctx-house" onClick={() => onNavigate('house')}>Talon asetukset</MenuBtn>
        </>
      )}
    </div>
  )
}
