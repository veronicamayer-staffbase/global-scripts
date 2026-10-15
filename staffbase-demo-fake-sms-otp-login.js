// ==UserScript==
// @name         Staffbase Demo — Fake SMS (OTP) Login
// @namespace    staffbase-demo
// @version      1.0
// @description  DEMO ONLY: adds a mock "Sign in with SMS code" step to the Staffbase sign-in screen. The OTP is generated in the browser and shown in a fake SMS banner — no messages are sent anywhere.
// @match        https://migrosdemo.staffbase.rocks/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  CONFIG — the only part you normally touch
   * ------------------------------------------------------------------ */
  const CONFIG = {
    buttonLabel:    'Sign in with SMS code',
    senderName:     'Migros',          // sender shown in the fake SMS banner
    countryPrefix:  '+49 ',            // pre-filled in the phone field
    codeLength:     6,
    fixedCode:      null,              // e.g. '123456' → always this code; null = random
    sendDelayMs:    1200,              // fake "network" delay before the SMS arrives
    resendSeconds:  30,
    entryPosition:  'top',             // 'top' | 'bottom' of the sign-in options
    autofillOnTap:  true,              // tapping the SMS banner fills the code

    // What happens once the code is accepted:
    //   'credentials' → fills + submits the REAL sign-in form (needs demoAccount below)
    //   'sso'         → clicks the native "Sign in with Migros SSO" button
    //   'none'        → stops at the success screen (pure UI demo)
    onSuccess: 'none',

    // Throwaway demo account ONLY — this sits in plain text in the browser.
    demoAccount: {
      email:    'REPLACE_ME@example.com',
      password: 'REPLACE_ME'
    }
  };

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

  // React-safe value assignment
  function setNativeValue(el, value) {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function brandColor() {
    const btn = $('.signin-view-container .type-uncollapse');
    if (btn) {
      const bg = getComputedStyle(btn).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    }
    return '#F27022';
  }

  function makeCode() {
    if (CONFIG.fixedCode) return String(CONFIG.fixedCode);
    let c = '';
    for (let i = 0; i < CONFIG.codeLength; i++) c += Math.floor(Math.random() * 10);
    return c;
  }

  const state = { code: null, phone: null, resendTimer: null };

  /* ------------------------------------------------------------------ *
   *  Styles
   * ------------------------------------------------------------------ */
  function injectStyles() {
    if ($('#sbsms-styles')) return;
    const css = `
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

      .sbsms-toast { position:fixed; top:16px; right:16px; width:350px; max-width:calc(100vw - 24px); z-index:2147483000;
        background:rgba(250,250,250,.92); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
        border:1px solid rgba(0,0,0,.08); border-radius:16px; box-shadow:0 12px 34px rgba(0,0,0,.22);
        padding:12px 14px; display:flex; gap:11px; color:#111; text-align:left; cursor:pointer;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; animation:sbsms-drop .35s cubic-bezier(.2,.9,.3,1.3); }
      @keyframes sbsms-drop { from { opacity:0; transform:translateY(-24px) scale(.96);} to { opacity:1; transform:none;} }
      .sbsms-toast.sbsms-out { opacity:0; transform:translateY(-16px); transition:all .3s ease; }
      .sbsms-toast .sbsms-icon { flex:0 0 38px; height:38px; border-radius:9px; background:var(--sbsms-brand);
        display:flex; align-items:center; justify-content:center; }
      .sbsms-toast .sbsms-icon svg { width:21px; height:21px; fill:#fff; }
      .sbsms-toast .sbsms-head { display:flex; justify-content:space-between; font-size:.74rem; font-weight:700;
        text-transform:uppercase; letter-spacing:.03em; opacity:.6; margin-bottom:2px; }
      .sbsms-toast .sbsms-body { font-size:.86rem; line-height:1.35; }
      .sbsms-toast .sbsms-body b { font-size:1rem; letter-spacing:.09em; }
      .sbsms-toast .sbsms-hint { margin-top:5px; font-size:.7rem; opacity:.5; }
      @media (max-width:520px) { .sbsms-toast { left:12px; right:12px; width:auto; } }
    `;
    const tag = document.createElement('style');
    tag.id = 'sbsms-styles';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function applyBrandVars() {
    const brand = brandColor();
    const btn = $('.signin-view-container .type-uncollapse');
    document.documentElement.style.setProperty('--sbsms-brand', brand);
    if (btn) {
      const cs = getComputedStyle(btn);
      document.documentElement.style.setProperty('--sbsms-brand-text', cs.color);
      document.documentElement.style.setProperty('--sbsms-radius', cs.borderRadius);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Entry button in the native sign-in options
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
    btn.textContent = CONFIG.buttonLabel;
    btn.addEventListener('click', openSms);

    const rule = makeRule();

    if (CONFIG.entryPosition === 'bottom') {
      view.appendChild(btn);
      container.appendChild(rule);
      container.appendChild(view);
    } else {
      // the "Sign In" headline travels with us so it stays on top and stays centred
      const headline = container.querySelector('.view-headline');
      if (headline) view.appendChild(headline);
      view.appendChild(btn);
      container.insertBefore(rule, container.firstChild);
      container.insertBefore(view, container.firstChild);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Panel
   * ------------------------------------------------------------------ */
  function panel() {
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
  }

  function openSms() {
    injectStyles();
    applyBrandVars();
    renderPhoneStep();
  }

  function renderPhoneStep(prefill, error) {
    const p = panel();
    if (!p) return;
    p.innerHTML = `
      <h3>Sign In With SMS</h3>
      <p class="sbsms-sub">Enter your mobile number and we'll text you a one-time code.</p>
      ${error ? `<p class="sbsms-error">${error}</p>` : ''}
      <div class="sbsms-field">
        <label for="sbsms-phone">Mobile number</label>
        <input id="sbsms-phone" type="tel" inputmode="tel" autocomplete="tel"
               placeholder="${CONFIG.countryPrefix}79 123 45 67" value="${prefill || CONFIG.countryPrefix}">
      </div>
      <button class="sbsms-btn" id="sbsms-send">Send code</button>
      <a class="sbsms-link" id="sbsms-back" role="button" tabindex="0">Sign in using a different method?</a>
    `;

    const input = $('#sbsms-phone', p);
    const send  = $('#sbsms-send', p);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send.click(); });

    send.addEventListener('click', () => {
      const raw = input.value.trim();
      if (raw.replace(/\D/g, '').length < 7) {
        return renderPhoneStep(raw, 'Please enter a valid mobile number.');
      }
      state.phone = raw;
      state.code  = makeCode();
      send.disabled = true;
      send.textContent = 'Sending…';
      setTimeout(() => {
        renderCodeStep();
        showToast(state.code);
      }, CONFIG.sendDelayMs);
    });

    $('#sbsms-back', p).addEventListener('click', closePanel);
  }

  function renderCodeStep(error) {
    const p = panel();
    if (!p) return;
    const boxes = Array.from({ length: CONFIG.codeLength })
      .map((_, i) => `<input type="text" inputmode="numeric" maxlength="1" data-i="${i}" aria-label="Digit ${i + 1}">`)
      .join('');
    p.innerHTML = `
      <h3>Enter your code</h3>
      <p class="sbsms-sub">We sent a ${CONFIG.codeLength}-digit code to<br><strong>${state.phone}</strong></p>
      ${error ? `<p class="sbsms-error">${error}</p>` : ''}
      <div class="sbsms-otp" id="sbsms-otp">${boxes}</div>
      <button class="sbsms-btn" id="sbsms-verify" disabled>Verify &amp; sign in</button>
      <a class="sbsms-link" id="sbsms-resend" role="button" tabindex="0" aria-disabled="true">Resend code</a><br>
      <a class="sbsms-link" id="sbsms-back" role="button" tabindex="0">Use a different number</a>
    `;

    const wrap   = $('#sbsms-otp', p);
    const inputs = Array.from(wrap.querySelectorAll('input'));
    const verify = $('#sbsms-verify', p);
    const value  = () => inputs.map(i => i.value).join('');
    const sync   = () => { verify.disabled = value().length !== CONFIG.codeLength; };

    inputs.forEach((input, i) => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 1);
        if (input.value && inputs[i + 1]) inputs[i + 1].focus();
        sync();
        if (value().length === CONFIG.codeLength) verify.click();
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
      if (value() !== state.code) {
        wrap.classList.add('sbsms-shake');
        setTimeout(() => renderCodeStep('That code isn’t right. Please try again.'), 450);
        return;
      }
      dismissToast();
      renderSuccess();
    });

    // resend countdown
    const resend = $('#sbsms-resend', p);
    let left = CONFIG.resendSeconds;
    const tick = () => {
      if (left > 0) { resend.textContent = `Resend code in ${left}s`; left--; }
      else {
        clearInterval(state.resendTimer);
        resend.textContent = 'Resend code';
        resend.setAttribute('aria-disabled', 'false');
        resend.addEventListener('click', () => {
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

  function renderSuccess() {
    const p = panel();
    if (!p) return;
    if (CONFIG.onSuccess === 'none') {
      p.innerHTML = `<div class="sbsms-check">&#10003;</div><h3>Number verified</h3>
        <p class="sbsms-sub">${state.phone} is confirmed.</p>
        <a class="sbsms-link" id="sbsms-back" role="button" tabindex="0">Back to sign in</a>`;
      $('#sbsms-back', p).addEventListener('click', closePanel);
      return;
    }
    p.innerHTML = `<div class="sbsms-spinner"></div><h3>Signing you in…</h3>
      <p class="sbsms-sub">Verifying ${state.phone}</p>`;
    setTimeout(() => {
      finishLogin().catch(err => {
        p.innerHTML = `<h3>Couldn’t complete sign-in</h3>
          <p class="sbsms-error">${err.message}</p>
          <a class="sbsms-link" id="sbsms-back" role="button" tabindex="0">Back to sign in</a>`;
        $('#sbsms-back', p).addEventListener('click', closePanel);
      });
    }, 700);
  }

  async function finishLogin() {
    if (CONFIG.onSuccess === 'sso') {
      const sso = $('[data-view-link="sso"]');
      if (!sso) throw new Error('SSO button not found on this screen.');
      sso.click();
      return;
    }

    const { email, password } = CONFIG.demoAccount;
    if (!email || !password || /REPLACE_ME/.test(email) || /REPLACE_ME/.test(password)) {
      throw new Error('No demo account configured — set CONFIG.demoAccount in the script.');
    }

    // Drive the app's own sign-in form so the hidden fields stay correct
    let identifier = $('#identifier');
    if (!identifier) {
      const trigger = $('[data-view-link="signin"]');
      if (!trigger) throw new Error('Credentials sign-in is not available on this screen.');
      trigger.click();
      identifier = await waitFor('#identifier', 5000);
    }
    const secret = await waitFor('#secret', 5000);
    const form   = $('form.signin-form');

    setNativeValue(identifier, email);
    setNativeValue(secret, password);
    await sleep(250);

    const submit = form && form.querySelector('button[type="submit"]');
    if (submit) submit.click();
    else if (form && form.requestSubmit) form.requestSubmit();
    else throw new Error('Sign-in form not found.');
  }

  /* ------------------------------------------------------------------ *
   *  Fake SMS banner
   * ------------------------------------------------------------------ */
  function dismissToast() {
    const t = $('#sbsms-toast');
    if (!t) return;
    t.classList.add('sbsms-out');
    setTimeout(() => t.remove(), 300);
  }

  function showToast(code) {
    dismissToast();
    const t = document.createElement('div');
    t.id = 'sbsms-toast';
    t.className = 'sbsms-toast';
    t.setAttribute('role', 'status');
    t.innerHTML = `
      <div class="sbsms-icon">
        <svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
      </div>
      <div style="flex:1">
        <div class="sbsms-head"><span>${CONFIG.senderName}</span><span>now</span></div>
        <div class="sbsms-body">Your verification code is <b>${code}</b>. It expires in 5 minutes.</div>
        ${CONFIG.autofillOnTap ? '<div class="sbsms-hint">Tap to fill automatically</div>' : ''}
      </div>`;
    if (CONFIG.autofillOnTap) t.addEventListener('click', () => { fillCode(code); dismissToast(); });
    document.body.appendChild(t);
    setTimeout(dismissToast, 25000);
  }

  /* ------------------------------------------------------------------ *
   *  Boot — the sign-in screen is re-rendered by the SPA, so keep watching
   * ------------------------------------------------------------------ */
  function boot() {
    injectStyles();
    injectEntry();
  }

  boot();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; if (!$('#sbsms-panel')) boot(); });
  }).observe(document.body, { childList: true, subtree: true });
})();
