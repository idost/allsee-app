import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const API = {
  async getLiveEvents() {
    const res = await fetch(`/api/events/live`);
    if (!res.ok) throw new Error(`Failed to load events: ${res.status}`);
    return res.json();
  },
};

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await API.getLiveEvents();
      setEvents(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await API.getLiveEvents();
      setEvents(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="time-outline" color="#FFFFFF" size={22} />
        <Text style={styles.headerText}>Live Events</Text>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#4D9FFF" />
          <Text style={styles.meta}>Loading events…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>Error: {error}</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Ionicons name="flame-outline" color="#FFB84D" size={18} />
                <Text style={styles.title}>Event</Text>
              </View>
              <Text style={styles.meta}>Streams: {item.stream_count}</Text>
              <Text style={styles.meta}>Status: {item.status}</Text>
              <Text style={styles.meta}>Centroid: {item.centroid_lat.toFixed(5)}, {item.centroid_lng.toFixed(5)}</Text>
              <Text style={styles.metaSmall}>Created: {new Date(item.created_at).toLocaleString()}</Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Text style={styles.meta}>No live events found yet. Try going live!</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
  headerText: { color: "#FFFFFF", fontSize: 18, marginLeft: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: "#FF4D4D" },
  separator: { height: 12 },
  card: { backgroundColor: "#1A1A1A", borderRadius: 12, padding: 16 },
  title: { color: "#FFFFFF", fontSize: 16, marginLeft: 8 },
  meta: { color: "#A0A0A0", marginTop: 4 },
  metaSmall: { color: "#6f6f6f", marginTop: 4, fontSize: 12 },
});
