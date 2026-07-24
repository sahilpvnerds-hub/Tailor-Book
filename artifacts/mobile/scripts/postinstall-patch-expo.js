#!/usr/bin/env node
// postinstall patch for expo@54.x
// expo@54.0.36 is broken: empty "exports" field + missing internal modules.
const fs = require('fs');
const path = require('path');

// Find project root by walking up from script location
function findProjectRoot() {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, '..', '..', '..');
}

const PROJECT_ROOT = findProjectRoot();

const STUB = `module.exports = {
  makeCachedDependenciesLinker: () => ({ scan: () => ({}) }),
  scanExpoModuleResolutionsForPlatform: () => Promise.resolve([]),
  scanDependencyResolutionsForPlatform: () => Promise.resolve([]),
  mergeLinkingOptionsAsync: () => ({}),
  queryAutolinkingModulesFromProjectAsync: () => Promise.resolve([]),
  findProjectRootSync: () => process.cwd(),
  resolveSearchPathsAsync: () => Promise.resolve([]),
};
`;

const STUB_DTS = `export const makeCachedDependenciesLinker: any;
export const scanExpoModuleResolutionsForPlatform: any;
export const scanDependencyResolutionsForPlatform: any;
export const mergeLinkingOptionsAsync: any;
export const queryAutolinkingModulesFromProjectAsync: any;
export const findProjectRootSync: any;
export const resolveSearchPathsAsync: any;
`;

function findExpoDirs() {
  const dirs = new Set();
  const rootNM = path.join(PROJECT_ROOT, 'node_modules');
  if (!fs.existsSync(rootNM)) return Array.from(dirs);

  // Walk ALL directories - don't skip anything
  const MAX_DEPTH = 8;
  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);

      if (entry.name === 'expo') {
        const pkgPath = path.join(full, 'package.json');
        if (fs.existsSync(pkgPath)) dirs.add(full);
      } else {
        walk(full, depth + 1);
      }
    }
  };

  walk(rootNM, 0);
  return Array.from(dirs);
}

function patchExpoPkg(expoDir) {
  const pkgPath = path.join(expoDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.exports && Object.keys(pkg.exports).length === 0) {
    delete pkg.exports;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  [patch-expo] removed empty exports: ${path.relative(PROJECT_ROOT, expoDir)}`);
    return true;
  }
  return false;
}

function patchStubs(expoDir) {
  const internalDir = path.join(expoDir, 'internal');
  if (!fs.existsSync(internalDir)) {
    try { fs.mkdirSync(internalDir, { recursive: true }); } catch (e) { return; }
  }

  fs.writeFileSync(path.join(internalDir, 'unstable-autolinking-exports.js'), STUB);
  fs.writeFileSync(path.join(internalDir, 'unstable-autolinking-exports.d.ts'), STUB_DTS);
  console.log(`  [patch-expo] patched stub: ${path.relative(PROJECT_ROOT, internalDir)}`);
}

const dirs = findExpoDirs();
console.log(`[patch-expo] root: ${PROJECT_ROOT}`);
console.log(`[patch-expo] found ${dirs.length} expo dir(s)`);
let patched = 0;
for (const dir of dirs) {
  if (patchExpoPkg(dir)) patched++;
  patchStubs(dir);
}
console.log(`[patch-expo] done`);
