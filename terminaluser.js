// ==UserScript==
// @name         Staffbase – Terminal User (zfdemo)
// @namespace    https://zfdemo.staffbase.rocks/
// @version      2.1.0
// @description  Kiosk / shared-PC view for Staffbase: removes every write interaction (reactions, comments, replies, bookmarks, post creation, chat, notifications, profile + account settings) for members of one user group. Selectors were derived from the live zfdemo DOM, not from legacy documentation.
// @author       Veronica Mayer
// @match        https://zfdemo.staffbase.rocks/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * ===========================================================================
 *  WHY THIS SCRIPT LOOKS THE WAY IT DOES
 * ===========================================================================
 *
 *  The current Staffbase web client is not one document and not one DOM tree.
 *  A single page can be built from all of the following at once:
 *
 *    1. the React shell          — header, navigation, user menu, footer,
 *                                  and (for /content/news/<channel>) the news
 *                                  feed itself. Hooks: data-c13y-* attributes.
 *
 *    2. a same-origin <iframe>   — the classic client, used for article detail
 *                                  pages, profiles, chat. Hooks: the legacy
 *                                  class names (.social-button, .action-like,
 *                                  .comments-section, …) and data-testid.
 *
 *    3. open shadow roots        — every Page Designer block renders inside a
 *                                  shadow root, nested up to three levels deep
 *                                  (div → div → survey-plugin-employee-block).
 *                                  >>> A <style> in the document does NOT
 *                                  >>> apply inside a shadow root. <<<
 *
 *    4. further same-origin      — e.g. the "My Groups" block embeds /mygroups
 *       <iframe>s inside (3)       in an iframe that lives inside a shadow root
 *                                  inside the classic iframe.
 *
 *  Consequences, and how they are handled here:
 *
 *    - No @noframes. Every frame is same-origin and matches @match, so
 *      Tampermonkey runs this script in each of them; each instance takes care
 *      of its own document.
 *
 *    - Element.prototype.attachShadow is wrapped at document-start, so every
 *      shadow root is captured the moment it is created and gets the rule set
 *      via adoptedStyleSheets. A recursive sweep + MutationObserver catches
 *      any root created before the wrap took effect.
 *
 *    - Two rule sets from one selector list: the document sheet is scoped to
 *      html.sb-terminal-user (inert until membership is confirmed), the shadow
 *      sheet is unscoped (a shadow root cannot see <html>) and is therefore
 *      only adopted while the view is active.
 *
 *    - Staffbase overwrites documentElement.className while booting, which
 *      drops the marker class — a MutationObserver puts it back.
 *
 *  Hiding alone is cosmetic: anyone with devtools can unhide a button. The
 *  routes that actually change account state (/settings, /bookmarks, /studio,
 *  own profile) are therefore blocked outright in the top frame as well.
 * ===========================================================================
 */

(function () {
    'use strict';

    // =======================================================================
    //  CONFIG
    // =======================================================================
    const CONFIG = {
        /** The user group that receives the terminal view. ("Terminal-User") */
        GROUP_ID: '6b0556bca815157bbfaaf6d1',

        /** Where a blocked route sends the user. '/' resolves to the start page. */
        HOME_PATH: '/',

        /** Block the account routes, not just hide the links to them. */
        BLOCK_ROUTES: true,

        /** true  → existing comments stay readable, only writing is removed.
         *  false → the whole comment section disappears. */
        KEEP_COMMENTS_READABLE: false,

        /** Surveys / polls write data under the shared account. */
        HIDE_SURVEYS: true,

        /** "Mark as read" / acknowledgement buttons (Handlungsbedarf). */
        HIDE_ACKNOWLEDGEMENTS: true,

        /** Optional — not interactions, but often unwanted on a kiosk. */
        HIDE_SEARCH: false,
        HIDE_LAUNCHPAD: false,
        HIDE_AI_ASSISTANT: false,

        /** Entries to remove entirely: the nav item disappears AND the page
         *  becomes unreachable by URL.
         *
         *  Careful — a menu entry's ID is not always its page's ID (Dashboard
         *  happens to share one, Communities does not). List both; an ID that
         *  matches nothing simply does nothing. */
        HIDDEN_PAGE_IDS: [
            '6a9547db1df7a46a3e73f2b0',   // Dashboard   (menu entry + page)
            '6b0930306b244975855e8ac6',   // Communities (menu entry)
            '6a9547fbf71da246ead651b9',   // Communities (page)
        ],

        /** Minutes of inactivity before returning to HOME_PATH. 0 = off. */
        IDLE_RESET_MINUTES: 0,

        DEBUG: false,
    };

    // =======================================================================
    //  SELECTORS — all verified against the live zfdemo DOM (Nov 2026)
    // =======================================================================

    // --- React shell: header -------------------------------------------
    const SHELL_HEADER = [
        '[data-c13y-purpose="profile"]',          // avatar + user menu trigger
        '[data-c13y-purpose="notifications"]',
        '[data-c13y-purpose="chat"]',
        '[data-c13y-region="header-user-menu"]',  // the popover itself, as a backstop
    ];

    // --- React shell: editorial / admin controls ------------------------
    const SHELL_ADMIN = [
        '[data-c13y-purpose="admin-actions"]',    // "Neuer Beitrag", "Bearbeiten", "Statistiken"
        '[data-c13y-purpose="edit"]',
        '[data-testid="create-news-post-toolbar"]',
        // classic iframe: the "Bearbeiten" / "Statistiken" toolbar on detail pages
        '#contextual-action-toolbar',
        '.contextual-toolbar-container',
    ];

    // --- React shell + Page Designer blocks: reactions ------------------
    const REACTIONS_MODERN = [
        '[data-c13y-purpose="social-footer"]',    // news channel page footer
        '[data-c13y-region="news-actions"]',
        '[data-c13y-purpose="react"]',
        '[data-c13y-purpose="add-reaction"]',
        '[data-c13y-purpose="show-reactions"]',
        '[data-testid="news-reactions"]',
        '[data-testid="news-reactions-button"]',
        '[data-testid="add-reaction"]',
        '[data-testid="like-icon"]',
        // community / "update" post cards render their own web component
        'sb-news-interaction-buttons',
        '[data-testid="interaction-buttons"]',
        '[data-testid^="news-reactions-count-"]',
    ];

    // --- React shell + Page Designer blocks: comments -------------------
    const COMMENTS_MODERN_WRITE = [
        '[data-c13y-purpose="add-comment"]',
        '[data-c13y-purpose="open-comments"]',
    ];
    const COMMENTS_MODERN_ALL = [
        '[data-testid="news-comments"]',
        'sb-news-comment-counter',
    ];

    // --- React shell + Page Designer blocks: post creation --------------
    const CREATE_MODERN = [
        '[data-c13y-region="create-post-block"]',
        '[data-c13y-purpose="create-post"]',
        '[data-c13y-component="button"][data-c13y-purpose="create"]',
        '[data-testid="create-post-portal-host"]',
        '[data-testid="create-post-edit-icon"]',
    ];

    // --- Classic iframe: reactions / bookmarks --------------------------
    const REACTIONS_CLASSIC = [
        '.news-feed-post-social-footer',
        '.news-feed-post-social-actions',
        '.news-feed-post-social-counts',
        '.social-button',
        '.action-like',
        '.action-reaction',
        '.action-comment',
        '.action-bookmark',
        '.scroll-to-comments',
    ];

    // --- Classic iframe: comments ---------------------------------------
    const COMMENTS_CLASSIC_WRITE = [
        '.news-comment-editor-card',
        '.news-comment-image-upload',
        '.save-comment',
        '.comment-actions',                       // per-comment "…" menu
        '.comment-liking',                        // like under a comment
        '.comment-replying',                      // reply under a comment
        '.action-reply',
        // the footer itself stays so the timestamp survives in readable mode;
        // drop the separators that would otherwise dangle next to it
        '.comment-footer .bullet-separator',
        '[data-testid="comment-actions-button"]',
        '[data-testid="comment-like-button"]',
        '[data-testid="comment-reply-button"]',
    ];
    const COMMENTS_CLASSIC_ALL = [
        '.comments-section',
    ];

    // --- Optional groups -------------------------------------------------
    const SURVEYS = [
        '[data-c13y-region="survey-block"]',
        '[data-testid="surveyForm"]',
        'survey-plugin-employee-block',
    ];
    const ACKNOWLEDGEMENTS = [
        '[data-c13y-purpose="to-acknowledge"]',
    ];
    const SEARCH = ['[data-c13y-purpose="search"]'];
    const LAUNCHPAD = ['[data-c13y-purpose="launchpad"]'];
    const AI_ASSISTANT = [
        '[data-c13y-region="ai-assistant"]',
        '[data-c13y-region="ai-assistant-launcher"]',
    ];

    function buildSelectorList() {
        let list = []
            .concat(SHELL_HEADER, SHELL_ADMIN)
            .concat(REACTIONS_MODERN, REACTIONS_CLASSIC)
            .concat(CREATE_MODERN)
            .concat(COMMENTS_MODERN_WRITE, COMMENTS_CLASSIC_WRITE);

        if (!CONFIG.KEEP_COMMENTS_READABLE) {
            list = list.concat(COMMENTS_MODERN_ALL, COMMENTS_CLASSIC_ALL);
        }
        if (CONFIG.HIDE_SURVEYS) list = list.concat(SURVEYS);
        if (CONFIG.HIDE_ACKNOWLEDGEMENTS) list = list.concat(ACKNOWLEDGEMENTS);
        if (CONFIG.HIDE_SEARCH) list = list.concat(SEARCH);
        if (CONFIG.HIDE_LAUNCHPAD) list = list.concat(LAUNCHPAD);
        if (CONFIG.HIDE_AI_ASSISTANT) list = list.concat(AI_ASSISTANT);
        CONFIG.HIDDEN_PAGE_IDS.forEach((id) => {
            list.push('[data-c13y-component="item"][data-c13y-id="' + id + '"]');
        });
        return list;
    }

    // =======================================================================
    //  INTERNALS
    // =======================================================================
    const MARKER = 'sb-terminal-user';
    const CACHE_KEY = 'sb-tu:' + CONFIG.GROUP_ID;
    const UID_KEY = 'sb-tu-uid';

    const log = (...a) => CONFIG.DEBUG && console.log('[terminal-user]', ...a);
    const ss = {
        get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    };

    const SELECTORS = buildSelectorList();
    const HIDE = ' {\n    display: none !important;\n}\n';
    const DOC_CSS = SELECTORS.map((s) => 'html.' + MARKER + ' ' + s).join(',\n') + HIDE;
    const SHADOW_CSS = SELECTORS.join(',\n') + HIDE;

    let active = false;

    // =======================================================================
    //  1. Document stylesheet — injected immediately, inert without the marker
    // =======================================================================
    (function injectDocumentSheet() {
        const style = document.createElement('style');
        style.id = 'sb-terminal-user-style';
        style.textContent = DOC_CSS;
        (document.head || document.documentElement).appendChild(style);
        // The shell can replace <head> contents during boot; put it back.
        new MutationObserver(() => {
            if (!style.isConnected) {
                (document.head || document.documentElement).appendChild(style);
            }
        }).observe(document.documentElement, { childList: true, subtree: true });
    })();

    // =======================================================================
    //  2. Shadow roots — a document <style> cannot reach inside one
    // =======================================================================
    const shadowRoots = new Set();
    let shadowSheet;

    function getShadowSheet() {
        if (shadowSheet !== undefined) return shadowSheet;
        try {
            shadowSheet = new CSSStyleSheet();
            shadowSheet.replaceSync(SHADOW_CSS);
        } catch (e) {
            shadowSheet = null;   // older engine → fall back to a <style> node
        }
        return shadowSheet;
    }

    function dressRoot(root) {
        if (!active) return;
        const sheet = getShadowSheet();
        if (sheet) {
            if (!root.adoptedStyleSheets.includes(sheet)) {
                root.adoptedStyleSheets = root.adoptedStyleSheets.concat(sheet);
            }
        } else if (!root.querySelector('style[data-sb-terminal-user]')) {
            const s = document.createElement('style');
            s.setAttribute('data-sb-terminal-user', '');
            s.textContent = SHADOW_CSS;
            root.appendChild(s);
        }
    }

    function undressRoot(root) {
        const sheet = getShadowSheet();
        if (sheet) {
            root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => s !== sheet);
        }
        const s = root.querySelector && root.querySelector('style[data-sb-terminal-user]');
        if (s) s.remove();
    }

    function onMutations(records) {
        for (const rec of records) {
            for (const node of rec.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.shadowRoot) registerRoot(node.shadowRoot);
                sweep(node);
            }
        }
    }

    function registerRoot(root) {
        if (!root || shadowRoots.has(root)) return;
        shadowRoots.add(root);
        dressRoot(root);
        // Blocks nest shadow roots inside shadow roots.
        sweep(root);
        // A MutationObserver on the document does NOT see mutations that happen
        // inside a shadow root, so every root needs its own. Without this, a
        // block rendered into an existing root after boot — the community post
        // cards on the start page, for one — never gets the rules.
        try {
            new MutationObserver(onMutations).observe(root, { childList: true, subtree: true });
        } catch (e) { log('could not observe shadow root', e); }
    }

    // Catch every shadow root at creation time.
    (function patchAttachShadow() {
        const native = Element.prototype.attachShadow;
        if (!native || native.__sbTerminalUser) return;
        function attachShadow(init) {
            const root = native.call(this, init);
            try { registerRoot(root); } catch (e) { log('registerRoot failed', e); }
            return root;
        }
        attachShadow.__sbTerminalUser = true;
        Element.prototype.attachShadow = attachShadow;
    })();

    // …and sweep for any that already existed (script injected late, or a
    // root created by a bundle that cached attachShadow before we wrapped it).
    function sweep(root) {
        let els;
        try { els = root.querySelectorAll('*'); } catch (e) { return; }
        for (const el of els) {
            if (el.shadowRoot) registerRoot(el.shadowRoot);
        }
    }

    new MutationObserver(onMutations)
        .observe(document.documentElement, { childList: true, subtree: true });

    // Belt and braces. If a bundle cached Element.prototype.attachShadow before
    // our wrapper landed, that root is only findable by walking the tree. Sweep
    // repeatedly for a while after load, and again after every SPA navigation.
    let sweepTimer = null;
    function resweep() {
        if (!active) return;
        clearInterval(sweepTimer);
        let n = 0;
        sweepTimer = setInterval(() => {
            sweep(document);
            if (++n >= 30) clearInterval(sweepTimer);   // ~15 s
        }, 500);
    }

    // =======================================================================
    //  3. Marker class (the client rewrites documentElement.className on boot)
    // =======================================================================
    const root = document.documentElement;

    function syncMarker() {
        if (active && !root.classList.contains(MARKER)) root.classList.add(MARKER);
        else if (!active && root.classList.contains(MARKER)) root.classList.remove(MARKER);
    }
    new MutationObserver(syncMarker)
        .observe(root, { attributes: true, attributeFilter: ['class'] });

    function setActive(value) {
        if (active === value) return;
        active = value;
        syncMarker();
        shadowRoots.forEach(value ? dressRoot : undressRoot);
        log('terminal view', value ? 'ON' : 'OFF', '—', SELECTORS.length, 'selectors');
        if (!value) return;
        sweep(document);
        resweep();
        if (CONFIG.BLOCK_ROUTES) installRouteGuard();
        if (CONFIG.IDLE_RESET_MINUTES > 0) installIdleReset();
    }

    // =======================================================================
    //  4. Group membership
    // =======================================================================

    // 4a. Testing override — admins are not in the group.
    //     ?terminalUser=1 forces it on, ?terminalUser=0 off, for the session.
    const override = new URLSearchParams(location.search).get('terminalUser');
    if (override === '1' || override === '0') {
        ss.set(CACHE_KEY, override);
        log('override via URL:', override);
    }

    // 4b. Warm cache → apply synchronously, no flash of the full UI.
    if (ss.get(CACHE_KEY) === '1') setActive(true);

    // 4c. The classic client stamps the group IDs onto <html>.
    if (root.classList.contains('group-' + CONFIG.GROUP_ID)) {
        ss.set(CACHE_KEY, '1');
        setActive(true);
    }

    // 4d. Authoritative check. Only the top frame asks; the result is shared
    //     through sessionStorage, which is per-origin and therefore visible to
    //     every frame on the page.
    if (override !== '1' && override !== '0') {
        const needsLookup = window.top === window.self || ss.get(CACHE_KEY) === null;
        if (needsLookup) {
            fetch('/api/users/me', {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            })
                .then((r) => (r.ok ? r.json() : null))
                .then((me) => {
                    if (!me) return;
                    const inGroup = Array.isArray(me.groupIDs) &&
                        me.groupIDs.indexOf(CONFIG.GROUP_ID) !== -1;
                    ss.set(CACHE_KEY, inGroup ? '1' : '0');
                    if (me.id) ss.set(UID_KEY, me.id);
                    setActive(inGroup);
                })
                .catch((e) => log('membership lookup failed', e));
        }
    }

    // =======================================================================
    //  5. Route guard — hiding a link does not make the page unreachable
    // =======================================================================
    //  Top frame only. The embedded blocks legitimately load /mygroups and
    //  friends inside nested iframes; blocking those would break the page.
    let guardInstalled = false;

    const BLOCKED = [
        /^\/settings(\/|$)/,        // account, password, notifications, language
        /^\/bookmarks(\/|$)/,
        /^\/mygroups(\/|$)/,
        /^\/studio(\/|$)/,
        /^\/notifications(\/|$)/,
        /^\/chat(\/|$)/,
        /^\/content\/chat(\/|$)/,
    ];

    function isBlockedPath(path) {
        if (BLOCKED.some((re) => re.test(path))) return true;
        if (CONFIG.HIDDEN_PAGE_IDS.some((id) => path.indexOf(id) !== -1)) return true;
        // Own profile only — the edit form lives there. Colleagues stay open.
        const uid = ss.get(UID_KEY);
        return !!uid && path.indexOf('/profile/' + uid) === 0;
    }

    function goHome() {
        if (location.pathname === CONFIG.HOME_PATH) return;
        location.replace(CONFIG.HOME_PATH);
    }

    function installRouteGuard() {
        if (guardInstalled || window.top !== window.self) return;
        guardInstalled = true;

        document.addEventListener('click', (ev) => {
            const a = ev.target && ev.target.closest && ev.target.closest('a[href]');
            if (!a) return;
            let path;
            try { path = new URL(a.href, location.origin).pathname; } catch (e) { return; }
            if (isBlockedPath(path)) {
                ev.preventDefault();
                ev.stopPropagation();
                log('blocked link', path);
            }
        }, true);

        // The shell is a SPA — most navigation never reloads the document.
        const check = () => {
            resweep();                       // the SPA just swapped the page
            if (isBlockedPath(location.pathname)) goHome();
        };
        ['pushState', 'replaceState'].forEach((fn) => {
            const original = history[fn];
            history[fn] = function () {
                const result = original.apply(this, arguments);
                check();
                return result;
            };
        });
        window.addEventListener('popstate', check);
        check();   // and a direct hit on a blocked URL
    }

    // =======================================================================
    //  6. Optional kiosk idle reset
    // =======================================================================
    function installIdleReset() {
        if (window.top !== window.self) return;
        let timer;
        const reset = () => {
            clearTimeout(timer);
            timer = setTimeout(goHome, CONFIG.IDLE_RESET_MINUTES * 60 * 1000);
        };
        ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
            .forEach((e) => window.addEventListener(e, reset, { passive: true }));
        reset();
    }
})();
