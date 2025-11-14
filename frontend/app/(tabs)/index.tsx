// Fallback generic file kept intentionally minimal. Platform-specific files exist:
// - index.native.tsx (iOS/Android) renders the interactive map
// - index.web.tsx (Web) shows a live list to avoid native-only imports
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function Placeholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0A" },
  text: { color: "#A0A0A0" },
});
