import { Command } from 'commander';
import sharp from 'sharp';
import { existsSync } from 'fs';
import { resolveOutputPath } from '../utils/files.js';
import {
  POSITIONS,
  matchInputFormat,
  openImage,
  outputExtensionFor,
  parsePosition,
  saveImage,
  uprightSize,
} from '../utils/image.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

// pango markup needs these escaped
const escapeMarkup = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function parseNumber(value, name, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(
      `Invalid ${name} "${value}". It should be between ${min} and ${max}.`
    );
  }
  return number;
}

// render the watermark once, at high resolution, as a png with transparency
async function renderMark({ text, image, color }) {
  if (image) {
    return (await openImage(image)).ensureAlpha().png().toBuffer();
  }
  return sharp({
    text: {
      text: `<span foreground="${escapeMarkup(color)}">${escapeMarkup(text)}</span>`,
      font: 'sans bold 48',
      rgba: true,
      dpi: 150,
    },
  })
    .png()
    .toBuffer();
}

const watermarkCommand = new Command();

addOutputOptions(
  watermarkCommand
    .name('watermark')
    .arguments('<inputs...>')
    .option('--text <text>', 'text to stamp on the images')
    .option(
      '--image <file>',
      'logo to stamp on the images (png with transparency works best)'
    )
    .option(
      '--position <name>',
      `where to put it: ${Object.keys(POSITIONS).join(', ')}`,
      'bottom-right'
    )
    .option('--size <percent>', 'watermark width as a % of the image width', '25')
    .option('--opacity <0-1>', 'how see-through it is, 0 invisible to 1 solid', '0.6')
    .option('--margin <percent>', 'space from the edges as a % of the image width', '3')
    .option('--color <color>', 'text color (name or #hex)', 'white')
)
  .description('Add a text or logo watermark to images')
  .action(async (inputs, options) => {
    if (!options.text === !options.image) {
      throw new Error('Give either --text or --image.');
    }
    if (options.image && !existsSync(options.image)) {
      throw new Error(`Watermark image not found: ${options.image}`);
    }
    const [fx, fy] = parsePosition(options.position);
    const size = parseNumber(options.size, 'size', 1, 100) / 100;
    const opacity = parseNumber(options.opacity, 'opacity', 0, 1);
    const margin = parseNumber(options.margin, 'margin', 0, 40) / 100;

    let mark;
    try {
      mark = await renderMark(options);
    } catch (err) {
      throw new Error(`Could not create the watermark: ${err.message}`, { cause: err });
    }

    await runBatch(inputs, options, async (file) => {
      const image = await openImage(file.path, options);
      const { width, height } = await uprightSize(image);
      const gap = Math.round(width * margin);

      // fit the mark within the requested width and the space inside the margins
      const scaled = await sharp(mark)
        .resize({
          width: Math.max(1, Math.round(width * size)),
          height: Math.max(1, height - gap * 2),
          fit: 'inside',
        })
        .linear([1, 1, 1, opacity], [0, 0, 0, 0])
        .png()
        .toBuffer({ resolveWithObject: true });

      const left = gap + Math.round((width - scaled.info.width - gap * 2) * fx);
      const top = gap + Math.round((height - scaled.info.height - gap * 2) * fy);
      image.composite([
        { input: scaled.data, left: Math.max(0, left), top: Math.max(0, top) },
      ]);

      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'watermarked',
        ext: outputExtensionFor(file.path),
      });
      await saveImage(matchInputFormat(image, file.path), output);
      return { output };
    });
  })
  // help option for subcommand watermark
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph watermark photo.jpg --text "© Ajay Singh"');
    logSuccess(
      '  $ pic-morph watermark photos/ --image logo.png --position top-left --size 15'
    );
    logSuccess(
      '  $ pic-morph watermark photo.jpg --text DRAFT --position center --size 60 --opacity 0.3'
    );
  });

export default watermarkCommand;
