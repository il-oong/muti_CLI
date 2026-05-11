'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createStore, defaultState, migrate, SCHEMA_VERSION } = require('../src/main/store');

function tmpStatePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muti-store-'));
  return path.join(dir, 'state.json');
}

test('defaultState has schemaVersion and empty projects', () => {
  const d = defaultState();
  assert.equal(d.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(d.projects, []);
  assert.equal(d.activeProjectId, null);
  assert.equal(typeof d.window.width, 'number');
});

test('migrate fills missing fields and pins schemaVersion', () => {
  const m = migrate({ projects: [{ id: 'x' }] });
  assert.equal(m.schemaVersion, SCHEMA_VERSION);
  assert.equal(m.activeProjectId, null);
  assert.equal(m.projects.length, 1);
  assert.ok(m.window);
});

test('migrate(null) returns default', () => {
  assert.deepEqual(migrate(null), defaultState());
});

test('getState returns default when file is missing', () => {
  const s = createStore(tmpStatePath());
  const state = s.getState();
  assert.deepEqual(state.projects, []);
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
});

test('setState + flush writes atomically', () => {
  const fp = tmpStatePath();
  const s = createStore(fp, { debounceMs: 0 });
  s.setState({
    schemaVersion: SCHEMA_VERSION,
    projects: [{ id: 'a' }],
    activeProjectId: 'a',
    window: { width: 100, height: 200, x: null, y: null, maximized: false },
  });
  s.flush();
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  assert.equal(raw.projects[0].id, 'a');
  assert.equal(raw.activeProjectId, 'a');
  assert.equal(raw.schemaVersion, SCHEMA_VERSION);
  assert.equal(fs.existsSync(`${fp}.tmp`), false);
});

test('patch merges into current state', () => {
  const fp = tmpStatePath();
  const s = createStore(fp, { debounceMs: 0 });
  s.patch({ activeProjectId: 'p1' });
  s.flush();
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  assert.equal(raw.activeProjectId, 'p1');
  assert.deepEqual(raw.projects, []);
});

test('corrupt file is backed up and default returned', () => {
  const fp = tmpStatePath();
  fs.writeFileSync(fp, 'this is not json{{{', 'utf8');
  const s = createStore(fp);
  const state = s.getState();
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  const dir = path.dirname(fp);
  const backups = fs.readdirSync(dir).filter((n) => n.includes('.broken-'));
  assert.ok(backups.length >= 1, 'expected at least one .broken-* backup');
});
