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
    doc.setFontSize(Math.max(16, Math.min(width, height) / 14))
    doc.text(DEMO_WATERMARK, width * 0.06, height * 0.78, { angle: 32 })
    doc.text(DEMO_WATERMARK, width * 0.2, height * 0.4, { angle: 32 })
    doc.restoreGraphicsState()
  }
  return doc
}
