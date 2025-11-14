import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent } from "react-native";

const COLORS = {
  text: "#FFFFFF",
  meta: "#A0A0A0",
  track: "#2A2A2A",
  handle: "#4D9FFF",
};

export type TimelineScrubberProps = {
  minutesOffset: number; // 0..1440 (0 = NOW)
  onChange: (minutesOffset: number) => void;
};

export default function TimelineScrubber({ minutesOffset, onChange }: TimelineScrubberProps) {
  const [width, setWidth] = useState(0);
  const clamped = Math.max(0, Math.min(24 * 60, minutesOffset));
  const ratio = width > 0 ? clamped / (24 * 60) : 0;
  const left = width * ratio;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const onPressTrack = (e: any) => {
    if (!width) return;
    const x = e.nativeEvent.locationX;
    const newRatio = Math.max(0, Math.min(1, x / width));
    const newMinutes = Math.round(newRatio * 24 * 60);
    onChange(newMinutes);
  };

  const label = useMemo(() => {
    if (clamped === 0) return "LIVE NOW";
    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  }, [clamped]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Text style={styles.meta}>NOW</Text>
        <Text style={styles.meta}>24H</Text>
      </View>
      <Pressable onPress={onPressTrack} onLayout={onLayout} style={styles.track}>
        <View style={[styles.handle, { left: Math.max(0, Math.min(width - 16, left - 8)) }]} />
      </Pressable>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  meta: { color: COLORS.meta, fontSize: 12 },
  label: { color: COLORS.text, textAlign: "center", marginTop: 6 },
  track: { height: 8, borderRadius: 4, backgroundColor: COLORS.track, position: "relative" },
  handle: { position: "absolute", top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.handle },
});
