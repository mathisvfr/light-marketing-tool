'use strict';

// Auto-archive cron: daily check for stale draft/rejected items.
// - 14-21 days old: send warning notification (idempotent)
// - 21+ days old: auto-archive + send notification
// Follows the same setInterval + .unref() pattern as cleanup.js and bufferSync.js.

const { supabase } = require('../db/client');
const { getDraftTitle } = require('./draftUtils');

const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_AFTER_DAYS = 14;
const ARCHIVE_AFTER_DAYS = 21;
const FIRST_RUN_BUNDLE_THRESHOLD = 5;

async function runAutoArchive() {
  const now = new Date();
  const warnCutoff = new Date(now.getTime() - WARN_AFTER_DAYS * DAY_MS).toISOString();
  const archiveCutoff = new Date(now.getTime() - ARCHIVE_AFTER_DAYS * DAY_MS).toISOString();
  const nowIso = now.toISOString();

  // 1. Auto-archiveer (21+ dagen)
  const { data: toArchive } = await supabase
    .from('drafts')
    .select('id, status, form_data, created_by')
    .in('status', ['draft', 'rejected'])
    .lt('updated_at', archiveCutoff);

  const archivedItems = toArchive || [];

  for (const draft of archivedItems) {
    await supabase.from('drafts').update({
      pre_archive_status: draft.status,
      status: 'archived',
      archived_at: nowIso,
      updated_at: nowIso,
    }).eq('id', draft.id);
  }

  // Notifications for archived items
  if (archivedItems.length > 0) {
    if (archivedItems.length > FIRST_RUN_BUNDLE_THRESHOLD) {
      // Bundle: one notification per user instead of per item
      const byUser = new Map();
      for (const draft of archivedItems) {
        if (!draft.created_by) continue;
        if (!byUser.has(draft.created_by)) byUser.set(draft.created_by, 0);
        byUser.set(draft.created_by, byUser.get(draft.created_by) + 1);
      }

      for (const [userId, count] of byUser) {
        await supabase.from('in_app_notifications').insert({
          user_id: userId,
          type: 'draft.auto_archived',
          title: `${count} oude concepten automatisch gearchiveerd`,
          message: `${count} concepten zijn automatisch gearchiveerd omdat ze langer dan 3 weken ongewijzigd waren. Je kunt ze terugzetten vanuit het archief.`,
          link: '/content-wachtrij?status=archived',
        });
      }
    } else {
      // Individual notifications
      for (const draft of archivedItems) {
        if (!draft.created_by) continue;

        await supabase.from('in_app_notifications').insert({
          user_id: draft.created_by,
          type: 'draft.auto_archived',
          title: `Automatisch gearchiveerd: ${getDraftTitle(draft.form_data)}`,
          message: 'Dit concept is automatisch gearchiveerd omdat er 3 weken niets mee is gedaan. Je kunt het terugzetten vanuit het archief.',
          link: '/content-wachtrij?status=archived',
        });
      }
    }
  }

  // 2. Waarschuwingen (14-21 dagen)
  const { data: toWarn } = await supabase
    .from('drafts')
    .select('id, status, form_data, created_by')
    .in('status', ['draft', 'rejected'])
    .lt('updated_at', warnCutoff)
    .gte('updated_at', archiveCutoff);

  for (const draft of (toWarn || [])) {
    if (!draft.created_by) continue;

    // Idempotentie: skip als al gewaarschuwd in de afgelopen 7 dagen
    const recentCutoff = new Date(now.getTime() - 7 * DAY_MS).toISOString();
    const { count } = await supabase
      .from('in_app_notifications')
      .select('*', { head: true, count: 'exact' })
      .eq('user_id', draft.created_by)
      .eq('type', 'draft.archive_warning')
      .like('link', `%draft=${draft.id}%`)
      .gt('created_at', recentCutoff);

    if ((count || 0) > 0) continue;

    await supabase.from('in_app_notifications').insert({
      user_id: draft.created_by,
      type: 'draft.archive_warning',
      title: `Wordt binnenkort gearchiveerd: ${getDraftTitle(draft.form_data)}`,
      message: 'Dit concept wordt over een week automatisch gearchiveerd als je er niets mee doet.',
      link: `/content-wachtrij?draft=${draft.id}`,
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    const warned = (toWarn || []).length;
    console.log(`[auto-archive] ${archivedItems.length} gearchiveerd, ${warned} gewaarschuwd.`);
  }
}

function startAutoArchiveSchedule() {
  if (process.env.NODE_ENV === 'test') return null;

  // Eerste run na 1 minuut (wacht tot DB-connectie stabiel is)
  setTimeout(() => {
    runAutoArchive().catch((err) =>
      console.error('[auto-archive] eerste run mislukt:', err?.message || err)
    );
  }, 60_000);

  const timer = setInterval(() => {
    runAutoArchive().catch((err) =>
      console.error('[auto-archive] mislukt:', err?.message || err)
    );
  }, DAY_MS);

  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = { runAutoArchive, startAutoArchiveSchedule };
