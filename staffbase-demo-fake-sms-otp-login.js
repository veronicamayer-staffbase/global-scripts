// ==UserScript==
// @name         Staffbase Demo — Fake SMS (OTP) Login
// @namespace    staffbase-demo
// @version      1.3
// @description  DEMO ONLY: adds a mock "Sign in with SMS code" step to the Staffbase sign-in screen. The OTP is generated in the browser and shown in a fake SMS banner — no messages are sent anywhere. Only numbers on the script's own allowlist can sign in. Labels in English and German.
// @match        https://migrosdemo.staffbase.rocks/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  CONFIG — the only part you normally touch
   * ------------------------------------------------------------------ */
  const CONFIG = {
    // 'auto' follows the app / browser language, or force 'en' | 'de'.
    // 'both' shows every label in both languages, e.g. "Send code / Code senden".
    language:       'auto',

    // Colours come from the tenant's own --color-client-primary token, falling
    // back to the native sign-in button. Pin them only if a device ever renders
    // the wrong colour, e.g. brandColor: '#FF7F00'.
    brandColor:     null,
    brandTextColor: null,

    senderName:     'Migros',          // sender shown in the fake SMS banner
    countryPrefix:  '+49 ',            // pre-filled in the phone field
    codeLength:     6,
    fixedCode:      null,              // e.g. '123456' → always this code; null = random
    sendDelayMs:    1200,              // fake "network" delay before the SMS arrives
    resendSeconds:  30,
    entryPosition:  'top',             // 'top' | 'bottom' of the sign-in options
    autofillOnTap:  true,              // tapping the SMS banner fills the code
    smsIcon:        'messages',        // 'messages' = the green iOS Messages icon, 'brand' = brand colour
    showTapHint:    true,              // false = no "tap to fill" line, for a 1:1 iOS look

    // Top spacing for the fake SMS banner, so it clears the status bar and the
    // Dynamic Island / camera cutout. 'auto' measures the page's real safe-area
    // inset and, on a home-screen (standalone) iPhone where that inset isn't
    // exposed, falls back to the Dynamic Island height. Set a number to pin it
    // yourself, e.g. toastTopOffset: 72.
    toastTopOffset: 'auto',

    // ---- Who is allowed in ------------------------------------------------
    // The sign-in screen is unauthenticated, so the tenant's real user directory
    // cannot be queried from here. This is the script's OWN allowlist: a number
    // that isn't on it never receives a code and cannot sign in.
    //
    // Each entry takes either a readable `phone` or a `hash` — SHA-256 of the
    // normalised number — so the file doesn't reveal which numbers are valid.
    // Generate one in the console:  await sbsmsDemo.hashPhone('+41 79 123 45 67')
    //
    // `email` is the account that number signs in as, so different numbers can
    // land in the app as different demo personas. Falls back to credentials.email.
    // An EMPTY list means no gate at all: every number is accepted.
    directory: [
      // { phone: '+41 79 123 45 67', email: 'anna.mueller@example.com' },
      // { hash:  'c1fe0a…',          email: 'marc.keller@example.com'  }
    ],

    // Numbers typed without a country code are assumed to be from here ('41' = CH)
    defaultCountryCode: '41',

    // true  → says straight away that the number is unknown (clearer on stage)
    // false → behaves like a real system: the code screen opens, but no SMS ever arrives
    revealUnknownNumbers: true,

    // What happens once the code is accepted:
    //   'credentials' → fills + submits the REAL sign-in form
    //   'sso'         → clicks the native SSO button
    //   'none'        → stops at the success screen (pure UI demo)
    onSuccess: 'credentials',

    credentials: {
      // Most secure option: don't let this script touch the password at all.
      // It opens the real sign-in form and waits for your browser / OS password
      // manager to fill it, then submits. Nothing is stored by the script.
      useAutofill: false,

      // The demo account's email. Not a secret — fine to leave in the file.
      email: 'admin+migrosdemo@staffbase.com',

      // Leave EMPTY (recommended). The script asks for it once and keeps it out
      // of this file. Anything typed here is readable by anyone who sees the file.
      password: 'bG1N,.FvFGpO1QS',

      // Where the password lives once you have typed it:
      //   'auto'    → Tampermonkey's own storage: survives reloads, is not in this
      //               file, and the page's own JavaScript cannot read it.
      //               Falls back to sessionStorage when pasted into the console.
      //   'session' → this browser session only; gone when you close the tab.
      //   'none'    → never written down; asked again after every page load.
      store: 'auto'
    }
  };

  /* ------------------------------------------------------------------ *
   *  Labels
   * ------------------------------------------------------------------ */
  const STRINGS = {
    en: {
      entry:            'Sign in with SMS code',
      phoneTitle:       'Sign In With SMS',
      phoneIntro:       'Enter your mobile number and we’ll text you a one-time code.',
      phoneLabel:       'Mobile number',
      send:             'Send code',
      sending:          'Sending…',
      otherMethod:      'Sign in using a different method?',
      invalidNumber:    'Please enter a valid mobile number.',
      unknownNumber:    'We couldn’t find an account with that mobile number.',
      codeTitle:        'Enter your code',
      codeIntro:        n => `We sent a ${n}-digit code to`,
      verify:           'Verify & sign in',
      resend:           'Resend code',
      resendIn:         s => `Resend code in ${s}s`,
      differentNumber:  'Use a different number',
      wrongCode:        'That code isn’t right. Please try again.',
      digit:            i => `Digit ${i}`,
      smsBody:          code => `Your verification code is <b>${code}</b>. It expires in 5 minutes.`,
      smsHint:          'Tap to fill automatically',
      now:              'now',
      signingIn:        'Signing you in…',
      verifying:        phone => `Verifying ${phone}`,
      verified:         'Number verified',
      confirmed:        phone => `${phone} is confirmed.`,
      backToSignIn:     'Back to sign in',
      setupTitle:       'One-time setup',
      setupStored:      'Stored in this browser only — never written into the script.',
      setupNotStored:   'Used for this sign-in only — never stored.',
      setupPasswordFor: email => `Password for <strong>${email}</strong>.`,
      setupLabel:       'Demo account password',
      continueLabel:    'Continue',
      cancel:           'Cancel',
      failTitle:        'Couldn’t complete sign-in',
      reenter:          'Re-enter the demo password',
      errNoAccount:     'No account configured for this number — set an email on the directory entry, or CONFIG.credentials.email.',
      errNoPassword:    'No demo account password available.',
      errNoAutofill:    'Your password manager didn’t fill this account. Save the demo login for this site first, or turn useAutofill off.',
      errNoSso:         'SSO button not found on this screen.',
      errNoCredentials: 'Credentials sign-in is not available on this screen.',
      errNoForm:        'Sign-in form not found.'
    },
    de: {
      entry:            'Mit SMS-Code anmelden',
      phoneTitle:       'Anmeldung per SMS',
      phoneIntro:       'Geben Sie Ihre Mobilnummer ein. Wir senden Ihnen einen Einmalcode per SMS.',
      phoneLabel:       'Mobilnummer',
      send:             'Code senden',
      sending:          'Wird gesendet…',
      otherMethod:      'Mit einer anderen Methode anmelden?',
      invalidNumber:    'Bitte geben Sie eine gültige Mobilnummer ein.',
      unknownNumber:    'Zu dieser Mobilnummer wurde kein Konto gefunden.',
      codeTitle:        'Code eingeben',
      codeIntro:        n => `Wir haben einen ${n}-stelligen Code gesendet an`,
      verify:           'Bestätigen & anmelden',
      resend:           'Code erneut senden',
      resendIn:         s => `Code erneut senden in ${s}s`,
      differentNumber:  'Andere Nummer verwenden',
      wrongCode:        'Dieser Code ist nicht korrekt. Bitte versuchen Sie es erneut.',
      digit:            i => `Ziffer ${i}`,
      smsBody:          code => `Ihr Bestätigungscode lautet <b>${code}</b>. Er ist 5 Minuten gültig.`,
      smsHint:          'Tippen zum automatischen Ausfüllen',
      now:              'jetzt',
      signingIn:        'Sie werden angemeldet…',
      verifying:        phone => `${phone} wird überprüft`,
      verified:         'Nummer bestätigt',
      confirmed:        phone => `${phone} ist bestätigt.`,
      backToSignIn:     'Zurück zur Anmeldung',
      setupTitle:       'Einmalige Einrichtung',
      setupStored:      'Nur in diesem Browser gespeichert — niemals im Skript.',
      setupNotStored:   'Nur für diese Anmeldung verwendet — nicht gespeichert.',
      setupPasswordFor: email => `Passwort für <strong>${email}</strong>.`,
      setupLabel:       'Passwort des Demo-Kontos',
      continueLabel:    'Weiter',
      cancel:           'Abbrechen',
      failTitle:        'Anmeldung fehlgeschlagen',
      reenter:          'Demo-Passwort erneut eingeben',
      errNoAccount:     'Für diese Nummer ist kein Konto hinterlegt — E-Mail im Verzeichnis-Eintrag oder CONFIG.credentials.email setzen.',
      errNoPassword:    'Kein Passwort für das Demo-Konto vorhanden.',
      errNoAutofill:    'Ihr Passwort-Manager hat dieses Konto nicht ausgefüllt. Speichern Sie die Demo-Anmeldung zuerst für diese Seite, oder deaktivieren Sie useAutofill.',
      errNoSso:         'SSO-Schaltfläche auf diesem Bildschirm nicht gefunden.',
      errNoCredentials: 'Anmeldung mit Zugangsdaten ist auf diesem Bildschirm nicht verfügbar.',
      errNoForm:        'Anmeldeformular nicht gefunden.'
    }
  };

  function resolveLang() {
    const cfg = CONFIG.language;
    if (cfg && cfg !== 'auto') return cfg;
    const tag = (document.documentElement.lang || navigator.language || 'en').toLowerCase();
    return tag.startsWith('de') ? 'de' : 'en';
  }

  const value = (v, args) => (typeof v === 'function' ? v.apply(null, args) : v);

  // t('send') → "Code senden"; with language:'both' → "Send code / Code senden"
  function t(key) {
    const args = [].slice.call(arguments, 1);
    const lang = resolveLang();
    if (lang === 'both') {
      const en = value(STRINGS.en[key], args);
      const de = value(STRINGS.de[key], args);
      return en === de ? en : en + ' / ' + de;
    }
    return value((STRINGS[lang] || STRINGS.en)[key], args);
  }

  /* ------------------------------------------------------------------ *
   *  Helpers
   * ------------------------------------------------------------------ */
  const $  = (s, r) => (r || document).querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function waitFor(selector, timeout) {
    timeout = timeout || 5000;
    return new Promise((resolve, reject) => {
      const started = Date.now();
      (function poll() {
        const el = $(selector);
        if (el) return resolve(el);
        if (Date.now() - started > timeout) return reject(new Error('timeout: ' + selector));
        setTimeout(poll, 50);
      })();
    });
  }

  function waitUntil(fn, timeout) {
    return new Promise(resolve => {
      const started = Date.now();
      (function poll() {
        if (fn()) return resolve(true);
        if (Date.now() - started > timeout) return resolve(false);
        setTimeout(poll, 100);
      })();
    });
  }

  // React-safe value assignment
  function setNativeValue(el, val) {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    if (desc && desc.set) desc.set.call(el, val); else el.value = val;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ------------------------------------------------------------------ *
   *  Brand colour
   * ------------------------------------------------------------------ */
  // The tenant's design token is the source of truth. On mobile the sign-in
  // screen can render before the tenant stylesheet lands, and a button's
  // computed colour sampled at that moment is Staffbase's default blue — which
  // then stuck, because the colour used to be read only once.
  const BRAND_TOKENS   = ['--color-client-primary', '--color-brand-primary', '--primary-color'];
  const TEXT_TOKENS    = ['--color-client-text', '--color-brand-text'];
  const FALLBACK_BRAND = '#FF7F00';
  const FALLBACK_TEXT  = '#000000';

  const usableColor = c => {
    const v = String(c || '').trim().toLowerCase();
    return !!v && v !== 'transparent' && v !== 'rgba(0, 0, 0, 0)' &&
           v !== 'initial' && v !== 'inherit' && v !== 'none' && v !== 'unset';
  };

  function cssVar(names) {
    const rs = getComputedStyle(document.documentElement);
    for (const name of names) {
      const v = (rs.getPropertyValue(name) || '').trim();
      if (usableColor(v)) return v;
    }
    return '';
  }

  const nativeButton = () =>
    $('.signin-view-container .type-uncollapse') || $('.signin-form .type-submit');

  function brandColor() {
    if (CONFIG.brandColor) return CONFIG.brandColor;
    const token = cssVar(BRAND_TOKENS);
    if (token) return token;
    const btn = nativeButton();
    if (btn) {
      const bg = getComputedStyle(btn).backgroundColor;
      if (usableColor(bg)) return bg;
    }
    return FALLBACK_BRAND;
  }

  function brandTextColor() {
    if (CONFIG.brandTextColor) return CONFIG.brandTextColor;
    const token = cssVar(TEXT_TOKENS);
    if (token) return token;
    const btn = nativeButton();
    if (btn) {
      const c = getComputedStyle(btn).color;
      if (usableColor(c)) return c;
    }
    return FALLBACK_TEXT;
  }

  function makeCode() {
    if (CONFIG.fixedCode) return String(CONFIG.fixedCode);
    let c = '';
    for (let i = 0; i < CONFIG.codeLength; i++) c += Math.floor(Math.random() * 10);
    return c;
  }

  const state = { code: null, phone: null, resendTimer: null, account: null, secrets: {} };

  /* ------------------------------------------------------------------ *
   *  Phone-number allowlist
   * ------------------------------------------------------------------ */
  // '079 123 45 67', '+41 79 123 45 67' and '0041791234567' all normalise alike
  function normalisePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    const cc = String(CONFIG.defaultCountryCode || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (!cc) return d;
    if (d.startsWith(cc)) return d;
    if (d.startsWith('0'))  return cc + d.slice(1);
    if (d.length <= 10)     return cc + d;
    return d;
  }

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // → the matching directory entry, or null when the number is not on the list
  async function lookupNumber(raw) {
    const list = CONFIG.directory || [];
    if (!list.length) return { email: CONFIG.credentials.email };   // no allowlist configured
    const n = normalisePhone(raw);
    const hash = await sha256Hex(n);
    return list.find(e =>
      (e.hash  && String(e.hash).toLowerCase() === hash) ||
      (e.phone && normalisePhone(e.phone) === n)
    ) || null;
  }

  const currentEmail = () => (state.account && state.account.email) || CONFIG.credentials.email;

  /* ------------------------------------------------------------------ *
   *  Password handling — keeps the secret out of this file
   * ------------------------------------------------------------------ */
  const SECRET_KEY = 'sbsms.demo.secret';
  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  const W = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  // base64 is NOT encryption — it only stops the password being readable at a glance
  const pack   = v => btoa(unescape(encodeURIComponent(v)));
  const unpack = v => decodeURIComponent(escape(atob(v)));

  // each persona keeps its own password, so a directory of demo users works
  const keyFor = email => SECRET_KEY + ':' + (email || '');

  function readSecret(email) {
    const em = email || currentEmail();
    if (state.secrets[em]) return state.secrets[em];
    if (CONFIG.credentials.password) return CONFIG.credentials.password;
    if (hasGM) {
      const v = GM_getValue(keyFor(em), '');
      if (v) { try { return unpack(v); } catch (e) { /* ignore */ } }
    }
    try {
      const v = sessionStorage.getItem(keyFor(em));
      if (v) return unpack(v);
    } catch (e) { /* storage blocked */ }
    return '';
  }

  function writeSecret(val, email) {
    if (!val) return;
    const em = email || currentEmail();
    state.secrets[em] = val;                    // usable for the rest of this page load
    const mode = CONFIG.credentials.store;
    if (mode === 'none') return;
    if (mode === 'auto' && hasGM) { GM_setValue(keyFor(em), pack(val)); return; }
    try { sessionStorage.setItem(keyFor(em), pack(val)); } catch (e) { /* storage blocked */ }
  }

  function clearSecret(email) {
    const em = email || currentEmail();
    delete state.secrets[em];
    if (hasGM) GM_setValue(keyFor(em), '');
    try { sessionStorage.removeItem(keyFor(em)); } catch (e) { /* storage blocked */ }
  }

  const needsSecret = () => CONFIG.onSuccess === 'credentials' && !CONFIG.credentials.useAutofill;

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('SMS demo: set password', () => {
      if ($('.signin-view-container')) { injectStyles(); applyBrandVars(); renderSecretSetup(closePanel); }
      else { writeSecret(prompt('Demo account password (stored by Tampermonkey, not in the script):')); }
    });
    GM_registerMenuCommand('SMS demo: forget password', () => { clearSecret(); alert('Demo password cleared.'); });
  }

  // console helpers — e.g. await sbsmsDemo.hashPhone('+41 79 123 45 67')
  W.sbsmsDemo = {
    setPassword: writeSecret,
    clearPassword: clearSecret,
    hasPassword: email => !!readSecret(email),
    hashPhone: raw => sha256Hex(normalisePhone(raw)),
    normalisePhone
  };

  /* ------------------------------------------------------------------ *
   *  Styles
   * ------------------------------------------------------------------ */
  function injectStyles() {
    if ($('#sbsms-styles')) return;
    const css = `
      /* our block carries a copy of the sign-in headline — hide the original below it */
      #sbsms-entry ~ .signin-view > .view-headline { display:none !important; }
      .sbsms-hidden { position:absolute !important; height:0 !important; overflow:hidden !important; opacity:0 !important; }
      .sbsms-panel { width:90%; margin:0 auto; text-align:center; animation:sbsms-fade .25s ease; }
      @keyframes sbsms-fade { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:none;} }
      .sbsms-panel h3 { margin:0 0 6px; font-size:1.15rem; font-weight:700; }
      .sbsms-panel .sbsms-sub { margin:0 0 18px; font-size:.86rem; line-height:1.45; opacity:.7; }
      .sbsms-panel .sbsms-sub strong { opacity:1; }
      .sbsms-field { text-align:left; margin-bottom:14px; }
      .sbsms-field label { display:block; font-size:.74rem; text-transform:uppercase; letter-spacing:.04em; opacity:.6; margin-bottom:6px; }
      .sbsms-field input { width:100%; box-sizing:border-box; padding:12px 14px; font-size:1rem;
        border:1px solid rgba(0,0,0,.2); border-radius:var(--sbsms-radius,6px); background:#fff; color:inherit; outline:none; }
      .sbsms-field input:focus { border-color:var(--sbsms-brand); box-shadow:0 0 0 3px color-mix(in srgb, var(--sbsms-brand) 25%, transparent); }
      .sbsms-btn { width:100%; padding:12px 16px; font-size:.95rem; font-weight:600; cursor:pointer;
        border:1px solid var(--sbsms-brand); border-radius:var(--sbsms-radius,6px);
        background:var(--sbsms-brand); color:var(--sbsms-brand-text,#1a1a1a); }
      .sbsms-btn:disabled { opacity:.5; cursor:default; }
      .sbsms-link { display:inline-block; margin-top:14px; font-size:.82rem; cursor:pointer; text-decoration:underline; opacity:.75; }
      .sbsms-link[aria-disabled="true"] { cursor:default; text-decoration:none; opacity:.45; }
      .sbsms-error { margin:0 0 12px; font-size:.82rem; color:#c0392b; text-align:left; }
      .sbsms-otp { display:flex; gap:8px; justify-content:center; margin:4px 0 18px; }
      .sbsms-otp input { width:44px; height:54px; text-align:center; font-size:1.4rem; font-weight:600;
        border:1px solid rgba(0,0,0,.2); border-radius:var(--sbsms-radius,6px); background:#fff; color:inherit; outline:none; }
      .sbsms-otp input:focus { border-color:var(--sbsms-brand); box-shadow:0 0 0 3px color-mix(in srgb, var(--sbsms-brand) 25%, transparent); }
      .sbsms-otp.sbsms-shake { animation:sbsms-shake .4s; }
      @keyframes sbsms-shake { 0%,100%{transform:none} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
      .sbsms-spinner { width:34px; height:34px; margin:10px auto 16px; border-radius:50%;
        border:3px solid rgba(0,0,0,.12); border-top-color:var(--sbsms-brand); animation:sbsms-spin .8s linear infinite; }
      @keyframes sbsms-spin { to { transform:rotate(360deg) } }
      .sbsms-check { width:46px; height:46px; margin:6px auto 14px; border-radius:50%; background:var(--sbsms-brand);
        display:flex; align-items:center; justify-content:center; color:#fff; font-size:1.5rem; }

      /* --- iOS notification banner ------------------------------------- */
      .sbsms-toast { position:fixed; top:16px; left:10px; right:10px; margin:0 auto;
        max-width:420px; z-index:2147483000; box-sizing:border-box;
        display:flex; gap:10px; align-items:flex-start; padding:13px 15px;
        border-radius:22px; cursor:pointer; text-align:left;
        background:rgba(245,245,245,.76);
        backdrop-filter:blur(28px) saturate(180%); -webkit-backdrop-filter:blur(28px) saturate(180%);
        box-shadow:0 8px 26px rgba(0,0,0,.18), 0 1px 2px rgba(0,0,0,.08);
        color:#000; -webkit-font-smoothing:antialiased;
        font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;
        animation:sbsms-drop .45s cubic-bezier(.22,1.1,.36,1); }
      @keyframes sbsms-drop { from { opacity:0; transform:translateY(-130%);} to { opacity:1; transform:none;} }
      .sbsms-toast.sbsms-out { opacity:0; transform:translateY(-130%);
        transition:transform .34s cubic-bezier(.4,0,.7,1), opacity .28s ease; }

      .sbsms-toast .sbsms-icon { flex:0 0 38px; width:38px; height:38px; border-radius:10px;
        display:flex; align-items:center; justify-content:center; overflow:hidden; }
      .sbsms-toast .sbsms-icon-messages { background:linear-gradient(180deg,#5BF675 0%,#1FB83B 100%); }
      .sbsms-toast .sbsms-icon-brand { background:var(--sbsms-brand); }
      .sbsms-toast .sbsms-icon svg { width:26px; height:26px; fill:#fff; display:block; }

      .sbsms-toast .sbsms-text { flex:1; min-width:0; }
      .sbsms-toast .sbsms-head { display:flex; align-items:baseline; justify-content:space-between;
        gap:10px; margin-bottom:1px; }
      .sbsms-toast .sbsms-sender { font-size:15px; font-weight:600; letter-spacing:-.01em;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .sbsms-toast .sbsms-time { flex:none; font-size:13px; font-weight:400; color:rgba(60,60,67,.6); }
      .sbsms-toast .sbsms-body { font-size:15px; font-weight:400; line-height:1.27; letter-spacing:-.01em;
        display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
      .sbsms-toast .sbsms-body b { font-weight:600; letter-spacing:.04em; }
      .sbsms-toast .sbsms-hint { margin-top:3px; font-size:13px; color:rgba(60,60,67,.6); }

      @media (prefers-color-scheme: dark) {
        .sbsms-toast { background:rgba(40,40,42,.72); color:#fff;
          box-shadow:0 8px 26px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.3); }
        .sbsms-toast .sbsms-time, .sbsms-toast .sbsms-hint { color:rgba(235,235,245,.6); }
      }
    `;
    const tag = document.createElement('style');
    tag.id = 'sbsms-styles';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  // re-run on every boot and every render, so a late-arriving tenant stylesheet
  // corrects a colour that was sampled too early
  function applyBrandVars() {
    const root = document.documentElement;
    const set = (name, val) => {
      if (val && root.style.getPropertyValue(name) !== val) root.style.setProperty(name, val);
    };
    set('--sbsms-brand', brandColor());
    set('--sbsms-brand-text', brandTextColor());
    const btn = nativeButton();
    if (btn) set('--sbsms-radius', getComputedStyle(btn).borderRadius);
  }

  /* ------------------------------------------------------------------ *
   *  Entry button — only ever on the method-selection screen
   * ------------------------------------------------------------------ */
  // the "or" label lives in a <span> inside the <hr> — invisible in innerHTML,
  // because <hr> is a void element and its children never serialise
  function makeRule() {
    const rule = document.createElement('hr');
    rule.setAttribute('aria-hidden', 'true');
    const existing = document.querySelector('.signin-view-container hr span');
    const span = existing ? existing.cloneNode(true) : document.createElement('span');
    if (!existing) span.textContent = 'or';
    rule.appendChild(span);
    return rule;
  }

  // the container lists every method only on the first screen; once one is
  // picked it holds that single view and its form instead
  function isSelectionScreen(container) {
    return container.querySelectorAll('button.type-uncollapse[data-view-link]').length > 0;
  }

  function injectEntry() {
    const container = $('.signin-view-container');
    if (!container || $('#sbsms-entry')) return;
    applyBrandVars();

    const view = document.createElement('div');
    view.className = 'signin-view';
    view.id = 'sbsms-entry';
    view.dataset.viewId = 'sms';

    const btn = document.createElement('button');
    btn.className = 'type-uncollapse clickable';
    btn.type = 'button';
    btn.setAttribute('role', 'button');
    btn.textContent = t('entry');
    btn.addEventListener('click', openSms);

    const rule = makeRule();

    if (CONFIG.entryPosition === 'bottom') {
      view.appendChild(btn);
      container.appendChild(rule);
      container.appendChild(view);
    } else {
      // a COPY of the headline, so React's own node is never moved
      // (the original is hidden by CSS for as long as our block is present)
      const headline = container.querySelector('.view-headline');
      if (headline) view.appendChild(headline.cloneNode(true));
      view.appendChild(btn);
      container.insertBefore(rule, container.firstChild);
      container.insertBefore(view, container.firstChild);
    }
  }

  function removeEntry() {
    const view = $('#sbsms-entry');
    if (!view) return;
    view.remove();
    // React recycles the <hr> nodes, so don't try to identify "ours" — just make
    // sure no separator is left dangling at either end of the list
    const container = $('.signin-view-container');
    if (!container) return;
    while (container.firstElementChild && container.firstElementChild.tagName === 'HR') {
      container.firstElementChild.remove();
    }
    while (container.lastElementChild && container.lastElementChild.tagName === 'HR') {
      container.lastElementChild.remove();
    }
  }

  /* ------------------------------------------------------------------ *
   *  Panel
   * ------------------------------------------------------------------ */
  function panel() {
    applyBrandVars();                       // re-check the brand colour on each step
    let p = $('#sbsms-panel');
    if (!p) {
      const container = $('.signin-view-container');
      if (!container) return null;
      container.classList.add('sbsms-hidden');
      p = document.createElement('div');
      p.id = 'sbsms-panel';
      p.className = 'sbsms-panel';
      container.parentElement.insertBefore(p, container.nextSibling);
    }
    return p;
  }

  function closePanel() {
    const p = $('#sbsms-panel');
    if (p) p.remove();
    const container = $('.signin-view-container');
    if (container) container.classList.remove('sbsms-hidden');
    dismissToast();
    clearInterval(state.resendTimer);
    state.account = null;
    state.code = null;
  }

  function openSms() { injectStyles(); applyBrandVars(); renderPhoneStep(); }

  function renderPhoneStep(prefill, error) {
    const p = panel();
    if (!p) return;
    p.innerHTML = `
      <h3>${t('phoneTitle')}</h3>
      <p class="sbsms-sub">${t('phoneIntro')}</p>
      ${error ? `<p class="sbsms-error">${error}</p>` : ''}
      <div class="sbsms-field">
        <label for="sbsms-phone">${t('phoneLabel')}</label>
        <input id="sbsms-phone" type="tel" inputmode="tel" autocomplete="tel"
               placeholder="${CONFIG.countryPrefix}79 123 45 67" value="${prefill || CONFIG.countryPrefix}">
      </div>
      <button class="sbsms-btn" id="sbsms-send">${t('send')}</button>
      <a class="sbsms-link" id="sbsms-back" role="button" tabindex="0">${t('otherMethod')}</a>
    `;

    const input = $('#sbsms-phone', p);
    const send  = $('#sbsms-send', p);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send.click(); });

    send.addEventListener('click', async () => {
      const raw = input.value.trim();
      if (raw.replace(/\D/g, '').length < 7) {
        return renderPhoneStep(raw, t('invalidNumber'));
      }
      send.disabled = true;
      send.textContent = t('sending');

      const account = await lookupNumber(raw);
      if (!account && CONFIG.revealUnknownNumbers) {
        return renderPhoneStep(raw, t('unknownNumber'));
      }

      state.phone   = raw;
      state.account = account;                 // null → unknown number: no code is ever issued
      state.code    = account ? makeCode() : null;
      setTimeout(() => {
        renderCodeStep();
        if (state.code) showToast(state.code);
      }, CONFIG.sendDelayMs);
    });

    $('#sbsms-back', p).addEventListener('click', closePanel);
  }

  function renderCodeStep(error) {
    const p = panel();
    if (!p) return;
    const boxes = Array.from({ length: CONFIG.codeLength })
      .map((_, i) => `<input type="text" inputmode="numeric" maxlength="1" data-i="${i}" aria-label="${t('digit', i + 1)}">`)
      .join('');
    p.innerHTML = `
      <h3>${t('codeTitle')}</h3>
      <p class="sbsms-sub">${t('codeIntro', CONFIG.codeLength)}<br><strong>${state.phone}</strong></p>
      ${error ? `<p class="sbsms-error">${error}</p>` : ''}
      <div class="sbsms-otp" id="sbsms-otp">${boxes}</div>
      <button class="sbsms-btn" id="sbsms-verify" disabled>${t('verify')}</button>
      <a class="sbsms-link" id="sbsms-resend" role="button" tabindex="0" aria-disabled="true">${t('resend')}</a><br>
      <a class="sbsms-link" id="sbsms-back" role="button" tabindex="0">${t('differentNumber')}</a>
    `;

    const wrap   = $('#sbsms-otp', p);
    const inputs = Array.from(wrap.querySelectorAll('input'));
    const verify = $('#sbsms-verify', p);
    const val    = () => inputs.map(i => i.value).join('');
    const sync   = () => { verify.disabled = val().length !== CONFIG.codeLength; };

    inputs.forEach((input, i) => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 1);
        if (input.value && inputs[i + 1]) inputs[i + 1].focus();
        sync();
        if (val().length === CONFIG.codeLength) verify.click();
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !input.value && inputs[i - 1]) inputs[i - 1].focus();
        if (e.key === 'ArrowLeft'  && inputs[i - 1]) inputs[i - 1].focus();
        if (e.key === 'ArrowRight' && inputs[i + 1]) inputs[i + 1].focus();
        if (e.key === 'Enter' && !verify.disabled) verify.click();
      });
      input.addEventListener('paste', e => {
        e.preventDefault();
        const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, CONFIG.codeLength);
        fillCode(digits);
      });
    });
    inputs[0].focus();

    verify.addEventListener('click', () => {
      if (!state.code || val() !== state.code) {
        wrap.classList.add('sbsms-shake');
        setTimeout(() => renderCodeStep(t('wrongCode')), 450);
        return;
      }
      dismissToast();
      renderSuccess();
    });

    // resend countdown
    const resend = $('#sbsms-resend', p);
    let left = CONFIG.resendSeconds;
    const tick = () => {
      if (left > 0) { resend.textContent = t('resendIn', left); left--; }
      else {
        clearInterval(state.resendTimer);
        resend.textContent = t('resend');
        resend.setAttribute('aria-disabled', 'false');
        resend.addEventListener('click', () => {
          if (!state.account) return renderCodeStep();     // unknown number: still no code
          state.code = makeCode();
          renderCodeStep();
          showToast(state.code);
        });
      }
    };
    clearInterval(state.resendTimer);
    tick();
    state.resendTimer = setInterval(tick, 1000);

    $('#sbsms-back', p).addEventListener('click', () => { dismissToast(); renderPhoneStep(state.phone); });
  }

  function fillCode(digits) {
    const inputs = Array.from(document.querySelectorAll('#sbsms-otp input'));
    if (!inputs.length) return;
    inputs.forEach((input, i) => { input.value = digits[i] || ''; });
    const verify = $('#sbsms-verify');
    if (verify) {
      verify.disabled = digits.length !== CONFIG.codeLength;
      (inputs[Math.min(digits.length, inputs.length - 1)] || inputs[0]).focus();
      if (digits.length === CONFIG.codeLength) verify.click();
    }
  }

  // One-time setup: the password is typed here, never written into this file
  function renderSecretSetup(done) {
    const p = panel();
    if (!p) return;
    const where = CONFIG.credentials.store === 'none' ? t('setupNotStored') : t('setupStored');
    p.innerHTML = `
      <h3>${t('setupTitle')}</h3>
      <p class="sbsms-sub">${t('setupPasswordFor', currentEmail())}<br>${where}</p>
      <div class="sbsms-field">
        <label for="sbsms-secret">${t('setupLabel')}</label>
        <input id="sbsms-secret" type="password" autocomplete="current-password">
      </div>
      <button class="sbsms-btn" id="sbsms-secret-save">${t('continueLabel')}</button>
      <a class="sbsms-link" id="sbsms-back" role="button" tabindex="0">${t('cancel')}</a>
    `;
    const input = $('#sbsms-secret', p);
    const save  = $('#sbsms-secret-save', p);
    input.focus();
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save.click(); });
    save.addEventListener('click', () => {
      if (!input.value) return input.focus();
      writeSecret(input.value);
      done();
    });
    $('#sbsms-back', p).addEventListener('click', closePanel);
  }

  function renderSuccess() {
    const p = panel();
    if (!p) return;
    if (CONFIG.onSuccess === 'none') {
      p.innerHTML = `<div class="sbsms-check">&#10003;</div><h3>${t('verified')}</h3>
        <p class="sbsms-sub">${t('confirmed', state.phone)}</p>
        <a class="sbsms-link" id="sbsms-back" role="button" tabindex="0">${t('backToSignIn')}</a>`;
      $('#sbsms-back', p).addEventListener('click', closePanel);
      return;
    }
    if (needsSecret() && !readSecret()) return renderSecretSetup(renderSuccess);
    p.innerHTML = `<div class="sbsms-spinner"></div><h3>${t('signingIn')}</h3>
      <p class="sbsms-sub">${t('verifying', state.phone)}</p>`;
    setTimeout(() => {
      finishLogin().catch(err => {
        p.innerHTML = `<h3>${t('failTitle')}</h3>
          <p class="sbsms-error">${err.message}</p>
          <a class="sbsms-link" id="sbsms-back" role="button" tabindex="0">${t('backToSignIn')}</a>
          ${needsSecret() ? `<br><a class="sbsms-link" id="sbsms-forget" role="button" tabindex="0">${t('reenter')}</a>` : ''}`;
        $('#sbsms-back', p).addEventListener('click', closePanel);
        const forget = $('#sbsms-forget', p);
        if (forget) forget.addEventListener('click', () => { clearSecret(); renderSecretSetup(renderSuccess); });
      });
    }, 700);
  }

  async function finishLogin() {
    if (CONFIG.onSuccess === 'sso') {
      const sso = $('[data-view-link="sso"]');
      if (!sso) throw new Error(t('errNoSso'));
      sso.click();
      return;
    }

    const email = currentEmail();

    // Drive the app's own sign-in form so the hidden fields stay correct
    let identifier = $('#identifier');
    if (!identifier) {
      const trigger = $('[data-view-link="signin"]');
      if (!trigger) throw new Error(t('errNoCredentials'));
      trigger.click();
      identifier = await waitFor('#identifier', 5000);
    }
    const secret = await waitFor('#secret', 5000);
    const form   = $('form.signin-form');

    if (CONFIG.credentials.useAutofill) {
      // hand over to the browser / OS password manager and wait for it to fill in
      const filled = await waitUntil(() => secret.value.length > 0, 4000);
      if (!filled) throw new Error(t('errNoAutofill'));
      if (!identifier.value && email && !/REPLACE_ME/.test(email)) setNativeValue(identifier, email);
    } else {
      if (!email || /REPLACE_ME/.test(email)) throw new Error(t('errNoAccount'));
      const password = readSecret();
      if (!password) throw new Error(t('errNoPassword'));
      setNativeValue(identifier, email);
      setNativeValue(secret, password);
    }

    await sleep(250);

    const submit = form && form.querySelector('button[type="submit"]');
    if (submit) submit.click();
    else if (form && form.requestSubmit) form.requestSubmit();
    else throw new Error(t('errNoForm'));
  }

  /* ------------------------------------------------------------------ *
   *  Fake SMS banner
   * ------------------------------------------------------------------ */
  // How far down the banner should start on this device
  function safeAreaTop() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;' +
                          'height:env(safe-area-inset-top,0px);';
    document.body.appendChild(probe);
    const h = probe.offsetHeight;
    probe.remove();
    return h;
  }

  function toastTop() {
    if (typeof CONFIG.toastTopOffset === 'number') return CONFIG.toastTopOffset;

    // viewport-fit=cover pages expose the real inset — 59px on a Dynamic Island iPhone
    const inset = safeAreaTop();
    if (inset > 0) return inset + 12;

    // Added to the home screen, the web view goes edge to edge but the page may
    // not opt into safe-area insets, so the island would sit on top of the banner
    const standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (iOS && standalone) return 59 + 12;

    // In Safari the browser chrome already pushes content below the island
    return 16;
  }

  function dismissToast() {
    const el = $('#sbsms-toast');
    if (!el) return;
    el.classList.add('sbsms-out');
    setTimeout(() => el.remove(), 300);
  }

  function showToast(code) {
    dismissToast();
    const el = document.createElement('div');
    el.id = 'sbsms-toast';
    el.className = 'sbsms-toast';
    el.setAttribute('role', 'status');
    // the iOS Messages glyph: a speech bubble with a tail on the lower left
    const bubble = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5C8.8 5 3 9.7 3 15.5c0 3.3 1.9 6.2 4.8 8.1-.2 1.6-1 3.6-2.5 5.2-.2.2 0 .5.3.4 3-.6 5.5-2 7-3.2 1.1.3 2.2.4 3.4.4 7.2 0 13-4.7 13-10.9S23.2 5 16 5z"/></svg>';
    el.innerHTML = `
      <div class="sbsms-icon sbsms-icon-${CONFIG.smsIcon === 'brand' ? 'brand' : 'messages'}">${bubble}</div>
      <div class="sbsms-text">
        <div class="sbsms-head">
          <span class="sbsms-sender">${CONFIG.senderName}</span>
          <span class="sbsms-time">${t('now')}</span>
        </div>
        <div class="sbsms-body">${t('smsBody', code)}</div>
        ${CONFIG.autofillOnTap && CONFIG.showTapHint ? `<div class="sbsms-hint">${t('smsHint')}</div>` : ''}
      </div>`;
    if (CONFIG.autofillOnTap) el.addEventListener('click', () => { fillCode(code); dismissToast(); });
    el.style.top = toastTop() + 'px';   // measured per demo, so rotating the phone is fine
    document.body.appendChild(el);
    setTimeout(dismissToast, 25000);
  }

  /* ------------------------------------------------------------------ *
   *  Boot — the sign-in screen is re-rendered by the SPA, so keep watching
   * ------------------------------------------------------------------ */
  function boot() {
    injectStyles();
    applyBrandVars();
    const container = $('.signin-view-container');
    if (!container || $('#sbsms-panel')) return;      // our own flow owns the screen
    if (isSelectionScreen(container)) injectEntry();
    else removeEntry();                                // a method was picked — stand down
  }

  boot();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    // setTimeout, not requestAnimationFrame: rAF never fires while the tab is
    // hidden (phone locked, app switched), which would leave this flag stuck
    // at true and the script permanently dead
    setTimeout(() => {
      queued = false;
      try { boot(); } catch (e) { /* keep watching regardless */ }
    }, 50);
  }).observe(document.body, { childList: true, subtree: true });
})();
