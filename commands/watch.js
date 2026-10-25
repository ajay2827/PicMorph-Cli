import { Command } from 'commander';
import { existsSync, statSync, watch } from 'fs';
import { join, relative, resolve, sep } from 'path';
import {
  IMAGE_EXTENSIONS,
  displayPath,
  parseFileSize,
  resolveOutputPath,
} from '../utils/files.js';
import { OUTPUT_FORMATS, parseQuality, saveImage } from '../utils/image.js';
import { PRESETS, getPreset, optimizeImage, presetSettings } from '../utils/presets.js';
import { loadConfig } from '../utils/config.js';
import { runBatch, sizeChange } from '../utils/batch.js';
import { logError, logSuccess, logWarn } from '../utils/colorFormatOutput.js';

// wait this long after the last change before processing, so half-written
// files (copies, exports, downloads) are finished first
const SETTLE_MS = 500;

const isImage = (path) => IMAGE_EXTENSIONS.includes(path.split('.').pop().toLowerCase());

const isInside = (path, dir) => path === dir || path.startsWith(dir + sep);

const watchCommand = new Command();

watchCommand
  .name('watch')
  .arguments('<dir>')
  .requiredOption('-o, --out-dir <dir>', 'folder to write optimized images to')
  .option(
    '-p, --preset <name>',
    `${Object.keys(PRESETS).join(', ')} (default web, or your saved setting)`
  )
  .option(
    '-t, --to <format>',
    `override the preset's format (${OUTPUT_FORMATS.join(', ')})`
  )
  .option('-q, --quality <value>', "override the preset's quality (1-100)")
  .option('-s, --max-size <size>', 'keep each file under this size, e.g. 200kb')
  .option('-r, --recursive', 'also watch sub folders')
  .option('--existing', 'optimize images already in the folder before watching')
  .option('--keep-metadata', 'keep EXIF/GPS and other metadata (removed by default)')
  .description('Watch a folder and optimize every image added to it')
  .action(async (dir, options) => {
    const root = resolve(dir);
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      throw new Error(`Folder not found: ${dir}`);
    }
    const outDir = resolve(options.outDir);
    const presetName = options.preset ?? loadConfig().preset ?? 'web';
    const settings = presetSettings(getPreset(presetName), {
      to: options.to,
      quality: parseQuality(options.quality),
      maxSize: options.maxSize === undefined ? undefined : parseFileSize(options.maxSize),
    });

    // outputs keep the input's name, so a changed file replaces its old output
    const outputOptions = { outDir, overwrite: true, ext: settings.ext };
    const optimizeFile = async (file) => {
      const output = resolveOutputPath(file, outputOptions);
      const result = await optimizeImage(file.path, settings, options);
      await saveImage(result.buffer, output);
      return { output, note: result.note, warning: result.warning };
    };

    if (options.existing) {
      await runBatch([root], options, optimizeFile);
      process.exitCode = 0;
    }

    const timers = new Map();
    let queue = Promise.resolve();

    const processPath = async (path) => {
      if (!existsSync(path) || !statSync(path).isFile()) return;
      try {
        const before = statSync(path).size;
        const { output, note, warning } = await optimizeFile({ path, root });
        logSuccess(
          `✔ ${displayPath(path)} → ${displayPath(output)}  ${sizeChange(before, statSync(output).size)}, ${note}`
        );
        if (warning) logWarn(`    ${warning}`);
      } catch (err) {
        logError(`✖ ${displayPath(path)}: ${err.message}`);
      }
    };

    const watcher = watch(
      root,
      { recursive: Boolean(options.recursive) },
      (_, filename) => {
        if (!filename) return;
        const path = join(root, filename.toString());
        if (!isImage(path) || isInside(path, outDir)) return;
        if (!options.recursive && relative(root, path).includes(sep)) return;

        clearTimeout(timers.get(path));
        timers.set(
          path,
          setTimeout(() => {
            timers.delete(path);
            queue = queue.then(() => processPath(path));
          }, SETTLE_MS)
        );
      }
    );

    logSuccess(
      `Watching ${displayPath(root)} → ${displayPath(outDir)} (preset ${presetName}). Press Ctrl+C to stop.`
    );

    await new Promise((done) => {
      const stop = () => {
        watcher.close();
        timers.forEach(clearTimeout);
        queue.then(done);
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    logSuccess('Stopped watching.');
  })
  // help option for subcommand watch
  .on('--help', () => {
    logSuccess('\nExamples:');
    logSuccess('  $ pic-morph watch ~/Desktop/screenshots -o ~/Desktop/optimized');
    logSuccess('  $ pic-morph watch uploads/ -r -o public/images -p web --existing');
  });

export default watchCommand;
