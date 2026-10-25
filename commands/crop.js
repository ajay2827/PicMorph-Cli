import { Command } from 'commander';
import { resolveOutputPath } from '../utils/files.js';
import {
  POSITIONS,
  matchInputFormat,
  openImage,
  outputExtensionFor,
  parsePosition,
  parsePositiveInt,
  saveImage,
  uprightSize,
} from '../utils/image.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

function parseAspect(value) {
  const match = /^(\d+(?:\.\d+)?)[:x/](\d+(?:\.\d+)?)$/.exec(value);
  if (!match || !Number(match[1]) || !Number(match[2])) {
    throw new Error(`Invalid aspect ratio "${value}". Use a value like 16:9 or 1:1.`);
  }
  return Number(match[1]) / Number(match[2]);
}

function parseOffset(value, name) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid ${name} "${value}". It should be 0 or more pixels.`);
  }
  return number;
}

const cropCommand = new Command();

addOutputOptions(
  cropCommand
    .name('crop')
    .arguments('<inputs...>')
    .option(
      '-a, --aspect <ratio>',
      'crop the largest area with this ratio, e.g. 16:9 or 1:1'
    )
    .option('-w, --width <pixels>', 'width of the area to keep')
    .option('-h, --height <pixels>', 'height of the area to keep')
    .option('--left <pixels>', 'distance of the area from the left edge')
    .option('--top <pixels>', 'distance of the area from the top edge')
    .option(
      '--position <name>',
      `where to crop from when --left/--top aren't given: ${Object.keys(POSITIONS).join(', ')}`,
      'center'
    )
    .option('--smart', 'with --aspect, keep the most interesting part of the image')
    .helpOption('--help', 'display help for command')
)
  .description('Crop images to an aspect ratio or an exact area')
  .action(async (inputs, options) => {
    const aspect = options.aspect === undefined ? undefined : parseAspect(options.aspect);
    const width = parsePositiveInt(options.width, 'width');
    const height = parsePositiveInt(options.height, 'height');
    const left = parseOffset(options.left, 'left');
    const top = parseOffset(options.top, 'top');
    const [fx, fy] = parsePosition(options.position);

    if (aspect === undefined && !width && !height) {
      throw new Error('Give an --aspect ratio, or a --width and/or --height.');
    }
    if (aspect !== undefined && (width || height)) {
      throw new Error('Use either --aspect or --width/--height, not both.');
    }
    if (options.smart && aspect === undefined) {
      throw new Error('--smart works with --aspect.');
    }

    await runBatch(inputs, options, async (file) => {
      const image = await openImage(file.path, options);
      const size = await uprightSize(image);

      let area;
      if (aspect !== undefined) {
        area =
          size.width / size.height > aspect
            ? { width: Math.round(size.height * aspect), height: size.height }
            : { width: size.width, height: Math.round(size.width / aspect) };
      } else {
        area = { width: width ?? size.width, height: height ?? size.height };
      }
      area.left = left ?? Math.round((size.width - area.width) * fx);
      area.top = top ?? Math.round((size.height - area.height) * fy);

      if (area.width > size.width || area.height > size.height) {
        throw new Error(
          `crop area ${area.width}x${area.height} is bigger than the ${size.width}x${size.height} image`
        );
      }
      if (area.left + area.width > size.width || area.top + area.height > size.height) {
        throw new Error(
          `crop area ${area.width}x${area.height} at ${area.left},${area.top} doesn't fit in the ${size.width}x${size.height} image`
        );
      }

      if (options.smart) {
        // same size as the area, so this only crops, choosing the busiest region
        image.resize({
          width: area.width,
          height: area.height,
          fit: 'cover',
          position: 'attention',
        });
      } else {
        image.extract(area);
      }

      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'cropped',
        ext: outputExtensionFor(file.path),
      });
      await saveImage(matchInputFormat(image, file.path), output);
      return { output, note: `${area.width}x${area.height}` };
    });
  })
  // help option for subcommand crop
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph crop photo.jpg --aspect 1:1');
    logSuccess('  $ pic-morph crop photo.jpg --aspect 16:9 --smart');
    logSuccess('  $ pic-morph crop photo.jpg -w 800 -h 600 --position top');
    logSuccess('  $ pic-morph crop screenshot.png -w 500 -h 300 --left 40 --top 120');
  });

export default cropCommand;
