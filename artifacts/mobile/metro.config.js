const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Add workspace root for monorepo support
const workspaceRoot = path.resolve(projectRoot, "../..");
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

module.exports = config;
