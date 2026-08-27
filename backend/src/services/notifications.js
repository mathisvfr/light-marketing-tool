const fs = require('node:fs');
const path = require('node:path');
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

// Dutch email templates per event. Kept plain-text-first (works even if
// downstream converts to HTML). All copy audited: no em-dashes, no en-dashes.
function renderTemplate(event, payload) {
  const link = draftDeepLink(payload.draft_id);
  const title = payload.title || 'concept';
  const actor = payload.actor_name || 'iemand';
  const reason = payload.reason || '';

  switch (event) {
    case 'draft.submitted':
      return {
        subject: `${actor} vraagt goedkeuring: ${title}`,
        preheader: 'Er wacht een concept op je in de tool.',
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
      };
    case 'draft.approved':
      return {
        subject: `Goedgekeurd: ${title}`,
        preheader: `${actor} heeft je concept goedgekeurd.`,
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
      };
    case 'draft.rejected':
      return {
        subject: `Afgewezen: ${title}`,
        preheader: `${actor} heeft je concept afgewezen.`,
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
      };
    case 'publication.fired':
      return {
        subject: `Gepubliceerd: ${title}`,
        preheader: `Je post is live op ${payload.channel || 'het kanaal'}.`,
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
      };
    default:
      return {
        subject: `Update: ${title}`,
        preheader: '',
        body: `Er is een update op je concept "${title}": ${link}`,
      };
  }
}

// Logger transport (Push 1 default): appends to a jsonl file so a future
// operator can grep-audit what would have been sent. Swap to real Resend by
// setting NOTIFICATION_TRANSPORT=resend + RESEND_API_KEY.
async function loggerTransport({ to, subject, body }) {
  const logDir = path.resolve(__dirname, '..', '..', 'uploads', 'notifications');
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const filePath = path.join(logDir, 'notifications.jsonl');
    fs.appendFileSync(
      filePath,
      JSON.stringify({ at: new Date().toISOString(), to, subject, body }) + '\n'
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'logger write failed' };
  }
}

async function resendTransport({ to, subject, body }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM || 'Light Marketing Tool <noreply@lightpersoneelsdiensten.nl>';
  const listUnsubUrl = process.env.PUBLIC_APP_URL
    ? `${process.env.PUBLIC_APP_URL.replace(/\/$/, '')}/notificaties/uitschrijven`
    : null;

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY ontbreekt' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: body,
        // GDPR: List-Unsubscribe (RFC 8058). Resend passes this through.
        headers: listUnsubUrl
          ? { 'List-Unsubscribe': `<${listUnsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
          : {},
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Resend ${response.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'resend fetch failed' };
  }
}

async function dispatch(transport, args) {
  if (transport === 'resend') return resendTransport(args);
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

  for (const userId of recipients) {
    try {
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

module.exports = {
  notify,
  notifyAfterCommit,
  // Exports below are for tests only.
  __testables: { renderTemplate, loggerTransport, resendTransport, dispatch },
};
