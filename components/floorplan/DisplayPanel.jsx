'use client'

import { dimensionsFromMode, dimensionMode } from '@/lib/display'
import { SERVICE_SYSTEMS, layerVisible, setServiceLayer } from '@/lib/services'
import { usePlanLocale } from '@/components/i18n/Locale'
import { text } from '@/lib/i18n'

const btn = (active) => ({
  height: 28,
  padding: '0 8px',
  borderRadius: 7,
  border: '1px solid #d6d3d1',
  background: active ? '#134e4a' : '#fff',
  color: active ? '#ccfbf1' : '#1c1917',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
})

function Check({ testid, label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
      <input data-testid={testid} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

export function DisplayPanel({ plan, display, onChange, onLayer }) {
  const { t, locale } = usePlanLocale(plan)
  const mode = dimensionMode(display)
  const setMode = (value) => {
    const dims = dimensionsFromMode(value)
    if (dims) onChange({ dims, preset: 'custom' })
  }
  return (
    <div data-testid="display-panel" style={{ position: 'absolute', left: 12, top: 8, zIndex: 25, width: 248, background: '#fbfaf7', border: '1px solid #1c1917', borderRadius: 10, padding: '12px 12px 14px', boxShadow: '0 10px 28px rgba(0,0,0,0.16)' }}>
      <div style={{ fontSize: 14, fontWeight: 750, marginBottom: 8 }}>{t('display.title')}</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <button type="button" data-testid="preset-plain" style={btn(display.preset === 'plain')} onClick={() => onChange({ preset: 'plain' })}>{t('preset.plain')}</button>
        <button type="button" data-testid="preset-measure" style={btn(display.preset === 'measure')} onClick={() => onChange({ preset: 'measure' })}>{t('preset.measure')}</button>
        <button type="button" data-testid="preset-all" style={btn(display.preset === 'all')} onClick={() => onChange({ preset: 'all' })}>{t('preset.all')}</button>
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
        {t('display.dims')}
        <select data-testid="dim-mode" value={mode} onChange={(event) => setMode(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 8, border: '1px solid #d6d3d1', fontSize: 13 }}>
          <option value="none">{t('display.none')}</option>
          <option value="overall">{t('display.overall')}</option>
          <option value="outside">{t('display.outside')}</option>
          <option value="all">{t('display.all')}</option>
          <option value="custom">{t('display.custom')}</option>
        </select>
      </label>
      {mode === 'custom' && (
        <div style={{ margin: '8px 0' }}>
          <Check testid="dim-overall" label={t('display.overall')} checked={display.dims.overall} onChange={(overall) => onChange({ dims: { overall } })} />
          <Check testid="dim-room" label={t('display.roomChain')} checked={display.dims.room} onChange={(room) => onChange({ dims: { room } })} />
          <Check testid="dim-openings" label={t('display.openings')} checked={display.dims.openings} onChange={(openings) => onChange({ dims: { openings } })} />
          <Check testid="dim-internal" label={t('display.internal')} checked={display.dims.internal} onChange={(internal) => onChange({ dims: { internal } })} />
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <Check testid="show-names" label={t('display.names')} checked={display.roomNames} onChange={(roomNames) => onChange({ roomNames })} />
        <Check testid="show-areas" label={t('display.areas')} checked={display.areas} onChange={(areas) => onChange({ areas })} />
        <Check testid="show-opening-sizes" label={t('display.openingSizes')} checked={display.openingSizes} onChange={(openingSizes) => onChange({ openingSizes })} />
        <Check testid="show-structures" label={t('display.structures')} checked={display.structures} onChange={(structures) => onChange({ structures })} />
        <Check testid="show-fixtures" label={t('display.fixtures')} checked={display.fixtures} onChange={(fixtures) => onChange({ fixtures })} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, margin: '8px 0 4px' }}>{t('display.services')}</div>
      {SERVICE_SYSTEMS.map((item) => (
        <Check
          key={item.id}
          testid={`show-layer-${item.id}`}
          label={text(locale, `service.${item.id}`, item.title)}
          checked={layerVisible(plan, item.id)}
          onChange={(visible) => onLayer(setServiceLayer(plan, item.id, visible))}
        />
      ))}
      <div style={{ fontSize: 11, color: '#78716c', marginTop: 6 }}>{t('display.hint')}</div>
    </div>
  )
}
