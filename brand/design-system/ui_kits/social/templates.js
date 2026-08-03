/* Light — social templates. Each entry: {w, h, scale, cap, html}. Real pixel sizes. */
(function () {
  const LOGO = 'data:image/png;base64,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';
  const PH = {
    truck: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?w=3600&q=90',
    food: 'https://images.unsplash.com/photo-1652211955967-99c892925469?w=3600&q=90',
    warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=72',
    work: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=3600&q=90',
    clean: 'https://images.unsplash.com/photo-1749214317455-efbdd57df844?w=3600&q=90',
  };

  // ---- helpers ----
  const ic = (n, sz, col) => `<i data-lucide="${n}" style="width:${sz}px;height:${sz}px;${col ? 'color:' + col + ';' : ''}"></i>`;
  const logoChip = (h, pos) =>
    `<div class="logo-chip" style="${pos};padding:${Math.round(h * 0.16)}px;"><img src="${LOGO}" style="height:${h}px;display:block;" alt="Light"></div>`;

  /* ============ SQUARE VACANCY ============ */
  function sqVacancy({ photo, cat, catIcon, title, hours = 'Fulltime', loc = 'Rotterdam' }) {
    return `
    <div style="width:1080px;height:1080px;background:#fff;position:relative;font-family:var(--font-body);">
      <div style="height:560px;position:relative;overflow:hidden;">
        <img src="${photo}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="">
        <span class="pill" style="position:absolute;top:40px;left:40px;background:var(--light-red);color:#fff;font-size:25px;letter-spacing:0.08em;text-transform:uppercase;padding:15px 28px;">${ic(catIcon, 30)}${cat}</span>
      </div>
      <div class="notch p-eyebrow" style="position:absolute;top:520px;left:0;background:var(--light-red);color:#fff;font-size:25px;padding:20px 44px 22px 56px;">Wij zoeken</div>
      <div style="padding:118px 56px 56px;display:flex;flex-direction:column;gap:34px;">
        <div class="p-title" style="font-size:80px;color:var(--grey-900);">${title}</div>
        <div class="p-meta" style="font-size:30px;color:var(--grey-600);">
          <span>${ic('map-pin', 32, 'var(--light-red)')}${loc}</span>
          <span>${ic('clock', 32, 'var(--light-red)')}${hours}</span>
        </div>
      </div>
      <span class="pill" style="position:absolute;left:56px;bottom:60px;background:var(--light-red);color:#fff;font-size:30px;padding:24px 40px;">Solliciteer direct ${ic('arrow-right', 32)}</span>
      ${logoChip(96, 'position:absolute;right:48px;bottom:48px')}
    </div>`;
  }

  /* ============ SQUARE STATEMENT ============ */
  function sqStatement() {
    return `
    <div style="width:1080px;height:1080px;background:var(--grey-900);position:relative;overflow:hidden;font-family:var(--font-body);">
      <div style="padding:90px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;">
        ${logoChip(104, 'align-self:flex-start')}
        <div>
          <div style="width:96px;height:9px;background:var(--light-red);margin-bottom:44px;border-radius:2px;"></div>
          <div class="p-title" style="font-size:108px;color:#fff;">De productie moet draaien.<span style="color:var(--light-red-300)"> Punt.</span></div>
        </div>
        <div class="p-eyebrow" style="font-size:26px;color:var(--grey-400);letter-spacing:0.16em;">Productie &middot; Logistiek &middot; Schoonmaak</div>
      </div>
    </div>`;
  }

  /* ============ SQUARE ANNOUNCEMENT ============ */
  function sqAnnounce() {
    const row = (catIcon, cat, role, meta) => `
      <div style="display:flex;align-items:center;gap:30px;border-top:2px solid var(--grey-200);padding:30px 0;">
        <span class="pill" style="background:var(--light-red-50);color:var(--light-red);font-size:21px;padding:12px 22px;text-transform:uppercase;letter-spacing:0.06em;">${ic(catIcon, 26)}${cat}</span>
        <div style="flex:1;">
          <div style="font-family:var(--font-display);font-weight:700;font-size:42px;color:var(--grey-900);line-height:1.1;">${role}</div>
          <div style="font-size:24px;color:var(--grey-500);margin-top:6px;">${meta}</div>
        </div>
        ${ic('arrow-right', 40, 'var(--light-red)')}
      </div>`;
    return `
    <div style="width:1080px;height:1080px;background:#fff;position:relative;padding:90px;box-sizing:border-box;display:flex;flex-direction:column;font-family:var(--font-body);">
      <div class="p-eyebrow" style="font-size:26px;color:var(--light-red);letter-spacing:0.16em;">Nieuwe vacatures</div>
      <div class="p-title" style="font-size:74px;color:var(--grey-900);margin:22px 0 40px;">We zoeken collega's</div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        ${row('truck', 'Logistiek', 'Meewerkend chauffeur', 'Rotterdam &middot; Fulltime')}
        ${row('factory', 'Productie', 'Medewerker snijhal', 'Rotterdam &middot; Fulltime')}
        ${row('factory', 'Productie', 'Etiketteerder', 'Rotterdam &middot; Fulltime')}
        <div style="border-top:2px solid var(--grey-200);"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:36px;">
        <span class="pill" style="background:var(--light-red);color:#fff;font-size:28px;padding:22px 38px;">Bekijk alle vacatures ${ic('arrow-right', 30)}</span>
        <img src="${LOGO}" style="height:92px;" alt="Light">
      </div>
    </div>`;
  }

  /* ============ STORY VACANCY (1080x1920) ============ */
  function storyVacancy({ photo, title, cat, catIcon }) {
    return `
    <div style="width:1080px;height:1920px;position:relative;overflow:hidden;background:#1f2123;font-family:var(--font-body);">
      <img src="${photo}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" alt="">
      <div style="position:absolute;inset:0;background:rgba(31,33,35,0.18);"></div>
      ${logoChip(108, 'position:absolute;top:60px;left:60px')}
      <span class="pill" style="position:absolute;top:84px;right:60px;background:var(--light-red);color:#fff;font-size:28px;letter-spacing:0.08em;text-transform:uppercase;padding:18px 32px;">${ic(catIcon, 32)}${cat}</span>
      <div style="position:absolute;left:0;right:0;bottom:0;background:var(--light-red);padding:150px 72px 120px;clip-path:polygon(0 130px, 100% 0, 100% 100%, 0 100%);">
        <div class="p-eyebrow" style="font-size:32px;color:rgba(255,255,255,0.85);letter-spacing:0.16em;">Wij zoeken</div>
        <div class="p-title" style="font-size:104px;color:#fff;margin:26px 0 40px;">${title}</div>
        <div class="p-meta" style="font-size:36px;color:#fff;">
          <span>${ic('map-pin', 40)}Rotterdam</span>
          <span>${ic('clock', 40)}Fulltime</span>
        </div>
        <div style="margin-top:64px;display:inline-flex;align-items:center;gap:20px;background:#fff;color:var(--light-red);font-family:var(--font-display);font-weight:700;font-size:36px;padding:30px 50px;border-radius:999px;">Solliciteer — link in bio ${ic('arrow-right', 38)}</div>
      </div>
    </div>`;
  }

  /* ============ LINKEDIN BANNER (1200x627) ============ */
  function liBanner() {
    const chip = (i, t) => `<span class="pill" style="background:var(--grey-100);color:var(--grey-700);font-size:18px;padding:11px 20px;">${ic(i, 22, 'var(--light-red)')}${t}</span>`;
    return `
    <div style="width:1200px;height:627px;display:flex;background:#fff;overflow:hidden;font-family:var(--font-body);">
      <div style="flex:1.18;padding:64px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;">
        <div class="p-eyebrow" style="font-size:18px;color:var(--light-red);letter-spacing:0.16em;">Light Personeelsdiensten B.V.</div>
        <div class="p-title" style="font-size:52px;color:var(--grey-900);margin:18px 0 20px;">Productie&#8209;, logistiek &amp;<br>schoonmaakpersoneel</div>
        <div style="font-size:20px;color:var(--grey-600);line-height:1.5;max-width:520px;">De productie moet draaien, punt. Wij regelen screening, planning en begeleiding op locatie.</div>
        <div style="display:flex;gap:12px;margin-top:30px;">${chip('factory', 'Productie')}${chip('truck', 'Logistiek')}${chip('spray-can', 'Schoonmaak')}</div>
        <img src="${LOGO}" style="height:74px;width:auto;align-self:flex-start;margin-top:36px;" alt="Light">
      </div>
      <div style="flex:0.82;position:relative;">
        <img src="${PH.warehouse}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="">
        <div class="notch" style="position:absolute;left:-1px;bottom:40px;background:var(--light-red);color:#fff;padding:16px 26px;">
          <div style="font-family:var(--font-display);font-weight:800;font-size:22px;line-height:1.05;">SNA-gecertificeerd</div>
          <div style="font-size:13px;opacity:0.9;margin-top:3px;">Stichting Normering Arbeid</div>
        </div>
      </div>
    </div>`;
  }

  /* ============ PROFILE COVER BANNER ============ */
  /* One layout, sized per platform: LinkedIn 1128x191, Facebook 820x312, Instagram 1080x608.
     LinkedIn/Facebook already overlay the page's own square logo over the
     bottom-left corner of the cover, so this banner carries no extra logo —
     content is kept clear of that left ~26% zone. */
  function coverBanner(w, h, headBoost) {
    if (headBoost === undefined) headBoost = 1;
    const pad = Math.round(w * 0.045);
    const leftSafe = Math.max(pad, Math.round(w * 0.26));
    const contentColW = w - pad - leftSafe;
    const fsHead = Math.max(20, Math.min(Math.round(h * 0.135 * headBoost), Math.round(contentColW / 6.2)));
    const fsEyebrow = Math.max(12, Math.round(h * 0.045));
    const photos = [PH.food, PH.truck, PH.clean];
    const stripW = w / 3;
    const strips = photos.map((p, i) => `<img src="${p}" style="position:absolute;left:${Math.round(i * stripW)}px;top:0;width:${Math.ceil(stripW) + 1}px;height:100%;object-fit:cover;display:block;" alt="">`).join('');
    return `
    <div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;font-family:var(--font-body);">
      <div style="position:absolute;inset:0;">${strips}</div>
      <div style="position:absolute;inset:0;background:linear-gradient(to left, rgba(31,33,35,.08) 0%, rgba(31,33,35,.60) 50%, rgba(31,33,35,.90) 100%);"></div>
      <div style="position:relative;height:100%;display:flex;align-items:center;padding:0 ${pad}px 0 ${leftSafe}px;box-sizing:border-box;">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
          <div class="p-title" style="font-size:${fsHead}px;color:#fff;line-height:1.1;">De juiste mensen, <span style="color:var(--light-red)">op de juiste plek.</span></div>
          <div class="p-eyebrow" style="font-size:${fsEyebrow}px;color:rgba(255,255,255,0.78);letter-spacing:0.14em;margin-top:${Math.round(h * 0.035)}px;">Productie &middot; Logistiek &middot; Schoonmaak</div>
          <span class="pill" style="background:#fff;color:var(--light-red);font-size:${fsEyebrow}px;padding:${Math.round(h * 0.045)}px ${Math.round(h * 0.08)}px;align-self:flex-start;white-space:nowrap;margin-top:${Math.round(h * 0.06)}px;">${ic('badge-check', Math.round(fsEyebrow * 1.3), 'var(--light-red)')}SNA-gecertificeerd</span>
        </div>
      </div>
    </div>`;
  }

  window.LIGHT_TEMPLATES = {
    square: [
      { w: 1080, h: 1080, scale: 0.335, cap: 'Vacature — Logistiek', html: sqVacancy({ photo: PH.truck, cat: 'Logistiek', catIcon: 'truck', title: 'Meewerkend chauffeur' }) },
      { w: 1080, h: 1080, scale: 0.335, cap: 'Vacature — Productie', html: sqVacancy({ photo: PH.food, cat: 'Productie', catIcon: 'factory', title: 'Medewerker snijhal' }) },
      { w: 1080, h: 1080, scale: 0.335, cap: 'Statement', html: sqStatement() },
      { w: 1080, h: 1080, scale: 0.335, cap: 'Aankondiging', html: sqAnnounce() },
    ],
    story: [
      { w: 1080, h: 1920, scale: 0.205, cap: 'Story — Logistiek', html: storyVacancy({ photo: PH.truck, title: 'Meewerkend chauffeur', cat: 'Logistiek', catIcon: 'truck' }) },
      { w: 1080, h: 1920, scale: 0.205, cap: 'Story — Werken bij', html: storyVacancy({ photo: PH.work, title: 'Word jij onze nieuwe collega?', cat: 'Productie', catIcon: 'factory' }) },
    ],
    li: [
      { w: 1200, h: 627, scale: 0.40, cap: 'LinkedIn / banner', html: liBanner() },
    ],
    cover: [
      { w: 1128, h: 191, scale: 0.46, cap: 'LinkedIn cover', html: coverBanner(1128, 191, 1.35) },
      { w: 820, h: 312, scale: 0.63, cap: 'Facebook cover', html: coverBanner(820, 312) },
      { w: 1080, h: 608, scale: 0.48, cap: 'Instagram banner', html: coverBanner(1080, 608) },
    ],
  };
})();
