// Website channel adapter.
// Both the marketing tool and the website share the same Supabase instance.
// "Publishing" a blog to the website is implicit: the website reads published
// drafts on each request. This adapter just records the publication row.
// The publish route handles status transitions (approved -> published) AFTER
// this adapter returns success.

async function publish(draft) {
  if (draft.type !== 'blog') {
    return {
      status: 'failed',
      externalId: null,
      error: `Website-publicatie is alleen beschikbaar voor blogs, niet voor ${draft.type}.`,
    };
  }

  // Shared DB = implicit publish. The publish route sets status to 'published'
  // after we return success, and the website picks up the blog on next request.
  return {
    status: 'success',
    externalId: draft.id,
    error: null,
  };
}

async function expire() {
  // Expiring a blog = setting its status to 'expired' in the drafts table.
  // The website stops showing it on the next request. No external call needed.
  return { attempted: 0 };
}

module.exports = {
  publish,
  expire,
};
