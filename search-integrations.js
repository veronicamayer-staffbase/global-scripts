// ==UserScript==
// @name         Staffbase Search – SAP SuccessFactors & ServiceNow (Demo)
// @namespace    staffbase.demo.veronica
// @version      1.0.0
// @description  Adds two fake external search integrations (SAP SuccessFactors + ServiceNow) to the Staffbase search page, with results that depend on the search term (q) in the URL. Purely visual demo overlay – no backend.
// @match        https://mercedesdemo.staffbase.rocks/search*
// @match        https://*.staffbase.rocks/search*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__tmStaffbaseSearchLoaded) return;
  window.__tmStaffbaseSearchLoaded = true;

  /* =========================================================================
   * 1. ICONS  (embedded as data-URIs so nothing is blocked by CSP)
   *    - successfactors: official SAP SuccessFactors logo (base64 PNG)
   *    - servicenow: official ServiceNow logo (base64 PNG)
   * ======================================================================= */
  const svgURI = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);

  const ICON = {
    successfactors: 'data:image/png;base64,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',
    servicenow: 'data:image/png;base64,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'
  };

  /* =========================================================================
   * 2. RESULT DATA
   *    DATA[integration][queryType] = [ {title, path, desc} ]
   *    queryType is derived from the ?q= url parameter:
   *      - contains "benefits"        -> "benefits"
   *      - contains "arbeitskleidung" -> "arbeitskleidung"
   *      - anything else              -> "random"
   * ======================================================================= */
  const DATA = {
    successfactors: {
      benefits: [
        { title: 'Benefits Open Enrollment 2027',
          path: 'SAP SuccessFactors › Employee Central › Benefits › Open Enrollment',
          desc: 'Review and elect your medical, dental and vision coverage for the 2027 plan year. Enrollment closes 15 December – elections take effect 1 January.' },
        { title: 'Health Insurance Plan Comparison',
          path: 'SAP SuccessFactors › Employee Central › Benefits › Health',
          desc: 'Compare the PPO and HDHP plans side by side – premiums, deductibles, co-pays and out-of-pocket maximums – to pick the coverage that fits your family.' },
        { title: 'Company Pension & Retirement Savings',
          path: 'SAP SuccessFactors › Employee Central › Benefits › Retirement',
          desc: 'View your company pension balance, the employer match and update your monthly retirement deferral rate.' },
        { title: 'Life Event – Add a Dependent',
          path: 'SAP SuccessFactors › Employee Central › Personal Information › Life Events',
          desc: 'Had a baby, got married or moved in together? Report a qualifying life event to update your coverage outside of the open enrollment window.' },
        { title: 'Employee Assistance Program (EAP)',
          path: 'SAP SuccessFactors › Employee Central › Benefits › Wellbeing',
          desc: 'Confidential counseling, legal and financial support available 24/7 to all employees and the people in their household – at no cost.' },
        { title: 'Total Rewards Statement 2026',
          path: 'SAP SuccessFactors › Compensation › Total Rewards',
          desc: 'See the full value of your package – base salary, bonus, employer-paid benefits and pension contributions – in one personalized statement.' }
      ],
      arbeitskleidung: [
        { title: 'Richtlinie Arbeitskleidung & PSA',
          path: 'SAP SuccessFactors › Employee Central › Dokumente › Richtlinien',
          desc: 'Übersicht der Bekleidungspauschale, der anspruchsberechtigten Rollen sowie der Erstattungsgrenzen pro Kalenderjahr.' },
        { title: 'Onboarding-Aufgabe: Arbeitsausstattung',
          path: 'SAP SuccessFactors › Onboarding › Aufgaben',
          desc: 'Offene Onboarding-Aufgabe: Konfektionsgrößen für Arbeitskleidung erfassen und die Erstausstattung bestätigen.' },
        { title: 'Pflichtschulung: Persönliche Schutzausrüstung (PSA)',
          path: 'SAP SuccessFactors › Learning › Pflichtkurse',
          desc: 'Jährliche Unterweisung zum richtigen Tragen und Prüfen von Schutzkleidung. Dauer ca. 20 Minuten, Abschluss wird automatisch im Lernverlauf dokumentiert.' },
        { title: 'Bekleidungspauschale – Auszahlungsstatus',
          path: 'SAP SuccessFactors › Employee Central Payroll › Zahlungen',
          desc: 'Verfolgen Sie den Status Ihrer Bekleidungspauschale bis zur Auszahlung mit der nächsten Gehaltsabrechnung.' },
        { title: 'Stammdaten: Arbeitsplatz & Schutzausrüstung',
          path: 'SAP SuccessFactors › Employee Central › Stellenprofil',
          desc: 'Zugeordnete Rolle, Standort und Gefährdungskategorie – maßgeblich für Ihren Anspruch auf Arbeits- und Schutzkleidung.' }
      ],
      random: [
        { title: 'Meine Gehaltsabrechnung – September 2026',
          path: 'SAP SuccessFactors › Employee Central Payroll › Entgeltabrechnung',
          desc: 'Ihre aktuelle Gehaltsabrechnung steht bereit. Öffnen Sie das Dokument, um Brutto, Netto und Abzüge im Detail einzusehen.' },
        { title: 'Abwesenheit beantragen',
          path: 'SAP SuccessFactors › Employee Central › Time Off',
          desc: 'Beantragen Sie Urlaub, prüfen Sie Ihr Resturlaubskonto und sehen Sie den Genehmigungsstatus Ihrer Führungskraft.' },
        { title: 'Organigramm',
          path: 'SAP SuccessFactors › Employee Central › Organisation',
          desc: 'Interaktives Organigramm Ihres Teams und der angrenzenden Bereiche inklusive Positionen und Berichtslinien.' },
        { title: 'Zielvereinbarung & Leistungsbeurteilung 2026',
          path: 'SAP SuccessFactors › Performance & Goals › Beurteilung',
          desc: 'Ihre Ziele und das Formular für die Mitarbeiterbeurteilung im aktuellen Zyklus sind zur Bearbeitung freigegeben.' },
        { title: 'Lernkurs: Arbeitssicherheit Grundlagen',
          path: 'SAP SuccessFactors › Learning › Meine Kurse',
          desc: 'Pflichtschulung zur Arbeitssicherheit. Dauer ca. 35 Minuten, abzuschließen bis Ende des Quartals.' },
        { title: 'Persönliche Daten aktualisieren',
          path: 'SAP SuccessFactors › Employee Central › Persönliche Informationen',
          desc: 'Adresse, Bankverbindung und Notfallkontakt selbst pflegen – Änderungen werden automatisch an HR und Payroll übermittelt.' },
        { title: 'Entwicklungsplan & Nachfolge',
          path: 'SAP SuccessFactors › Succession & Development › Mein Entwicklungsplan',
          desc: 'Legen Sie Karriereziele und Entwicklungsmaßnahmen fest und sehen Sie passende Rollen in Ihrem Talentprofil.' },
        { title: 'Interne Stellenausschreibungen',
          path: 'SAP SuccessFactors › Recruiting › Interne Jobs',
          desc: 'Aktuell offene Positionen im Unternehmen. Bewerben Sie sich intern mit einem Klick über Ihr Talentprofil.' }
      ]
    },

    servicenow: {
      benefits: [
        { title: 'HR Case: Benefits Question',
          path: 'ServiceNow › HR Service Delivery › Cases',
          desc: 'Open an HR case to ask about medical coverage, dependents or your benefits confirmation statement. Typical first response within one business day.' },
        { title: 'Knowledge: Benefits FAQ',
          path: 'ServiceNow › Knowledge Base › HR',
          desc: 'Frequently asked questions about enrollment windows, plan changes, qualifying life events and how contributions appear on your payslip.' },
        { title: 'Order Replacement Insurance ID Cards',
          path: 'ServiceNow › Service Catalog › HR Services',
          desc: 'Request replacement medical and dental insurance ID cards to be mailed to your home address. Digital copies are available immediately.' },
        { title: 'Update Beneficiary Information',
          path: 'ServiceNow › Service Catalog › HR Services',
          desc: 'Submit a request to change the beneficiaries on your life insurance and retirement accounts. Routed to HR for verification.' },
        { title: 'Benefits Enrollment Support Ticket',
          path: 'ServiceNow › HR Service Delivery › Cases',
          desc: 'Having trouble completing your enrollment? Raise a ticket and an HR specialist will follow up to help you finish your elections.' }
      ],
      arbeitskleidung: [
        { title: 'Arbeitskleidung bestellen',
          path: 'ServiceNow › Service-Katalog › Facility & Ausstattung',
          desc: 'Bestellen Sie Ihre standardmäßige Arbeitskleidung (Hose, Jacke, Poloshirt) in Ihrer hinterlegten Konfektionsgröße. Lieferung an Ihren Standort in 5–7 Tagen.' },
        { title: 'Sicherheitsschuhe bestellen',
          path: 'ServiceNow › Service-Katalog › Arbeitsschutz',
          desc: 'Ordern Sie zertifizierte Sicherheitsschuhe (S3) inklusive Größenassistent. Genehmigung durch die Führungskraft erfolgt automatisch.' },
        { title: 'Warnschutzkleidung nachbestellen',
          path: 'ServiceNow › Service-Katalog › Arbeitsschutz',
          desc: 'Nachbestellung von Warnwesten und Hi-Vis-Jacken für Mitarbeitende in Produktion und Logistik. Ersatz für verschlissene Kleidung inklusive.' },
        { title: 'Namensschild & Werksausweis anfordern',
          path: 'ServiceNow › Service-Katalog › Facility & Ausstattung',
          desc: 'Beantragen Sie ein besticktes Namensschild oder einen Ersatz für Ihren Werksausweis inklusive Fotoupload.' },
        { title: 'Winterarbeitskleidung – Saisonale Ausgabe',
          path: 'ServiceNow › Service-Katalog › Arbeitsschutz',
          desc: 'Saisonale Bestellung von gefütterten Jacken und Thermokleidung für Außeneinsätze. Ausgabefenster: Oktober bis Dezember.' },
        { title: 'Status meiner Bestellung (RITM0048213)',
          path: 'ServiceNow › Meine Anfragen',
          desc: 'Verfolgen Sie den Genehmigungs- und Lieferstatus Ihrer aktuellen Arbeitskleidungsbestellung in Echtzeit.' }
      ],
      random: [
        { title: 'Passwort zurücksetzen',
          path: 'ServiceNow › Service-Katalog › IT-Services',
          desc: 'Setzen Sie Ihr Windows-/Netzwerkpasswort selbst zurück. Der Self-Service ist rund um die Uhr verfügbar.' },
        { title: 'Neuen Laptop bestellen',
          path: 'ServiceNow › Service-Katalog › Hardware',
          desc: 'Wählen Sie ein Standardgerät aus dem genehmigten Katalog. Die Bestellung wird automatisch an Ihre Führungskraft zur Freigabe geleitet.' },
        { title: 'VPN-Zugang beantragen',
          path: 'ServiceNow › Service-Katalog › IT-Services',
          desc: 'Fordern Sie Remote-Zugriff auf das Unternehmensnetzwerk an. Aktivierung nach Genehmigung innerhalb weniger Stunden.' },
        { title: 'Software-Installation anfordern',
          path: 'ServiceNow › Service-Katalog › Software',
          desc: 'Beantragen Sie lizenzierte Software für Ihr Gerät. Installation erfolgt automatisiert über den Software-Center-Client.' },
        { title: 'Störung melden (Incident)',
          path: 'ServiceNow › Incident Management',
          desc: 'Melden Sie eine technische Störung. Beschreiben Sie das Problem – das System schlägt passende Lösungsartikel vor.' },
        { title: 'Besprechungsraum-Technik defekt',
          path: 'ServiceNow › Facility Services',
          desc: 'Melden Sie defekte Beamer, Displays oder Konferenztechnik im Meetingraum. Facility Management reagiert am selben Tag.' },
        { title: 'Zugriff auf Netzlaufwerk',
          path: 'ServiceNow › Service-Katalog › IT-Services',
          desc: 'Beantragen Sie Lese- oder Schreibrechte auf ein Abteilungslaufwerk. Freigabe durch den Datei-Owner erforderlich.' },
        { title: 'Mein offenes Ticket #INC0294412',
          path: 'ServiceNow › Meine Anfragen',
          desc: 'Status: In Bearbeitung. Zugewiesen an den Service Desk. Letztes Update vor 2 Stunden.' }
      ]
    }
  };

  const INTEGRATIONS = [
    { id: 'successfactors', label: 'SAP SuccessFactors' },
    { id: 'servicenow', label: 'ServiceNow' }
  ];

  /* =========================================================================
   * 3. HELPERS
   * ======================================================================= */
  const PRESSED_CLS =
    'category-button text-sm gap-2 rounded-md px-3 py-0 flex min-h-[32px] w-full items-center ' +
    'focus-visible:shadow-focus focus-visible:outline-none bg-primary-vivid text-neutral-inverse ' +
    'hover:bg-primary-vivid cursor-default';
  const UNPRESSED_CLS =
    'category-button text-sm gap-2 rounded-md px-3 py-0 flex min-h-[32px] w-full items-center ' +
    'focus-visible:shadow-focus focus-visible:outline-none text-neutral-strong ' +
    'hover:bg-neutral-base-hover disabled:cursor-not-allowed disabled:opacity-40';

  function currentS() {
    return new URLSearchParams(location.search).get('s');
  }
  function queryType() {
    const q = (new URLSearchParams(location.search).get('q') || '').toLowerCase();
    if (q.indexOf('benefits') !== -1) return 'benefits';
    if (q.indexOf('arbeitskleidung') !== -1) return 'arbeitskleidung';
    return 'random';
  }
  function itemsFor(id) {
    return (DATA[id] && DATA[id][queryType()]) || [];
  }
  function getIntegrationUl() {
    const anchor = document.querySelector('li[data-c13y-id="googleDrive"], li[data-c13y-id="m365"]');
    return anchor ? anchor.closest('ul') : null;
  }
  function getMainPanel() {
    return [...document.querySelectorAll('div.min-w-0.flex-1')]
      .find(d => (d.className || '').indexOf('pb-[') !== -1) || null;
  }

  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* =========================================================================
   * 4. SIDEBAR ITEMS
   * ======================================================================= */
  function buildSidebarLi(cfg) {
    return el(
      '<li class="gap-2 relative flex flex-col" data-c13y-component="item" ' +
      'data-c13y-id="' + cfg.id + '" data-tm-custom="1">' +
        '<button type="button" aria-pressed="false" class="' + UNPRESSED_CLS + '">' +
          '<span class="h-4 w-4 flex shrink-0 items-center justify-center">' +
            '<img width="16" height="16" alt="' + esc(cfg.label) + '" src="' + ICON[cfg.id] + '">' +
          '</span>' +
          '<span class="min-w-0 flex-1 truncate text-start">' + esc(cfg.label) + '</span>' +
          '<span class="md:flex hidden shrink-0 items-center">' +
            '<span class="text-sm text-neutral-medium" data-tm-count>0</span>' +
          '</span>' +
        '</button>' +
      '</li>'
    );
  }

  function ensureSidebar() {
    const ul = getIntegrationUl();
    if (!ul) return;
    INTEGRATIONS.forEach(cfg => {
      let li = ul.querySelector('li[data-tm-custom][data-c13y-id="' + cfg.id + '"]');
      if (!li) {
        li = buildSidebarLi(cfg);
        ul.appendChild(li);
        li.querySelector('button').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const u = new URL(location.href);
          u.searchParams.set('s', cfg.id);
          history.replaceState(history.state, '', u.toString());
          render();
        });
      }
      // keep the count in sync with the current query type
      const countEl = li.querySelector('[data-tm-count]');
      if (countEl) countEl.textContent = String(itemsFor(cfg.id).length);
    });
  }

  function setPressedStates(activeId) {
    const ul = getIntegrationUl();
    if (!ul) return;
    ul.querySelectorAll('li[data-c13y-id] > button').forEach(btn => {
      const id = btn.closest('li').getAttribute('data-c13y-id');
      const shouldPress = id === activeId;
      const isCustom = !!btn.closest('li').getAttribute('data-tm-custom');
      // Only ever change the *custom* buttons' pressed styling ourselves;
      // for native buttons we just make sure they look unpressed while a
      // custom integration is active.
      if (isCustom) {
        const wantCls = shouldPress ? PRESSED_CLS : UNPRESSED_CLS;
        if (btn.className !== wantCls) btn.className = wantCls;
        const want = shouldPress ? 'true' : 'false';
        if (btn.getAttribute('aria-pressed') !== want) btn.setAttribute('aria-pressed', want);
      } else if (activeId && INTEGRATIONS.some(i => i.id === activeId)) {
        // a custom integration is active -> native ones must not look selected
        if (btn.className.indexOf('bg-primary-vivid') !== -1 && btn.className !== UNPRESSED_CLS) {
          btn.className = UNPRESSED_CLS;
          btn.setAttribute('aria-pressed', 'false');
        }
      }
    });
  }

  /* =========================================================================
   * 5. RESULTS PANEL
   * ======================================================================= */
  const CAL_PATH = 'M21.5,3H18.75a.25.25,0,0,1-.25-.25V1a1,1,0,0,0-2,0v4.75a.75.75,0,0,1-.75.75h0a.75.75,0,0,1-.75-.75V3.5a.5.5,0,0,0-.5-.5H8.25A.25.25,0,0,1,8,2.751V1A1,1,0,1,0,6,1v4.75a.75.75,0,0,1-.75.75h0a.75.75,0,0,1-.75-.75V3.5A.5.5,0,0,0,4,3H2.5a2,2,0,0,0-2,2V22a2,2,0,0,0,2,2h19a2,2,0,0,0,2-2V5A2,2,0,0,0,21.5,3ZM21,22H3a.5.5,0,0,1-.5-.5V9.5A.5.5,0,0,1,3,9H21a.5.5,0,0,1,.5.5v12A.5.5,0,0,1,21,22Z';

  function buildArticle(item, cfg) {
    return el(
      '<li>' +
        '<article data-c13y-component="item" class="group gap-4 bg-neutral-surface ease-in-out relative flex w-full max-w-[816px] rounded-(--border-radius-root) transition-colors duration-75 hover:bg-neutral-surface-hover active:bg-neutral-surface-pressed">' +
          '<a href="#" data-c13y-component="link" data-tm-result="1" class="gap-3 p-4 max-md:px-2 max-md:py-2 ease-in-out flex w-full items-center transition-colors duration-75 focus-visible:outline-none has-data-search-meta:has-data-search-content:items-start">' +
            '<div class="!h-[60px] min-h-[60px] !w-[60px] min-w-[60px] overflow-hidden rounded-(--border-radius-root)">' +
              '<div class="!h-[60px] !w-[60px] flex items-center justify-center rounded-(--border-radius-root) bg-neutral-base group-hover:bg-neutral-medium ease-in-out transition-colors duration-75">' +
                '<img alt="" class="object-contain object-center" height="20" width="20" src="' + ICON[cfg.id] + '">' +
              '</div>' +
            '</div>' +
            '<div class="result meta min-w-0 gap-1 text-body-sm flex flex-col">' +
              '<div class="gap-2 min-w-0 flex items-center">' +
                '<h3 class="text-title-md text-neutral-strong min-w-0 max-md:line-clamp-2 line-clamp-1" data-c13y-component="title">' + esc(item.title) + '</h3>' +
              '</div>' +
              '<div data-search-meta="true" class="gap-1 flex flex-col">' +
                '<div class="gap-1 text-sm leading-18 flex">' +
                  '<ol class="min-w-0 gap-1 flex overflow-hidden">' +
                    '<li class="min-w-0 gap-1 flex"><span class="min-w-0 text-primary-vivid truncate">' + esc(item.path) + '</span></li>' +
                  '</ol>' +
                '</div>' +
              '</div>' +
              '<span data-search-content="true" class="text-sm leading-18 text-neutral-strong line-clamp-2" data-c13y-component="paragraph" data-c13y-purpose="description">' + esc(item.desc) + '</span>' +
            '</div>' +
          '</a>' +
        '</article>' +
      '</li>'
    );
  }

  function buildPanel(cfg) {
    const items = itemsFor(cfg.id);

    const panel = el(
      '<div class="search__results gap-8 px-4 py-3 max-md:p-0 flex max-w-[1156px] flex-col" id="tm-cust-panel">' +
        '<div class="flex-1 overflow-auto">' +
          '<div class="h-10 flex items-center justify-between" data-tm-header="1">' +
            '<hgroup class="gap-3 px-4 flex items-baseline">' +
              '<img alt="' + esc(cfg.label) + '" class="object-cover object-center" height="18" width="18" src="' + ICON[cfg.id] + '">' +
              '<h2 class="text-title-lg text-(--sb-color-grey-800)" data-c13y-component="title">' + esc(cfg.label) + '</h2>' +
            '</hgroup>' +
            '<div class="space-between gap-3 flex">' +
              '<button type="button" data-tm-datefilter="1" class="ds-select__trigger max-md:hidden w-[240px] shadow-none">' +
                '<div class="ds-select__trigger-content">' +
                  '<svg aria-hidden="true" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="ds-icon ds-icon-calendar text-icon-neutral-medium text-[12px]"><path d="' + CAL_PATH + '"></path></svg>' +
                  '<span class="text-ellipsis whitespace-nowrap">Alle Daten</span>' +
                '</div>' +
                '<span aria-hidden="true" class="ds-select__icon">' +
                  '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="ds-icon ds-icon-caret-down"><path d="M7 10l5 5 5-5z"></path></svg>' +
                '</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="search__results gap-8 py-4 flex max-w-[1156px] flex-col">' +
            '<ul class="flex flex-col" data-tm-list="1"></ul>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    const list = panel.querySelector('[data-tm-list]');
    items.forEach(it => list.appendChild(buildArticle(it, cfg)));
    panel.dataset.sig = cfg.id + '|' + queryType();
    return panel;
  }

  function showCustom(cfg) {
    const main = getMainPanel();
    if (!main) return;
    // hide the native content
    [...main.children].forEach(c => {
      if (c.id !== 'tm-cust-panel' && c.style.display !== 'none') c.style.display = 'none';
    });
    // (re)build our panel only when the signature changed
    const existing = main.querySelector('#tm-cust-panel');
    const sig = cfg.id + '|' + queryType();
    if (existing && existing.dataset.sig === sig) return;
    if (existing) existing.remove();
    main.appendChild(buildPanel(cfg));
  }

  function hideCustom() {
    const main = getMainPanel();
    if (!main) return;
    const existing = main.querySelector('#tm-cust-panel');
    if (existing) existing.remove();
    [...main.children].forEach(c => {
      if (c.style.display === 'none') c.style.display = '';
    });
  }

  /* =========================================================================
   * 6. MAIN RENDER / STATE SYNC
   * ======================================================================= */
  let observer = null;

  function render() {
    if (location.pathname.indexOf('/search') === -1) return;
    if (observer) observer.disconnect();
    try {
      ensureSidebar();
      const s = currentS();
      const cfg = INTEGRATIONS.find(i => i.id === s);
      setPressedStates(s);
      if (cfg) showCustom(cfg);
      else hideCustom();
    } catch (err) {
      // never let the overlay break the host page
      console.warn('[tm-search] render error', err);
    } finally {
      if (observer) observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // clicking a fake result should not scroll the page to the top
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[data-tm-result]');
    if (a) e.preventDefault();
  }, true);

  // react to SPA url changes (native integration clicks / new searches)
  (function patchHistory() {
    const fire = () => window.dispatchEvent(new Event('tm-locationchange'));
    ['pushState', 'replaceState'].forEach(fn => {
      const orig = history[fn];
      history[fn] = function () {
        const r = orig.apply(this, arguments);
        fire();
        return r;
      };
    });
    window.addEventListener('popstate', fire);
    window.addEventListener('tm-locationchange', () => setTimeout(render, 50));
  })();

  // debounced observer so DOM churn doesn't thrash us
  let scheduled = false;
  observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // initial passes (the search app hydrates asynchronously)
  render();
  let tries = 0;
  const boot = setInterval(() => {
    render();
    if (++tries > 20 || getIntegrationUl()) { /* keep going a bit either way */ }
    if (tries > 40) clearInterval(boot);
  }, 400);
})();
