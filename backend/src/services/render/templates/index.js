const { PLATFORM_SIZES } = require('../shared/tokens');

const templates = {
  'statement':        { fn: require('./statement'),       ...PLATFORM_SIZES.instagram },
  'vacancy':          { fn: require('./vacancy'),         ...PLATFORM_SIZES.instagram },
  'photo-feature':    { fn: require('./photo-feature'),   ...PLATFORM_SIZES.instagram },
  'story':            { fn: require('./story'),           ...PLATFORM_SIZES.instagramStory },
  // Per-platform variants (same component, different canvas)
  'statement-fb':     { fn: require('./statement'),       ...PLATFORM_SIZES.facebook },
  'statement-li':     { fn: require('./statement'),       ...PLATFORM_SIZES.linkedin },
  'vacancy-fb':       { fn: require('./vacancy'),         ...PLATFORM_SIZES.facebook },
  'vacancy-li':       { fn: require('./vacancy'),         ...PLATFORM_SIZES.linkedin },
  'photo-feature-fb': { fn: require('./photo-feature'),   ...PLATFORM_SIZES.facebook },
  'photo-feature-li': { fn: require('./photo-feature'),   ...PLATFORM_SIZES.linkedin },
  // Blog header: 1200x630 (Facebook/OG size, works as og:image)
  'blog-header':      { fn: require('./blog-header'),     ...PLATFORM_SIZES.facebook },
};

module.exports = templates;
