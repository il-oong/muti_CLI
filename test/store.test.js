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

test('migrate rejects newer schemaVersion', () => {
  assert.throws(() => migrate({ schemaVersion: SCHEMA_VERSION + 1, projects: [] }));
  assert.throws(() => migrate({ schemaVersion: 'not-a-number', projects: [] }));
});

test('newer-version file on disk is backed up and default returned', () => {
  const fp = tmpStatePath();
  fs.writeFileSync(
    fp,
    JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, projects: [{ id: 'future' }] }),
    'utf8'
  );
  const s = createStore(fp);
  const state = s.getState();
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(state.projects, []);
  const backups = fs.readdirSync(path.dirname(fp)).filter((n) => n.includes('.broken-'));
  assert.ok(backups.length >= 1, 'expected backup of future-version file');
});

test('orphan .tmp file recovers when main file is missing', () => {
  const fp = tmpStatePath();
  const tmp = fp + '.tmp';
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    projects: [{ id: 'recovered' }],
    activeProjectId: 'recovered',
    window: { width: 800, height: 600, x: null, y: null, maximized: false },
  };
  fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8');
  assert.equal(fs.existsSync(fp), false);

  const s = createStore(fp);
  const state = s.getState();
  assert.equal(state.projects[0].id, 'recovered');
  assert.equal(fs.existsSync(fp), true);
  assert.equal(fs.existsSync(tmp), false);
});

test('orphan .tmp is removed when main file already exists', () => {
  const fp = tmpStatePath();
  const tmp = fp + '.tmp';
  fs.writeFileSync(
    fp,
    JSON.stringify({ schemaVersion: SCHEMA_VERSION, projects: [{ id: 'main' }] }),
    'utf8'
  );
  fs.writeFileSync(tmp, '{"schemaVersion":1,"projects":[{"id":"stale"}]}', 'utf8');

  const s = createStore(fp);
  const state = s.getState();
  assert.equal(state.projects[0].id, 'main');
  assert.equal(fs.existsSync(tmp), false);
});

test('corrupt .tmp with missing main is discarded, defaults returned', () => {
  const fp = tmpStatePath();
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, 'not valid json {{{', 'utf8');

  const s = createStore(fp);
  const state = s.getState();
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(state.projects, []);
  assert.equal(fs.existsSync(tmp), false);
});

test('periodic flush writes dirty cache even when debounce is long', async () => {
  const fp = tmpStatePath();
  const s = createStore(fp, { debounceMs: 60000, periodicMs: 40 });
  s.setState({
    schemaVersion: SCHEMA_VERSION,
    projects: [{ id: 'periodic' }],
    activeProjectId: 'periodic',
    window: { width: 1, height: 1, x: null, y: null, maximized: false },
  });
  assert.equal(fs.existsSync(fp), false);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(fs.existsSync(fp), true);
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  assert.equal(raw.projects[0].id, 'periodic');
  s.stop();
});

test('stop cancels pending debounce and periodic timers', async () => {
  const fp = tmpStatePath();
  const s = createStore(fp, { debounceMs: 50, periodicMs: 50 });
  s.setState({
    schemaVersion: SCHEMA_VERSION,
    projects: [{ id: 'pending' }],
    activeProjectId: null,
    window: { width: 1, height: 1, x: null, y: null, maximized: false },
  });
  s.stop();
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(fs.existsSync(fp), false);
});
