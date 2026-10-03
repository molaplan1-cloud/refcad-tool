'use client'

import { useState } from 'react'
import { CadItem, CadMenu, CadSep, CadStyles, Flyout, Segmented } from './CadMenu'
import {
  CLADDING,
  MATERIALS,
  ROOM_TYPES,
  ROOF_TYPES,
  STANDARD_SCALES,
  addOpening,
  cornerAngles,
  cornerJoint,
  splitWallAt,
  deleteFacadeZone,
  deleteOpening,
  deleteRoom,
  deleteWall,
  duplicateFixture,
  fixtureTemplate,
  flipOpening,
  mirrorFixture,
  removeFixture,
  rotateFixture,
  segmentLength,
  setCornerAngle,
  setWallDirection,
  setWallLength,
  wallDirection,
  splitWall,
  updateFacadeZone,
  updateFixture,
  updateHouse,
  updateOpening,
  updateRoom,
  updateWall,
} from '@/lib/floorplan'
import { ServiceMenu } from './ServicesLayer'
import { ensureServices, serviceObjectTitle } from '@/lib/services'

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

export function RoofFields({ plan, onApply }) {
  return (
    <div data-testid="roof-fields">
      <Field label="Kattomuoto">
        <select data-testid="roof-type" style={inputStyle} value={plan.roofType || 'gable'} onChange={(event) => onApply(updateHouse(plan, { roofType: event.target.value }))}>
          {ROOF_TYPES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Kattokaltevuus (°)" testid="roof-pitch-field">
        <input data-testid="roof-pitch" style={inputStyle} type="number" min="0" max="60" value={plan.roofPitch ?? 25} onChange={(event) => onApply(updateHouse(plan, { roofPitch: parseFloat(event.target.value) || 0 }))} />
      </Field>
      <Field label="Räystään ylitys (mm)">
        <input data-testid="roof-overhang" style={inputStyle} type="number" min="0" max="1500" value={mm(plan.eaveOverhang ?? 0.5)} onChange={(event) => onApply(updateHouse(plan, { eaveOverhang: fromMm(event.target.value) }))} />
      </Field>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Katemateriaali</div>
      <SwatchRow group="roof" value={plan.roofId} onPick={(id) => onApply({ ...plan, roofId: id })} />
    </div>
  )
}

function ZoneFields({ plan, id, onApply, onCommit }) {
  const zone = (plan.facades || []).find((item) => item.id === id)
  if (!zone) return null
  return (
    <div data-testid="zone-fields">
      <Field label="Materiaali">
        <select data-testid="zone-material" style={inputStyle} value={zone.materialId} onChange={(event) => onApply(updateFacadeZone(plan, id, { materialId: event.target.value }))}>
          {CLADDING.map((item) => <option key={item.id} value={item.id}>{item.group}: {item.name}</option>)}
        </select>
      </Field>
      <MenuBtn testid="ctx-delete" onClick={() => onCommit(deleteFacadeZone(plan, id))}>Poista vyöhyke</MenuBtn>
    </div>
  )
}

export function selectionLabel(plan, selection) {
  if (!selection) return 'Talon asetukset'
  if (selection.kind === 'wall') return 'Seinä'
  if (selection.kind === 'opening') {
    const opening = (plan.openings || []).find((item) => item.id === selection.id)
    return opening?.kind === 'window' ? 'Ikkuna' : 'Ovi'
  }
  if (selection.kind === 'room') {
    const room = (plan.rooms || []).find((item) => item.id === selection.id)
    return room?.name ? `Huone: ${room.name}` : 'Huone'
  }
  if (selection.kind === 'fixture') {
    const fixture = (plan.fixtures || []).find((item) => item.id === selection.id)
    return `Kaluste: ${fixtureTemplate(fixture?.type).name}`
  }
  if (selection.kind === 'roof') return 'Katto'
  if (selection.kind === 'zone') return 'Julkisivuvyöhyke'
  if (selection.kind === 'house') return 'Talon asetukset'
  if (selection.kind === 'service') {
    const services = ensureServices(plan)
    const spec = selection.service || {}
    const target = spec.target === 'run'
      ? services.runs.find((item) => item.id === spec.id)
      : services.nodes.find((item) => item.id === spec.id)
    return serviceObjectTitle(target)
  }
  return 'Kohde'
}

export function SelectionPanel({ plan, selection, onApply, onCommit, onClear }) {
  let body = null
  if (!selection?.id && selection?.kind !== 'roof' && selection?.kind !== 'house') {
    body = <div style={{ fontSize: 12, color: '#78716c' }}>Valitse kohde pohjasta tai avaa talon asetukset.</div>
  } else if (selection.kind === 'wall') body = <WallFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'opening') body = <OpeningFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'room') body = <RoomFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'fixture') body = <FixtureFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'roof') body = <RoofFields plan={plan} onApply={onApply} />
  else if (selection.kind === 'house') body = <HouseSettings plan={plan} onApply={onApply} />
  else if (selection.kind === 'zone') body = <ZoneFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'service') {
    body = (
      <ServiceMenu
        docked
        menu={{ kind: 'service', service: selection.service, x: 0, y: 0 }}
        plan={plan}
        onApply={onApply}
        onClose={onClear}
      />
    )
  }
  return <div data-testid="selection-form"><CadStyles />{body}</div>
}

function SplitField({ plan, wall, onCommit }) {
  const [value, setValue] = useState(() => Math.round(segmentLength(wall.a, wall.b) * 500))
  return (
    <Field label="Jaa kohdasta (mm)">
      <span style={{ display: 'flex', gap: 4 }}>
        <input data-testid="wall-split-mm" style={{ ...inputStyle, flex: 1 }} type="number" value={value} onChange={(event) => setValue(event.target.value)} />
        <button type="button" data-testid="wall-split-at" onClick={() => onCommit(splitWallAt(plan, wall.id, fromMm(value)))} style={{ ...menuBtn, width: 'auto', border: '1px solid #d6d3d1' }}>Jaa</button>
      </span>
    </Field>
  )
}

function wallThicknessMm(plan, wall) {
  return Math.round(((wall.thicknessCustom && wall.thickness) || wall.thickness || (wall.kind === 'interior' ? 0.12 : plan.exteriorThickness || 0.24)) * 1000)
}

function WallFields({ plan, id, onApply, onCommit }) {
  const wall = (plan.walls || []).find((item) => item.id === id)
  if (!wall) return null
  const thick = wallThicknessMm(plan, wall)
  const setKind = (kind) => onCommit(updateWall(plan, id, { kind }))
  const setThick = (metres, custom = true) => onCommit(updateWall(plan, id, { thickness: metres, thicknessCustom: custom }))
  const group = wall.kind === 'interior' ? 'interior' : 'exterior'
  return (
    <div>
      <Segmented
        label="Paksuus"
        value={thick}
        onChange={(mmValue) => setThick(mmValue / 1000)}
        options={[
          { value: 240, label: '240', testid: 'wall-thick-240' },
          { value: 120, label: '120', testid: 'wall-thick-120' },
        ]}
      />
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
      <Field label="Verhous">
        <select data-testid="wall-cladding" style={inputStyle} value={wall.materialId || ''} onChange={(event) => onApply(updateWall(plan, id, { materialId: event.target.value }))}>
          <option value="">Oletus</option>
          {(wall.kind === 'interior' ? MATERIALS[group] : CLADDING).map((item) => <option key={item.id} value={item.id}>{item.group ? `${item.group}: ${item.name}` : item.name}</option>)}
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
      <Field label="Suunta (°)">
        <input
          data-testid="wall-direction"
          style={inputStyle}
          type="number"
          defaultValue={wallDirection(wall)}
          key={`${id}-${wallDirection(wall)}`}
          onBlur={(event) => onCommit(setWallDirection(plan, id, Number(event.target.value)))}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
      </Field>
      <SplitField plan={plan} wall={wall} onCommit={onCommit} />
    </div>
  )
}

function OpeningFields({ plan, id, onApply, onCommit }) {
  const opening = (plan.openings || []).find((item) => item.id === id)
  if (!opening) return null
  const patch = (next) => onApply(updateOpening(plan, id, next))
  return (
    <div>
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

function RoomFields({ plan, id, onApply }) {
  const room = (plan.rooms || []).find((item) => item.id === id)
  if (!room) return null
  const patch = (next) => onApply(updateRoom(plan, id, next))
  return (
    <div>
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

const FIXTURE_SWATCHES = [
  { id: '#1c1917', name: 'Musta' },
  { id: '#f5f5f4', name: 'Valkoinen' },
  { id: '#a8a29e', name: 'Harmaa' },
  { id: '#c4a484', name: 'Tammi' },
  { id: '#9a3412', name: 'Tiili' },
  { id: '#134e4a', name: 'Vihreä' },
  { id: '#1d4ed8', name: 'Sininen' },
]

export function ColorSwatches({ value, onChange, testid = 'fixture-color', customTestid = 'fixture-color-custom' }) {
  const current = (value || '#1c1917').toLowerCase()
  return (
    <div data-testid={testid}>
      <div className="cad-label">Väri</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 8px 6px' }}>
        {FIXTURE_SWATCHES.map((item) => {
          const active = current === item.id
          return (
            <button
              key={item.id}
              type="button"
              title={item.name}
              aria-label={item.name}
              aria-pressed={active}
              onClick={() => onChange(item.id)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: item.id,
                border: active ? '2px solid #0f766e' : '1px solid #a8a29e',
                boxShadow: active ? 'inset 0 0 0 2px #fff' : 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            />
          )
        })}
        <label title="Muu väri" aria-label="Muu väri" style={{ position: 'relative', width: 22, height: 22, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: '1px solid #a8a29e' }}>
          <span style={{ position: 'absolute', inset: 0, background: 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)' }} />
          <input data-testid={customTestid} type="color" value={current} onChange={(event) => onChange(event.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }} />
        </label>
      </div>
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
      <Field label="Leveys (mm)">
        <input style={inputStyle} type="number" value={mm(fixture.w || tplW)} onChange={(event) => onApply(updateFixture(plan, id, { w: fromMm(event.target.value) || 0.3 }))} />
      </Field>
      <Field label="Syvyys (mm)">
        <input style={inputStyle} type="number" value={mm(fixture.d || tplD)} onChange={(event) => onApply(updateFixture(plan, id, { d: fromMm(event.target.value) || 0.3 }))} />
      </Field>
      <ColorSwatches value={fixture.color} onChange={(color) => onApply(updateFixture(plan, id, { color }))} />
      <MenuBtn testid="panel-rotate" onClick={() => onCommit(rotateFixture(plan, id))}>Kierrä 90°</MenuBtn>
      <MenuBtn testid="panel-mirror" onClick={() => onCommit(mirrorFixture(plan, id))}>Peilaa</MenuBtn>
    </div>
  )
}

function wallKindName(kind) {
  if (kind === 'interior') return 'Väliseinä'
  if (kind === 'bearing') return 'Kantava seinä'
  return 'Ulkoseinä'
}

function claddingChoices(wall) {
  if (wall.kind === 'interior') return MATERIALS.interior.map((item) => ({ id: item.id, name: item.name, color: item.color }))
  return CLADDING.map((item) => ({ id: item.id, name: item.group ? `${item.group}: ${item.name}` : item.name, color: item.color }))
}

export function FloorMenu({ menu, plan, onApply, onCommit, onNavigate }) {
  if (!menu || menu.kind === 'service') return null
  const wall = (plan.walls || []).find((item) => item.id === menu.id)
  const opening = (plan.openings || []).find((item) => item.id === menu.id)
  const room = (plan.rooms || []).find((item) => item.id === menu.id)
  const fixture = (plan.fixtures || []).find((item) => item.id === menu.id)
  const zone = (plan.facades || []).find((item) => item.id === menu.id)
  const act = (next) => {
    onCommit(next)
    onNavigate('close')
  }
  const properties = () => onNavigate('properties')
  let title = 'Kohde'
  let body = null
  if (menu.kind === 'wall' && wall) {
    const thick = wallThicknessMm(plan, wall)
    const activeCladding = wall.materialId || (wall.kind === 'interior' ? '' : plan.exteriorId)
    title = `${wallKindName(wall.kind)} ${mm(segmentLength(wall.a, wall.b))} mm`
    body = (
      <>
        <Segmented
          label="Paksuus"
          value={thick}
          onChange={(mmValue) => onCommit(updateWall(plan, wall.id, { thickness: mmValue / 1000, thicknessCustom: true }))}
          options={[
            { value: 240, label: '240', testid: 'ctx-thick-240' },
            { value: 120, label: '120', testid: 'ctx-thick-120' },
          ]}
        />
        <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, fontWeight: 650 }}>
          Suunta
          <input
            data-testid="ctx-wall-angle"
            type="number"
            defaultValue={wallDirection(wall)}
            key={`dir-${wall.id}-${wallDirection(wall)}`}
            onBlur={(event) => onCommit(setWallDirection(plan, wall.id, Number(event.target.value)))}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
            style={{ width: 64, padding: '4px 6px', borderRadius: 6, border: '1px solid #d6d3d1' }}
          />
          °
        </label>
        <CadSep />
        <CadItem testid="ctx-split" onClick={() => act(splitWall(plan, wall.id, menu.at || { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }))}>Jaa seinä</CadItem>
        <CadItem testid="ctx-door" onClick={() => act(addOpening(plan, wall.id, menu.at || wall.a, 'door'))}>Lisää ovi</CadItem>
        <CadItem testid="ctx-window" onClick={() => act(addOpening(plan, wall.id, menu.at || wall.a, 'window'))}>Lisää ikkuna</CadItem>
        <Flyout label="Verhous" testid="ctx-cladding">
          {claddingChoices(wall).map((item) => (
            <CadItem key={item.id} onClick={() => onApply(updateWall(plan, wall.id, { materialId: item.id }))}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: item.color, border: '1px solid #a8a29e' }} />
                {item.name}
                {activeCladding === item.id ? ' ✓' : ''}
              </span>
            </CadItem>
          ))}
        </Flyout>
        <CadItem testid="ctx-facade" onClick={() => onNavigate('facade')}>Julkisivu</CadItem>
        <CadSep />
        <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(deleteWall(plan, wall.id))}>Poista</CadItem>
      </>
    )
  } else if (menu.kind === 'corner') {
    const joint = cornerJoint(plan.walls, menu.at || { x: 0, z: 0 }, 0.2)
    const angle = cornerAngles(plan.walls).find((item) => joint && Math.hypot(item.x - joint.x, item.z - joint.z) < 0.12)
    const degrees = angle?.degrees ?? 90
    title = `Kulma ${degrees}°`
    body = (
      <>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, fontWeight: 650 }}>
          Kulma…
          <input
            data-testid="corner-angle"
            type="number"
            min="1"
            max="179"
            defaultValue={degrees}
            key={`corner-${degrees}-${joint?.x}-${joint?.z}`}
            onBlur={(event) => {
              if (!joint) return
              onCommit(setCornerAngle(plan, joint, Number(event.target.value)))
            }}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
            style={{ width: 64, padding: '4px 6px', borderRadius: 6, border: '1px solid #d6d3d1' }}
          />
          °
        </label>
        <div style={{ padding: '0 8px 6px', fontSize: 11, color: '#78716c' }}>Viereinen seinä kiertyy nurkan ympäri.</div>
      </>
    )
  } else if (menu.kind === 'opening' && opening) {
    title = `${opening.kind === 'window' ? 'Ikkuna' : 'Ovi'} ${mm(opening.width)} mm`
    body = (
      <>
        <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
        <CadSep />
        <CadItem testid="ctx-flip" onClick={() => act(flipOpening(plan, opening.id))}>Käännä</CadItem>
        <CadSep />
        <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(deleteOpening(plan, opening.id))}>Poista</CadItem>
      </>
    )
  } else if (menu.kind === 'room' && room) {
    title = room.name || 'Huone'
    body = (
      <>
        <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
        <CadSep />
        <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(deleteRoom(plan, room.id))}>Poista</CadItem>
      </>
    )
  } else if (menu.kind === 'fixture' && fixture) {
    title = `Kaluste: ${fixtureTemplate(fixture.type).name}`
    body = (
      <>
        <ColorSwatches value={fixture.color} onChange={(color) => onApply(updateFixture(plan, fixture.id, { color }))} testid="ctx-fixture-color" customTestid="ctx-color-custom" />
        <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
        <CadSep />
        <CadItem testid="ctx-rotate" shortcut="R" onClick={() => onCommit(rotateFixture(plan, fixture.id))}>Kierrä</CadItem>
        <CadItem testid="ctx-mirror" onClick={() => onCommit(mirrorFixture(plan, fixture.id))}>Peilaa</CadItem>
        <CadItem testid="ctx-duplicate" shortcut="Ctrl+D" onClick={() => act(duplicateFixture(plan, fixture.id))}>Monista</CadItem>
        <CadSep />
        <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(removeFixture(plan, fixture.id))}>Poista</CadItem>
      </>
    )
  } else if (menu.kind === 'zone' && zone) {
    const current = CLADDING.find((item) => item.id === zone.materialId)
    title = current ? `Julkisivuvyöhyke: ${current.name}` : 'Julkisivuvyöhyke'
    body = (
      <>
        <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
        <Flyout label="Verhous" testid="ctx-cladding">
          {CLADDING.map((item) => (
            <CadItem key={item.id} onClick={() => onApply(updateFacadeZone(plan, zone.id, { materialId: item.id }))}>{item.name}</CadItem>
          ))}
        </Flyout>
        <CadSep />
        <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(deleteFacadeZone(plan, zone.id))}>Poista</CadItem>
      </>
    )
  } else if (menu.kind === 'roof') {
    const roof = ROOF_TYPES.find((item) => item.id === (plan.roofType || 'gable'))
    title = roof ? `Katto: ${roof.name}` : 'Katto'
    body = <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
  } else if (menu.kind === 'house') {
    title = plan.name || 'Talo'
    body = <CadItem testid="ctx-house" onClick={() => onNavigate('house')}>Talon asetukset</CadItem>
  } else if (menu.kind === 'canvas') {
    title = 'Pohja'
    body = (
      <>
        <CadItem testid="ctx-paste" onClick={() => onNavigate('paste')}>Liitä</CadItem>
        <CadItem testid="ctx-draw-wall" onClick={() => onNavigate('wall')}>Piirrä seinä</CadItem>
        <CadItem testid="ctx-draw-room" onClick={() => onNavigate('room')}>Piirrä huone</CadItem>
        <CadSep />
        <CadItem testid="ctx-house" onClick={() => onNavigate('house')}>Talon asetukset</CadItem>
      </>
    )
  } else return null
  return (
    <CadMenu x={menu.x} y={menu.y} kind={menu.kind} title={title}>
      {body}
    </CadMenu>
  )
}
