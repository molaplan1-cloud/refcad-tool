'use client'

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
