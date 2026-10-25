import { Command } from 'commander';
import { resolveOutputPath } from '../utils/files.js';
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

const compressCommand = new Command();

addOutputOptions(
  compressCommand
    .name('compress')
    .arguments('<inputs...>')
    .option(
      '-q, --quality <value>',
      `Set the quality of the compressed image between 1-100 (default is ${DEFAULT_QUALITY})`
    )
)
  .description('Compress images, keeping their format')
  .action(async (inputs, options) => {
    const quality = parseQuality(options.quality) ?? DEFAULT_QUALITY;

    await runBatch(inputs, options, async (file) => {
      const format = formatFromExtension(file.path);
      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'compressed',
      });
      await saveImage(applyFormat(openImage(file.path), format, quality), output);
      return { output, note: `quality ${quality}` };
    });
  })
  // help option for subcommand compress
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph compress input.jpg');
    logSuccess('  $ pic-morph compress input.jpg -q 80');
    logSuccess('  $ pic-morph compress photos/ -r -o compressed/');
    logSuccess('  $ pic-morph compress "*.png" --overwrite');
    logSuccess('\nNote:');
    logSuccess('  The value of -q should be between 1 and 100.');
  });

export default compressCommand;
