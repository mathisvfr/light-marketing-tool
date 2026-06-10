function notificationsEnabled() {
  return String(process.env.NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true';
}

async function notify(event, payload) {
  if (!notificationsEnabled()) {
    return { delivered: false, reason: 'disabled' };
  }

  const transport = String(process.env.NOTIFICATION_TRANSPORT || 'placeholder').toLowerCase();

  if (transport === 'placeholder') {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[notifications placeholder]', { event, payload });
    }
    return { delivered: false, reason: 'placeholder' };
  }

  // Future extension point: smtp, mailgun, postmark, etc.
  return { delivered: false, reason: `unsupported-transport:${transport}` };
}

module.exports = {
  notify,
};