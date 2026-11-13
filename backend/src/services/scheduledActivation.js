'use strict';

// Scheduled activation cron: checks every 60 seconds for drafts with
// scheduled_for <= now() AND status = 'approved', then activates them:
//   - vacatures: status -> 'actief' (appears in XML feed)
//   - blogs: status -> 'published' (triggers website publication)
//   - marketing-posts: skip (handled by Buffer's dueAt)
//
// Follows the same pattern as cleanup.js: setInterval + .unref(), no-op under test.

const { supabase } = require('../db/client');

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

async function activateScheduledDrafts() {
  const now = new Date().toISOString();

  // Find all approved drafts that are due for activation
  const { data: dueDrafts, error: fetchError } = await supabase
    .from('drafts')
    .select('id, type, status, scheduled_for, form_data')
    .eq('status', 'approved')
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', now)
    .limit(50);

  if (fetchError) {
    throw fetchError;
  }

  if (!dueDrafts || dueDrafts.length === 0) {
    return { activated: 0 };
  }

  let activated = 0;

  for (const draft of dueDrafts) {
    let newStatus;

    if (draft.type === 'vacature') {
      newStatus = 'actief';
    } else if (draft.type === 'blog') {
      newStatus = 'published';
    } else {
      // marketing-posts are handled by Buffer — skip
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const { error: updateError } = await supabase
      .from('drafts')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.id)
      .eq('status', 'approved'); // optimistic lock — only update if still approved

    if (updateError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[scheduled-activation] fout bij activeren ${draft.id}:`, updateError.message);
      }
      continue;
    }

    activated += 1;

    if (process.env.NODE_ENV !== 'production') {
      const title = draft.form_data?.functietitel || draft.form_data?.onderwerp || draft.form_data?.title || draft.id;
      console.log(`[scheduled-activation] ${draft.type} "${title}" geactiveerd → ${newStatus}`);
    }
  }

  return { activated };
}

// Start the periodic check. No-op under tests. Timer is unref'd so it
// never keeps the process alive on its own.
function startScheduledActivation() {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  // Run once immediately on startup to catch anything that was due while the server was down
  activateScheduledDrafts().catch((err) => {
    console.error('[scheduled-activation] initiële run mislukt:', err?.message || err);
  });

  const timer = setInterval(() => {
    activateScheduledDrafts().catch((err) => {
      console.error('[scheduled-activation] mislukt:', err?.message || err);
    });
  }, CHECK_INTERVAL_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return timer;
}

module.exports = {
  activateScheduledDrafts,
  startScheduledActivation,
};
