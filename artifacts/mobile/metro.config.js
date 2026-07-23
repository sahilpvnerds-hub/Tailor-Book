const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

const workspaceRoot = path.resolve(projectRoot, "../..");
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

const nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const pnpmStore = path.resolve(workspaceRoot, "node_modules", ".pnpm");
if (fs.existsSync(pnpmStore)) {
  for (const entry of fs.readdirSync(pnpmStore)) {
    const nm = path.resolve(pnpmStore, entry, "node_modules");
    if (fs.existsSync(nm)) nodeModulesPaths.push(nm);
  }
}

// Convert paths to file:// URLs so EAS/ESM loader accepts them on Windows
config.resolver.nodeModulesPaths = nodeModulesPaths.map((p) =>
  pathToFileURL(p).href
);
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
