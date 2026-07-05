module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      function () {
        return {
          visitor: {
            MemberExpression(path) {
              if (
                path.node.object.type === "MemberExpression" &&
                path.node.object.object.name === "process" &&
                path.node.object.property.name === "env" &&
                path.node.property.name === "EXPO_ROUTER_APP_ROOT"
              ) {
                path.replaceWith({ type: "StringLiteral", value: "../../app" });
              }
            }
          }
        };
      },
      "react-native-worklets/plugin", // MUST be last per react-native-reanimated docs
    ],
  };
};
