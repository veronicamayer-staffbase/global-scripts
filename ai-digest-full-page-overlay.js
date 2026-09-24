// ==UserScript==
// @name         AI Digest — full-page overlay
// @namespace    http://tampermonkey.net/
// @version      2026-09-24
// @description  Listens for the AI Digest widget's postMessage handoff and renders its expanded digest as a true full-page overlay, instead of the modal being clipped to the widget's own iframe box.
// @author       You
// @match        https://mercedesdemo.staffbase.rocks/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=staffbase.rocks
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Must match the origin the ai-digest widget iframe is actually served from
  // (inspect the widget's iframe `src` on this page to confirm — defaults to the
  // shared solutions-monorepo gallery's GitHub Pages origin).
  const WIDGET_ORIGIN = 'https://staffbase.github.io';

  const OVERLAY_ID = 'aiDigestFullPageOverlay';
  const STYLE_ID = 'aiDigestFullPageOverlayStyles';

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
    #${OVERLAY_ID} .dg-modal {
      position: relative;
      background: #ffffff;
      color: #1f2937;
      width: 100%;
      max-width: 640px;
      max-height: 90vh;
      overflow-y: auto;
      border-radius: 14px;
      padding: 24px 28px 20px 28px;
    }
    #${OVERLAY_ID} .dg-close {
      position: absolute;
      top: 14px;
      right: 16px;
      background: none;
      border: none;
      color: #6b7280;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      padding: 4px;
    }
    #${OVERLAY_ID} .dg-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      border: 1px solid transparent;
      background:
        linear-gradient(#fff, #fff) padding-box,
        linear-gradient(to left bottom, #006CFF 0%, #974FE1 81%) border-box;
    }
    #${OVERLAY_ID} .dg-headline {
      margin: 12px 0 0;
      font-size: 18px;
      line-height: 1.4;
      font-weight: 600;
    }
    #${OVERLAY_ID} hr.dg-divider {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 18px 0;
    }
    #${OVERLAY_ID} .dg-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    @media (max-width: 480px) {
      #${OVERLAY_ID} .dg-columns { grid-template-columns: 1fr; gap: 20px; }
    }
    #${OVERLAY_ID} .dg-column { display: flex; flex-direction: column; gap: 12px; }
    #${OVERLAY_ID} .dg-pill {
      align-self: flex-start;
      display: inline-flex;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
    }
    #${OVERLAY_ID} .dg-pill-action { background: #D0E4FF; color: #1E40AF; }
    #${OVERLAY_ID} .dg-pill-neutral { background: #f9fafb; color: #1f2937; }
    #${OVERLAY_ID} .dg-markdown { display: flex; flex-direction: column; gap: 8px; }
    #${OVERLAY_ID} .dg-markdown strong { font-size: 16px; line-height: 24px; }
    #${OVERLAY_ID} .dg-markdown ul { margin: 0; padding-left: 20px; font-size: 16px; line-height: 24px; }
    #${OVERLAY_ID} .dg-markdown li { margin-bottom: 4px; }
    #${OVERLAY_ID} .dg-link { color: #2563eb; text-decoration: underline; }
    #${OVERLAY_ID} .dg-feedback {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 14px;
      font-weight: 600;
    }
    #${OVERLAY_ID} .dg-thumbs { display: flex; gap: 8px; }
    #${OVERLAY_ID} .dg-thumb {
      background: none;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
      padding: 6px 10px;
      cursor: pointer;
    }
    #${OVERLAY_ID} .dg-thumb.selected { border-color: #2563eb; }
    #${OVERLAY_ID} .dg-sources {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    #${OVERLAY_ID} .dg-sources-label { color: #6b7280; font-weight: 700; margin-right: 2px; }
    #${OVERLAY_ID} .dg-source-chip {
      background: #f1f3f6;
      color: #6b7280;
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 12px;
    }
  `;

  // Builds a DOM node from plain text only — every payload field lands via
  // textContent/createTextNode, never innerHTML, so nothing arriving over
  // postMessage is ever parsed as markup.
  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    });
    (children || []).forEach((child) => node.appendChild(child));
    return node;
  }

  function leadRestItem(leadText, restText) {
    const li = el('li');
    li.appendChild(el('strong', { text: leadText + ' ' }));
    li.appendChild(document.createTextNode(restText || ''));
    return li;
  }

  function buildModal(payload) {
    const closeBtn = el('button', { class: 'dg-close', 'aria-label': payload.closeLabel || 'Close', text: '×' });

    const actionUl = el('ul', {}, [leadRestItem(payload.actionBulletLead, payload.actionBulletRest)]);
    const actionLink = el('a', { href: '#', class: 'dg-link', text: '👉 ' + payload.actionLinkText });
    actionLink.addEventListener('click', (e) => e.preventDefault());
    actionUl.appendChild(el('li', {}, [actionLink]));

    const actionColumn = el('div', { class: 'dg-column' }, [
      el('span', { class: 'dg-pill dg-pill-action', text: payload.actionLabel }),
      el('div', { class: 'dg-markdown' }, [
        el('strong', { text: payload.actionHeading }),
        actionUl,
      ]),
    ]);

    const infoColumn = el('div', { class: 'dg-column' }, [
      el('span', { class: 'dg-pill dg-pill-neutral', text: payload.infoLabel }),
      el('div', { class: 'dg-markdown' }, [
        el('strong', { text: payload.infoHeading1 }),
        el('ul', {}, [leadRestItem(payload.infoBullet1Lead, payload.infoBullet1Rest)]),
        el('strong', { text: payload.infoHeading2 }),
        el('ul', {}, [leadRestItem(payload.infoBullet2Lead, payload.infoBullet2Rest)]),
      ]),
    ]);

    const thumbUp = el('button', { class: 'dg-thumb', 'aria-label': payload.thumbUpLabel, text: '👍' });
    const thumbDown = el('button', { class: 'dg-thumb', 'aria-label': payload.thumbDownLabel, text: '👎' });
    thumbUp.addEventListener('click', () => { thumbUp.classList.add('selected'); thumbDown.classList.remove('selected'); });
    thumbDown.addEventListener('click', () => { thumbDown.classList.add('selected'); thumbUp.classList.remove('selected'); });

    const sources = el('div', { class: 'dg-sources' }, [
      el('span', { class: 'dg-sources-label', text: payload.sourcesLabel }),
      ...(payload.sources || []).map((source) => el('span', { class: 'dg-source-chip', text: source })),
    ]);

    const modal = el('div', { class: 'dg-modal', role: 'dialog', 'aria-modal': 'true' }, [
      closeBtn,
      el('span', { class: 'dg-badge', text: payload.badge }),
      el('h2', { class: 'dg-headline', text: payload.headline }),
      el('hr', { class: 'dg-divider' }),
      el('div', { class: 'dg-columns' }, [actionColumn, infoColumn]),
      el('hr', { class: 'dg-divider' }),
      el('div', { class: 'dg-feedback' }, [
        el('span', { text: payload.feedbackQuestion }),
        el('div', { class: 'dg-thumbs' }, [thumbUp, thumbDown]),
      ]),
      el('hr', { class: 'dg-divider' }),
      sources,
    ]);

    return { modal, closeBtn };
  }

  function closeOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();
  }

  function openOverlay(payload) {
    closeOverlay();

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const { modal, closeBtn } = buildModal(payload);
    const overlay = el('div', { id: OVERLAY_ID }, [modal]);

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
    if (!data || data.type !== 'aiDigest:open' || !data.payload) return;
    openOverlay(data.payload);
  });
})();
