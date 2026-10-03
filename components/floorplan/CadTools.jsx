'use client'

import { CAD_COMMANDS, CAD_LAYERS, SELECT_TYPES } from '@/lib/cadEdit'

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

export function CadToolbar({ active, onCommand, onSelectType, onLayer }) {
  return (
    <div data-testid="cad-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '6px 10px', background: '#fff', borderBottom: '1px solid #e7e5e4' }}>
      <select data-testid="select-by-type" defaultValue="" onChange={(event) => { onSelectType(event.target.value); event.target.value = '' }} style={{ height: 28, borderRadius: 7, border: '1px solid #d6d3d1', fontSize: 12, fontWeight: 650 }}>
        <option value="">Valitse tyyppi…</option>
        {SELECT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      {CAD_COMMANDS.map((cmd) => (
        <button key={cmd.id} type="button" data-testid={cmd.testid} title={cmd.short} style={barBtn(active === cmd.id)} onClick={() => onCommand(cmd.id)}>
          {cmd.label}
        </button>
      ))}
      <button type="button" data-testid="cad-rotate-90" style={barBtn(false)} onClick={() => onCommand('rotate90')}>90°</button>
      <button type="button" data-testid="cad-delete" style={barBtn(false)} onClick={() => onCommand('delete')}>Poista</button>
      <button type="button" data-testid="cad-group" style={barBtn(false)} onClick={() => onCommand('group')}>Ryhmitä</button>
      <button type="button" data-testid="cad-ungroup" style={barBtn(false)} onClick={() => onCommand('ungroup')}>Pura</button>
      <button type="button" data-testid="cad-lock" style={barBtn(false)} onClick={() => onCommand('lock')}>Lukitse</button>
      <button type="button" data-testid="cad-unlock" style={barBtn(false)} onClick={() => onCommand('unlock')}>Avaa lukitus</button>
      <button type="button" data-testid="cad-hide" style={barBtn(false)} onClick={() => onCommand('hide')}>Piilota</button>
      <button type="button" data-testid="cad-isolate" style={barBtn(false)} onClick={() => onCommand('isolate')}>Eristä</button>
      <button type="button" data-testid="cad-show" style={barBtn(false)} onClick={() => onCommand('show')}>Näytä kaikki</button>
      <button type="button" data-testid="cad-similar" style={barBtn(false)} onClick={() => onCommand('similar')}>Samanlaiset</button>
      <button type="button" data-testid="cad-match" style={barBtn(active === 'match')} onClick={() => onCommand('match')}>Kopioi ominaisuudet</button>
      <select data-testid="cad-layer" defaultValue="" onChange={(event) => { if (event.target.value) onLayer(event.target.value); event.target.value = '' }} style={{ height: 28, borderRadius: 7, border: '1px solid #d6d3d1', fontSize: 12, fontWeight: 650 }}>
        <option value="">Vaihda taso…</option>
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
        {command.step === 'window' ? 'Vedä ylittävä ikkuna kärkipisteiden yli.' : command.step === 'base' ? 'Napsauta peruspiste.' : command.step === 'source' ? 'Napsauta kohde, jonka ominaisuudet kopioidaan.' : 'Napsauta kohde tai näppäile arvo.'}
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
