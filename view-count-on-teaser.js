// ==UserScript==
// @name         View Count on Teaser
// @namespace    http://tampermonkey.net/
// @version      2026-08-01
// @description  try to take over the world!
// @author       You
// @match        https://bshrfp.staffbase.rocks/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=staffbase.rocks
// @grant        none
// ==/UserScript==

(function() {
    'use strict';


  const EYE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

  const ARTICLE_LINK = 'a[href*="/content/news/article/"]';
  const kickerCache = new Map(); // postId -> kicker | null | Promise

  function extractPostId(href) {
    const m = href && href.match(/\/content\/news\/article\/([a-zA-Z0-9]+)/);
    return m ? m[1] : null;
  }

  function getKicker(postId) {
    if (kickerCache.has(postId)) return kickerCache.get(postId);
    const promise = fetch(`/api/posts/${postId}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((post) => {
        if (!post || !post.contents) { kickerCache.set(postId, null); return null; }
        const lang = (document.documentElement.lang || 'en_US').replace('-', '_');
        const c = post.contents[lang] || post.contents['en_US'] || Object.values(post.contents)[0];
        const kicker = (c && c.kicker && c.kicker.trim()) || null;
        kickerCache.set(postId, kicker);
        return kicker;
      })
      .catch(() => { kickerCache.set(postId, null); return null; });
    kickerCache.set(postId, promise);
    return promise;
  }

  function deepQueryAll(root, selector, out) {
    root.querySelectorAll(selector).forEach((el) => out.push(el));
    root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) deepQueryAll(el.shadowRoot, selector, out); });
  }

  async function applyBadges() {
    const wrappers = [];
    deepQueryAll(document, 'sb-news-post-wrapper', wrappers);

    for (const w of wrappers) {
      if (w.dataset.sbTopicDone) continue;
      const links = [];
      deepQueryAll(w, ARTICLE_LINK, links);
      if (!links.length) continue;

      // placement: the comment-count link's row (fall back to the reaction counter's row)
      const commentLink = links.find((a) => /\/comments(\?|$)/.test(a.getAttribute('href') || ''));
      const counter = (function () { const o = []; deepQueryAll(w, 'sb-news-reaction-counter', o); return o[0]; })();
      const anchorEl = commentLink || counter;
      if (!anchorEl) continue;
      const row = anchorEl.parentElement;
      if (row.querySelector(':scope > [data-c13y-id="topic-badge"]')) { w.dataset.sbTopicDone = '1'; continue; }

      const postId = extractPostId(links[0].getAttribute('href'));
      if (!postId) continue;

      w.dataset.sbTopicDone = '1';
      const kicker = await getKicker(postId);
      if (!kicker) continue;

      const badge = document.createElement('span');
      badge.setAttribute('data-c13y-id', 'topic-badge');
      const label = document.createElement('span');
      label.textContent = kicker;
      badge.innerHTML = EYE;
      badge.appendChild(label);
      row.appendChild(badge);
    }
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; applyBadges(); }, 200);
  }

  function observeRoot(root) {
    new MutationObserver(scheduleApply).observe(root, { childList: true, subtree: true });
  }

  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const shadowRoot = originalAttachShadow.call(this, init);
    observeRoot(shadowRoot);
    return shadowRoot;
  };

  (function observeExisting(root) {
    observeRoot(root);
    root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) observeExisting(el.shadowRoot); });
  })(document);

  applyBadges();

})();