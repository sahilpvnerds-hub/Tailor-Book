#!/usr/bin/env node
// postinstall patch for expo@54.x
// expo@54.0.36 is broken: empty "exports" field + missing internal modules.
// This script patches ALL expo directories found anywhere in the project.
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');

const EXPORT_STUB = `module.exports = {
  makeCachedDependenciesLinker: () => ({ scan: () => ({}) }),
  scanExpoModuleResolutionsForPlatform: () => Promise.resolve([]),
  scanDependencyResolutionsForPlatform: () => Promise.resolve([]),
  mergeLinkingOptionsAsync: () => ({}),
  queryAutolinkingModulesFromProjectAsync: () => Promise.resolve([]),
  findProjectRootSync: () => process.cwd(),
  resolveSearchPathsAsync: () => Promise.resolve([]),
};
`;

const EXPORT_DTS = `export const makeCachedDependenciesLinker: any;
export const scanExpoModuleResolutionsForPlatform: any;
export const scanDependencyResolutionsForPlatform: any;
export const mergeLinkingOptionsAsync: any;
export const queryAutolinkingModulesFromProjectAsync: any;
export const findProjectRootSync: any;
export const resolveSearchPathsAsync: any;
`;

function findExpoDirs() {
  const dirs = new Set();
  // Walk node_modules from project root
  const rootNM = path.join(PROJECT_ROOT, 'node_modules');
  if (!fs.existsSync(rootNM)) return Array.from(dirs);

  // Use find equivalent - walk all directories looking for expo/package.json
  const walk = (dir, maxDepth = 6, depth = 0) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'expo') {
          const pkgPath = path.join(full, 'package.json');
          if (fs.existsSync(pkgPath)) {
            dirs.add(full);
          }
        } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          // Skip non-node_modules dirs at shallow depth
        } else if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          walk(full, maxDepth, depth + 1);
        }
      }
    }
  };

  // Walk node_modules tree
  walk(rootNM);

  // Also check common pnpm virtual store locations
  const pnpmDirs = [
    path.join(rootNM, '.pnpm'),
    path.join(PROJECT_ROOT, '.pnpm-store'),
  ];
  for (const pnpmDir of pnpmDirs) {
    if (!fs.existsSync(pnpmDir)) continue;
    try {
      for (const entry of fs.readdirSync(pnpmDir)) {
        if (entry.startsWith('expo@')) {
          const expoDir = path.join(pnpmDir, entry, 'node_modules', 'expo');
          const pkgPath = path.join(expoDir, 'package.json');
          if (fs.existsSync(pkgPath)) dirs.add(expoDir);
        }
      }
    } catch (e) {}
  }

  return Array.from(dirs);
}

function patchExpoPkg(expoDir) {
  const pkgPath = path.join(expoDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;

  const content = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(content);

  if (pkg.exports && Object.keys(pkg.exports).length === 0) {
    delete pkg.exports;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  [patch-expo] removed empty exports: ${path.relative(PROJECT_ROOT, expoDir)}`);
    return true;
  }
  return false;
}

function patchInternalStubs(expoDir) {
  const internalDir = path.join(expoDir, 'internal');
  if (!fs.existsSync(internalDir)) {
    try { fs.mkdirSync(internalDir, { recursive: true }); } catch (e) { return; }
  }

  const stubJs = path.join(internalDir, 'unstable-autolinking-exports.js');
  const stubDts = path.join(internalDir, 'unstable-autolinking-exports.d.ts');

  let patched = false;
  if (fs.existsSync(stubJs)) {
    const current = fs.readFileSync(stubJs, 'utf8');
    if (current.includes('require(') || current.includes('module.exports = {}')) {
      fs.writeFileSync(stubJs, EXPORT_STUB);
      patched = true;
    }
  } else {
    fs.writeFileSync(stubJs, EXPORT_STUB);
    patched = true;
  }

  if (!fs.existsSync(stubDts) || patched) {
    fs.writeFileSync(stubDts, EXPORT_DTS);
  }

  if (patched) {
    console.log(`  [patch-expo] patched internal stubs: ${path.relative(PROJECT_ROOT, expoDir)}`);
  }
}

// Main
console.log('[patch-expo] scanning for expo@54.x packages...');
const expoDirs = findExpoDirs();
console.log(`[patch-expo] found ${expoDirs.length} expo package(s)`);

let patchedCount = 0;
for (const expoDir of expoDirs) {
  const pkgPatched = patchExpoPkg(expoDir);
  patchInternalStubs(expoDir);
  if (pkgPatched) patchedCount++;
}

console.log(`[patch-expo] done (patched ${patchedCount} package.json, ${expoDirs.length} internal stubs)`);
