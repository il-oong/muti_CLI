'use strict';

const api = window.api;
const ui = window.ui;
const { Terminal } = window;
const FitAddon = window.FitAddon && window.FitAddon.FitAddon;

const els = {
  projectList: document.getElementById('projectList'),
  addProjectBtn: document.getElementById('addProjectBtn'),
  emptyState: document.getElementById('emptyState'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),
  projectArea: document.getElementById('projectArea'),
  tabList: document.getElementById('tabList'),
  addTabBtn: document.getElementById('addTabBtn'),
  terminals: document.getElementById('terminals'),
  noTabs: document.getElementById('noTabs'),
  addFirstTabBtn: document.getElementById('addFirstTabBtn'),
  shellPicker: document.getElementById('shellPicker'),
  shellPickerBtn: document.getElementById('shellPickerBtn'),
  shellPickerText: document.getElementById('shellPickerText'),
  shellMenu: document.getElementById('shellMenu'),
};

const state = {
  projects: [],
  activeProjectId: null,
};

const liveTerms = new Map();
let availableShells = [];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function snapshot() {
  return {
    projects: state.projects,
    activeProjectId: state.activeProjectId,
  };
}

function save() {
  api.state.set(snapshot()).catch((e) => console.error('state save failed', e));
}

function findProject(id) {
  return state.projects.find((p) => p.id === id) || null;
}

function activeProject() {
  return findProject(state.activeProjectId);
}

function activeTab(project) {
  if (!project) return null;
  return project.tabs.find((t) => t.id === project.activeTabId) || project.tabs[0] || null;
}

function render() {
  renderProjects();
  renderProjectArea();
  renderShellPicker();
}

function firstAvailableShellId() {
  const s = availableShells.find((x) => x.available);
  return s ? s.id : null;
}

function shellLabel(id) {
  const s = availableShells.find((x) => x.id === id);
  return s ? s.label : id || '—';
}

function renderShellPicker() {
  const proj = activeProject();
  if (!proj || availableShells.length === 0) {
    els.shellPicker.hidden = true;
    els.shellMenu.hidden = true;
    return;
  }
  els.shellPicker.hidden = false;
  els.shellPickerText.textContent = shellLabel(proj.defaultShell);
}

function toggleShellMenu(force) {
  const proj = activeProject();
  if (!proj) return;
  const next = typeof force === 'boolean' ? force : els.shellMenu.hidden;
  if (!next) {
    els.shellMenu.hidden = true;
    return;
  }
  els.shellMenu.innerHTML = '';
  for (const s of availableShells) {
    const item = document.createElement('div');
    item.className = 'shell-menu-item';
    item.textContent = s.label;
    if (!s.available) item.classList.add('disabled');
    if (s.id === proj.defaultShell) item.classList.add('active');
    if (s.available) {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setProjectDefaultShell(s.id);
        toggleShellMenu(false);
      });
    } else {
      item.addEventListener('click', (e) => e.stopPropagation());
    }
    els.shellMenu.appendChild(item);
  }
  els.shellMenu.hidden = false;
}

function setProjectDefaultShell(shellId) {
  const proj = activeProject();
  if (!proj) return;
  if (proj.defaultShell === shellId) return;
  proj.defaultShell = shellId;
  save();
  renderShellPicker();
}

function renderProjects() {
  els.projectList.innerHTML = '';
  for (const p of state.projects) {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    if (p.id === state.activeProjectId) li.classList.add('active');

    const name = document.createElement('div');
    name.className = 'pname';
    name.textContent = p.name;

    const folder = document.createElement('div');
    folder.className = 'ppath';
    folder.textContent = p.folder || '(폴더 미지정)';
    folder.title = p.folder || '';

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.textContent = '이름변경';
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renameProject(p.id);
    });

    const folderBtn = document.createElement('button');
    folderBtn.type = 'button';
    folderBtn.textContent = '폴더';
    folderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      changeProjectFolder(p.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'danger';
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProject(p.id);
    });

    actions.append(renameBtn, folderBtn, deleteBtn);
    li.append(name, folder, actions);
    li.addEventListener('click', () => selectProject(p.id));
    els.projectList.appendChild(li);
  }
}

function renderProjectArea() {
  const proj = activeProject();
  if (!proj) {
    els.projectArea.hidden = true;
    els.emptyState.hidden = state.projects.length > 0;
    if (state.projects.length > 0 && !state.activeProjectId) {
      state.activeProjectId = state.projects[0].id;
      save();
      renderProjects();
      return renderProjectArea();
    }
    return;
  }
  els.emptyState.hidden = true;
  els.projectArea.hidden = false;
  renderTabs(proj);
  showActiveTerminal(proj);
}

function renderTabs(project) {
  els.tabList.innerHTML = '';
  for (const t of project.tabs) {
    const li = document.createElement('li');
    li.dataset.id = t.id;
    if (t.id === project.activeTabId) li.classList.add('active');

    const name = document.createElement('span');
    name.className = 'tname';
    name.textContent = t.title || '터미널';
    name.title = '더블 클릭으로 이름 변경';
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      renameTab(t.id);
    });

    const close = document.createElement('span');
    close.className = 'close';
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(t.id);
    });

    li.append(name, close);
    li.addEventListener('click', () => selectTab(t.id));
    els.tabList.appendChild(li);
  }
}

function showActiveTerminal(project) {
  const panes = els.terminals.querySelectorAll('.term-pane');
  panes.forEach((p) => p.classList.remove('active'));

  if (!project.tabs.length) {
    els.noTabs.hidden = false;
    els.terminals.hidden = true;
    return;
  }
  els.noTabs.hidden = true;
  els.terminals.hidden = false;

  const tab = activeTab(project);
  if (!tab) return;
  let pane = els.terminals.querySelector(`.term-pane[data-id="${tab.id}"]`);
  if (!pane) {
    pane = mountTerminal(tab, project);
  }
  pane.classList.add('active');
  const live = liveTerms.get(tab.id);
  if (live) {
    requestAnimationFrame(() => {
      try {
        live.fit.fit();
      } catch (_) {
        /* ignore */
      }
      live.term.focus();
    });
  }
}

function mountTerminal(tab, project) {
  const pane = document.createElement('div');
  pane.className = 'term-pane';
  pane.dataset.id = tab.id;
  els.terminals.appendChild(pane);

  const term = new Terminal({
    fontFamily: 'Cascadia Mono, Consolas, "Courier New", monospace',
    fontSize: 13,
    cursorBlink: true,
    theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
    scrollback: 5000,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(pane);
  requestAnimationFrame(() => {
    try {
      fit.fit();
    } catch (_) {
      /* ignore */
    }
  });

  api.pty
    .spawn({
      id: tab.id,
      shellId: tab.layout.shell || project.defaultShell || null,
      cwd: tab.layout.cwd || project.folder || null,
      env: {},
      cols: term.cols,
      rows: term.rows,
    })
    .then((info) => {
      tab.layout.cwd = tab.layout.cwd || info.cwd;
      save();
    })
    .catch((e) => {
      term.write(`\r\n[muti-cli] failed to spawn shell: ${e && e.message ? e.message : e}\r\n`);
    });

  term.onData((data) => api.pty.write(tab.id, data));
  term.onResize(({ cols, rows }) => api.pty.resize(tab.id, cols, rows));

  const ro = new ResizeObserver(() => {
    try {
      fit.fit();
    } catch (_) {
      /* ignore */
    }
  });
  ro.observe(pane);

  liveTerms.set(tab.id, { term, fit, pane, ro });
  return pane;
}

function unmountTerminal(tabId) {
  const live = liveTerms.get(tabId);
  if (!live) return;
  try {
    live.ro.disconnect();
  } catch (_) {
    /* ignore */
  }
  try {
    live.term.dispose();
  } catch (_) {
    /* ignore */
  }
  if (live.pane && live.pane.parentNode) live.pane.parentNode.removeChild(live.pane);
  liveTerms.delete(tabId);
  api.pty.kill(tabId);
}

async function addProject() {
  const name = await ui.promptText('새 프로젝트 이름', '새 프로젝트');
  if (name == null) return;
  const folder = await api.dialog.pickFolder();
  const proj = {
    id: uid(),
    name: name.trim() || '새 프로젝트',
    folder: folder || null,
    defaultShell: firstAvailableShellId(),
    tabs: [],
    activeTabId: null,
  };
  state.projects.push(proj);
  state.activeProjectId = proj.id;
  addTab(proj.id);
  save();
  render();
}

async function renameProject(id) {
  const p = findProject(id);
  if (!p) return;
  const next = await ui.promptText('프로젝트 이름', p.name);
  if (next == null) return;
  const trimmed = next.trim();
  if (!trimmed) return;
  p.name = trimmed;
  save();
  render();
}

async function changeProjectFolder(id) {
  const p = findProject(id);
  if (!p) return;
  const folder = await api.dialog.pickFolder();
  if (!folder) return;
  p.folder = folder;
  save();
  render();
}

async function deleteProject(id) {
  const p = findProject(id);
  if (!p) return;
  const ok = await ui.confirmAction(`'${p.name}' 프로젝트를 삭제할까요?`, { danger: true });
  if (!ok) return;
  for (const t of p.tabs) unmountTerminal(t.id);
  state.projects = state.projects.filter((x) => x.id !== id);
  if (state.activeProjectId === id) {
    state.activeProjectId = state.projects[0] ? state.projects[0].id : null;
  }
  save();
  render();
}

function selectProject(id) {
  if (state.activeProjectId === id) return;
  state.activeProjectId = id;
  save();
  render();
}

function addTab(projectId) {
  const proj = projectId ? findProject(projectId) : activeProject();
  if (!proj) return;
  const tab = {
    id: uid(),
    title: `터미널 ${proj.tabs.length + 1}`,
    layout: {
      id: uid(),
      cwd: proj.folder || null,
      shell: proj.defaultShell || null,
    },
  };
  tab.activePaneId = tab.layout.id;
  proj.tabs.push(tab);
  proj.activeTabId = tab.id;
  save();
  render();
}

function selectTab(tabId) {
  const proj = activeProject();
  if (!proj) return;
  if (proj.activeTabId === tabId) return;
  proj.activeTabId = tabId;
  save();
  render();
}

async function renameTab(tabId) {
  const proj = activeProject();
  if (!proj) return;
  const t = proj.tabs.find((x) => x.id === tabId);
  if (!t) return;
  const next = await ui.promptText('탭 이름', t.title);
  if (next == null) return;
  const trimmed = next.trim();
  if (!trimmed) return;
  t.title = trimmed;
  save();
  render();
}

function closeTab(tabId) {
  const proj = activeProject();
  if (!proj) return;
  unmountTerminal(tabId);
  proj.tabs = proj.tabs.filter((t) => t.id !== tabId);
  if (proj.activeTabId === tabId) {
    proj.activeTabId = proj.tabs[proj.tabs.length - 1]
      ? proj.tabs[proj.tabs.length - 1].id
      : null;
  }
  save();
  render();
}

api.pty.onData(({ id, data }) => {
  const live = liveTerms.get(id);
  if (live) live.term.write(data);
});

api.pty.onExit(({ id, exitCode }) => {
  const live = liveTerms.get(id);
  if (live) {
    const code = typeof exitCode === 'number' ? exitCode : '?';
    live.term.write(`\r\n[프로세스 종료됨 — exit ${code}]\r\n`);
  }
});

window.addEventListener('resize', () => {
  for (const { fit } of liveTerms.values()) {
    try {
      fit.fit();
    } catch (_) {
      /* ignore */
    }
  }
});

els.addProjectBtn.addEventListener('click', addProject);
els.emptyAddBtn.addEventListener('click', addProject);
els.addTabBtn.addEventListener('click', () => addTab());
els.addFirstTabBtn.addEventListener('click', () => addTab());
els.shellPickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleShellMenu();
});
document.addEventListener('click', () => toggleShellMenu(false));

(async function bootstrap() {
  try {
    availableShells = (await api.pty.listShells()) || [];
  } catch (e) {
    console.error('failed to list shells', e);
    availableShells = [];
  }
  try {
    const saved = await api.state.get();
    state.projects = (saved.projects || []).map((p) => ({
      id: p.id || uid(),
      name: p.name || '프로젝트',
      folder: p.folder || null,
      defaultShell: validatedShell(p.defaultShell),
      tabs: Array.isArray(p.tabs) ? p.tabs.map((t) => normalizeTab(t, p.folder)) : [],
      activeTabId: p.activeTabId || null,
    }));
    for (const p of state.projects) {
      if (!p.tabs.find((t) => t.id === p.activeTabId)) {
        p.activeTabId = p.tabs[0] ? p.tabs[0].id : null;
      }
    }
    const stillExists = state.projects.some((p) => p.id === saved.activeProjectId);
    state.activeProjectId = stillExists ? saved.activeProjectId : state.projects[0]?.id || null;
  } catch (e) {
    console.error('failed to load state', e);
  }
  render();
})();

function validatedShell(id) {
  if (!availableShells.length) return id || null;
  const found = availableShells.find((s) => s.id === id && s.available);
  if (found) return id;
  return firstAvailableShellId();
}

function normalizeTab(t, projectFolder) {
  const layout = t.layout || {};
  const paneId = layout.id || uid();
  return {
    id: t.id || uid(),
    title: t.title || '터미널',
    layout: {
      id: paneId,
      cwd: layout.cwd || projectFolder || null,
      shell: layout.shell || null,
    },
    activePaneId: paneId,
  };
}
