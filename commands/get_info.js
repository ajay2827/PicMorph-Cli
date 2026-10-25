import { Command } from 'commander';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import { statSync } from 'fs';
import { displayPath, expandInputs, formatFileSize } from '../utils/files.js';
import { isHeic, openImage } from '../utils/image.js';
import { addInputOptions } from '../utils/options.js';
import { logError, logSuccess } from '../utils/colorFormatOutput.js';

const infoCommand = new Command();

// GPS is stored as [degrees, minutes, seconds] plus N/S or E/W
function toDecimal(parts, ref) {
  if (!Array.isArray(parts)) return undefined;
  const [deg, min = 0, sec = 0] = parts;
  const value = deg + min / 60 + sec / 3600;
  return Number((ref === 'S' || ref === 'W' ? -value : value).toFixed(6));
}

// the photo details people usually look for, from EXIF data
function photoDetails(exifBuffer) {
  if (!exifBuffer) return {};
  let exif;
  try {
    exif = exifReader(exifBuffer);
  } catch {
    return {};
  }
  const { Image = {}, Photo = {}, GPSInfo = {} } = exif;
  const details = {};

  const camera = [Image.Make, Image.Model].filter(Boolean).join(' ').trim();
  if (camera) details.Camera = camera;
  if (Photo.LensModel) details.Lens = Photo.LensModel;

  const taken = Photo.DateTimeOriginal ?? Image.DateTime;
  // EXIF times have no time zone, so show them as written
  if (taken instanceof Date && !isNaN(taken)) {
    details.Taken = taken.toISOString().slice(0, 19).replace('T', ' ');
  }

  if (Photo.ExposureTime) {
    details.Exposure =
      Photo.ExposureTime < 1 ? `1/${Math.round(1 / Photo.ExposureTime)}s` : `${Photo.ExposureTime}s`;
  }
  if (Photo.FNumber) details.Aperture = `f/${Photo.FNumber}`;
  if (Photo.ISOSpeedRatings) details.ISO = Photo.ISOSpeedRatings;

  const latitude = toDecimal(GPSInfo.GPSLatitude, GPSInfo.GPSLatitudeRef);
  const longitude = toDecimal(GPSInfo.GPSLongitude, GPSInfo.GPSLongitudeRef);
  if (latitude !== undefined && longitude !== undefined) {
    details.GPS = { Latitude: latitude, Longitude: longitude };
  }
  return details;
}

async function readInfo(path) {
  // fetch image metadata using sharp; HEIC is decoded first, so it has no EXIF here
  const metadata = isHeic(path)
    ? await (await openImage(path)).metadata()
    : await sharp(path).metadata();
  // report the size the image is displayed at, after EXIF rotation
  const { width, height } = metadata.autoOrient ?? metadata;
  const size = statSync(path).size;

  const info = {
    Format: isHeic(path) ? 'heif' : metadata.format || 'Unknown',
    Location: path,
    Width: width || 'Unknown',
    Height: height || 'Unknown',
    FileSize: formatFileSize(size),
    Bytes: size,
    ColorSpace: metadata.space,
  };
  // decoded HEIC is always RGBA, so channels say nothing about the file
  if (!isHeic(path)) {
    info.Channels = metadata.channels;
    info.HasAlpha = metadata.hasAlpha;
  }
  if (metadata.density) info.DPI = metadata.density;
  if (metadata.orientation && metadata.orientation !== 1) {
    info.Orientation = metadata.orientation;
  }
  if (metadata.pages > 1) info.Frames = metadata.pages;
  if (metadata.hasProfile) info.ColorProfile = true;

  return { ...info, ...photoDetails(metadata.exif) };
}

addInputOptions(
  infoCommand
    .name('info')
    .arguments('<inputs...>')
    .option('--json', 'print the information as JSON')
)
  .description('Get information about images')
  .action(async (inputs, options) => {
    const { files, missing } = await expandInputs(inputs, options);
    const results = [];

    for (const input of missing) {
      logError(`✖ ${input}: file not found (or no images matched)`);
      process.exitCode = 1;
    }

    for (const file of files) {
      try {
        const info = await readInfo(file.path);
        if (options.json) {
          results.push(info);
        } else {
          logSuccess(`Image information: ${displayPath(file.path)}`);
          const { Bytes, ...shown } = info;
          console.log(shown);
        }
      } catch (err) {
        logError(`✖ ${displayPath(file.path)}: ${err.message}`);
        process.exitCode = 1;
      }
    }

    if (options.json) console.log(JSON.stringify(results, null, 2));
  })

  // help option for subcommand info
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph info input.jpg');
    logSuccess('  $ pic-morph info photos/ --json');
  });

export default infoCommand;
