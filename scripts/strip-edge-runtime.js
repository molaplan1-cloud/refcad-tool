#!/usr/bin/env node
// One-time cleanup script: remove Edge runtime exports since we're now on Vercel (Node.js).
const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs')
const { join } = require('path')

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, files)
    else if (/\.(jsx?|tsx?)$/.test(name)) files.push(p)
  }
  return files
}

const root = join(__dirname, '..')
const files = walk(join(root, 'app'))
const patterns = [
  /export const runtime = ['"]edge['"]\s*\n/g,
  /export const dynamic = ['"]force-dynamic['"]\s*\n/g,
  /export const config = \{[^}]*runtime:\s*['"](?:experimental-)?edge['"],[^}]*\}\s*\n/g,
]

let n = 0
for (const f of files) {
  let src = readFileSync(f, 'utf8')
  let before = src
  for (const p of patterns) src = src.replace(p, '')
  if (src !== before) {
    writeFileSync(f, src)
    console.log('cleaned', f.replace(root + '\\', ''))
    n++
  }
}
console.log(`\n${n} file(s) cleaned`)
