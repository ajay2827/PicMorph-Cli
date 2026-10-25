import { Command } from 'commander';
import { resolveOutputPath } from '../utils/files.js';
import { openImage, saveImage } from '../utils/image.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const blackAndWhiteCommand = new Command();

addOutputOptions(blackAndWhiteCommand.name('gray').arguments('<inputs...>'))
  .description('Convert images to black and white')
  .action(async (inputs, options) => {
    await runBatch(inputs, options, async (file) => {
      const output = resolveOutputPath(file, { ...options, defaultSuffix: 'bw' });
      await saveImage(openImage(file.path, options).grayscale(), output);
      return { output };
    });
  })
  // help option for subcommand black-and-white
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph gray input.jpg');
    logSuccess('  $ pic-morph gray photos/ -o bw/');
  });

export default blackAndWhiteCommand;
