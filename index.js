#!/usr/bin/env node

import { Command } from 'commander';
const commander = new Command();
import compressCommand from './commands/compress.js';
import convertCommand from './commands/convert.js';
import infoCommand from './commands/get_info.js';
import blackAndWhiteCommand from './commands/gray.js';
import removeBackgroundCommand from './commands/removeBackground.js';

async function picMorphCmd() {
  // define basic info of the package
  commander
    .name('pic-morph')
    .description(
      'Ultimate Image CLI: Compress, Convert, Remove Backgrounds, and Apply Grayscale Filters.'
    )
    .version('1.0.1');

  // add imported module commands
  commander.addCommand(compressCommand);
  commander.addCommand(convertCommand);
  commander.addCommand(infoCommand);
  commander.addCommand(blackAndWhiteCommand);
  commander.addCommand(removeBackgroundCommand);

  try {
    // Parse command-line arguments
    await commander.parseAsync(process.argv);
  } catch (err) {
    console.error(err);
  }
}

export default picMorphCmd;

picMorphCmd();
