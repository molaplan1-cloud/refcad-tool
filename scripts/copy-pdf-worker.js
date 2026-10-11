const { copyFileSync, mkdirSync } = require('fs')
const { dirname, join } = require('path')

const from = join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const to = join(__dirname, '..', 'public', 'pdf.worker.min.mjs')
mkdirSync(dirname(to), { recursive: true })
copyFileSync(from, to)
