'use client'

import { usePlanLocale } from '@/components/i18n/Locale'
import { COVER_FRAMES, COVER_GLASS, COVER_ROOFS, COVER_SIDES, COVER_TINTS, COVER_TYPES, normalizeCover } from '@/lib/covers'
import { groundWarnings } from '@/lib/groundworks'
import {
  BEDS,
  BUILDINGS,
  FENCE_KINDS,
  OBJECTS,
  PATH_KINDS,
  PATH_MATERIALS,
  PLANTS,
  ROOF_NAMES,
  TERRACE_MATERIALS,
  deleteYardItem,
  duplicateYardItem,
  ensureYard,
  formatMetres,
  formatSquare,
  objectSpec,
  plotMetrics,
  rotateYardItem,
  updateYardItem,
  yardItem,
  yardTitle,
} from '@/lib/yard'

const inputStyle = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d6d3d1', background: '#fff', fontSize: 13 }
const btn = { display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 650 }

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', margin: '8px 0', fontSize: 12, fontWeight: 700, color: '#44403c' }}>
      {label}
      <div style={{ fontWeight: 500, marginTop: 4 }}>{children}</div>
    </label>
  )
}

function remove(plan, selection) {
  return deleteYardItem(plan, selection.collection, selection.id)
}

export function YardFields({ plan, selection, onCommit }) {
  const { t } = usePlanLocale(plan)
  if (!selection || selection.kind !== 'yard') return null
  const item = yardItem(plan, selection.collection, selection.id)
  if (selection.collection !== 'plot' && !item) return null
  const metrics = plotMetrics(plan)
  const commit = (patch) => onCommit(updateYardItem(plan, selection.collection, selection.id, patch))
  return (
    <div data-testid="yard-fields">
      <div style={{ fontWeight: 750, marginBottom: 6 }}>{yardTitle(plan, selection)}</div>
      {selection.collection === 'plot' && (
        <>
          <div data-testid="yard-plot-area">Ala {formatSquare(metrics.area)}</div>
          <div>Piiri {formatMetres(metrics.perimeter)}</div>
          {metrics.edges.map((edge) => (
            <div key={edge.index}>Sivu {edge.index + 1}: {formatMetres(edge.length)}</div>
          ))}
        </>
      )}
      {selection.collection === 'terraces' && item && (
        <>
          <Field label="Materiaali">
            <select data-testid="yard-material" style={inputStyle} value={item.material || 'wood'} onChange={(event) => commit({ material: event.target.value })}>
              {TERRACE_MATERIALS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </Field>
          <label style={{ display: 'flex', gap: 6, fontSize: 13 }}><input data-testid="yard-railing" type="checkbox" checked={item.railing !== false} onChange={(event) => commit({ railing: event.target.checked })} />Kaide</label>
          <label style={{ display: 'flex', gap: 6, fontSize: 13 }}><input data-testid="yard-steps" type="checkbox" checked={Boolean(item.steps)} onChange={(event) => commit({ steps: event.target.checked })} />Portaat</label>
        </>
      )}
      {selection.collection === 'paths' && item && (
        <>
          <Field label="Tyyppi">
            <select data-testid="yard-path-kind" style={inputStyle} value={item.kind} onChange={(event) => commit({ kind: event.target.value })}>
              {PATH_KINDS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </Field>
          <Field label="Leveys (m)">
            <input data-testid="yard-width" style={inputStyle} type="number" step="0.1" min="0.4" value={item.width} onChange={(event) => commit({ width: Number(event.target.value) || item.width })} />
          </Field>
          <Field label="Pinta">
            <select data-testid="yard-material" style={inputStyle} value={item.material} onChange={(event) => commit({ material: event.target.value })}>
              {PATH_MATERIALS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </Field>
        </>
      )}
      {selection.collection === 'fences' && item && (
        <>
          <Field label="Tyyppi">
            <select data-testid="yard-fence-kind" style={inputStyle} value={item.kind} onChange={(event) => commit({ kind: event.target.value, height: (FENCE_KINDS.find((entry) => entry.id === event.target.value) || {}).height || item.height })}>
              {FENCE_KINDS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </Field>
          <Field label="Korkeus (m)">
            <input data-testid="yard-height" style={inputStyle} type="number" step="0.1" min="0.3" value={item.height} onChange={(event) => commit({ height: Number(event.target.value) || item.height })} />
          </Field>
          <Field label="Portin kohta (m)">
            <input data-testid="yard-gate-offset" style={inputStyle} type="number" step="0.1" value={item.gates?.[0]?.offset ?? 0} onChange={(event) => commit({ gates: [{ segment: 0, offset: Number(event.target.value) || 0, width: item.gates?.[0]?.width || 1.2 }] })} />
          </Field>
          <Field label="Portin leveys (m)">
            <input data-testid="yard-gate-width" style={inputStyle} type="number" step="0.1" value={item.gates?.[0]?.width || 1} onChange={(event) => commit({ gates: [{ segment: item.gates?.[0]?.segment || 0, offset: item.gates?.[0]?.offset || 0, width: Number(event.target.value) || 1 }] })} />
          </Field>
        </>
      )}
      {selection.collection === 'plants' && item && (
        <>
          <Field label="Laji">
            <select data-testid="yard-plant-kind" style={inputStyle} value={item.kind} onChange={(event) => commit({ kind: event.target.value })}>
              {PLANTS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </Field>
          <Field label="Latvus (m)">
            <input data-testid="yard-canopy" style={inputStyle} type="number" step="0.1" min="0.4" value={item.canopy} onChange={(event) => commit({ canopy: Number(event.target.value) || item.canopy })} />
          </Field>
        </>
      )}
      {selection.collection === 'beds' && item && (
        <Field label="Alue">
          <select style={inputStyle} value={item.kind} onChange={(event) => commit({ kind: event.target.value })}>
            {BEDS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </Field>
      )}
      {selection.collection === 'objects' && item && (
        <>
          <Field label="Kohde">
            <select data-testid="yard-object-kind" style={inputStyle} value={item.kind} onChange={(event) => {
              const spec = objectSpec(event.target.value)
              commit({ kind: spec.id, w: spec.w, d: spec.d })
            }}>
              {OBJECTS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </Field>
          {objectSpec(item.kind).electric && <div data-testid="yard-ip">Sähkö {objectSpec(item.kind).electric.ip}, vikavirtasuoja, ulkokaapeli</div>}
          {objectSpec(item.kind).water && <div data-testid="yard-water">Kytketään käyttövesiverkostoon</div>}
        </>
      )}
      {selection.collection === 'buildings' && item && (
        <>
          <Field label="Tyyppi">
            <select data-testid="yard-building-kind" style={inputStyle} value={item.kind} onChange={(event) => {
              const spec = BUILDINGS.find((entry) => entry.id === event.target.value) || BUILDINGS[0]
              commit({ kind: spec.id, w: spec.w, d: spec.d, height: spec.height, roof: spec.roof })
            }}>
              {BUILDINGS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </Field>
          <Field label="Leveys (m)"><input style={inputStyle} type="number" step="0.1" value={item.w} onChange={(event) => commit({ w: Number(event.target.value) || item.w })} /></Field>
          <Field label="Syvyys (m)"><input style={inputStyle} type="number" step="0.1" value={item.d} onChange={(event) => commit({ d: Number(event.target.value) || item.d })} /></Field>
          <Field label="Korkeus (m)"><input data-testid="yard-building-height" style={inputStyle} type="number" step="0.1" value={item.height} onChange={(event) => commit({ height: Number(event.target.value) || item.height })} /></Field>
          <Field label="Katto">
            <select data-testid="yard-roof" style={inputStyle} value={item.roof} onChange={(event) => commit({ roof: event.target.value })}>
              {ROOF_NAMES.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </Field>
        </>
      )}
      {selection.collection === 'covers' && item && (() => {
        const cover = normalizeCover(item)
        const frame = COVER_FRAMES.find((entry) => entry.id === cover.frame) || COVER_FRAMES[0]
        return (
          <>
            <div data-testid="cover-attachment">{cover.wallId ? t('cover.attached') : t('cover.freestanding')}</div>
            <Field label={t('cover.kind')}>
              <select data-testid="cover-kind" style={inputStyle} value={cover.kind} onChange={(event) => {
                const spec = COVER_TYPES.find((entry) => entry.id === event.target.value) || COVER_TYPES[0]
                const nextFrame = COVER_FRAMES.find((entry) => entry.id === spec.frame) || frame
                commit({
                  kind: spec.id,
                  height: spec.height,
                  pitch: spec.pitch,
                  roofing: spec.roofing,
                  frame: spec.frame,
                  frameColor: nextFrame.color,
                  postSpacing: spec.postSpacing,
                  rafterSpacing: spec.rafterSpacing,
                  sides: spec.sides,
                })
              }}>
                {COVER_TYPES.map((entry) => <option key={entry.id} value={entry.id}>{t(`cover.${entry.id}`)}</option>)}
              </select>
            </Field>
            <Field label={t('cover.frame')}>
              <select data-testid="cover-frame" style={inputStyle} value={cover.frame} onChange={(event) => {
                const next = COVER_FRAMES.find((entry) => entry.id === event.target.value) || COVER_FRAMES[0]
                commit({ frame: next.id, frameColor: next.color })
              }}>
                {COVER_FRAMES.map((entry) => <option key={entry.id} value={entry.id}>{t(`cover.frame.${entry.id}`)}</option>)}
              </select>
            </Field>
            <Field label={t('cover.roof')}>
              <select data-testid="cover-roof" style={inputStyle} value={cover.roofing} onChange={(event) => commit({ roofing: event.target.value })}>
                {COVER_ROOFS.map((entry) => <option key={entry.id} value={entry.id}>{t(`cover.roof.${entry.id}`)}</option>)}
              </select>
            </Field>
            {cover.roofing === 'polycarbonate' && (
              <Field label={t('cover.tint')}>
                <select data-testid="cover-tint" style={inputStyle} value={cover.roofTint} onChange={(event) => commit({ roofTint: event.target.value })}>
                  {COVER_TINTS.map((entry) => <option key={entry.id} value={entry.id}>{t(`cover.tint.${entry.id}`)}</option>)}
                </select>
              </Field>
            )}
            {cover.roofing === 'glass' && (
              <Field label={t('cover.glass')}>
                <select data-testid="cover-glass" style={inputStyle} value={cover.glassKind} onChange={(event) => commit({ glassKind: event.target.value })}>
                  {COVER_GLASS.map((entry) => <option key={entry.id} value={entry.id}>{t(`cover.glass.${entry.id}`)}</option>)}
                </select>
              </Field>
            )}
            <Field label={t('cover.sides')}>
              <select data-testid="cover-sides" style={inputStyle} value={cover.sides} onChange={(event) => commit({ sides: event.target.value })}>
                {COVER_SIDES.map((entry) => <option key={entry.id} value={entry.id}>{t(`cover.side.${entry.id}`)}</option>)}
              </select>
            </Field>
            <Field label={t('cover.height')}>
              <input data-testid="cover-height" style={inputStyle} type="number" step="0.1" min="1.6" value={cover.height} onChange={(event) => commit({ height: Number(event.target.value) || cover.height })} />
            </Field>
            <Field label={t('cover.pitch')}>
              <input data-testid="cover-pitch" style={inputStyle} type="number" step="1" min="0" value={cover.pitch} onChange={(event) => commit({ pitch: Number(event.target.value) || 0 })} />
            </Field>
            <Field label={t('cover.postSize')}>
              <input data-testid="cover-post-size" style={inputStyle} type="number" step="0.01" min="0.06" value={cover.postSize} onChange={(event) => commit({ postSize: Number(event.target.value) || cover.postSize })} />
            </Field>
            <Field label={t('cover.postSpacing')}>
              <input data-testid="cover-post-spacing" style={inputStyle} type="number" step="0.1" min="0.6" value={cover.postSpacing} onChange={(event) => commit({ postSpacing: Number(event.target.value) || cover.postSpacing })} />
            </Field>
            <Field label={t('cover.rafter')}>
              <input data-testid="cover-rafter" style={inputStyle} type="number" step="0.05" min="0.25" value={cover.rafterSpacing} onChange={(event) => commit({ rafterSpacing: Number(event.target.value) || cover.rafterSpacing })} />
            </Field>
            <label style={{ display: 'flex', gap: 6, fontSize: 13 }}><input data-testid="cover-lights" type="checkbox" checked={cover.lights} onChange={(event) => commit({ lights: event.target.checked })} />{t('cover.lights')}</label>
            <label style={{ display: 'flex', gap: 6, fontSize: 13 }}><input data-testid="cover-heaters" type="checkbox" checked={cover.heaters} onChange={(event) => commit({ heaters: event.target.checked })} />{t('cover.heaters')}</label>
          </>
        )
      })()}
      {selection.collection === 'wells' && item && (
        <>
          <Field label={t('ground.depth')}>
            <input data-testid="well-depth" style={inputStyle} type="number" min="20" step="1" value={item.depth || 0} onChange={(event) => commit({ depth: Number(event.target.value) || 0 })} />
          </Field>
        </>
      )}
      {selection.collection === 'waste-units' && item?.kind === 'holding' && (
        <>
          <Field label={t('ground.volume')}>
            <input data-testid="holding-volume" style={inputStyle} type="number" min="6" max="10" step="0.5" value={item.volume || 8} onChange={(event) => commit({ volume: Math.min(10, Math.max(6, Number(event.target.value) || 8)) })} />
          </Field>
          <Field label={t('ground.access')}>
            <input data-testid="holding-access" style={inputStyle} value={item.accessNote || ''} onChange={(event) => commit({ accessNote: event.target.value })} />
          </Field>
        </>
      )}
      {selection.collection === 'waste-units' && item?.kind === 'septic' && (
        <Field label={t('ground.chambers')}>
          <select data-testid="septic-chambers" style={inputStyle} value={item.chambers || 3} onChange={(event) => commit({ chambers: Number(event.target.value) || 3 })}>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </Field>
      )}
      {selection.collection === 'waste-units' && item?.kind === 'plant' && (
        <label style={{ display: 'flex', gap: 6, fontSize: 13 }}>
          <input data-testid="plant-pump" type="checkbox" checked={Boolean(item.pump)} onChange={(event) => commit({ pump: event.target.checked })} />
          {t('ground.pump')}
        </label>
      )}
      {['wells', 'waste-units', 'waste-areas', 'loop'].includes(selection.collection) && groundWarnings(plan).filter((warning) => String(warning.subject || '').includes(selection.id)).map((warning) => (
        <div key={`${warning.code}-${warning.subject}`} data-testid="ground-warning" style={{ fontSize: 12, color: warning.level === 'fail' ? '#b91c1c' : '#b45309', marginTop: 6 }}>{warning.text}</div>
      ))}
      {(selection.collection === 'objects' || selection.collection === 'buildings') && (
        <button type="button" style={btn} onClick={() => onCommit(rotateYardItem(plan, selection.collection, selection.id))}>Kierrä 90°</button>
      )}
      {selection.collection !== 'plot' && (
        <button type="button" style={btn} onClick={() => onCommit(duplicateYardItem(plan, selection.collection, selection.id))}>Monista</button>
      )}
      <button type="button" data-testid="yard-delete" style={{ ...btn, color: '#b91c1c' }} onClick={() => onCommit(remove(plan, selection))}>Poista</button>
    </div>
  )
}

export function YardMenuBody({ plan, menu, onCommit, onNavigate }) {
  const selection = { kind: 'yard', collection: menu.collection, id: menu.id }
  return (
    <>
      <button type="button" data-testid="ctx-properties" style={btn} onClick={() => onNavigate('properties')}>Ominaisuudet…</button>
      {(menu.collection === 'objects' || menu.collection === 'buildings') && (
        <button type="button" data-testid="ctx-rotate" style={btn} onClick={() => onCommit(rotateYardItem(plan, menu.collection, menu.id))}>Kierrä</button>
      )}
      {menu.collection !== 'plot' && (
        <button type="button" data-testid="ctx-duplicate" style={btn} onClick={() => { onCommit(duplicateYardItem(plan, menu.collection, menu.id)); onNavigate('close') }}>Monista</button>
      )}
      <button type="button" data-testid="ctx-delete" style={{ ...btn, color: '#b91c1c' }} onClick={() => { onCommit(deleteYardItem(plan, menu.collection, menu.id)); onNavigate('close') }}>Poista</button>
      <span style={{ display: 'none' }}>{ensureYard(plan).north}{selection.kind}</span>
    </>
  )
}
