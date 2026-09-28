// ==UserScript==
// @name         Staffbase Search – Workday & ServiceNow (Demo)
// @namespace    staffbase.demo.veronica
// @version      1.0.0
// @description  Adds two fake external search integrations (Workday + ServiceNow) to the Staffbase search page, with results that depend on the search term (q) in the URL. Purely visual demo overlay – no backend.
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
   *    - workday:    official Workday logo (base64 PNG)
   *    - servicenow: simple brand-colored "now" badge (inline SVG)
   * ======================================================================= */
  const svgURI = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);

  const ICON = {
    workday: 'data:image/png;base64,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',
    servicenow: svgURI(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<rect width="32" height="32" rx="6" fill="#62D84E"/>' +
      '<text x="16" y="21" font-family="Arial,Helvetica,sans-serif" font-size="11" ' +
      'font-weight="700" fill="#ffffff" text-anchor="middle">now</text></svg>'
    )
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
    workday: {
      benefits: [
        { title: '2025 Benefits Enrollment',
          path: 'Workday › Benefits › Open Enrollment',
          desc: 'Review and elect your medical, dental and vision coverage for the 2025 plan year. Enrollment closes 15 December – changes take effect 1 January.' },
        { title: 'Health Insurance Plan Comparison',
          path: 'Workday › Benefits › Health',
          desc: 'Compare the PPO and HDHP plans side by side – premiums, deductibles, co-pays and out-of-pocket maximums – to pick the coverage that fits your family.' },
        { title: 'Pension & Retirement Savings',
          path: 'Workday › Benefits › Retirement',
          desc: 'Manage your company pension contributions, view the employer match and update your monthly retirement deferral rate.' },
        { title: 'Life Event – Add a Dependent',
          path: 'Workday › Benefits › Life Events',
          desc: 'Had a baby, got married or moved in together? Report a qualifying life event to update your benefits outside of the open enrollment window.' },
        { title: 'Employee Assistance Program (EAP)',
          path: 'Workday › Benefits › Wellbeing',
          desc: 'Confidential counseling, legal and financial support available 24/7 to all employees and the people in their household – at no cost.' },
        { title: 'Benefits Confirmation Statement',
          path: 'Workday › Benefits › Documents',
          desc: 'Download the PDF summary of your current elections, covered dependents and per-paycheck contributions for your records.' }
      ],
      arbeitskleidung: [
        { title: 'Arbeitskleidung – Kostenzuschuss beantragen',
          path: 'Workday › Vergütung › Zusatzleistungen',
          desc: 'Reichen Sie Ihren jährlichen Zuschuss für Arbeits- und Schutzkleidung als Spesenposition ein und lassen Sie ihn mit der nächsten Abrechnung erstatten.' },
        { title: 'Richtlinie Arbeitskleidung & PSA',
          path: 'Workday › Dokumente › Richtlinien',
          desc: 'Übersicht der Bekleidungspauschale, der anspruchsberechtigten Rollen sowie der Erstattungsgrenzen pro Kalenderjahr.' },
        { title: 'Bekleidungspauschale – Auszahlungsstatus',
          path: 'Workday › Vergütung › Auszahlungen',
          desc: 'Verfolgen Sie den Status Ihrer eingereichten Erstattung für Arbeitskleidung bis zur Auszahlung in der Gehaltsabrechnung.' },
        { title: 'Spesenabrechnung erstellen',
          path: 'Workday › Spesen › Neu',
          desc: 'Legen Sie eine neue Spesenabrechnung an und fügen Sie Belege für Arbeitskleidung und Sicherheitsausrüstung als Positionen hinzu.' },
        { title: 'Onboarding-Aufgabe: Arbeitsausstattung',
          path: 'Workday › Onboarding › Aufgaben',
          desc: 'Offene Onboarding-Aufgabe: Konfektionsgrößen für Arbeitskleidung erfassen und die Erstausstattung bestätigen.' }
      ],
      random: [
        { title: 'Meine Gehaltsabrechnung – September 2026',
          path: 'Workday › Bezahlung › Abrechnungen',
          desc: 'Ihre aktuelle Gehaltsabrechnung steht bereit. Öffnen Sie das Dokument, um Brutto, Netto und Abzüge im Detail einzusehen.' },
        { title: 'Urlaubsantrag stellen',
          path: 'Workday › Abwesenheit › Anträge',
          desc: 'Beantragen Sie bezahlten Urlaub, prüfen Sie Ihren Resturlaub und sehen Sie den Genehmigungsstatus Ihrer Vorgesetzten.' },
        { title: 'Team-Organigramm',
          path: 'Workday › Organisation',
          desc: 'Interaktives Organigramm Ihres Teams und der angrenzenden Abteilungen inklusive Rollen und Berichtslinien.' },
        { title: 'Leistungsbeurteilung 2026',
          path: 'Workday › Talent › Performance',
          desc: 'Ihre Zielvereinbarung und das Feedbackformular für den aktuellen Beurteilungszyklus sind zur Bearbeitung freigegeben.' },
        { title: 'Lernkurs: Arbeitssicherheit Grundlagen',
          path: 'Workday › Lernen › Kurse',
          desc: 'Pflichtschulung zur Arbeitssicherheit. Dauer ca. 35 Minuten, abzuschließen bis Ende des Quartals.' },
        { title: 'Persönliche Daten aktualisieren',
          path: 'Workday › Profil › Stammdaten',
          desc: 'Adresse, Bankverbindung und Notfallkontakt selbst pflegen – Änderungen werden automatisch an HR und Payroll übermittelt.' },
        { title: 'Reisekostenabrechnung',
          path: 'Workday › Spesen › Reisen',
          desc: 'Erfassen Sie Reisekosten, laden Sie Belege hoch und reichen Sie die Abrechnung zur Genehmigung ein.' },
        { title: 'Interne Stellenausschreibungen',
          path: 'Workday › Karriere › Interne Jobs',
          desc: 'Aktuell offene Positionen im Unternehmen. Bewerben Sie sich intern mit einem Klick über Ihr Workday-Profil.' }
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
    { id: 'workday', label: 'Workday' },
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
