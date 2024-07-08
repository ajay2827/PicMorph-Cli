import { Command } from 'commander';
import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { generateUniqueFilename } from '../utils/generateFileName.js';
import {
  logError,
  logFilePath,
  logSuccess,
} from '../utils/colorFormatOutput.js';

const blackAndWhiteCommand = new Command();

blackAndWhiteCommand
  .name('gray')
  .arguments('<inputFile>')
  .description('Convert an image to black and white')
  .action(async (inputFile) => {
    try {
      // create output file name
      const outputFileName = generateUniqueFilename(inputFile, 'bw');
      const outputPath = resolve(dirname(inputFile), outputFileName);

      // convert input file to black and white
      await sharp(inputFile).grayscale().toFile(outputFileName);
      logSuccess('Image converted to black and white.');
      logFilePath(`See here: ${outputPath}`);
    } catch (err) {
      logError(err.message);
    }
  })
  // help option for subcommand black-and-white
  .on('--help', () => {
    logSuccess('\nUsage:');
    logSuccess('  pic-morph gray <inputFile>');
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph gray input.jpg');
  });

export default blackAndWhiteCommand;
