import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { apiGet } from "../../src/utils/api";

const COLORS = {
  bg: "#0A0A0A",
  surface: "#1A1A1A",
  blue: "#4D9FFF",
  text: "#FFFFFF",
  meta: "#A0A0A0",
  danger: "#FF4D4D",
};

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setLoading(true);
      const data = await apiGet<any>(`/api/events/${id}`);
      setEvent(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.blue} /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.error}>Error: {error}</Text></View>
      ) : event ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.title}>Event</Text>
          <Text style={styles.meta}>POVs: {event.event.stream_count}</Text>
          <Text style={styles.meta}>Status: {event.event.status}</Text>
          <Text style={styles.metaSmall}>Created: {new Date(event.event.created_at).toLocaleString()}</Text>

          <View style={{ height: 16 }} />
          <Text style={styles.title}>Streams</Text>
          {event.streams.map((s: any) => (
            <View key={s.id} style={styles.card}>
              <Text style={styles.meta}>@{s.user_id}</Text>
              <Text style={styles.metaSmall}>{s.status === 'live' ? 'Live' : 'Ended'}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.center}><Text style={styles.meta}>No data</Text></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.text, fontSize: 18, marginBottom: 8 },
  meta: { color: COLORS.meta, marginTop: 4 },
  metaSmall: { color: COLORS.meta, marginTop: 4, fontSize: 12 },
  error: { color: COLORS.danger },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginTop: 8 },
});
