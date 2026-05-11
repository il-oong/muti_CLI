'use strict';

const { Terminal } = window;
const FitAddon = window.FitAddon && window.FitAddon.FitAddon;

const api = window.api;

const els = {
  projectList: document.getElementById('projectList'),
  addProjectBtn: document.getElementById('addProjectBtn'),
  tabList: document.getElementById('tabList'),
  addTabBtn: document.getElementById('addTabBtn'),
  terminals: document.getElementById('terminals'),
  empty: document.getElementById('empty'),
};

const state = {
  projects: [],
  activeProjectId: null,
};

const liveTerms = new Map();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function saveSoon() {
  if (saveSoon._t) clearTimeout(saveSoon._t);
  saveSoon._t = setTimeout(() => {
    api.state.set({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
    }).catch((e) => console.error('state save failed', e));
  }, 150);
}

function activeProject() {
  return state.projects.find((p) => p.id === state.activeProjectId) || null;
}

function activeTab(project) {
  if (!project) return null;
  return project.tabs.find((t) => t.id === project.activeTabId) || project.tabs[0] || null;
}

function renderProjects() {
  els.projectList.innerHTML = '';
  for (const p of state.projects) {
    const li = document.createElement('li');
    if (p.id === state.activeProjectId) li.classList.add('active');
    li.dataset.id = p.id;

    const name = document.createElement('div');
    name.className = 'pname';
    name.textContent = p.name;

    const path = document.createElement('div');
    path.className = 'ppath';
    path.textContent = p.folder || '(폴더 미지정)';
    path.title = p.folder || '';

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const renameBtn = document.createElement('button');
    renameBtn.textContent = '이름변경';
    renameBtn.onclick = (e) => { e.stopPropagation(); renameProject(p.id); };
    const folderBtn = document.createElement('button');
    folderBtn.textContent = '폴더';
    folderBtn.onclick = (e) => { e.stopPropagation(); pickProjectFolder(p.id); };
    const delBtn = document.createElement('button');
    delBtn.textContent = '삭제';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteProject(p.id); };
    actions.append(renameBtn, folderBtn, delBtn);

    li.append(name, path, actions);
    li.onclick = () => selectProject(p.id);
    els.projectList.appendChild(li);
  }
}

function renderTabs() {
  els.tabList.innerHTML = '';
  const proj = activeProject();
  if (!proj) {
    els.empty.classList.add('show');
    return;
  }
  els.empty.classList.remove('show');
  for (const t of proj.tabs) {
    const li = document.createElement('li');
    if (t.id === proj.activeTabId) li.classList.add('active');
    li.dataset.id = t.id;

    const span = document.createElement('span');
    span.className = 'tname';
    span.textContent = t.title || '터미널';
    span.ondblclick = (e) => { e.stopPropagation(); renameTab(t.id); };

    const close = document.createElement('span');
    close.className = 'close';
    close.textContent = '×';
    close.onclick = (e) => { e.stopPropagation(); closeTab(t.id); };

    li.append(span, close);
    li.onclick = () => selectTab(t.id);
    els.tabList.appendChild(li);
  }
}

function showActiveTerminal() {
  const proj = activeProject();
  const panes = els.terminals.querySelectorAll('.term-pane');
  panes.forEach((p) => p.classList.remove('active'));
  if (!proj) return;
  const tab = activeTab(proj);
  if (!tab) return;
  let pane = els.terminals.querySelector(`.term-pane[data-id="${tab.id}"]`);
  if (!pane) {
    pane = mountTerminal(tab, proj);
  }
  pane.classList.add('active');
  const live = liveTerms.get(tab.id);
  if (live) {
    requestAnimationFrame(() => {
      try { live.fit.fit(); } catch (e) { /* ignore */ }
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
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 13,
    cursorBlink: true,
    theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
    scrollback: 5000,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(pane);
  requestAnimationFrame(() => { try { fit.fit(); } catch (e) { /* ignore */ } });

  const env = {};
  if (project.env) for (const [k, v] of Object.entries(project.env)) env[k] = v;

  api.pty.spawn({
    id: tab.id,
    shell: project.shell || undefined,
    cwd: tab.cwd || project.folder || undefined,
    env,
    cols: term.cols,
    rows: term.rows,
  }).then((info) => {
    tab.cwd = tab.cwd || info.cwd;
    saveSoon();
    if (project.startupCommand && !tab._startupSent) {
      tab._startupSent = true;
      api.pty.write(tab.id, project.startupCommand + '\r');
    }
  }).catch((e) => {
    term.write(`\r\n[muti-cli] failed to spawn shell: ${e.message}\r\n`);
  });

  term.onData((data) => api.pty.write(tab.id, data));
  term.onResize(({ cols, rows }) => api.pty.resize(tab.id, cols, rows));

  const ro = new ResizeObserver(() => {
    try { fit.fit(); } catch (e) { /* ignore */ }
  });
  ro.observe(pane);

  liveTerms.set(tab.id, { term, fit, pane, ro });
  return pane;
}

function unmountTerminal(tabId) {
  const live = liveTerms.get(tabId);
  if (!live) return;
  try { live.ro.disconnect(); } catch (e) { /* ignore */ }
  try { live.term.dispose(); } catch (e) { /* ignore */ }
  if (live.pane && live.pane.parentNode) live.pane.parentNode.removeChild(live.pane);
  liveTerms.delete(tabId);
  api.pty.kill(tabId);
}

function addProject(name, folder) {
  const proj = {
    id: uid(),
    name: name || '새 프로젝트',
    folder: folder || null,
    env: {},
    shell: null,
    startupCommand: '',
    tabs: [],
    activeTabId: null,
  };
  state.projects.push(proj);
  state.activeProjectId = proj.id;
  addTab(proj.id);
  renderProjects();
  renderTabs();
  showActiveTerminal();
  saveSoon();
}

async function renameProject(id) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  const next = window.prompt('프로젝트 이름', p.name);
  if (next == null) return;
  p.name = next.trim() || p.name;
  renderProjects();
  saveSoon();
}

async function pickProjectFolder(id) {
  const folder = await api.dialog.pickFolder();
  if (!folder) return;
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  p.folder = folder;
  renderProjects();
  saveSoon();
}

function deleteProject(id) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  if (!window.confirm(`'${p.name}' 프로젝트를 삭제할까요? (모든 탭이 종료됩니다)`)) return;
  for (const t of p.tabs) unmountTerminal(t.id);
  state.projects = state.projects.filter((x) => x.id !== id);
  if (state.activeProjectId === id) {
    state.activeProjectId = state.projects[0]?.id || null;
  }
  renderProjects();
  renderTabs();
  showActiveTerminal();
  saveSoon();
}

function selectProject(id) {
  if (state.activeProjectId === id) return;
  state.activeProjectId = id;
  renderProjects();
  renderTabs();
  showActiveTerminal();
  saveSoon();
}

function addTab(projectId) {
  const proj = state.projects.find((x) => x.id === projectId) || activeProject();
  if (!proj) return;
  const tab = {
    id: uid(),
    title: `터미널 ${proj.tabs.length + 1}`,
    cwd: proj.folder || null,
  };
  proj.tabs.push(tab);
  proj.activeTabId = tab.id;
  renderTabs();
  showActiveTerminal();
  saveSoon();
}

function selectTab(tabId) {
  const proj = activeProject();
  if (!proj) return;
  if (proj.activeTabId === tabId) return;
  proj.activeTabId = tabId;
  renderTabs();
  showActiveTerminal();
  saveSoon();
}

function closeTab(tabId) {
  const proj = activeProject();
  if (!proj) return;
  unmountTerminal(tabId);
  proj.tabs = proj.tabs.filter((t) => t.id !== tabId);
  if (proj.activeTabId === tabId) {
    proj.activeTabId = proj.tabs[proj.tabs.length - 1]?.id || null;
  }
  renderTabs();
  showActiveTerminal();
  saveSoon();
}

function renameTab(tabId) {
  const proj = activeProject();
  if (!proj) return;
  const t = proj.tabs.find((x) => x.id === tabId);
  if (!t) return;
  const next = window.prompt('탭 이름', t.title);
  if (next == null) return;
  t.title = next.trim() || t.title;
  renderTabs();
  saveSoon();
}

api.pty.onData(({ id, data }) => {
  const live = liveTerms.get(id);
  if (live) live.term.write(data);
});

api.pty.onExit(({ id }) => {
  const live = liveTerms.get(id);
  if (live) live.term.write('\r\n[프로세스 종료됨. 탭을 닫거나 새로 열어주세요.]\r\n');
});

els.addProjectBtn.onclick = async () => {
  const name = window.prompt('프로젝트 이름', '새 프로젝트');
  if (name == null) return;
  const folder = await api.dialog.pickFolder();
  addProject(name.trim() || '새 프로젝트', folder || null);
};

els.addTabBtn.onclick = () => {
  if (!activeProject()) return;
  addTab(state.activeProjectId);
};

window.addEventListener('resize', () => {
  for (const { fit } of liveTerms.values()) {
    try { fit.fit(); } catch (e) { /* ignore */ }
  }
});

async function bootstrap() {
  const saved = await api.state.get();
  state.projects = (saved.projects || []).map((p) => ({
    id: p.id || uid(),
    name: p.name || '프로젝트',
    folder: p.folder || null,
    env: p.env || {},
    shell: p.shell || null,
    startupCommand: p.startupCommand || '',
    tabs: (p.tabs || []).map((t) => ({
      id: t.id || uid(),
      title: t.title || '터미널',
      cwd: t.cwd || p.folder || null,
    })),
    activeTabId: p.activeTabId || null,
  }));
  state.activeProjectId = saved.activeProjectId || state.projects[0]?.id || null;

  for (const p of state.projects) {
    if (!p.tabs.find((t) => t.id === p.activeTabId)) {
      p.activeTabId = p.tabs[0]?.id || null;
    }
  }

  renderProjects();
  renderTabs();
  showActiveTerminal();
}

bootstrap();
