import { Command } from 'commander';
import sharp from 'sharp';
import { statSync } from 'fs';
import { displayPath, expandInputs, formatFileSize } from '../utils/files.js';
import { addInputOptions } from '../utils/options.js';
import { logError, logSuccess } from '../utils/colorFormatOutput.js';

const infoCommand = new Command();

async function readInfo(path) {
  // fetch image metadata using sharp
  const metadata = await sharp(path).metadata();
  // report the size the image is displayed at, after EXIF rotation
  const { width, height } = metadata.autoOrient ?? metadata;
  const size = statSync(path).size;

  return {
    Format: metadata.format || 'Unknown',
    Location: path,
    Width: width || 'Unknown',
    Height: height || 'Unknown',
    FileSize: formatFileSize(size),
    Bytes: size,
  };
}

addInputOptions(
  infoCommand
    .name('info')
    .arguments('<inputs...>')
    .option('--json', 'print the information as JSON')
)
  .description('Get information about images')
  .action(async (inputs, options) => {
    const { files, missing } = await expandInputs(inputs, options);
    const results = [];

    for (const input of missing) {
      logError(`✖ ${input}: file not found (or no images matched)`);
      process.exitCode = 1;
    }

    for (const file of files) {
      try {
        const info = await readInfo(file.path);
        if (options.json) {
          results.push(info);
        } else {
          logSuccess(`Image information: ${displayPath(file.path)}`);
          const { Bytes, ...shown } = info;
          console.log(shown);
        }
      } catch (err) {
        logError(`✖ ${displayPath(file.path)}: ${err.message}`);
        process.exitCode = 1;
      }
    }

    if (options.json) console.log(JSON.stringify(results, null, 2));
  })

  // help option for subcommand info
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph info input.jpg');
    logSuccess('  $ pic-morph info photos/ --json');
  });

export default infoCommand;
