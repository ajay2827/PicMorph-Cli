import { Command } from 'commander';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import { resolveOutputPath } from '../utils/files.js';
import { openImage, saveImage } from '../utils/image.js';
import {
  applyAlpha,
  cropPixels,
  fillTransparent,
  findSubject,
  parseColor,
  resizeBilinear,
  subjectBounds,
} from '../utils/backgroundRemoval.js';
import { loadConfig } from '../utils/config.js';
import { runBatch } from '../utils/batch.js';
import { addOutputOptions } from '../utils/options.js';
import { logSuccess } from '../utils/colorFormatOutput.js';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// the subject is found on a smaller copy for speed, then applied at full size
const WORKING_SIZE = 1024;
// a border with this much color variation or texture is a busy backdrop
// (a room, trees, a street) that the local engine can't separate well
const BUSY_SPREAD = 15;
const BUSY_TEXTURE = 4;

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

async function removeWithApi(path, apiKey) {
  const formData = new FormData();
  formData.append('image_file', fs.createReadStream(path));
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
        'X-Api-Key': apiKey,
      },
      responseType: 'arraybuffer',
    });
  } catch (err) {
    throw new Error(apiErrorMessage(err), { cause: err });
  }

  const { data, info } = await sharp(Buffer.from(response.data))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgba: data, width: info.width, height: info.height, note: 'remove.bg' };
}

async function removeLocally(path, options) {
  const full = await (
    await openImage(path)
  )
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = full.info;

  const small = await (
    await openImage(path)
  )
    .removeAlpha()
    .resize({
      width: WORKING_SIZE,
      height: WORKING_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const result = findSubject({ data: small.data, ...small.info }, options);
  const alpha = resizeBilinear(
    result.alpha,
    small.info.width,
    small.info.height,
    width,
    height
  );
  const rgba = applyAlpha(
    { data: full.data, width, height, channels: full.info.channels },
    alpha,
    result.backgroundColors
  );

  let warning;
  if (result.spread > BUSY_SPREAD || result.texture > BUSY_TEXTURE) {
    warning =
      'the background looks busy, so the result is likely poor; local removal works best on plain backgrounds (try --api)';
  } else if (result.subjectShare < 0.01) {
    warning = 'no subject found; try a lower --tolerance';
  } else if (result.subjectShare > 0.97) {
    warning = 'almost nothing was removed; try a higher --tolerance';
  }

  return {
    rgba,
    width,
    height,
    note: `local, tolerance ${Math.round(result.tolerance)}`,
    warning,
  };
}

function parseNumberOption(value, name, min, max) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(
      `Invalid ${name} "${value}". It should be between ${min} and ${max}.`
    );
  }
  return number;
}

const removeBackgroundCommand = new Command();

addOutputOptions(
  removeBackgroundCommand
    .name('remove-bg')
    .arguments('<inputs...>')
    .option(
      '--local',
      'remove it on this computer (default when no remove.bg key is set)'
    )
    .option('--api', 'use the remove.bg API (needs an API key)')
    .option(
      '--tolerance <1-100>',
      'local only: how different a color can be and still count as background (auto by default)'
    )
    .option('--feather <pixels>', 'local only: how soft the edges are', '1')
    .option('--keep-shadows', 'local only: keep soft shadows as part of the subject')
    .option(
      '--holes',
      'local only: also clear background-colored areas inside the subject (letters, handles)'
    )
    .option(
      '--background <color>',
      'fill the background with a color instead, e.g. white or #1e90ff'
    )
    .option('--crop', 'trim the empty space around the subject')
)
  .description('Remove the background from images, on this computer or with remove.bg')
  .action(async (inputs, options) => {
    if (options.local && options.api) {
      throw new Error('Choose either --local or --api, not both.');
    }
    const apiKey = process.env.REMOVE_BG_API_KEY || loadConfig().removeBgKey;
    if (options.api && !apiKey) {
      throw new Error(
        'No remove.bg API key. Get one from https://www.remove.bg/api and save it with `pic-morph config set removeBgKey <key>` (or set REMOVE_BG_API_KEY).'
      );
    }
    const useApi = options.api || (!options.local && Boolean(apiKey));
    const localOptions = {
      tolerance: parseNumberOption(options.tolerance, 'tolerance', 1, 100),
      feather: Math.round(parseNumberOption(options.feather, 'feather', 0, 20)),
      keepShadows: Boolean(options.keepShadows),
      holes: Boolean(options.holes),
    };
    const fill =
      options.background === undefined ? undefined : parseColor(options.background);

    await runBatch(inputs, options, async (file) => {
      // the result has transparency, so the output is always .png
      const output = resolveOutputPath(file, {
        ...options,
        defaultSuffix: 'no-bg',
        ext: '.png',
      });

      const result = useApi
        ? await removeWithApi(file.path, apiKey)
        : await removeLocally(file.path, localOptions);
      let { rgba, width, height } = result;

      if (options.crop) {
        const alpha = Float32Array.from(
          { length: width * height },
          (_, i) => rgba[i * 4 + 3] / 255
        );
        const box = subjectBounds(
          alpha,
          width,
          height,
          Math.round(Math.max(width, height) * 0.02)
        );
        if (box) {
          rgba = cropPixels(rgba, width, box);
          ({ width, height } = box);
        }
      }
      if (fill) rgba = fillTransparent(rgba, fill);

      const png = await sharp(rgba, { raw: { width, height, channels: 4 } })
        .png()
        .toBuffer();
      await saveImage(png, output);
      return { output, note: result.note, warning: result.warning };
    });
  })
  // help option for subcommand remove-background
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph remove-bg product.jpg');
    logSuccess('  $ pic-morph remove-bg id-photo.jpg --background white');
    logSuccess('  $ pic-morph remove-bg logo.png --crop');
    logSuccess('  $ pic-morph remove-bg products/ -o cutouts/ --tolerance 25');
    logSuccess('  $ pic-morph remove-bg portrait.jpg --api');
    logSuccess('\nNote:');
    logSuccess('  The local engine works on this computer for free, and works best on');
    logSuccess('  plain or studio backgrounds (products, logos, ID photos, documents).');
    logSuccess(
      '  For busy backgrounds such as a person in a park, use --api (remove.bg).'
    );
  });

export default removeBackgroundCommand;
