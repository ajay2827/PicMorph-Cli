import { Command } from 'commander';
import { resolveOutputPath } from '../utils/files.js';
import {
  matchInputFormat,
  openImage,
  outputExtensionFor,
  parsePositiveInt,
  saveImage,
} from '../utils/image.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const thumbnailCommand = new Command();

addOutputOptions(
  thumbnailCommand
    .name('thumbnail')
    .arguments('<inputs...>')
    .option('-s, --size <pixels>', 'longest side of the thumbnail', '256')
    .option('--square', 'crop to a square, keeping the most interesting part')
)
  .description('Make small preview images')
  .action(async (inputs, options) => {
    const size = parsePositiveInt(options.size, 'size');

    await runBatch(inputs, options, async (file) => {
      const image = (await openImage(file.path, options)).resize({
        width: size,
        height: size,
        fit: options.square ? 'cover' : 'inside',
        position: 'attention',
        withoutEnlargement: !options.square,
      });
      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'thumb',
        ext: outputExtensionFor(file.path),
      });
      const { data, info } = await matchInputFormat(image, file.path).toBuffer({
        resolveWithObject: true,
      });
      await saveImage(data, output);
      return { output, note: `${info.width}x${info.height}` };
    });
  })
  // help option for subcommand thumbnail
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph thumbnail photos/ -o thumbs/');
    logSuccess('  $ pic-morph thumbnail avatar.jpg -s 128 --square');
  });

export default thumbnailCommand;
