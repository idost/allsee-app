import React from "react";
import { Redirect } from "expo-router";

// Native index route simply redirects to the actual Map route.
export default function IndexNativeRedirect() {
  return <Redirect href="/(tabs)/map" />;
}
