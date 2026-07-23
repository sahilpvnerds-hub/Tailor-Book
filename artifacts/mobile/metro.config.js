const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Add workspace root for local monorepo support
// Skip on EAS (EAS builds from a clean tarball, no workspace needed)
if (!process.env.EAS_BUILD) {
  const workspaceRoot = path.resolve(projectRoot, "../..");
  config.watchFolders = [...(config.watchFolders || []), workspaceRoot];
}

module.exports = config;
