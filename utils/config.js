import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { parseQuality } from './image.js';

const PRESET_NAMES = ['web', 'email', 'social', 'og'];

// settings that can be saved with `pic-morph config set <key> <value>`
export const CONFIG_KEYS = {
  removeBgKey: {
    description: 'remove.bg API key (REMOVE_BG_API_KEY takes priority)',
    parse: String,
    secret: true,
  },
  quality: {
    description: 'default quality for compress (1-100)',
    parse: parseQuality,
  },
  preset: {
    description: `default preset for optimize and watch (${PRESET_NAMES.join(', ')})`,
    parse: (value) => {
      if (!PRESET_NAMES.includes(value)) {
        throw new Error(
          `Unknown preset "${value}". Use one of: ${PRESET_NAMES.join(', ')}`
        );
      }
      return value;
    },
  },
};

export function configPath() {
  if (process.env.PIC_MORPH_CONFIG) return process.env.PIC_MORPH_CONFIG;
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'pic-morph', 'config.json');
}

export function loadConfig() {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`Could not read the config file at ${path}. Fix or delete it.`);
  }
}

export function saveConfig(config) {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  // owner-only, since it can hold an API key
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export function checkConfigKey(key) {
  if (!CONFIG_KEYS[key]) {
    throw new Error(
      `Unknown setting "${key}". Available: ${Object.keys(CONFIG_KEYS).join(', ')}`
    );
  }
  return CONFIG_KEYS[key];
}
