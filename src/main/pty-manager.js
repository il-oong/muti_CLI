'use strict';

const fs = require('fs');
const os = require('os');

let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.error('[pty-manager] node-pty failed to load. Did you run `npm install`?', e);
  throw e;
}

const sessions = new Map();

function defaultShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function resolveCwd(cwd) {
  if (cwd && typeof cwd === 'string' && fs.existsSync(cwd)) return cwd;
  return os.homedir();
}

function spawn(opts, onData, onExit) {
  const { id, shell, cwd, env, cols, rows } = opts;
  const shellPath = shell || defaultShell();
  const safeCwd = resolveCwd(cwd);
  const proc = pty.spawn(shellPath, [], {
    name: 'xterm-color',
    cols: Math.max(1, cols | 0) || 80,
    rows: Math.max(1, rows | 0) || 24,
    cwd: safeCwd,
    env: { ...process.env, ...(env || {}) },
  });

  proc.onData((data) => onData(data));
  proc.onExit(({ exitCode, signal }) => {
    sessions.delete(id);
    onExit({ exitCode, signal });
  });

  sessions.set(id, proc);
  return { pid: proc.pid, shell: shellPath, cwd: safeCwd };
}

function write(id, data) {
  const s = sessions.get(id);
  if (s) s.write(data);
}

function resize(id, cols, rows) {
  const s = sessions.get(id);
  if (!s) return;
  try {
    s.resize(Math.max(1, cols | 0), Math.max(1, rows | 0));
  } catch (_) {
    /* node-pty throws if pty is already dead; ignore */
  }
}

function kill(id) {
  const s = sessions.get(id);
  if (!s) return;
  try {
    s.kill();
  } catch (_) {
    /* ignore */
  }
  sessions.delete(id);
}

function killAll() {
  for (const id of Array.from(sessions.keys())) kill(id);
}

module.exports = { spawn, write, resize, kill, killAll, defaultShell };
