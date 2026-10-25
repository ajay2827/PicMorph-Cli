import { Command } from 'commander';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { resolveOutputPath } from '../utils/files.js';
import { saveImage } from '../utils/image.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// remove.bg sends errors as JSON, but the response is read as binary
function apiErrorMessage(err) {
  if (!err.response) return err.message;
  try {
    const body = JSON.parse(Buffer.from(err.response.data).toString());
    return `remove.bg: ${body.errors.map((e) => e.title).join(', ')}`;
  } catch {
    return `remove.bg: ${err.response.status} ${err.response.statusText}`;
  }
}

const removeBackgroundCommand = new Command();

addOutputOptions(removeBackgroundCommand.name('remove-bg').arguments('<inputs...>'))
  .description('Remove the background from images (uses the remove.bg API)')
  .action(async (inputs, options) => {
    const API_KEY = process.env.REMOVE_BG_API_KEY;
    if (!API_KEY) {
      throw new Error(
        'REMOVE_BG_API_KEY is not set. Get a key from https://www.remove.bg/api and set it in your environment or a .env file.'
      );
    }

    await runBatch(inputs, options, async (file) => {
      // remove.bg returns a png, so the output is always .png
      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'no-bg',
        ext: '.png',
      });

      const formData = new FormData();
      formData.append('image_file', fs.createReadStream(file.path));
      formData.append('size', 'auto');
      formData.append('format', 'png');

      let response;
      try {
        response = await axios({
          method: 'post',
          url: 'https://api.remove.bg/v1.0/removebg',
          data: formData,
          headers: {
            ...formData.getHeaders(),
            'X-Api-Key': API_KEY,
          },
          responseType: 'arraybuffer',
        });
      } catch (err) {
        throw new Error(apiErrorMessage(err));
      }

      await saveImage(Buffer.from(response.data), output);
      return { output };
    });
  })
  // help option for subcommand remove-background
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph remove-bg input.jpg');
    logSuccess('  $ pic-morph remove-bg products/ -o cutouts/');
    logSuccess('\nNote:');
    logSuccess('  Needs REMOVE_BG_API_KEY set in your environment or a .env file.');
  });

export default removeBackgroundCommand;
