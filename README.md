# pic-morph

[![npm version](https://img.shields.io/npm/v/pic-morph.svg)](https://www.npmjs.com/package/pic-morph)
[![CI](https://github.com/ajay2827/PicMorph-Cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ajay2827/PicMorph-Cli/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/pic-morph.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/pic-morph.svg)](LICENSE)

An npm package to manipulate images using the command line interface: optimize, compress, resize, convert, crop, rotate, watermark, make thumbnails and favicons, remove backgrounds and read photo details.

## Installation

To install pic-morph globally, use the following command:

```sh
npm install -g pic-morph
```

Requires Node.js 20.9 or newer.

## Quick start

```sh
pic-morph optimize photos/ -o web/               # web-ready WebP images in one step
pic-morph compress photo.jpg --max-size 200kb    # fit an upload limit
pic-morph resize photos/ -r -w 1920 -o resized/  # a whole folder, sub folders included
pic-morph convert IMG_0042.heic --to jpg         # iPhone photo to jpg
pic-morph watch ~/Desktop/screenshots -o ~/Desktop/optimized
```

## Features

- Works on one file, many files, folders or glob patterns, with progress and before/after sizes.
- Reads JPEG, PNG, WebP, AVIF, TIFF, GIF and iPhone HEIC photos.
- Photos are rotated upright from their EXIF orientation, so phone pictures don't come out sideways.
- Metadata such as GPS location is removed unless you ask to keep it.
- Exits with code 1 if anything fails, so it can be used in scripts and CI.

## Commands

| Command | What it does |
| --- | --- |
| [`optimize`](#optimize) | Resize, compress and convert in one step using a preset |
| [`compress`](#compress) | Compress images, keeping their format |
| [`resize`](#resize) | Resize images |
| [`convert`](#convert) | Convert images to another format |
| [`crop`](#crop) | Crop to an aspect ratio or an exact area |
| [`rotate`](#rotate) | Rotate or flip images |
| [`watermark`](#watermark) | Add a text or logo watermark |
| [`thumbnail`](#thumbnail) | Make small preview images |
| [`gray`](#gray) | Convert images to black and white |
| [`remove-bg`](#remove-bg) | Remove the background (remove.bg API) |
| [`favicon`](#favicon) | Create a full favicon set from one image |
| [`info`](#info) | Show image and photo details |
| [`watch`](#watch) | Optimize every image added to a folder |
| [`config`](#config) | Save settings like your API key and default quality |

Run `pic-morph <command> --help` for all options of a command.

### Choosing input files

`<inputs...>` can be any mix of files, folders and glob patterns:

```sh
pic-morph compress photo.jpg logo.png
pic-morph compress photos/            # images directly in photos/
pic-morph compress photos/ -r         # include sub folders
pic-morph compress "photos/**/*.png"  # glob (quote it so your shell doesn't expand it)
```

### Choosing where output goes

By default, results are written next to the input with a suffix (`photo_compressed.jpg`), and existing files are never overwritten (`photo_compressed_(1).jpg`).

| Option | Effect |
| --- | --- |
| `-o, --out-dir <dir>` | Write results to this folder with the original names, keeping the sub folder structure |
| `--suffix <text>` | Use your own suffix, e.g. `--suffix small` gives `photo_small.jpg` |
| `--overwrite` | Replace existing files, including the originals when names match |
| `--keep-metadata` | Keep EXIF/GPS and other metadata, which is removed by default |

### optimize

Resize, compress and convert in one step. Images are never enlarged.

| Preset | For | Result |
| --- | --- | --- |
| `web` (default) | websites | fits in 1920x1920, WebP quality 75 |
| `email` | attachments | fits in 1280x1280, JPEG under 500 KB |
| `social` | social media posts | 1080 px wide, JPEG quality 85 |
| `og` | link previews (Open Graph) | 1200x630 cropped to the interesting part, JPEG under 300 KB |

```sh
pic-morph optimize photo.jpg
pic-morph optimize photos/ -r -p email -o to-send/
pic-morph optimize hero.png -p og
pic-morph optimize photos/ --to avif -q 50   # override the preset's format and quality
```

### compress

Compress with a quality from 1 to 100 (default 60, or your saved setting), or let pic-morph find the best quality that fits a size.

```sh
pic-morph compress myimage.jpg
pic-morph compress myimage.jpg -q 80
pic-morph compress myimage.jpg --max-size 200kb
pic-morph compress photos/ -r -o compressed/
```

### resize

Give a width, a height, or both. With one side only, the aspect ratio is kept.

```sh
pic-morph resize myimage.jpg -w 800
pic-morph resize avatar.png -w 256 -h 256 --fit cover
pic-morph resize photos/ -w 1920 --no-enlarge -o web/
```

`--fit` decides how both sides are used: `inside` (default, fit within the box), `cover` (fill the box and crop), `contain` (fit and pad), `fill` (stretch) or `outside`. `--no-enlarge` never makes small images bigger.

### convert

Convert to `jpg`, `png`, `webp`, `avif`, `tiff` or `gif`. HEIC photos can be read but not written. Images already in the target format are skipped.

```sh
pic-morph convert myimage.png --to webp
pic-morph convert iphone-photos/ --to jpg -o converted/
pic-morph convert photos/ -r --to avif -q 50 -o avif/
pic-morph convert myimage.jpg myimage.png   # single file, choosing the output name
```

### crop

```sh
pic-morph crop photo.jpg --aspect 1:1                        # largest centered square
pic-morph crop photo.jpg --aspect 16:9 --smart               # keep the most interesting part
pic-morph crop photo.jpg -w 800 -h 600 --position top
pic-morph crop screenshot.png -w 500 -h 300 --left 40 --top 120
```

Positions: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`.

### rotate

```sh
pic-morph rotate photo.jpg -a 90
pic-morph rotate scan.png -a -2 --background white   # straighten a scan
pic-morph rotate selfie.jpg --flip horizontal
```

### watermark

```sh
pic-morph watermark photo.jpg --text "© Ajay Singh"
pic-morph watermark photos/ --image logo.png --position top-left --size 15 -o marked/
pic-morph watermark draft.jpg --text DRAFT --position center --size 60 --opacity 0.3
```

`--size` is the watermark width as a % of the image width (default 25), `--opacity` goes from 0 to 1 (default 0.6), `--margin` is the space from the edges (default 3%), and `--color` sets the text color.

### thumbnail

```sh
pic-morph thumbnail photos/ -o thumbs/          # longest side 256 px
pic-morph thumbnail avatar.jpg -s 128 --square  # square, cropped to the interesting part
```

### gray

```sh
pic-morph gray myimage.jpg
pic-morph gray photos/ -o bw/
```

### remove-bg

Remove the background from images. The result is always a transparent `.png`.

This uses the [remove.bg](https://www.remove.bg/api) API. Get an API key and save it once:

```sh
pic-morph config set removeBgKey your_api_key
pic-morph remove-bg myimage.jpg
pic-morph remove-bg products/ -o cutouts/
```

You can also set `REMOVE_BG_API_KEY` in your environment or a `.env` file; it takes priority over the saved key.

### favicon

Create `favicon.ico`, PNG icons, the Apple touch icon, Android icons and `site.webmanifest`, and print the HTML to paste into your `<head>`.

```sh
pic-morph favicon logo.png                          # writes to ./favicon
pic-morph favicon logo.svg -o public/ --name "My Site"
```

Use a square image of at least 512x512 for the sharpest icons.

### info

Shows format, size, dimensions, color space, transparency and DPI, plus camera, lens, date taken, exposure and GPS location for photos.

```sh
pic-morph info photo.jpg
pic-morph info photos/ --json
```

### watch

Optimize every image added to (or changed in) a folder, using an [optimize](#optimize) preset. Handy for screenshots, exports or upload folders.

```sh
pic-morph watch ~/Desktop/screenshots -o ~/Desktop/optimized
pic-morph watch uploads/ -r -o public/images -p web --existing
```

`--existing` processes the images already in the folder first. Press Ctrl+C to stop.

### config

```sh
pic-morph config set removeBgKey your_api_key
pic-morph config set quality 75       # default for compress
pic-morph config set preset email     # default for optimize and watch
pic-morph config list
pic-morph config unset quality
pic-morph config path                 # where settings are saved
```

## Upgrading from 1.x

- `convert` now takes `--to <format>` so it can work on many files. The old `pic-morph convert input.jpg output.png` form still works.
- Commands exit with code 1 when a file fails.
- `remove-bg` always writes a `.png` file.
- Metadata is removed from outputs unless you pass `--keep-metadata`, and images are rotated upright.
- Node.js 20.9 or newer is required.

See the [changelog](CHANGELOG.md) for everything new.

## Contributing

Contributions are welcome! Please follow our [Contribution Guidelines](CONTRIBUTE.md) to get started.

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Contact

If you have any questions or suggestions, feel free to reach out to me on [LinkedIn](https://www.linkedin.com/in/ajay-singh27/).
