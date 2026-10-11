'use client'

export function MaterialsDialog({ title, empty, closeLabel, csvLabel, pdfLabel, rows, onClose, onCsv, onPdf }) {
  return (
    <div
      data-testid="materials-dialog"
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(28,25,23,0.35)', display: 'grid', placeItems: 'center', padding: 16 }}
      onPointerDown={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        onPointerDown={(event) => event.stopPropagation()}
        style={{ width: 'min(680px, 100%)', maxHeight: '82vh', overflow: 'auto', background: '#fff', color: '#1c1917', borderRadius: 12, padding: 16, boxShadow: '0 18px 48px rgba(28,25,23,0.24)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0, flex: 1 }}>{title}</h2>
          <button type="button" data-testid="materials-csv" onClick={onCsv} style={action}>{csvLabel}</button>
          <button type="button" data-testid="materials-pdf" onClick={onPdf} style={action}>{pdfLabel}</button>
          <button type="button" data-testid="materials-close" onClick={onClose} style={action}>{closeLabel}</button>
        </div>
        {rows.length === 0 && <div style={{ fontSize: 13, color: '#78716c' }}>{empty}</div>}
        {rows.map((row) => (
          <div key={`${row.group}-${row.name}-${row.room}`} data-testid="materials-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 13, lineHeight: 1.35 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: row.color || '#e7e5e4', border: '1px solid #a8a29e', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{row.name}</span>
            <span style={{ color: '#78716c' }}>{row.quantity} {row.unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const action = {
  height: 32,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid #d6d3d1',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 12,
}
