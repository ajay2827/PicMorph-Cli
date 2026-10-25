import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const CLI = fileURLToPath(new URL('../index.js', import.meta.url));
const FIXTURE_HEIC = fileURLToPath(new URL('./fixtures/photo.heic', import.meta.url));
let dir;

// noisy pixels so compression has something to work with
function noise(width, height) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 7919) % 251;
  return sharp(pixels, { raw: { width, height, channels: 3 } });
}

function run(...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      REMOVE_BG_API_KEY: '',
      PIC_MORPH_CONFIG: join(dir, 'config.json'),
    },
  });
  return { code: result.status, out: result.stdout + result.stderr };
}

const at = (...parts) => join(dir, ...parts);
const meta = (...parts) => sharp(at(...parts)).metadata();

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pic-morph-'));
  mkdirSync(at('photos', 'sub'), { recursive: true });
  await noise(400, 300).jpeg({ quality: 95 }).toFile(at('photos', 'a.jpg'));
  await noise(400, 300).png().toFile(at('photos', 'b.png'));
  await noise(200, 100)
    .jpeg()
    .toFile(at('photos', 'sub', 'c.jpg'));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('compress keeps the input format', async () => {
  const { code } = run('compress', 'photos/b.png');
  assert.equal(code, 0);
  assert.equal((await meta('photos', 'b_compressed.png')).format, 'png');
});

test('compress -o mirrors sub folders with -r', () => {
  const { code, out } = run('compress', 'photos', '-r', '-o', 'out');
  assert.equal(code, 0);
  assert.ok(existsSync(at('out', 'a.jpg')));
  assert.ok(existsSync(at('out', 'b.png')));
  assert.ok(existsSync(at('out', 'sub', 'c.jpg')));
  assert.match(out, /3 done/);
});

test('folders without -r skip sub folders', () => {
  run('compress', 'photos', '-o', 'out');
  assert.ok(!existsSync(at('out', 'sub')));
});

test('globs are expanded', () => {
  const { code } = run('gray', 'photos/**/*.jpg', '-o', 'out');
  assert.equal(code, 0);
  assert.ok(existsSync(at('out', 'a.jpg')));
  assert.ok(existsSync(at('out', 'sub', 'c.jpg')));
  assert.ok(!existsSync(at('out', 'b.png')));
});

test('existing outputs are numbered, not overwritten', () => {
  run('gray', 'photos/a.jpg');
  run('gray', 'photos/a.jpg');
  assert.ok(existsSync(at('photos', 'a_bw.jpg')));
  assert.ok(existsSync(at('photos', 'a_bw_(1).jpg')));
});

test('--overwrite replaces the original', async () => {
  const { code } = run('resize', 'photos/a.jpg', '-w', '100', '--overwrite');
  assert.equal(code, 0);
  assert.equal((await meta('photos', 'a.jpg')).width, 100);
});

test('a missing file fails with exit code 1 but others still run', () => {
  const { code, out } = run('compress', 'photos/a.jpg', 'nope.jpg');
  assert.equal(code, 1);
  assert.match(out, /nope\.jpg: file not found/);
  assert.ok(existsSync(at('photos', 'a_compressed.jpg')));
});

test('invalid quality fails with exit code 1', () => {
  assert.equal(run('compress', 'photos/a.jpg', '-q', '500').code, 1);
});

test('compress --max-size fits the target', () => {
  const { code } = run('compress', 'photos/a.jpg', '--max-size', '20kb');
  assert.equal(code, 0);
  assert.ok(statSync(at('photos', 'a_compressed.jpg')).size <= 20 * 1024);
});

test('metadata is removed unless --keep-metadata', async () => {
  await noise(50, 50)
    .jpeg()
    .withExif({ IFD0: { Copyright: 'me' } })
    .toFile(at('exif.jpg'));
  run('gray', 'exif.jpg');
  run('gray', 'exif.jpg', '--keep-metadata', '--suffix', 'kept');
  assert.equal((await meta('exif_bw.jpg')).exif, undefined);
  assert.ok((await meta('exif_kept.jpg')).exif);
});

test('images are rotated upright from EXIF orientation', async () => {
  // 200x100 stored, but orientation 6 means it displays as 100x200
  await noise(200, 100).jpeg().withMetadata({ orientation: 6 }).toFile(at('phone.jpg'));
  run('gray', 'phone.jpg');
  const { width, height, orientation } = await meta('phone_bw.jpg');
  assert.deepEqual([width, height, orientation], [100, 200, undefined]);
});

test('resize by width keeps aspect ratio', async () => {
  run('resize', 'photos/a.jpg', '-w', '200');
  const { width, height } = await meta('photos', 'a_resized.jpg');
  assert.deepEqual([width, height], [200, 150]);
});

test('resize --fit cover crops to exact size', async () => {
  run('resize', 'photos/a.jpg', '-w', '100', '-h', '100', '--fit', 'cover');
  const { width, height } = await meta('photos', 'a_resized.jpg');
  assert.deepEqual([width, height], [100, 100]);
});

test('resize --no-enlarge never upscales', async () => {
  run('resize', 'photos/a.jpg', '-w', '1000', '--no-enlarge');
  assert.equal((await meta('photos', 'a_resized.jpg')).width, 400);
});

test('resize needs a width or height', () => {
  assert.equal(run('resize', 'photos/a.jpg').code, 1);
});

test('convert --to skips images already in that format', async () => {
  const { code, out } = run('convert', 'photos', '--to', 'jpg');
  assert.equal(code, 0);
  assert.match(out, /a\.jpg: skipped/);
  assert.equal((await meta('photos', 'b.jpg')).format, 'jpeg');
});

test('convert still supports the old two-file form', async () => {
  const { code } = run('convert', 'photos/a.jpg', 'out.webp');
  assert.equal(code, 0);
  assert.equal((await meta('out.webp')).format, 'webp');
});

test('info --json prints parseable output', () => {
  const { code, out } = run('info', 'photos/a.jpg', 'photos/b.png', '--json');
  assert.equal(code, 0);
  const info = JSON.parse(out);
  assert.equal(info.length, 2);
  assert.equal(info[0].Width, 400);
});

test('remove-bg --api without an API key fails clearly', () => {
  const { code, out } = run('remove-bg', 'photos/a.jpg', '--api');
  assert.equal(code, 1);
  assert.match(out, /No remove.bg API key/);
});

test('outputs inside the input folder are not processed again', () => {
  run('compress', 'photos', '-r', '-o', 'photos/out');
  const { out } = run('compress', 'photos', '-r', '-o', 'photos/out');
  assert.match(out, /3 done/);
});

test('HEIC photos are read and written as jpeg', async () => {
  copyFileSync(FIXTURE_HEIC, at('photo.heic'));
  const { code } = run('compress', 'photo.heic');
  assert.equal(code, 0);
  assert.equal((await meta('photo_compressed.jpg')).format, 'jpeg');
  assert.equal((await meta('photo_compressed.jpg')).width, 160);
});

test('HEIC can be converted but not written', async () => {
  copyFileSync(FIXTURE_HEIC, at('photo.heic'));
  assert.equal(run('convert', 'photo.heic', '--to', 'png').code, 0);
  assert.equal((await meta('photo.png')).format, 'png');
  assert.equal(run('convert', 'photos/a.jpg', '--to', 'heic').code, 1);
});

test('gif and tiff convert both ways', async () => {
  run('convert', 'photos/a.jpg', '--to', 'gif');
  run('convert', 'photos/a.jpg', '--to', 'tiff');
  run('convert', 'photos/a.gif', '--to', 'png', '--suffix', 'from-gif');
  run('convert', 'photos/a.tiff', '--to', 'jpg', '--suffix', 'from-tiff');
  assert.equal((await meta('photos', 'a_from-gif.png')).format, 'png');
  assert.equal((await meta('photos', 'a_from-tiff.jpg')).format, 'jpeg');
});

test('config set/get/list stores settings', () => {
  assert.equal(run('config', 'set', 'quality', '75').code, 0);
  assert.equal(run('config', 'get', 'quality').out.trim(), '75');
  run('config', 'set', 'removeBgKey', 'secret-key-1234');
  const { out } = run('config', 'list');
  assert.match(out, /removeBgKey = \*+1234/);
  assert.doesNotMatch(out, /secret-key/);
  assert.equal(run('config', 'set', 'quality', '500').code, 1);
  assert.equal(run('config', 'set', 'nope', '1').code, 1);
});

test('compress uses the saved quality', () => {
  run('config', 'set', 'quality', '33');
  assert.match(run('compress', 'photos/a.jpg').out, /quality 33/);
});

test('optimize web preset writes webp', async () => {
  const { code } = run('optimize', 'photos/a.jpg');
  assert.equal(code, 0);
  assert.equal((await meta('photos', 'a_optimized.webp')).format, 'webp');
});

test('optimize og preset crops to 1200x630 without enlarging', async () => {
  await noise(2400, 1800).jpeg().toFile(at('big.jpg'));
  run('optimize', 'big.jpg', '-p', 'og');
  const { width, height } = await meta('big_optimized.jpg');
  assert.deepEqual([width, height], [1200, 630]);
});

test('optimize rejects unknown presets', () => {
  assert.equal(run('optimize', 'photos/a.jpg', '-p', 'nope').code, 1);
});

test('crop --aspect takes the largest area', async () => {
  run('crop', 'photos/a.jpg', '--aspect', '1:1');
  const { width, height } = await meta('photos', 'a_cropped.jpg');
  assert.deepEqual([width, height], [300, 300]);
});

test('crop --smart keeps the full size of the area', async () => {
  run('crop', 'photos/a.jpg', '--aspect', '16:9', '--smart');
  const { width, height } = await meta('photos', 'a_cropped.jpg');
  assert.deepEqual([width, height], [400, 225]);
});

test('crop exact area and too-large area', async () => {
  run('crop', 'photos/a.jpg', '-w', '100', '-h', '50', '--left', '10', '--top', '10');
  const { width, height } = await meta('photos', 'a_cropped.jpg');
  assert.deepEqual([width, height], [100, 50]);
  assert.equal(run('crop', 'photos/a.jpg', '-w', '1000').code, 1);
});

test('crop works on the upright image', async () => {
  await noise(200, 100).jpeg().withMetadata({ orientation: 6 }).toFile(at('phone.jpg'));
  run('crop', 'phone.jpg', '-w', '100', '-h', '150');
  const { width, height } = await meta('phone_cropped.jpg');
  assert.deepEqual([width, height], [100, 150]);
});

test('rotate 90 swaps width and height, flip keeps size', async () => {
  run('rotate', 'photos/a.jpg', '-a', '90');
  run('rotate', 'photos/a.jpg', '--flip', 'horizontal', '--suffix', 'flipped');
  const rotated = await meta('photos', 'a_rotated.jpg');
  const flipped = await meta('photos', 'a_flipped.jpg');
  assert.deepEqual([rotated.width, rotated.height], [300, 400]);
  assert.deepEqual([flipped.width, flipped.height], [400, 300]);
  assert.equal(run('rotate', 'photos/a.jpg').code, 1);
});

test('watermark with text and with a logo', async () => {
  const text = run('watermark', 'photos/a.jpg', '--text', '© Me & Co <test>');
  assert.equal(text.code, 0);
  const logo = run(
    'watermark',
    'photos/b.png',
    '--image',
    'photos/sub/c.jpg',
    '--position',
    'center'
  );
  assert.equal(logo.code, 0);
  assert.equal((await meta('photos', 'a_watermarked.jpg')).width, 400);
  assert.equal(run('watermark', 'photos/a.jpg').code, 1);
});

test('thumbnail --square makes a square', async () => {
  run('thumbnail', 'photos/a.jpg', '-s', '64', '--square');
  const { width, height } = await meta('photos', 'a_thumb.jpg');
  assert.deepEqual([width, height], [64, 64]);
});

test('favicon creates the full set', async () => {
  const { code } = run('favicon', 'photos/b.png', '-o', 'icons');
  assert.equal(code, 0);
  for (const name of [
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'site.webmanifest',
  ]) {
    assert.ok(existsSync(at('icons', name)), name);
  }
  const ico = readFileSync(at('icons', 'favicon.ico'));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  assert.equal(run('favicon', 'photos/b.png', '-o', 'icons').code, 1);
});

test('info shows photo details from EXIF', () => {
  return noise(40, 20)
    .jpeg()
    .withExif({
      IFD0: { Make: 'Apple', Model: 'iPhone 15' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '12/1 30/1 0/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '77/1 0/1 0/1',
      },
    })
    .toFile(at('exif.jpg'))
    .then(() => {
      const [info] = JSON.parse(run('info', 'exif.jpg', '--json').out);
      assert.equal(info.Camera, 'Apple iPhone 15');
      assert.deepEqual(info.GPS, { Latitude: 12.5, Longitude: -77 });
    });
});

test('watch optimizes new images and stops cleanly', async () => {
  mkdirSync(at('inbox'));
  const child = spawn(process.execPath, [CLI, 'watch', 'inbox', '-o', 'inbox/out'], {
    cwd: dir,
    env: { ...process.env, FORCE_COLOR: '0', PIC_MORPH_CONFIG: join(dir, 'config.json') },
  });
  let out = '';
  child.stdout.on('data', (chunk) => (out += chunk));
  child.stderr.on('data', (chunk) => (out += chunk));

  const waitFor = async (check, ms = 10000) => {
    const end = Date.now() + ms;
    while (!check()) {
      if (Date.now() > end) throw new Error(`timed out; output:\n${out}`);
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  await waitFor(() => out.includes('Watching'));
  copyFileSync(at('photos', 'a.jpg'), at('inbox', 'new.jpg'));
  await waitFor(() => existsSync(at('inbox', 'out', 'new.webp')) && out.includes('✔'));

  const exited = new Promise((done) => child.on('exit', done));
  child.kill('SIGTERM');
  const code = await exited;
  // Windows has no signals to catch; the process is just ended
  if (process.platform !== 'win32') {
    assert.equal(code, 0);
    assert.match(out, /Stopped watching/);
  }
});

// a studio-style shot: subject on a plain backdrop with a soft shadow,
// touching the bottom edge like a portrait's shoulders
const studioShot = (file) =>
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="240">
      <defs><filter id="s"><feGaussianBlur stdDeviation="8"/></filter></defs>
      <rect width="300" height="240" fill="#eeeeee"/>
      <ellipse cx="150" cy="150" rx="90" ry="14" fill="#c8c8c8" filter="url(#s)"/>
      <rect x="100" y="40" width="100" height="110" fill="#c0392b"/>
      <rect x="125" y="70" width="50" height="40" fill="#eeeeee"/>
      <rect x="40" y="200" width="220" height="40" fill="#2c3e50"/>
    </svg>`)
  )
    .jpeg({ quality: 92 })
    .toFile(at(file));

const alphaAt = async (file, x, y) => {
  const { data, info } = await sharp(at(file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * 4 + 3];
};

test('remove-bg works locally without an API key', async () => {
  await studioShot('studio.jpg');
  const { code, out } = run('remove-bg', 'studio.jpg');
  assert.equal(code, 0, out);
  assert.match(out, /local/);
  assert.equal(await alphaAt('studio_no-bg.png', 5, 5), 0); // backdrop
  assert.equal(await alphaAt('studio_no-bg.png', 110, 50), 255); // subject
  assert.equal(await alphaAt('studio_no-bg.png', 150, 225), 255); // touches the edge
  assert.equal(await alphaAt('studio_no-bg.png', 60, 158), 0); // soft shadow
  assert.equal(await alphaAt('studio_no-bg.png', 150, 90), 255); // enclosed area kept
});

test('remove-bg --holes clears enclosed background, --keep-shadows keeps shadows', async () => {
  await studioShot('studio.jpg');
  run('remove-bg', 'studio.jpg', '--holes', '--suffix', 'holes');
  run('remove-bg', 'studio.jpg', '--keep-shadows', '--suffix', 'shadow');
  assert.equal(await alphaAt('studio_holes.png', 150, 90), 0);
  assert.ok((await alphaAt('studio_shadow.png', 150, 160)) > 0);
});

test('remove-bg --background fills and --crop trims', async () => {
  await studioShot('studio.jpg');
  run('remove-bg', 'studio.jpg', '--background', '#ffffff', '--crop');
  const { width, height, hasAlpha } = await meta('studio_no-bg.png');
  assert.ok(width < 300 && height < 240, `${width}x${height}`);
  const { data } = await sharp(at('studio_no-bg.png'))
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.subarray(0, 3)], [255, 255, 255]);
  assert.ok(!hasAlpha || data[3] === 255);
  assert.equal(run('remove-bg', 'studio.jpg', '--background', 'notacolor').code, 1);
});

test('remove-bg warns about busy backgrounds', () => {
  const { code, out } = run('remove-bg', 'photos/a.jpg', '--local');
  assert.equal(code, 0);
  assert.match(out, /background looks busy/);
});
