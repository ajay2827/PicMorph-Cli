# Changelog

## 2.0.0

### New commands

- `optimize`: resize, compress and convert in one step with `web`, `email`, `social` and `og` presets.
- `resize`: by width, height or both, with `--fit` modes and `--no-enlarge`.
- `crop`: to an aspect ratio (optionally `--smart`) or an exact area.
- `rotate`: any angle, plus horizontal/vertical flip.
- `watermark`: text or logo, with position, size, opacity and margin; text gets a soft outline to stay readable on any background (`--no-shadow` to turn off).
- `thumbnail`: small previews, optionally square.
- `favicon`: a full favicon set with `site.webmanifest` and the HTML to paste.
- `watch`: optimize every image added to a folder.
- `config`: save the remove.bg key, default quality and default preset.

### Local background removal

- `remove-bg` now works on your computer for free, with no API key: pic-morph's own algorithm learns the background colors from the image border, follows them in from the edges without crossing the subject's outline, removes soft shadows and cleans the edges. Best for plain and studio backgrounds; warns when a background is too busy.
- New options: `--background <color>`, `--crop`, `--holes`, `--keep-shadows`, `--tolerance`, `--feather`.
- `--api` uses remove.bg (the default when a key is saved), `--local` forces the local engine.
- Busy backgrounds use the U²-Netp AI model on your computer after a one-time `pic-morph ai setup` (about 300 MB, kept outside the package); a guided filter snaps its mask to the real edges. `--method auto|plain|ai` chooses, `auto` by default.
- `pic-morph ai setup|status|remove` manages the AI engine.

### Improvements

- Every command accepts several files, folders (`-r` for sub folders) and glob patterns, with progress, before/after sizes and a summary.
- `-o/--out-dir`, `--suffix`, `--overwrite` and `--keep-metadata` on every command that writes images.
- iPhone HEIC photos can be read by every command.
- Photos are rotated upright from their EXIF orientation.
- `compress --max-size` finds the highest quality under a size limit, and keeps the input format.
- `convert --to <format>` works on many files and skips images already in that format.
- `info` shows color space, DPI, camera, date taken, exposure, GPS and more, and supports `--json`.
- `remove-bg` reads its key from `config` or `REMOVE_BG_API_KEY` and shows remove.bg's error messages.

### Breaking changes

- Node.js 20.9 or newer is required.
- Commands exit with code 1 when a file fails.
- `remove-bg` always writes a `.png` file, and runs locally unless a remove.bg key is set or `--api` is passed.
- Metadata is removed from outputs unless `--keep-metadata` is given.
- The remove.bg API key is no longer built in; set your own.

## 1.0.1

- Compress, convert, grayscale, background removal and image info commands.
