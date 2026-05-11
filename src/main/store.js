const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STATE_FILE = path.join(app.getPath('userData'), 'state.json');

const defaultState = {
  projects: [],
  activeProjectId: null,
  window: { width: 1280, height: 800, x: null, y: null, maximized: false },
};

let cache = null;
let saveTimer = null;

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      cache = { ...defaultState, ...JSON.parse(raw) };
    } else {
      cache = { ...defaultState };
    }
  } catch (e) {
    console.error('[store] failed to load state, using defaults', e);
    cache = { ...defaultState };
  }
  return cache;
}

function getState() {
  return load();
}

function setState(next) {
  cache = next;
  scheduleSave();
}

function patch(partial) {
  cache = { ...load(), ...partial };
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

function flush() {
  if (!cache) return;
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) {
    console.error('[store] failed to save state', e);
  }
}

module.exports = { getState, setState, patch, flush, STATE_FILE };
