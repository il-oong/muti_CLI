'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const lay = require('../src/renderer/layout');

function pane(id, extra = {}) {
  return { id, cwd: null, shell: null, ...extra };
}

test('isSplit / isPane discriminate by type field', () => {
  assert.equal(lay.isSplit({ type: 'split' }), true);
  assert.equal(lay.isSplit(pane('p')), false);
  assert.equal(lay.isPane(pane('p')), true);
  assert.equal(lay.isPane(null), false);
});

test('countPanes counts leaves', () => {
  assert.equal(lay.countPanes(pane('a')), 1);
  assert.equal(
    lay.countPanes({ type: 'split', dir: 'h', ratio: 0.5, a: pane('a'), b: pane('b') }),
    2
  );
  const nested = {
    type: 'split',
    dir: 'h',
    ratio: 0.5,
    a: pane('a'),
    b: { type: 'split', dir: 'v', ratio: 0.5, a: pane('b'), b: pane('c') },
  };
  assert.equal(lay.countPanes(nested), 3);
});

test('splitPane wraps target into a Split with ratio 0.5', () => {
  const initial = pane('p1');
  const newPane = pane('p2');
  const { layout, added } = lay.splitPane(initial, 'p1', 'h', newPane);
  assert.equal(added, true);
  assert.equal(lay.isSplit(layout), true);
  assert.equal(layout.dir, 'h');
  assert.equal(layout.ratio, 0.5);
  assert.equal(layout.a.id, 'p1');
  assert.equal(layout.b.id, 'p2');
});

test('splitPane refuses to exceed MAX_PANES', () => {
  let layout = pane('a');
  for (let i = 0; i < lay.MAX_PANES - 1; i++) {
    const r = lay.splitPane(layout, layout.id ? layout.id : null, 'h', pane('x' + i));
    // when layout is split, use the deepest right pane id via listPanes
    if (lay.isSplit(layout)) {
      const target = lay.listPanes(layout)[0].id;
      const r2 = lay.splitPane(layout, target, 'h', pane('x' + i));
      layout = r2.layout;
    } else {
      layout = r.layout;
    }
  }
  assert.equal(lay.countPanes(layout), lay.MAX_PANES);
  const { added } = lay.splitPane(layout, lay.listPanes(layout)[0].id, 'h', pane('extra'));
  assert.equal(added, false);
});

test('removePane drops sibling up when parent only has two leaves', () => {
  const layout = { type: 'split', dir: 'h', ratio: 0.5, a: pane('a'), b: pane('b') };
  const next = lay.removePane(layout, 'b');
  assert.equal(lay.isSplit(next), false);
  assert.equal(next.id, 'a');
});

test('removePane on root pane returns null', () => {
  assert.equal(lay.removePane(pane('only'), 'only'), null);
});

test('removePane in a nested layout preserves structure', () => {
  const layout = {
    type: 'split',
    dir: 'h',
    ratio: 0.5,
    a: pane('a'),
    b: { type: 'split', dir: 'v', ratio: 0.5, a: pane('b'), b: pane('c') },
  };
  const next = lay.removePane(layout, 'c');
  assert.equal(lay.isSplit(next), true);
  assert.equal(next.a.id, 'a');
  assert.equal(next.b.id, 'b');
});

test('clampRatio clamps to [0.1, 0.9]', () => {
  assert.equal(lay.clampRatio(0), 0.1);
  assert.equal(lay.clampRatio(1), 0.9);
  assert.equal(lay.clampRatio(0.5), 0.5);
  assert.equal(lay.clampRatio('bad'), 0.5);
  assert.equal(lay.clampRatio(Number.NaN), 0.5);
});

test('findPane and findParent traverse the tree', () => {
  const layout = {
    type: 'split',
    dir: 'h',
    ratio: 0.5,
    a: pane('a'),
    b: { type: 'split', dir: 'v', ratio: 0.5, a: pane('b'), b: pane('c') },
  };
  assert.equal(lay.findPane(layout, 'c').id, 'c');
  assert.equal(lay.findPane(layout, 'missing'), null);
  const parentOfB = lay.findParent(layout, 'b');
  assert.ok(parentOfB);
  assert.equal(parentOfB.parent.dir, 'v');
  assert.equal(parentOfB.side, 'a');
});
