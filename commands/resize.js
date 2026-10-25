import { Command } from 'commander';
import { resolveOutputPath } from '../utils/files.js';
import { openImage, saveImage } from '../utils/image.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const FITS = ['cover', 'contain', 'fill', 'inside', 'outside'];

function parseDimension(value, name) {
  if (value === undefined) return undefined;
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`Invalid ${name} "${value}". It should be a whole number of pixels.`);
  }
  return size;
}

const resizeCommand = new Command();

addOutputOptions(
  resizeCommand
    .name('resize')
    .arguments('<inputs...>')
    .option('-w, --width <pixels>', 'target width')
    .option('-h, --height <pixels>', 'target height')
    .option(
      '--fit <mode>',
      `how to fit both width and height: ${FITS.join(', ')}`,
      'inside'
    )
    .option('--no-enlarge', 'never make images bigger than they are')
    .helpOption('--help', 'display help for command')
)
  .description('Resize images')
  .action(async (inputs, options) => {
    const width = parseDimension(options.width, 'width');
    const height = parseDimension(options.height, 'height');
    if (!width && !height) {
      throw new Error('Give a --width, a --height, or both.');
    }
    if (!FITS.includes(options.fit)) {
      throw new Error(`Invalid --fit "${options.fit}". Use one of: ${FITS.join(', ')}`);
    }

    await runBatch(inputs, options, async (file) => {
      const output = resolveOutputPath(file, { ...options, defaultSuffix: 'resized' });
      const { data, info } = await openImage(file.path, options)
        .resize({
          width,
          height,
          fit: options.fit,
          withoutEnlargement: !options.enlarge,
        })
        .toBuffer({ resolveWithObject: true });
      await saveImage(data, output);
      return { output, note: `${info.width}x${info.height}` };
    });
  })
  // help option for subcommand resize
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph resize input.jpg -w 800');
    logSuccess('  $ pic-morph resize input.jpg -w 400 -h 400 --fit cover');
    logSuccess('  $ pic-morph resize photos/ -w 1920 --no-enlarge -o web/');
    logSuccess('\nNote:');
    logSuccess('  With only a width or height, the other side keeps the aspect ratio.');
    logSuccess('  -h is height here; use --help for help.');
  });

export default resizeCommand;
