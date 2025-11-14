import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const COLORS = {
  bg: "#0A0A0A",
  surface: "#1A1A1A",
  blue: "#4D9FFF",
  violet: "#9D4DFF",
  amber: "#FFB84D",
  text: "#FFFFFF",
  meta: "#A0A0A0",
  danger: "#FF4D4D",
};

export default function MapScreenWeb() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const singles = useMemo(() => streams.filter((s) => !s.event_id), [streams]);

  const fetchData = useCallback(async () => {
    const [evRes, stRes] = await Promise.all([
      fetch(`/api/events/live`),
      fetch(`/api/streams/live`),
    ]);
    if (!evRes.ok) throw new Error(`Events ${evRes.status}`);
    if (!stRes.ok) throw new Error(`Streams ${stRes.status}`);
    const ev = await evRes.json();
    const st = await stRes.json();
    setEvents(ev);
    setStreams(st.streams ?? []);
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      await fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    load();
    intervalRef.current && clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchData().catch(() => {}), 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="map-outline" color={COLORS.text} size={22} />
        <Text style={styles.headerText}>Live Map (Web List)</Text>
        <TouchableOpacity onPress={load} style={{ marginLeft: "auto" }}>
          <Ionicons name="refresh" color={COLORS.meta} size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.blue} />
          <Text style={styles.meta}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>Error: {error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {events.map((e) => (
            <View key={e.id} style={styles.card}>
              <Text style={styles.title}>Event • {e.stream_count} POVs</Text>
              <Text style={styles.metaSmall}>Created: {new Date(e.created_at).toLocaleString()}</Text>
            </View>
          ))}
          {singles.map((s) => (
            <View key={s.id} style={styles.card}>
              <Text style={styles.title}>Single Stream • @{s.user_id}</Text>
            </View>
          ))}
          {events.length === 0 && singles.length === 0 && (
            <View style={styles.center}><Text style={styles.meta}>No live data yet</Text></View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { position: "sticky", top: 0, backgroundColor: "#00000066", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { color: COLORS.text, fontSize: 18, marginLeft: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: COLORS.danger },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 12 },
  title: { color: COLORS.text, fontSize: 16 },
  meta: { color: COLORS.meta },
  metaSmall: { color: COLORS.meta, fontSize: 12, marginTop: 6 },
});
