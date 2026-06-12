const { publishDraft, expirePublishedDraft } = require('./publication');

async function publish(draftId, type, channels, contentPayload) {
  const draft = {
    id: draftId,
    type,
    form_data: contentPayload?.form_data || {},
    content_nl: contentPayload?.omschrijving_nl || null,
    social_nl: contentPayload?.social_nl || null,
    content_pl: contentPayload?.omschrijving_pl || null,
    social_pl: contentPayload?.social_pl || null,
    linkedin_post: contentPayload?.linkedin_post || null,
    instagram_caption: contentPayload?.instagram_caption || null,
    image_path: contentPayload?.image_path || null,
  };

  return publishDraft(draft, channels);
}

async function expire(draftId, externalIds) {
  const rows = Array.isArray(externalIds)
    ? externalIds.filter(Boolean).map((id) => ({ external_id: id }))
    : [];

  return expirePublishedDraft({ id: draftId }, rows);
}

module.exports = {
  publish,
  expire,
};
