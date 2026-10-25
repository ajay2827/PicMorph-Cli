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
import { logError } from './utils/colorFormatOutput.js';

const { version } = createRequire(import.meta.url)('./package.json');

async function picMorphCmd() {
  // define basic info of the package
  commander
    .name('pic-morph')
    .description(
      'Ultimate Image CLI: Compress, Resize, Convert, Remove Backgrounds, and Apply Grayscale Filters.'
    )
    .version(version)
    .showHelpAfterError();

  // add imported module commands
  commander.addCommand(compressCommand);
  commander.addCommand(convertCommand);
  commander.addCommand(infoCommand);
  commander.addCommand(blackAndWhiteCommand);
  commander.addCommand(removeBackgroundCommand);
  commander.addCommand(resizeCommand);

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
