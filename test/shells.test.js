'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const shells = require('../src/main/shells');

test('listShells returns at least one entry', () => {
  const list = shells.listShells();
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 1);
});

test('listShells entries have required shape', () => {
  for (const s of shells.listShells()) {
    assert.equal(typeof s.id, 'string');
    assert.equal(typeof s.label, 'string');
    assert.equal(typeof s.available, 'boolean');
    if (s.available) assert.equal(typeof s.path, 'string');
  }
});

test('defaultShellId picks an available shell', () => {
  const id = shells.defaultShellId();
  if (id == null) return;
  const list = shells.listShells();
  const match = list.find((s) => s.id === id);
  assert.ok(match && match.available, 'defaultShellId must be in available list');
});

test('resolveShell returns null for unknown id', () => {
  assert.equal(shells.resolveShell('does-not-exist-shell-id'), null);
  assert.equal(shells.resolveShell(null), null);
  assert.equal(shells.resolveShell(undefined), null);
});

test('resolveShell returns a path for an available shell', () => {
  const list = shells.listShells();
  const first = list.find((s) => s.available);
  if (!first) return;
  const p = shells.resolveShell(first.id);
  assert.equal(typeof p, 'string');
  assert.ok(p.length > 0);
});

test('listShells on Windows includes cmd, powershell, wsl ids', () => {
  if (process.platform !== 'win32') return;
  const ids = shells.listShells().map((s) => s.id);
  for (const id of ['cmd', 'powershell', 'wsl']) {
    assert.ok(ids.includes(id), `expected ${id} in Windows shell list`);
  }
});
