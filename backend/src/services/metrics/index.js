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

function startCron() {
  if (process.env.NODE_ENV === 'test') return null;

  // Schedule first run
  const scheduleNext = () => {
    const ms = getNextRunMs();
    const handle = setTimeout(async () => {
      await runAllSnapshotters();
      scheduleNext(); // schedule the next day
    }, ms);
    if (handle.unref) handle.unref();
    return handle;
  };

  return scheduleNext();
}

module.exports = { startCron, runAllSnapshotters };
