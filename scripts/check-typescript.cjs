const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const result = spawnSync(process.execPath, [
  require.resolve('typescript/bin/tsc'), '--noEmit', '--pretty', 'false',
], { cwd: root, encoding: 'utf8' });
const expected = fs.readFileSync(path.join(root, 'tests/typescript-baseline.txt'), 'utf8').trim();
const actual = result.stdout.trim();
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/typescript.txt'), result.stdout + result.stderr);
if (result.error || result.signal || result.status === null || actual !== expected) {
  console.error(result.error || result.signal || result.stdout + result.stderr);
  console.error('TypeScript diagnostics differ from the unchanged golden baseline.');
  process.exit(1);
}
console.log(`No new TypeScript errors; ${(actual.match(/error TS\d+/g) || []).length} existing diagnostics retained.`);
