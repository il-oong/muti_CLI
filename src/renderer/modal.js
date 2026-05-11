'use strict';

(() => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h2 class="modal-title"></h2>
      <input class="modal-input" type="text" />
      <p class="modal-message"></p>
      <div class="modal-actions">
        <button class="modal-cancel" type="button">취소</button>
        <button class="modal-ok" type="button">확인</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const card = overlay.querySelector('.modal-card');
  const titleEl = overlay.querySelector('.modal-title');
  const inputEl = overlay.querySelector('.modal-input');
  const messageEl = overlay.querySelector('.modal-message');
  const okBtn = overlay.querySelector('.modal-ok');
  const cancelBtn = overlay.querySelector('.modal-cancel');

  let resolver = null;

  function close(result) {
    overlay.hidden = true;
    document.removeEventListener('keydown', onKey);
    const r = resolver;
    resolver = null;
    if (r) r(result);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(inputEl.hidden ? false : null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      close(inputEl.hidden ? true : inputEl.value);
    }
  }

  okBtn.addEventListener('click', () => {
    close(inputEl.hidden ? true : inputEl.value);
  });
  cancelBtn.addEventListener('click', () => close(inputEl.hidden ? false : null));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(inputEl.hidden ? false : null);
  });

  function open({ title, message, input, defaultValue, okLabel, cancelLabel, danger }) {
    titleEl.textContent = title || '';
    titleEl.hidden = !title;
    messageEl.textContent = message || '';
    messageEl.hidden = !message;
    inputEl.hidden = !input;
    inputEl.value = defaultValue || '';
    okBtn.textContent = okLabel || '확인';
    cancelBtn.textContent = cancelLabel || '취소';
    okBtn.classList.toggle('danger', !!danger);
    overlay.hidden = false;
    document.addEventListener('keydown', onKey);
    if (input) {
      requestAnimationFrame(() => {
        inputEl.focus();
        inputEl.select();
      });
    } else {
      requestAnimationFrame(() => okBtn.focus());
    }
    return new Promise((resolve) => {
      resolver = resolve;
    });
  }

  window.ui = window.ui || {};
  window.ui.promptText = (title, defaultValue) =>
    open({ title, input: true, defaultValue });
  window.ui.confirmAction = (message, { danger } = {}) =>
    open({ title: '확인', message, okLabel: '확인', cancelLabel: '취소', danger });
})();
