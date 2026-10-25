import { Command } from 'commander';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { displayPath } from '../utils/files.js';
import { openImage } from '../utils/image.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const PNG_ICONS = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];
const ICO_SIZES = [16, 32, 48];

// an .ico file is a small header followed by the png images
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const faviconCommand = new Command();

faviconCommand
  .name('favicon')
  .arguments('<image>')
  .option('-o, --out-dir <dir>', 'folder to write the icons to', 'favicon')
  .option('--background <color>', 'fill color behind the logo (transparent by default)')
  .option('--name <text>', 'site name for site.webmanifest', '')
  .option('--overwrite', 'replace icons that already exist in the folder')
  .description(
    'Create a full favicon set (ico, png, apple and android icons) from one image'
  )
  .action(async (inputImage, options) => {
    if (!existsSync(inputImage)) throw new Error(`File not found: ${inputImage}`);
    const outDir = resolve(options.outDir);
    const files = ['favicon.ico', 'site.webmanifest', ...PNG_ICONS.map((i) => i.name)];
    const existing = files.filter((f) => existsSync(join(outDir, f)));
    if (existing.length && !options.overwrite) {
      throw new Error(
        `${displayPath(outDir)} already has ${existing.join(', ')}. Use --overwrite to replace them.`
      );
    }

    const background = options.background ?? { r: 0, g: 0, b: 0, alpha: 0 };
    const icon = async (size) =>
      (await openImage(inputImage))
        .resize({ width: size, height: size, fit: 'contain', background })
        .png()
        .toBuffer();

    await mkdir(outDir, { recursive: true });
    for (const { name, size } of PNG_ICONS) {
      await writeFile(join(outDir, name), await icon(size));
    }
    const icoImages = await Promise.all(
      ICO_SIZES.map(async (size) => ({ size, data: await icon(size) }))
    );
    await writeFile(join(outDir, 'favicon.ico'), buildIco(icoImages));

    const manifest = {
      name: options.name,
      short_name: options.name,
      icons: [192, 512].map((size) => ({
        src: `/android-chrome-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
      })),
      display: 'standalone',
    };
    await writeFile(
      join(outDir, 'site.webmanifest'),
      JSON.stringify(manifest, null, 2) + '\n'
    );

    logSuccess(`✔ Created ${files.length} files in ${displayPath(outDir)}`);
    logSuccess('\nAdd this to your <head>:');
    console.log(`<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`);
  })
  // help option for subcommand favicon
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph favicon logo.png');
    logSuccess('  $ pic-morph favicon logo.svg -o public/ --name "My Site"');
    logSuccess('\nNote:');
    logSuccess('  Use a square image of at least 512x512 for the sharpest icons.');
  });

export default faviconCommand;
