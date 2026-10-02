'use client'

import { PRODUCTS, ROOM_TYPES, getProduct } from '@/lib/catalog'
import { applyType, internalDims } from '@/lib/geometry'
import { formatKw, formatPower, fromLength, fromTemp, lengthUnit, tempUnit, toLength, toTemp } from '@/lib/units'

const labelStyle = {
  fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700,
  letterSpacing: 0.4, display: 'block', marginBottom: 4,
}
const inputStyle = {
  width: '100%', padding: '6px 8px', background: '#0f172a', color: '#f8fafc',
  border: '1px solid #334155', borderRadius: 6, fontSize: 12,
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

function LineRow({ item, unitSystem }) {
  const color = item.watts < -1 ? '#86efac' : '#e2e8f0'
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
        <span style={{ color: '#f8fafc' }}>{item.label}</span>
        <span style={{ color, fontWeight: 700, whiteSpace: 'nowrap' }}>{Math.round(item.watts)} W</span>
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>
        {item.formula}
      </div>
      {unitSystem === 'IP' && (
        <div style={{ fontSize: 10, color: '#67e8f9' }}>{formatPower(item.watts, 'IP')}</div>
      )}
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
  onPatchEquipment,
  onDeleteEquipment,
}) {
  const field = { onFocus: onFocusEdit, onBlur: onBlurEdit }
  const length = (metres) => toLength(metres, unitSystem)
  const temp = (c) => toTemp(c, unitSystem)
  const setLength = (key, display) => onPatch({ [key]: fromLength(display, unitSystem) })
  const setTemp = (key, display) => onPatch({ [key]: fromTemp(display, unitSystem) })
  const setLoad = (key, value) => onPatch({ load: { ...room.load, [key]: value } })
  const setLoadTemp = (key, display) => setLoad(key, fromTemp(display, unitSystem))

  return (
    <div data-testid="heat-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>KOKO KOHDE</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc', lineHeight: 1.1 }}>
          {formatKw(result.total)}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          {Math.round(result.total).toLocaleString('fi-FI')} W · {formatPower(result.total, 'IP')}
        </div>
        <div style={{ fontSize: 11, color: '#67e8f9', marginTop: 6 }}>
          {result.suggestedEvap.count} × {result.suggestedEvap.template.name} koko kohteelle
        </div>
      </div>

      {!room && (
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
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
            <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', fontWeight: 700, marginBottom: 4 }}>ERITTELY</div>
            {roomResult.lines.map((item) => <LineRow key={item.key} item={item} unitSystem={unitSystem} />)}
            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.35)', marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>Välisumma</span><span>{Math.round(roomResult.subtotal)} W</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                <span>× varmuus {roomResult.safetyFactor.toFixed(2)}</span>
                <strong>{formatKw(roomResult.total)}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#67e8f9', marginTop: 6 }}>
                Huoneen höyrystin: {roomResult.suggestedEvap.count} × {roomResult.suggestedEvap.template.name}
              </div>
            </div>
          </div>

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

          <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>MITAT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Num {...field} label="Pituus" unit={lengthUnit(unitSystem)} value={length(room.width)} step={unitSystem === 'IP' ? 0.1 : 0.1} onChange={(v) => setLength('width', v)} />
            <Num {...field} label="Leveys" unit={lengthUnit(unitSystem)} value={length(room.depth)} onChange={(v) => setLength('depth', v)} />
            <Num {...field} label="Korkeus" unit={lengthUnit(unitSystem)} value={length(room.height)} onChange={(v) => setLength('height', v)} />
            <Num {...field} label="Seinä" unit={lengthUnit(unitSystem)} value={length(room.wallThickness)} step={0.01} onChange={(v) => {
              const metres = fromLength(v, unitSystem)
              onPatch({ wallThickness: metres, ceilingThickness: metres, floorThickness: metres })
            }} />
          </div>

          <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>OLOSUHTEET</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Num {...field} label="Huone" unit={tempUnit(unitSystem)} value={temp(room.temp)} step={0.5} onChange={(v) => setTemp('temp', v)} />
            <Num {...field} label="Ulkoilma" unit={tempUnit(unitSystem)} value={temp(room.ambientTemp)} step={0.5} onChange={(v) => setTemp('ambientTemp', v)} />
            <Num {...field} label="Maa" unit={tempUnit(unitSystem)} value={temp(room.load.groundTempC)} step={0.5} onChange={(v) => setLoadTemp('groundTempC', v)} />
            <Num {...field} label="U seinä" unit="W/m²K" value={room.uWall} step={0.01} onChange={(v) => onPatch({ uWall: v })} />
            <Num {...field} label="U katto" unit="W/m²K" value={room.uCeiling} step={0.01} onChange={(v) => onPatch({ uCeiling: v })} />
            <Num {...field} label="U lattia" unit="W/m²K" value={room.uFloor} step={0.01} onChange={(v) => onPatch({ uFloor: v })} />
          </div>

          <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>TUOTE</div>
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

          <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>OVET, IHMISET, VALOT</div>
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

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#e2e8f0' }}>
            <input
              type="checkbox"
              checked={!!room.load.pullDownEnabled}
              onChange={(e) => setLoad('pullDownEnabled', e.target.checked)}
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
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#e2e8f0' }}>
              <input
                type="checkbox"
                checked={!!room.load.ceilingToParent}
                onChange={(e) => setLoad('ceilingToParent', e.target.checked)}
              />
              Katto emohuoneen ilmaan (ei ulkovaippaan)
            </label>
          )}

          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
            Sisäpinnat, U·A·ΔT. Väliseinän U on pienempi kahdesta. Emohuoneen läpi kulkeva lämpö vähennetään emolta, jotta sitä ei lasketa kahdesti. Puhallinlämpö tulee höyrystimistä. Lauhdutin oletetaan ulos.
          </div>
        </>
      )}

      {selectedEquipment && (
        <div style={{ padding: 10, borderRadius: 8, border: '1px solid #334155', background: 'rgba(15,23,42,0.6)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{selectedEquipment.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
            {selectedEquipment.width} × {selectedEquipment.depth} × {selectedEquipment.height} m
            {selectedEquipment.capacityKw ? ` · ${selectedEquipment.capacityKw} kW` : ''}
            {selectedEquipment.fanW ? ` · puhallin ${selectedEquipment.fanW} W` : ''}
          </div>
          <button
            type="button"
            onClick={onDeleteEquipment}
            style={{
              padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.45)',
              background: 'rgba(220,38,38,0.15)', color: '#fecaca', fontSize: 12, cursor: 'pointer',
            }}
          >
            Poista laite
          </button>
        </div>
      )}
    </div>
  )
}

function InternalNote({ room, unitSystem }) {
  const dims = internalDims(room)
  return (
    <div style={{ fontSize: 11, color: '#67e8f9', lineHeight: 1.45 }}>
      Sisämitta {formatLen(dims.width, unitSystem)} × {formatLen(dims.depth, unitSystem)} × {formatLen(dims.height, unitSystem)}
      <br />
      {dims.area.toFixed(1)} m² · {dims.volume.toFixed(1)} m³
    </div>
  )
}

function formatLen(metres, system) {
  return system === 'IP' ? `${toLength(metres, 'IP').toFixed(2)} ft` : `${metres.toFixed(2)} m`
}
