// ==UserScript==
// @name         Staffbase – Hide Floating Elements
// @namespace    https://q3veronica26.staffbase.rocks/
// @version      1.3
// @description  Hides the floating top navigation, the floating "Bearbeiten" admin button and the floating AI assistant button on Staffbase pages
// @match        https://q3veronica26.staffbase.rocks/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    const css = `
        /* Floating top navigation */
        header[data-navigation-variant="floating"],
        header[data-c13y-region="header"],

        /* Floating admin actions (Bearbeiten / edit button) */
        div[data-c13y-purpose="admin-actions"],

        /* Floating AI assistant button (wrapper div around the button) */
        div:has(> button[aria-label="KI-Assistent öffnen"]) {
            display: none !important;
        }
    `;

    if (typeof GM_addStyle === 'function') {
        GM_addStyle(css);
    } else {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }
})();