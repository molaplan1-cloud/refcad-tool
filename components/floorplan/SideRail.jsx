'use client'

export function SideRail({
  side,
  collapsed = false,
  onToggle,
  compact = false,
  open = false,
  testId,
  className,
  width = 260,
  pad = '10px 10px 18px',
  collapseLabel,
  expandLabel,
  children,
}) {
  if (compact) {
    return (
      <aside data-testid={testId} className={className} data-open={open ? 'true' : 'false'}>
        {children}
      </aside>
    )
  }
  const glyph = side === 'left' ? (collapsed ? '\u203a' : '\u2039') : (collapsed ? '\u2039' : '\u203a')
  const button = (
    <button
      type="button"
      data-testid={side === 'left' ? 'collapse-left' : 'collapse-right'}
      aria-expanded={collapsed ? 'false' : 'true'}
      aria-label={collapsed ? expandLabel : collapseLabel}
      onClick={onToggle}
      style={{
        width: 28,
        flex: '0 0 28px',
        alignSelf: 'stretch',
        border: 'none',
        background: collapsed ? '#fafaf9' : '#f5f5f4',
        color: '#44403c',
        cursor: 'pointer',
        fontSize: 18,
        lineHeight: 1,
      }}
    >
      {glyph}
    </button>
  )
  return (
    <div
      data-testid={testId}
      className={className}
      data-collapsed={collapsed ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexShrink: 0,
        width: collapsed ? 28 : width,
        minHeight: 0,
        background: '#fafaf9',
        borderRight: side === 'left' ? '1px solid #d6d3d1' : 'none',
        borderLeft: side === 'right' ? '1px solid #d6d3d1' : 'none',
      }}
    >
      {side === 'right' && button}
      {!collapsed && (
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: pad }}>
          {children}
        </div>
      )}
      {side === 'left' && button}
    </div>
  )
}
