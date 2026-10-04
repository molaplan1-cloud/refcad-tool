import { DEMO_WATERMARK } from './access.js'

export function stampDemoWatermark(doc) {
  if (!doc?.getNumberOfPages) return doc
  const total = doc.getNumberOfPages()
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page)
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    doc.saveGraphicsState()
    if (doc.GState && doc.setGState) doc.setGState(new doc.GState({ opacity: 0.42 }))
    doc.setTextColor(153, 27, 27)
    doc.setFont('helvetica', 'bold')
    const size = Math.max(18, Math.min(width, height) / 16)
    doc.setFontSize(size)
    const step = height * 0.28
    for (let row = 0; row < 3; row += 1) {
      doc.text(DEMO_WATERMARK, width * 0.04, height * 0.22 + row * step, { angle: 32 })
    }
    doc.restoreGraphicsState()
  }
  return doc
}
