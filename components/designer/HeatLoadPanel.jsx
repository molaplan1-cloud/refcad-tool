'use client'

import { useState } from 'react'
import { PRODUCTS, ROOM_TYPES, getProduct, isRefrigerated } from '@/lib/catalog'
import { applyType, internalDims } from '@/lib/geometry'
import { isCustomOutline, polygonMetrics } from '@/lib/cadDraw'
import { formatKw, formatPower, fromLength, fromTemp, lengthUnit, tempUnit, toLength, toTemp } from '@/lib/units'
import { capacityCheck, suggestPackage } from '@/lib/selection'
import { routeLength, REFRIGERANT_IDS as PIPE_REFS } from '@/lib/pipeSizing'
import { sizePlacedPipe } from '@/lib/pipeDuty'
import { defaultElevation, mountLabel } from '@/lib/placement'

const labelStyle = {
  fontSize: 10, color: '#78716c', fontWeight: 700,
  letterSpacing: 0.4, display: 'block', marginBottom: 4,
}
const inputStyle = {
  width: '100%', padding: '6px 8px', background: '#fff', color: '#1c1917',
  border: '1px solid #d6d3d1', borderRadius: 6, fontSize: 12,
}

function Num({ label, value, onChange, step = 0.1, unit, min, onFocus, onBlur }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}{unit ? ` (${unit})` : ''}</span>
      <input
        type="number"
        step={step}
        min={min}
        value={Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => {
          const next = parseFloat(e.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        style={inputStyle}
      />
    </label>
  )
}

const GROUP_LABELS = [
  ['transmission', 'Siirtymä'],
  ['product', 'Tuote'],
  ['infiltration', 'Ilma ja ovet'],
  ['people', 'Henkilöt'],
  ['lighting', 'Valaistus'],
  ['equipment', 'Laitteet'],
  ['pulldown', 'Jäähtyminen'],
  ['transfer', 'Siirto huoneiden välillä'],
]

function LineRow({ item, unitSystem, maxAbs, subtotal }) {
  const credit = item.watts < -1
  const pct = subtotal ? (item.watts / subtotal) * 100 : 0
  const width = maxAbs > 0 ? Math.min(100, (Math.abs(item.watts) / maxAbs) * 100) : 0
  const pctLabel = Math.abs(pct) < 0.5 && Math.abs(item.watts) > 1 ? '<1%' : `${Math.round(pct)}%`
  return (
    <div style={{ padding: '5px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, alignItems: 'baseline' }}>
        <span style={{ color: '#292524' }}>{item.label}</span>
        <span style={{ color: credit ? '#047857' : '#1c1917', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(item.watts).toLocaleString('fi-FI')} W
          <span style={{ marginLeft: 6, color: '#a8a29e', fontWeight: 600, fontSize: 11 }}>{pctLabel}</span>
        </span>
      </div>
      <div style={{ height: 4, marginTop: 4, borderRadius: 99, background: '#f5f5f4', overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', borderRadius: 99, background: credit ? '#34d399' : '#0f766e' }} />
      </div>
      <div style={{ fontSize: 10, color: '#a8a29e', fontFamily: 'ui-monospace, SFMono-Regular, monospace', marginTop: 3, lineHeight: 1.35 }}>
        {item.formula}
      </div>
      {unitSystem === 'IP' && (
        <div style={{ fontSize: 10, color: '#0f766e' }}>{formatPower(item.watts, 'IP')}</div>
      )}
    </div>
  )
}

function Fold({ title, children, open = false }) {
  const [on, setOn] = useState(open)
  return (
    <div style={{ borderTop: '1px solid #e7e5e4' }}>
      <button
        type="button"
        onClick={() => setOn((value) => !value)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '9px 0', background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#44403c', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, transform: 'none',
        }}
      >
        <span>{title}</span>
        <span>{on ? '−' : '+'}</span>
      </button>
      {on && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 }}>{children}</div>}
    </div>
  )
}

export default function HeatLoadPanel({
  room,
  rooms,
  result,
  roomResult,
  unitSystem,
  onPatch,
  onFocusEdit,
  onBlurEdit,
  selectedEquipment,
  selectedPipe,
  onPatchEquipment,
  onPatchPipe,
  onDeleteEquipment,
}) {
  const field = { onFocus: onFocusEdit, onBlur: onBlurEdit }
  const length = (metres) => toLength(metres, unitSystem)
  const temp = (c) => toTemp(c, unitSystem)
  const setLength = (key, display) => onPatch({ [key]: fromLength(display, unitSystem) })
  const setTemp = (key, display) => onPatch({ [key]: fromTemp(display, unitSystem) })
  const setLoad = (key, value) => onPatch({ load: { ...room.load, [key]: value } })
  const commitToggle = (key, value) => {
    onFocusEdit?.()
    setLoad(key, value)
    onBlurEdit?.()
  }
  const setLoadTemp = (key, display) => setLoad(key, fromTemp(display, unitSystem))

  const maxAbs = roomResult ? Math.max(1, ...roomResult.lines.map((item) => Math.abs(item.watts))) : 1
  const grouped = roomResult
    ? GROUP_LABELS.map(([id, label]) => ({ id, label, lines: roomResult.lines.filter((item) => item.group === id) })).filter((group) => group.lines.length)
    : []

  return (
    <div data-testid="heat-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 2, background: '#fafaf9',
        padding: '12px 14px 10px', borderBottom: '1px solid #e7e5e4',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.8, color: '#78716c', fontWeight: 700 }}>KOKO KOHDE</div>
          <div style={{ fontSize: 11, color: '#0f766e' }}>{result.suggestedEvap.count} × {result.suggestedEvap.template.name}</div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 750, color: '#1c1917', lineHeight: 1.05, letterSpacing: -0.4, marginTop: 2 }}>
          {formatKw(result.total)}
        </div>
        <div style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>
          {Math.round(result.total).toLocaleString('fi-FI')} W · {formatPower(result.total, 'IP')}
        </div>
        {room && !roomResult && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#57534e', lineHeight: 1.4 }}>
            {room.label} ei ole kylmähuone. Sen lämpötila vaikuttaa viereisen kylmähuoneen seinäkuormaan.
          </div>
        )}
        {room && roomResult && (
          <CapacityBlock room={room} roomResult={roomResult} />
        )}
        {room && roomResult && (
          <div style={{
            marginTop: 8, padding: '8px 10px', borderRadius: 8,
            background: '#f0fdfa', border: '1px solid #99f6e4',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#115e59', fontWeight: 700 }}>{room.label} yhteensä</div>
              <div style={{ fontSize: 10, color: '#0f766e' }}>× {roomResult.safetyFactor.toFixed(2)} · {roomResult.suggestedEvap.count} × {roomResult.suggestedEvap.template.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 750, color: '#134e4a' }}>{formatKw(roomResult.total)}</div>
              <div style={{ fontSize: 10, color: '#115e59' }}>{Math.round(roomResult.subtotal).toLocaleString('fi-FI')} W</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {room && !isRefrigerated(room.type) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#44403c', lineHeight: 1.45 }}>
            Tila piirretään samaan pohjaan, mutta sitä ei lasketa kylmäkuormaan. Viereinen kylmähuone käyttää tämän tilan lämpötilaa yhteisellä seinällä.
          </div>
          <Num {...field} label="Lämpötila" unit={tempUnit(unitSystem)} value={temp(room.temp)} step={0.5} onChange={(v) => setTemp('temp', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Num {...field} label="Pituus" unit={lengthUnit(unitSystem)} value={length(room.width)} onChange={(v) => setLength('width', v)} />
            <Num {...field} label="Leveys" unit={lengthUnit(unitSystem)} value={length(room.depth)} onChange={(v) => setLength('depth', v)} />
            <Num {...field} label="Korkeus" unit={lengthUnit(unitSystem)} value={length(room.height)} onChange={(v) => setLength('height', v)} />
          </div>
        </div>
      )}

      {!room && !selectedPipe && (
        <div style={{ fontSize: 12, color: '#78716c', lineHeight: 1.5 }}>
          Valitse huone pohjasta tai listasta. Kuorma, mitat ja väliseinät päivittyvät heti.
        </div>
      )}

      {room && roomResult && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              minWidth: 36, textAlign: 'center', padding: '4px 6px', borderRadius: 6,
              background: room.color, color: '#fff', fontWeight: 800, fontSize: 12,
            }}>{room.label}</span>
            <input
              value={room.name}
              onFocus={onFocusEdit}
              onBlur={onBlurEdit}
              onChange={(e) => onPatch({ name: e.target.value })}
              style={{ ...inputStyle, fontWeight: 700 }}
            />
          </div>
          <InternalNote room={room} unitSystem={unitSystem} />
          <div data-testid="heat-breakdown">
            <div style={{ fontSize: 10, letterSpacing: 0.8, color: '#78716c', fontWeight: 700, marginBottom: 4 }}>ERITTELY</div>
            {grouped.map((group) => (
              <div key={group.id} style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.4 }}>{group.label}</div>
                {group.lines.map((item) => (
                  <LineRow key={item.key} item={item} unitSystem={unitSystem} maxAbs={maxAbs} subtotal={roomResult.subtotal} />
                ))}
              </div>
            ))}
          </div>

          <Fold title="Huonetyyppi ja mitat">
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Huonetyyppi</span>
            <select
              value={room.type}
              onFocus={onFocusEdit}
              onBlur={onBlurEdit}
              onChange={(e) => onPatch(applyType(room, e.target.value, rooms))}
              style={inputStyle}
            >
              {ROOM_TYPES.map((type) => (
                <option key={type.id} value={type.id}>{type.name} {type.short}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Num {...field} label="Pituus" unit={lengthUnit(unitSystem)} value={length(room.width)} step={unitSystem === 'IP' ? 0.1 : 0.1} onChange={(v) => setLength('width', v)} />
            <Num {...field} label="Leveys" unit={lengthUnit(unitSystem)} value={length(room.depth)} onChange={(v) => setLength('depth', v)} />
            <Num {...field} label="Korkeus" unit={lengthUnit(unitSystem)} value={length(room.height)} onChange={(v) => setLength('height', v)} />
            <Num {...field} label="Seinä" unit={lengthUnit(unitSystem)} value={length(room.wallThickness)} step={0.01} onChange={(v) => {
              const metres = fromLength(v, unitSystem)
              onPatch({ wallThickness: metres, ceilingThickness: metres, floorThickness: metres })
            }} />
          </div>
          </Fold>

          <Fold title="Olosuhteet">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Num {...field} label="Huone" unit={tempUnit(unitSystem)} value={temp(room.temp)} step={0.5} onChange={(v) => setTemp('temp', v)} />
            <Num {...field} label="Ulkoilma" unit={tempUnit(unitSystem)} value={temp(room.ambientTemp)} step={0.5} onChange={(v) => setTemp('ambientTemp', v)} />
            <Num {...field} label="Maa" unit={tempUnit(unitSystem)} value={temp(room.load.groundTempC)} step={0.5} onChange={(v) => setLoadTemp('groundTempC', v)} />
            <Num {...field} label="U seinä" unit="W/m²K" value={room.uWall} step={0.01} onChange={(v) => onPatch({ uWall: v })} />
            <Num {...field} label="U katto" unit="W/m²K" value={room.uCeiling} step={0.01} onChange={(v) => onPatch({ uCeiling: v })} />
            <Num {...field} label="U lattia" unit="W/m²K" value={room.uFloor} step={0.01} onChange={(v) => onPatch({ uFloor: v })} />
          </div>
          </Fold>

          <Fold title="Tuote">
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Tuoteryhmä</span>
            <select
              value={room.load.productId}
              onFocus={onFocusEdit}
              onBlur={onBlurEdit}
              onChange={(e) => {
                const product = getProduct(e.target.value)
                onPatch({ load: { ...room.load, productId: product.id, cp: product.cp, respirationWPerKg: product.respiration } })
              }}
              style={inputStyle}
            >
              {PRODUCTS.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Num {...field} label="Määrä" unit="kg/vrk" value={room.load.dailyMassKg} step={10} onChange={(v) => setLoad('dailyMassKg', v)} />
            <Num {...field} label="Sisään" unit={tempUnit(unitSystem)} value={temp(room.load.entryTempC)} step={0.5} onChange={(v) => setLoadTemp('entryTempC', v)} />
            <Num {...field} label="cp" unit="kJ/kg·K" value={room.load.cp} step={0.05} onChange={(v) => setLoad('cp', v)} />
            <Num {...field} label="Hengitys" unit="W/kg" value={room.load.respirationWPerKg} step={0.01} onChange={(v) => setLoad('respirationWPerKg', v)} />
          </div>
          </Fold>

          <Fold title="Ovet, ihmiset, valot">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Num {...field} label="Avauksia" unit="/vrk" value={room.load.doorOpeningsPerDay} step={1} onChange={(v) => setLoad('doorOpeningsPerDay', v)} />
            <Num {...field} label="Auki" unit="s" value={room.load.doorOpenSeconds} step={1} onChange={(v) => setLoad('doorOpenSeconds', v)} />
            <Num {...field} label="Henkilöitä" value={room.load.people} step={1} onChange={(v) => setLoad('people', v)} />
            <Num {...field} label="Tunnit" unit="h/vrk" value={room.load.peopleHoursPerDay} step={0.5} onChange={(v) => setLoad('peopleHoursPerDay', v)} />
            <Num {...field} label="Henkilö" unit="W" value={room.load.peopleWatts} step={10} onChange={(v) => setLoad('peopleWatts', v)} />
            <Num {...field} label="Valaistus" unit="W/m²" value={room.load.lightingWm2} step={1} onChange={(v) => setLoad('lightingWm2', v)} />
            <Num {...field} label="Valot" unit="h/vrk" value={room.load.lightingHoursPerDay} step={1} onChange={(v) => setLoad('lightingHoursPerDay', v)} />
            <Num {...field} label="Muu laite" unit="W" value={room.load.extraEquipmentW} step={50} onChange={(v) => setLoad('extraEquipmentW', v)} />
            <Num {...field} label="Ilmanvaihto" unit="1/vrk" value={room.load.airChangesPerDay} step={0.1} onChange={(v) => setLoad('airChangesPerDay', v)} />
            <Num {...field} label="Varmuus" value={room.load.safetyFactor} step={0.05} onChange={(v) => setLoad('safetyFactor', v)} />
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#44403c' }}>
            <input
              type="checkbox"
              checked={!!room.load.pullDownEnabled}
              onChange={(e) => commitToggle('pullDownEnabled', e.target.checked)}
            />
            Laatan jäähtyminen mukaan
          </label>
          {room.load.pullDownEnabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Num {...field} label="Laatta" unit={lengthUnit(unitSystem)} value={length(room.load.slabThicknessM)} step={0.01} onChange={(v) => setLoad('slabThicknessM', fromLength(v, unitSystem))} />
              <Num {...field} label="Alkutila" unit={tempUnit(unitSystem)} value={temp(room.load.slabInitialTempC)} step={0.5} onChange={(v) => setLoadTemp('slabInitialTempC', v)} />
              <Num {...field} label="Aika" unit="h" value={room.load.pullDownHours} step={1} min={1} onChange={(v) => setLoad('pullDownHours', Math.max(1, v))} />
            </div>
          )}
          {room.parentId && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#44403c' }}>
              <input
                type="checkbox"
                checked={!!room.load.ceilingToParent}
                onChange={(e) => commitToggle('ceilingToParent', e.target.checked)}
              />
              Katto emohuoneen ilmaan (ei ulkovaippaan)
            </label>
          )}
          </Fold>

          <div style={{ fontSize: 10, color: '#a8a29e', lineHeight: 1.4 }}>
            Sisäpinnat, U·A·ΔT. Väliseinän U on pienempi kahdesta. Emohuoneen läpi kulkeva lämpö vähennetään emolta. Puhallinlämpö tulee höyrystimistä.
          </div>
        </>
      )}
      {selectedPipe && (
        <PipeCard pipe={selectedPipe} rooms={rooms} result={result} onPatch={onPatchPipe} onDelete={onDeleteEquipment} />
      )}
      {selectedEquipment && (
        <div style={{ padding: 10, borderRadius: 8, border: '1px solid #e7e5e4', background: '#fff' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{selectedEquipment.name}</div>
          <div style={{ fontSize: 11, color: '#78716c', marginBottom: 8 }}>
            {selectedEquipment.width} × {selectedEquipment.depth} × {selectedEquipment.height} m
            {selectedEquipment.capacityKw ? ` · ${selectedEquipment.capacityKw} kW` : ''}
            {selectedEquipment.fanW ? ` · puhallin ${selectedEquipment.fanW} W` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <Num label="Leveys" unit="m" value={selectedEquipment.width} step={0.05} onChange={(v) => onPatchEquipment?.({ width: v })} />
            <Num label="Syvyys" unit="m" value={selectedEquipment.depth} step={0.05} onChange={(v) => onPatchEquipment?.({ depth: v })} />
            <Num label="Korkeus" unit="m" value={selectedEquipment.height} step={0.05} onChange={(v) => onPatchEquipment?.({ height: v })} />
            <Num label="Korkeusasema" unit="m" value={Number.isFinite(selectedEquipment.elevation) ? selectedEquipment.elevation : defaultElevation(room, selectedEquipment)} step={0.05} onChange={(v) => onPatchEquipment?.({ elevation: v })} />
            <Num label="Kierto" unit="°" value={selectedEquipment.rotation || 0} step={5} onChange={(v) => onPatchEquipment?.({ rotation: v })} />
          </div>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={labelStyle}>Kiinnitys</span>
            <select
              value={selectedEquipment.mount || (selectedEquipment.category === 'evaporator' ? 'ceiling' : 'floor')}
              onChange={(e) => {
                const mount = e.target.value
                const next = { ...selectedEquipment, mount }
                onPatchEquipment?.({ mount, elevation: defaultElevation(room, next) })
              }}
              style={inputStyle}
            >
              <option value="floor">Lattia</option>
              <option value="wall">Seinä</option>
              <option value="ceiling">Katto</option>
              <option value="roof">Vesikatto</option>
            </select>
          </label>
          <div style={{ fontSize: 11, color: '#0f766e', marginBottom: 8 }}>
            {mountLabel(selectedEquipment.mount || (selectedEquipment.category === 'evaporator' ? 'ceiling' : 'floor'))}
            {' · '}
            {(Number.isFinite(selectedEquipment.elevation) ? selectedEquipment.elevation : defaultElevation(room, selectedEquipment)).toFixed(2)} m lattiasta
          </div>
          <button
            type="button"
            onClick={onDeleteEquipment}
            style={{
              padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.45)',
              background: '#fef2f2', color: '#991b1b', fontSize: 12, cursor: 'pointer', transform: 'none',
            }}
          >
            Poista laite
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

function CapacityBlock({ room, roomResult }) {
  const selectedKw = (room.equipment || [])
    .filter((eq) => eq.category === 'evaporator')
    .reduce((sum, eq) => sum + (eq.capacityKw || 0), 0)
  const check = capacityCheck(roomResult.total / 1000, selectedKw)
  const pack = suggestPackage(roomResult.total, {
    teC: room.temp < 0 ? room.temp - 8 : -8,
    tcC: 40,
    refrigerant: 'R449A',
    lengthM: 15,
    riseM: 3,
  })
  const tone = check.status === 'under' ? '#991b1b' : check.status === 'over' ? '#9a3412' : '#115e59'
  const text = check.status === 'none'
    ? 'Valitse höyrystin, niin kattavuus näkyy tässä.'
    : check.status === 'under'
      ? `Alimitoitettu: valittu ${check.selectedKw.toFixed(1)} kW kattaa ${check.percent} % tarpeesta ${check.requiredKw.toFixed(2)} kW.`
      : check.status === 'over'
        ? `Reilusti ylimitoitettu: kattavuus ${check.percent} % (${check.selectedKw.toFixed(1)} / ${check.requiredKw.toFixed(2)} kW).`
        : `Kattavuus ${check.percent} % (${check.selectedKw.toFixed(1)} / ${check.requiredKw.toFixed(2)} kW).`
  return (
    <div data-testid="capacity-check" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #e7e5e4' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: tone, lineHeight: 1.4 }}>{text}</div>
      <div style={{ fontSize: 10, color: '#57534e', marginTop: 4, lineHeight: 1.45 }}>
        Ehdotus: {pack.evap?.name || '—'}
        {pack.slant ? `, viisto ${pack.slant.name}` : ''}
        {pack.combo ? `, ${pack.combo.name}` : ''}
        {`. ${pack.suction.label}. ${pack.liquid.label}.`}
      </div>
    </div>
  )
}

function PipeCard({ pipe, rooms, result, onPatch, onDelete }) {
  const { duty, sized } = sizePlacedPipe(pipe, rooms, result.rooms)
  const source = duty.source === 'evaporator' ? 'höyrystimestä' : duty.source === 'room' ? 'huoneen tarpeesta' : duty.source === 'manual' ? 'käsin' : duty.source === 'drain' ? 'kondenssivesi' : 'ei kytkettyä tehoa'
  return (
    <div data-testid="pipe-audit" style={{ padding: 10, borderRadius: 8, border: '1px solid #e7e5e4', background: '#fff' }}>
      <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 4 }}>{sized.label}</div>
      <div style={{ fontSize: 11, color: '#57534e', marginBottom: 6 }}>
        Pituus {routeLength(pipe.points).toFixed(1)} m
        {sized.velocity ? ` · nopeus ${sized.velocity.toFixed(1)} m/s` : ''}
        {sized.equivalentTempK ? ` · ${sized.equivalentTempK.toFixed(2)} K` : ''}
      </div>
      <div data-testid="pipe-duty" style={{ fontSize: 11, color: '#115e59', marginBottom: 8, lineHeight: 1.4 }}>
        Q {duty.kw.toFixed(2)} kW · {source}
        <div style={{ color: '#78716c' }}>{duty.note}</div>
      </div>
      {sized.warnings.map((warning) => (
        <div key={warning} style={{ fontSize: 11, color: '#9a3412', marginBottom: 6 }}>{warning}</div>
      ))}
      {pipe.kind !== 'drain' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <Num
            label="Teho"
            unit="kW"
            value={pipe.capacityManual ? pipe.capacityKw : duty.kw}
            step={0.1}
            min={0}
            onChange={(v) => onPatch?.({ capacityKw: v, capacityManual: true })}
          />
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Kylmäaine</span>
            <select value={pipe.refrigerant || 'R449A'} onChange={(e) => onPatch?.({ refrigerant: e.target.value })} style={inputStyle}>
              {PIPE_REFS.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <Num label="Nousu" unit="m" value={pipe.riseM || 0} step={0.5} onChange={(v) => onPatch?.({ riseM: v })} />
          <Num label="Te" unit="°C" value={pipe.teC ?? -8} step={1} onChange={(v) => onPatch?.({ teC: v })} />
          <Num label="Tc" unit="°C" value={pipe.tcC ?? 40} step={1} onChange={(v) => onPatch?.({ tcC: v })} />
          {pipe.capacityManual && (
            <button type="button" onClick={() => onPatch?.({ capacityManual: false })} style={{ gridColumn: '1 / -1', justifySelf: 'start', border: 'none', background: 'transparent', color: '#0f766e', fontWeight: 700, cursor: 'pointer', padding: 0, transform: 'none', fontSize: 11 }}>
              Käytä kytkettyä tehoa
            </button>
          )}
        </div>
      )}
      {sized.steps.map((step) => (
        <div key={step.label} style={{ padding: '4px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>{step.label} · {step.value}</div>
          <div style={{ fontSize: 10, color: '#a8a29e', fontFamily: 'ui-monospace, monospace' }}>{step.formula}</div>
        </div>
      ))}
      <button type="button" onClick={onDelete} style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.45)', background: '#fef2f2', color: '#991b1b', fontSize: 12, cursor: 'pointer', transform: 'none' }}>
        Poista putki
      </button>
    </div>
  )
}

function InternalNote({ room, unitSystem }) {
  const dims = isCustomOutline(room) ? polygonMetrics(room).dims : internalDims(room)
  return (
    <div style={{ fontSize: 11, color: '#0f766e', lineHeight: 1.45 }}>
      Sisämitta {formatLen(dims.width, unitSystem)} × {formatLen(dims.depth, unitSystem)} × {formatLen(dims.height, unitSystem)}
      <br />
      {dims.area.toFixed(1)} m² · {dims.volume.toFixed(1)} m³
    </div>
  )
}

function formatLen(metres, system) {
  return system === 'IP' ? `${toLength(metres, 'IP').toFixed(2)} ft` : `${metres.toFixed(2)} m`
}
