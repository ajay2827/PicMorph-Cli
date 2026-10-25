import fg from 'fast-glob';
import { existsSync, statSync } from 'fs';
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from 'path';

// image extensions picked up when a folder or glob is given
export const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'tif',
  'tiff',
  'gif',
  'heic',
  'heif',
];

const isImage = (path) =>
  IMAGE_EXTENSIONS.includes(extname(path).slice(1).toLowerCase());

// fast-glob only understands forward slashes
const toGlob = (path) =>
  process.platform === 'win32' ? path.replace(/\\/g, '/') : path;

function commonDir(paths) {
  return paths.map(dirname).reduce((common, dir) => {
    while (dir !== common && !dir.startsWith(common + sep)) {
      common = dirname(common);
    }
    return common;
  });
}

/**
 * Expand files, folders and glob patterns into a list of images.
 * Each entry keeps the folder it was found under (root), so --out-dir can
 * mirror the input folder structure. Images inside `exclude` (the output
 * folder) are left out of folder and glob matches, so outputs aren't
 * processed again.
 * @returns {{ files: {path: string, root: string}[], missing: string[] }}
 */
export async function expandInputs(inputs, { recursive = false, exclude } = {}) {
  const files = [];
  const missing = [];
  const seen = new Set();

  const excluded = (path) => exclude && (path + sep).startsWith(exclude + sep);
  const add = (paths, root, { explicit = false } = {}) => {
    for (const path of paths.map((p) => resolve(p)).sort()) {
      if (!explicit && excluded(path)) continue;
      if (!seen.has(path)) {
        seen.add(path);
        files.push({ path, root });
      }
    }
  };

  for (const input of inputs) {
    if (existsSync(input) && statSync(input).isDirectory()) {
      const pattern = `${recursive ? '**/' : ''}*.{${IMAGE_EXTENSIONS.join(',')}}`;
      const matches = await fg(pattern, {
        cwd: input,
        absolute: true,
        caseSensitiveMatch: false,
      });
      add(matches, resolve(input));
    } else if (existsSync(input)) {
      add([input], dirname(resolve(input)), { explicit: true });
    } else if (fg.isDynamicPattern(toGlob(input))) {
      const matches = (await fg(toGlob(input), { absolute: true })).filter(isImage);
      if (matches.length) add(matches, commonDir(matches.map((m) => resolve(m))));
      else missing.push(input);
    } else {
      missing.push(input);
    }
  }

  return { files, missing };
}

/**
 * Work out where to write the output for an input file.
 * - with --out-dir, files keep their name (and sub folder) inside that folder
 * - otherwise they are written next to the input with a suffix (e.g. _compressed)
 * - --overwrite replaces existing files (and the original, if names match)
 *   instead of adding _(1), _(2), ...
 */
export function resolveOutputPath(
  file,
  { outDir, suffix, overwrite, defaultSuffix = '', ext } = {}
) {
  const extension = ext ?? extname(file.path);
  const dir = outDir
    ? join(resolve(outDir), relative(file.root, dirname(file.path)))
    : dirname(file.path);
  const base = basename(file.path, extname(file.path));
  const tagText = suffix ?? (outDir || overwrite ? '' : defaultSuffix);
  const tag = tagText ? `_${tagText}` : '';

  let output = join(dir, `${base}${tag}${extension}`);
  if (overwrite) return output;

  let count = 0;
  while (existsSync(output)) {
    count++;
    output = join(dir, `${base}${tag}_(${count})${extension}`);
  }
  return output;
}

export function formatFileSize(size) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];

  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }

  return size.toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
}

// parse sizes like "200kb", "1.5mb" or "5000" (bytes)
export function parseFileSize(value) {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(String(value).trim());
  if (!match) {
    throw new Error(`Invalid size "${value}". Use a value like 200kb or 1.5mb.`);
  }
  const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Math.round(parseFloat(match[1]) * units[(match[2] || 'b').toLowerCase()]);
}

// show paths relative to where the command was run, when possible
export function displayPath(path) {
  const rel = relative(process.cwd(), path);
  return rel && !rel.startsWith('..') ? rel : path;
}
