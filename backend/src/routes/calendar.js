const express = require('express');
const { fromZonedTime } = require('date-fns-tz');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const { nextSlot } = require('../services/patternScheduler');
const publishGateway = require('../services/publishGateway');
const { logActivity } = require('../services/activityLog');

const router = express.Router();

const APP_TIMEZONE = 'Europe/Amsterdam';
const CONFLICT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function getDraftTitle(formData) {
  if (!formData || typeof formData !== 'object') return 'Zonder titel';
  return formData.functietitel || formData.onderwerp || formData.title || formData.titel || 'Zonder titel';
}

// Parse a date string from query params. Returns null if invalid.
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Parse an ISO datetime for scheduling. Treats naive strings as Europe/Amsterdam.
function parseScheduledFor(raw) {
  if (!raw) return null;
  const str = String(raw);
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(str);
  const parsed = hasOffset ? new Date(str) : fromZonedTime(str, APP_TIMEZONE);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

// --------------------------------------------------------------------------
// GET /calendar?from=&to=
// Returns all content types in one response, filtered by date range.
// --------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);

    if (!from || !to) {
      return res.status(400).json({ error: 'Parameters "from" en "to" zijn verplicht (ISO datums).' });
    }

    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    // 1. Marketing-posts: get from publications table (scheduled/published)
    const { data: marketingPubs, error: pubError } = await supabase
      .from('publications')
      .select('id, draft_id, channel, status, scheduled_for, published_at')
      .or(`and(scheduled_for.gte.${fromIso},scheduled_for.lte.${toIso}),and(published_at.gte.${fromIso},published_at.lte.${toIso})`)
      .in('status', ['scheduled', 'success'])
      .limit(500);

    if (pubError) throw pubError;

    // Fetch the draft details for the publication rows
    const pubDraftIds = [...new Set((marketingPubs || []).map((p) => p.draft_id))];
    let pubDrafts = [];
    if (pubDraftIds.length > 0) {
      const { data, error } = await supabase
        .from('drafts')
        .select('id, type, form_data, parent_draft_id')
        .in('id', pubDraftIds);
      if (error) throw error;
      pubDrafts = data || [];
    }

    const pubDraftMap = new Map(pubDrafts.map((d) => [d.id, d]));

    const marketingItems = (marketingPubs || []).map((pub) => {
      const draft = pubDraftMap.get(pub.draft_id);
      return {
        id: pub.draft_id,
        type: draft?.type || 'marketing-post',
        title: getDraftTitle(draft?.form_data),
        channel: pub.channel,
        status: pub.status === 'success' ? 'published' : 'scheduled',
        scheduledFor: pub.scheduled_for || null,
        publishedAt: pub.published_at || null,
        parentDraftId: draft?.parent_draft_id || null,
      };
    });

    // 2. Vacatures with scheduled_for in range, or active vacatures
    const { data: vacatureDrafts, error: vacError } = await supabase
      .from('drafts')
      .select('id, type, form_data, status, scheduled_for, parent_draft_id, updated_at')
      .eq('type', 'vacature')
      .in('status', ['approved', 'actief'])
      .limit(500);

    if (vacError) throw vacError;

    const vacatureItems = (vacatureDrafts || [])
      .filter((d) => {
        // Include if scheduled_for is in range, or if actief and updated_at is in range
        if (d.scheduled_for) {
          const sf = new Date(d.scheduled_for);
          return sf >= from && sf <= to;
        }
        if (d.status === 'actief') {
          const ua = new Date(d.updated_at);
          return ua >= from && ua <= to;
        }
        return false;
      })
      .map((d) => ({
        id: d.id,
        type: 'vacature',
        title: getDraftTitle(d.form_data),
        channel: 'feed',
        status: d.status === 'actief' ? 'actief' : 'scheduled',
        scheduledFor: d.scheduled_for || null,
        publishedAt: d.status === 'actief' ? d.updated_at : null,
        parentDraftId: d.parent_draft_id || null,
      }));

    // 3. Blogs with scheduled_for in range, or published blogs
    const { data: blogDrafts, error: blogError } = await supabase
      .from('drafts')
      .select('id, type, form_data, blog_titel, status, scheduled_for, parent_draft_id, updated_at')
      .eq('type', 'blog')
      .in('status', ['approved', 'published'])
      .limit(500);

    if (blogError) throw blogError;

    const blogItems = (blogDrafts || [])
      .filter((d) => {
        if (d.scheduled_for) {
          const sf = new Date(d.scheduled_for);
          return sf >= from && sf <= to;
        }
        if (d.status === 'published') {
          const ua = new Date(d.updated_at);
          return ua >= from && ua <= to;
        }
        return false;
      })
      .map((d) => ({
        id: d.id,
        type: 'blog',
        title: d.blog_titel || getDraftTitle(d.form_data),
        channel: 'website',
        status: d.status === 'published' ? 'published' : 'scheduled',
        scheduledFor: d.scheduled_for || null,
        publishedAt: d.status === 'published' ? d.updated_at : null,
        parentDraftId: d.parent_draft_id || null,
      }));

    return res.json({
      items: [...marketingItems, ...vacatureItems, ...blogItems],
    });
  } catch (error) {
    return next(error);
  }
});

// --------------------------------------------------------------------------
// GET /calendar/slots?from=&to=&channel=
// Returns occupied slots for conflict detection.
// --------------------------------------------------------------------------
router.get('/slots', requireRole(['owner', 'manager']), async (req, res, next) => {
  try {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const channel = req.query.channel;

    if (!from || !to) {
      return res.status(400).json({ error: 'Parameters "from" en "to" zijn verplicht (ISO datums).' });
    }

    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const slots = [];

    // 1. Slots from publications (marketing-posts via Buffer)
    let pubQuery = supabase
      .from('publications')
      .select('draft_id, channel, scheduled_for')
      .eq('status', 'scheduled')
      .gte('scheduled_for', fromIso)
      .lte('scheduled_for', toIso);

    if (channel) {
      pubQuery = pubQuery.eq('channel', channel);
    }

    const { data: pubSlots, error: pubError } = await pubQuery.limit(500);
    if (pubError) throw pubError;

    // Fetch titles for publication draft_ids
    const pubDraftIds = [...new Set((pubSlots || []).map((p) => p.draft_id))];
    let pubTitleMap = new Map();
    if (pubDraftIds.length > 0) {
      const { data: draftRows } = await supabase
        .from('drafts')
        .select('id, form_data')
        .in('id', pubDraftIds);
      pubTitleMap = new Map((draftRows || []).map((d) => [d.id, getDraftTitle(d.form_data)]));
    }

    for (const pub of pubSlots || []) {
      slots.push({
        time: pub.scheduled_for,
        draftId: pub.draft_id,
        channel: pub.channel,
        title: pubTitleMap.get(pub.draft_id) || 'Zonder titel',
      });
    }

    // 2. Slots from drafts (vacatures/blogs with scheduled_for)
    let draftQuery = supabase
      .from('drafts')
      .select('id, type, form_data, blog_titel, scheduled_for')
      .eq('status', 'approved')
      .not('scheduled_for', 'is', null)
      .gte('scheduled_for', fromIso)
      .lte('scheduled_for', toIso);

    if (channel) {
      // Map channel to draft type
      if (channel === 'feed') {
        draftQuery = draftQuery.eq('type', 'vacature');
      } else if (channel === 'website') {
        draftQuery = draftQuery.eq('type', 'blog');
      }
      // If channel is linkedin/facebook/instagram, drafts won't have scheduled_for
      // (they use publications), so no additional filter needed
    }

    const { data: draftSlots, error: draftError } = await draftQuery.limit(500);
    if (draftError) throw draftError;

    for (const draft of draftSlots || []) {
      const draftChannel = draft.type === 'vacature' ? 'feed' : draft.type === 'blog' ? 'website' : null;
      if (!draftChannel) continue;
      if (channel && draftChannel !== channel) continue;

      slots.push({
        time: draft.scheduled_for,
        draftId: draft.id,
        channel: draftChannel,
        title: draft.blog_titel || getDraftTitle(draft.form_data),
      });
    }

    return res.json({ slots });
  } catch (error) {
    return next(error);
  }
});

// --------------------------------------------------------------------------
// POST /drafts/:id/schedule
// Manually schedule an approved draft to a specific datetime.
// --------------------------------------------------------------------------
router.post('/drafts/:id/schedule', requireRole(['owner', 'manager']), async (req, res, next) => {
  try {
    const draftId = req.params.id;
    const scheduledFor = parseScheduledFor(req.body?.scheduledFor);

    if (!scheduledFor) {
      return res.status(400).json({ error: 'Verplicht veld: scheduledFor (ISO 8601 datum/tijd).' });
    }

    // Must be in the future
    if (scheduledFor.getTime() <= Date.now() + 60_000) {
      return res.status(400).json({ error: 'Planningsdatum moet minstens 1 minuut in de toekomst liggen.' });
    }

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, type, status, form_data, omschrijving_nl, social_nl, linkedin_post, instagram_caption, image_path')
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) throw draftError;
    if (!draft) return res.status(404).json({ error: 'Concept niet gevonden.' });

    if (!['approved', 'actief'].includes(draft.status)) {
      return res.status(400).json({ error: 'Alleen goedgekeurde of actieve concepten kunnen worden ingepland.' });
    }

    const scheduledForIso = scheduledFor.toISOString();

    // Check for slot conflicts (same channel within 30 min window)
    const slotConflicts = await findSlotConflicts(draft, scheduledFor);

    if (draft.type === 'marketing-post') {
      // Marketing-posts: use existing Buffer scheduling via publishGateway
      const channels = Array.isArray(draft.form_data?.kanalen) ? draft.form_data.kanalen : [];
      if (channels.length === 0) {
        return res.status(400).json({ error: 'Geen kanalen geselecteerd voor deze marketingpost.' });
      }

      const scheduledForMap = {};
      for (const ch of channels) {
        scheduledForMap[ch] = scheduledForIso;
      }

      const contentPayload = {
        omschrijving_nl: draft.omschrijving_nl,
        social_nl: draft.social_nl,
        linkedin_post: draft.linkedin_post,
        instagram_caption: draft.instagram_caption,
        image_path: draft.image_path,
        form_data: draft.form_data,
      };

      const result = await publishGateway.publish(
        draftId,
        draft.type,
        channels,
        contentPayload,
        { scheduledForMap }
      );

      if (!result || (result.scheduledCount || 0) === 0) {
        return res.status(400).json({ error: 'Inplannen via Buffer mislukt. Controleer de kanaalinstellingen.' });
      }

      logActivity(req.user.id, req.user.name, 'draft.scheduled', 'draft', draftId, {
        title: getDraftTitle(draft.form_data),
        scheduledFor: scheduledForIso,
        channels,
      });

      return res.json({
        scheduledFor: scheduledForIso,
        channels,
        slotConflicts,
      });
    }

    // Vacatures and blogs: set scheduled_for on the draft itself
    const { error: updateError } = await supabase
      .from('drafts')
      .update({
        scheduled_for: scheduledForIso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    if (updateError) throw updateError;

    const channel = draft.type === 'vacature' ? 'feed' : 'website';

    logActivity(req.user.id, req.user.name, 'draft.scheduled', 'draft', draftId, {
      title: getDraftTitle(draft.form_data),
      scheduledFor: scheduledForIso,
      channel,
    });

    return res.json({
      scheduledFor: scheduledForIso,
      channel,
      slotConflicts,
    });
  } catch (error) {
    return next(error);
  }
});

// --------------------------------------------------------------------------
// POST /drafts/:id/unschedule
// Remove the scheduled_for from a draft (cancel scheduling).
// --------------------------------------------------------------------------
router.post('/drafts/:id/unschedule', requireRole(['owner', 'manager']), async (req, res, next) => {
  try {
    const draftId = req.params.id;

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, type, status, form_data, scheduled_for')
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) throw draftError;
    if (!draft) return res.status(404).json({ error: 'Concept niet gevonden.' });

    if (!draft.scheduled_for) {
      return res.status(400).json({ error: 'Dit concept is niet ingepland.' });
    }

    const { error: updateError } = await supabase
      .from('drafts')
      .update({ scheduled_for: null, updated_at: new Date().toISOString() })
      .eq('id', draftId);

    if (updateError) throw updateError;

    logActivity(req.user.id, req.user.name, 'draft.unscheduled', 'draft', draftId, {
      title: getDraftTitle(draft.form_data),
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// --------------------------------------------------------------------------
// POST /drafts/:id/smart-schedule
// Find next available slot using patternScheduler, skip conflicts.
// --------------------------------------------------------------------------
router.post('/drafts/:id/smart-schedule', requireRole(['owner', 'manager']), async (req, res, next) => {
  try {
    const draftId = req.params.id;

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, type, status, form_data')
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) throw draftError;
    if (!draft) return res.status(404).json({ error: 'Concept niet gevonden.' });

    if (draft.status !== 'approved') {
      return res.status(400).json({ error: 'Alleen goedgekeurde concepten kunnen slim worden ingepland.' });
    }

    // Determine which channels to look for
    const requestedChannels = Array.isArray(req.body?.channels) ? req.body.channels : null;

    // Get active patterns for this content type
    let patternsQuery = supabase
      .from('publication_patterns')
      .select('id, name, channel, weekdays, time_of_day, content_type')
      .eq('content_type', draft.type)
      .eq('is_active', true);

    if (requestedChannels && requestedChannels.length > 0) {
      patternsQuery = patternsQuery.in('channel', requestedChannels);
    }

    const { data: patterns, error: patternsError } = await patternsQuery;
    if (patternsError) throw patternsError;

    if (!patterns || patterns.length === 0) {
      return res.status(400).json({
        error: 'Geen actieve publicatiepatronen gevonden voor dit content-type. Maak er eerst een aan via Publicatiepatronen.',
      });
    }

    const now = new Date();
    const skippedSlots = [];

    // Try each pattern, find the first conflict-free slot
    for (const pattern of patterns) {
      let candidate = null;
      let attempts = 0;
      const MAX_ATTEMPTS = 14;

      let startFrom = now;

      while (attempts < MAX_ATTEMPTS) {
        attempts += 1;

        try {
          candidate = nextSlot(
            { weekdays: pattern.weekdays, time_of_day: pattern.time_of_day },
            startFrom
          );
        } catch {
          // No valid slot found within 14 days for this pattern
          break;
        }

        // Check for conflicts
        // eslint-disable-next-line no-await-in-loop
        const conflicts = await findSlotConflictsByChannel(pattern.channel, candidate);

        if (conflicts.length === 0) {
          // Found a conflict-free slot — schedule it

          // Use the schedule endpoint logic inline
          const scheduledForIso = candidate.toISOString();

          if (draft.type === 'marketing-post') {
            // Marketing-posts: set scheduled_for on draft, same as vacatures/blogs.
            // The actual Buffer publish happens via scheduledActivation cron or manual publish.
            // eslint-disable-next-line no-await-in-loop
            const { error: mktError } = await supabase
              .from('drafts')
              .update({
                scheduled_for: scheduledForIso,
                updated_at: new Date().toISOString(),
              })
              .eq('id', draftId);

            if (mktError) throw mktError;

            logActivity(req.user.id, req.user.name, 'draft.smart-scheduled', 'draft', draftId, {
              title: getDraftTitle(draft.form_data),
              scheduledFor: scheduledForIso,
              channel: pattern.channel,
              patternName: pattern.name,
            });

            return res.json({
              scheduledFor: scheduledForIso,
              channel: pattern.channel,
              patternName: pattern.name,
              skippedSlots,
            });
          }

          // Vacatures and blogs: set scheduled_for directly
          // eslint-disable-next-line no-await-in-loop
          const { error: updateError } = await supabase
            .from('drafts')
            .update({
              scheduled_for: scheduledForIso,
              updated_at: new Date().toISOString(),
            })
            .eq('id', draftId);

          if (updateError) throw updateError;

          logActivity(req.user.id, req.user.name, 'draft.smart-scheduled', 'draft', draftId, {
            title: getDraftTitle(draft.form_data),
            scheduledFor: scheduledForIso,
            channel: pattern.channel,
            patternName: pattern.name,
          });

          return res.json({
            scheduledFor: scheduledForIso,
            channel: pattern.channel,
            patternName: pattern.name,
            skippedSlots,
          });
        }

        // Conflict found — skip this slot and try next day
        skippedSlots.push({
          time: candidate.toISOString(),
          channel: pattern.channel,
          reason: 'conflict',
        });

        // Advance startFrom by 1 day past the candidate
        startFrom = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    return res.status(409).json({
      error: 'Geen vrij slot gevonden binnen 14 dagen. Probeer handmatig in te plannen.',
      skippedSlots,
    });
  } catch (error) {
    return next(error);
  }
});

// --------------------------------------------------------------------------
// POST /drafts/:id/cross-post
// Create a marketing-post draft from a blog (cross-type #11).
// --------------------------------------------------------------------------
router.post('/drafts/:id/cross-post', requireRole(['owner', 'manager']), async (req, res, next) => {
  try {
    const blogDraftId = req.params.id;

    const { data: blogDraft, error: blogError } = await supabase
      .from('drafts')
      .select('id, type, status, form_data, blog_titel, blog_html')
      .eq('id', blogDraftId)
      .maybeSingle();

    if (blogError) throw blogError;
    if (!blogDraft) return res.status(404).json({ error: 'Blog niet gevonden.' });

    if (blogDraft.type !== 'blog') {
      return res.status(400).json({ error: 'Cross-post is alleen beschikbaar voor blogs.' });
    }

    if (!['approved', 'published'].includes(blogDraft.status)) {
      return res.status(400).json({ error: 'Blog moet goedgekeurd of gepubliceerd zijn voor cross-post.' });
    }

    const channels = Array.isArray(req.body?.channels) ? req.body.channels : ['linkedin', 'facebook'];
    const postType = req.body?.type || 'Opdrachtgevers';

    // Build form_data for the marketing-post
    const formData = {
      onderwerp: blogDraft.blog_titel || getDraftTitle(blogDraft.form_data),
      type: postType,
      kanalen: channels,
      blog_context: {
        blog_id: blogDraft.id,
        blog_titel: blogDraft.blog_titel || getDraftTitle(blogDraft.form_data),
        blog_samenvatting: blogDraft.form_data?.samenvatting || '',
      },
    };

    const { data: newDraft, error: insertError } = await supabase
      .from('drafts')
      .insert({
        type: 'marketing-post',
        status: 'draft',
        form_data: formData,
        parent_draft_id: blogDraft.id,
        created_by: req.user.id,
      })
      .select('id, type, status, form_data, parent_draft_id, created_at')
      .single();

    if (insertError) throw insertError;

    logActivity(req.user.id, req.user.name, 'draft.cross-posted', 'draft', newDraft.id, {
      title: formData.onderwerp,
      parentBlogId: blogDraft.id,
      parentBlogTitle: blogDraft.blog_titel,
    });

    return res.status(201).json({
      draft: {
        id: newDraft.id,
        type: newDraft.type,
        status: newDraft.status,
        parentDraftId: newDraft.parent_draft_id,
        formData: newDraft.form_data,
        createdAt: newDraft.created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// --------------------------------------------------------------------------
// Helpers: conflict detection
// --------------------------------------------------------------------------

// Find conflicts for a draft being scheduled at a given time.
async function findSlotConflicts(draft, scheduledFor) {
  if (draft.type === 'vacature') {
    return findSlotConflictsByChannel('feed', scheduledFor);
  }
  if (draft.type === 'blog') {
    return findSlotConflictsByChannel('website', scheduledFor);
  }
  // Marketing-posts: check all their channels
  const channels = Array.isArray(draft.form_data?.kanalen) ? draft.form_data.kanalen : [];
  const all = [];
  for (const ch of channels) {
    // eslint-disable-next-line no-await-in-loop
    const conflicts = await findSlotConflictsByChannel(ch, scheduledFor);
    all.push(...conflicts);
  }
  return all;
}

// Find items scheduled on a specific channel within 30 min of the given time.
async function findSlotConflictsByChannel(channel, scheduledFor) {
  const windowStart = new Date(scheduledFor.getTime() - CONFLICT_WINDOW_MS).toISOString();
  const windowEnd = new Date(scheduledFor.getTime() + CONFLICT_WINDOW_MS).toISOString();

  const conflicts = [];

  // Check publications table (Buffer-scheduled marketing-posts)
  if (['linkedin', 'facebook', 'instagram'].includes(channel)) {
    const { data: pubConflicts } = await supabase
      .from('publications')
      .select('draft_id, channel, scheduled_for')
      .eq('channel', channel)
      .eq('status', 'scheduled')
      .gte('scheduled_for', windowStart)
      .lte('scheduled_for', windowEnd)
      .limit(10);

    for (const pub of pubConflicts || []) {
      conflicts.push({
        draftId: pub.draft_id,
        channel: pub.channel,
        time: pub.scheduled_for,
      });
    }
  }

  // Check drafts table (vacatures/blogs with scheduled_for)
  if (channel === 'feed' || channel === 'website') {
    const type = channel === 'feed' ? 'vacature' : 'blog';

    const { data: draftConflicts } = await supabase
      .from('drafts')
      .select('id, type, scheduled_for')
      .eq('type', type)
      .eq('status', 'approved')
      .not('scheduled_for', 'is', null)
      .gte('scheduled_for', windowStart)
      .lte('scheduled_for', windowEnd)
      .limit(10);

    for (const d of draftConflicts || []) {
      conflicts.push({
        draftId: d.id,
        channel,
        time: d.scheduled_for,
      });
    }
  }

  return conflicts;
}

module.exports = router;
