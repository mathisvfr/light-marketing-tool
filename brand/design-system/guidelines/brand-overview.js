/* Brand overview — fills static specimens (color/type/icons) and mounts DS components. */
(function () {
  // ---------- static: color swatches ----------
  const brand = [
    ['Merkrood', '--light-red', '#be1e2d'], ['Rood 600', '--light-red-600', '#a81927'], ['Rood 700', '--light-red-700', '#8d1420'],
    ['Merkgrijs', '--grey-500', '#787c7e'], ['Grijs 700', '--grey-700', '#45494b'], ['Inkt', '--grey-900', '#1f2123'],
  ];
  const neutral = [
    ['White', '--white', '#ffffff'], ['50', '--grey-50', '#f6f7f8'], ['100', '--grey-100', '#eef0f1'],
    ['200', '--grey-200', '#e0e2e4'], ['300', '--grey-300', '#c4c7c9'], ['400', '--grey-400', '#9a9ea0'],
    ['500', '--grey-500', '#787c7e'], ['600', '--grey-600', '#5f6365'], ['700', '--grey-700', '#45494b'],
    ['800', '--grey-800', '#2e3133'], ['900', '--grey-900', '#1f2123'],
  ];
  const status = [['Success', '--green', '#2f8f4e'], ['Attentie', '--amber', '#c9882f'], ['Info', '--blue', '#2f6f9f'], ['Error', '--light-red', '#be1e2d']];

  function swatch(name, varname, hex) {
    const d = document.createElement('div'); d.className = 'sw';
    d.innerHTML = `<div class="chip" style="background:var(${varname})"></div><div class="nm">${name}</div><div class="hex">${hex}</div>`;
    return d;
  }
  const fill = (id, arr) => { const el = document.getElementById(id); arr.forEach((s) => el.appendChild(swatch(...s))); };
  fill('sw-brand', brand); fill('sw-neutral', neutral); fill('sw-status', status);

  // ---------- static: type list ----------
  const type = [
    ['Display · 64 · Montserrat 900', '<span style="font-family:var(--font-display);font-weight:900;font-size:64px;letter-spacing:-0.02em;line-height:1">Light</span>'],
    ['H1 · 44 · 800', '<span class="light-h1">De productie moet draaien</span>'],
    ['H2 · 32 · 800', '<span class="light-h2">Enkele van onze vacatures</span>'],
    ['H3 · 24 · 700', '<span class="light-h3">Werken bij Light</span>'],
    ['Lead · 20 · Open Sans', '<span class="light-lead">Specialist in productie, logistiek en schoonmaak.</span>'],
    ['Body · 16 / 1.6', '<span class="light-body">Wij kennen de klappen van de zweep — en regelen het juiste personeel op locatie.</span>'],
    ['Eyebrow · 12.5 · uppercase', '<span class="light-eyebrow">Zakelijke diensten</span>'],
    ['Mono · 14 · JetBrains', '<span class="light-mono">+31 10 760 0857</span>'],
  ];
  const tl = document.getElementById('type-list');
  type.forEach(([meta, html]) => {
    const row = document.createElement('div'); row.className = 'type-row';
    row.innerHTML = `<div class="type-meta">${meta}</div><div>${html}</div>`;
    tl.appendChild(row);
  });

  // ---------- static: icon grid ----------
  const icons = [
    ['briefcase', 'Vacature'], ['factory', 'Productie'], ['truck', 'Logistiek'], ['spray-can', 'Schoonmaak'], ['map-pin', 'Locatie'],
    ['clock', 'Uren / shift'], ['send', 'Solliciteren'], ['badge-check', 'SNA-keurmerk'], ['phone', 'Telefoon'], ['mail', 'E-mail'],
  ];
  const ig = document.getElementById('icon-grid');
  icons.forEach(([ic, lbl]) => {
    const cell = document.createElement('div'); cell.className = 'icon-cell';
    cell.innerHTML = `<div class="icon-tile"><i data-lucide="${ic}"></i></div><div class="lbl">${lbl}<small>${ic}</small></div>`;
    ig.appendChild(cell);
  });

  // ---------- React components from the DS bundle (with fallback) ----------
  function findNamespace() {
    for (const k in window) { try { const v = window[k]; if (v && v.Button && v.Card && v.JobCard && v.Badge && v.Tag && v.Input && v.Select) return v; } catch (e) {} }
    return null;
  }
  async function buildFallback() {
    const files = ['Button', 'Card', 'JobCard', 'Badge', 'Tag', 'Input', 'Select'].map((n) => {
      return ({ Button: '../components/buttons/Button.jsx', Card: '../components/cards/Card.jsx', JobCard: '../components/cards/JobCard.jsx', Badge: '../components/feedback/Badge.jsx', Tag: '../components/feedback/Tag.jsx', Input: '../components/forms/Input.jsx', Select: '../components/forms/Select.jsx' })[n];
    });
    let src = '';
    for (const f of files) { let t = await (await fetch(f)).text(); t = t.replace(/^\s*import[^\n]*\n/gm, '').replace(/^\s*export\s+function/gm, 'function'); src += '\n' + t; }
    const code = Babel.transform(src, { presets: ['react'] }).code;
    return new Function('React', code + '\nreturn {Button, Card, JobCard, Badge, Tag, Input, Select};')(window.React);
  }

  (async function () {
    let DS = findNamespace();
    if (!DS) DS = await buildFallback();
    const { Button, Card, JobCard, Badge, Tag, Input, Select } = DS;
    const e = React.createElement;
    const root = (id, node) => ReactDOM.createRoot(document.getElementById(id)).render(node);

    root('btn-variants', e(React.Fragment, null,
      e(Button, { variant: 'primary', iconRight: 'arrow-right' }, 'Lees meer'),
      e(Button, { variant: 'secondary' }, 'Over ons'),
      e(Button, { variant: 'outline' }, 'Neem contact op'),
      e(Button, { variant: 'ghost' }, 'Annuleren'),
    ));
    root('btn-sizes', e(React.Fragment, null,
      e(Button, { size: 'sm' }, 'Klein'),
      e(Button, { size: 'md' }, 'Normaal'),
      e(Button, { size: 'lg', notch: true, icon: 'send' }, 'Solliciteer direct'),
      e(Button, { variant: 'primary', disabled: true }, 'Disabled'),
    ));
    root('cmp-badges', e(React.Fragment, null,
      e(Badge, { tone: 'green', icon: 'check' }, 'Vacature open'),
      e(Badge, { tone: 'dark', solid: true, icon: 'badge-check' }, 'SNA-gecertificeerd'),
      e(Badge, { tone: 'red', solid: true }, 'Fulltime'),
      e('span', { style: { width: 14 } }),
      e(Tag, { selected: true }, 'Productie'),
      e(Tag, null, 'Logistiek'),
      e(Tag, { removable: true }, 'Rotterdam'),
    ));
    root('cmp-form', e(React.Fragment, null,
      e(Input, { label: 'Naam', placeholder: 'Voor- en achternaam', required: true }),
      e(Input, { label: 'E-mail', type: 'email', icon: 'mail', hint: 'Reactie binnen 1 werkdag.' }),
      e(Select, { label: 'Vakgebied', options: ['Productie', 'Logistiek', 'Schoonmaak'] }),
    ));
    root('cmp-cards', e(React.Fragment, null,
      e(Card, { image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=700&q=70', interactive: true },
        e('h3', { className: 'light-h3', style: { marginBottom: 8 } }, 'Zakelijke diensten'),
        e('p', { className: 'light-body', style: { margin: 0, fontSize: 14.5, color: 'var(--color-text-muted)' } }, 'Persoonlijk advies dat aansluit bij uw bedrijf.'),
      ),
      e(JobCard, { title: 'Meewerkend chauffeur', image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=700&q=70', category: 'Logistiek', location: 'Rotterdam', hours: 'Fulltime', teaser: 'Ben je graag onderweg en wil je dit combineren met je nieuwe baan?', readTime: '1,2 min' }),
    ));

    setTimeout(() => window.lucide && lucide.createIcons(), 180);
  })();

  // render the static icons too
  if (window.lucide) lucide.createIcons();
  setTimeout(() => window.lucide && lucide.createIcons(), 120);
})();
