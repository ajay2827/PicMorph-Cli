import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boxBlur,
  cropPixels,
  findSubject,
  parseColor,
  resizeBilinear,
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
