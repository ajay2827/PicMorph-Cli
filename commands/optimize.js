import { Command } from 'commander';
import { parseFileSize, resolveOutputPath } from '../utils/files.js';
import { OUTPUT_FORMATS, parseQuality, saveImage } from '../utils/image.js';
import { PRESETS, getPreset, optimizeImage, presetSettings } from '../utils/presets.js';
import { loadConfig } from '../utils/config.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const optimizeCommand = new Command();

addOutputOptions(
  optimizeCommand
    .name('optimize')
    .arguments('<inputs...>')
    .option(
      '-p, --preset <name>',
      `${Object.keys(PRESETS).join(', ')} (default web, or your saved setting)`
    )
    .option('-t, --to <format>', `override the preset's format (${OUTPUT_FORMATS.join(', ')})`)
    .option('-q, --quality <value>', "override the preset's quality (1-100)")
    .option('-s, --max-size <size>', 'keep each file under this size, e.g. 200kb')
)
  .description('Resize, compress and convert images in one step using a preset')
  .action(async (inputs, options) => {
    const preset = getPreset(options.preset ?? loadConfig().preset ?? 'web');
    const settings = presetSettings(preset, {
      to: options.to,
      quality: parseQuality(options.quality),
      maxSize: options.maxSize === undefined ? undefined : parseFileSize(options.maxSize),
    });

    await runBatch(inputs, options, async (file) => {
      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'optimized',
        ext: settings.ext,
      });
      const result = await optimizeImage(file.path, settings, options);
      await saveImage(result.buffer, output);
      return { output, note: result.note, warning: result.warning };
    });
  })
  // help option for subcommand optimize
  .on('--help', () => {
    logSuccess('\nPresets:');
    for (const [name, { description }] of Object.entries(PRESETS)) {
      logSuccess(`  ${name.padEnd(8)}${description}`);
    }
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph optimize photo.jpg');
    logSuccess('  $ pic-morph optimize photos/ -r -p email -o to-send/');
    logSuccess('  $ pic-morph optimize hero.png -p og');
    logSuccess('  $ pic-morph optimize photos/ -p web --to avif');
    logSuccess('\nNote:');
    logSuccess('  Images are never enlarged, and metadata is removed.');
  });

export default optimizeCommand;
