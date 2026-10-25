/**
 * Optional AI engine for background removal on busy photos.
 *
 * The neural network runtime (onnxruntime-node, ~290 MB) and the U²-Netp
 * model (4.6 MB, Apache-2.0, https://github.com/xuebinqin/U-2-Net) are not
 * part of the pic-morph package. `pic-morph ai setup` installs them once into
 * a cache folder, so everyone else keeps a small install.
 */
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { homedir } from 'os';
import { join } from 'path';

const RUNTIME = 'onnxruntime-node';
const RUNTIME_VERSION = '1.30.0';

export const MODEL = {
  name: 'u2netp',
  file: 'u2netp.onnx',
  url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
  sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
  size: 320,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
};

export function aiDir() {
  if (process.env.PIC_MORPH_AI_DIR) return process.env.PIC_MORPH_AI_DIR;
  const base =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      : process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'pic-morph', 'ai');
}

const modelPath = () => join(aiDir(), MODEL.file);
const runtimePath = () => join(aiDir(), 'node_modules', RUNTIME);

export function aiStatus() {
  return {
    dir: aiDir(),
    runtime: existsSync(join(runtimePath(), 'package.json')),
    model: existsSync(modelPath()),
  };
}

export const isAiReady = () => {
  const status = aiStatus();
  return status.runtime && status.model;
};

export const AI_SETUP_HINT =
  'The AI engine is not set up. Run `pic-morph ai setup` once (downloads about 300 MB).';

function installRuntime(dir, log) {
  writeFileSync(join(dir, 'package.json'), '{ "private": true }\n');
  log(`Installing ${RUNTIME} ${RUNTIME_VERSION} (about 290 MB)...`);
  // its install script only fetches optional NVIDIA GPU files; the CPU engine is bundled
  const result = spawnSync(
    'npm',
    [
      'install',
      `${RUNTIME}@${RUNTIME_VERSION}`,
      '--prefix',
      dir,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-save',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  );
  if (result.status !== 0) {
    throw new Error(`Installing ${RUNTIME} failed (npm exited with ${result.status}).`);
  }
}

async function downloadModel(log) {
  log(`Downloading the ${MODEL.name} model (4.6 MB)...`);
  const response = await fetch(MODEL.url);
  if (!response.ok) {
    throw new Error(
      `Downloading the model failed: ${response.status} ${response.statusText}`
    );
  }
  const data = Buffer.from(await response.arrayBuffer());
  const hash = createHash('sha256').update(data).digest('hex');
  if (hash !== MODEL.sha256) {
    throw new Error(
      'The downloaded model does not match the expected file; not saving it.'
    );
  }
  writeFileSync(modelPath(), data);
}

export async function setupAi(log = console.log) {
  const dir = aiDir();
  mkdirSync(dir, { recursive: true });
  const status = aiStatus();
  if (!status.runtime) installRuntime(dir, log);
  if (!status.model) await downloadModel(log);
}

export function removeAi() {
  rmSync(aiDir(), { recursive: true, force: true });
}

let sessionPromise;

function loadSession() {
  if (!isAiReady()) throw new Error(AI_SETUP_HINT);
  sessionPromise ??= (async () => {
    const ort = createRequire(join(aiDir(), 'package.json'))(RUNTIME);
    const session = await ort.InferenceSession.create(readFileSync(modelPath()));
    return { ort, session };
  })();
  return sessionPromise;
}

/**
 * Run the model on RGB pixels already resized to MODEL.size x MODEL.size.
 * @returns {Promise<Float32Array>} subject probability per pixel, 0-1
 */
export async function predictSubject(rgb) {
  const { ort, session } = await loadSession();
  const size = MODEL.size;
  const pixels = size * size;

  // same preparation as the model was trained with: scale by the brightest
  // value, then normalize each channel; channels first
  let max = 1;
  for (let i = 0; i < rgb.length; i++) if (rgb[i] > max) max = rgb[i];
  const input = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * pixels + i] = (rgb[i * 3 + c] / max - MODEL.mean[c]) / MODEL.std[c];
    }
  }

  const outputs = await session.run({
    [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, size, size]),
  });
  // the first output is the final, fused prediction
  const prediction = outputs[session.outputNames[0]].data;

  let low = Infinity;
  let high = -Infinity;
  for (const value of prediction) {
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  const result = new Float32Array(pixels);
  const range = high - low || 1;
  for (let i = 0; i < pixels; i++) result[i] = (prediction[i] - low) / range;
  return result;
}
