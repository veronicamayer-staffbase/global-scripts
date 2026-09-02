// ==UserScript==
// @name         Hide Time
// @namespace    http://tampermonkey.net/
// @version      2026-07-30
// @description  try to take over the world!
// @author       You
// @match        https://bshrfp.staffbase.rocks/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=staffbase.rocks
// @grant        none
// ==/UserScript==

(function() {
  function stripTime(text) {
    return text.replace(/\s+at\s+\d{1,2}:\d{2}\s*[AP]M\.?\s*$/i, '');
  }

  function processDateElements(root) {
    root.querySelectorAll('sb-news-publication-date').forEach(el => {
      if (el.dataset.timeHidden === 'true') return;
      const span = el.querySelector('span');
      if (!span) return;
      const original = span.textContent;
      const stripped = stripTime(original);
      if (stripped !== original) {
        span.textContent = stripped;
        el.dataset.timeHidden = 'true';
      }
    });
  }

  function findShadowHost(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.shadowRoot) return node.shadowRoot;
    }
    return null;
  }

  function start() {
    const shadow = findShadowHost(document.body);
    if (!shadow) {
      setTimeout(start, 500);
      return;
    }
    processDateElements(shadow);
    const observer = new MutationObserver(() => processDateElements(shadow));
    observer.observe(shadow, { childList: true, subtree: true, characterData: true });
  }

  start();

})();