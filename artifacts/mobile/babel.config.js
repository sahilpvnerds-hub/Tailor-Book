module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { unstable_transformImportMeta: true }]
    ],
    plugins: [
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
        // Only TS/TSX files — reanimated/worklets private fields are in .ts source.
        // .js files (like expo-router/entry.js) must go through preset-expo's
        // JSX transform unmodified.
        test: /\.tsx?$/,
        plugins: [
          // TypeScript FIRST — required before class-properties plugin
          // (class-properties crashes on TS declare fields like `context!: Type`)
          ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
          ["@babel/plugin-transform-class-properties", { loose: true }],
          ["@babel/plugin-transform-private-methods", { loose: true }],
          ["@babel/plugin-transform-private-property-in-object", { loose: true }],
        ],
      },
    ],
  };
};
