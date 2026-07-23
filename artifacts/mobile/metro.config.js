const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const pnpmStore = path.resolve(workspaceRoot, "node_modules", ".pnpm");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

const nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

if (fs.existsSync(pnpmStore)) {
  for (const entry of fs.readdirSync(pnpmStore)) {
    const nm = path.resolve(pnpmStore, entry, "node_modules");
    if (fs.existsSync(nm)) nodeModulesPaths.push(nm);
  }
}

config.resolver.nodeModulesPaths = nodeModulesPaths;
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
