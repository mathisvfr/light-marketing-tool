# Image Pipeline v2 — Design Spec

**Status:** Specced, needs testing before implementation
**Date:** 2026-11-13
**Effort:** ~4-6 hours

## Current state

- **Satori** renders HTML/JSX → SVG → PNG (via @resvg/resvg-js)
- Output: PNG only, no quality/size optimization
- Uploaded images: stored as-is on disk at `/uploads/`
- Served with `Cache-Control: public, max-age=31536000, immutable`
- No responsive images (srcset), no WebP/AVIF conversion
- No server-side resize or compression
- Satori output varies in size but is typically 200-800KB per image

## Goals

1. **Smaller file sizes**: WebP output (40-60% smaller than PNG for the same quality)
2. **Responsive variants**: Multiple sizes for different contexts (thumbnail, preview, full)
3. **Automatic optimization**: All uploaded images get optimized on upload
4. **Backwards compatible**: Existing image_path references continue to work
5. **No frontend changes needed initially**: Optimization is transparent

## Design

### Add `sharp` as a dependency

```bash
cd backend && npm install sharp
```

`sharp` is the industry standard for server-side image processing in Node.js.
It uses libvips (C library) and is 10-50x faster than alternatives.

**Binary size note**: sharp installs a platform-specific binary (~25MB). The
Docker image already includes the Node runtime (~150MB), so this is a modest
increase. The binary is cached across builds.

### New service: `backend/src/services/imageOptimizer.js`

```js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs/promises');

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads');

// Size presets: name → max width
const PRESETS = {
  thumb: 300,    // list views, queue thumbnails
  preview: 800,  // detail views, approval preview
  full: 1600,    // full-size social image (Buffer upload)
  og: 1200,      // Open Graph / SEO (1200x630)
};

async function optimizeImage(inputPath, options = {}) {
  const { format = 'webp', quality = 82, presets = ['thumb', 'preview', 'full'] } = options;
  const ext = format === 'webp' ? '.webp' : format === 'avif' ? '.avif' : '.png';
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const results = {};

  for (const preset of presets) {
    const width = PRESETS[preset];
    const outputName = `${baseName}-${preset}${ext}`;
    const outputPath = path.join(UPLOAD_DIR, outputName);

    await sharp(inputPath)
      .resize(width, null, { fit: 'inside', withoutEnlargement: true })
      [format]({ quality })
      .toFile(outputPath);

    results[preset] = `/uploads/${outputName}`;
  }

  return results;
}

async function optimizeSatoriOutput(pngBuffer, baseName) {
  // Satori outputs PNG — convert to WebP at multiple sizes
  return optimizeImage(
    { input: pngBuffer },  // sharp accepts buffers
    { format: 'webp', quality: 85, presets: ['preview', 'full'] }
  );
}

module.exports = { optimizeImage, optimizeSatoriOutput, PRESETS };
```

### Integration points

1. **After Satori render** (render.js): Pass PNG buffer through `optimizeSatoriOutput()`.
   Store the WebP `full` path as `image_path` in the draft. Keep the original PNG for
   backwards compatibility.

2. **On image upload** (routes/uploads.js): After multer saves the file, run
   `optimizeImage()` to generate WebP variants. Return the `preview` URL for
   immediate display, store `full` URL as `image_path`.

3. **Serving**: Add `.webp` and `.avif` to the allowed extensions in the static
   file middleware (index.js line 148).

### Frontend: Progressive enhancement

Phase 1 (transparent): Backend stores WebP, frontend `<img>` tags work as-is
since browsers that support WebP (97%+) will render it fine.

Phase 2 (later): Add `<picture>` elements with `srcset` for responsive images:
```html
<picture>
  <source srcset="/uploads/img-thumb.webp 300w, /uploads/img-preview.webp 800w, /uploads/img-full.webp 1600w" type="image/webp" />
  <img src="/uploads/img-full.png" loading="lazy" alt="..." />
</picture>
```

### Migration path

1. Add sharp dependency
2. Create imageOptimizer.js service
3. Update render.js to generate WebP variants alongside PNG
4. Update uploads route to optimize on upload
5. Update static middleware to serve .webp/.avif
6. **Do NOT delete existing PNGs** — they continue to serve via existing URLs
7. New images get WebP by default; old images keep working

### Database changes

Add optional columns to drafts (or a separate image_variants JSONB column):
```sql
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS image_variants JSONB;
-- Example: { "thumb": "/uploads/abc-thumb.webp", "preview": "/uploads/abc-preview.webp", "full": "/uploads/abc-full.webp" }
```

### Tests needed

1. **Unit: imageOptimizer.js**
   - optimizeImage produces correct number of variants
   - WebP output is smaller than PNG input
   - Preset dimensions are respected
   - Invalid input throws gracefully

2. **Integration: render.js**
   - Satori render produces PNG AND WebP variants
   - image_path in response points to WebP

3. **Integration: uploads route**
   - Upload PNG → get back WebP variants
   - Upload JPEG → get back WebP variants
   - Upload too-large file → 413 error (existing behavior)

4. **E2E: Image display**
   - Generated vacature image renders in preview
   - Uploaded marketing image renders in approval view

### Size estimates

| Image type | Current (PNG) | After (WebP) | Savings |
|-----------|---------------|--------------|---------|
| Satori social card | ~400KB | ~120KB | 70% |
| Uploaded photo (1920px) | ~2MB | ~400KB | 80% |
| Thumbnail (300px) | ~50KB | ~15KB | 70% |

### Risks

- **sharp binary**: Platform-specific. Docker build must match runtime arch.
  Alpine images need `--platform` flag. Test in Docker build.
- **Memory**: sharp processes images in streams, so memory usage is bounded.
  But batch operations (bulk upload) should be serialized.
- **AVIF**: 10x slower to encode than WebP. Use only for static assets where
  encode time doesn't matter. Not recommended for user-facing uploads.
