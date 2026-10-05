import { DEMO_WATERMARK } from './access.js'

export function stampDemoWatermark(doc, text = DEMO_WATERMARK) {
  const label = text || DEMO_WATERMARK
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
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const margin = 18
    doc.setFontSize(10)
    const perPoint = (doc.getTextWidth(label) || 1) / 10
    const fontMm = 0.36
    let size = 12
    while (size < 72) {
      const textW = perPoint * (size + 1)
      const textH = fontMm * (size + 1)
      const halfW = (textW / 2) * Math.abs(cos) + (textH / 2) * Math.abs(sin)
      const halfH = (textW / 2) * Math.abs(sin) + (textH / 2) * Math.abs(cos)
      if (halfW > width / 2 - margin || halfH > height / 2 - margin) break
      size += 1
    }
    doc.setFontSize(size)
    const textW = doc.getTextWidth(label)
    const cx = width / 2
    const cy = height / 2 + size * 0.15
    // jsPDF rotates around the left end of the baseline. Positive angles climb the page.
    doc.text(label, cx - (textW / 2) * cos, cy + (textW / 2) * sin, { angle })
    doc.restoreGraphicsState()
  }
  return doc
}
