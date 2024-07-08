import { Command } from 'commander';
import fs from 'fs';
import { resolve, dirname } from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { generateUniqueFilename } from '../utils/generateFileName.js';
import {
  logError,
  logFilePath,
  logSuccess,
} from '../utils/colorFormatOutput.js';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = 'GcKxuCeaSzshPVSepnDKWrxi';

const removeBackgroundCommand = new Command();

removeBackgroundCommand
  .name('remove-bg')
  .arguments('<inputFile>')
  .description('Remove the background from an image')
  .action(async (inputFile) => {
    try {
      const outputFileName = generateUniqueFilename(inputFile, 'no-bg');
      const outputPath = resolve(dirname(inputFile), outputFileName);

      const formData = new FormData();
      formData.append('image_file', fs.createReadStream(inputFile));
      formData.append('size', 'auto');

      const response = await axios({
        method: 'post',
        url: 'https://api.remove.bg/v1.0/removebg',
        data: formData,
        headers: {
          ...formData.getHeaders(),
          'X-Api-Key': API_KEY,
        },
        responseType: 'arraybuffer',
      });

      if (response.status !== 200) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      fs.writeFileSync(outputPath, response.data);

      logSuccess('Background removed successfully.');
      logFilePath(`See here: ${outputPath}`);
    } catch (err) {
      logError(err.message);
    }
  })
  // help option for subcommand remove-background
  .on('--help', () => {
    logSuccess('\nUsage:');
    logSuccess('  pic-morph remove-bg <inputFile>');
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph remove-bg input.jpg');
  });

export default removeBackgroundCommand;
