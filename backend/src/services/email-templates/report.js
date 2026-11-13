// Branded HTML email template for monthly reports.
// Uses inline CSS (email clients strip <style> tags).
// Light's brand colors: #be1e2d (red), #2b2b2b (dark grey), #f5f5f0 (background).

function trendLabel(current, previous) {
  if (!previous || previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function trendColor(current, previous) {
  if (current > previous) return '#2f8f4e';
  if (current < previous) return '#be1e2d';
  return '#787c7e';
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReportHtml(data, config) {
  const { monthName, vacatures, marketing, website } = data;
  const insights = config.insights || null;
  const appUrl = config.appUrl || 'https://app.lightpersoneelsdiensten.nl';
  const sections = config.include_sections || ['vacatures', 'marketing', 'website'];

  const vacaturesDelta = trendLabel(vacatures.nieuw, vacatures.prevNieuw);
  const vacaturesDeltaColor = trendColor(vacatures.nieuw, vacatures.prevNieuw);

  const reachDelta = trendLabel(marketing.metrics.total.reach, marketing.prevMetrics.total.reach);
  const reachDeltaColor = trendColor(marketing.metrics.total.reach, marketing.prevMetrics.total.reach);

  let vacaturesSection = '';
  if (sections.includes('vacatures')) {
    vacaturesSection = `
      <tr><td style="padding: 24px 32px 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #787c7e; border-bottom: 2px solid #e2e4e6;">VACATURES</td></tr>
      <tr><td style="padding: 16px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #2b2b2b;">Actieve vacatures</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 700; text-align: right; color: #2b2b2b;">${vacatures.actief}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #2b2b2b;">Nieuw geplaatst</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 700; text-align: right; color: #2b2b2b;">${vacatures.nieuw} <span style="color: ${vacaturesDeltaColor}; font-size: 12px;">(${vacaturesDelta} t.o.v. vorige maand)</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #2b2b2b;">Sollicitaties (Jobit)</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 700; text-align: right; color: #2b2b2b;">${vacatures.sollicitatiesJobit}</td>
          </tr>
        </table>
      </td></tr>`;
  }

  let marketingSection = '';
  if (sections.includes('marketing')) {
    const m = marketing.metrics.total;
    const bestPostHtml = marketing.bestPost
      ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #2b2b2b;">Beste post</td><td style="padding: 8px 0; font-size: 14px; text-align: right; color: #2b2b2b;">&ldquo;${escapeHtml(marketing.bestPost.title)}&rdquo; &mdash; ${marketing.bestPost.reach} bereik, ${marketing.bestPost.likes} likes</td></tr>`
      : '';

    const channelRows = Object.entries(marketing.metrics.byChannel).map(([ch, vals]) => {
      const label = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram' }[ch] || ch;
      return `<tr><td style="padding: 4px 16px; font-size: 13px; color: #787c7e;">${label}</td><td style="padding: 4px 8px; font-size: 13px; text-align: right; color: #2b2b2b;">bereik ${vals.reach}</td><td style="padding: 4px 8px; font-size: 13px; text-align: right; color: #2b2b2b;">engagement ${vals.engagement}</td></tr>`;
    }).join('');

    marketingSection = `
      <tr><td style="padding: 24px 32px 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #787c7e; border-bottom: 2px solid #e2e4e6;">MARKETING</td></tr>
      <tr><td style="padding: 16px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #2b2b2b;">Posts gepubliceerd</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 700; text-align: right; color: #2b2b2b;">${marketing.postsThisMonth}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #2b2b2b;">Totaal bereik</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 700; text-align: right; color: #2b2b2b;">${m.reach.toLocaleString('nl-NL')} <span style="color: ${reachDeltaColor}; font-size: 12px;">(${reachDelta})</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #2b2b2b;">Engagement</td>
            <td style="padding: 8px 0; font-size: 14px; text-align: right; color: #2b2b2b;">${m.likes} likes, ${m.comments} reacties, ${m.shares} shares</td>
          </tr>
          ${bestPostHtml}
        </table>
        ${channelRows ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px;">${channelRows}</table>` : ''}
      </td></tr>`;
  }

  let websiteSection = '';
  if (sections.includes('website')) {
    websiteSection = `
      <tr><td style="padding: 24px 32px 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #787c7e; border-bottom: 2px solid #e2e4e6;">WEBSITE</td></tr>
      <tr><td style="padding: 16px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #2b2b2b;">Bezoekers</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 700; text-align: right; color: #2b2b2b;">${website.visitors || 0}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #2b2b2b;">Paginaweergaven</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 700; text-align: right; color: #2b2b2b;">${website.pageviews || 0}</td>
          </tr>
        </table>
      </td></tr>`;
  }

  let insightsSection = '';
  if (insights) {
    const insightsHtml = escapeHtml(insights).replace(/\n/g, '<br>');
    insightsSection = `
      <tr><td style="padding: 24px 32px 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #787c7e; border-bottom: 2px solid #e2e4e6;">AI-INZICHTEN</td></tr>
      <tr><td style="padding: 16px 32px; font-size: 14px; color: #2b2b2b; line-height: 1.6;">
        ${insightsHtml}
      </td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f0;">
    <tr><td align="center" style="padding: 32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background-color: #be1e2d; padding: 24px 32px;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">Light Personeelsdiensten</h1>
          <p style="margin: 4px 0 0; font-size: 14px; color: rgba(255,255,255,0.85);">Maandrapport ${escapeHtml(monthName)}</p>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding: 24px 32px 8px; font-size: 14px; color: #2b2b2b; line-height: 1.5;">
          Hallo,<br><br>
          Hier is het maandoverzicht van Light Personeelsdiensten voor ${escapeHtml(monthName)}.
        </td></tr>

        ${vacaturesSection}
        ${marketingSection}
        ${websiteSection}
        ${insightsSection}

        <!-- Footer -->
        <tr><td style="padding: 24px 32px; border-top: 1px solid #e2e4e6; font-size: 12px; color: #787c7e; line-height: 1.5;">
          <a href="${escapeHtml(appUrl)}/rapportage" style="color: #be1e2d; text-decoration: none;">Bekijk het volledige dashboard</a><br>
          Dit rapport wordt automatisch verstuurd. <a href="${escapeHtml(appUrl)}/rapportage" style="color: #be1e2d; text-decoration: none;">Instellingen wijzigen</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { buildReportHtml };
