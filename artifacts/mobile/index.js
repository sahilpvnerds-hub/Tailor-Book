// Custom entry point for Expo Router to ensure routes are resolved statically.
import "@expo/metro-runtime";
import React from "react";
import { ExpoRoot } from "expo-router";
import { Head } from "expo-router/build/head";
import { renderRootComponent } from "expo-router/build/renderRootComponent";

export function App() {
  // Statically resolve all routes under the app directory
  const ctx = require.context("./app");
  return (
    <Head.Provider>
      <ExpoRoot context={ctx} />
    </Head.Provider>
  );
}

renderRootComponent(App);
