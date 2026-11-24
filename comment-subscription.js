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
    on: { title: 'Benachrichtigungen zu neuen Kommentaren aus', text: 'Abonniert' },
    off: { title: 'Bei neuen Kommentaren benachrichtigen', text: 'Abonnieren' },
  };

  // Matches the stroke the platform uses on its own social icons.
  const ICON_STYLE =
    'fill: none; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5px;';
  const BELL_BODY =
    'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326';
  const BELL_CLAPPER = 'M10.268 21a2 2 0 0 0 3.464 0';

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
    const res = await fetch(`${API}?postId=${postId}&userId=${userId()}`, { mode: 'cors' });
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

  /**
   * Build the bell out of a real sibling button so it inherits the platform's
   * own styling. The visual rules live in a generated emotion class whose hash
   * changes between releases, so copy the class list at runtime instead of
   * hardcoding it, and drop only the action-specific marker.
   */
  function makeBell(sibling) {
    const button = document.createElement('button');
    button.type = 'button';

    const inherited = sibling
      ? sibling.className.replace(/\baction-[\w-]+\b/g, ' ').replace(/\s+/g, ' ').trim()
      : 'social-button light no-styles';
    button.className = `${inherited} sb-subscribe`;

    button.innerHTML =
      '<svg aria-hidden="true" data-testid="bell-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      `<path class="sb-bell-body" d="${BELL_BODY}" style="${ICON_STYLE}"></path>` +
      `<path d="${BELL_CLAPPER}" style="${ICON_STYLE}"></path>` +
      '</svg><span class="description"></span>';

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
      const text = button.querySelector('.description');
      const bell = button.querySelector('.sb-bell-body');
      if (!text || !bell) continue; // markup we did not build; leave it alone

      const postId = button.dataset.postId;
      const on = Boolean(state.get(postId));
      if (button.dataset.rendered === String(on)) continue;
      button.dataset.rendered = String(on);

      const label = on ? LABEL.on : LABEL.off;
      button.setAttribute('aria-pressed', String(on));
      button.title = label.title;
      text.textContent = label.text;
      // Subscribed reads as a filled bell, the way the platform fills its own
      // icons once an action is active.
      bell.setAttribute(
        'style',
        on ? ICON_STYLE.replace('fill: none', 'fill: currentcolor') : ICON_STYLE,
      );
    }
  }

  function attach() {
    if (!userId()) return;

    // The footer wraps the actions bar, so matching both would give every post
    // two bells. Prefer the inner bar and only fall back when it is absent.
    let bars = document.querySelectorAll('.news-feed-post-social-actions');
    if (bars.length === 0) bars = document.querySelectorAll('.news-feed-post-social-footer');

    for (const bar of bars) {
      if (bar.querySelector('.sb-subscribe')) continue;
      const postId = postIdFor(bar);
      if (!postId) continue;

      // Clone the comment or bookmark button, not the like button: like uses a
      // different emotion variant that renders in the active blue.
      const template =
        bar.querySelector('.action-comment, .action-bookmark') || bar.querySelector('.social-button');
      const bell = makeBell(template);
      bell.dataset.postId = postId;
      bar.appendChild(bell);

      // The bar sizes its columns from data-count, so keep it honest or the
      // extra button wraps onto its own row.
      bar.setAttribute('data-count', String(bar.children.length));

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

        // Confirmed class names on the social bar: like doubles as the reaction
        // picker, bookmark is the "Lesezeichen" save.
        const trigger = target.closest(
          '.action-like, .action-reaction, .action-comment, .action-bookmark',
        );
        if (!trigger) return;

        const postId = postIdFor(trigger);
        if (postId && !state.get(postId)) pushState(postId, true);
      },
      true,
    );
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
