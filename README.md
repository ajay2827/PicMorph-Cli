# pic-morph

[![npm version](https://img.shields.io/npm/v/pic-morph.svg)](https://www.npmjs.com/package/pic-morph)

An npm package to manipulate images using the command line interface.

## Installation

To install pic-morph globally, use the following command:

```sh
npm install -g pic-morph
```

Requires Node.js 18.17 or newer.

## Features

pic-morph provides powerful image manipulation capabilities directly from your terminal:

- Compression: Reduce image file size while keeping the format, or fit a target size.
- Resizing: Resize to a width, height or exact box.
- Conversion: Convert images between JPEG, PNG, WebP, AVIF, TIFF and GIF.
- Background Removal: Remove the background from images using the remove.bg API.
- Grayscale Conversion: Convert images to grayscale.
- Image Information: Retrieve information about images, as text or JSON.

Every command works on one file, many files, folders or glob patterns, shows the size before and after, and exits with code 1 if anything fails so it can be used in scripts.

## Commands

| Command | What it does |
| --- | --- |
| `pic-morph compress <inputs...>` | Compress images, keeping their format |
| `pic-morph resize <inputs...>` | Resize images |
| `pic-morph convert <inputs...> --to <format>` | Convert images to another format |
| `pic-morph gray <inputs...>` | Convert images to black and white |
| `pic-morph remove-bg <inputs...>` | Remove the background from images |
| `pic-morph info <inputs...>` | Show information about images |

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

Photos are always rotated upright from their EXIF orientation, so phone pictures don't come out sideways.

### Image Compression

Compress images with optional quality (1-100, default 60), or let pic-morph find the best quality that fits a size.

```sh
pic-morph compress myimage.jpg
pic-morph compress myimage.jpg -q 80
pic-morph compress myimage.jpg --max-size 200kb
pic-morph compress photos/ -r -o compressed/
```

### Resize

Give a width, a height, or both. With one side only, the aspect ratio is kept.

```sh
pic-morph resize myimage.jpg -w 800
pic-morph resize avatar.png -w 256 -h 256 --fit cover
pic-morph resize photos/ -w 1920 --no-enlarge -o web/
```

`--fit` decides how both sides are used: `inside` (default, fit within the box), `cover` (fill the box and crop), `contain` (fit and pad), `fill` (stretch) or `outside`. `--no-enlarge` never makes small images bigger.

### Image Conversion

Convert images to `jpg`, `png`, `webp`, `avif`, `tiff` or `gif`. Images already in the target format are skipped.

```sh
pic-morph convert myimage.png --to webp
pic-morph convert photos/ -r --to avif -q 50 -o avif/
pic-morph convert myimage.jpg myimage.png   # single file, choosing the output name
```

### Remove Background

Remove the background from images. The result is always a transparent `.png`.

This command uses the [remove.bg](https://www.remove.bg/api) API. Get a free API key and set it as an environment variable (or put it in a `.env` file):

```sh
export REMOVE_BG_API_KEY=your_api_key
pic-morph remove-bg myimage.jpg
pic-morph remove-bg products/ -o cutouts/
```

### Convert to Grayscale

```sh
pic-morph gray myimage.jpg
pic-morph gray photos/ -o bw/
```

### Get Image Information

```sh
pic-morph info myimage.jpg
pic-morph info photos/ --json
```

## Upgrading from 1.x

- `convert` now takes `--to <format>` so it can work on many files. The old `pic-morph convert input.jpg output.png` form still works.
- Commands exit with code 1 when a file fails.
- `remove-bg` always writes a `.png` file.
- Metadata is removed from outputs unless you pass `--keep-metadata`, and images are rotated upright.

## Contributing

Contributions are welcome! Please follow our [Contribution Guidelines](CONTRIBUTE.md) to get started. Run the tests with:

```sh
npm install
npm test
```

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Contact

If you have any questions or suggestions, feel free to reach out to me on [LinkedIn](https://www.linkedin.com/in/ajay-singh27/).
