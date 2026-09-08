const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../ui/homeGeometry.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const geometryModule = { exports: {} };
new Function('module', 'exports', compiled)(geometryModule, geometryModule.exports);
const { getHomeGeometry } = geometryModule.exports;

test('two product columns fit narrow, normal and tablet containers exactly', () => {
  for (const width of [280, 320, 360, 390, 432, 600, 800]) {
    const layout = getHomeGeometry(width, 1);
    assert.ok(Math.abs(2 * layout.cardWidth + layout.cardGap + 2 * layout.padding - width) < 0.001);
    assert.ok(layout.cardWidth > 0);
    assert.ok(layout.searchButtonWidth >= 44);
    assert.ok(width - 2 * layout.padding - layout.searchButtonWidth >= 180);
  }
});

test('the golden reference keeps its card and sponsored widths', () => {
  const layout = getHomeGeometry(390, 1);
  assert.equal(layout.cardWidth, 175.5);
  assert.equal(layout.pinnedCardWidth, 113.1);
});

test('resizing recalculates widths, including a resize back to the original size', () => {
  const initial = getHomeGeometry(390, 1);
  assert.ok(getHomeGeometry(800, 1).cardWidth > initial.cardWidth);
  assert.deepEqual(getHomeGeometry(390, 1), initial);
});

test('large system fonts gain vertical search space without changing product composition', () => {
  const normal = getHomeGeometry(390, 1);
  const large = getHomeGeometry(390, 2);
  assert.ok(large.searchHeight >= 60);
  assert.ok(large.searchHeight > normal.searchHeight);
  assert.equal(large.cardWidth, normal.cardWidth);
  assert.equal(large.avatarSize, normal.avatarSize);
});
