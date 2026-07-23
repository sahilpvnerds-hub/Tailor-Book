module.exports = function () {
  const replacements = {
    EXPO_ROUTER_APP_ROOT: "../../app",
    EXPO_ROUTER_IMPORT_MODE: "sync",
  };

  return {
    visitor: {
      MemberExpression(path) {
        if (
          path.node.object.type === "MemberExpression" &&
          path.node.object.object &&
          path.node.object.object.name === "process" &&
          path.node.object.property &&
          path.node.object.property.name === "env"
        ) {
          const key = path.node.property.name;
          if (replacements[key]) {
            path.replaceWith({
              type: "StringLiteral",
              value: replacements[key],
            });
          }
        }
      },
    },
  };
};
