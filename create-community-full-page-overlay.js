// ==UserScript==
// @name         Create Community — full-page overlay
// @namespace    http://tampermonkey.net/
// @version      2026-09-28
// @description  Listens for the Create Community widget's postMessage handoff and renders a true full-page overlay containing the community-creation iframe, instead of the overlay being clipped to the widget's own iframe box.
// @author       You
// @match        https://mercedesdemo.staffbase.rocks/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=staffbase.rocks
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Must match the origin the create-community widget iframe is actually served from
  // (inspect the widget's iframe `src` on this page to confirm).
  const WIDGET_ORIGIN = 'https://veronicamayer-staffbase.github.io';

  const OVERLAY_ID = 'createCommunityFullPageOverlay';
  const STYLE_ID = 'createCommunityFullPageOverlayStyles';
  const DEFAULT_WIDTH = 712;

  const CSS = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(15, 23, 42, 0.6);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #${OVERLAY_ID}, #${OVERLAY_ID} * {
      box-sizing: border-box;
    }
    #${OVERLAY_ID} .cc-modal {
      position: relative;
      background: #ffffff;
      width: 100%;
      max-width: ${DEFAULT_WIDTH}px;
      height: 90vh;
      border-radius: 14px;
      overflow: hidden;
    }
    #${OVERLAY_ID} .cc-close {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      border-radius: 6px;
      color: #6b7280;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      z-index: 1;
    }
    #${OVERLAY_ID} .cc-close:hover {
      background: rgba(0, 0, 0, 0.06);
    }
    #${OVERLAY_ID} iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  `;

  function closeOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();
  }

  // Only accept an https URL for the iframe `src` — set via a plain attribute
  // assignment, never innerHTML — so a malformed or non-http(s) payload can
  // never be used to inject markup or trigger a non-navigation scheme.
  function isSafeSrc(src) {
    try {
      return new URL(src).protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function openOverlay(payload) {
    if (!payload || !isSafeSrc(payload.src)) return;

    closeOverlay();

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'cc-close';
    closeBtn.setAttribute('aria-label', payload.closeLabel || 'Close');
    closeBtn.textContent = '×';

    const iframe = document.createElement('iframe');
    iframe.src = payload.src;
    iframe.title = 'Create Community';

    const modal = document.createElement('div');
    modal.className = 'cc-modal';
    if (payload.width) modal.style.maxWidth = payload.width + 'px';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Create Community');
    modal.appendChild(closeBtn);
    modal.appendChild(iframe);

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.appendChild(modal);

    function onEsc(e) { if (e.key === 'Escape') close(); }
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onEsc);
    }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onEsc);

    document.body.appendChild(overlay);
  }

  window.addEventListener('message', (e) => {
    if (e.origin !== WIDGET_ORIGIN) return;
    const data = e.data;
    if (!data || data.type !== 'createCommunity:open' || !data.payload) return;
    openOverlay(data.payload);
  });
})();
