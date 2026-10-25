# pic-morph

[![npm version](https://img.shields.io/npm/v/pic-morph.svg)](https://www.npmjs.com/package/pic-morph)
[![CI](https://github.com/ajay2827/PicMorph-Cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ajay2827/PicMorph-Cli/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/pic-morph.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/pic-morph.svg)](LICENSE)

**The right image for the job, in one command.**
Web-ready, email-ready or under any size limit. Process whole folders at once, or watch a folder and forget about it.

```sh
npm install -g pic-morph
```

Requires Node.js 20.9 or newer.

## Why pic-morph

### 🎯 Say where the image is going, get the right file

Phone photos are huge. A website, an email and a link preview each need a different size, format and compression, and most people don't know which. With `optimize`, you name the destination and pic-morph picks the rest.

```sh
pic-morph optimize photo.png -p web     # for a website
pic-morph optimize photo.png -p email   # to attach to an email
pic-morph optimize photo.png -p og      # for a link preview (WhatsApp, LinkedIn, Slack)
```

```
✔ photo.png → photo_optimized.webp  1.91 MB → 71.26 KB (-96%), webp quality 75
```

[See all presets →](#optimize)

### 📏 Fit any upload limit, with the best quality possible

*"Photo must be less than 200 KB."* Job applications, visa forms, exam portals and CMS uploads all ask for it. Instead of compressing again and again on a random website, give pic-morph the limit, and it finds the highest quality that still fits.

```sh
pic-morph compress photo.jpg --max-size 200kb
```

```
✔ photo.jpg → photo_compressed.jpg  1.82 MB → 193.87 KB (-90%), quality 38
```

[More about compress →](#compress)

### 👀 Watch a folder and forget about it

Screenshots, phone exports, upload folders: images that keep arriving. Start `watch` once, and every new image dropped into the folder is optimized automatically.

```sh
pic-morph watch ~/Desktop/screenshots -o ~/Desktop/optimized
```

```
Watching screenshots → optimized (preset web). Press Ctrl+C to stop.
✔ screenshots/screenshot-1.png → optimized/screenshot-1.webp  1.91 MB → 71.26 KB (-96%), webp quality 75
✔ screenshots/screenshot-2.png → optimized/screenshot-2.webp  1.06 MB → 63.95 KB (-94%), webp quality 75
```

[More about watch →](#watch)

## Built to be safe to use

- **Whole folders at once:** files, folders (`-r` for sub folders) and glob patterns, with progress and before/after sizes.
- **Never overwrites your files** unless you pass `--overwrite`.
- **Private by default:** GPS location and camera details are removed from outputs unless you pass `--keep-metadata`.
- **iPhone photos just work:** HEIC photos are read by every command, and sideways phone photos are rotated upright.
- **Script friendly:** exits with code 1 if anything fails, so it can be used in scripts and CI.

## Everything else it does

Resize, convert (JPEG, PNG, WebP, AVIF, TIFF, GIF), crop (including smart crop), rotate and flip, watermark with text or a logo, thumbnails, grayscale, background removal (free and offline for plain backgrounds), full favicon sets and photo details (camera, date, GPS). See all commands below.

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
| [`remove-bg`](#remove-bg) | Remove the background, on your computer for free or with remove.bg |
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

Remove the background from images. The result is a transparent `.png`.

**On your computer, free (default).** pic-morph's own background removal runs locally: no account, no internet, and it takes well under a second per photo. It works best on **plain or studio backgrounds**: product shots, logos, ID photos, documents, green screens. It removes soft shadows too.

```sh
pic-morph remove-bg product.jpg
pic-morph remove-bg products/ -o cutouts/
pic-morph remove-bg id-photo.jpg --background white   # passport-style white background
pic-morph remove-bg logo.png --holes --crop           # clear the inside of letters, trim
```

| Option | Effect |
| --- | --- |
| `--background <color>` | Fill the background with a color (`white`, `#1e90ff`) instead of making it transparent |
| `--crop` | Trim the empty space around the subject |
| `--holes` | Also clear background-colored areas enclosed by the subject, like the inside of letters or a mug handle |
| `--keep-shadows` | Keep soft shadows as part of the subject |
| `--tolerance <1-100>` | How different a color can be and still count as background (automatic by default); raise it if background is left behind, lower it if parts of the subject disappear |
| `--feather <px>` | Edge softness (default 1) |

If the background is busy (a room, trees, a street), pic-morph warns you that the result is likely poor. For those photos, use the remove.bg API:

**With remove.bg (`--api`).** Uses the [remove.bg](https://www.remove.bg/api) AI service, which handles any photo, including people with hair against busy backgrounds. Get an API key and save it once:

```sh
pic-morph config set removeBgKey your_api_key
pic-morph remove-bg portrait.jpg --api
```

When a key is saved (or `REMOVE_BG_API_KEY` is set), remove.bg is used by default; pass `--local` to use the local engine anyway.

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
- `remove-bg` always writes a `.png` file, and runs locally unless a remove.bg key is set or `--api` is passed.
- Metadata is removed from outputs unless you pass `--keep-metadata`, and images are rotated upright.
- Node.js 20.9 or newer is required.

See the [changelog](CHANGELOG.md) for everything new.

## Contributing

Contributions are welcome! Please follow our [Contribution Guidelines](CONTRIBUTE.md) to get started.

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Contact

If you have any questions or suggestions, feel free to reach out to me on [LinkedIn](https://www.linkedin.com/in/ajay-singh27/).
