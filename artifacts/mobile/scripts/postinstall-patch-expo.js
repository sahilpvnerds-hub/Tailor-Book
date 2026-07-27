#!/usr/bin/env node
// postinstall patch for expo@54.x
// expo@54.0.36 is broken: empty "exports" field + missing internal modules.
// Searches BOTH the package dir (EAS) and the project root (local dev).
const fs = require('fs');
const path = require('path');

const CWD = process.cwd();

// Find project root (where pnpm-workspace.yaml lives)
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

// On EAS: pnpm installs in CWD/node_modules/
// On local dev: pnpm installs in PROJECT_ROOT/node_modules/
const SEARCH_ROOTS = [CWD, PROJECT_ROOT].filter((v, i, a) => a.indexOf(v) === i);

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

  for (const root of SEARCH_ROOTS) {
    const nm = path.join(root, 'node_modules');
    if (!fs.existsSync(nm)) continue;

    // Check pnpm virtual store directly (fast + reliable)
    const pnpmDir = path.join(nm, '.pnpm');
    if (fs.existsSync(pnpmDir)) {
      try {
        for (const entry of fs.readdirSync(pnpmDir)) {
          if (entry.startsWith('expo@')) {
            const expoDir = path.join(pnpmDir, entry, 'node_modules', 'expo');
            if (fs.existsSync(path.join(expoDir, 'package.json'))) {
              dirs.push(expoDir);
            }
          }
        }
      } catch (e) {}
    }

    // Also walk the full tree for any other expo dirs
    const walk = (dir, maxDepth = 8, depth = 0) => {
      if (depth > maxDepth) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch (e) { return; }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const full = path.join(dir, entry.name);
        if (entry.name === 'expo') {
          const pkgPath = path.join(full, 'package.json');
          if (fs.existsSync(pkgPath)) dirs.push(full);
        } else {
          walk(full, maxDepth, depth + 1);
        }
      }
    };

    walk(nm, 0);
  }

  // Deduplicate
  return [...new Set(dirs)];
}

function patchExpoPkg(expoDir) {
  const pkgPath = path.join(expoDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.exports && Object.keys(pkg.exports).length === 0) {
    delete pkg.exports;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  [patch-expo] removed empty exports: ${path.relative(CWD, expoDir)}`);
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
}

const dirs = findExpoDirs();
console.log(`[patch-expo] found ${dirs.length} expo dir(s)`);
for (const dir of dirs) {
  patchExpoPkg(dir);
  patchStubs(dir);
}
console.log('[patch-expo] done');
