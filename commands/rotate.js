import { Command } from 'commander';
import { resolveOutputPath } from '../utils/files.js';
import {
  matchInputFormat,
  openImage,
  outputExtensionFor,
  saveImage,
} from '../utils/image.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const FLIPS = ['horizontal', 'vertical'];

const rotateCommand = new Command();

addOutputOptions(
  rotateCommand
    .name('rotate')
    .arguments('<inputs...>')
    .option(
      '-a, --angle <degrees>',
      'rotate clockwise by this many degrees (negative for anti-clockwise)'
    )
    .option('-f, --flip <direction>', `mirror the image: ${FLIPS.join(' or ')}`)
    .option(
      '--background <color>',
      'color for the corners when the angle is not a multiple of 90',
      '#00000000'
    )
)
  .description('Rotate or flip images')
  .action(async (inputs, options) => {
    const angle = options.angle === undefined ? undefined : Number(options.angle);
    if (options.angle !== undefined && !Number.isFinite(angle)) {
      throw new Error(
        `Invalid angle "${options.angle}". It should be a number of degrees.`
      );
    }
    if (options.flip !== undefined && !FLIPS.includes(options.flip)) {
      throw new Error(`Invalid --flip "${options.flip}". Use ${FLIPS.join(' or ')}.`);
    }
    if (angle === undefined && !options.flip) {
      throw new Error('Give an --angle, a --flip direction, or both.');
    }

    await runBatch(inputs, options, async (file) => {
      const image = await openImage(file.path, options);
      if (angle) image.rotate(angle, { background: options.background });
      if (options.flip === 'horizontal') image.flop();
      if (options.flip === 'vertical') image.flip();

      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'rotated',
        ext: outputExtensionFor(file.path),
      });
      await saveImage(matchInputFormat(image, file.path), output);
      return { output };
    });
  })
  // help option for subcommand rotate
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph rotate photo.jpg -a 90');
    logSuccess('  $ pic-morph rotate scan.png -a -2 --background white');
    logSuccess('  $ pic-morph rotate selfie.jpg --flip horizontal');
    logSuccess('\nNote:');
    logSuccess('  Corners are transparent by default; formats without');
    logSuccess(
      '  transparency (like jpg) show them as black unless --background is set.'
    );
  });

export default rotateCommand;
