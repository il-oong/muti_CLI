const os = require('os');
const path = require('path');

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
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function spawn({ id, shell, cwd, env, cols = 80, rows = 24 }, onData, onExit) {
  const shellPath = shell || defaultShell();
  const safeCwd = cwd && require('fs').existsSync(cwd) ? cwd : os.homedir();
  const proc = pty.spawn(shellPath, [], {
    name: 'xterm-color',
    cols,
    rows,
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
  if (s) {
    try { s.resize(Math.max(1, cols | 0), Math.max(1, rows | 0)); } catch (e) { /* ignore */ }
  }
}

function kill(id) {
  const s = sessions.get(id);
  if (s) {
    try { s.kill(); } catch (e) { /* ignore */ }
    sessions.delete(id);
  }
}

function killAll() {
  for (const id of Array.from(sessions.keys())) kill(id);
}

module.exports = { spawn, write, resize, kill, killAll, defaultShell };
