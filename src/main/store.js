'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    projects: [],
    activeProjectId: null,
    window: { width: 1280, height: 800, x: null, y: null, maximized: false },
  };
}

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return defaultState();
  return { ...defaultState(), ...raw, schemaVersion: SCHEMA_VERSION };
}

function backupCorrupt(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const d = new Date();
    const stamp =
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    fs.copyFileSync(filePath, `${filePath}.broken-${stamp}.json`);
  } catch (_) {
    /* best-effort backup; ignore errors */
  }
}

function createStore(filePath, options = {}) {
  const debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 250;
  let cache = null;
  let saveTimer = null;

  function load() {
    if (cache) return cache;
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        cache = migrate(JSON.parse(raw));
      } else {
        cache = defaultState();
      }
    } catch (_) {
      backupCorrupt(filePath);
      cache = defaultState();
    }
    return cache;
  }

  function getState() {
    return load();
  }

  function setState(next) {
    cache = migrate(next);
    scheduleSave();
  }

  function patch(partial) {
    cache = migrate({ ...load(), ...partial });
    scheduleSave();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    if (debounceMs <= 0) {
      flush();
      return;
    }
    saveTimer = setTimeout(flush, debounceMs);
  }

  function flush() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!cache) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  return { getState, setState, patch, flush, filePath };
}

module.exports = { createStore, defaultState, migrate, SCHEMA_VERSION };
