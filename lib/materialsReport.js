import { jsPDF } from 'jspdf'
import { pdfAscii } from './i18n.js'

function cell(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function materialsCsv(rows) {
  const lines = [['group', 'name', 'room', 'quantity', 'unit', 'code'].join(',')]
  ;(rows || []).forEach((row) => {
    lines.push([row.group, row.name, row.room, row.quantity, row.unit, row.code].map(cell).join(','))
  })
  return `${lines.join('\n')}\n`
}

export function buildMaterialsPdf(title, rows) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(pdfAscii(title || 'Materials'), 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let y = 28
  ;(rows || []).forEach((row) => {
    if (y > pageH - 16) {
      doc.addPage()
      y = 18
    }
    const line = pdfAscii(`${row.name}    ${row.quantity} ${row.unit}`)
    doc.text(line, 14, y)
    y += 6
  })
  if (!(rows || []).length) doc.text(pdfAscii('-'), 14, 28)
  return doc
}
