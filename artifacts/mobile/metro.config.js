const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Add workspace root for local monorepo support
// Skip on EAS (EAS builds from a clean tarball on Linux, no workspace needed)
if (!process.env.EAS_BUILD) {
  const workspaceRoot = path.resolve(projectRoot, "../..");
  config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

  // Also add workspace node_modules for local development
  const workspaceNodeModules = path.resolve(workspaceRoot, "node_modules");
  if (fs.existsSync(workspaceNodeModules)) {
    config.resolver.nodeModulesPaths = [
      ...(config.resolver.nodeModulesPaths || []),
      workspaceNodeModules,
      path.resolve(projectRoot, "node_modules"),
    ];
  }
}

module.exports = config;
