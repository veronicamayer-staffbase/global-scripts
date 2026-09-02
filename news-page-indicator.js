// ==UserScript==
// @name         News page fetch
// @namespace    http://tampermonkey.net/
// @version      2026-08-01
// @description  try to take over the world!
// @author       You
// @match        https://bshrfp.staffbase.rocks/content/page*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=staffbase.rocks
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

const NEWSPAGE_SLUGS = {
  'Company News': 'company-news',
  'Regional News': 'regional-news',
  'Topic News': 'topic-news',
};

const folderTitleCache = new Map(); // menuFolderId -> slug | null | Promise
const channelCache = new Map(); // channelId -> slug | null | Promise

const CHANNEL_LINK_SELECTOR = 'a[href*="/content/news/channel/"]';

function extractChannelId(href) {
  const match = href.match(/\/content\/news\/channel\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function pickTitle(localizationMap) {
  if (!localizationMap) return null;
  const lang = (document.documentElement.lang || 'en_US').replace('-', '_');
  const entry = localizationMap[lang] || localizationMap['en_US'] || Object.values(localizationMap)[0];
  return entry ? entry.title : null;
}

function resolveFolderSlug(folderId) {
  if (folderTitleCache.has(folderId)) return folderTitleCache.get(folderId);

  const promise = fetch(`/api/menu/${folderId}`, { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : null))
    .then((node) => {
      const title = node ? pickTitle(node.config && node.config.localization) : null;
      const slug = title ? (NEWSPAGE_SLUGS[title] || 'default') : null;   // ← changed
      folderTitleCache.set(folderId, slug);
      return slug;
    })
    .catch(() => {
      folderTitleCache.set(folderId, null);
      return null;
    });

  folderTitleCache.set(folderId, promise);
  return promise;
}

function resolveNewsPageSlug(channelId) {
  if (channelCache.has(channelId)) return channelCache.get(channelId);

  const promise = fetch(`/api/installations/${channelId}`, { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : null))
    .then((installation) => {
      const folderId = installation && installation.defaultMenuFolderId;
      if (!folderId) {
        channelCache.set(channelId, null);
        return null;
      }
      return Promise.resolve(resolveFolderSlug(folderId)).then((slug) => {
        channelCache.set(channelId, slug);
        return slug;
      });
    })
    .catch(() => {
      channelCache.set(channelId, null);
      return null;
    });

  channelCache.set(channelId, promise);
  return promise;
}

  function deepQueryAll(root, selector, out) {
    root.querySelectorAll(selector).forEach((el) => out.push(el));
    root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) deepQueryAll(el.shadowRoot, selector, out);
    });
  }

  async function applyDots() {
    const links = [];
    deepQueryAll(document, CHANNEL_LINK_SELECTOR, links);
    const pending = links.filter((link) => !link.dataset.sbNewspageDot);
    if (!pending.length) return;

    pending.forEach((link) => { link.dataset.sbNewspageDot = 'pending'; });

    const channelIds = [...new Set(pending.map((link) => extractChannelId(link.getAttribute('href'))).filter(Boolean))];
    await Promise.all(channelIds.map(resolveNewsPageSlug));

    pending.forEach((link) => {
      const channelId = extractChannelId(link.getAttribute('href'));
      const slug = channelId ? channelCache.get(channelId) : null;
      if (!slug) {
        link.dataset.sbNewspageDot = 'skipped';
        return;
      }
      const dot = document.createElement('span');
      dot.setAttribute('data-c13y-id', `newspage-dot-${slug}`);
      link.parentNode.insertBefore(dot, link);
      link.dataset.sbNewspageDot = 'done';
    });
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      applyDots();
    }, 200);
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

  function observeExisting(root) {
    observeRoot(root);
    root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) observeExisting(el.shadowRoot);
    });
  }
  observeExisting(document);

  applyDots();

})();