#!/usr/bin/env node
// postinstall patch for expo@54.x — npm publishes expo@54.x with a broken
// package.json: the "exports" field is empty/absent, which blocks Node from
// resolving internal subpaths like "expo/internal/unstable-autolinking-exports".
// @expo/prebuild-config depends on this subpath, so EAS cloud builds fail.
// This script patches package.json and creates stub files after every install.
const fs = require('fs');
const path = require('path');

const expoPkg = path.resolve(__dirname, '..', 'node_modules', 'expo', 'package.json');
if (!fs.existsSync(expoPkg)) {
  console.log('[patch-expo] expo not found, skipping');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(expoPkg, 'utf8'));

// Add exports entries for all subpaths that tools need
const neededExports = {
  '.': {
    types: './types/Expo.d.ts',
    default: './build/Expo.js',
  },
  './bin/cli': { default: './bin/cli' },
  './bin/cli.js': { default: './bin/cli' },
  './bin/autolinking': { default: './bin/autolinking' },
  './bin/fingerprint': { default: './bin/fingerprint' },
  './config-plugins': { default: './config-plugins.js' },
  './config-plugins.js': { default: './config-plugins.js' },
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
  pkg.exports = {};
  console.log('[patch-expo] initialized exports field');
}

let patched = false;
for (const [subpath, mapping] of Object.entries(neededExports)) {
  if (!pkg.exports[subpath]) {
    pkg.exports[subpath] = mapping;
    patched = true;
    console.log(`[patch-expo] added exports: ${subpath}`);
  }
}

if (patched) {
  fs.writeFileSync(expoPkg, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[patch-expo] done');
} else {
  console.log('[patch-expo] already patched, skipping');
}

// Create build/Expo.js stub (expo@54.x ships without compiled JS)
const expoBuildJs = path.resolve(path.dirname(expoPkg), 'build', 'Expo.js');
if (!fs.existsSync(expoBuildJs)) {
  fs.mkdirSync(path.dirname(expoBuildJs), { recursive: true });
  fs.writeFileSync(
    expoBuildJs,
    "module.exports = require('../src/Expo');\n"
  );
  console.log('[patch-expo] created build/Expo.js stub');
}
