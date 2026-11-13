// Email service — SMTP via Nodemailer for automated report delivery.
// Uses env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM.

const nodemailer = require('nodemailer');
const { supabase } = require('../db/client');
const { buildReportHtml } = require('./email-templates/report');

let transporter;

function getTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_HOST) {
      throw new Error('E-mail niet geconfigureerd (SMTP_HOST ontbreekt).');
    }
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  return getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'rapportage@lightpersoneelsdiensten.nl',
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });
}

/**
 * Gather all metrics data needed for the monthly report.
 */
async function gatherReportData() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Vacatures
  const { count: actiefCount } = await supabase
    .from('drafts')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'vacature')
    .eq('status', 'actief');

  const { count: nieuwCount } = await supabase
    .from('drafts')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'vacature')
    .in('status', ['actief', 'published'])
    .gte('created_at', monthStart.toISOString());

  const { count: prevNieuwCount } = await supabase
    .from('drafts')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'vacature')
    .in('status', ['actief', 'published'])
    .gte('created_at', prevMonthStart.toISOString())
    .lt('created_at', monthStart.toISOString());

  // Marketing publications
  const { data: pubsThisMonth } = await supabase
    .from('publications')
    .select('channel, metrics')
    .eq('status', 'success')
    .gte('published_at', monthStart.toISOString());

  const { data: pubsLastMonth } = await supabase
    .from('publications')
    .select('channel, metrics')
    .eq('status', 'success')
    .gte('published_at', prevMonthStart.toISOString())
    .lt('published_at', monthStart.toISOString());

  function sumMetrics(pubs) {
    const total = { likes: 0, comments: 0, reach: 0, clicks: 0, shares: 0 };
    const byChannel = {};
    for (const p of pubs || []) {
      const m = p.metrics;
      if (!m) continue;
      total.likes += m.likes || 0;
      total.comments += m.comments || 0;
      total.reach += m.reach || 0;
      total.clicks += m.clicks || 0;
      total.shares += m.shares || 0;
      const ch = p.channel || 'unknown';
      if (!byChannel[ch]) byChannel[ch] = { reach: 0, engagement: 0 };
      byChannel[ch].reach += m.reach || 0;
      byChannel[ch].engagement += (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
    }
    return { total, byChannel };
  }

  const thisMonthMetrics = sumMetrics(pubsThisMonth);
  const lastMonthMetrics = sumMetrics(pubsLastMonth);

  // Best post this month
  let bestPost = null;
  const { data: bestPubs } = await supabase
    .from('publications')
    .select('id, draft_id, channel, metrics, published_at')
    .eq('status', 'success')
    .gte('published_at', monthStart.toISOString())
    .not('metrics', 'is', null);

  if (bestPubs && bestPubs.length > 0) {
    let maxReach = -1;
    for (const p of bestPubs) {
      const reach = p.metrics?.reach || 0;
      if (reach > maxReach) {
        maxReach = reach;
        bestPost = p;
      }
    }
    if (bestPost) {
      const { data: draft } = await supabase
        .from('drafts')
        .select('form_data')
        .eq('id', bestPost.draft_id)
        .maybeSingle();
      bestPost.title = draft?.form_data?.functietitel || draft?.form_data?.onderwerp || draft?.form_data?.title || 'Zonder titel';
    }
  }

  // Website stats (from latest snapshot)
  const { data: websiteSnapshot } = await supabase
    .from('metric_snapshot')
    .select('value_json')
    .eq('metric_key', 'website.stats.daily')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sollicitaties
  const { data: jobitSnapshot } = await supabase
    .from('metric_snapshot')
    .select('value')
    .eq('metric_key', 'jobit.applications.count')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const monthName = now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

  return {
    monthName,
    vacatures: {
      actief: actiefCount || 0,
      nieuw: nieuwCount || 0,
      prevNieuw: prevNieuwCount || 0,
      sollicitatiesJobit: jobitSnapshot?.value || 0,
    },
    marketing: {
      postsThisMonth: (pubsThisMonth || []).length,
      postsLastMonth: (pubsLastMonth || []).length,
      metrics: thisMonthMetrics,
      prevMetrics: lastMonthMetrics,
      bestPost: bestPost ? {
        title: bestPost.title,
        reach: bestPost.metrics?.reach || 0,
        likes: bestPost.metrics?.likes || 0,
      } : null,
    },
    website: websiteSnapshot?.value_json || { visitors: 0, pageviews: 0 },
  };
}

/**
 * Generate AI insights from metrics data.
 * Falls back gracefully if the AI call fails.
 */
async function generateInsights(metricsData) {
  try {
    const { generateRawJson } = require('./claude');

    const systemBlocks = [{
      type: 'text',
      text: `Je bent een marketing-analist voor Light Personeelsdiensten, een uitzendbureau in Rotterdam.
Analyseer de meegegeven maandelijkse metrics en geef 3-5 concrete, actionable inzichten.

Schrijf in het Nederlands, informeel (je/jij). Focus op:
1. Wat werkte goed deze maand en waarom
2. Wat werkte minder en wat kan beter
3. Welk type content had het meeste bereik/engagement
4. Concrete suggesties voor volgende maand
5. Opvallende trends (stijgend/dalend t.o.v. vorige maand)

Houd het kort: max 200 woorden, in bullet points.
Geen algemeenheden, verwijs naar specifieke posts/vacatures waar mogelijk.

Retourneer ALLEEN geldige JSON: { "insights": "bullet points als string" }`,
    }];

    const result = await generateRawJson(systemBlocks, { metrics: metricsData });
    return result?.insights || null;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[email] AI insights generation failed:', err.message);
    }
    return null;
  }
}

/**
 * Build and send the monthly report email.
 * @param {object} config - email_report_config row
 * @param {boolean} isTest - if true, subject gets [TEST] prefix
 */
async function sendReportEmail(config, isTest = false) {
  const metricsData = await gatherReportData();

  let insights = null;
  if (config.include_ai_insights !== false) {
    insights = await generateInsights(metricsData);
  }

  const appUrl = process.env.CORS_ORIGIN || 'https://app.lightpersoneelsdiensten.nl';
  const html = buildReportHtml(metricsData, { ...config, insights, appUrl });
  const subject = `${isTest ? '[TEST] ' : ''}Light Marketing — Maandrapport ${metricsData.monthName}`;

  await sendEmail({
    to: config.recipients,
    subject,
    html,
  });

  return { sent: true, recipients: config.recipients.length };
}

module.exports = { sendEmail, sendReportEmail, gatherReportData };
