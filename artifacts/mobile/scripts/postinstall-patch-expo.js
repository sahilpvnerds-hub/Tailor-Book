#!/usr/bin/env node
// postinstall patch for expo@54.x — npm publishes expo@54.x with a broken
// package.json: the "exports" field is empty/absent, which blocks Node from
// resolving ANY subpath like "expo/internal/unstable-autolinking-exports",
// "expo/bin/cli.js", "expo/metro-config.js", etc.
//
// Instead of adding individual exports (whack-a-mole), we remove the empty
// exports field entirely so Node falls back to standard file-system resolution.
// This allows ALL subpaths to resolve as long as the file exists on disk.
const fs = require('fs');
const path = require('path');

const expoPkg = path.resolve(__dirname, '..', 'node_modules', 'expo', 'package.json');
if (!fs.existsSync(expoPkg)) {
  console.log('[patch-expo] expo not found, skipping');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(expoPkg, 'utf8'));

// Remove the broken empty exports field so Node resolves subpaths via filesystem
if (pkg.exports && Object.keys(pkg.exports).length === 0) {
  delete pkg.exports;
  fs.writeFileSync(expoPkg, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[patch-expo] removed empty exports field — subpath resolution restored');
} else if (pkg.exports && Object.keys(pkg.exports).length > 0) {
  // If already patched (has our entries), still remove — file-system is more robust
  delete pkg.exports;
  fs.writeFileSync(expoPkg, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[patch-expo] removed exports field (was previously patched)');
} else {
  console.log('[patch-expo] no exports field, already OK');
}
