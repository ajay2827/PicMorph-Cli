import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, extname } from 'path';

const FORMAT_BY_EXTENSION = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  tif: 'tiff',
  tiff: 'tiff',
  gif: 'gif',
};

export const OUTPUT_FORMATS = Object.keys(FORMAT_BY_EXTENSION);

export function formatFromExtension(extensionOrPath) {
  const ext = (extname(extensionOrPath) || extensionOrPath)
    .replace(/^\./, '')
    .toLowerCase();
  const format = FORMAT_BY_EXTENSION[ext];
  if (!format) {
    throw new Error(
      `Unsupported image format "${ext}". Supported: ${OUTPUT_FORMATS.join(', ')}`
    );
  }
  return format;
}

/**
 * Open an image, rotated upright from its EXIF orientation so phone photos
 * don't come out sideways. Metadata is dropped unless keepMetadata is set.
 */
export function openImage(path, { keepMetadata = false } = {}) {
  const image = sharp(path).rotate();
  return keepMetadata ? image.keepMetadata() : image;
}

// set the output format, with quality when given
export function applyFormat(image, format, quality) {
  switch (format) {
    case 'jpeg':
      return image.jpeg({ quality, mozjpeg: true });
    case 'png':
      // quality only takes effect with palette-based (lossy) png
      return quality ? image.png({ quality, palette: true }) : image.png();
    case 'gif':
      return image.gif();
    default:
      return image.toFormat(format, { quality });
  }
}

// write via a buffer so the output can safely replace the input file
export async function saveImage(imageOrBuffer, outputPath) {
  const buffer = Buffer.isBuffer(imageOrBuffer)
    ? imageOrBuffer
    : await imageOrBuffer.toBuffer();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
}

export function parseQuality(value) {
  if (value === undefined) return undefined;
  const quality = Number(value);
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new Error(
      'Invalid value for the quality option. Quality should be between 1 and 100.'
    );
  }
  return quality;
}
