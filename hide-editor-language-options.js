// ==UserScript==
// @name         Staffbase Studio – hide translate for "Topics" pages
// @namespace    http://tampermonkey.net/
// @version      2026-09-16
// @description  On the page editor, hide the "translate" control when the page belongs to the "Topics" space.
// @author       You
// @match        https://veronicademo.staffbase.rocks/studio/content/page/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const TARGET_SPACE_ID = '6aaa5072efafcc04c259fba7';

  const MARK = 'data-sb-lang-toggle';
  const FLAG = 'data-sb-hide-translate';


  function findLanguageToggle() {
    const header =
      document.querySelector('[class*="ds-studio-header__tier-one"]') ||
      document.querySelector('[class*="ds-studio-header"]');
    const scope = header || document;

    let candidates = [...scope.querySelectorAll('button[aria-haspopup="dialog"]')];
    if (candidates.length > 1) {
      const narrowed = candidates.filter(
        (b) =>
          b.querySelector('svg[class*="language-globe"]') ||
          /^[A-Za-z]{2,3}$/.test(b.textContent.trim())
      );
      if (narrowed.length) candidates = narrowed;
    }
    return candidates.length === 1 ? candidates[0] : null;
  }

  // ---- CSS: hide our marked element only while the flag is set -------------
  const style = document.createElement('style');
  style.textContent = `html[${FLAG}="true"] [${MARK}] { display: none !important; }`;
  document.documentElement.appendChild(style);

  // ---- Space lookup (cached per page id) -----------------------------------
  const cache = new Map();

  function pageIdFromUrl() {
    const m = location.pathname.match(/\/content\/page\/([a-f0-9]{24})\b/i);
    return m ? m[1] : null;
  }

  async function isTargetSpacePage(pageId) {
    if (cache.has(pageId)) return cache.get(pageId);
    try {
      const page = await fetch(`/api/pages/${pageId}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }).then((r) => (r.ok ? r.json() : null));
      const spaceId = page && page.spaceId;
      if (!spaceId) { cache.set(pageId, false); return false; }

      let match;
      if (TARGET_SPACE_ID) {
        match = spaceId === TARGET_SPACE_ID;
      } else {
        const space = await fetch(`/api/spaces/${spaceId}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        }).then((r) => (r.ok ? r.json() : null));
      }
      cache.set(pageId, match);
      return match;
    } catch (e) {
      console.warn('[hide-translate] space lookup failed (leaving control visible):', e);
      return false;
    }
  }

  // ---- Keep the toggle marked as the header re-renders ---------------------
  function markToggle() {
    const el = findLanguageToggle();
    if (el && !el.hasAttribute(MARK)) el.setAttribute(MARK, '1');
  }

  // ---- Decide + apply for the current page ---------------------------------
  async function apply() {
    const pageId = pageIdFromUrl();
    if (!pageId) {
      document.documentElement.removeAttribute(FLAG);
      return;
    }
    const hide = await isTargetSpacePage(pageId);
    document.documentElement.setAttribute(FLAG, String(hide));
    markToggle();
  }

  // Re-mark the toggle whenever the header subtree changes (SPA re-renders).
  const mo = new MutationObserver(() => markToggle());
  mo.observe(document.body, { childList: true, subtree: true });

  // ---- React to SPA navigation (Studio never full-reloads) -----------------
  let lastUrl = location.href;
  function onMaybeNavigated() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      apply();
    }
  }
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function () {
      const r = orig.apply(this, arguments);
      onMaybeNavigated();
      return r;
    };
  }
  window.addEventListener('popstate', onMaybeNavigated);
  setInterval(onMaybeNavigated, 800);

  apply();
})();
