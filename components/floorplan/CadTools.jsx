'use client'

import { actionsForSelection, CAD_COMMANDS, CAD_EXTRAS, CAD_LAYERS, SELECT_TYPES } from '@/lib/cadEdit'
import { useLocale } from '@/components/i18n/Locale'
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

const EXTRA = CAD_EXTRAS.map((item) => ({ ...item, shortcut: item.short }))

function phrase(t, item) {
  if (!item?.key) return item?.label || ''
  const value = t(item.key)
  return value === item.key ? item.label : value
}

const COMMANDS = [
  ...CAD_COMMANDS.map((cmd) => ({ ...cmd, shortcut: cmd.short })),
  ...EXTRA,
]

const GROUPS = [
  ['move', 'copy', 'rotate', 'rotate90', 'scale', 'mirror'],
  ['array', 'offset', 'stretch', 'align', 'square', 'measure'],
  ['delete', 'group', 'ungroup', 'lock', 'unlock'],
  ['hide', 'isolate', 'show', 'similar', 'match'],
]

function byId(id) {
  return COMMANDS.find((item) => item.id === id)
}

export function CadToolbar({ active, onCommand, onSelectType, onLayer, scope = 'house' }) {
  const { t } = useLocale()
  const types = scope === 'cold'
    ? SELECT_TYPES.filter((item) => item.id === 'all' || item.id === 'room' || item.id === 'door')
    : SELECT_TYPES
  const layers = scope === 'cold' ? [] : CAD_LAYERS
  return (
    <div data-testid="cad-toolbar" data-scope={scope} style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, alignItems: 'center', padding: '3px 8px', background: '#fff', borderBottom: '1px solid #e7e5e4', overflowX: 'auto' }}>
      <select data-testid="select-by-type" defaultValue="" title={t('select.type')} onChange={(event) => { onSelectType(event.target.value); event.target.value = '' }} style={{ height: 28, maxWidth: 132, borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12, fontWeight: 650, flexShrink: 0 }}>
        <option value="">{t('select.type')}…</option>
        {types.map((item) => <option key={item.id} value={item.id}>{phrase(t, item)}</option>)}
      </select>
      <span style={{ width: 1, height: 18, background: '#e7e5e4', flexShrink: 0 }} />
      {GROUPS.map((group) => (
        <span key={group[0]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {group.map((id) => {
            const cmd = byId(id)
            if (!cmd) return null
            return (
              <button key={id} type="button" data-testid={cmd.testid} aria-label={phrase(t, cmd)} title={`${phrase(t, cmd)} (${cmd.shortcut})`} style={iconBtn(active === id)} onClick={(event) => onCommand(id, event)}>
                <CadIcon name={id} />
              </button>
            )
          })}
          <span style={{ width: 1, height: 18, background: '#e7e5e4', flexShrink: 0, marginLeft: 2 }} />
        </span>
      ))}
      {layers.length > 0 && (
        <select data-testid="cad-layer" defaultValue="" title={t('cad.changeLayer')} onChange={(event) => { if (event.target.value) onLayer(event.target.value); event.target.value = '' }} style={{ height: 28, maxWidth: 120, borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12, fontWeight: 650, flexShrink: 0 }}>
          <option value="">{t('cad.layer')}…</option>
          {layers.map((item) => <option key={item.id} value={item.id}>{phrase(t, item)}</option>)}
        </select>
      )}
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
  const { t } = useLocale()
  if (!command) return null
  const cmd = CAD_COMMANDS.find((item) => item.id === command.name)
  const distance = ['move', 'copy', 'array', 'offset', 'stretch'].includes(command.name)
  const angle = command.name === 'rotate'
  const factor = command.name === 'scale'
  const hint = command.name === 'extend-wall'
    ? (command.step === 'target' ? t('join.pickWall') : t('join.pickEnd'))
    : command.name === 'join-corner'
      ? t('join.pickTwo')
      : command.name === 'shift-wall'
    ? (command.step === 'from' ? t('cad.fromWall') : t('cad.toWall'))
    : command.name === 'mirror'
      ? (command.step === 'base' ? t('cad.mirrorStart') : t('cad.mirrorEnd'))
      : command.name === 'rotate'
        ? (command.step === 'base' ? t('cad.rotateBase') : t('cad.rotateDir'))
        : command.step === 'window' ? t('cad.window') : command.step === 'base' ? t('cad.base') : command.step === 'source' ? t('cad.source') : t('cad.target')
  return (
    <div data-testid="cad-prompt" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <strong>{command.name === 'shift-wall' ? t('draw.shiftWall') : command.name === 'extend-wall' ? t('join.extend') : command.name === 'join-corner' ? t('join.corner') : (phrase(t, cmd) || command.name)}</strong>
      <span style={{ color: '#57534e' }}>{hint}</span>
      {distance && (
        <input data-testid="cad-value" inputMode="decimal" placeholder="mm" value={command.value || ''} onChange={(event) => onChange({ value: event.target.value })} onKeyDown={(event) => onFieldKey(event, onApply, onCancel)} style={{ width: 72, height: 24, borderRadius: 6, border: '1px solid #d6d3d1' }} />
      )}
      {angle && (
        <input data-testid="cad-value" inputMode="decimal" placeholder="astetta" value={command.value || ''} onChange={(event) => onChange({ value: event.target.value })} onKeyDown={(event) => onFieldKey(event, onApply, onCancel)} style={{ width: 72, height: 24, borderRadius: 6, border: '1px solid #d6d3d1' }} />
      )}
      {factor && (
        <input data-testid="cad-value" inputMode="decimal" placeholder="kerroin" value={command.value || ''} onChange={(event) => onChange({ value: event.target.value })} onKeyDown={(event) => onFieldKey(event, onApply, onCancel)} style={{ width: 72, height: 24, borderRadius: 6, border: '1px solid #d6d3d1' }} />
      )}
      {command.name === 'shift-wall' && (
        <>
          <select data-testid="shift-mode" value={command.distanceMode || 'offset'} onChange={(event) => onChange({ distanceMode: event.target.value })} style={{ height: 24 }}>
            <option value="offset">{t('cad.offsetMode')}</option>
            <option value="distance">{t('cad.distance')}</option>
          </select>
          <input data-testid={command.distanceMode === 'distance' ? 'shift-distance' : 'shift-offset'} inputMode="decimal" placeholder="mm" value={command.value || ''} onChange={(event) => onChange({ value: event.target.value })} onKeyDown={(event) => onFieldKey(event, onApply, onCancel)} style={{ width: 72, height: 24, borderRadius: 6, border: '1px solid #d6d3d1' }} />
        </>
      )}
      {command.name === 'copy' && (
        <input data-testid="cad-copies" type="number" min="1" value={command.copies || 1} onChange={(event) => onChange({ copies: Number(event.target.value) || 1 })} onKeyDown={(event) => onFieldKey(event, onApply, onCancel)} style={{ width: 52, height: 24, borderRadius: 6, border: '1px solid #d6d3d1' }} title={t('cad.copies')} />
      )}
      {command.name === 'array' && (
        <>
          <select data-testid="cad-array-mode" value={command.arrayMode || 'linear'} onChange={(event) => onChange({ arrayMode: event.target.value })} style={{ height: 24 }}>
            <option value="linear">{t('cad.line')}</option>
            <option value="rect">{t('cad.grid')}</option>
          </select>
          <input data-testid="cad-array-count" type="number" min="2" value={command.count || 3} onChange={(event) => onChange({ count: Number(event.target.value) || 2 })} style={{ width: 48, height: 24 }} />
          <input data-testid="cad-array-cols" type="number" min="1" value={command.cols || 3} onChange={(event) => onChange({ cols: Number(event.target.value) || 1 })} style={{ width: 48, height: 24 }} title={t('cad.cols')} />
          <input data-testid="cad-array-rows" type="number" min="1" value={command.rows || 2} onChange={(event) => onChange({ rows: Number(event.target.value) || 1 })} style={{ width: 48, height: 24 }} title={t('cad.rows')} />
        </>
      )}
      {command.name === 'align' && (
        <select data-testid="cad-align-edge" value={command.edge || 'left'} onChange={(event) => onChange({ edge: event.target.value })} style={{ height: 24 }}>
          <option value="left">{t('opening.left')}</option>
          <option value="right">{t('opening.right')}</option>
          <option value="center">{t('cad.mid')}</option>
          <option value="top">{t('cad.top')}</option>
          <option value="bottom">{t('cad.bottom')}</option>
          <option value="middle">{t('cad.middle')}</option>
        </select>
      )}
      {readout && <span data-testid="cad-readout">{readout}</span>}
      <button type="button" data-testid="cad-apply" style={barBtn(true)} onClick={onApply}>{t('cad.done')}</button>
      <button type="button" data-testid="cad-cancel" style={barBtn(false)} onClick={onCancel}>{t('cad.undoShort')}</button>
    </div>
  )
}

export function EditCommandItems({ itemStyle, onCommand, onSelectType, onLayer, scope = 'house' }) {
  const { t } = useLocale()
  const types = scope === 'cold'
    ? SELECT_TYPES.filter((item) => item.id === 'all' || item.id === 'room' || item.id === 'door')
    : SELECT_TYPES
  const layers = scope === 'cold' ? [] : CAD_LAYERS
  const row = itemStyle ? itemStyle(false) : { ...barBtn(false), textAlign: 'left', width: '100%' }
  return (
    <>
      <div style={{ height: 1, background: '#e7e5e4', margin: '4px 2px' }} />
      <select data-testid="menu-select-type" defaultValue="" title={t('select.type')} onChange={(event) => { const value = event.target.value; event.target.value = ''; if (value) onSelectType?.(value) }} style={{ ...selectLike, margin: '2px 4px' }}>
        <option value="">{t('select.type')}…</option>
        {types.map((item) => <option key={item.id} value={item.id}>{phrase(t, item)}</option>)}
      </select>
      {COMMANDS.map((cmd) => (
        <button key={cmd.id} type="button" data-testid={`menu-${cmd.testid}`} title={`${phrase(t, cmd)} (${cmd.shortcut})`} style={{ ...row, display: 'flex', justifyContent: 'space-between', gap: 16, width: '100%' }} onClick={() => onCommand?.(cmd.id)}>
          <span>{phrase(t, cmd)}</span>
          <span style={{ color: '#78716c', fontWeight: 650 }}>{cmd.shortcut}</span>
        </button>
      ))}
      {layers.length > 0 && (
        <select data-testid="menu-cad-layer" defaultValue="" title={t('cad.changeLayer')} onChange={(event) => { const value = event.target.value; event.target.value = ''; if (value) onLayer?.(value) }} style={{ ...selectLike, margin: '2px 4px' }}>
          <option value="">{t('cad.layer')}…</option>
          {layers.map((item) => <option key={item.id} value={item.id}>{phrase(t, item)}</option>)}
        </select>
      )}
    </>
  )
}

const selectLike = {
  height: 28,
  borderRadius: 6,
  border: '1px solid #d6d3d1',
  fontSize: 12,
  fontWeight: 650,
  background: '#fff',
  color: '#1c1917',
}

export function SelectionActions({ kind, count = 1, active, onCommand }) {
  const { t } = useLocale()
  const ids = actionsForSelection(kind, count)
  if (!ids.length || !onCommand) return null
  return (
    <div data-testid="selection-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '0 0 10px' }}>
      {ids.map((id) => {
        const cmd = byId(id)
        if (!cmd) return null
        return (
          <button key={id} type="button" data-testid={`act-${cmd.testid}`} aria-label={phrase(t, cmd)} title={`${phrase(t, cmd)} (${cmd.shortcut})`} style={iconBtn(active === id)} onClick={(event) => onCommand(id, event)}>
            <CadIcon name={id} />
          </button>
        )
      })}
    </div>
  )
}

export function MultiProperties({ count, children }) {
  const { t } = useLocale()
  return (
    <div data-testid="multi-properties" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 750 }}>{t('cad.count', { count })}</div>
      <div style={{ fontSize: 12, color: '#57534e' }}>{t('cad.shared')}</div>
      {children}
    </div>
  )
}
