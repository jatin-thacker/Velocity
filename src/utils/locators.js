// helpers/locators.js
const fs   = require('node:fs');
const path = require('node:path');

let CACHE = null;  // parsed registry cache
let LAST  = null;  // absolute path to last-loaded registry// Default: ../locators/registry.json (sibling of /helpers)
const DEFAULT_REG_PATH = path.join(__dirname, '..', 'locators', 'registry.json');


// Default: helpers/locators/registry.json
// (It was: path.join(__dirname, 'locators', 'registry.json'))

function resolveRegistryPath(p) {
  return path.resolve(p || process.env.LOCATORS_PATH || LAST || DEFAULT_REG_PATH);
}

function loadRegistry(p) {
  const resolved = resolveRegistryPath(p);
  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const files = fs.readdirSync(resolved).filter(f => f.endsWith('.json'));
      const merged = {};
      for (const f of files) {
        const raw = fs.readFileSync(path.join(resolved, f), 'utf-8');
        Object.assign(merged, JSON.parse(raw));
      }
      CACHE = merged;
      LAST = resolved;
      return CACHE;
    }
  } catch {}
  const regPath = resolved;
  const abs = resolveRegistryPath(p);
  if (CACHE && LAST === abs) return CACHE;

  if (!fs.existsSync(abs)) {
    throw new Error(
      `Locator registry not found at: ${abs}\n` +
      `Set process.env.LOCATORS_PATH, call setRegistryPath(...), or pass a path to loadRegistry()/getSpec().`
    );
  }

  const raw = fs.readFileSync(abs, 'utf8');
  try {
    CACHE = JSON.parse(raw);
    LAST  = abs;
    return CACHE;
  } catch (e) {
    const m = String(e.message).match(/position (\d+)/);
    const pos = m ? Number(m[1]) : 0;
    const around = raw.slice(Math.max(0, pos - 60), pos + 60);
    throw new Error(`Failed to parse locator registry JSON at ${abs}\n${e.message}\n--- around ---\n${around}\n--------------`);
  }
}

function clearRegistryCache() { CACHE = null; LAST = null; }

function setRegistryPath(p) {
  const abs = resolveRegistryPath(p);
  process.env.LOCATORS_PATH = abs;
  clearRegistryCache();
  return abs;
}

function getSpec(key, { registryPath } = {}) {
  const reg = loadRegistry(registryPath);
  const spec = reg[key];
  if (!spec) throw new Error(`Locator key not found: "${key}" in ${LAST}`);
  return spec;
}

function getAllKeys({ registryPath } = {}) {
  const reg = loadRegistry(registryPath);
  return Object.keys(reg);
}

// Back-compat: exported `registryPath` property (live getter)
Object.defineProperty(module.exports, 'registryPath', {
  enumerable: true,
  get() { return resolveRegistryPath(); }
});

module.exports.loadRegistry        = loadRegistry;
module.exports.getSpec             = getSpec;
module.exports.getAllKeys          = getAllKeys;
module.exports.clearRegistryCache  = clearRegistryCache;
module.exports.setRegistryPath     = setRegistryPath;
module.exports.resolveRegistryPath = resolveRegistryPath;
