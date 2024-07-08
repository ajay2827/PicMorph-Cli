# pic-morph

[![npm version](https://img.shields.io/npm/v/pic-morph.svg)](https://www.npmjs.com/package/pic-morph)

An npm package to manipulate images using the command line interface.

## Installation

To install pic-morph globally, use the following command:

npm install -g pic-morph

## Features

pic-morph provides powerful image manipulation capabilities directly from your terminal:

- Compression: Reduce image file size while maintaining quality.
- Conversion: Convert images between different formats.
- Background Removal: Remove the background from images using remove.bg API.
- Grayscale Conversion: Convert images to grayscale.
- Image Information: Retrieve detailed information about an image.

## Commands

### Image Compression

Compress an image with optional quality adjustment.

pic-morph compress <input_file> [-q <quality>]

- Example:
  pic-morph compress myimage.jpg
  pic-morph compress myimage.jpg -q 80

### Image Conversion

Convert an image from one format to another.

pic-morph convert <input_file.extension> <output_file.extension>

- Example:
  pic-morph convert myimage.jpg myimage.png

### Remove Background

Remove the background from an image.

pic-morph remove-bg <input_file>

- Example:
  pic-morph remove-bg myimage.jpg

### Convert to Grayscale

Convert an image to grayscale.

pic-morph gray <input_file>

- Example:
  pic-morph gray myimage.jpg

### Get Image Information

Retrieve detailed information about an image.

pic-morph info <input_file>

- Example:
  pic-morph info myimage.jpg

## Contributing

Contributions are welcome! Please follow our Contribution Guidelines to get started.

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Contact

If you have any questions or suggestions, feel free to reach out to me on Linkedin.
