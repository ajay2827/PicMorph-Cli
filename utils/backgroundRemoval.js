/**
 * Local background removal, without AI.
 *
 * Works on images whose background is fairly plain (studio, product, logo,
 * ID photo and document shots):
 *
 * 1. Learn the background colors from the image border (k-means in Lab color),
 *    keeping only colors found along at least two sides, since a subject
 *    usually touches one edge at most.
 * 2. Flood fill from the border through pixels that look like the background
 *    and don't cross a sharp edge. Darker versions of the background (soft
 *    shadows) count as background.
 * 3. Clean up: drop specks, optionally clear enclosed background-colored holes,
 *    then soften the edges into a smooth alpha.
 * 4. Remove the background color that bleeds into the subject's edges.
 *
 * Everything here works on raw pixel buffers; reading and writing files is
 * left to the caller.
 */

// when comparing a pixel with the background, lightness differences count less
// than color differences, and being darker counts even less, so soft shadows
// on a plain background are treated as background
const LIGHTER_WEIGHT = 0.75;
const SHADOW_WEIGHT = 0.35;
const MAX_CLUSTERS = 4;
const KMEANS_ROUNDS = 10;

// ---------- color ----------

const srgbToLinear = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const SRGB_TO_LINEAR = Float32Array.from({ length: 256 }, (_, i) => srgbToLinear(i));

const labF = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

/** Convert interleaved RGB(A) pixels to a Float32Array of L, a, b triples. */
export function toLab(data, channels) {
  const count = data.length / channels;
  const lab = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = SRGB_TO_LINEAR[data[i * channels]];
    const g = SRGB_TO_LINEAR[data[i * channels + 1]];
    const b = SRGB_TO_LINEAR[data[i * channels + 2]];
    // D65 white point
    const x = labF((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const y = labF(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const z = labF((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    lab[i * 3] = 116 * y - 16;
    lab[i * 3 + 1] = 500 * (x - y);
    lab[i * 3 + 2] = 200 * (y - z);
  }
  return lab;
}

const distance = (lab, i, center) => {
  const dl = lab[i * 3] - center[0];
  const da = lab[i * 3 + 1] - center[1];
  const db = lab[i * 3 + 2] - center[2];
  return Math.sqrt(dl * dl + da * da + db * db);
};

// distance from a background color, forgiving lightness changes (see SHADOW_WEIGHT)
const backgroundDistance = (lab, i, center, shadowWeight) => {
  const dl = lab[i * 3] - center[0];
  const weighted = dl * (dl < 0 ? shadowWeight : LIGHTER_WEIGHT);
  const da = lab[i * 3 + 1] - center[1];
  const db = lab[i * 3 + 2] - center[2];
  return Math.sqrt(weighted * weighted + da * da + db * db);
};

const pixelDistance = (lab, i, j) => {
  const dl = lab[i * 3] - lab[j * 3];
  const da = lab[i * 3 + 1] - lab[j * 3 + 1];
  const db = lab[i * 3 + 2] - lab[j * 3 + 2];
  return Math.sqrt(dl * dl + da * da + db * db);
};

// ---------- background model ----------

/**
 * Pixels in a band around the image edge, with the sides each one is on
 * (bit 1 top, 2 bottom, 4 left, 8 right; corners are on two sides).
 */
export function borderPixels(width, height, band) {
  const indexes = [];
  const sides = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const side =
        (y < band ? 1 : 0) |
        (y >= height - band ? 2 : 0) |
        (x < band ? 4 : 0) |
        (x >= width - band ? 8 : 0);
      if (side) {
        indexes.push(y * width + x);
        sides.push(side);
      }
    }
  }
  return { indexes, sides };
}

/**
 * Group the border colors into a few clusters (k-means), so two-tone or
 * gradient backgrounds are modelled by several colors. A cluster only counts
 * as background when it covers a fair part of at least two sides; a color on
 * one side only is most likely the subject touching that edge (a portrait's
 * shoulders, say).
 */
export function learnBackground(lab, { indexes: border, sides }) {
  // start from colors spread across the border
  let centers = [];
  for (let k = 0; k < MAX_CLUSTERS; k++) {
    const i = border[Math.floor(((k + 0.5) / MAX_CLUSTERS) * border.length)];
    centers.push([lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]]);
  }

  const assignment = new Uint8Array(border.length);
  for (let round = 0; round < KMEANS_ROUNDS; round++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    border.forEach((i, n) => {
      let best = 0;
      let bestDistance = Infinity;
      centers.forEach((center, k) => {
        const d = distance(lab, i, center);
        if (d < bestDistance) {
          bestDistance = d;
          best = k;
        }
      });
      assignment[n] = best;
      sums[best][0] += lab[i * 3];
      sums[best][1] += lab[i * 3 + 1];
      sums[best][2] += lab[i * 3 + 2];
      sums[best][3]++;
    });
    centers = centers.map((center, k) =>
      sums[k][3] ? sums[k].slice(0, 3).map((sum) => sum / sums[k][3]) : center
    );
  }

  // share of each side's pixels that belong to each cluster
  const sideBits = [1, 2, 4, 8];
  const sideTotals = sideBits.map((bit) => sides.filter((s) => s & bit).length);
  const counts = centers.map(() => [0, 0, 0, 0, 0]);
  assignment.forEach((k, n) => {
    counts[k][4]++;
    sideBits.forEach((bit, side) => {
      if (sides[n] & bit) counts[k][side]++;
    });
  });
  const isBackground = (k) =>
    counts[k][4] / border.length >= 0.05 &&
    sideBits.filter((_, side) => counts[k][side] / sideTotals[side] >= 0.1).length >= 2;

  let kept = centers.filter((_, k) => isBackground(k));
  if (!kept.length) {
    // no color runs along two sides; fall back to the most common border color
    const largest = counts.reduce((best, c, k) => (c[4] > counts[best][4] ? k : best), 0);
    kept = [centers[largest]];
  }

  // how far background border pixels sit from their cluster: small for plain backgrounds
  const spreads = border
    .map((i) => Math.min(...kept.map((center) => distance(lab, i, center))))
    .filter((d) => d < 30)
    .sort((a, b) => a - b);
  const spread = spreads.length ? spreads[Math.floor(spreads.length * 0.9)] : 30;

  return { centers: kept, spread };
}

/**
 * Average color change between neighboring pixels along the border. Plain
 * backdrops change very little from pixel to pixel; busy scenes (trees,
 * rooms, crowds) change a lot.
 */
export function borderTexture(lab, width, height, band) {
  let total = 0;
  let count = 0;
  const add = (i, j) => {
    total += pixelDistance(lab, i, j);
    count++;
  };
  for (let x = 1; x < width; x++) {
    for (let y = 0; y < band; y++) {
      add(y * width + x, y * width + x - 1);
      add((height - 1 - y) * width + x, (height - 1 - y) * width + x - 1);
    }
  }
  for (let y = 1; y < height; y++) {
    for (let x = 0; x < band; x++) {
      add(y * width + x, (y - 1) * width + x);
      add(y * width + width - 1 - x, (y - 1) * width + width - 1 - x);
    }
  }
  return count ? total / count : 0;
}

// ---------- segmentation ----------

const nearestDistance = (lab, i, centers, shadowWeight) => {
  let best = Infinity;
  for (const center of centers) {
    best = Math.min(best, backgroundDistance(lab, i, center, shadowWeight));
  }
  return best;
};

/**
 * Flood fill the background from the border. A pixel joins when its color is
 * within `tolerance` of a background color and the step from its neighbor is
 * small enough not to cross the subject's outline.
 * @returns {Uint8Array} 1 for background, 0 for subject
 */
export function floodBackground(lab, width, height, centers, tolerance, shadowWeight) {
  const count = width * height;
  const background = new Uint8Array(count);
  const bgDistance = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    bgDistance[i] = nearestDistance(lab, i, centers, shadowWeight);
  }

  const maxStep = tolerance * 0.6;
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;

  const seed = (i) => {
    if (!background[i] && bgDistance[i] <= tolerance) {
      background[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    const y = (i - x) / width;
    const neighbors = [
      x > 0 ? i - 1 : -1,
      x < width - 1 ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y < height - 1 ? i + width : -1,
    ];
    for (const j of neighbors) {
      if (
        j >= 0 &&
        !background[j] &&
        bgDistance[j] <= tolerance &&
        pixelDistance(lab, i, j) <= maxStep
      ) {
        background[j] = 1;
        queue[tail++] = j;
      }
    }
  }

  return { background, bgDistance };
}

/**
 * Turn subject specks smaller than minSize pixels into background, so noise in
 * the backdrop doesn't stay behind as dots.
 */
export function removeSpecks(background, width, height, minSize) {
  const count = width * height;
  const seen = new Uint8Array(count);
  const stack = new Int32Array(count);
  const component = [];

  for (let start = 0; start < count; start++) {
    if (background[start] || seen[start]) continue;
    component.length = 0;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const i = stack[--top];
      component.push(i);
      const x = i % width;
      const y = (i - x) / width;
      for (const j of [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ]) {
        if (j >= 0 && !background[j] && !seen[j]) {
          seen[j] = 1;
          stack[top++] = j;
        }
      }
    }
    if (component.length < minSize) {
      for (const i of component) background[i] = 1;
    }
  }
}

/**
 * Clear areas enclosed by the subject that clearly match the background, such
 * as the inside of letters or of a mug handle. Optional, since it would also
 * clear a white label on a product photographed on white.
 */
export function removeHoles(background, bgDistance, width, height, tolerance, minSize) {
  const count = width * height;
  const seen = new Uint8Array(count);
  const stack = new Int32Array(count);
  const component = [];
  const isHole = (i) => !background[i] && bgDistance[i] <= tolerance * 0.7;

  for (let start = 0; start < count; start++) {
    if (!isHole(start) || seen[start]) continue;
    component.length = 0;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const i = stack[--top];
      component.push(i);
      const x = i % width;
      const y = (i - x) / width;
      for (const j of [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ]) {
        if (j >= 0 && isHole(j) && !seen[j]) {
          seen[j] = 1;
          stack[top++] = j;
        }
      }
    }
    if (component.length >= minSize) {
      for (const i of component) background[i] = 1;
    }
  }
}

// ---------- alpha ----------

/**
 * Blur a single-channel float image with a box filter (the average over a
 * square window, clipped at the edges), horizontally then vertically. Uses
 * running sums, so the cost doesn't depend on the radius.
 */
export function boxBlur(values, width, height, radius) {
  if (radius < 1) return values;
  const pass = (input, along, across, step, lineStep) => {
    const output = new Float32Array(input.length);
    for (let line = 0; line < across; line++) {
      const base = line * lineStep;
      let sum = 0;
      // window [p - radius, p + radius] clipped to [0, along - 1]
      for (let o = 0; o <= Math.min(along - 1, radius); o++)
        sum += input[base + o * step];
      for (let p = 0; p < along; p++) {
        const first = Math.max(0, p - radius);
        const last = Math.min(along - 1, p + radius);
        output[base + p * step] = sum / (last - first + 1);
        if (p + radius + 1 < along) sum += input[base + (p + radius + 1) * step];
        if (p - radius >= 0) sum -= input[base + (p - radius) * step];
      }
    }
    return output;
  };
  const horizontal = pass(values, width, height, 1, width);
  return pass(horizontal, height, width, width, 1);
}

/**
 * Edge-aware smoothing of a mask (He et al., "Guided Image Filtering"): the
 * result follows the outlines of the guide image, so a rough mask snaps to
 * the real edges of hair, fingers and objects.
 * @param {Float32Array} guide grayscale image, 0-1
 * @param {Float32Array} mask rough mask, 0-1
 */
export function guidedFilter(guide, mask, width, height, radius, epsilon) {
  const count = width * height;
  const box = (values) => boxBlur(values, width, height, radius);
  const product = (a, b) => {
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) out[i] = a[i] * b[i];
    return out;
  };

  const meanI = box(guide);
  const meanP = box(mask);
  const corrI = box(product(guide, guide));
  const corrIP = box(product(guide, mask));

  const a = new Float32Array(count);
  const b = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const variance = corrI[i] - meanI[i] * meanI[i];
    const covariance = corrIP[i] - meanI[i] * meanP[i];
    a[i] = covariance / (variance + epsilon);
    b[i] = meanP[i] - a[i] * meanI[i];
  }

  const meanA = box(a);
  const meanB = box(b);
  const output = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    output[i] = Math.min(1, Math.max(0, meanA[i] * guide[i] + meanB[i]));
  }
  return output;
}

/** Grayscale (0-1) from interleaved RGB(A) pixels. */
export function toGray(data, channels) {
  const count = data.length / channels;
  const gray = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    gray[i] =
      (0.299 * data[i * channels] +
        0.587 * data[i * channels + 1] +
        0.114 * data[i * channels + 2]) /
      255;
  }
  return gray;
}

/** Stretch values so `low` becomes 0 and `high` becomes 1, clamping the rest. */
export function stretch(values, low, high) {
  const output = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    output[i] = Math.min(1, Math.max(0, (values[i] - low) / (high - low)));
  }
  return output;
}

/**
 * Soft alpha (0-1): background is 0, subject is 1, and subject pixels at the
 * outline that still look a bit like the background are partly transparent.
 */
export function buildAlpha(background, bgDistance, width, height, tolerance, feather) {
  const count = width * height;
  const alpha = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    if (background[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    const onEdge =
      (x > 0 && background[i - 1]) ||
      (x < width - 1 && background[i + 1]) ||
      (y > 0 && background[i - width]) ||
      (y < height - 1 && background[i + width]);
    alpha[i] = onEdge
      ? Math.min(1, Math.max(0, (bgDistance[i] - tolerance) / tolerance))
      : 1;
  }
  return boxBlur(alpha, width, height, feather);
}

/** Resize a single-channel float image with bilinear interpolation. */
export function resizeBilinear(values, width, height, newWidth, newHeight) {
  if (width === newWidth && height === newHeight) return values;
  const output = new Float32Array(newWidth * newHeight);
  const scaleX = width / newWidth;
  const scaleY = height / newHeight;
  for (let y = 0; y < newHeight; y++) {
    const sy = Math.min(height - 1, Math.max(0, (y + 0.5) * scaleY - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(height - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < newWidth; x++) {
      const sx = Math.min(width - 1, Math.max(0, (x + 0.5) * scaleX - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(width - 1, x0 + 1);
      const fx = sx - x0;
      const top = values[y0 * width + x0] * (1 - fx) + values[y0 * width + x1] * fx;
      const bottom = values[y1 * width + x0] * (1 - fx) + values[y1 * width + x1] * fx;
      output[y * newWidth + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return output;
}

// ---------- main ----------

/**
 * Find the subject in an image.
 * @param {{ data: Buffer, width: number, height: number, channels: number }} image
 *   raw pixels, ideally downscaled to ~1000px for speed
 * @param {{ tolerance?: number, feather?: number, keepShadows?: boolean,
 *   holes?: boolean }} options
 *   tolerance: how different from the background a pixel may be and still
 *   count as background (auto when not given); feather: edge softness in px;
 *   keepShadows: keep soft shadows as part of the subject; holes: also clear
 *   enclosed background-colored areas
 * @returns {{ alpha: Float32Array, tolerance: number, spread: number, texture: number,
 *   subjectShare: number, backgroundColors: number[][] }}
 */
export function findSubject(
  image,
  { tolerance, feather = 1, keepShadows = false, holes = false } = {}
) {
  const { data, width, height, channels } = image;
  const lab = toLab(data, channels);
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.01));
  const { centers, spread } = learnBackground(lab, borderPixels(width, height, band));
  const texture = borderTexture(lab, width, height, band);

  // auto: a little above the natural variation of the background
  const used = tolerance ?? Math.min(40, Math.max(8, spread * 1.5 + 6));
  // keeping shadows: darker areas count at full strength, so they stay subject
  const shadowWeight = keepShadows ? 1 : SHADOW_WEIGHT;

  const { background, bgDistance } = floodBackground(
    lab,
    width,
    height,
    centers,
    used,
    shadowWeight
  );
  const minSize = Math.max(16, Math.round(width * height * 0.0005));
  if (holes) removeHoles(background, bgDistance, width, height, used, minSize);
  removeSpecks(background, width, height, minSize);
  const alpha = buildAlpha(background, bgDistance, width, height, used, feather);

  let subject = 0;
  for (let i = 0; i < alpha.length; i++) subject += alpha[i];

  return {
    alpha,
    tolerance: used,
    spread,
    texture,
    subjectShare: subject / alpha.length,
    backgroundColors: centers.map(labToRgb),
  };
}

// ---------- applying the result ----------

function labToRgb([l, a, b]) {
  const y = (l + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;
  const inverse = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X = inverse(x) * 0.95047;
  const Y = inverse(y);
  const Z = inverse(z) * 1.08883;
  const toSrgb = (c) => {
    c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  };
  return [
    toSrgb(3.2406 * X - 1.5372 * Y - 0.4986 * Z),
    toSrgb(-0.9689 * X + 1.8758 * Y + 0.0415 * Z),
    toSrgb(0.0557 * X - 0.204 * Y + 1.057 * Z),
  ];
}

const nearestRgb = (r, g, b, colors) => {
  let best = colors[0];
  let bestDistance = Infinity;
  for (const color of colors) {
    const d = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = color;
    }
  }
  return best;
};

/**
 * Build RGBA pixels from the original image and an alpha mask of the same
 * size. Edge pixels have the background color taken out of them, so a subject
 * cut from a green screen doesn't keep a green fringe. With `fill`, the
 * background is painted with that color instead of made transparent.
 */
export function applyAlpha(image, alpha, backgroundColors, fill) {
  const { data, width, height, channels } = image;
  const output = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r = data[i * channels];
    let g = data[i * channels + 1];
    let b = data[i * channels + 2];
    const a = alpha[i];

    if (a > 0.02 && a < 0.98 && backgroundColors.length) {
      const [br, bg, bb] = nearestRgb(r, g, b, backgroundColors);
      r = Math.min(255, Math.max(0, (r - (1 - a) * br) / a));
      g = Math.min(255, Math.max(0, (g - (1 - a) * bg) / a));
      b = Math.min(255, Math.max(0, (b - (1 - a) * bb) / a));
    }

    if (fill) {
      output[i * 4] = Math.round(r * a + fill[0] * (1 - a));
      output[i * 4 + 1] = Math.round(g * a + fill[1] * (1 - a));
      output[i * 4 + 2] = Math.round(b * a + fill[2] * (1 - a));
      output[i * 4 + 3] = 255;
    } else {
      output[i * 4] = Math.round(r);
      output[i * 4 + 1] = Math.round(g);
      output[i * 4 + 2] = Math.round(b);
      output[i * 4 + 3] = Math.round(a * 255);
    }
  }
  return output;
}

/** Smallest box containing everything with alpha above 0.05, plus padding. */
export function subjectBounds(alpha, width, height, padding = 0) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 0.05) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(width - 1, right + padding);
  bottom = Math.min(height - 1, bottom + padding);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Paint transparent parts of RGBA pixels with a solid color. */
export function fillTransparent(rgba, fill) {
  const output = Buffer.from(rgba);
  for (let i = 0; i < output.length; i += 4) {
    const a = output[i + 3] / 255;
    for (let c = 0; c < 3; c++) {
      output[i + c] = Math.round(output[i + c] * a + fill[c] * (1 - a));
    }
    output[i + 3] = 255;
  }
  return output;
}

/** Copy a rectangle out of RGBA pixels. */
export function cropPixels(rgba, width, box) {
  const output = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const start = ((box.top + y) * width + box.left) * 4;
    rgba.copy(output, y * box.width * 4, start, start + box.width * 4);
  }
  return output;
}

const NAMED_COLORS = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
};

/** Parse a color like white, #fff or #1e90ff into [r, g, b]. */
export function parseColor(value) {
  const name = String(value).trim().toLowerCase();
  if (NAMED_COLORS[name]) return NAMED_COLORS[name];
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(name)?.[1];
  if (!hex) {
    throw new Error(
      `Invalid color "${value}". Use a #hex color like #ffffff or one of: ${Object.keys(NAMED_COLORS).join(', ')}`
    );
  }
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
