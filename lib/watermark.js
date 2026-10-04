import { DEMO_WATERMARK } from './access.js'

export function stampDemoWatermark(doc) {
  if (!doc?.getNumberOfPages) return doc
  const total = doc.getNumberOfPages()
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page)
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    doc.saveGraphicsState()
    if (doc.GState && doc.setGState) doc.setGState(new doc.GState({ opacity: 0.26 }))
    doc.setTextColor(146, 84, 84)
    doc.setFont('helvetica', 'bold')
    const angle = 32
    const rad = (angle * Math.PI) / 180
    let size = 36
    doc.setFontSize(size)
    const measured = doc.getTextWidth(DEMO_WATERMARK) || 1
    const margin = 16
    const fitW = ((width - margin * 2) / Math.cos(rad)) * 0.9
    const fitH = ((height - margin * 2) / Math.sin(rad)) * 0.9
    size = Math.max(28, Math.min(68, size * (Math.min(fitW, fitH) / measured)))
    doc.setFontSize(size)
    doc.text(DEMO_WATERMARK, width / 2, height / 2, {
      angle,
      align: 'center',
      baseline: 'middle',
    })
    doc.restoreGraphicsState()
  }
  return doc
}
