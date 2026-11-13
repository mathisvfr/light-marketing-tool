// Metrics cron scheduler — runs nightly snapshotters at 03:00 Amsterdam time.
// Called from backend/src/index.js at boot. No-op in test environment.

const dbSnapshotter = require('./db_snapshotter');
const bufferSnapshotter = require('./buffer_snapshotter');
const websiteSnapshotter = require('./website_snapshotter');
const jobitSnapshotter = require('./jobit_snapshotter');

const NIGHTLY_HOUR = 3; // 03:00 Europe/Amsterdam

function getNextRunMs() {
  const now = new Date();
  // Target: next 03:00 in Amsterdam timezone
  const amsterdamNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const target = new Date(amsterdamNow);
  target.setHours(NIGHTLY_HOUR, 0, 0, 0);

  // If we're past 03:00 today, schedule for tomorrow
  if (amsterdamNow >= target) {
    target.setDate(target.getDate() + 1);
  }

  // Convert back: the difference in local-time is what we need
  const diffMs = target.getTime() - amsterdamNow.getTime();
  return Math.max(diffMs, 60_000); // at least 1 minute
}

async function runAllSnapshotters() {
  const log = (msg) => {
    if (process.env.NODE_ENV !== 'production') return;
    console.log(`[metrics-cron] ${msg}`);
  };

  try {
    const dbResult = await dbSnapshotter.run();
    log(`db_snapshotter: ${dbResult.written} written, ${dbResult.errors.length} errors`);
  } catch (err) {
    log(`db_snapshotter failed: ${err.message}`);
  }

  try {
    const bufferResult = await bufferSnapshotter.run();
    log(`buffer_snapshotter: ${bufferResult.written} written, ${bufferResult.errors.length} errors`);
  } catch (err) {
    log(`buffer_snapshotter failed: ${err.message}`);
  }

  try {
    const websiteResult = await websiteSnapshotter.run();
    if (websiteResult.skipped) {
      log(`website_snapshotter: skipped — ${websiteResult.reason || 'niet geconfigureerd'}`);
    } else {
      log(`website_snapshotter: ${websiteResult.written} written, ${websiteResult.errors.length} errors`);
    }
  } catch (err) {
    log(`website_snapshotter failed: ${err.message}`);
  }

  try {
    const jobitResult = await jobitSnapshotter.run();
    if (jobitResult.skipped) {
      log(`jobit_snapshotter: skipped — ${jobitResult.reason || 'niet geconfigureerd'}`);
    } else {
      log(`jobit_snapshotter: ${jobitResult.written} written, ${jobitResult.errors.length} errors`);
    }
  } catch (err) {
    log(`jobit_snapshotter failed: ${err.message}`);
  }
}

// --- Email report cron ---
// Runs on the configured hour (default 08:00 Amsterdam) on the configured day
// of the month. Checks every hour whether it's time to send.

async function checkEmailReportSchedule() {
  try {
    const { supabase: sb } = require('../../db/client');
    const { data: config } = await sb
      .from('email_report_config')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    if (!config || config.frequency === 'disabled') return;
    if (!config.recipients || config.recipients.length === 0) return;

    // Check if it's the right day and hour
    const nowAmsterdam = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
    const dayOfMonth = nowAmsterdam.getDate();
    const hour = nowAmsterdam.getHours();

    if (dayOfMonth !== (config.day_of_month || 28)) return;
    if (hour !== (config.hour || 8)) return;

    // Check if already sent this month
    if (config.last_sent_at) {
      const lastSent = new Date(config.last_sent_at);
      const monthStart = new Date(nowAmsterdam.getFullYear(), nowAmsterdam.getMonth(), 1);
      if (lastSent >= monthStart) return; // Already sent this month
    }

    const { sendReportEmail } = require('../email');
    await sendReportEmail(config);

    await sb
      .from('email_report_config')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    const log = (msg) => {
      if (process.env.NODE_ENV !== 'production') return;
      console.log(`[email-report] ${msg}`);
    };
    log(`Maandrapport verstuurd naar ${config.recipients.length} ontvanger(s).`);
  } catch (err) {
    // Log but don't crash — next check will retry
    console.error('[email-report] mislukt:', err?.message || err);
  }
}

function startCron() {
  if (process.env.NODE_ENV === 'test') return null;

  // Schedule nightly snapshotters
  const scheduleNext = () => {
    const ms = getNextRunMs();
    const handle = setTimeout(async () => {
      await runAllSnapshotters();
      scheduleNext(); // schedule the next day
    }, ms);
    if (handle.unref) handle.unref();
    return handle;
  };

  // Email report: check every hour
  const emailHandle = setInterval(async () => {
    await checkEmailReportSchedule();
  }, 60 * 60 * 1000); // 1 hour
  if (emailHandle.unref) emailHandle.unref();

  // Also check immediately at startup (in case we're starting at the right time)
  setTimeout(() => checkEmailReportSchedule(), 10_000);

  // Run db_snapshotter shortly after startup so metrics are populated immediately,
  // not waiting until 03:00. Only db_snapshotter (no external service dependencies).
  setTimeout(async () => {
    try {
      const result = await dbSnapshotter.run();
      if (process.env.NODE_ENV === 'production') {
        console.log(`[metrics-cron] startup db_snapshotter: ${result.written} written, ${result.errors.length} errors`);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        console.log(`[metrics-cron] startup db_snapshotter failed: ${err.message}`);
      }
    }
  }, 30_000);

  return scheduleNext();
}

module.exports = { startCron, runAllSnapshotters };
