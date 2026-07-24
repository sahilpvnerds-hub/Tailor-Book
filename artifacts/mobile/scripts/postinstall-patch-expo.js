#!/usr/bin/env node
// postinstall patch for expo@54.x
// Patches BOTH the local node_modules AND the pnpm virtual store at workspace root
const fs = require('fs');
const path = require('path');

const scriptDir = __dirname;
let rootDir = path.resolve(scriptDir, '..');

function findWorkspaceRoot() {
  let dir = rootDir;
  const maxDepth = 10;
  let depth = 0;
  while (dir && depth < maxDepth) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    depth++;
  }
  return rootDir;
}

const workspaceRoot = findWorkspaceRoot();
console.log(`[patch-expo] workspace root: ${workspaceRoot}`);

function patchExpoPkg(expoDir) {
  const pkgPath = path.join(expoDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.exports && Object.keys(pkg.exports).length === 0) {
    delete pkg.exports;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`[patch-expo] removed empty exports: ${expoDir}`);
    return true;
  }
  return false;
}

function findExpoDirs(root) {
  const dirs = [];
  // Root node_modules/expo
  const rootExpo = path.join(root, 'node_modules', 'expo');
  if (fs.existsSync(rootExpo)) dirs.push(rootExpo);
  // pnpm virtual store
  const pnpmDir = path.join(root, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir)) {
      if (entry.startsWith('expo@')) {
        const expoDir = path.join(pnpmDir, entry, 'node_modules', 'expo');
        if (fs.existsSync(expoDir) && fs.existsSync(path.join(expoDir, 'package.json'))) {
          dirs.push(expoDir);
        }
      }
    }
  }
  return dirs;
}

function patchInternalStubs(expoDir) {
  const internalDir = path.join(expoDir, 'internal');
  if (!fs.existsSync(internalDir)) return;

  const stubContent = `module.exports = {
  expoConfigPlugins: [],
  autolinkedPackages: [],
  withOpusDelegate: () => () => {},
};
`;

  const stubDts = `export const expoConfigPlugins: any[];
export const autolinkedPackages: any[];
export const withOpusDelegate: any;
`;

  const stubPath = path.join(internalDir, 'unstable-autolinking-exports.js');
  if (fs.existsSync(stubPath)) {
    const current = fs.readFileSync(stubPath, 'utf8');
    if (current.includes("require('expo-modules-autolinking/exports')")) {
      fs.writeFileSync(stubPath, stubContent);
      fs.writeFileSync(path.join(internalDir, 'unstable-autolinking-exports.d.ts'), stubDts);
      console.log(`[patch-expo] patched stub: ${expoDir}/internal/unstable-autolinking-exports.js`);
    }
  }
}

const expoDirs = findExpoDirs(workspaceRoot);
console.log(`[patch-expo] found ${expoDirs.length} expo dirs`);
for (const dir of expoDirs) {
  patchExpoPkg(dir);
  patchInternalStubs(dir);
}
console.log('[patch-expo] done');
