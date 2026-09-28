// Replace proj() with localProj() inside IsometricView3D function (lines 701-851)
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'app', 'projects', '[id]', 'DesignerClient.jsx')
const lines = fs.readFileSync(file, 'utf8').split('\n')

// Lines are 1-indexed in error messages; array is 0-indexed.
// IsometricView3D starts at line 701, ends at line 851 (before exportToPDF at 852).
const startIdx = 700  // 0-indexed = line 701
const endIdx = 850    // inclusive
let count = 0
for (let i = startIdx; i <= endIdx; i++) {
  const orig = lines[i]
  const updated = orig.replace(/\bproj\(/g, () => { count++; return 'localProj(' })
  lines[i] = updated
}

fs.writeFileSync(file, lines.join('\n'))
console.log(`Replaced ${count} occurrences of proj( → localProj( in IsometricView3D`)
