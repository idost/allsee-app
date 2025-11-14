import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import type { MapEvent, MapStream } from "./NativeMap.native";

export default function NativeMapWeb({
  events,
  streams,
  onPressEvent,
  onPressStream,
}: {
  events: MapEvent[];
  streams: MapStream[];
  onPressEvent?: (id: string) => void;
  onPressStream?: (id: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {events.map((e) => (
          <Pressable key={e.id} onPress={() => onPressEvent && onPressEvent(e.id)} style={styles.card}>
            <Text style={styles.title}>Event • {e.stream_count} POVs</Text>
            <Text style={styles.metaSmall}>Created: {new Date(e.created_at).toLocaleString()}</Text>
          </Pressable>
        ))}
        {streams.map((s) => (
          <Pressable key={s.id} onPress={() => onPressStream && onPressStream(s.id)} style={styles.card}>
            <Text style={styles.title}>Single Stream • @{s.user_id}</Text>
          </Pressable>
        ))}
        {events.length === 0 && streams.length === 0 && (
          <View style={styles.center}><Text style={styles.meta}>No live data yet</Text></View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1A1A1A", borderRadius: 12, padding: 16, marginBottom: 12 },
  title: { color: "#FFFFFF", fontSize: 16 },
  meta: { color: "#A0A0A0" },
  metaSmall: { color: "#A0A0A0", fontSize: 12, marginTop: 6 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
