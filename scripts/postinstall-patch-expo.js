#!/usr/bin/env node
// Patch expo@54.x broken package.json: removes empty "exports" field
// so Node can resolve internal subpaths like expo/internal/unstable-autolinking-exports
const fs = require('fs');
const path = require('path');

const expoPkg = path.resolve(__dirname, '..', 'node_modules', 'expo', 'package.json');
if (!fs.existsSync(expoPkg)) {
  console.log('[patch-expo] expo not found, skipping');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(expoPkg, 'utf8'));

if (pkg.exports && Object.keys(pkg.exports).length === 0) {
  delete pkg.exports;
  fs.writeFileSync(expoPkg, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[patch-expo] removed empty exports field');
} else if (!pkg.exports) {
  console.log('[patch-expo] no exports field, already OK');
} else {
  console.log('[patch-expo] exports has content, leaving as-is');
}
