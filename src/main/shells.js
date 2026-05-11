'use strict';

const fs = require('fs');
const path = require('path');

function existing(p) {
  try {
    return p && fs.existsSync(p) ? p : null;
  } catch (_) {
    return null;
  }
}

function listShells() {
  if (process.platform === 'win32') {
    const sysroot = process.env.SystemRoot || 'C:\\Windows';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

    const cmdPath =
      existing(process.env.COMSPEC) || existing(path.join(sysroot, 'System32', 'cmd.exe'));

    const pwsh7 = existing(path.join(programFiles, 'PowerShell', '7', 'pwsh.exe'));
    const ps5 = existing(
      path.join(sysroot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    );
    const psPath = pwsh7 || ps5;

    const wslPath = existing(path.join(sysroot, 'System32', 'wsl.exe'));

    return [
      {
        id: 'cmd',
        label: 'Command Prompt (cmd)',
        path: cmdPath,
        available: !!cmdPath,
      },
      {
        id: 'powershell',
        label: pwsh7 ? 'PowerShell 7 (pwsh)' : 'Windows PowerShell',
        path: psPath,
        available: !!psPath,
      },
      {
        id: 'wsl',
        label: wslPath ? 'WSL' : 'WSL (설치되지 않음)',
        path: wslPath,
        available: !!wslPath,
      },
    ];
  }

  const sh = process.env.SHELL || '/bin/bash';
  const zsh = existing('/bin/zsh') || existing('/usr/bin/zsh');
  const bash = existing('/bin/bash') || existing('/usr/bin/bash');
  const list = [
    {
      id: 'default',
      label: `Default shell (${path.basename(sh)})`,
      path: existing(sh) || sh,
      available: true,
    },
  ];
  if (bash && bash !== sh) list.push({ id: 'bash', label: 'Bash', path: bash, available: true });
  if (zsh && zsh !== sh) list.push({ id: 'zsh', label: 'Zsh', path: zsh, available: true });
  return list;
}

function resolveShell(id) {
  if (!id) return null;
  const found = listShells().find((s) => s.id === id && s.available);
  return found && found.path ? found.path : null;
}

function defaultShellId() {
  const list = listShells();
  const first = list.find((s) => s.available);
  return first ? first.id : null;
}

module.exports = { listShells, resolveShell, defaultShellId };
