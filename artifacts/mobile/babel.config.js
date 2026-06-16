module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      "babel-plugin-react-compiler",
      "react-native-worklets/plugin", // MUST be last per react-native-reanimated docs
    ],
  };
};
