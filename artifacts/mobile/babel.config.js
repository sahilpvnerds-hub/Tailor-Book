module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { unstable_transformImportMeta: true }]
    ],
    plugins: [
      // Force JSX transform for ALL files — expo-router/build/ ships .js files
      // with raw JSX that preset-expo doesn't always transform in EAS builds.
      ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }],

      function () {
        return {
           visitor: {
            MemberExpression(path) {
              if (
                path.node.object.type === "MemberExpression" &&
                path.node.object.object.name === "process" &&
                path.node.object.property.name === "env"
              ) {
                if (path.node.property.name === "EXPO_ROUTER_APP_ROOT") {
                  path.replaceWith({ type: "StringLiteral", value: "../../app" });
                } else if (path.node.property.name === "EXPO_ROUTER_IMPORT_MODE") {
                  path.replaceWith({ type: "StringLiteral", value: "sync" });
                }
              }
            }
          }
        };
      },
      "react-native-worklets/plugin", // MUST be last per react-native-reanimated docs
    ],
    overrides: [
      {
        // Only TS/TSX files get private-field transforms — reanimated/worklets
        // internals use #privateField syntax that hermesc can't compile.
        test: /\.tsx?$/,
        plugins: [
          ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
          ["@babel/plugin-transform-class-properties", { loose: true }],
          ["@babel/plugin-transform-private-methods", { loose: true }],
          ["@babel/plugin-transform-private-property-in-object", { loose: true }],
        ],
      },
    ],
  };
};
