import { Command } from 'commander';
import { statSync } from 'fs';
import { formatFileSize, parseFileSize, resolveOutputPath } from '../utils/files.js';
import {
  applyFormat,
  encodeToSize,
  openImage,
  outputExtensionFor,
  outputFormatFor,
  parseQuality,
  saveImage,
} from '../utils/image.js';
import { loadConfig } from '../utils/config.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const DEFAULT_QUALITY = 60;
// highest quality tried when searching for a --max-size fit
const MAX_SIZE_QUALITY_CAP = 90;
// below this, warn that the result may look rough
const LOW_QUALITY = 20;

const compressCommand = new Command();

addOutputOptions(
  compressCommand
    .name('compress')
    .arguments('<inputs...>')
    .option(
      '-q, --quality <value>',
      `Set the quality of the compressed image between 1-100 (default is ${DEFAULT_QUALITY}, or your saved setting)`
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
      const format = outputFormatFor(file.path);
      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'compressed',
        ext: outputExtensionFor(file.path),
      });

      if (maxBytes === undefined) {
        const used = quality ?? loadConfig().quality ?? DEFAULT_QUALITY;
        const image = applyFormat(await openImage(file.path, options), format, used);
        await saveImage(image, output);
        return { output, note: `quality ${used}` };
      }

      // a file already under the limit should never come out bigger
      const originalSize = statSync(file.path).size;
      const limit = Math.min(maxBytes, originalSize);
      const result = await encodeToSize(
        () => openImage(file.path, options),
        format,
        limit,
        quality ?? MAX_SIZE_QUALITY_CAP
      );
      await saveImage(result.buffer, output);

      let warning;
      if (result.tooBig) {
        warning = `could not get under ${formatFileSize(limit)}; try resizing the image first`;
      } else if (result.quality < LOW_QUALITY && limit === maxBytes) {
        warning =
          `quality had to drop to ${result.quality} and may look rough; ` +
          (format === 'png'
            ? 'png suits graphics, not photos: `pic-morph optimize <file> -p email --max-size <size>` saves a jpg instead'
            : 'resizing the image first keeps more detail');
      }
      return {
        output,
        note:
          `quality ${result.quality}` +
          (limit < maxBytes ? ', already under the limit so kept no bigger' : ''),
        warning,
      };
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
