'use strict';

(async () => {
  const status = document.getElementById('status');
  try {
    const state = await window.api.state.get();
    status.textContent = `state.schemaVersion = ${state.schemaVersion} · projects: ${state.projects.length}`;
  } catch (e) {
    status.textContent = `failed to load state: ${e && e.message ? e.message : String(e)}`;
  }
})();
