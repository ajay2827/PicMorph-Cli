# Contribution Guidelines

## Local Setup Instructions

1. Raise an issue describing the bug or feature you want to work on.
2. Wait for the issue to be confirmed by me.
3. Fork the repository.
4. Create a new branch for your changes.
5. Install dependencies with `npm install` (Node.js 20.9 or newer).
6. Make the necessary changes, adding tests in `test/cli.test.js` for new behavior.
7. Run `npm run check` (lint, format check and tests) and make sure it passes. `npm run format` fixes formatting.
8. Raise a pull request (PR) with a clear description of your changes.

You can try your local copy as the real command with `npm link`, then run `pic-morph ...` anywhere.

## Project layout

- `index.js` registers the commands.
- `commands/` has one file per command.
- `utils/files.js` finds input files and works out output paths.
- `utils/batch.js` runs a command over many files with progress and a summary.
- `utils/image.js` opens, encodes and saves images (including HEIC).
- `utils/presets.js` holds the `optimize`/`watch` presets.
- `utils/config.js` reads and writes saved settings.

## Releasing

1. Update the version in `package.json` (`npm version minor` or similar) and add the changes to `CHANGELOG.md`.
2. Push, then publish a GitHub release with a tag matching the version (for example `v2.1.0`).
3. The Publish workflow runs the checks and publishes to npm.

## Note for Contributors

The pic-morph CLI tool is designed as the ultimate image manipulation CLI, focusing on everyday image tasks. It aims to provide developers and anyone working with images a quick, scriptable solution for common image work.

Please align your contributions with the tool's primary purpose of lightweight, focused image processing.

## Contact

If you have any questions or would like to discuss contributions further, feel free to reach out to me on [LinkedIn](https://www.linkedin.com/in/ajay-singh27/).
