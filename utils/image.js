import sharp from 'sharp';
import decodeHeic from 'heic-decode';
import { mkdir, readFile, writeFile } from 'fs/promises';
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

// iPhone photos; sharp's prebuilt binaries can't decode them, so heic-decode does
const HEIC_EXTENSIONS = ['heic', 'heif'];

const extensionOf = (extensionOrPath) =>
  (extname(extensionOrPath) || extensionOrPath).replace(/^\./, '').toLowerCase();

export const isHeic = (path) => HEIC_EXTENSIONS.includes(extensionOf(path));

export function formatFromExtension(extensionOrPath) {
  const ext = extensionOf(extensionOrPath);
  const format = FORMAT_BY_EXTENSION[ext];
  if (!format) {
    const hint = HEIC_EXTENSIONS.includes(ext)
      ? ' HEIC can be read but not written; convert it with --to jpg.'
      : '';
    throw new Error(
      `Unsupported output format "${ext}". Supported: ${OUTPUT_FORMATS.join(', ')}.${hint}`
    );
  }
  return format;
}

// the format an input file is written back as (HEIC becomes jpeg)
export const outputFormatFor = (path) =>
  isHeic(path) ? 'jpeg' : formatFromExtension(path);

// the extension an input file is written back with
export const outputExtensionFor = (path) => (isHeic(path) ? '.jpg' : extname(path));

async function loadHeic(path) {
  const { width, height, data } = await decodeHeic({ buffer: await readFile(path) });
  return sharp(Buffer.from(data.buffer), { raw: { width, height, channels: 4 } });
}

/**
 * Open an image, rotated upright from its EXIF orientation so phone photos
 * don't come out sideways. Metadata is dropped unless keepMetadata is set.
 */
export async function openImage(path, { keepMetadata = false } = {}) {
  const image = isHeic(path) ? await loadHeic(path) : sharp(path).autoOrient();
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

/**
 * Encode with the highest quality (up to highestQuality) whose output fits in
 * maxBytes. makeImage() must return a fresh sharp pipeline on every call.
 */
export async function encodeToSize(makeImage, format, maxBytes, highestQuality) {
  if (format === 'gif') {
    throw new Error('a size limit is not supported for gif images');
  }
  const encode = async (quality) =>
    applyFormat(await makeImage(), format, quality).toBuffer();

  let low = 1;
  let high = highestQuality;
  let best = null;

  while (low <= high) {
    const quality = Math.floor((low + high) / 2);
    const buffer = await encode(quality);
    if (buffer.length <= maxBytes) {
      best = { buffer, quality };
      low = quality + 1;
    } else {
      high = quality - 1;
    }
  }

  return best ?? { buffer: await encode(1), quality: 1, tooBig: true };
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

export function parsePositiveInt(value, name) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Invalid ${name} "${value}". It should be a whole number of pixels.`);
  }
  return number;
}

// named spots on an image, as fractions of the free space on each axis
export const POSITIONS = {
  'top-left': [0, 0],
  top: [0.5, 0],
  'top-right': [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  'bottom-left': [0, 1],
  bottom: [0.5, 1],
  'bottom-right': [1, 1],
};

export function parsePosition(value) {
  if (!POSITIONS[value]) {
    throw new Error(
      `Invalid position "${value}". Use one of: ${Object.keys(POSITIONS).join(', ')}`
    );
  }
  return POSITIONS[value];
}

// keep the input's format; HEIC is written as jpeg since it can't be encoded
export const matchInputFormat = (image, path) =>
  isHeic(path) ? applyFormat(image, 'jpeg', 90) : image;

// width and height as displayed, after EXIF rotation
export async function uprightSize(image) {
  const metadata = await image.metadata();
  return metadata.autoOrient ?? { width: metadata.width, height: metadata.height };
}

// file extension for an output format
export const extensionFor = (format) => (format === 'jpeg' ? '.jpg' : `.${format}`);
