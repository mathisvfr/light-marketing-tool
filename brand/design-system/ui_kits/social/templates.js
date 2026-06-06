/* Light — social templates. Each entry: {w, h, scale, cap, html}. Real pixel sizes. */
(function () {
  const LOGO = '../../assets/light-logo-beeldmerk.png';
  const PH = {
    truck: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1100&q=72',
    food: 'https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=1100&q=72',
    warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=72',
    work: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1100&q=72',
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
          <div style="font-family:var(--font-display);font-weight:800;font-size:42px;color:var(--grey-900);line-height:1.1;">${role}</div>
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
        <div style="margin-top:64px;display:inline-flex;align-items:center;gap:20px;background:#fff;color:var(--light-red);font-family:var(--font-display);font-weight:800;font-size:36px;padding:30px 50px;border-radius:999px;">Solliciteer — link in bio ${ic('arrow-right', 38)}</div>
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
          <div style="font-family:var(--font-display);font-weight:900;font-size:22px;line-height:1.05;">SNA-gecertificeerd</div>
          <div style="font-size:13px;opacity:0.9;margin-top:3px;">Stichting Normering Arbeid</div>
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
  };
})();
