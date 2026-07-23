#!/usr/bin/env node
// postinstall patch for expo@54.x — npm publishes expo with a broken
// package.json (missing exports + main points to TS source). This script
// fixes it after every install so EAS cloud builds also work.
const fs = require('fs');
const path = require('path');

const expoPkg = path.resolve(__dirname, '..', 'node_modules', 'expo', 'package.json');
if (!fs.existsSync(expoPkg)) {
  console.log('[patch-expo] expo not found, skipping');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(expoPkg, 'utf8'));

// Fix main to point to built JS instead of TS source
if (pkg.main === 'src/Expo.ts') {
  pkg.main = 'build/Expo.js';
  console.log('[patch-expo] fixed main: src/Expo.ts -> build/Expo.js');
}

// Add exports field for internal subpaths if missing or empty
const neededExports = {
  './internal/unstable-autolinking-exports': {
    types: './internal/unstable-autolinking-exports.d.ts',
    default: './internal/unstable-autolinking-exports.js',
  },
  './internal/unstable-expo-updates-cli-exports': {
    types: './internal/unstable-expo-updates-cli-exports.d.ts',
    default: './internal/unstable-expo-updates-cli-exports.js',
  },
  './internal/install-global': {
    types: './internal/install-global.d.ts',
    default: './internal/install-global.js',
  },
  './internal/async-require-module': {
    default: './internal/async-require-module.js',
  },
  './internal/babel-preset': {
    types: './internal/babel-preset.d.ts',
    default: './internal/babel-preset.js',
  },
};

if (!pkg.exports || Object.keys(pkg.exports).length === 0) {
  pkg.exports = { '.': { types: './types/Expo.d.ts', default: './build/Expo.js' } };
  console.log('[patch-expo] added exports field');
}

for (const [subpath, mapping] of Object.entries(neededExports)) {
  if (!pkg.exports[subpath]) {
    pkg.exports[subpath] = mapping;
    console.log(`[patch-expo] added exports: ${subpath}`);
  }
}

fs.writeFileSync(expoPkg, JSON.stringify(pkg, null, 2) + '\n');
console.log('[patch-expo] done');
