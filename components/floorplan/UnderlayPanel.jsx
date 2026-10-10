'use client'

import { useEffect, useState } from 'react'

const btn = {
  height: 30,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid #d6d3d1',
  background: '#fff',
  color: '#1c1917',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const field = {
  width: '100%',
  height: 30,
  borderRadius: 6,
  border: '1px solid #d6d3d1',
  padding: '0 8px',
  fontSize: 13,
}

export function UnderlayPanel({
  t, underlay, pick, distance, onDistance, onOpacity, onLock, onRotate, onAngle,
  onCalibrate, onApplyDistance, onPdfScale, onDeskew, onSnap, onPdf, onDetect,
  onAcceptAll, onAcceptSelected, onReject, onToggle, onRemove,
}) {
  if (!underlay?.image) return null
  const suggestions = underlay.suggestions || []
  const note = underlay.confidence === 'photo' ? t('underlay.photo') : t('underlay.cad')
  return (
    <div data-testid="underlay-panel" style={{ margin: '8px 4px 0', padding: 8, border: '1px solid #e7e5e4', borderRadius: 8, background: '#fff' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#0f766e', marginBottom: 6 }}>{t('underlay.layer')}</div>
      <div style={{ fontSize: 11, color: '#57534e', marginBottom: 8, lineHeight: 1.4 }}>{underlay.name}{underlay.pageCount > 1 ? ` · ${t('underlay.pageOf', { page: underlay.page || 1, count: underlay.pageCount })}` : ''}</div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        {t('underlay.opacity')}
        <input data-testid="underlay-opacity" type="range" min="0.15" max="1" step="0.05" value={underlay.opacity} onChange={(event) => onOpacity(Number(event.target.value))} style={{ width: '100%' }} />
      </label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        <button type="button" data-testid="underlay-lock" style={btn} onClick={() => onLock(!underlay.locked)}>{underlay.locked ? t('underlay.unlock') : t('underlay.lock')}</button>
        <button type="button" data-testid="underlay-rotate-left" style={btn} disabled={underlay.locked} onClick={() => onRotate(-90)}>{t('underlay.rotateLeft')}</button>
        <button type="button" data-testid="underlay-rotate-right" style={btn} disabled={underlay.locked} onClick={() => onRotate(90)}>{t('underlay.rotateRight')}</button>
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        {t('underlay.angle')}
        <input data-testid="underlay-angle" style={field} type="number" step="0.1" disabled={underlay.locked} value={underlay.rotation || 0} onChange={(event) => onAngle(event.target.value)} />
      </label>
      <button type="button" data-testid="underlay-calibrate" style={{ ...btn, width: '100%', marginBottom: 6 }} onClick={onCalibrate}>{t('underlay.calibrate')}</button>
      {pick?.mode === 'calibrate' && (
        <div style={{ fontSize: 11, color: '#57534e', marginBottom: 6 }}>{t('underlay.calibrateHint')}</div>
      )}
      {pick?.mode === 'calibrate' && pick.points?.length >= 2 && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
          {t('underlay.distance')}
          <span style={{ display: 'flex', gap: 4 }}>
            <input data-testid="underlay-distance" style={{ ...field, flex: 1 }} inputMode="decimal" value={distance} onChange={(event) => onDistance(event.target.value)} />
            <button type="button" data-testid="underlay-apply-distance" style={btn} onClick={onApplyDistance}>{t('underlay.apply')}</button>
          </span>
        </label>
      )}
      {underlay.source === 'pdf' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <label style={{ flex: 1, fontSize: 12, fontWeight: 650 }}>
            {t('underlay.pdfScale')}
            <select data-testid="underlay-ratio" style={field} value={String(underlay.ratio || 50)} onChange={(event) => onPdfScale(Number(event.target.value), underlay.dpi || 72)}>
              <option value="50">1:50</option>
              <option value="100">1:100</option>
            </select>
          </label>
          <DpiField t={t} dpi={underlay.dpi || 72} ratio={underlay.ratio || 50} onPdfScale={onPdfScale} />
        </div>
      )}
      <button type="button" data-testid="underlay-deskew" style={{ ...btn, width: '100%', marginBottom: 6 }} onClick={onDeskew}>{t('underlay.deskew')}</button>
      {pick?.mode === 'deskew' && <div style={{ fontSize: 11, color: '#57534e', marginBottom: 6 }}>{t('underlay.deskewHint')}</div>}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, marginBottom: 6 }}>
        <input data-testid="underlay-snap" type="checkbox" checked={Boolean(underlay.snapLines)} onChange={(event) => onSnap(event.target.checked)} />
        {t('underlay.snap')}
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
        <input data-testid="underlay-pdf" type="checkbox" checked={Boolean(underlay.includeInPdf)} onChange={(event) => onPdf(event.target.checked)} />
        {t('underlay.pdfInclude')}
      </label>
      <p data-testid="underlay-note" style={{ margin: '0 0 8px', fontSize: 11, lineHeight: 1.4, color: underlay.confidence === 'photo' ? '#9a3412' : '#57534e' }}>{note}</p>
      <button type="button" data-testid="underlay-detect" style={{ ...btn, width: '100%', background: '#0f766e', color: '#fff', border: 'none', marginBottom: 6 }} onClick={onDetect}>{t('underlay.detect')}</button>
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          <button type="button" data-testid="underlay-accept-all" style={btn} onClick={onAcceptAll}>{t('underlay.acceptAll')}</button>
          <button type="button" data-testid="underlay-accept-selected" style={btn} onClick={onAcceptSelected}>{t('underlay.acceptSelected')}</button>
          <button type="button" data-testid="underlay-reject" style={btn} onClick={onReject}>{t('underlay.reject')}</button>
        </div>
      )}
      {suggestions.map((item) => (
        <label key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, marginBottom: 3 }}>
          <input type="checkbox" checked={item.selected !== false} onChange={() => onToggle(item.id)} />
          <span>{item.kind === 'opening' ? t(item.guess === 'window' ? 'opening.window' : 'opening.door') : `${Math.round((item.thickness || 0) * 1000)} mm`}</span>
        </label>
      ))}
      <button type="button" data-testid="underlay-remove" style={{ ...btn, width: '100%', marginTop: 8 }} onClick={onRemove}>{t('underlay.remove')}</button>
    </div>
  )
}

function DpiField({ t, dpi, ratio, onPdfScale }) {
  const [text, setText] = useState(String(dpi))
  useEffect(() => setText(String(dpi)), [dpi])
  return (
    <label style={{ width: 72, fontSize: 12, fontWeight: 650 }}>
      {t('underlay.dpi')}
      <input
        data-testid="underlay-dpi"
        style={field}
        inputMode="decimal"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const next = Number(String(text).replace(',', '.'))
          if (next >= 36 && next <= 600) onPdfScale(ratio, next)
          else setText(String(dpi))
        }}
      />
    </label>
  )
}

export function PdfPageDialog({ t, page, count, onPage, onUse, onClose }) {
  return (
    <div data-testid="underlay-pages" style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
      <div style={{ width: 320, background: '#fff', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{t('underlay.import')}</div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 650 }}>
          {t('underlay.pageOf', { page, count })}
          <input data-testid="underlay-page" style={{ ...field, marginTop: 4 }} type="number" min="1" max={count} value={page} onChange={(event) => onPage(Number(event.target.value) || 1)} />
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" data-testid="underlay-use-page" style={{ ...btn, background: '#0f766e', color: '#fff', border: 'none' }} onClick={onUse}>{t('underlay.usePage')}</button>
          <button type="button" data-testid="underlay-page-cancel" style={btn} onClick={onClose}>{t('projects.cancel')}</button>
        </div>
      </div>
    </div>
  )
}
