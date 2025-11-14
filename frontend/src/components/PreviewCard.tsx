import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Colors, Spacing } from "../theme";

export type PreviewCardProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryText?: string;
  secondaryText?: string;
};

export default function PreviewCard({ title, subtitle, meta, onPrimary, onSecondary, primaryText = "Watch", secondaryText = "Open" }: PreviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <View style={styles.actions}>
        {onPrimary ? (
          <TouchableOpacity onPress={onPrimary} style={styles.primaryBtn}><Text style={styles.primaryText}>{primaryText}</Text></TouchableOpacity>
        ) : null}
        {onSecondary ? (
          <TouchableOpacity onPress={onSecondary} style={styles.secondaryBtn}><Text style={styles.secondaryText}>{secondaryText}</Text></TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.lg },
  title: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  subtitle: { color: Colors.text, opacity: 0.9, marginTop: 4 },
  meta: { color: Colors.meta, marginTop: 6 },
  actions: { flexDirection: "row", gap: Spacing.sm },
  primaryBtn: { backgroundColor: Colors.blue, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  primaryText: { color: Colors.text, fontWeight: "700" },
  secondaryBtn: { borderColor: Colors.blue, borderWidth: 2, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  secondaryText: { color: Colors.blue, fontWeight: "700" },
});
