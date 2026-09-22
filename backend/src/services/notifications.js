const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const { supabase } = require('../db/client');

// Transactional-integrity rule (Eng review HIGH): notify() must be called AFTER
// the DB transaction that triggered it commits. Callers put notify() in a
// deferred-microtask (setImmediate) after res.json / after supabase.update.
// This module never rethrows — a failed transport writes a notification_log
// row and logs, but does not disturb the calling route.

function notificationsEnabled() {
  return String(process.env.NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true';
}

function transportName() {
  return String(process.env.NOTIFICATION_TRANSPORT || 'logger').toLowerCase();
}

function appBaseUrl() {
  return process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || '';
}

// Deep-link into the wachtrij with the draft pre-focused. Frontend picks up
// the query param and scrolls / highlights.
function draftDeepLink(draftId) {
  const base = appBaseUrl().replace(/\/$/, '');
  return `${base}/content-wachtrij?draft=${draftId}`;
}

// HTML email helpers — branded shell matching the website design.
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emailShell(heading, preheader, contentHtml) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
${preheader ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</span>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="background-color:#f4f4f5;padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
    <tr>
      <td style="background-color:#be1e2d;padding:24px 32px;border-radius:8px 8px 0 0;">
        <h2 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">${esc(heading)}</h2>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:28px 32px;border-radius:0 0 8px 8px;">
        ${contentHtml}
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;text-align:center;">
          Dit bericht is automatisch verzonden via Light Marketing Tool
        </p>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`;
}

function ctaButton(url, label) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
  <tr>
    <td style="background-color:#be1e2d;border-radius:6px;padding:12px 24px;">
      <a href="${esc(url)}" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">${esc(label)}</a>
    </td>
  </tr>
</table>`;
}

function paragraph(text) {
  return `<p style="color:#1f2937;line-height:1.6;margin:0 0 16px;">${esc(text)}</p>`;
}

// Dutch email templates per event. Kept plain-text-first (works even if
// downstream converts to HTML). All copy audited: no em-dashes, no en-dashes.
function renderTemplate(event, payload) {
  const link = draftDeepLink(payload.draft_id);
  const title = payload.title || 'concept';
  const actor = payload.actor_name || 'iemand';
  const reason = payload.reason || '';

  switch (event) {
    case 'draft.submitted': {
      const subject = `${actor} vraagt goedkeuring: ${title}`;
      const preheader = 'Er wacht een concept op je in de tool.';
      return {
        subject,
        preheader,
        body: [
          `Hoi,`,
          ``,
          `${actor} heeft een concept ingediend ter goedkeuring: "${title}".`,
          ``,
          `Bekijk het concept en keur het goed of wijs het af:`,
          link,
          ``,
          `Groet,`,
          `Light Marketing Tool`,
        ].join('\n'),
        html: emailShell('Concept ter goedkeuring', preheader, `
          ${paragraph('Hoi,')}
          ${paragraph(`${actor} heeft een concept ingediend ter goedkeuring: "${title}".`)}
          ${paragraph('Bekijk het concept en keur het goed of wijs het af:')}
          ${ctaButton(link, 'Concept bekijken')}
          ${paragraph('Groet,')}
          ${paragraph('Light Marketing Tool')}
        `),
      };
    }
    case 'draft.approved': {
      const subject = `Goedgekeurd: ${title}`;
      const preheader = `${actor} heeft je concept goedgekeurd.`;
      return {
        subject,
        preheader,
        body: [
          `Hoi,`,
          ``,
          `${actor} heeft je concept goedgekeurd: "${title}".`,
          ``,
          `Voor vacatures verschijnt het concept nu in de XML feed.`,
          `Voor marketingposts kan het via Buffer gepubliceerd worden.`,
          ``,
          `Bekijk in de tool:`,
          link,
          ``,
          `Groet,`,
          `Light Marketing Tool`,
        ].join('\n'),
        html: emailShell('Concept goedgekeurd', preheader, `
          ${paragraph('Hoi,')}
          ${paragraph(`${actor} heeft je concept goedgekeurd: "${title}".`)}
          <div style="background-color:#f0fdf4;border-left:3px solid #16a34a;padding:14px 18px;border-radius:0 6px 6px 0;margin:0 0 16px;">
            <p style="color:#166534;margin:0;line-height:1.6;">Voor vacatures verschijnt het concept nu in de XML feed. Voor marketingposts kan het via Buffer gepubliceerd worden.</p>
          </div>
          ${ctaButton(link, 'Bekijk in de tool')}
          ${paragraph('Groet,')}
          ${paragraph('Light Marketing Tool')}
        `),
      };
    }
    case 'draft.rejected': {
      const subject = `Afgewezen: ${title}`;
      const preheader = `${actor} heeft je concept afgewezen.`;
      return {
        subject,
        preheader,
        body: [
          `Hoi,`,
          ``,
          `${actor} heeft je concept afgewezen: "${title}".`,
          reason ? `` : null,
          reason ? `Reden: ${reason}` : null,
          ``,
          `Je kunt het concept bewerken en opnieuw indienen:`,
          link,
          ``,
          `Groet,`,
          `Light Marketing Tool`,
        ].filter((line) => line !== null).join('\n'),
        html: emailShell('Concept afgewezen', preheader, `
          ${paragraph('Hoi,')}
          ${paragraph(`${actor} heeft je concept afgewezen: "${title}".`)}
          ${reason ? `<div style="background-color:#fef2f2;border-left:3px solid #dc2626;padding:14px 18px;border-radius:0 6px 6px 0;margin:0 0 16px;">
            <p style="font-weight:600;color:#374151;margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Reden</p>
            <p style="color:#991b1b;margin:0;line-height:1.6;">${esc(reason)}</p>
          </div>` : ''}
          ${paragraph('Je kunt het concept bewerken en opnieuw indienen:')}
          ${ctaButton(link, 'Concept bewerken')}
          ${paragraph('Groet,')}
          ${paragraph('Light Marketing Tool')}
        `),
      };
    }
    case 'publication.fired': {
      const subject = `Gepubliceerd: ${title}`;
      const preheader = `Je post is live op ${payload.channel || 'het kanaal'}.`;
      return {
        subject,
        preheader,
        body: [
          `Hoi,`,
          ``,
          `Je post is gepubliceerd via Buffer op ${payload.channel || 'het gekozen kanaal'}: "${title}".`,
          ``,
          `Bekijk in de tool:`,
          link,
          ``,
          `Groet,`,
          `Light Marketing Tool`,
        ].join('\n'),
        html: emailShell('Content gepubliceerd', preheader, `
          ${paragraph('Hoi,')}
          ${paragraph(`Je post is gepubliceerd via Buffer op ${payload.channel || 'het gekozen kanaal'}: "${title}".`)}
          ${ctaButton(link, 'Bekijk in de tool')}
          ${paragraph('Groet,')}
          ${paragraph('Light Marketing Tool')}
        `),
      };
    }
    case 'email.verify': {
      const subject = 'Bevestig je nieuwe e-mailadres - Light Marketing Tool';
      const preheader = 'Klik op de link om je nieuwe e-mailadres te bevestigen.';
      return {
        subject,
        preheader,
        body: [
          'Hoi,',
          '',
          'Je hebt een verzoek ingediend om je e-mailadres te wijzigen.',
          '',
          'Klik op deze link om je nieuwe e-mailadres te bevestigen:',
          payload.verifyLink,
          '',
          'Deze link is 24 uur geldig.',
          '',
          'Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.',
          '',
          'Groet,',
          'Light Marketing Tool',
        ].join('\n'),
        html: emailShell('E-mailadres bevestigen', preheader, `
          ${paragraph('Hoi,')}
          ${paragraph('Je hebt een verzoek ingediend om je e-mailadres te wijzigen.')}
          ${paragraph('Klik op de knop hieronder om je nieuwe e-mailadres te bevestigen:')}
          ${ctaButton(payload.verifyLink, 'E-mailadres bevestigen')}
          <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 16px;">Deze link is 24 uur geldig. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>
          ${paragraph('Groet,')}
          ${paragraph('Light Marketing Tool')}
        `),
      };
    }
    case 'password.reset': {
      const subject = 'Wachtwoord resetten - Light Marketing Tool';
      const preheader = 'Klik op de link om je wachtwoord te resetten.';
      return {
        subject,
        preheader,
        body: [
          'Hoi,',
          '',
          'Er is een verzoek ingediend om je wachtwoord te resetten.',
          '',
          'Klik op deze link om een nieuw wachtwoord in te stellen:',
          payload.resetLink,
          '',
          'Deze link is 1 uur geldig.',
          '',
          'Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.',
          '',
          'Groet,',
          'Light Marketing Tool',
        ].join('\n'),
        html: emailShell('Wachtwoord resetten', preheader, `
          ${paragraph('Hoi,')}
          ${paragraph('Er is een verzoek ingediend om je wachtwoord te resetten.')}
          ${paragraph('Klik op de knop hieronder om een nieuw wachtwoord in te stellen:')}
          ${ctaButton(payload.resetLink, 'Wachtwoord resetten')}
          <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 16px;">Deze link is 1 uur geldig. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>
          ${paragraph('Groet,')}
          ${paragraph('Light Marketing Tool')}
        `),
      };
    }
    default:
      return {
        subject: `Update: ${title}`,
        preheader: '',
        body: `Er is een update op je concept "${title}": ${link}`,
        html: emailShell('Update', '', `
          ${paragraph(`Er is een update op je concept "${title}".`)}
          ${ctaButton(link, 'Bekijk in de tool')}
        `),
      };
  }
}

// Logger transport (Push 1 default): appends to a jsonl file so a future
// operator can grep-audit what would have been sent. Swap to real SMTP by
// setting NOTIFICATION_TRANSPORT=smtp + SMTP_USER/SMTP_PASS.
async function loggerTransport({ to, subject, body, html }) {
  const logDir = path.resolve(__dirname, '..', '..', 'uploads', 'notifications');
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const filePath = path.join(logDir, 'notifications.jsonl');
    fs.appendFileSync(
      filePath,
      JSON.stringify({ at: new Date().toISOString(), to, subject, body, html: html ? '(html included)' : null }) + '\n'
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'logger write failed' };
  }
}

// Cached nodemailer transporter — created once, reused across all dispatches.
let _smtpTransporter = null;

function getSmtpTransporter() {
  if (!_smtpTransporter) {
    _smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // STARTTLS on port 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _smtpTransporter;
}

async function smtpTransport({ to, subject, body, html }) {
  const from = process.env.NOTIFICATION_FROM || 'Light Marketing Tool <noreply@lightpersoneelsdiensten.nl>';
  const listUnsubUrl = process.env.PUBLIC_APP_URL
    ? `${process.env.PUBLIC_APP_URL.replace(/\/$/, '')}/notificaties/uitschrijven`
    : null;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { ok: false, error: 'SMTP_USER en/of SMTP_PASS ontbreekt' };
  }

  try {
    const headers = {};
    if (listUnsubUrl) {
      headers['List-Unsubscribe'] = `<${listUnsubUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    await getSmtpTransporter().sendMail({
      from,
      to,
      subject,
      text: body,
      html: html || undefined,
      headers,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'smtp send failed' };
  }
}

async function dispatch(transport, args) {
  if (transport === 'smtp') return smtpTransport(args);
  if (transport === 'logger' || transport === 'placeholder') return loggerTransport(args);
  return { ok: false, error: `unsupported-transport:${transport}` };
}

// notify(event, { draft_id, actor_name, title, recipient_user_ids, ... })
// - draft_id  : which draft the event is about (for idempotency + deep-link)
// - actor_name: display name of the person who triggered the event
// - title     : draft title for the subject line
// - recipient_user_ids: array of user UUIDs to notify (route decides who)
// Never throws. Always returns { attempted, delivered, skipped, failed }.
async function notify(event, payload) {
  if (!notificationsEnabled()) {
    return { delivered: false, reason: 'disabled' };
  }

  const recipients = Array.isArray(payload?.recipient_user_ids) ? payload.recipient_user_ids : [];
  const draft_id = payload?.draft_id || null;
  if (!draft_id || recipients.length === 0) {
    return { delivered: false, reason: 'no-recipients' };
  }

  const transport = transportName();
  const template = renderTemplate(event, payload);

  const result = { attempted: recipients.length, delivered: 0, skipped: 0, failed: 0 };

  // Fetch notification preferences for all recipients
  const { data: allPrefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .in('user_id', recipients);

  const prefsMap = new Map();
  for (const p of (allPrefs || [])) {
    prefsMap.set(p.user_id, p);
  }

  const EVENT_TO_PREF_KEY = {
    'draft.submitted': 'email_draft_submitted',
    'draft.approved': 'email_draft_approved',
    'draft.rejected': 'email_draft_rejected',
    'publication.fired': 'email_publication_fired',
  };

  for (const userId of recipients) {
    try {
      // Check email preference for this user
      const userPrefs = prefsMap.get(userId);
      const emailMasterEnabled = userPrefs?.email_enabled !== false; // default true
      const eventPrefKey = EVENT_TO_PREF_KEY[event];
      const eventPrefValue = eventPrefKey ? userPrefs?.[eventPrefKey] : undefined;
      // Event-level overrides master when explicitly set (not null)
      const shouldEmail = eventPrefValue !== null && eventPrefValue !== undefined
        ? eventPrefValue
        : emailMasterEnabled;

      if (!shouldEmail) {
        result.skipped += 1;
        await supabase.from('notification_log').insert({
          event,
          draft_id,
          recipient_user_id: userId,
          status: 'skipped',
          transport,
          error_message: 'user preference: email disabled',
        });
        continue;
      }

      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', userId)
        .maybeSingle();
      if (userErr || !user?.email) {
        result.failed += 1;
        await supabase.from('notification_log').insert({
          event,
          draft_id,
          recipient_user_id: userId,
          status: 'failed',
          transport,
          error_message: userErr?.message || 'user not found or no email',
        });
        continue;
      }

      const dispatchResult = await dispatch(transport, {
        to: user.email,
        subject: template.subject,
        body: template.body,
        html: template.html,
      });

      // Idempotency: try to insert with UNIQUE (event, draft_id, recipient).
      // On conflict, skip. The transport already fired but we don't double-log.
      const { error: insertErr } = await supabase.from('notification_log').insert({
        event,
        draft_id,
        recipient_user_id: userId,
        status: dispatchResult.ok ? 'sent' : 'failed',
        transport,
        error_message: dispatchResult.ok ? null : (dispatchResult.error || 'unknown'),
      });

      if (insertErr) {
        // Duplicate (23505) means we already fired this. Skip silently.
        if (String(insertErr.code) === '23505') {
          result.skipped += 1;
        } else {
          result.failed += 1;
          console.error('[notifications] log insert failed:', insertErr.message);
        }
      } else if (dispatchResult.ok) {
        result.delivered += 1;
      } else {
        result.failed += 1;
        console.error('[notifications] transport failed:', dispatchResult.error);
      }
    } catch (err) {
      result.failed += 1;
      console.error('[notifications] unexpected error:', err.message);
    }
  }

  // Create in-app notification for each recipient (never blocks)
  for (const userId of recipients) {
    const userPrefs = prefsMap.get(userId);
    if (userPrefs?.in_app_enabled === false) continue; // default true

    try {
      await supabase.from('in_app_notifications').insert({
        user_id: userId,
        type: event,
        title: template.subject,
        message: template.body.slice(0, 200),
        link: draftDeepLink(draft_id),
      });
    } catch (_e) { /* never block */ }
  }

  return result;
}

// Post-commit notify: convenience wrapper for routes. Fires notify() on the
// next tick so the current request completes first. Never blocks the response.
function notifyAfterCommit(event, payload) {
  setImmediate(() => {
    notify(event, payload).catch((err) => {
      console.error('[notifications] post-commit dispatch failed:', err.message);
    });
  });
}

// Direct password-reset email — bypasses the normal notify flow (no draft_id,
// no notification_log). Used by the forgot-password endpoint.
async function sendPasswordReset(email, name, resetLink) {
  const transport = transportName();
  const template = renderTemplate('password.reset', { resetLink });
  const result = await dispatch(transport, {
    to: email,
    subject: template.subject,
    body: template.body,
    html: template.html,
  });
  return result;
}

async function sendEmailVerification(email, name, verifyLink) {
  const transport = transportName();
  const template = renderTemplate('email.verify', { verifyLink });
  const result = await dispatch(transport, {
    to: email,
    subject: template.subject,
    body: template.body,
    html: template.html,
  });
  return result;
}

module.exports = {
  notify,
  notifyAfterCommit,
  sendPasswordReset,
  sendEmailVerification,
  // Exports below are for tests only.
  __testables: { renderTemplate, loggerTransport, smtpTransport, dispatch },
};
