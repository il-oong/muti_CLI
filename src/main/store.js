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
  const v = raw.schemaVersion;
  if (v == null) {
    return { ...defaultState(), ...raw, schemaVersion: SCHEMA_VERSION };
  }
  if (typeof v !== 'number' || v > SCHEMA_VERSION) {
    throw new Error(`unsupported state schemaVersion: ${v}`);
  }
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

function recoverFromTmp(filePath) {
  const tmp = `${filePath}.tmp`;
  let tmpExists = false;
  try {
    tmpExists = fs.existsSync(tmp);
  } catch (_) {
    return;
  }
  if (!tmpExists) return;

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {
      /* ignore */
    }
    return;
  }

  try {
    const raw = fs.readFileSync(tmp, 'utf8');
    JSON.parse(raw);
    fs.renameSync(tmp, filePath);
  } catch (_) {
    try {
      fs.unlinkSync(tmp);
    } catch (__) {
      /* ignore */
    }
  }
}

function createStore(filePath, options = {}) {
  const debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 250;
  const periodicMs = typeof options.periodicMs === 'number' ? options.periodicMs : 5000;
  let cache = null;
  let saveTimer = null;
  let periodicTimer = null;
  let dirty = false;

  function load() {
    if (cache) return cache;
    recoverFromTmp(filePath);
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

  if (periodicMs > 0) {
    periodicTimer = setInterval(() => {
      if (dirty) flush();
    }, periodicMs);
    if (typeof periodicTimer.unref === 'function') periodicTimer.unref();
  }

  function getState() {
    return load();
  }

  function setState(next) {
    cache = migrate(next);
    dirty = true;
    scheduleSave();
  }

  function patch(partial) {
    cache = migrate({ ...load(), ...partial });
    dirty = true;
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
    dirty = false;
  }

  function stop() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (periodicTimer) {
      clearInterval(periodicTimer);
      periodicTimer = null;
    }
  }

  return { getState, setState, patch, flush, stop, filePath };
}

module.exports = { createStore, defaultState, migrate, SCHEMA_VERSION, recoverFromTmp };
