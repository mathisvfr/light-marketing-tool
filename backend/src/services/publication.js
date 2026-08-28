const { supabase } = require('../db/client');
const bufferChannel = require('./channels/buffer');
const websiteChannel = require('./channels/website');

function placeholderChannel(channel) {
  return {
    status: 'failed',
    error: `Kanaal '${channel}' heeft nog geen directe backend-integratie.`,
  };
}

async function publishChannel(channel, draft) {
  if (channel === 'linkedin' || channel === 'facebook_instagram' || channel === 'facebook' || channel === 'instagram') {
    return bufferChannel.publish(draft, channel);
  }

  if (channel === 'website') {
    return websiteChannel.publish(draft);
  }

  return placeholderChannel(channel);
}

async function savePublicationRows(draftId, rows) {
  if (!rows.length) {
    return;
  }

  const payload = rows.map((row) => ({
    draft_id: draftId,
    channel: row.channel,
    status: row.status,
    external_id: row.externalId || null,
    error_message: row.error || null,
    published_at: row.publishedAt,
    expired_at: row.expiredAt || null,
    scheduled_for: row.scheduledFor || null,
  }));

  const { error } = await supabase.from('publications').insert(payload);

  if (error) {
    throw error;
  }
}

async function publishDraft(draft, channels) {
  const requestedChannels = Array.isArray(channels) ? channels.filter(Boolean) : [];
  const scheduledFor = draft.scheduledFor || null;

  const rows = [];

  for (const channel of requestedChannels) {
    try {
      const result = await publishChannel(channel, draft);
      // Distinguish "Buffer accepted for future publication" from "already live"
      // so Gepubliceerd can show the future items separately. Only social channels
      // support Buffer scheduling; website (stub) does not.
      const isBufferScheduling = scheduledFor && channel !== 'website';
      const finalStatus =
        result.status === 'success' && isBufferScheduling
          ? 'scheduled'
          : result.status || 'failed';
      rows.push({
        channel,
        status: finalStatus,
        externalId: result.externalId || null,
        error: result.error || null,
        publishedAt: finalStatus === 'scheduled' ? null : new Date().toISOString(),
        scheduledFor: finalStatus === 'scheduled' ? scheduledFor : null,
      });
    } catch (error) {
      rows.push({
        channel,
        status: 'failed',
        externalId: null,
        error: error.message || 'Publicatie mislukt.',
        publishedAt: new Date().toISOString(),
      });
    }
  }

  await savePublicationRows(draft.id, rows);

  const successCount = rows.filter((row) => row.status === 'success').length;
  const scheduledCount = rows.filter((row) => row.status === 'scheduled').length;

  return {
    rows,
    successCount,
    scheduledCount,
    failedCount: rows.length - successCount - scheduledCount,
  };
}

async function expirePublishedDraft(_draft, publicationRows) {
  // Placeholder for direct per-channel expire actions (e.g. new site).
  // We still mark drafts/publications as expired in the DB route layer.
  return {
    attempted: Array.isArray(publicationRows) ? publicationRows.length : 0,
  };
}

async function publishSeoPage(_page) {
  return {
    status: 'failed',
    externalId: null,
    error: websiteChannel.NOT_CONFIGURED_ERROR,
  };
}

module.exports = {
  publishDraft,
  expirePublishedDraft,
  publishSeoPage,
};
