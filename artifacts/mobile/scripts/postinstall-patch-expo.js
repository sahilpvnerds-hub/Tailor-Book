#!/usr/bin/env node
// postinstall patch for expo@54.x
// expo@54.0.36 has empty "exports" + missing internal modules.
// This script finds ALL expo dirs and patches them.
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');

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
  const dirs = [];
  const rootNM = path.join(PROJECT_ROOT, 'node_modules');
  if (!fs.existsSync(rootNM)) return dirs;

  const walk = (dir, maxDepth = 8, depth = 0) => {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name === 'expo') {
        const pkgPath = path.join(full, 'package.json');
        if (fs.existsSync(pkgPath)) dirs.push(full);
      } else {
        walk(full, maxDepth, depth + 1);
      }
    }
  };

  walk(rootNM);
  return dirs;
}

function patchExpoPkg(expoDir) {
  const pkgPath = path.join(expoDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.exports && Object.keys(pkg.exports).length === 0) {
    delete pkg.exports;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  [patch-expo] removed empty exports: ${path.relative(PROJECT_ROOT, expoDir)}`);
  }
}

function patchStubs(expoDir) {
  const internalDir = path.join(expoDir, 'internal');
  if (!fs.existsSync(internalDir)) {
    try { fs.mkdirSync(internalDir, { recursive: true }); } catch (e) { return; }
  }

  const stubJs = path.join(internalDir, 'unstable-autolinking-exports.js');
  const stubDts = path.join(internalDir, 'unstable-autolinking-exports.d.ts');

  // Always write the stub - don't check content, just overwrite
  fs.writeFileSync(stubJs, STUB);
  fs.writeFileSync(stubDts, STUB_DTS);
  console.log(`  [patch-expo] patched stub: ${path.relative(PROJECT_ROOT, stubJs)}`);
}

const dirs = findExpoDirs();
console.log(`[patch-expo] found ${dirs.length} expo dir(s)`);
for (const dir of dirs) {
  patchExpoPkg(dir);
  patchStubs(dir);
}
console.log('[patch-expo] done');
