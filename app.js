(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ----- Local analytics (no external setup)
  const analytics = (() => {
    const KEY = 'ah_analytics_v1';
    const sessionId = (() => {
      const k = 'ah_session_id';
      const existing = sessionStorage.getItem(k);
      if (existing) return existing;
      const id = crypto.getRandomValues(new Uint32Array(4)).join('-');
      sessionStorage.setItem(k, id);
      return id;
    })();

    const load = () => {
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
    };
    const save = (rows) => localStorage.setItem(KEY, JSON.stringify(rows.slice(-3000)));

    const log = (event, meta={}) => {
      const rows = load();
      rows.push({
        t: new Date().toISOString(),
        event,
        path: location.pathname + location.search,
        ref: document.referrer || null,
        ua: navigator.userAgent,
        sid: sessionId,
        meta
      });
      save(rows);
    };

    const summary = () => {
      const rows = load();
      const byEvent = new Map();
      const byDay = new Map();
      for (const r of rows) {
        byEvent.set(r.event, (byEvent.get(r.event) || 0) + 1);
        const day = (r.t || '').slice(0,10);
        byDay.set(day, (byDay.get(day) || 0) + 1);
      }
      return {
        total: rows.length,
        byEvent: Object.fromEntries([...byEvent.entries()].sort((a,b)=>b[1]-a[1])),
        byDay: Object.fromEntries([...byDay.entries()].sort((a,b)=>a[0].localeCompare(b[0])))
      };
    };

    return { log, load, summary };
  })();

  // ----- PWA service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ });
    });
  }

  // ----- UI helpers
  const toast = (msg) => {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    window.clearTimeout(el._t);
    el._t = window.setTimeout(() => el.classList.remove('show'), 2600);
  };

  // ----- Drawer: Lifelong Catch and Correct
  const drawer = $('#lccDrawer');
  const openDrawer = () => { drawer?.classList.add('open'); analytics.log('lcc_open'); };
  const closeDrawer = () => { drawer?.classList.remove('open'); };

  $('#openLcc')?.addEventListener('click', openDrawer);
  $('#closeLcc')?.addEventListener('click', closeDrawer);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  window.addEventListener('keydown', (e) => {
    const isK = (e.key || '').toLowerCase() === 'k';
    if (isK && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      drawer?.classList.contains('open') ? closeDrawer() : openDrawer();
    }
  });

  // ----- Changelog modal
  const modal = $('#modal');
  const openModal = () => modal?.classList.add('show');
  const closeModal = () => modal?.classList.remove('show');
  $('#openChangelog')?.addEventListener('click', async () => {
    analytics.log('changelog_open');
    try {
      const res = await fetch('/changelog.json', { cache: 'no-store' });
      const data = await res.json();
      $('#modalTitle').textContent = 'Codex changelog viewer';
      $('#modalBody').innerHTML = '<pre></pre>';
      $('#modalBody pre').textContent = JSON.stringify(data, null, 2);
      openModal();
    } catch {
      toast('Unable to load changelog');
    }
  });
  $('#modalClose')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // ----- Self-audit rules (Codex-style suggestions)
  const audit = () => {
    const issues = [];
    const imgs = $$('img');
    const missingAlt = imgs.filter(i => !i.hasAttribute('alt') || (i.getAttribute('alt') || '').trim() === '').length;
    if (missingAlt > 0) issues.push({
      level: 'warn',
      title: 'Images missing alt text',
      detail: `${missingAlt} image(s) are missing alt text. Add descriptive alt attributes for accessibility and SEO.`
    });
    else issues.push({
      level: 'ok',
      title: 'Alt text coverage',
      detail: 'All images have alt text.'
    });

    const h1s = $$('h1');
    if (h1s.length !== 1) issues.push({
      level: 'warn',
      title: 'Heading structure',
      detail: `Expected exactly 1 H1; found ${h1s.length}. Keep a single H1 for strong SEO structure.`
    });
    else issues.push({
      level: 'ok',
      title: 'Heading structure',
      detail: 'Single H1 detected.'
    });

    const hasJsonLd = !!$('script[type="application/ld+json"]');
    issues.push(hasJsonLd ? {
      level: 'ok',
      title: 'Structured data',
      detail: 'JSON-LD present.'
    } : {
      level: 'bad',
      title: 'Structured data',
      detail: 'JSON-LD is missing. Add Organization/LocalBusiness schema to improve search results.'
    });

    const hasCsp = !!document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    issues.push(hasCsp ? {
      level: 'ok',
      title: 'CSP baseline',
      detail: 'CSP meta tag present (stronger via server headers when deployed).'
    } : {
      level: 'warn',
      title: 'CSP baseline',
      detail: 'CSP meta tag not found. Add CSP to reduce XSS risk (and set headers on host for best effect).'
    });

    // Contact form validation check
    const form = $('#contactForm');
    issues.push(form ? {
      level: 'ok',
      title: 'Contact path',
      detail: 'Contact form is present. Ensure inbox monitoring and SLA alignment.'
    } : {
      level: 'bad',
      title: 'Contact path',
      detail: 'No contact form found. Add a contact path to capture leads.'
    });

    return issues;
  };

  const renderAudit = () => {
    const wrap = $('#auditWrap');
    if (!wrap) return;
    const items = audit();
    wrap.innerHTML = '';
    for (const it of items) {
      const div = document.createElement('div');
      div.className = 'audit-item';
      const cls = it.level === 'ok' ? 'status-ok' : (it.level === 'bad' ? 'status-bad' : 'status-warn');
      div.innerHTML = `
        <div class="h">
          <b>${it.title}</b>
          <i class="${cls}">${it.level.toUpperCase()}</i>
        </div>
        <p>${it.detail}</p>
      `;
      wrap.appendChild(div);
    }
  };
  renderAudit();

  $('#rerunAudit')?.addEventListener('click', () => {
    analytics.log('audit_rerun');
    renderAudit();
    toast('Audit refreshed');
  });

  // ----- PWA install prompt (optional UX)
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = $('#installPwa');
    if (btn) btn.style.display = 'inline-flex';
  });
  $('#installPwa')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    analytics.log('pwa_install_click');
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    analytics.log('pwa_install_choice', { outcome: choice.outcome });
    deferredPrompt = null;
    $('#installPwa').style.display = 'none';
  });

  // ----- Contact form: client-side validation + mailto fallback
  const form = $('#contactForm');
  const toEmail = (form?.dataset?.mailto || '').trim();
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = ($('#name')?.value || '').trim();
    const email = ($('#email')?.value || '').trim();
    const phone = ($('#phone')?.value || '').trim();
    const msg = ($('#message')?.value || '').trim();
    if (!name || !email || !msg) {
      toast('Please complete name, email, and message.');
      analytics.log('lead_invalid');
      return;
    }
    analytics.log('lead_submit', { name: name.slice(0, 64) });

    // Mailto fallback if configured
    if (toEmail) {
      const subject = encodeURIComponent('New IT Inquiry — Already Here LLC');
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nMessage:\n${msg}\n\nSource: ${location.href}`
      );
      location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`;
      toast('Opening email composer…');
      return;
    }

    // Otherwise store locally and confirm
    try {
      const key = 'ah_leads_v1';
      const leads = JSON.parse(localStorage.getItem(key) || '[]');
      leads.push({ t: new Date().toISOString(), name, email, phone, msg });
      localStorage.setItem(key, JSON.stringify(leads.slice(-200)));
      toast('Message saved locally. Add a mailto address to route messages.');
    } catch {
      toast('Unable to save message.');
    }
  });

  // ----- Track basic events
  analytics.log('page_view', { source: new URLSearchParams(location.search).get('source') || null });

  $$('a[data-track]').forEach(a => {
    a.addEventListener('click', () => analytics.log(a.dataset.track, { href: a.getAttribute('href') }));
  });
})();
