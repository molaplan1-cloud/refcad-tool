'use client'

import { useState } from 'react'
import { ROOF_TYPES } from '@/lib/floorplan'
import { useLocale } from '@/components/i18n/Locale'

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #d6d3d1',
  fontSize: 13,
  background: '#fff',
  color: '#1c1917',
}

const choiceBtn = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '12px 12px',
  minHeight: 44,
  borderRadius: 10,
  border: '1px solid #d6d3d1',
  background: '#fff',
  color: '#1c1917',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  marginBottom: 8,
}

function Overlay({ testid, title, children, onClose }) {
  return (
    <div
      data-testid={testid}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,24,31,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div style={{ width: 'min(440px, 100%)', maxHeight: '86vh', overflowY: 'auto', background: '#fff', color: '#1c1917', borderRadius: 16, padding: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{title}</div>
          {onClose && (
            <button type="button" data-testid={`${testid}-close`} onClick={onClose} style={{ ...choiceBtn, width: 'auto', margin: 0, padding: '6px 10px' }}>Sulje</button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
      <span style={{ display: 'block', marginBottom: 3 }}>{label}</span>
      {children}
    </label>
  )
}

export function StartDialog({ library, onEmpty, onExample, onOpen }) {
  const { t } = useLocale()
  return (
    <Overlay testid="plan-start" title={t('start.title')}>
      <p style={{ fontSize: 13, margin: '0 0 12px', color: '#44403c' }}>{t('start.lead')}</p>
      <button type="button" data-testid="start-empty" style={choiceBtn} onClick={onEmpty}>{t('start.empty')}</button>
      <button type="button" data-testid="start-example" style={choiceBtn} onClick={onExample}>{t('file.example')}</button>
      <div style={{ fontSize: 12, fontWeight: 750, margin: '8px 0' }}>{t('start.saved')}</div>
      {(library?.projects || []).length === 0 && <div style={{ fontSize: 12, color: '#78716c' }}>{t('start.none')}</div>}
      {(library?.projects || []).map((item) => (
        <button key={item.id} type="button" data-testid={`start-open-${item.id}`} style={choiceBtn} onClick={() => onOpen(item.id)}>
          {item.name}
        </button>
      ))}
    </Overlay>
  )
}

export function ShellDialog({ title, onCancel, onCreate, onExample }) {
  const [length, setLength] = useState(12000)
  const [width, setWidth] = useState(9000)
  const [thickness, setThickness] = useState(240)
  const [height, setHeight] = useState(2600)
  const [roofType, setRoofType] = useState('gable')
  const [pitch, setPitch] = useState(25)
  const [createWalls, setCreateWalls] = useState(false)
  return (
    <Overlay testid="shell-dialog" title={title || 'Uusi pohja'} onClose={onCancel}>
      <p style={{ fontSize: 13, margin: '0 0 12px', color: '#44403c' }}>Nykyinen pohja korvataan.</p>
      <button type="button" data-testid="new-example" style={choiceBtn} onClick={onExample}>Esimerkkitalo</button>
      <div style={{ fontSize: 13, fontWeight: 800, margin: '4px 0 8px' }}>Tyhjä pohja</div>
      <Field label="Pituus (mm)">
        <input data-testid="shell-length" style={inputStyle} type="number" min="0" value={length} onChange={(event) => setLength(Number(event.target.value))} />
      </Field>
      <Field label="Leveys (mm)">
        <input data-testid="shell-width" style={inputStyle} type="number" min="0" value={width} onChange={(event) => setWidth(Number(event.target.value))} />
      </Field>
      <Field label="Ulkoseinän paksuus (mm)">
        <input data-testid="shell-thickness" style={inputStyle} type="number" min="80" value={thickness} onChange={(event) => setThickness(Number(event.target.value))} />
      </Field>
      <Field label="Kerroskorkeus (mm)">
        <input data-testid="shell-height" style={inputStyle} type="number" min="2200" value={height} onChange={(event) => setHeight(Number(event.target.value))} />
      </Field>
      <Field label="Kattomuoto">
        <select data-testid="shell-roof" style={inputStyle} value={roofType} onChange={(event) => setRoofType(event.target.value)}>
          {ROOF_TYPES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Kattokaltevuus (°)">
        <input data-testid="shell-pitch" style={inputStyle} type="number" min="0" max="60" value={pitch} onChange={(event) => setPitch(Number(event.target.value))} />
      </Field>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '4px 0 12px' }}>
        <input data-testid="shell-walls" type="checkbox" checked={createWalls} onChange={(event) => setCreateWalls(event.target.checked)} />
        Luo ulkoseinät suorakulmiona
      </label>
      <button
        type="button"
        data-testid="new-empty"
        style={{ ...choiceBtn, background: '#134e4a', color: '#ccfbf1', borderColor: '#134e4a' }}
        onClick={() => onCreate({
          length: length / 1000,
          width: width / 1000,
          exteriorThickness: thickness / 1000,
          floorHeight: height / 1000,
          roofType,
          roofPitch: pitch,
          createWalls,
          name: 'Uusi pohja',
        })}
      >
        Tyhjä pohja
      </button>
    </Overlay>
  )
}

export function LibraryDialog({ library, onClose, onSave, onOpen, onRename, onDelete, onExport, onImport }) {
  return (
    <Overlay testid="plan-library" title="Avaa / Tallenna" onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" data-testid="library-save" style={{ ...choiceBtn, width: 'auto', margin: 0 }} onClick={onSave}>Tallenna</button>
        <button type="button" data-testid="plan-export-json" style={{ ...choiceBtn, width: 'auto', margin: 0 }} onClick={onExport}>Vie JSON</button>
        <label style={{ ...choiceBtn, width: 'auto', margin: 0 }}>
          Tuo JSON
          <input data-testid="plan-import-json" type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }} />
        </label>
      </div>
      {(library?.projects || []).length === 0 && <div style={{ fontSize: 12, color: '#78716c' }}>Ei tallennettuja pohjia.</div>}
      {(library?.projects || []).map((item) => (
        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <input
            data-testid={`library-rename-${item.id}`}
            aria-label={`Nimeä ${item.name}`}
            style={inputStyle}
            defaultValue={item.name}
            onBlur={(event) => onRename(item.id, event.target.value)}
          />
          <button type="button" data-testid={`library-open-${item.id}`} style={{ ...choiceBtn, width: 'auto', margin: 0 }} onClick={() => onOpen(item.id)}>Avaa</button>
          <button type="button" data-testid={`library-delete-${item.id}`} style={{ ...choiceBtn, width: 'auto', margin: 0 }} onClick={() => onDelete(item.id)}>Poista</button>
        </div>
      ))}
    </Overlay>
  )
}
