#!/usr/bin/env node
/**
 * Pre-build lockfile validator.
 *
 * Run as `prebuild` script before `next build`. Exits non-zero if:
 *   - package-lock.json is missing
 *   - package.json and package-lock.json are out of sync
 *   - the lockfile was generated with a different npm version (best effort)
 *
 * Usage:  node scripts/check-lockfile.js
 * Hooked: prebuild in package.json scripts
 */

const { existsSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const projectRoot = join(__dirname, '..');
const lockfilePath = join(projectRoot, 'package-lock.json');

function fail(msg) {
  console.error(`\u274c  ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`\u2705  ${msg}`);
}

// 1. Check lockfile exists
if (!existsSync(lockfilePath)) {
  fail(
    'package-lock.json is missing.\n' +
    '   Run `npm install --legacy-peer-deps` locally and commit the lockfile.'
  );
}
ok('package-lock.json exists');

// 2. Verify lockfile is in sync with package.json using `npm ci --dry-run`
console.log('Validating lockfile against package.json (npm ci --dry-run)...');
try {
  execSync('npm ci --dry-run --legacy-peer-deps --no-audit --no-fund', {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  ok('package-lock.json is in sync with package.json');
} catch (err) {
  const stderr = (err.stderr ? err.stderr.toString() : '') + (err.stdout ? err.stdout.toString() : '');
  fail(
    'package-lock.json is OUT OF SYNC with package.json.\n' +
    '   `npm ci --dry-run` reported a mismatch.\n\n' +
    '   Fix:\n' +
    '     1. rm -rf node_modules package-lock.json\n' +
    '     2. npm install --legacy-peer-deps\n' +
    '     3. git add package-lock.json && git commit -m "chore: regenerate lockfile"\n\n' +
    '   npm output (last 20 lines):\n' +
    stderr.split('\n').slice(-20).map((l) => '     ' + l).join('\n')
  );
}

// 3. Best-effort: ensure lockfileVersion is 3 (npm 7+)
try {
  const lock = JSON.parse(require('fs').readFileSync(lockfilePath, 'utf8'));
  const v = lock.lockfileVersion;
  if (v !== 3) {
    console.warn(`\u26a0\ufe0f  lockfileVersion is ${v}, expected 3. Consider regenerating with npm 7+.`);
  } else {
    ok('lockfileVersion is 3 (npm 7+ format)');
  }
} catch {
  // ignore parse errors — the dry-run check above already covered correctness
}

console.log('\n\u2728  Lockfile validation passed. Safe to build.\n');
