import { Command } from 'commander';
import { AI_SETUP_HINT, aiStatus, removeAi, setupAi } from '../utils/aiEngine.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const aiCommand = new Command();

aiCommand
  .name('ai')
  .description('Set up the optional AI engine used to remove busy backgrounds')
  .addCommand(
    new Command('setup')
      .description('download the AI engine and model (one time, about 300 MB)')
      .action(async () => {
        await setupAi((message) => logSuccess(message));
        logSuccess(`✔ AI engine ready in ${aiStatus().dir}`);
      })
  )
  .addCommand(
    new Command('status')
      .description('show whether the AI engine is set up')
      .action(() => {
        const { dir, runtime, model } = aiStatus();
        console.log(`Engine: ${runtime ? 'installed' : 'not installed'}`);
        console.log(`Model:  ${model ? 'downloaded' : 'not downloaded'}`);
        console.log(`Folder: ${dir}`);
        if (!runtime || !model) console.log(`\n${AI_SETUP_HINT}`);
      })
  )
  .addCommand(
    new Command('remove').description('delete the AI engine and model').action(() => {
      removeAi();
      logSuccess('✔ AI engine removed.');
    })
  )
  // help option for subcommand ai
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph ai setup');
    logSuccess('  $ pic-morph ai status');
    logSuccess('\nNote:');
    logSuccess('  Once set up, remove-bg uses AI automatically for busy backgrounds.');
  });

export default aiCommand;
