// ==UserScript==
// @name         Staffbase Communities – open page in top window
// @namespace    https://*.staffbase.rocks/
// @version      1.0
// @description  Open-page button on the community overview navigates the whole window instead of the iframe
// @match        https://*.staffbase.rocks/*
// @match        https://*.staffbase.com/*
// @match        https://*.staffbase.rocks/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG = false; // set to true to log what gets clicked

  // Only act when we are inside an iframe
  if (window.top === window.self) return;

  // Adjust if you find a more specific selector for the button
  const BUTTON_SELECTOR = [
    'a[target="_self"][href*="/content/page/"]',
    'a[href*="/content/page/"]',
    'a[href*="/content/"]',
    '[aria-label*="öffnen" i]',
    '[aria-label*="open" i]',
    '[title*="öffnen" i]',
    '[title*="open" i]'
  ].join(',');

  function findUrl(el) {
    const a = el.closest('a[href]') || el.querySelector?.('a[href]');
    if (a) return a.href;
    // Fallback: look for a link in the same card
    const card = el.closest('article, li, [class*="card" i]');
    const link = card && card.querySelector('a[href*="/content/"]');
    return link ? link.href : null;
  }

  function handler(e) {
    const btn = e.target.closest(BUTTON_SELECTOR);
    if (!btn) return;

    const url = findUrl(btn);
    if (DEBUG) console.log('[open-in-top]', btn, url);
    if (!url) return;

    // Skip "Beitreten" (join) buttons if they are not links
    e.preventDefault();
    e.stopImmediatePropagation();

    try {
      window.top.location.href = url;     // navigate the whole window
    } catch (err) {
      window.open(url, '_top');           // fallback
    }
  }

  // Capture phase, so we run before the page's own click handlers
  document.addEventListener('click', handler, true);
  document.addEventListener('auxclick', handler, true);
})();