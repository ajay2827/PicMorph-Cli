import {
  applyFormat,
  encodeToSize,
  extensionFor,
  formatFromExtension,
  openImage,
} from './image.js';
import { formatFileSize } from './files.js';

// ready-made settings for common jobs, used by optimize and watch
export const PRESETS = {
  web: {
    description: 'websites: fits in 1920x1920, WebP',
    resize: { width: 1920, height: 1920, fit: 'inside' },
    format: 'webp',
    quality: 75,
  },
  email: {
    description: 'email attachments: fits in 1280x1280, JPEG under 500 KB',
    resize: { width: 1280, height: 1280, fit: 'inside' },
    format: 'jpeg',
    quality: 80,
    maxSize: 500 * 1024,
  },
  social: {
    description: 'social media posts: 1080 px wide, JPEG',
    resize: { width: 1080, fit: 'inside' },
    format: 'jpeg',
    quality: 85,
  },
  og: {
    description: 'link previews (Open Graph): 1200x630 cropped, JPEG under 300 KB',
    resize: { width: 1200, height: 630, fit: 'cover', position: 'attention' },
    format: 'jpeg',
    quality: 85,
    maxSize: 300 * 1024,
  },
};

export function getPreset(name) {
  if (!PRESETS[name]) {
    throw new Error(
      `Unknown preset "${name}". Use one of: ${Object.keys(PRESETS).join(', ')}`
    );
  }
  return PRESETS[name];
}

// combine a preset with --to, --quality and --max-size overrides
export function presetSettings(preset, { to, quality, maxSize } = {}) {
  const format = to ? formatFromExtension(to) : preset.format;
  return {
    ...preset,
    format,
    ext: to ? '.' + to.replace(/^\./, '').toLowerCase() : extensionFor(format),
    quality: quality ?? preset.quality,
    maxSize: maxSize ?? preset.maxSize,
  };
}

/**
 * Resize and encode one image with preset settings.
 * @returns {Promise<{ buffer: Buffer, note: string, warning?: string }>}
 */
export async function optimizeImage(path, settings, options) {
  const makeImage = async () =>
    (await openImage(path, options)).resize({
      ...settings.resize,
      withoutEnlargement: true,
    });

  if (!settings.maxSize || settings.format === 'gif') {
    const buffer = await applyFormat(
      await makeImage(),
      settings.format,
      settings.quality
    ).toBuffer();
    return { buffer, note: `${settings.format} quality ${settings.quality}` };
  }

  const result = await encodeToSize(
    makeImage,
    settings.format,
    settings.maxSize,
    settings.quality
  );
  return {
    buffer: result.buffer,
    note: `${settings.format} quality ${result.quality}`,
    warning: result.tooBig
      ? `could not get under ${formatFileSize(settings.maxSize)}`
      : undefined,
  };
}
