import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boxBlur,
  cropPixels,
  findSubject,
  guidedFilter,
  parseColor,
  resizeBilinear,
  stretch,
  subjectBounds,
} from '../utils/backgroundRemoval.js';

// raw RGB image painted by a function of (x, y)
function paint(width, height, colorAt) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(colorAt(x, y), (y * width + x) * 3);
    }
  }
  return { data, width, height, channels: 3 };
}

const inSquare = (x, y) => x >= 30 && x < 70 && y >= 30 && y < 70;

test('finds a square on a plain background', () => {
  const image = paint(100, 100, (x, y) =>
    inSquare(x, y) ? [200, 30, 30] : [245, 245, 245]
  );
  const { alpha, subjectShare } = findSubject(image, { feather: 0 });
  assert.equal(alpha[5 * 100 + 5], 0);
  assert.equal(alpha[50 * 100 + 50], 1);
  assert.ok(Math.abs(subjectShare - 0.16) < 0.02, String(subjectShare));
});

test('handles a vertical gradient background', () => {
  const image = paint(100, 100, (x, y) =>
    inSquare(x, y) ? [20, 20, 60] : [150 + y, 190 + Math.floor(y / 2), 255]
  );
  const { alpha } = findSubject(image, { feather: 0 });
  assert.equal(alpha[2 * 100 + 50], 0);
  assert.equal(alpha[97 * 100 + 50], 0);
  assert.equal(alpha[50 * 100 + 50], 1);
});

test('keeps a subject that touches one edge', () => {
  const image = paint(100, 100, (x, y) =>
    x >= 20 && x < 80 && y >= 60 ? [40, 60, 120] : [230, 230, 230]
  );
  const { alpha } = findSubject(image, { feather: 0 });
  assert.equal(alpha[99 * 100 + 50], 1);
  assert.equal(alpha[99 * 100 + 5], 0);
});

test('a large subject on one side is not learned as background', () => {
  // the blue covers most of the bottom side, which is over 10% of the whole
  // border; without the two-sides rule it would count as backdrop
  const image = paint(100, 100, (x, y) =>
    x >= 5 && x < 95 && y >= 50 ? [30, 60, 200] : [240, 240, 240]
  );
  const { alpha } = findSubject(image, { feather: 0 });
  assert.equal(alpha[99 * 100 + 50], 1);
  assert.equal(alpha[99 * 100 + 1], 0);
});

test('tolerance can be set by hand', () => {
  const image = paint(100, 100, (x, y) =>
    inSquare(x, y) ? [235, 235, 235] : [245, 245, 245]
  );
  assert.equal(findSubject(image, { tolerance: 1, feather: 0 }).alpha[50 * 100 + 50], 1);
  assert.equal(findSubject(image, { tolerance: 30, feather: 0 }).alpha[50 * 100 + 50], 0);
});

test('resizeBilinear keeps flat areas and blends edges', () => {
  const values = Float32Array.from([0, 1, 0, 1]);
  const big = resizeBilinear(values, 2, 2, 4, 4);
  assert.equal(big[0], 0);
  assert.equal(big[3], 1);
  assert.ok(big[1] > 0 && big[1] < 1);
});

test('boxBlur keeps the total roughly and softens a step', () => {
  const values = Float32Array.from({ length: 10 }, (_, i) => (i < 5 ? 0 : 1));
  const blurred = boxBlur(values, 10, 1, 1);
  assert.ok(blurred[4] > 0 && blurred[5] < 1);
  assert.equal(blurred[0], 0);
});

test('subjectBounds and cropPixels', () => {
  const alpha = new Float32Array(100);
  alpha[3 * 10 + 4] = 1;
  alpha[6 * 10 + 7] = 1;
  const box = subjectBounds(alpha, 10, 10);
  assert.deepEqual(box, { left: 4, top: 3, width: 4, height: 4 });
  assert.equal(subjectBounds(new Float32Array(100), 10, 10), null);
  const rgba = Buffer.alloc(400, 9);
  assert.equal(cropPixels(rgba, 10, box).length, 4 * 4 * 4);
});

test('parseColor', () => {
  assert.deepEqual(parseColor('white'), [255, 255, 255]);
  assert.deepEqual(parseColor('#1e90ff'), [30, 144, 255]);
  assert.deepEqual(parseColor('#fff'), [255, 255, 255]);
  assert.throws(() => parseColor('nope'));
});

test('boxBlur matches a plain average, whatever the radius', () => {
  const values = Float32Array.from({ length: 7 * 5 }, (_, i) => (i * 37) % 11);
  const naive = (radius) => {
    const at = (x, y) => values[y * 7 + x];
    const horizontal = new Float32Array(35);
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 7; x++) {
        let sum = 0;
        let n = 0;
        for (let o = Math.max(0, x - radius); o <= Math.min(6, x + radius); o++, n++)
          sum += at(o, y);
        horizontal[y * 7 + x] = sum / n;
      }
    const out = new Float32Array(35);
    for (let x = 0; x < 7; x++)
      for (let y = 0; y < 5; y++) {
        let sum = 0;
        let n = 0;
        for (let o = Math.max(0, y - radius); o <= Math.min(4, y + radius); o++, n++)
          sum += horizontal[o * 7 + x];
        out[y * 7 + x] = sum / n;
      }
    return out;
  };
  for (const radius of [1, 2, 4, 9]) {
    const fast = boxBlur(values, 7, 5, radius);
    naive(radius).forEach((v, i) => assert.ok(Math.abs(v - fast[i]) < 1e-4));
  }
});

test('guidedFilter snaps a blurry mask to the edge in the guide', () => {
  // guide: dark left half, light right half; mask: a soft ramp across the middle
  const width = 40;
  const height = 10;
  const guide = Float32Array.from({ length: width * height }, (_, i) =>
    i % width < 20 ? 0.1 : 0.9
  );
  const mask = Float32Array.from({ length: width * height }, (_, i) =>
    Math.min(1, Math.max(0, ((i % width) - 14) / 12))
  );
  const out = guidedFilter(guide, mask, width, height, 4, 1e-4);
  // closer to a clean step at x = 20 than the input ramp was
  assert.ok(out[5 * width + 17] < mask[5 * width + 17]);
  assert.ok(out[5 * width + 22] > mask[5 * width + 22]);
});

test('stretch maps a range to 0-1', () => {
  assert.deepEqual(
    [...stretch(Float32Array.from([0, 0.25, 0.5, 0.75, 1]), 0.25, 0.75)],
    [0, 0, 0.5, 1, 1]
  );
});
