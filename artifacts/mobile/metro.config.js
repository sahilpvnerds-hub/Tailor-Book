const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

// pnpm monorepo: Metro needs to see the workspace root, the .pnpm virtual
// store, and the local node_modules so it can resolve workspace:* packages
// (e.g. @workspace/api-client) AND transitive deps that pnpm does not hoist
// into every package (e.g. @expo/metro-runtime).
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const pnpmStore = path.resolve(workspaceRoot, "node_modules", ".pnpm");

const config = getDefaultConfig(projectRoot);

// 1. Watch every file under the workspace root
config.watchFolders = [workspaceRoot];

// 2. Metro's resolver must know where pnpm hoists node_modules
const nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. pnpm's isolated linker leaves transitive deps in `.pnpm/<name>@<version>/node_modules/<name>`.
//    With disableHierarchicalLookup, Metro can only see what we list, so we
//    also surface every `.../node_modules/<name>` directory under .pnpm.
if (fs.existsSync(pnpmStore)) {
  for (const entry of fs.readdirSync(pnpmStore)) {
    const nm = path.resolve(pnpmStore, entry, "node_modules");
    if (fs.existsSync(nm)) nodeModulesPaths.push(nm);
  }
}

config.resolver.nodeModulesPaths = nodeModulesPaths;

// 4. Force Metro to use the single hoisted react copy (avoids "Invalid hook call")
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
