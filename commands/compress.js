import { Command } from 'commander';
import sharp from 'sharp';
import { extname } from 'path';
import { generateUniqueFilename } from '../utils/generateFileName.js';
import {
  logError,
  logFilePath,
  logSuccess,
} from '../utils/colorFormatOutput.js';

const compressCommand = new Command();

compressCommand
  .name('compress')
  .arguments('<inputFile>')
  .option(
    '-q, --quality <value>',
    'Set the quality of the compressed image between 1-100(default is 60)'
  )
  .description('Compress an image')
  .action(async (inputFile, option) => {
    try {
      // create output file name
      const outputPath = generateUniqueFilename(inputFile, 'compressed');

      // check if the -q option value valid or not
      const qualityOption = parseInt(option.quality, 10);
      if (!isNaN(qualityOption) && (qualityOption > 100 || qualityOption < 1)) {
        throw new Error(
          'Invalid value for the quality option. Quality should be between 1 and 100.'
        );
      }

      const quality = qualityOption || 60; //default compression: 60%

      // compress input file, keeping its original format
      const image = sharp(inputFile);
      switch (extname(inputFile).toLowerCase()) {
        case '.png':
          image.png({ quality, palette: true });
          break;
        case '.webp':
          image.webp({ quality });
          break;
        case '.avif':
          image.avif({ quality });
          break;
        default:
          image.jpeg({ quality });
      }
      await image.toFile(outputPath);
      logSuccess(`Image compressed down to ${quality}%.`);
      logFilePath(`See here: ${outputPath}`);
    } catch (err) {
      logError(err.message);
    }
  })
  // help option for subcommand compress
  .on('--help', () => {
    logSuccess('\nUsage:');
    logSuccess('  pic-morph compress <inputFile> [-q <quality>]');
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph compress input.jpg');
    logSuccess('  $ pic-morph compress input.jpg -q 80');
    logSuccess('\nNote:');
    logSuccess('  The value of -q should be between 1 and 100.');
  });

export default compressCommand;
