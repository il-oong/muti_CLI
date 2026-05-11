'use strict';

const api = window.api;
const ui = window.ui;

const els = {
  projectList: document.getElementById('projectList'),
  addProjectBtn: document.getElementById('addProjectBtn'),
  emptyState: document.getElementById('emptyState'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),
  projectView: document.getElementById('projectView'),
  projectViewName: document.getElementById('projectViewName'),
  projectViewFolder: document.getElementById('projectViewFolder'),
};

const state = {
  projects: [],
  activeProjectId: null,
};

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

function render() {
  renderProjects();
  renderWorkspace();
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

function renderWorkspace() {
  const proj = activeProject();
  if (!proj) {
    els.projectView.hidden = true;
    els.emptyState.hidden = state.projects.length > 0;
    if (state.projects.length > 0 && !state.activeProjectId) {
      state.activeProjectId = state.projects[0].id;
      save();
      renderProjects();
      return renderWorkspace();
    }
    return;
  }
  els.emptyState.hidden = true;
  els.projectView.hidden = false;
  els.projectViewName.textContent = proj.name;
  els.projectViewFolder.textContent = proj.folder || '(폴더 미지정)';
}

async function addProject() {
  const name = await ui.promptText('새 프로젝트 이름', '새 프로젝트');
  if (name == null) return;
  const folder = await api.dialog.pickFolder();
  const proj = {
    id: uid(),
    name: name.trim() || '새 프로젝트',
    folder: folder || null,
    tabs: [],
    activeTabId: null,
  };
  state.projects.push(proj);
  state.activeProjectId = proj.id;
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

els.addProjectBtn.addEventListener('click', addProject);
els.emptyAddBtn.addEventListener('click', addProject);

(async function bootstrap() {
  try {
    const saved = await api.state.get();
    state.projects = (saved.projects || []).map((p) => ({
      id: p.id || uid(),
      name: p.name || '프로젝트',
      folder: p.folder || null,
      tabs: Array.isArray(p.tabs) ? p.tabs : [],
      activeTabId: p.activeTabId || null,
    }));
    const stillExists = state.projects.some((p) => p.id === saved.activeProjectId);
    state.activeProjectId = stillExists ? saved.activeProjectId : state.projects[0]?.id || null;
  } catch (e) {
    console.error('failed to load state', e);
  }
  render();
})();
