/**
 * Comment subscriptions for zfdemo.staffbase.rocks
 *
 * Adds a bell to each news post. Interacting with a post (like, comment, save)
 * subscribes you to every new comment on it; the bell switches that back off.
 *
 * Loaded through branch config.customJS, so it runs for every user in both the
 * outer shell and the content iframe. Only the iframe carries the post markup,
 * so the shell copy does nothing.
 */
(function () {
  'use strict';

  const API = 'https://zf-comment-subs.vercel.app/api/subscription';
  const POST_HREF = /\/content\/news\/article\/([a-f0-9]{24})/i;

  const LABEL = {
    on: { title: 'Benachrichtigungen aus', text: 'Abonniert' },
    off: { title: 'Bei neuen Kommentaren benachrichtigen', text: 'Abonnieren' },
  };

  let currentUser = null;
  const state = new Map(); // postId -> boolean
  const pending = new Set();

  // ---------------------------------------------------------------- identity

  // The client rewrites documentElement.className wholesale while booting, so
  // read it on demand rather than caching once at startup.
  function userId() {
    if (currentUser) return currentUser;
    const match = /\buser-([a-f0-9]{24})\b/i.exec(document.documentElement.className);
    if (match) currentUser = match[1];
    return currentUser;
  }

  // ------------------------------------------------------------------- state

  async function fetchState(postId) {
    const url = `${API}?postId=${postId}&userId=${userId()}`;
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`state ${res.status}`);
    const body = await res.json();
    state.set(postId, Boolean(body.subscribed));
    return body.subscribed;
  }

  async function pushState(postId, subscribed) {
    state.set(postId, subscribed);
    render();
    try {
      await fetch(API, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, userId: userId(), subscribed }),
      });
    } catch (err) {
      console.warn('[subs] could not save', err);
    }
  }

  // --------------------------------------------------------------------- DOM

  function postIdFor(node) {
    const container = node.closest('[data-post-id]');
    if (container) return container.getAttribute('data-post-id');

    const scope = node.closest('article, li, .news-feed-post, [class*="post" i]') || document;
    const link = scope.querySelector('a[href*="/content/news/article/"]');
    if (link) {
      const match = POST_HREF.exec(link.getAttribute('href'));
      if (match) return match[1];
    }
    const fromUrl = POST_HREF.exec(location.pathname);
    return fromUrl ? fromUrl[1] : null;
  }

  function makeBell() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'social-button sb-subscribe';
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML =
      '<span class="sb-subscribe-icon" aria-hidden="true">☉</span>' +
      '<span class="sb-subscribe-text"></span>';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const postId = button.dataset.postId;
      if (postId) pushState(postId, !state.get(postId));
    });
    return button;
  }

  // Only ever writes when something actually changed. Writing unconditionally
  // would retrigger the MutationObserver below and spin forever.
  function render() {
    for (const button of document.querySelectorAll('.sb-subscribe')) {
      const postId = button.dataset.postId;
      const on = Boolean(state.get(postId));
      if (button.dataset.rendered === String(on)) continue;
      button.dataset.rendered = String(on);

      const label = on ? LABEL.on : LABEL.off;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('is-subscribed', on);
      button.title = label.title;
      button.querySelector('.sb-subscribe-text').textContent = label.text;
      button.querySelector('.sb-subscribe-icon').textContent = on ? '◉' : '☉';
    }
  }

  function attach() {
    if (!userId()) return;

    const bars = document.querySelectorAll(
      '.news-feed-post-social-actions, .news-feed-post-social-footer',
    );
    for (const bar of bars) {
      if (bar.querySelector('.sb-subscribe')) continue;
      const postId = postIdFor(bar);
      if (!postId) continue;

      const bell = makeBell();
      bell.dataset.postId = postId;
      bar.appendChild(bell);

      if (!state.has(postId) && !pending.has(postId)) {
        pending.add(postId);
        fetchState(postId)
          .then(render)
          .catch((err) => console.warn('[subs] state unavailable', err))
          .finally(() => pending.delete(postId));
      }
    }
    render();
  }

  // Any interaction subscribes you. Comments also arrive server side through the
  // webhook, so this is mostly about likes and saves, which the backend cannot
  // see on its own in time.
  function watchInteractions() {
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        if (target.closest('.sb-subscribe')) return;

        const trigger = target.closest(
          '.action-like, .action-reaction, .action-comment, [class*="bookmark" i], [class*="save" i]',
        );
        if (!trigger) return;

        const postId = postIdFor(trigger);
        if (postId && !state.get(postId)) pushState(postId, true);
      },
      true,
    );
  }

  // ------------------------------------------------------------------- style

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .sb-subscribe {
        display: inline-flex; align-items: center; gap: .4em;
        background: none; border: 0; cursor: pointer;
        font: inherit; color: inherit; opacity: .75; padding: .25em .5em;
      }
      .sb-subscribe:hover { opacity: 1; }
      .sb-subscribe.is-subscribed { opacity: 1; font-weight: 600; }
      .sb-subscribe-icon { font-size: 1.1em; line-height: 1; }
    `;
    document.head.appendChild(style);
  }

  // The client re-renders constantly, so coalesce bursts of mutations into one
  // pass instead of reacting to each node individually.
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      attach();
    }, 150);
  }

  function start() {
    if (window.__sbSubscriptionsLoaded) return;
    window.__sbSubscriptionsLoaded = true;

    injectStyle();
    watchInteractions();
    attach();
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
