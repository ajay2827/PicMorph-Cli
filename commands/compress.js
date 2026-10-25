import { Command } from 'commander';
import {
  formatFileSize,
  parseFileSize,
  resolveOutputPath,
} from '../utils/files.js';
import {
  applyFormat,
  formatFromExtension,
  openImage,
  parseQuality,
  saveImage,
} from '../utils/image.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const DEFAULT_QUALITY = 60;
// highest quality tried when searching for a --max-size fit
const MAX_SIZE_QUALITY_CAP = 90;

const encode = (file, format, quality, options) =>
  applyFormat(openImage(file.path, options), format, quality).toBuffer();

// binary search for the highest quality whose output fits in maxBytes
async function compressToSize(file, format, maxBytes, highestQuality, options) {
  let low = 1;
  let high = highestQuality;
  let best = null;

  while (low <= high) {
    const quality = Math.floor((low + high) / 2);
    const buffer = await encode(file, format, quality, options);
    if (buffer.length <= maxBytes) {
      best = { buffer, quality };
      low = quality + 1;
    } else {
      high = quality - 1;
    }
  }

  if (best) return best;
  return {
    buffer: await encode(file, format, 1, options),
    quality: 1,
    warning: `could not get under ${formatFileSize(maxBytes)}; try resizing the image first`,
  };
}

const compressCommand = new Command();

addOutputOptions(
  compressCommand
    .name('compress')
    .arguments('<inputs...>')
    .option(
      '-q, --quality <value>',
      `Set the quality of the compressed image between 1-100 (default is ${DEFAULT_QUALITY})`
    )
    .option(
      '-s, --max-size <size>',
      'pick the highest quality that fits this size, e.g. 200kb or 1.5mb'
    )
)
  .description('Compress images, keeping their format')
  .action(async (inputs, options) => {
    const quality = parseQuality(options.quality);
    const maxBytes =
      options.maxSize === undefined ? undefined : parseFileSize(options.maxSize);

    await runBatch(inputs, options, async (file) => {
      const format = formatFromExtension(file.path);
      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'compressed',
      });

      if (maxBytes === undefined) {
        const used = quality ?? DEFAULT_QUALITY;
        await saveImage(await encode(file, format, used, options), output);
        return { output, note: `quality ${used}` };
      }

      if (format === 'gif') {
        throw new Error('--max-size is not supported for gif images');
      }
      const result = await compressToSize(
        file,
        format,
        maxBytes,
        quality ?? MAX_SIZE_QUALITY_CAP,
        options
      );
      await saveImage(result.buffer, output);
      return { output, note: `quality ${result.quality}`, warning: result.warning };
    });
  })
  // help option for subcommand compress
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph compress input.jpg');
    logSuccess('  $ pic-morph compress input.jpg -q 80');
    logSuccess('  $ pic-morph compress input.jpg --max-size 200kb');
    logSuccess('  $ pic-morph compress photos/ -r -o compressed/');
    logSuccess('  $ pic-morph compress "*.png" --overwrite');
    logSuccess('\nNote:');
    logSuccess('  The value of -q should be between 1 and 100.');
    logSuccess('  With --max-size, -q sets the highest quality to try (default 90).');
  });

export default compressCommand;
