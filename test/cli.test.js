import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const CLI = fileURLToPath(new URL('../index.js', import.meta.url));
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
  await noise(200, 100).jpeg().toFile(at('photos', 'sub', 'c.jpg'));
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
  await noise(50, 50).jpeg().withExif({ IFD0: { Copyright: 'me' } }).toFile(at('exif.jpg'));
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

test('remove-bg without an API key fails clearly', () => {
  const { code, out } = run('remove-bg', 'photos/a.jpg');
  assert.equal(code, 1);
  assert.match(out, /No remove.bg API key/);
});
