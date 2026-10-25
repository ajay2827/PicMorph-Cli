#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'module';
const commander = new Command();
import compressCommand from './commands/compress.js';
import convertCommand from './commands/convert.js';
import infoCommand from './commands/get_info.js';
import blackAndWhiteCommand from './commands/gray.js';
import removeBackgroundCommand from './commands/removeBackground.js';
import resizeCommand from './commands/resize.js';
import optimizeCommand from './commands/optimize.js';
import cropCommand from './commands/crop.js';
import rotateCommand from './commands/rotate.js';
import watermarkCommand from './commands/watermark.js';
import thumbnailCommand from './commands/thumbnail.js';
import faviconCommand from './commands/favicon.js';
import configCommand from './commands/config.js';
import { logError } from './utils/colorFormatOutput.js';

const { version } = createRequire(import.meta.url)('./package.json');

async function picMorphCmd() {
  // define basic info of the package
  commander
    .name('pic-morph')
    .description(
      'Ultimate Image CLI: optimize, compress, resize, convert, crop, watermark and more.'
    )
    .version(version)
    .showHelpAfterError();

  // add imported module commands
  commander.addCommand(optimizeCommand);
  commander.addCommand(compressCommand);
  commander.addCommand(resizeCommand);
  commander.addCommand(convertCommand);
  commander.addCommand(cropCommand);
  commander.addCommand(rotateCommand);
  commander.addCommand(watermarkCommand);
  commander.addCommand(thumbnailCommand);
  commander.addCommand(blackAndWhiteCommand);
  commander.addCommand(removeBackgroundCommand);
  commander.addCommand(faviconCommand);
  commander.addCommand(infoCommand);
  commander.addCommand(configCommand);

  try {
    // Parse command-line arguments
    await commander.parseAsync(process.argv);
  } catch (err) {
    logError(err.message);
    process.exitCode = 1;
  }
}

export default picMorphCmd;

picMorphCmd();
