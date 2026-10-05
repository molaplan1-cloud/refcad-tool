export function viewportKind(width) {
  const value = Number(width)
  if (!Number.isFinite(value) || value <= 0) return 'desktop'
  if (value < 768) return 'phone'
  if (value < 1100) return 'tablet'
  return 'desktop'
}

export function isCompactViewport(width) {
  const kind = viewportKind(width)
  return kind === 'phone' || kind === 'tablet'
}
