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

      // Replace process.env references for expo-router (safe, no-op if not present)
      ["./babel-plugin-transform-env.js"],
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
