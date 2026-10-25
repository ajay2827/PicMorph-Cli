import chalk from 'chalk';

const colorize = {
  red: chalk.red,
  green: chalk.green,
  yellow: chalk.yellow,
};

const logError = (message) => {
  console.error(colorize.red(message));
};

const logWarn = (message) => {
  console.error(colorize.yellow(message));
};

const logSuccess = (message) => {
  console.log(colorize.green(message));
};

export { logError, logWarn, logSuccess };
