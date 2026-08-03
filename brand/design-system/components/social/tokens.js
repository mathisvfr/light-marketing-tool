/* Light — Satori-safe design tokens (literal values only: satori has no CSS var()
   support, so every color/font used inside the JSX templates must resolve to a
   literal at author time — mirror tokens/colors.css & tokens/typography.css by hand
   if the brand palette changes). */
export const TOKENS = {
  red: '#be1e2d',
  redHover: '#a81927',
  redPress: '#8d1420',
  redTint: '#e07b85',
  redSoft: '#fcedef',
  grey900: '#1f2123',
  grey800: '#2e3133',
  grey700: '#45494b',
  grey600: '#5f6365',
  grey500: '#787c7e',
  grey400: '#9a9ea0',
  grey200: '#e0e2e4',
  grey50: '#f6f7f8',
  white: '#ffffff',
  fontDisplay: 'Montserrat',
  fontBody: 'Open Sans',
};

/* Recommended feed-post canvas per platform. Statement/Vacancy/PhotoFeature all
   accept width+height directly and reflow between a stacked (square) layout and
   a side-by-side (landscape) layout, so the same component renders any of these. */
export const PLATFORM_SIZES = {
  instagram: { width: 1080, height: 1080 },
  facebook: { width: 1200, height: 630 },
  linkedin: { width: 1200, height: 627 },
  instagramStory: { width: 1080, height: 1920 },
};

/* Unsplash placeholders for previewing only — swap for real Light photography
   (production line / logistics / cleaning) before going live. */
export const PLACEHOLDER_PHOTOS = {
  food: 'https://images.unsplash.com/photo-1652211955967-99c892925469?w=1600&q=80',
  truck: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?w=1600&q=80',
  warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&q=80',
  clean: 'https://images.unsplash.com/photo-1749214317455-efbdd57df844?w=1600&q=80',
};
