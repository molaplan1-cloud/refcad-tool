'use client'

import { useState } from 'react'
import { CAD_COMMANDS, CAD_LAYERS, mirrorOpenings, sharedProperties } from '@/lib/cadEdit'
import { CadItem, CadMenu, CadSep, CadStyles, Flyout, Segmented } from './CadMenu'
import { MultiProperties } from './CadTools'
import {
  CLADDING,
  MATERIALS,
  claddingOf,
  openingColour,
  surfaceLook,
  ROOM_TYPES,
  ROOF_TYPES,
  STANDARD_SCALES,
  WALL_STRUCTURES,
  addFacadeSplit,
  addOpening,
  applyFacadePreset,
  assignFacadeCell,
  applyRoomType,
  defaultRoomSetpoint,
  faceSide,
  resolveFaceMaterial,
  setFaceMaterial,
  setRoomFaces,
  wallFacePairs,
  cornerAngles,
  cornerJoint,
  splitWallAt,
  deleteFacadeZone,
  deleteOpening,
  deleteRoom,
  applyFixtureVariant,
  deleteWall,
  duplicateFixture,
  fixtureTemplate,
  mirrorFixture,
  removeFixture,
  rotateFixture,
  segmentLength,
  setCornerAngle,
  setWallDirection,
  setWallLength,
  thicknessOf,
  wallDirection,
  splitWall,
  updateFacadeZone,
  updateFixture,
  updateHouse,
  updateOpening,
  updateRoom,
  updateWall,
  visibleRooms,
} from '@/lib/floorplan'
import { usePlanLocale } from '@/components/i18n/Locale'
import { BRICK_TONES, PAINTS, PLINTHS, ROOFINGS, ROOF_COLOURS, finishesOf, roofingOf } from '@/lib/finishes'
import { text } from '@/lib/i18n'
import { COUNTRIES, climateOf, countryById } from '@/lib/places'
import { wallBearing } from '@/lib/orientation'
import { updateYardItem } from '@/lib/yard'
import { FRAMES, GLAZING, SHADING, coincidentPeak } from '@/lib/cooling'
import { resolveFixture } from '@/lib/furniture'
import { addChimneyFor, chimneyKind, defaultFlue, flueOptions, withChimneyFields } from '@/lib/chimney'
import { ServiceMenu } from './ServicesLayer'
import { YardFields, YardMenuBody } from './YardPanel'
import { yardTitle } from '@/lib/yard'
import { addServiceNode, applyHeating, applyLocation, ensureServices, refreshHeat, serviceObjectTitle, suggestFloorManifold } from '@/lib/services'
import { HEAT_SOURCES, HEATING_METHODS, LOOP_SPACINGS, normalizeHeating, normalizeRoomHeating } from '@/lib/hydronic'
import { formatRoomInfo, roomReport, thermalOf } from '@/lib/roominfo'
import { normalizeGround } from '@/lib/groundworks'
import {
  LAYER_MATERIALS,
  assignHouseStructure,
  assignWallStructures,
  buildStructureCardPdf,
  moveLayer,
  resolveStructure,
  resolveWallStructure,
  retargetLayer,
  setSlabPipes,
  structuresFor,
  writeWallLayers,
} from '@/lib/structures'

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

function HeatingSettings({ plan, onApply }) {
  const { t, locale } = usePlanLocale(plan)
  const heating = normalizeHeating(plan)
  const set = (patch) => onApply(applyHeating(plan, patch))
  return (
    <div data-testid="heating-settings" style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, margin: '8px 0 6px' }}>{t('house.system')}</div>
      <Field label={t('house.source')}>
        <select data-testid="heat-source" style={inputStyle} value={heating.source} onChange={(event) => set({ source: event.target.value, distribution: event.target.value === 'direct-electric' ? 'none' : (heating.distribution === 'none' ? 'floor' : heating.distribution) })}>
          {HEAT_SOURCES.map((item) => <option key={item.id} value={item.id}>{text(locale, `source.${item.id}`, item.name)}</option>)}
        </select>
      </Field>
      <Field label={t('house.distribution')}>
        <select data-testid="heat-distribution" style={inputStyle} value={heating.distribution} onChange={(event) => set({ distribution: event.target.value })}>
          <option value="floor">{t('dist.floor')}</option>
          <option value="radiator">{t('dist.radiator')}</option>
          <option value="both">{t('dist.both')}</option>
          <option value="none">{t('dist.none')}</option>
        </select>
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        <input data-testid="heat-buffer" type="checkbox" checked={Boolean(heating.buffer)} onChange={(event) => set({ buffer: event.target.checked })} />
        {t('house.buffer')}
      </label>
      {heating.buffer && (
        <Field label={t('house.bufferLitres')}>
          <input data-testid="heat-buffer-litres" style={inputStyle} type="number" min="50" step="50" value={heating.bufferLitres} onChange={(event) => set({ bufferLitres: Math.max(50, parseInt(event.target.value, 10) || 300) })} />
        </Field>
      )}
      {heating.source === 'ground' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
          <input data-testid="heat-borehole" type="checkbox" checked={heating.borehole !== false} onChange={(event) => set({ borehole: event.target.checked })} />
          {t('house.borehole')}
        </label>
      )}
      {heating.source === 'ground' && heating.borehole !== false && normalizeGround(plan.yard?.ground).wells.length > 0 && (
        <div data-testid="borehole-depth" style={{ fontSize: 12, color: '#44403c', margin: '0 0 8px' }}>
          {t('ground.depthNote', {
            depth: Math.round(normalizeGround(plan.yard?.ground).wells.reduce((sum, well) => sum + (Number(well.depth) || 0), 0) / normalizeGround(plan.yard?.ground).wells.length),
            count: normalizeGround(plan.yard?.ground).wells.length,
          })}
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        <input data-testid="heat-air" type="checkbox" checked={Boolean(heating.supplementAir)} onChange={(event) => set({ supplementAir: event.target.checked })} />
        {t('house.air')}
      </label>
      <Field label={t('house.dhw')}>
        <select data-testid="heat-dhw" style={inputStyle} value={heating.dhw} onChange={(event) => set({ dhw: event.target.value })}>
          <option value="tank">Lämminvesivaraaja</option>
          <option value="exchanger">Kaukolämmön siirrin</option>
        </select>
      </Field>
      {heating.dhw === 'tank' && (
        <Field label="Varaajan tilavuus (l)">
          <input data-testid="heat-dhw-litres" style={inputStyle} type="number" min="50" step="50" value={heating.dhwLitres} onChange={(event) => set({ dhwLitres: Math.max(50, parseInt(event.target.value, 10) || 300) })} />
        </Field>
      )}
    </div>
  )
}

export function HouseSettings({ plan, onApply }) {
  const { t, num, locale } = usePlanLocale(plan)
  const scale = STANDARD_SCALES.includes(plan.drawingScale) ? plan.drawingScale : null
  const country = countryById(plan.country || 'FI')
  const climate = climateOf(plan)
  const choosePlace = (countryId, placeId) => {
    onApply(applyLocation(plan, countryId, placeId))
  }
  const localStructures = () => {
    const chosen = climateOf(plan).structures
    let next = updateHouse(plan, assignHouseStructure(plan, 'exteriorWall', chosen.exterior))
    next = updateHouse(next, assignHouseStructure(next, 'interiorWall', chosen.interior))
    next = updateHouse(next, assignHouseStructure(next, 'floor', chosen.floor))
    next = updateHouse(next, assignHouseStructure(next, 'roof', chosen.roof))
    onApply(refreshHeat(next))
  }
  const rooms = visibleRooms(plan).map((room) => roomReport(plan, room)).filter((item) => item?.cooling)
  const houseCool = coincidentPeak(rooms.map((item) => item.cooling))
  return (
    <div data-testid="house-panel">
      <Field label={t('climate.country')}>
        <select data-testid="house-country" style={inputStyle} value={country.id} onChange={(event) => choosePlace(event.target.value, '')}>
          {COUNTRIES.map((item) => <option key={item.id} value={item.id}>{t(`country.${item.id}`)}</option>)}
        </select>
      </Field>
      <Field label={t('house.name')} testid="house-name-field">
        <input data-testid="house-name" style={inputStyle} value={plan.name || ''} onChange={(event) => onApply(updateHouse(plan, { name: event.target.value }))} />
      </Field>
      <Field label={t('house.address')}>
        <input data-testid="house-address" style={inputStyle} value={plan.address || ''} onChange={(event) => onApply(updateHouse(plan, { address: event.target.value }))} />
      </Field>
      <Field label={t('house.type')}>
        <select data-testid="house-type" style={inputStyle} value={plan.buildingType || 'omakotitalo'} onChange={(event) => onApply(updateHouse(plan, { buildingType: event.target.value }))}>
          {BUILDINGS.map(([id]) => <option key={id} value={id}>{t(`building.${id}`)}</option>)}
        </select>
      </Field>
      <Field label={t('house.floors')}>
        <input style={inputStyle} type="number" min="1" max="8" value={plan.floors || 1} onChange={(event) => onApply(updateHouse(plan, { floors: Math.max(1, parseInt(event.target.value, 10) || 1) }))} />
      </Field>
      <Field label={t('house.floorHeight')}>
        <input style={inputStyle} type="number" min="2200" max="4000" value={mm(plan.floorHeight || 2.6)} onChange={(event) => onApply(updateHouse(plan, { floorHeight: fromMm(event.target.value) || 2.6 }))} />
      </Field>
      <ThermalFields plan={plan} onApply={onApply} />
      <Field label={t('house.legacyWall')}>
        <select style={inputStyle} value={plan.exteriorStructure || 'puuranka'} onChange={(event) => onApply(updateHouse(plan, { exteriorStructure: event.target.value }))}>
          {STRUCTURES.map(([id]) => <option key={id} value={id}>{t(`legacy.${id}`)}</option>)}
        </select>
      </Field>
      <Field label={t('house.wallThickness')}>
        <input style={inputStyle} type="number" min="80" max="600" value={mm(plan.exteriorThickness || 0.24)} onChange={(event) => onApply(updateHouse(plan, { exteriorThickness: fromMm(event.target.value) || 0.24 }))} />
      </Field>
      <HouseStructures plan={plan} onApply={onApply} />
      <button type="button" data-testid="apply-local-structures" onClick={localStructures} style={{ ...menuBtn, width: 'auto', border: '1px solid #d6d3d1', marginBottom: 8 }}>{t('climate.applyStructures')}</button>
      <div data-testid="electrical-code" style={{ fontSize: 12, color: '#57534e', marginBottom: 6 }}>{t('climate.code')}: {climate.electrical === 'sfs-6000' ? 'SFS 6000' : 'IEC 60364'} · {climate.voltage?.phase || 230}/{climate.voltage?.line || 400} V</div>
      <div data-testid="u-max" style={{ fontSize: 12, color: '#57534e', marginBottom: 8 }}>{t('climate.umax')}: {t('climate.u.wall')} {num(climate.uMax.wall, 2)} · {t('climate.u.roof')} {num(climate.uMax.roof, 2)} · {t('climate.u.window')} {num(climate.uMax.window, 2)}</div>
      <Field label={t('house.roof')}>
        <select data-testid="house-roof" style={inputStyle} value={plan.roofType || 'gable'} onChange={(event) => onApply(updateHouse(plan, { roofType: event.target.value }))}>
          {ROOF_TYPES.map((item) => <option key={item.id} value={item.id}>{text(locale, `roof.${item.id}`, item.name)}</option>)}
        </select>
      </Field>
      <Field label={t('house.pitch')}>
        <input style={inputStyle} type="number" min="0" max="60" value={plan.roofPitch ?? 25} onChange={(event) => onApply(updateHouse(plan, { roofPitch: parseFloat(event.target.value) || 0 }))} />
      </Field>
      <Field label={t('house.eave')}>
        <input style={inputStyle} type="number" min="0" max="1500" value={mm(plan.eaveOverhang ?? 0.5)} onChange={(event) => onApply(updateHouse(plan, { eaveOverhang: fromMm(event.target.value) }))} />
      </Field>
      <div style={{ fontSize: 12, fontWeight: 700, margin: '4px 0 6px' }}>{t('house.facade')}</div>
      <SwatchRow group="exterior" value={plan.exteriorId} onPick={(id) => onApply({ ...plan, exteriorId: id })} />
      <FinishSettings plan={plan} onApply={onApply} />
      <div style={{ fontSize: 12, fontWeight: 700, margin: '8px 0 6px' }}>{t('house.roofing')}</div>
      <SwatchRow group="roof" value={plan.roofId} onPick={(id) => onApply({ ...plan, roofId: id })} />
      <HeatingSettings plan={plan} onApply={onApply} />
      <div data-testid="house-cooling" style={{ fontSize: 12, margin: '8px 0', padding: 8, background: '#f0f9ff', borderRadius: 8 }}>
        <div style={{ fontWeight: 750 }}>{t('cool.house')}</div>
        <div>{Math.round(houseCool.watts)} W · {num(houseCool.wattsPerM2, 1)} W/m² · {String(houseCool.hour).padStart(2, '0')}:00</div>
      </div>
      <Field label={t('north.label')}>
        <input data-testid="house-north" style={inputStyle} type="number" value={plan.yard?.north || 0} onChange={(event) => onApply(updateYardItem(plan, 'north', 'north', { north: Number(event.target.value) || 0 }))} />
      </Field>
      <div style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 6px' }}>{t('house.scale')}</div>
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

function ColorField({ testid, label, paints, color, customLabel, onChange }) {
  const match = (paints || PAINTS).find((item) => item.hex.toUpperCase() === String(color || '').toUpperCase())
  return (
    <Field label={label}>
      <div style={{ display: 'flex', gap: 6 }}>
        <select data-testid={testid} style={{ ...inputStyle, flex: 1 }} value={match?.id || 'custom'} onChange={(event) => {
          const item = (paints || PAINTS).find((paint) => paint.id === event.target.value)
          if (item) onChange({ color: item.hex, code: item.code })
        }}>
          {(paints || PAINTS).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
          <option value="custom">{customLabel}</option>
        </select>
        <input data-testid={`${testid}-hex`} aria-label={label} style={{ ...inputStyle, width: 96 }} value={color || ''} onChange={(event) => onChange({ color: event.target.value, code: event.target.value })} />
      </div>
    </Field>
  )
}

function FinishSettings({ plan, onApply }) {
  const { t } = usePlanLocale(plan)
  const finish = finishesOf(plan)
  const patch = (next) => onApply({ ...plan, ...next })
  const wood = surfaceLook(plan, plan.exteriorId)
  return (
    <div data-testid="finish-settings">
      <Field label={t('finish.cladding')}>
        <select data-testid="cladding-material" style={inputStyle} value={claddingOf(plan.exteriorId).id} onChange={(event) => patch({ exteriorId: event.target.value })}>
          {CLADDING.map((item) => <option key={item.id} value={item.id}>{item.group}: {item.name}</option>)}
        </select>
      </Field>
      <ColorField testid="cladding-color" label={t('finish.paint')} customLabel={t('finish.custom')} color={finish.claddingColor || wood.color} onChange={({ color, code }) => patch({ claddingColor: color, claddingCode: code })} />
      <Field label={t('finish.board')}>
        <input data-testid="board-width" style={inputStyle} type="number" min="70" max="280" value={finish.boardWidthMm} onChange={(event) => patch({ boardWidthMm: Number(event.target.value) || 145 })} />
      </Field>
      <ColorField testid="trim-color" label={t('finish.trim')} customLabel={t('finish.custom')} color={finish.trimColor} onChange={({ color, code }) => patch({ trimColor: color, trimCode: code })} />
      <ColorField testid="mortar-color" label={t('finish.mortar')} paints={PAINTS.filter((item) => ['white', 'grey', 'dark-grey', 'brown'].includes(item.id))} customLabel={t('finish.custom')} color={finish.mortarColor} onChange={({ color }) => patch({ mortarColor: color })} />
      <Field label={t('finish.brickTone')}>
        <select data-testid="brick-tone" style={inputStyle} value={BRICK_TONES.some((item) => item.id === claddingOf(plan.exteriorId).id) ? claddingOf(plan.exteriorId).id : 'brick-red'} onChange={(event) => patch({ exteriorId: event.target.value, brickPaint: '', brickPaintCode: '' })}>
          {BRICK_TONES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label={t('finish.brickPaint')}>
        <select data-testid="brick-paint" style={inputStyle} value={PAINTS.find((item) => item.hex.toUpperCase() === finish.brickPaint)?.id || (finish.brickPaint ? 'custom' : 'natural')} onChange={(event) => {
          if (event.target.value === 'natural') patch({ brickPaint: '', brickPaintCode: '' })
          else {
            const item = PAINTS.find((paint) => paint.id === event.target.value)
            if (item) patch({ brickPaint: item.hex, brickPaintCode: item.code })
          }
        }}>
          <option value="natural">{t('finish.brickNatural')}</option>
          {PAINTS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
        </select>
      </Field>
      <ColorField testid="render-color" label={t('finish.render')} customLabel={t('finish.custom')} color={finish.renderColor || '#EFE8DC'} onChange={({ color, code }) => patch({ renderColor: color, renderCode: code })} />
      <ColorField testid="concrete-color" label={t('finish.concrete')} customLabel={t('finish.custom')} color={finish.concreteColor || '#C5C3BE'} onChange={({ color, code }) => patch({ concreteColor: color, concreteCode: code })} />
      <ColorField testid="stone-color" label={t('finish.stone')} customLabel={t('finish.custom')} color={finish.stoneColor || '#8D887F'} onChange={({ color, code }) => patch({ stoneColor: color, stoneCode: code })} />
      <ColorField testid="fibre-color" label={t('finish.fibre')} customLabel={t('finish.custom')} color={finish.fibreColor || '#D5D0C8'} onChange={({ color, code }) => patch({ fibreColor: color, fibreCode: code })} />
      <Field label={t('finish.roofMaterial')}>
        <select data-testid="roof-material" style={inputStyle} value={roofingOf(plan.roofId).id} onChange={(event) => patch({ roofId: event.target.value })}>
          {ROOFINGS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <ColorField testid="roof-color" label={t('finish.roofColour')} paints={ROOF_COLOURS} customLabel={t('finish.custom')} color={finish.roofColor || '#1C1C1C'} onChange={({ color, code }) => patch({ roofColor: color, roofCode: code })} />
      <ColorField testid="gutter-color" label={t('finish.gutter')} customLabel={t('finish.custom')} color={finish.gutterColor} onChange={({ color, code }) => patch({ gutterColor: color, gutterCode: code })} />
      <Field label={t('finish.plinthHeight')}>
        <input data-testid="plinth-height" style={inputStyle} type="number" min="300" max="600" value={Math.round(finish.plinthHeight * 1000)} onChange={(event) => patch({ plinthHeight: (Number(event.target.value) || 400) / 1000 })} />
      </Field>
      <Field label={t('finish.plinth')}>
        <select data-testid="plinth-material" style={inputStyle} value={finish.plinthMaterial} onChange={(event) => {
          const item = PLINTHS.find((plinth) => plinth.id === event.target.value) || PLINTHS[0]
          patch({ plinthMaterial: item.id, plinthColor: item.color, plinthCode: item.code })
        }}>
          {PLINTHS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
        </select>
      </Field>
      <ColorField testid="window-color" label={t('finish.window')} customLabel={t('finish.custom')} color={finish.windowColor} onChange={({ color, code }) => patch({ windowColor: color, windowCode: code })} />
      <ColorField testid="door-color" label={t('finish.door')} customLabel={t('finish.custom')} color={finish.doorColor} onChange={({ color, code }) => patch({ doorColor: color, doorCode: code })} />
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

function ZoneFields({ plan, id, selection, onApply, onCommit }) {
  const { t } = usePlanLocale(plan)
  const stored = (plan.facades || []).find((item) => item.id === id)
  const cell = stored || selection
  if (!cell?.side && !stored) return null
  const target = {
    side: cell.side || selection?.side,
    u0: selection?.u0 ?? cell.u0,
    u1: selection?.u1 ?? cell.u1,
    y0: selection?.y0 ?? cell.y0,
    y1: selection?.y1 ?? cell.y1,
    materialId: selection?.materialId || cell.materialId,
    zoneId: stored?.id || selection?.zoneId || null,
    color: cell.color,
    colorCode: cell.colorCode,
  }
  if (!target.side || !Number.isFinite(target.u0)) return null
  const look = surfaceLook(plan, target.materialId, { color: target.color, colorCode: target.colorCode })
  const paint = (patch) => onCommit(assignFacadeCell(plan, target, patch))
  return (
    <div data-testid="zone-fields">
      <div style={{ fontSize: 12, fontWeight: 750, marginBottom: 8 }}>Julkisivuvyöhyke</div>
      <Field label="Materiaali">
        <select data-testid="zone-material" style={inputStyle} value={target.materialId || 'brick-yellow'} onChange={(event) => paint({ materialId: event.target.value })}>
          {CLADDING.map((item) => <option key={item.id} value={item.id}>{item.group}: {item.name}</option>)}
        </select>
      </Field>
      <ColorField testid="zone-color" label={t('finish.paint')} customLabel={t('finish.custom')} color={target.color || look.color} onChange={({ color, code }) => paint({ materialId: target.materialId, color, colorCode: code })} />
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <MenuBtn testid="zone-above" onClick={() => onCommit(applyFacadePreset(plan, target.side, 'above', 'wood-horizontal'))}>Ikkunan yläpuoli</MenuBtn>
        <MenuBtn testid="zone-band" onClick={() => onCommit(applyFacadePreset(plan, target.side, 'band', 'brick-yellow'))}>Ikkunoiden välinen kaista</MenuBtn>
      </div>
      {stored && <MenuBtn testid="ctx-delete" onClick={() => onCommit(deleteFacadeZone(plan, stored.id))}>Poista vyöhyke</MenuBtn>}
    </div>
  )
}

export function selectionLabel(plan, selection) {
  const locale = plan?.locale || 'fi'
  const tr = (key, vars) => text(locale, key, key)
  if (!selection) return tr('file.house')
  if (selection.kind === 'wall') return tr('select.wall')
  if (selection.kind === 'opening') {
    const opening = (plan.openings || []).find((item) => item.id === selection.id)
    return opening?.kind === 'window' ? tr('opening.window') : tr('opening.door')
  }
  if (selection.kind === 'room') {
    const room = (plan.rooms || []).find((item) => item.id === selection.id)
    return room?.name ? text(locale, 'select.roomNamed', `Huone: ${room.name}`).replace('{name}', room.name) : tr('select.room')
  }
  if (selection.kind === 'fixture') {
    const fixture = (plan.fixtures || []).find((item) => item.id === selection.id)
    return text(locale, 'select.fixture', `Kaluste: ${fixtureTemplate(fixture?.type).name}`).replace('{name}', fixtureTemplate(fixture?.type).name)
  }
  if (selection.kind === 'roof') return tr('select.roof')
  if (selection.kind === 'zone') return tr('select.zone')
  if (selection.kind === 'house') return tr('file.house')
  if (selection.kind === 'yard') return yardTitle(plan, selection)
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

export function SelectionPanel({ plan, selection, picks, onApply, onCommit, onClear, onRedrawRoute, onPatchMany }) {
  if (picks && picks.length > 1) {
    const shared = sharedProperties(plan, picks)
    return (
      <div data-testid="selection-form">
        <CadStyles />
        <MultiProperties count={picks.length}>
          <Field label="Taso">
            <select data-testid="multi-layer" style={inputStyle} value={shared.layer || ''} onChange={(event) => onPatchMany({ layer: event.target.value })}>
              <option value="">Sekalaiset</option>
              {CAD_LAYERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          {shared.kinds.length === 1 && shared.kinds[0] === 'wall' && (
            <Field label="Tyyppi">
              <select data-testid="multi-kind" style={inputStyle} value={shared.kind || 'exterior'} onChange={(event) => onPatchMany({ kind: event.target.value, layer: event.target.value })}>
                <option value="exterior">Ulkoseinä</option>
                <option value="bearing">Kantava</option>
                <option value="interior">Väliseinä</option>
              </select>
            </Field>
          )}
          {shared.kinds.length === 1 && shared.kinds[0] === 'wall' && (
            <StructureFields plan={plan} wallIds={picks.filter((item) => item.kind === 'wall').map((item) => item.id)} onCommit={onCommit} />
          )}
          {shared.kinds.length === 1 && shared.kinds[0] === 'fixture' && (
            <Field label="Kierto (°)" >
              <input data-testid="multi-rotation" style={inputStyle} type="number" value={Number.isFinite(shared.rotation) ? shared.rotation : 0} onChange={(event) => onPatchMany({ rotation: Number(event.target.value) || 0 })} />
            </Field>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650 }}>
            <input data-testid="multi-lock" type="checkbox" checked={Boolean(shared.cadLock)} onChange={(event) => onPatchMany({ cadLock: event.target.checked })} />
            Lukittu
          </label>
        </MultiProperties>
      </div>
    )
  }
  let body = null
  if (!selection?.id && selection?.kind !== 'roof' && selection?.kind !== 'house') {
    body = <div style={{ fontSize: 12, color: '#78716c' }}>Valitse kohde pohjasta tai avaa talon asetukset.</div>
  } else if (selection.kind === 'wall') body = <WallFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'opening') body = <OpeningFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'room') body = <RoomFields plan={plan} id={selection.id} wallId={selection.wallId} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'fixture') body = <FixtureFields plan={plan} id={selection.id} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'roof') body = <RoofFields plan={plan} onApply={onApply} />
  else if (selection.kind === 'house') body = <HouseSettings plan={plan} onApply={onApply} />
  else if (selection.kind === 'yard') body = <YardFields plan={plan} selection={selection} onCommit={onCommit} />
  else if (selection.kind === 'zone') body = <ZoneFields plan={plan} id={selection.id} selection={selection} onApply={onApply} onCommit={onCommit} />
  else if (selection.kind === 'service') {
    body = (
      <ServiceMenu
        docked
        menu={{ kind: 'service', service: selection.service, x: 0, y: 0 }}
        plan={plan}
        onApply={onApply}
        onCommit={onCommit}
        onClose={onClear}
        onRedraw={onRedrawRoute}
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
        <button type="button" data-testid="wall-split-at" onClick={() => onCommit(refreshHeat(splitWallAt(plan, wall.id, fromMm(value))))} style={{ ...menuBtn, width: 'auto', border: '1px solid #d6d3d1' }}>Jaa</button>
      </span>
    </Field>
  )
}

function wallThicknessMm(plan, wall) {
  return Math.round(thicknessOf(wall, plan) * 1000)
}

function structureChoices(plan, walls) {
  const categories = new Set(walls.map((wall) => (wall.kind === 'interior' || wall.kind === 'partition' ? 'interior' : 'exterior')))
  const list = [...categories].flatMap((category) => structuresFor(plan, category))
  const seen = new Set()
  return list.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function HouseStructures({ plan, onApply }) {
  const { t, locale, num } = usePlanLocale(plan)
  const applyRole = (role, id) => onApply(refreshHeat(updateHouse(plan, assignHouseStructure(plan, role, id || null))))
  const floor = resolveStructure(plan, plan.structures?.floor)
  const pipes = Boolean(floor?.layers?.some((item) => item.materialId === 'pex'))
  const select = (testid, label, role, value) => (
    <Field key={role} label={label}>
      <select data-testid={testid} style={inputStyle} value={value || ''} onChange={(event) => applyRole(role, event.target.value)}>
        <option value="">{t('struct.none')}</option>
        {structuresFor(plan, role === 'exteriorWall' ? 'exterior' : role === 'interiorWall' ? 'interior' : role === 'midFloor' ? 'midfloor' : role).map((item) => (
          <option key={item.id} value={item.id}>{text(locale, `struct.${item.id}`, item.name)} · {item.thicknessMm} mm · U {num(item.u, 2)}</option>
        ))}
      </select>
    </Field>
  )
  return (
    <div data-testid="house-structures">
      {select('house-exterior-structure', t('struct.defaultExterior'), 'exteriorWall', plan.exteriorStructureId || plan.structures?.exteriorWall)}
      {select('house-interior-structure', t('struct.defaultInterior'), 'interiorWall', plan.structures?.interiorWall)}
      {select('house-floor-structure', t('struct.floor'), 'floor', plan.structures?.floor)}
      {select('house-roof-structure', t('struct.roof'), 'roof', plan.structures?.roof)}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, margin: '4px 0 8px' }}>
        <input data-testid="slab-pipes" type="checkbox" checked={pipes} onChange={(event) => onApply(refreshHeat(setSlabPipes(plan, event.target.checked)))} />
        {t('struct.slabPipes')}
      </label>
    </div>
  )
}

function StructureFields({ plan, wallIds, onCommit }) {
  const walls = (wallIds || []).map((id) => (plan.walls || []).find((item) => item.id === id)).filter(Boolean)
  if (!walls.length) return null
  const ids = walls.map((wall) => wall.structureId || '')
  const sharedId = ids.every((id) => id === ids[0]) ? ids[0] : ''
  const resolved = walls.map((wall) => resolveWallStructure(plan, wall)).filter(Boolean)
  const sameSpec = resolved.length === walls.length && resolved.every((item) => item.id === resolved[0].id)
  const spec = sameSpec ? resolved[0] : null
  const fallback = walls.length === 1 ? resolveWallStructure(plan, { ...walls[0], structureId: null }) : null
  const commitPlan = (next) => onCommit(refreshHeat(next))
  const editLayers = (layers, extra = {}) => {
    if (!spec) return
    commitPlan(writeWallLayers(plan, walls.map((wall) => wall.id), {
      id: spec.id,
      category: spec.category,
      name: extra.name || spec.name,
      frameFraction: Number.isFinite(extra.frameFraction) ? extra.frameFraction : spec.frameFraction,
      layers,
    }))
  }
  return (
    <div data-testid="structure-editor">
      <Field label="Rakennetyyppi">
        <select
          data-testid={walls.length > 1 ? 'multi-structure' : 'wall-structure-type'}
          style={inputStyle}
          value={sharedId}
          onChange={(event) => commitPlan(assignWallStructures(plan, walls.map((wall) => wall.id), event.target.value || null))}
        >
          <option value="">{fallback ? `Talon oletus (${fallback.name})` : 'Talon oletus'}</option>
          {structureChoices(plan, walls).map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {item.thicknessMm} mm</option>
          ))}
        </select>
      </Field>
      {spec && (
        <div data-testid="structure-card-view" style={{ border: '1px solid #e7e5e4', borderRadius: 8, padding: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div data-testid="structure-u" style={{ fontSize: 12, fontWeight: 750 }}>U {Number(spec.u).toFixed(2).replace('.', ',')} · {spec.thicknessMm} mm</div>
            <button type="button" data-testid="structure-card" onClick={() => buildStructureCardPdf(spec).save(`${spec.id || 'rakenne'}.pdf`)} style={{ ...menuBtn, width: 'auto', border: '1px solid #d6d3d1', padding: '4px 8px' }}>Rakennekortti</button>
          </div>
          <Field label="Nimi">
            <input data-testid="structure-name" style={inputStyle} defaultValue={spec.name} key={`${spec.id}-${spec.name}`} onBlur={(event) => {
              const name = event.target.value.trim()
              if (name && name !== spec.name) editLayers(spec.layers.map((item) => ({ ...item })), { name })
            }} />
          </Field>
          <div style={{ fontSize: 11, fontWeight: 700, margin: '4px 0' }}>Kerrokset, sisältä ulos</div>
          {spec.layers.map((item, index) => (
            <div key={`${spec.id}-${index}`} data-testid="structure-layer" style={{ display: 'grid', gridTemplateColumns: '1fr 64px auto', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <select aria-label="Kerrosmateriaali" style={inputStyle} value={item.materialId} onChange={(event) => {
                const layers = spec.layers.map((row, rowIndex) => (rowIndex === index ? retargetLayer(row, event.target.value) : { ...row }))
                editLayers(layers)
              }}>
                {LAYER_MATERIALS.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
              </select>
              <input
                data-testid="structure-layer-mm"
                aria-label="Kerrospaksuus"
                style={inputStyle}
                type="number"
                min="0"
                step="1"
                defaultValue={item.thicknessMm}
                key={`${spec.id}-${index}-${item.thicknessMm}-${item.materialId}`}
                onBlur={(event) => {
                  const thicknessMm = Math.max(0, parseFloat(event.target.value) || 0)
                  if (thicknessMm === item.thicknessMm) return
                  const layers = spec.layers.map((row, rowIndex) => (rowIndex === index ? { ...row, thicknessMm } : { ...row }))
                  editLayers(layers)
                }}
              />
              <span style={{ display: 'flex', gap: 2 }}>
                <button type="button" aria-label="Siirrä sisäänpäin" onClick={() => editLayers(moveLayer(spec, index, -1).layers)} style={{ ...menuBtn, width: 22, border: '1px solid #d6d3d1', padding: 0 }}>↑</button>
                <button type="button" aria-label="Siirrä ulospäin" onClick={() => editLayers(moveLayer(spec, index, 1).layers)} style={{ ...menuBtn, width: 22, border: '1px solid #d6d3d1', padding: 0 }}>↓</button>
                <button type="button" aria-label="Poista kerros" onClick={() => editLayers(spec.layers.filter((_, rowIndex) => rowIndex !== index))} style={{ ...menuBtn, width: 22, border: '1px solid #d6d3d1', padding: 0 }}>×</button>
              </span>
            </div>
          ))}
          <button type="button" data-testid="structure-add-layer" onClick={() => editLayers([...spec.layers.map((item) => ({ ...item })), retargetLayer({ thicknessMm: 13, frame: false }, 'gypsum')])} style={{ ...menuBtn, border: '1px solid #d6d3d1' }}>Lisää kerros</button>
        </div>
      )}
    </div>
  )
}

function WallFields({ plan, id, onApply, onCommit }) {
  const { t } = usePlanLocale(plan)
  const wall = (plan.walls || []).find((item) => item.id === id)
  if (!wall) return null
  const compass = wall.kind === 'interior' ? null : wallBearing(plan, wall)
  const thick = wallThicknessMm(plan, wall)
  const setKind = (kind) => onCommit(refreshHeat(updateWall(plan, id, { kind })))
  const setThick = (metres, custom = true) => onCommit(updateWall(plan, id, { thickness: metres, thicknessCustom: custom }))
  return (
    <div>
      {compass && (
        <div data-testid="wall-compass" data-compass={compass.code} style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>
          {t('opening.compass')}: {compass.code} · {t(`compass.${compass.code}`)} ({compass.bearing}°)
        </div>
      )}
      <Segmented
        label={t('wall.thickness')}
        value={thick}
        onChange={(mmValue) => setThick(mmValue / 1000)}
        options={[
          { value: 240, label: '240', testid: 'wall-thick-240' },
          { value: 120, label: '120', testid: 'wall-thick-120' },
        ]}
      />
      <Field label={t('wall.custom')}>
        <input style={inputStyle} type="number" value={thick} onChange={(event) => setThick(fromMm(event.target.value) || 0.12)} />
      </Field>
      <Field label={t('wall.kind')}>
        <select data-testid="wall-type" style={inputStyle} value={wall.kind === 'bearing' ? 'bearing' : wall.kind === 'interior' ? 'interior' : 'exterior'} onChange={(event) => setKind(event.target.value)}>
          <option value="exterior">{t('tool.exterior')}</option>
          <option value="bearing">{t('wall.bearing')}</option>
          <option value="interior">{t('tool.interior')}</option>
        </select>
      </Field>
      <Field label={t('wall.height')}>
        <input style={inputStyle} type="number" value={mm(wall.height || plan.floorHeight || 2.6)} onChange={(event) => onApply(refreshHeat(updateWall(plan, id, { height: fromMm(event.target.value) || 2.6, heightCustom: true })))} />
      </Field>
      <Field label={t('wall.fire')}>
        <select data-testid="wall-structure" style={inputStyle} value={wall.structure || 'puuranka'} onChange={(event) => onApply(updateWall(plan, id, { structure: event.target.value }))}>
          {WALL_STRUCTURES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <StructureFields plan={plan} wallIds={[id]} onCommit={onCommit} />
      <WallFaces plan={plan} wall={wall} onApply={onApply} />
      {wall.kind !== 'interior' && (
        <Field label={t('wall.cladding')}>
          <select data-testid="wall-cladding" style={inputStyle} value={wall.materialId || ''} onChange={(event) => onApply(updateWall(plan, id, { materialId: event.target.value }))}>
            <option value="">{t('wall.default')}</option>
            {CLADDING.map((item) => <option key={item.id} value={item.id}>{item.group}: {item.name}</option>)}
          </select>
        </Field>
      )}
      <Field label={t('wall.length')}>
        <input
          data-testid="wall-length"
          style={inputStyle}
          type="number"
          defaultValue={mm(segmentLength(wall.a, wall.b))}
          key={`${id}-${mm(segmentLength(wall.a, wall.b))}`}
          onBlur={(event) => onCommit(refreshHeat(setWallLength(plan, id, fromMm(event.target.value))))}
        />
      </Field>
      <Field label={t('wall.direction')}>
        <input
          data-testid="wall-direction"
          style={inputStyle}
          type="number"
          defaultValue={wallDirection(wall)}
          key={`${id}-${wallDirection(wall)}`}
          onBlur={(event) => onCommit(refreshHeat(setWallDirection(plan, id, Number(event.target.value))))}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
      </Field>
      <SplitField plan={plan} wall={wall} onCommit={onCommit} />
    </div>
  )
}

const handBtn = (on) => ({
  flex: 1,
  height: 28,
  padding: '0 10px',
  borderRadius: 6,
  border: `1px solid ${on ? '#0f766e' : '#d6d3d1'}`,
  background: on ? '#0f766e' : '#fff',
  color: on ? '#f0fdfa' : '#1c1917',
  fontSize: 12,
  fontWeight: 750,
  cursor: 'pointer',
})

export function DoorHandControls({ swing = 1, inward = false, onSwing, onInward, compact = false }) {
  const left = (swing || 1) >= 0
  const choice = (testid, label, on, click) => (
    <button type="button" data-testid={testid} aria-pressed={on} onClick={click} style={{ ...handBtn(on), flex: compact ? '0 0 auto' : 1, minWidth: compact ? 58 : 0 }}>{label}</button>
  )
  const row = (testid, label, shortcut, buttons) => (
    <div data-testid={testid} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: compact ? 0 : 8 }}>
      <span style={{ fontSize: 12, fontWeight: 750, color: '#1c1917', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ display: 'flex', gap: 4, flex: compact ? '0 0 auto' : 1 }}>{buttons}</span>
      {shortcut && <span style={{ marginLeft: compact ? 0 : 'auto', fontSize: 11, fontWeight: 650, color: '#a8a29e', whiteSpace: 'nowrap' }}>{shortcut}</span>}
    </div>
  )
  return (
    <div data-testid="door-hand" style={{ display: compact ? 'flex' : 'block', alignItems: 'center', gap: compact ? 14 : 0, marginBottom: compact ? 0 : 4 }}>
      {row('door-handedness', 'Kätisyys:', compact ? null : 'F', <>
        {choice('door-hand-left', 'Vasen', left, () => onSwing?.(1))}
        {choice('door-hand-right', 'Oikea', !left, () => onSwing?.(-1))}
      </>)}
      {row('door-leaf', 'Aukeaa:', compact ? null : 'Shift+F', <>
        {choice('door-leaf-in', 'Sisään', Boolean(inward), () => onInward?.(true))}
        {choice('door-leaf-out', 'Ulos', !inward, () => onInward?.(false))}
      </>)}
    </div>
  )
}

function OpeningFields({ plan, id, onApply, onCommit }) {
  const { t } = usePlanLocale(plan)
  const opening = (plan.openings || []).find((item) => item.id === id)
  if (!opening) return null
  const patch = (next) => onApply(refreshHeat(updateOpening(plan, id, next)))
  const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
  const compass = wall && wall.kind !== 'interior' ? wallBearing(plan, wall) : null
  const left = (opening.swing || 1) >= 0
  const setHand = (swing) => {
    if ((swing >= 0) === left) return
    onCommit(updateOpening(plan, id, { swing }))
  }
  const setLeaf = (inward) => {
    if (Boolean(opening.inward) === inward) return
    onCommit(updateOpening(plan, id, { inward }))
  }
  return (
    <div>
      {opening.kind === 'door' && (
        <DoorHandControls swing={opening.swing} inward={opening.inward} onSwing={setHand} onInward={setLeaf} />
      )}
      {compass && (
        <div data-testid="window-compass" data-compass={compass.code} style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>
          {t('opening.compass')}: {compass.code} · {t(`compass.${compass.code}`)}
        </div>
      )}
      <Field label={t('opening.width')}>
        <input style={inputStyle} type="number" value={mm(opening.width)} onChange={(event) => patch({ width: fromMm(event.target.value) || 0.6 })} />
      </Field>
      <Field label={t('opening.height')}>
        <input style={inputStyle} type="number" value={mm(opening.height || (opening.kind === 'window' ? 1.2 : 2.1))} onChange={(event) => patch({ height: fromMm(event.target.value) || 1 })} />
      </Field>
      <Field label={t('opening.sill')}>
        <input style={inputStyle} type="number" value={mm(opening.sill || 0)} onChange={(event) => patch({ sill: fromMm(event.target.value) })} />
      </Field>
      <ColorField testid="opening-color" label={opening.kind === 'window' ? t('finish.window') : t('finish.door')} customLabel={t('finish.custom')} color={opening.color || openingColour(plan, opening).color} onChange={({ color, code }) => patch({ color, colorCode: code })} />
      <Field label={t('opening.kind')}>
        <select style={inputStyle} value={opening.kind} onChange={(event) => {
          const kind = event.target.value
          patch({ kind, height: kind === 'window' ? 1.2 : 2.1, sill: kind === 'window' ? 0.9 : 0, width: kind === 'window' ? 1.2 : 0.9 })
        }}>
          <option value="door">{t('opening.door')}</option>
          <option value="window">{t('opening.window')}</option>
        </select>
      </Field>
      {opening.kind === 'window' && (
        <>
          <Field label={t('glazing.label')}>
            <select data-testid="window-glazing" style={inputStyle} value={opening.glazing || 'double-low-e'} onChange={(event) => patch({ glazing: event.target.value })}>
              {GLAZING.map((item) => <option key={item.id} value={item.id}>{t(`glazing.${item.id}`)} · U {item.u} · g {item.g}</option>)}
            </select>
          </Field>
          <Field label={t('frame.label')}>
            <select data-testid="window-frame" style={inputStyle} value={opening.frame || 'pvc'} onChange={(event) => patch({ frame: event.target.value })}>
              {FRAMES.map((item) => <option key={item.id} value={item.id}>{t(`frame.${item.id}`)}</option>)}
            </select>
          </Field>
          <Field label={t('shade.label')}>
            <select data-testid="window-shading" style={inputStyle} value={opening.shading || 'none'} onChange={(event) => patch({ shading: event.target.value })}>
              {SHADING.map((item) => <option key={item.id} value={item.id}>{t(`shade.${item.id}`)}</option>)}
            </select>
          </Field>
          {(opening.shading === 'overhang') && (
            <Field label={t('shade.overhangM')}>
              <input data-testid="window-overhang" style={inputStyle} type="number" step="0.1" min="0" value={opening.overhang ?? 0.6} onChange={(event) => patch({ overhang: Number(event.target.value) || 0 })} />
            </Field>
          )}
          {opening.shading === 'neighbour' && (
            <Field label={t('shade.neighbourAlt')}>
              <input data-testid="window-neighbour" style={inputStyle} type="number" step="1" min="0" max="80" value={opening.neighbourAlt ?? 20} onChange={(event) => patch({ neighbourAlt: Number(event.target.value) || 0 })} />
            </Field>
          )}
        </>
      )}
    </div>
  )
}

function WallFaces({ plan, wall, onApply }) {
  const pairs = wallFacePairs(plan, wall)
  return (
    <div data-testid="wall-faces">
      {['left', 'right'].map((side) => {
        const room = pairs[side]
        const label = side === 'left' ? 'Puoli A' : 'Puoli B'
        const material = resolveFaceMaterial(plan, wall, side)
        return (
          <div key={side} data-testid={`face-${side}`} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{label}: {room?.name || 'Ei huonetta'}</div>
            {room ? (
              <SwatchRow group="interior" value={material} onPick={(id) => onApply(setFaceMaterial(plan, wall.id, side, id))} />
            ) : (
              <div style={{ fontSize: 11, color: '#78716c', marginBottom: 6 }}>Ulkopuoli, ei sisäverhousta.</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ThermalFields({ plan, onApply }) {
  const { t, num } = usePlanLocale(plan)
  const thermal = thermalOf(plan)
  const country = countryById(plan.country || 'FI')
  const stored = plan.thermal || {}
  const setThermal = (patch, resetU = false) => onApply(refreshHeat(updateHouse(plan, {
    thermal: { ...stored, ...patch, ...(resetU ? { u: undefined } : {}) },
  })))
  const setU = (key, value) => onApply(refreshHeat(updateHouse(plan, {
    thermal: { ...stored, u: { ...(stored.u || {}), [key]: value } },
  })))
  return (
    <div data-testid="thermal-settings">
      <div style={{ fontSize: 12, fontWeight: 700, margin: '8px 0 6px' }}>{t('climate.heating')}</div>
      <Field label={t('climate.zone')}>
        <select data-testid="climate-zone" style={inputStyle} value={thermal.zone} onChange={(event) => {
          const zone = event.target.value
          const place = country.places.find((item) => item.id === (plan.place || stored.place))
          const cleared = place && place.zone !== zone
          onApply(refreshHeat(updateHouse(plan, {
            place: cleared ? null : plan.place,
            thermal: { ...stored, zone, ...(cleared ? { place: '' } : {}) },
          })))
        }}>
          {country.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} ({zone.outdoor} °C)</option>)}
        </select>
      </Field>
      <Field label={t('climate.place')}>
        <select data-testid="climate-place" data-house-place="true" style={inputStyle} value={plan.place || thermal.place || ''} onChange={(event) => {
          const place = country.places.find((item) => item.id === event.target.value)
          onApply(applyLocation(plan, country.id, place?.id || ''))
        }}>
          <option value="">{t('climate.byZone')}</option>
          {country.places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
        </select>
      </Field>
      <div data-testid="degree-days" style={{ fontSize: 12, color: '#57534e', margin: '-2px 0 8px' }}>{t('climate.summary', { winter: thermal.outdoor, summer: thermal.summer, hdd: thermal.degreeDays, cdd: thermal.coolingDegreeDays, lat: num(thermal.latitude, 1) })}</div>
      <Field label={t('climate.lat')}>
        <input data-testid="house-lat" style={inputStyle} type="number" step="0.01" value={plan.latitude ?? ''} placeholder={String(thermal.latitude)} onChange={(event) => onApply(updateHouse(plan, { latitude: event.target.value === '' ? null : Number(event.target.value) }))} />
      </Field>
      <Field label={t('climate.lon')}>
        <input data-testid="house-lon" style={inputStyle} type="number" step="0.01" value={plan.longitude ?? ''} onChange={(event) => onApply(updateHouse(plan, { longitude: event.target.value === '' ? null : Number(event.target.value) }))} />
      </Field>
      <Field label={t('climate.year')}>
        <input data-testid="build-year" style={inputStyle} type="number" min="1900" max="2100" value={stored.year || thermal.year} onChange={(event) => setThermal({ year: parseInt(event.target.value, 10) || 2018 }, true)} />
      </Field>
      <Field label={t('climate.class')}>
        <select data-testid="energy-class" style={inputStyle} value={stored.energyClass || 'C'} onChange={(event) => setThermal({ energyClass: event.target.value }, true)}>
          {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((item) => <option key={item} value={item}>{item}{item === 'C' ? t('climate.classNote') : ''}</option>)}
        </select>
      </Field>
      {[
        ['wall', 'climate.u.wall'],
        ['roof', 'climate.u.roof'],
        ['floor', 'climate.u.floor'],
        ['window', 'climate.u.window'],
        ['door', 'climate.u.door'],
        ['partition', 'climate.u.partition'],
      ].map(([key, label]) => (
        <Field key={key} label={`${t(label)} (W/m²K)`}>
          <input data-testid={`u-${key}`} style={inputStyle} type="number" step="0.01" min="0.05" max="5" value={Number(thermal.u[key].toFixed(2))} onChange={(event) => setU(key, parseFloat(event.target.value) || thermal.u[key])} />
        </Field>
      ))}
      <Field label={t('climate.vent')}>
        <input data-testid="ventilation" style={inputStyle} type="number" step="0.05" min="0" max="5" value={stored.ventilation ?? thermal.ventilation} onChange={(event) => setThermal({ ventilation: parseFloat(event.target.value) || 0 })} />
      </Field>
      <Field label={t('climate.n50')}>
        <input data-testid="n50" style={inputStyle} type="number" step="0.1" min="0.2" max="20" value={stored.n50 ?? thermal.n50} onChange={(event) => setThermal({ n50: parseFloat(event.target.value) || 1 })} />
      </Field>
    </div>
  )
}

function RoomFields({ plan, id, wallId, onApply }) {
  const { t, locale } = usePlanLocale(plan)
  const room = (plan.rooms || []).find((item) => item.id === id)
  if (!room) return null
  const patch = (next) => onApply(updateRoom(plan, id, next))
  const report = roomReport(plan, room)
  return (
    <div>
      <Field label={t('room.name')}>
        <input data-testid="room-name" aria-label={t('room.name')} style={inputStyle} value={room.name || ''} onChange={(event) => patch({ name: event.target.value })} />
      </Field>
      <Field label={t('room.type')}>
        <select data-testid="room-type" style={inputStyle} value={room.type || 'huone'} onChange={(event) => {
          const type = ROOM_TYPES.find((item) => item.id === event.target.value)
          const previous = ROOM_TYPES.find((item) => item.id === (room.type || 'huone'))
          const previousLabel = previous ? text(locale, `roomType.${previous.id}`, previous.name) : ''
          const keep = room.name && room.name !== previous?.name && room.name !== previousLabel && room.name !== 'Huone'
          const nextName = text(locale, `roomType.${type?.id}`, type?.name || room.name)
          onApply(refreshHeat(applyRoomType(plan, id, event.target.value, keep ? room.name : nextName)))
        }}>
          {ROOM_TYPES.map((item) => <option key={item.id} value={item.id}>{text(locale, `roomType.${item.id}`, item.name)}</option>)}
        </select>
      </Field>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Lattia</div>
      <SwatchRow group="floor" value={room.floorId} onPick={(material) => patch({ floorId: material })} />
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Tämän huoneen seinäpinnat</div>
      <div data-testid="room-walls">
        {(room.walls || []).map((edge, index) => {
          const wall = (plan.walls || []).find((item) => item.id === edge.wallId)
          const side = wall ? faceSide(wall, edge.a, edge.b) : 'left'
          const material = wall ? resolveFaceMaterial(plan, wall, side) : (room.interiorId || 'paint')
          const active = wallId && wallId === edge.wallId
          return (
            <div key={`${edge.wallId || 'e'}-${index}`} data-testid={`room-face-${index}`} style={{ border: active ? '1px solid #0f766e' : '1px solid transparent', borderRadius: 8, padding: '2px 4px', marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Seinä {index + 1}{wall?.structure === 'ei30' ? ' · EI30' : ''}{wall?.structure === 'ei60' ? ' · EI60' : ''}</div>
              {edge.wallId ? (
                <SwatchRow group="interior" value={material} onPick={(materialId) => onApply(setFaceMaterial(plan, edge.wallId, side, materialId))} />
              ) : null}
            </div>
          )
        })}
      </div>
      <Field label="Aseta kaikki samaksi">
        <select data-testid="walls-same" style={inputStyle} value="" onChange={(event) => { if (event.target.value) onApply(setRoomFaces(plan, room.id, event.target.value)) }}>
          <option value="">Valitse materiaali…</option>
          {MATERIALS.interior.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Katto</div>
      <SwatchRow group="ceiling" value={room.ceilingId || 'paint'} onPick={(material) => patch({ ceilingId: material })} />
      <Field label="Huonekorkeus (mm)">
        <input style={inputStyle} type="number" value={mm(room.ceilingHeight || plan.floorHeight || 2.6)} onChange={(event) => onApply(refreshHeat(updateRoom(plan, id, { ceilingHeight: fromMm(event.target.value) || 2.6 })))} />
      </Field>
      <Field label="Sisälämpötila (°C)">
        <input data-testid="room-setpoint" style={inputStyle} type="number" value={Number.isFinite(room.setpoint) ? room.setpoint : defaultRoomSetpoint(room.type)} onChange={(event) => onApply(refreshHeat(updateRoom(plan, id, { setpoint: parseFloat(event.target.value) })))} />
      </Field>
      <RoomHeatingFields plan={plan} room={room} onApply={onApply} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 8 }}>
        <input type="checkbox" checked={room.showLabel !== false} onChange={(event) => patch({ showLabel: event.target.checked })} />
        Näytä pinta-ala
      </label>
      {report && <RoomInfo report={report} plan={plan} onApply={onApply} />}
    </div>
  )
}

function RoomHeatingFields({ plan, room, onApply }) {
  const { t, locale } = usePlanLocale(plan)
  const choice = normalizeRoomHeating(room)
  const methods = choice?.methods || []
  const selected = !choice ? '' : methods.length > 1 ? 'combo' : methods[0]
  const floor = methods.some((item) => item === 'efloor' || item === 'wfloor' || item === 'ceiling')
  const write = (nextMethods, extra = {}) => {
    onApply(refreshHeat(updateRoom(plan, room.id, {
      heating: {
        methods: nextMethods,
        spacing: extra.spacing ?? choice?.spacing ?? (nextMethods.includes('efloor') ? 0.1 : 0.15),
        pattern: extra.pattern ?? choice?.pattern ?? 'serpentine',
        wattsPerM2: Object.prototype.hasOwnProperty.call(extra, 'wattsPerM2') ? extra.wattsPerM2 : (choice?.wattsPerM2 ?? null),
      },
    })))
  }
  return (
    <div data-testid="room-heating-fields">
      <Field label={t('room.heating')}>
        <select
          data-testid="room-heating"
          style={inputStyle}
          value={selected}
          onChange={(event) => {
            const value = event.target.value
            if (!value) {
              onApply(refreshHeat(updateRoom(plan, room.id, { heating: null })))
              return
            }
            if (value === 'combo') {
              const seed = methods.filter((item) => item !== 'none')
              write(seed.length > 1 ? seed : seed.length === 1 ? [...seed, seed[0] === 'wrad' ? 'efloor' : 'wrad'] : ['efloor', 'wrad'])
              return
            }
            write([value])
          }}
        >
          <option value="">{t('room.heatingFollow')}</option>
          {HEATING_METHODS.map((item) => <option key={item.id} value={item.id}>{text(locale, `method.${item.id}`, item.name)}</option>)}
          <option value="combo">{t('room.combo')}</option>
        </select>
      </Field>
      {selected === 'combo' && (
        <div data-testid="room-heating-combo" style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
          {HEATING_METHODS.filter((item) => item.id !== 'none').map((item) => (
            <label key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={methods.includes(item.id)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...methods.filter((id) => id !== 'none'), item.id]
                    : methods.filter((id) => id !== item.id)
                  write(next.length ? next : ['none'])
                }}
              />
              {text(locale, `method.${item.id}`, item.name)}
            </label>
          ))}
        </div>
      )}
      {floor && selected !== 'none' && (
        <>
          <Field label="Jakoväli">
            <select data-testid="room-heat-spacing" style={inputStyle} value={String(choice?.spacing || 0.15)} onChange={(event) => write(methods, { spacing: Number(event.target.value) })}>
              {LOOP_SPACINGS.map((spacing) => <option key={spacing} value={spacing}>{Math.round(spacing * 1000)} mm</option>)}
            </select>
          </Field>
          <Field label="Kuvio">
            <select data-testid="room-heat-pattern" style={inputStyle} value={choice?.pattern || 'serpentine'} onChange={(event) => write(methods, { pattern: event.target.value })}>
              <option value="serpentine">Siksak</option>
              <option value="spiral">Spiraali</option>
            </select>
          </Field>
        </>
      )}
      {methods.includes('efloor') && (
        <Field label="Teho (W/m²)">
          <input data-testid="room-heat-density" style={inputStyle} type="number" min="40" max="200" step="10" value={choice?.wattsPerM2 || ''} placeholder="automaattinen" onChange={(event) => write(methods, { wattsPerM2: event.target.value ? Number(event.target.value) : null })} />
        </Field>
      )}
      {methods.includes('wfloor') && (
        <button type="button" data-testid="suggest-manifold" onClick={() => onApply(suggestFloorManifold(plan))} style={{ ...menuBtn, width: 'auto', border: '1px solid #d6d3d1', marginBottom: 8 }}>
          Ehdota jakotukkia
        </button>
      )}
    </div>
  )
}

function RoomInfo({ report, plan, onApply }) {
  const { t, num, locale } = usePlanLocale(plan)
  const copy = async () => {
    const text = formatRoomInfo(report, locale)
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error(err)
    }
  }
  const line = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 3 }}>
      <span style={{ color: '#57534e' }}>{label}</span>
      <span style={{ fontWeight: 650 }}>{value}</span>
    </div>
  )
  return (
    <div data-testid="room-info" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e7e5e4' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 750 }}>{t('room.info')}</div>
        <button type="button" data-testid="room-info-copy" onClick={copy} style={{ ...menuBtn, width: 'auto', border: '1px solid #d6d3d1', padding: '4px 8px' }}>{t('room.copy')}</button>
      </div>
      {line(t('room.floor'), `${num(report.floorArea, 1)} m²`)}
      {line(t('room.ceiling'), `${num(report.ceilingArea, 1)} m²`)}
      {line(t('room.perimeter'), `${num(report.perimeter, 1)} m`)}
      {line(t('room.height'), `${num(report.height, 2)} m`)}
      {line(t('room.volume'), `${num(report.volume, 1)} m³`)}
      {line(t('room.gross'), `${num(report.grossWall, 1)} m²`)}
      {line(t('room.net'), `${num(report.netWall, 1)} m²`)}
      <div style={{ fontSize: 11, fontWeight: 700, margin: '6px 0 3px' }}>{t('room.surfaces')}</div>
      {report.walls.map((wall) => (
        <div key={`${wall.wallId}-${wall.index}`} style={{ fontSize: 11, color: '#44403c', marginBottom: 2 }}>
          Seinä {wall.index}: {wall.materialName}{wall.structureName ? ` · ${wall.structureName}` : ''} · netto {wall.net.toFixed(1).replace('.', ',')} m²
        </div>
      ))}
      {report.byMaterial.map((row) => (
        <div key={row.id} style={{ fontSize: 11, color: '#44403c' }}>{row.name}: {row.area.toFixed(1).replace('.', ',')} m²</div>
      ))}
      <div style={{ fontSize: 11, fontWeight: 700, margin: '6px 0 3px' }}>{t('room.windows')} {report.windowCount} · {num(report.windowArea, 2)} m²</div>
      {report.windows.map((item) => <div key={item.id} style={{ fontSize: 11 }}>{item.size}</div>)}
      <div style={{ fontSize: 11, fontWeight: 700, margin: '6px 0 3px' }}>{t('room.doors')} {report.doorCount} · {num(report.doorArea, 2)} m²</div>
      {report.doors.map((item) => <div key={item.id} style={{ fontSize: 11 }}>{item.type} {item.size}</div>)}
      <div data-testid="room-heat" style={{ marginTop: 8, padding: 8, background: '#f5f5f4', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 750 }}>{t('heat.title')}</div>
        <div style={{ fontSize: 11, color: '#57534e', marginBottom: 4 }}>{t('heat.summary', { zone: report.heat.zoneName, outdoor: report.heat.outdoor, indoor: report.heat.setpoint })}</div>
        <div style={{ fontSize: 16, fontWeight: 750 }}>{Math.round(report.heat.watts)} W · {num(report.heat.wattsPerM2, 1)} W/m²</div>
        {report.heat.annualKwh > 0 && (
          <div data-testid="annual-kwh" style={{ fontSize: 12, marginTop: 4 }}>{t('heat.annual', { kwh: report.heat.annualKwh, hdd: report.heat.degreeDays })}</div>
        )}
        {report.heat.parts.map((part) => (
          <div key={part.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2 }}>
            <span>{text(locale, `heat.${part.id}`, part.name)}</span>
            <span>{Math.round(part.watts)} W</span>
          </div>
        ))}
      </div>
      {report.cooling && (
        <div data-testid="room-cooling" style={{ marginTop: 8, padding: 8, background: '#eff6ff', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 750 }}>{t('cool.title')}</div>
          <div style={{ fontSize: 11, color: '#57534e', marginBottom: 4 }}>{t('cool.hour', { hour: `${String(report.cooling.hour).padStart(2, '0')}:00` })}</div>
          <div style={{ fontSize: 16, fontWeight: 750 }}>{Math.round(report.cooling.watts)} W · {num(report.cooling.wattsPerM2, 1)} W/m²</div>
          {report.cooling.parts.map((part) => (
            <div key={part.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2 }}>
              <span>{t(`cool.${part.id}`)}</span>
              <span>{Math.round(part.watts)} W</span>
            </div>
          ))}
          {report.cooling.overheat && <div data-testid="overheat-warning" style={{ fontSize: 11, color: '#9a3412', marginTop: 6 }}>{t('cool.overheat')}</div>}
          {report.cooling.equipment && (
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {t('cool.equip')}: {t(`equip.${report.cooling.equipment.kind}`)} {Math.round(report.cooling.equipment.watts / 100) / 10} kW
              <button type="button" data-testid="add-cooling-unit" onClick={() => onApply(addServiceNode(plan, {
                system: 'electric',
                kind: 'air-air',
                x: (plan.rooms || []).find((item) => item.id === report.id)?.cx,
                z: (plan.rooms || []).find((item) => item.id === report.id)?.cz,
                power: report.cooling.equipment.watts,
                voltage: 230,
              }))} style={{ ...menuBtn, width: 'auto', border: '1px solid #d6d3d1', marginTop: 6 }}>{t('cool.add')}</button>
            </div>
          )}
        </div>
      )}
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
  const spec = resolveFixture(fixture)
  const variants = spec.template.variants || []
  const tplW = spec.w || 0.6
  const tplD = spec.d || 0.6
  const tplH = spec.h || 0.85
  const chimney = fixture.type === 'chimney'
  const kind = chimney ? chimneyKind(fixture) : ''
  return (
    <div>
      {variants.length > 0 && (
        <Field label="Malli">
          <select
            data-testid="fixture-variant"
            style={inputStyle}
            value={fixture.variant || variants[0].id}
            onChange={(event) => {
              if (chimney) onCommit(updateFixture(plan, id, withChimneyFields(fixture, { variant: event.target.value, flue: defaultFlue(event.target.value) })))
              else onCommit(applyFixtureVariant(plan, id, event.target.value))
            }}
          >
            {variants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
      )}
      {chimney && (
        <>
          <Field label="Hormikoko">
            <select
              data-testid="chimney-flue"
              style={inputStyle}
              value={fixture.flue || defaultFlue(kind)}
              onChange={(event) => onCommit(updateFixture(plan, id, withChimneyFields(fixture, { flue: event.target.value })))}
            >
              {flueOptions(kind).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Hormien määrä">
            <select
              data-testid="chimney-flues"
              style={inputStyle}
              value={Number(fixture.flues) >= 2 ? '2' : '1'}
              onChange={(event) => onCommit(updateFixture(plan, id, withChimneyFields(fixture, { flues: Number(event.target.value) })))}
            >
              <option value="1">1 hormi</option>
              <option value="2">2 hormia</option>
            </select>
          </Field>
          <Field label="Piipun korkeus (mm)">
            <input
              data-testid="chimney-stack"
              style={inputStyle}
              type="number"
              placeholder="katon mukaan"
              value={Number.isFinite(fixture.stack) ? mm(fixture.stack) : ''}
              onChange={(event) => {
                const raw = event.target.value
                onApply(updateFixture(plan, id, { stack: raw === '' ? undefined : fromMm(raw) }))
              }}
            />
          </Field>
        </>
      )}
      {spec.shieldClearance && (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
          <input
            data-testid="heat-shield"
            type="checkbox"
            checked={fixture.shield !== false}
            onChange={(event) => onApply(updateFixture(plan, id, { shield: event.target.checked }))}
          />
          Lämpösuoja
        </label>
      )}
      {spec.chimney && (
        <MenuBtn testid="add-chimney" onClick={() => onCommit(addChimneyFor(plan, id))}>Lisää hormi</MenuBtn>
      )}
      <Field label="Leveys (mm)">
        <input style={inputStyle} type="number" value={mm(fixture.w || tplW)} onChange={(event) => onApply(updateFixture(plan, id, { w: fromMm(event.target.value) || 0.3 }))} />
      </Field>
      <Field label="Syvyys (mm)">
        <input style={inputStyle} type="number" value={mm(fixture.d || tplD)} onChange={(event) => onApply(updateFixture(plan, id, { d: fromMm(event.target.value) || 0.3 }))} />
      </Field>
      <Field label="Korkeus (mm)">
        <input data-testid="fixture-height" style={inputStyle} type="number" value={mm(fixture.h || tplH)} onChange={(event) => onApply(updateFixture(plan, id, { h: fromMm(event.target.value) || 0.3 }))} />
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

function CadEditItems({ onNavigate }) {
  return (
    <Flyout label="Muokkaa" testid="ctx-cad">
      {CAD_COMMANDS.map((cmd) => (
        <CadItem key={cmd.id} testid={`ctx-${cmd.testid}`} shortcut={cmd.short} onClick={() => onNavigate(`cad:${cmd.id}`)}>{cmd.label}</CadItem>
      ))}
      <CadItem testid="ctx-cad-delete" onClick={() => onNavigate('cad:delete')}>Poista</CadItem>
      <CadItem testid="ctx-cad-group" onClick={() => onNavigate('cad:group')}>Ryhmitä</CadItem>
      <CadItem testid="ctx-cad-lock" onClick={() => onNavigate('cad:lock')}>Lukitse</CadItem>
    </Flyout>
  )
}

export function FloorMenu({ menu, plan, onApply, onCommit, onNavigate }) {
  if (!menu || menu.kind === 'service') return null
  const wall = (plan.walls || []).find((item) => item.id === menu.id)
  const opening = (plan.openings || []).find((item) => item.id === menu.id)
  const room = (plan.rooms || []).find((item) => item.id === menu.id)
  const fixture = (plan.fixtures || []).find((item) => item.id === menu.id)
  const zone = (plan.facades || []).find((item) => item.id === menu.id)
  const act = (next, resizeHeat = false) => {
    onCommit(resizeHeat ? refreshHeat(next) : next)
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
        <CadEditItems onNavigate={onNavigate} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, fontWeight: 650 }}>
          Suunta
          <input
            data-testid="ctx-wall-angle"
            type="number"
            defaultValue={wallDirection(wall)}
            key={`dir-${wall.id}-${wallDirection(wall)}`}
            onBlur={(event) => onCommit(refreshHeat(setWallDirection(plan, wall.id, Number(event.target.value))))}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
            style={{ width: 64, padding: '4px 6px', borderRadius: 6, border: '1px solid #d6d3d1' }}
          />
          °
        </label>
        <CadSep />
        <CadItem testid="ctx-split" onClick={() => act(splitWall(plan, wall.id, menu.at || { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }), true)}>Jaa seinä</CadItem>
        <CadItem testid="ctx-door" onClick={() => act(addOpening(plan, wall.id, menu.at || wall.a, 'door'), true)}>Lisää ovi</CadItem>
        <CadItem testid="ctx-window" onClick={() => act(addOpening(plan, wall.id, menu.at || wall.a, 'window'), true)}>Lisää ikkuna</CadItem>
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
        <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(deleteWall(plan, wall.id), true)}>Poista</CadItem>
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
              onCommit(refreshHeat(setCornerAngle(plan, joint, Number(event.target.value))))
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
        {opening.kind === 'door' && (
          <>
            <CadItem testid="ctx-handedness" shortcut="F" onClick={() => act(mirrorOpenings(plan, [{ kind: 'opening', id: opening.id }]))}>Vaihda kätisyys</CadItem>
            <CadItem testid="ctx-leaf" shortcut="Shift+F" onClick={() => act(mirrorOpenings(plan, [{ kind: 'opening', id: opening.id }], { direction: true }))}>Vaihda aukeamissuunta</CadItem>
          </>
        )}
        <CadEditItems onNavigate={onNavigate} />
        <CadSep />
        <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(deleteOpening(plan, opening.id), true)}>Poista</CadItem>
      </>
    )
  } else if (menu.kind === 'room' && room) {
    title = room.name || 'Huone'
    body = (
      <>
        <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
        <CadEditItems onNavigate={onNavigate} />
        <CadSep />
        <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(deleteRoom(plan, room.id), true)}>Poista</CadItem>
      </>
    )
  } else if (menu.kind === 'fixture' && fixture) {
    const spec = resolveFixture(fixture)
    const variants = spec.template.variants || []
    title = `Kaluste: ${spec.name}`
    body = (
      <>
        {variants.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, fontWeight: 650 }}>
            Malli
            <select
              data-testid="ctx-fixture-variant"
              value={fixture.variant || variants[0].id}
              onChange={(event) => {
                if (fixture.type === 'chimney') act(updateFixture(plan, fixture.id, withChimneyFields(fixture, { variant: event.target.value, flue: defaultFlue(event.target.value) })))
                else act(applyFixtureVariant(plan, fixture.id, event.target.value))
              }}
              style={{ flex: 1, padding: '4px 6px', borderRadius: 6, border: '1px solid #d6d3d1' }}
            >
              {variants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        <ColorSwatches value={fixture.color} onChange={(color) => onApply(updateFixture(plan, fixture.id, { color }))} testid="ctx-fixture-color" customTestid="ctx-color-custom" />
        <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
        <CadEditItems onNavigate={onNavigate} />
        <CadSep />
        {spec.chimney && <CadItem testid="ctx-add-chimney" onClick={() => act(addChimneyFor(plan, fixture.id))}>Lisää hormi</CadItem>}
        <CadItem testid="ctx-rotate" shortcut="R" onClick={() => onCommit(rotateFixture(plan, fixture.id))}>Kierrä</CadItem>
        <CadItem testid="ctx-mirror" onClick={() => onCommit(mirrorFixture(plan, fixture.id))}>Peilaa</CadItem>
        <CadItem testid="ctx-duplicate" shortcut="Ctrl+D" onClick={() => act(duplicateFixture(plan, fixture.id))}>Monista</CadItem>
        <CadSep />
        <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(removeFixture(plan, fixture.id))}>Poista</CadItem>
      </>
    )
  } else if (menu.kind === 'zone' && (zone || menu.side)) {
    const cell = zone || { id: menu.id, side: menu.side, u0: menu.u0, u1: menu.u1, y0: menu.y0, y1: menu.y1, materialId: menu.materialId, zoneId: menu.zoneId }
    const current = CLADDING.find((item) => item.id === cell.materialId)
    title = current ? `Julkisivuvyöhyke: ${current.name}` : 'Julkisivuvyöhyke'
    body = (
      <>
        <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
        <Flyout label="Verhous" testid="ctx-cladding">
          {CLADDING.map((item) => (
            <CadItem key={item.id} onClick={() => onCommit(assignFacadeCell(plan, cell, { materialId: item.id }))}>{item.name}</CadItem>
          ))}
        </Flyout>
        <CadItem testid="ctx-above" onClick={() => act(applyFacadePreset(plan, cell.side, 'above', 'wood-horizontal'))}>Ikkunan yläpuoli</CadItem>
        <CadItem testid="ctx-band" onClick={() => act(applyFacadePreset(plan, cell.side, 'band', 'brick-yellow'))}>Ikkunoiden välinen kaista</CadItem>
        <CadSep />
        <CadItem testid="ctx-split-h" onClick={() => act(addFacadeSplit(plan, cell.side, 'h', Number.isFinite(menu.y) ? menu.y : (cell.y0 + cell.y1) / 2))}>Jaa vaakaviivalla</CadItem>
        <CadItem testid="ctx-split-v" onClick={() => act(addFacadeSplit(plan, cell.side, 'v', Number.isFinite(menu.u) ? menu.u : (cell.u0 + cell.u1) / 2))}>Jaa pystyviivalla</CadItem>
        {zone && <CadItem testid="ctx-delete" danger shortcut="Del" onClick={() => act(deleteFacadeZone(plan, zone.id))}>Poista</CadItem>}
      </>
    )
  } else if (menu.kind === 'roof') {
    const roof = ROOF_TYPES.find((item) => item.id === (plan.roofType || 'gable'))
    title = roof ? `Katto: ${roof.name}` : 'Katto'
    body = <CadItem testid="ctx-properties" onClick={properties}>Ominaisuudet…</CadItem>
  } else if (menu.kind === 'house') {
    title = plan.name || 'Talo'
    body = <CadItem testid="ctx-house" onClick={() => onNavigate('house')}>Talon asetukset</CadItem>
  } else if (menu.kind === 'yard') {
    title = yardTitle(plan, menu)
    body = <YardMenuBody plan={plan} menu={menu} onCommit={onCommit} onNavigate={onNavigate} />
  } else if (menu.kind === 'canvas') {
    title = 'Pohja'
    body = (
      <>
        <CadItem testid="ctx-paste" onClick={() => onNavigate('paste')}>Liitä</CadItem>
        <CadEditItems onNavigate={onNavigate} />
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
