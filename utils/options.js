// options shared by every command that reads images
export function addInputOptions(command) {
  return command.option(
    '-r, --recursive',
    'include images in sub folders when a folder is given'
  );
}

// options shared by every command that writes images
export function addOutputOptions(command) {
  return addInputOptions(command)
    .option(
      '-o, --out-dir <dir>',
      'write results to this folder (keeps the original file names)'
    )
    .option('--suffix <text>', 'text added to output file names')
    .option(
      '--overwrite',
      'replace existing files, including the originals when names match'
    )
    .option('--keep-metadata', 'keep EXIF/GPS and other metadata (removed by default)');
}
