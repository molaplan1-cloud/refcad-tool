'use client'

import { CAD_COMMANDS, CAD_LAYERS, SELECT_TYPES } from '@/lib/cadEdit'
import { CadIcon } from './CadIcons'

const barBtn = (active) => ({
  border: '1px solid #e7e5e4',
  background: active ? '#134e4a' : '#fff',
  color: active ? '#ccfbf1' : '#1c1917',
  borderRadius: 7,
  padding: '4px 8px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
})

const iconBtn = (active) => ({
  width: 28,
  height: 28,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  border: `1px solid ${active ? '#0f766e' : '#e7e5e4'}`,
  background: active ? '#134e4a' : '#fff',
  color: active ? '#f0fdfa' : '#1c1917',
  fontSize: 11,
  fontWeight: 750,
  cursor: 'pointer',
  flexShrink: 0,
})

const EXTRA = [
  { id: 'rotate90', testid: 'cad-rotate-90', label: 'Käännä 90°', shortcut: 'R' },
  { id: 'delete', testid: 'cad-delete', label: 'Poista', shortcut: 'Del' },
  { id: 'group', testid: 'cad-group', label: 'Ryhmitä', shortcut: 'Ctrl+G' },
  { id: 'ungroup', testid: 'cad-ungroup', label: 'Pura ryhmä', shortcut: 'Ctrl+Shift+G' },
  { id: 'lock', testid: 'cad-lock', label: 'Lukitse', shortcut: 'L' },
  { id: 'unlock', testid: 'cad-unlock', label: 'Avaa lukitus', shortcut: 'L' },
  { id: 'hide', testid: 'cad-hide', label: 'Piilota', shortcut: 'H' },
  { id: 'isolate', testid: 'cad-isolate', label: 'Eristä', shortcut: 'I' },
  { id: 'show', testid: 'cad-show', label: 'Näytä kaikki', shortcut: 'Shift+H' },
  { id: 'similar', testid: 'cad-similar', label: 'Valitse samanlaiset', shortcut: 'Shift+S' },
  { id: 'match', testid: 'cad-match', label: 'Kopioi ominaisuudet', shortcut: 'K' },
]

const COMMANDS = [
  ...CAD_COMMANDS.map((cmd) => ({ ...cmd, shortcut: cmd.short })),
  ...EXTRA,
]

const GROUPS = [
  ['move', 'copy', 'rotate', 'rotate90', 'scale', 'mirror'],
  ['array', 'offset', 'stretch', 'align', 'measure'],
  ['delete', 'group', 'ungroup', 'lock', 'unlock'],
  ['hide', 'isolate', 'show', 'similar', 'match'],
]

function byId(id) {
  return COMMANDS.find((item) => item.id === id)
}

export function CadToolbar({ active, onCommand, onSelectType, onLayer }) {
  return (
    <div data-testid="cad-toolbar" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, alignItems: 'center', padding: '3px 8px', background: '#fff', borderBottom: '1px solid #e7e5e4', overflowX: 'auto' }}>
      <select data-testid="select-by-type" defaultValue="" title="Valitse tyyppi" onChange={(event) => { onSelectType(event.target.value); event.target.value = '' }} style={{ height: 28, maxWidth: 132, borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12, fontWeight: 650, flexShrink: 0 }}>
        <option value="">Tyyppi…</option>
        {SELECT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <span style={{ width: 1, height: 18, background: '#e7e5e4', flexShrink: 0 }} />
      {GROUPS.map((group) => (
        <span key={group[0]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {group.map((id) => {
            const cmd = byId(id)
            if (!cmd) return null
            return (
              <button key={id} type="button" data-testid={cmd.testid} aria-label={cmd.label} title={`${cmd.label} (${cmd.shortcut})`} style={iconBtn(active === id)} onClick={(event) => onCommand(id, event)}>
                <CadIcon name={id} />
              </button>
            )
          })}
          <span style={{ width: 1, height: 18, background: '#e7e5e4', flexShrink: 0, marginLeft: 2 }} />
        </span>
      ))}
      <select data-testid="cad-layer" defaultValue="" title="Vaihda taso" onChange={(event) => { if (event.target.value) onLayer(event.target.value); event.target.value = '' }} style={{ height: 28, maxWidth: 120, borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12, fontWeight: 650, flexShrink: 0 }}>
        <option value="">Taso…</option>
        {CAD_LAYERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
  )
}

function onFieldKey(event, onApply, onCancel) {
  if (event.key === 'Enter') {
    event.preventDefault()
    onApply()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    onCancel()
  }
}

export function CadPrompt({ command, readout, onChange, onApply, onCancel }) {
  if (!command) return null
  const cmd = CAD_COMMANDS.find((item) => item.id === command.name)
  const distance = ['move', 'copy', 'array', 'offset', 'stretch'].includes(command.name)
  const angle = command.name === 'rotate'
  const factor = command.name === 'scale'
  return (
    <div data-testid="cad-prompt" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <strong>{cmd?.label || command.name}</strong>
      <span style={{ color: '#57534e' }}>
        {command.name === 'mirror'
          ? (command.step === 'base' ? 'Napsauta peilausakselin alkupiste.' : 'Napsauta peilausakselin loppupiste.')
          : command.name === 'rotate'
            ? (command.step === 'base' ? 'Napsauta kiertopiste.' : 'Napsauta suunta tai näppäile kulma.')
            : command.step === 'window' ? 'Vedä ylittävä ikkuna kärkipisteiden yli.' : command.step === 'base' ? 'Napsauta peruspiste.' : command.step === 'source' ? 'Napsauta kohde, jonka ominaisuudet kopioidaan.' : 'Napsauta kohde tai näppäile arvo.'}
      </span>
      {distance && (
        <input data-testid="cad-value" inputMode="decimal" placeholder="mm" value={command.value || ''} onChange={(event) => onChange({ value: event.target.value })} onKeyDown={(event) => onFieldKey(event, onApply, onCancel)} style={{ width: 72, height: 24, borderRadius: 6, border: '1px solid #d6d3d1' }} />
      )}
      {angle && (
        <input data-testid="cad-value" inputMode="decimal" placeholder="astetta" value={command.value || ''} onChange={(event) => onChange({ value: event.target.value })} onKeyDown={(event) => onFieldKey(event, onApply, onCancel)} style={{ width: 72, height: 24, borderRadius: 6, border: '1px solid #d6d3d1' }} />
      )}
      {factor && (
        <input data-testid="cad-value" inputMode="decimal" placeholder="kerroin" value={command.value || ''} onChange={(event) => onChange({ value: event.target.value })} onKeyDown={(event) => onFieldKey(event, onApply, onCancel)} style={{ width: 72, height: 24, borderRadius: 6, border: '1px solid #d6d3d1' }} />
      )}
      {command.name === 'copy' && (
        <input data-testid="cad-copies" type="number" min="1" value={command.copies || 1} onChange={(event) => onChange({ copies: Number(event.target.value) || 1 })} onKeyDown={(event) => onFieldKey(event, onApply, onCancel)} style={{ width: 52, height: 24, borderRadius: 6, border: '1px solid #d6d3d1' }} title="Kopioita" />
      )}
      {command.name === 'array' && (
        <>
          <select data-testid="cad-array-mode" value={command.arrayMode || 'linear'} onChange={(event) => onChange({ arrayMode: event.target.value })} style={{ height: 24 }}>
            <option value="linear">Linja</option>
            <option value="rect">Ruudukko</option>
          </select>
          <input data-testid="cad-array-count" type="number" min="2" value={command.count || 3} onChange={(event) => onChange({ count: Number(event.target.value) || 2 })} style={{ width: 48, height: 24 }} />
          <input data-testid="cad-array-cols" type="number" min="1" value={command.cols || 3} onChange={(event) => onChange({ cols: Number(event.target.value) || 1 })} style={{ width: 48, height: 24 }} title="Sarakkeet" />
          <input data-testid="cad-array-rows" type="number" min="1" value={command.rows || 2} onChange={(event) => onChange({ rows: Number(event.target.value) || 1 })} style={{ width: 48, height: 24 }} title="Rivit" />
        </>
      )}
      {command.name === 'align' && (
        <select data-testid="cad-align-edge" value={command.edge || 'left'} onChange={(event) => onChange({ edge: event.target.value })} style={{ height: 24 }}>
          <option value="left">Vasen</option>
          <option value="right">Oikea</option>
          <option value="center">Keski</option>
          <option value="top">Ylä</option>
          <option value="bottom">Ala</option>
          <option value="middle">Keskikohta</option>
        </select>
      )}
      {readout && <span data-testid="cad-readout">{readout}</span>}
      <button type="button" data-testid="cad-apply" style={barBtn(true)} onClick={onApply}>Valmis</button>
      <button type="button" data-testid="cad-cancel" style={barBtn(false)} onClick={onCancel}>Peru</button>
    </div>
  )
}

export function MultiProperties({ count, children }) {
  return (
    <div data-testid="multi-properties" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 750 }}>{count} kohdetta</div>
      <div style={{ fontSize: 12, color: '#57534e' }}>Yhteiset kentät muuttavat koko valinnan.</div>
      {children}
    </div>
  )
}
