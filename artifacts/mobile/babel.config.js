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
      "react-native-worklets/plugin",
    ],
    overrides: [
      {
        test: /\.tsx?$/,
        plugins: [
          ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
        ],
      },
    ],
  };
};
