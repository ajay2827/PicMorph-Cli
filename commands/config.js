import { Command } from 'commander';
import {
  CONFIG_KEYS,
  checkConfigKey,
  configPath,
  loadConfig,
  saveConfig,
} from '../utils/config.js';
import { logSuccess } from '../utils/colorFormatOutput.js';

const mask = (value) => (value.length > 4 ? `${'*'.repeat(8)}${value.slice(-4)}` : '****');

const configCommand = new Command();

configCommand
  .name('config')
  .description('View or change saved settings')
  .addCommand(
    new Command('set')
      .arguments('<key> <value>')
      .description('save a setting')
      .action((key, value) => {
        const config = loadConfig();
        config[key] = checkConfigKey(key).parse(value);
        saveConfig(config);
        logSuccess(`Saved ${key}.`);
      })
  )
  .addCommand(
    new Command('get')
      .arguments('<key>')
      .description('print a setting')
      .action((key) => {
        checkConfigKey(key);
        const value = loadConfig()[key];
        if (value !== undefined) console.log(value);
      })
  )
  .addCommand(
    new Command('unset')
      .arguments('<key>')
      .description('remove a setting')
      .action((key) => {
        checkConfigKey(key);
        const config = loadConfig();
        delete config[key];
        saveConfig(config);
        logSuccess(`Removed ${key}.`);
      })
  )
  .addCommand(
    new Command('list').description('show all settings').action(() => {
      const config = loadConfig();
      for (const [key, { description, secret }] of Object.entries(CONFIG_KEYS)) {
        const value = config[key];
        const shown = value === undefined ? '(not set)' : secret ? mask(String(value)) : value;
        console.log(`${key} = ${shown}\n    ${description}`);
      }
      console.log(`\nSaved in ${configPath()}`);
    })
  )
  .addCommand(
    new Command('path').description('print where settings are saved').action(() => {
      console.log(configPath());
    })
  )
  // help option for subcommand config
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph config set removeBgKey YOUR_KEY');
    logSuccess('  $ pic-morph config set quality 75');
    logSuccess('  $ pic-morph config list');
  });

export default configCommand;
