export function modeChipText({ name, repeat = false, drawing = false, workspace = '' }) {
  const head = workspace ? `${workspace} › ` : ''
  if (!name) return `${head}Valitse`
  const bits = [`${drawing ? 'Piirrä' : 'Lisää'}: ${name}`]
  if (repeat) bits.push('Toista')
  bits.push('Esc lopettaa')
  return head + bits.join(' — ')
}

export function ModeChip({ name, repeat = false, drawing = false, workspace = '' }) {
  const label = modeChipText({ name, repeat, drawing, workspace })
  const select = !name
  return (
    <div
      data-testid="mode-chip"
      data-mode={select ? 'select' : drawing ? 'draw' : 'place'}
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 8,
        pointerEvents: 'none',
        padding: '6px 12px',
        borderRadius: 999,
        background: select ? '#1c1917' : '#9a3412',
        color: '#fff7ed',
        fontSize: 13,
        fontWeight: 750,
        letterSpacing: 0.1,
        boxShadow: '0 8px 18px rgba(28,25,23,0.22)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  )
}

export function PlaceToast({ text }) {
  if (!text) return null
  return (
    <div
      data-testid="place-toast"
      role="status"
      style={{
        position: 'absolute',
        top: 52,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9,
        pointerEvents: 'none',
        padding: '8px 14px',
        borderRadius: 10,
        background: '#fff7ed',
        color: '#9a3412',
        border: '1px solid #fdba74',
        fontWeight: 750,
        fontSize: 13,
        boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  )
}

export function placeFrame(active) {
  if (!active) return {}
  return { boxShadow: 'inset 0 0 0 3px #ea580c' }
}
