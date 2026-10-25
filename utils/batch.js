import { statSync } from 'fs';
import { resolve } from 'path';
import { displayPath, expandInputs, formatFileSize } from './files.js';
import { logError, logSuccess, logWarn } from './colorFormatOutput.js';

const sizeOf = (path) => statSync(path).size;

export function sizeChange(before, after) {
  const percent = before ? Math.round(((after - before) / before) * 100) : 0;
  const sign = percent > 0 ? '+' : '';
  return `${formatFileSize(before)} → ${formatFileSize(after)} (${sign}${percent}%)`;
}

/**
 * Run processFile over every image matched by the inputs, printing progress
 * and a summary. processFile(file) returns { output, note } or { skipped }.
 * Sets a non-zero exit code if any file failed.
 */
export async function runBatch(inputs, options, processFile) {
  const { files, missing } = await expandInputs(inputs, {
    recursive: options.recursive,
    exclude: options.outDir && resolve(options.outDir),
  });

  for (const input of missing) {
    logError(`✖ ${input}: file not found (or no images matched)`);
  }
  if (!files.length) {
    if (!missing.length) logError('No images found.');
    process.exitCode = 1;
    return;
  }

  const total = files.length;
  let succeeded = 0;
  let skipped = 0;
  let totalBefore = 0;
  let totalAfter = 0;

  for (const [index, file] of files.entries()) {
    const prefix = total > 1 ? `[${index + 1}/${total}] ` : '';
    const name = displayPath(file.path);
    try {
      const before = sizeOf(file.path);
      const result = await processFile(file);
      if (result.skipped) {
        skipped++;
        logWarn(`${prefix}- ${name}: skipped, ${result.skipped}`);
        continue;
      }
      const after = sizeOf(result.output);
      totalBefore += before;
      totalAfter += after;
      succeeded++;
      const note = result.note ? `, ${result.note}` : '';
      logSuccess(
        `${prefix}✔ ${name} → ${displayPath(result.output)}  ${sizeChange(before, after)}${note}`
      );
      if (result.warning) logWarn(`    ${result.warning}`);
    } catch (err) {
      logError(`${prefix}✖ ${name}: ${err.message}`);
    }
  }

  const failed = total - succeeded - skipped + missing.length;
  if (total > 1 || failed) {
    const parts = [`${succeeded} done`];
    if (skipped) parts.push(`${skipped} skipped`);
    if (failed) parts.push(`${failed} failed`);
    const sizes = succeeded > 1 ? `  Total: ${sizeChange(totalBefore, totalAfter)}` : '';
    (failed ? logError : logSuccess)(`\n${parts.join(', ')}.${sizes}`);
  }
  if (failed) process.exitCode = 1;
}
