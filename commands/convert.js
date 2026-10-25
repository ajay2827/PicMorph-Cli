import { Command } from 'commander';
import { existsSync } from 'fs';
import { extname, resolve } from 'path';
import { resolveOutputPath } from '../utils/files.js';
import {
  OUTPUT_FORMATS,
  applyFormat,
  formatFromExtension,
  isHeic,
  openImage,
  parseQuality,
  saveImage,
} from '../utils/image.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const convertCommand = new Command();

// v1 usage: pic-morph convert input.jpg output.png
const isLegacyUsage = (inputs, options) =>
  !options.to &&
  inputs.length === 2 &&
  !existsSync(inputs[1]) &&
  extname(inputs[1]) !== '';

addOutputOptions(
  convertCommand
    .name('convert')
    .arguments('<inputs...>')
    .option('-t, --to <format>', `format to convert to (${OUTPUT_FORMATS.join(', ')})`)
    .option('-q, --quality <value>', 'quality of the converted image between 1-100')
)
  .description('Convert images to another format')
  .action(async (inputs, options) => {
    const quality = parseQuality(options.quality);

    if (isLegacyUsage(inputs, options)) {
      const outputPath = resolve(inputs[1]);
      const format = formatFromExtension(outputPath);
      await runBatch([inputs[0]], options, async (file) => {
        if (!isHeic(file.path) && formatFromExtension(file.path) === format) {
          throw new Error(
            `The format of <inputFile> and <outputFile> cannot be same. Both files have same format: ${extname(outputPath)}`
          );
        }
        await saveImage(
          applyFormat(await openImage(file.path, options), format, quality),
          outputPath
        );
        return { output: outputPath };
      });
      return;
    }

    if (!options.to) {
      throw new Error(
        'Choose a format with --to, e.g. pic-morph convert photo.png --to webp'
      );
    }
    const format = formatFromExtension(options.to);
    const ext = '.' + options.to.replace(/^\./, '').toLowerCase();

    await runBatch(inputs, options, async (file) => {
      if (!isHeic(file.path) && formatFromExtension(file.path) === format) {
        return { skipped: `already ${format}` };
      }
      const output = resolveOutputPath(file, { ...options, ext });
      await saveImage(
        applyFormat(await openImage(file.path, options), format, quality),
        output
      );
      return { output };
    });
  })
  // help option for subcommand convert
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph convert input.png --to webp');
    logSuccess('  $ pic-morph convert photos/ -r --to jpg -o converted/');
    logSuccess('  $ pic-morph convert input.jpg output.png');
    logSuccess('\nNote:');
    logSuccess('  Images already in the target format are skipped.');
  });

export default convertCommand;
