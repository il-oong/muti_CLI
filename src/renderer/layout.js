'use strict';

(function (root) {
  const MAX_PANES = 4;

  function isSplit(node) {
    return !!(node && node.type === 'split');
  }

  function isPane(node) {
    return !!(node && node.type !== 'split');
  }

  function forEachPane(node, fn) {
    if (!node) return;
    if (isSplit(node)) {
      forEachPane(node.a, fn);
      forEachPane(node.b, fn);
    } else {
      fn(node);
    }
  }

  function listPanes(node) {
    const out = [];
    forEachPane(node, (p) => out.push(p));
    return out;
  }

  function countPanes(node) {
    return listPanes(node).length;
  }

  function findPane(node, paneId) {
    if (!node) return null;
    if (isSplit(node)) {
      return findPane(node.a, paneId) || findPane(node.b, paneId);
    }
    return node.id === paneId ? node : null;
  }

  function findParent(node, paneId) {
    if (!isSplit(node)) return null;
    if (!isSplit(node.a) && node.a.id === paneId) return { parent: node, side: 'a' };
    if (!isSplit(node.b) && node.b.id === paneId) return { parent: node, side: 'b' };
    return findParent(node.a, paneId) || findParent(node.b, paneId);
  }

  function replaceNode(node, oldRef, newNode) {
    if (node === oldRef) return newNode;
    if (!isSplit(node)) return node;
    return {
      ...node,
      a: replaceNode(node.a, oldRef, newNode),
      b: replaceNode(node.b, oldRef, newNode),
    };
  }

  function splitPane(layout, paneId, dir, newPane) {
    if (countPanes(layout) >= MAX_PANES) return { layout, added: false };
    const target = findPane(layout, paneId);
    if (!target) return { layout, added: false };
    const split = {
      type: 'split',
      dir,
      ratio: 0.5,
      a: target,
      b: newPane,
    };
    return { layout: replaceNode(layout, target, split), added: true };
  }

  function removePane(layout, paneId) {
    if (!layout) return null;
    if (!isSplit(layout)) {
      return layout.id === paneId ? null : layout;
    }
    if (!isSplit(layout.a) && layout.a.id === paneId) {
      return layout.b;
    }
    if (!isSplit(layout.b) && layout.b.id === paneId) {
      return layout.a;
    }
    const a = removePane(layout.a, paneId);
    const b = removePane(layout.b, paneId);
    if (a == null) return b;
    if (b == null) return a;
    return { ...layout, a, b };
  }

  function clampRatio(r) {
    if (typeof r !== 'number' || !Number.isFinite(r)) return 0.5;
    return Math.max(0.1, Math.min(0.9, r));
  }

  const api = {
    isSplit,
    isPane,
    forEachPane,
    listPanes,
    countPanes,
    findPane,
    findParent,
    replaceNode,
    splitPane,
    removePane,
    clampRatio,
    MAX_PANES,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.layout = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
