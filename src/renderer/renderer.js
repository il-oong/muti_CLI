'use strict';

const api = window.api;
const ui = window.ui;
const lay = window.layout;
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
  splitHBtn: document.getElementById('splitHBtn'),
  splitVBtn: document.getElementById('splitVBtn'),
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
const tabRoots = new Map();
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
  renderTerminals(proj);
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

function renderTerminals(project) {
  if (!project.tabs.length) {
    els.noTabs.hidden = false;
    els.terminals.hidden = true;
    for (const root of tabRoots.values()) root.style.display = 'none';
    return;
  }
  els.noTabs.hidden = true;
  els.terminals.hidden = false;

  for (const [tabId, root] of tabRoots.entries()) {
    root.style.display = tabId === project.activeTabId ? 'block' : 'none';
  }

  const tab = activeTab(project);
  if (!tab) return;

  let root = tabRoots.get(tab.id);
  if (!root) {
    root = document.createElement('div');
    root.className = 'tab-root';
    root.dataset.tabId = tab.id;
    els.terminals.appendChild(root);
    tabRoots.set(tab.id, root);
  }
  root.style.display = 'block';
  root.replaceChildren(buildLayoutEl(tab.layout, tab, project));

  refitTabPanes(tab);
  const live = liveTerms.get(tab.activePaneId);
  if (live) requestAnimationFrame(() => live.term.focus());
}

function buildLayoutEl(node, tab, project) {
  if (lay.isSplit(node)) {
    const el = document.createElement('div');
    el.className = `split split-${node.dir}`;

    const aEl = document.createElement('div');
    aEl.className = 'split-child';
    aEl.style.flex = `${node.ratio} 1 0`;
    aEl.appendChild(buildLayoutEl(node.a, tab, project));

    const splitter = document.createElement('div');
    splitter.className = `splitter splitter-${node.dir}`;
    attachSplitterDrag(splitter, node, el, aEl, () => {
      const bEl = aEl.nextElementSibling && aEl.nextElementSibling.nextElementSibling;
      if (bEl) bEl.style.flex = `${1 - node.ratio} 1 0`;
      aEl.style.flex = `${node.ratio} 1 0`;
    });

    const bEl = document.createElement('div');
    bEl.className = 'split-child';
    bEl.style.flex = `${1 - node.ratio} 1 0`;
    bEl.appendChild(buildLayoutEl(node.b, tab, project));

    el.append(aEl, splitter, bEl);
    return el;
  }

  return ensurePaneEl(node, tab, project);
}

function attachSplitterDrag(splitter, splitNode, containerEl, _aEl, applyFlex) {
  splitter.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = containerEl.getBoundingClientRect();
    const isHoriz = splitNode.dir === 'h';
    function onMove(ev) {
      const pos = isHoriz ? ev.clientX - rect.left : ev.clientY - rect.top;
      const size = isHoriz ? rect.width : rect.height;
      const raw = pos / size;
      splitNode.ratio = lay.clampRatio(raw);
      applyFlex();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      save();
      const tab = activeTabOfActiveProject();
      if (tab) refitTabPanes(tab);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function activeTabOfActiveProject() {
  const proj = activeProject();
  return proj ? activeTab(proj) : null;
}

function refitTabPanes(tab) {
  lay.forEachPane(tab.layout, (pane) => {
    const live = liveTerms.get(pane.id);
    if (!live) return;
    requestAnimationFrame(() => {
      try {
        live.fit.fit();
      } catch (_) {
        /* ignore */
      }
    });
  });
}

function ensurePaneEl(pane, tab, project) {
  let live = liveTerms.get(pane.id);
  if (!live) {
    live = mountPane(pane, tab, project);
  }
  live.paneEl.classList.toggle('active-pane', tab.activePaneId === pane.id);
  return live.paneEl;
}

function mountPane(pane, tab, project) {
  const paneEl = document.createElement('div');
  paneEl.className = 'term-pane';
  paneEl.dataset.paneId = pane.id;

  const header = document.createElement('div');
  header.className = 'pane-header';
  const closeBtn = document.createElement('span');
  closeBtn.className = 'pane-close';
  closeBtn.textContent = '×';
  closeBtn.title = '패널 닫기';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePane(tab.id, pane.id);
  });
  header.appendChild(closeBtn);

  const termWrap = document.createElement('div');
  termWrap.className = 'pane-term';

  paneEl.append(header, termWrap);

  const term = new Terminal({
    fontFamily: 'Cascadia Mono, Consolas, "Courier New", monospace',
    fontSize: 13,
    cursorBlink: true,
    theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
    scrollback: 5000,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(termWrap);
  requestAnimationFrame(() => {
    try {
      fit.fit();
    } catch (_) {
      /* ignore */
    }
  });

  api.pty
    .spawn({
      id: pane.id,
      shellId: pane.shell || project.defaultShell || null,
      cwd: pane.cwd || project.folder || null,
      env: {},
      cols: term.cols,
      rows: term.rows,
    })
    .then((info) => {
      pane.cwd = pane.cwd || info.cwd;
      save();
    })
    .catch((e) => {
      term.write(`\r\n[muti-cli] failed to spawn shell: ${e && e.message ? e.message : e}\r\n`);
    });

  term.onData((data) => api.pty.write(pane.id, data));
  term.onResize(({ cols, rows }) => api.pty.resize(pane.id, cols, rows));
  termWrap.addEventListener('mousedown', () => focusPane(tab.id, pane.id), true);

  const ro = new ResizeObserver(() => {
    try {
      fit.fit();
    } catch (_) {
      /* ignore */
    }
  });
  ro.observe(paneEl);

  const live = { term, fit, paneEl, termWrap, ro };
  liveTerms.set(pane.id, live);
  return live;
}

function disposePane(paneId) {
  const live = liveTerms.get(paneId);
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
  if (live.paneEl && live.paneEl.parentNode) live.paneEl.parentNode.removeChild(live.paneEl);
  liveTerms.delete(paneId);
  api.pty.kill(paneId);
}

function focusPane(tabId, paneId) {
  const proj = activeProject();
  if (!proj) return;
  const tab = proj.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  if (tab.activePaneId === paneId) return;
  tab.activePaneId = paneId;
  save();
  for (const p of lay.listPanes(tab.layout)) {
    const live = liveTerms.get(p.id);
    if (live) live.paneEl.classList.toggle('active-pane', p.id === paneId);
  }
}

function splitActivePane(dir) {
  const proj = activeProject();
  if (!proj) return;
  const tab = activeTab(proj);
  if (!tab) return;
  const paneCount = lay.countPanes(tab.layout);
  if (paneCount >= lay.MAX_PANES) return;

  const newPane = {
    id: uid(),
    cwd: proj.folder || null,
    shell: proj.defaultShell || null,
  };
  const result = lay.splitPane(tab.layout, tab.activePaneId, dir, newPane);
  if (!result.added) return;
  tab.layout = result.layout;
  tab.activePaneId = newPane.id;
  save();
  renderTerminals(proj);
}

function closePane(tabId, paneId) {
  const proj = activeProject();
  if (!proj) return;
  const tab = proj.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  const next = lay.removePane(tab.layout, paneId);
  disposePane(paneId);
  if (next == null) {
    closeTab(tab.id);
    return;
  }
  tab.layout = next;
  if (!lay.findPane(tab.layout, tab.activePaneId)) {
    tab.activePaneId = lay.listPanes(tab.layout)[0].id;
  }
  save();
  renderTerminals(proj);
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
  for (const t of p.tabs) {
    for (const pane of lay.listPanes(t.layout)) disposePane(pane.id);
    const root = tabRoots.get(t.id);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    tabRoots.delete(t.id);
  }
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
  const paneId = uid();
  const tab = {
    id: uid(),
    title: `터미널 ${proj.tabs.length + 1}`,
    layout: {
      id: paneId,
      cwd: proj.folder || null,
      shell: proj.defaultShell || null,
    },
    activePaneId: paneId,
  };
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
  renderTabs(proj);
  renderTerminals(proj);
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
  renderTabs(proj);
}

function closeTab(tabId) {
  const proj = activeProject();
  if (!proj) return;
  const tab = proj.tabs.find((x) => x.id === tabId);
  if (!tab) return;
  for (const pane of lay.listPanes(tab.layout)) disposePane(pane.id);
  const root = tabRoots.get(tabId);
  if (root && root.parentNode) root.parentNode.removeChild(root);
  tabRoots.delete(tabId);
  proj.tabs = proj.tabs.filter((t) => t.id !== tabId);
  if (proj.activeTabId === tabId) {
    proj.activeTabId = proj.tabs[proj.tabs.length - 1]
      ? proj.tabs[proj.tabs.length - 1].id
      : null;
  }
  save();
  renderTabs(proj);
  renderTerminals(proj);
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
els.splitHBtn.addEventListener('click', () => splitActivePane('h'));
els.splitVBtn.addEventListener('click', () => splitActivePane('v'));
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
  const layout = normalizeLayout(t.layout, projectFolder);
  const firstPane = lay.listPanes(layout)[0];
  const activePaneId = lay.findPane(layout, t.activePaneId)
    ? t.activePaneId
    : firstPane
    ? firstPane.id
    : null;
  return {
    id: t.id || uid(),
    title: t.title || '터미널',
    layout,
    activePaneId,
  };
}

function normalizeLayout(node, projectFolder) {
  if (!node) {
    return { id: uid(), cwd: projectFolder || null, shell: null };
  }
  if (node.type === 'split') {
    return {
      type: 'split',
      dir: node.dir === 'v' ? 'v' : 'h',
      ratio: lay.clampRatio(node.ratio),
      a: normalizeLayout(node.a, projectFolder),
      b: normalizeLayout(node.b, projectFolder),
    };
  }
  return {
    id: node.id || uid(),
    cwd: node.cwd || projectFolder || null,
    shell: node.shell || null,
  };
}
