import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import NativeMap from "../../src/components/NativeMap";

const COLORS = {
  bg: "#0A0A0A",
  surface: "#1A1A1A",
  blue: "#4D9FFF",
  text: "#FFFFFF",
  meta: "#A0A0A0",
  danger: "#FF4D4D",
};

function regionToBbox(region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number; }) {
  const ne = {
    lat: region.latitude + region.latitudeDelta / 2,
    lng: region.longitude + region.longitudeDelta / 2,
  };
  const sw = {
    lat: region.latitude - region.latitudeDelta / 2,
    lng: region.longitude - region.longitudeDelta / 2,
  };
  return { ne: `${ne.lat},${ne.lng}`, sw: `${sw.lat},${sw.lng}` };
}

const DEFAULT_REGION = { latitude: 41.0082, longitude: 28.9784, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export default function MapRoute() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastRegionRef = useRef(DEFAULT_REGION);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const singles = useMemo(() => streams.filter((s) => !s.event_id), [streams]);

  const fetchData = useCallback(async (r = lastRegionRef.current) => {
    const { ne, sw } = regionToBbox(r);
    const [evRes, stRes] = await Promise.all([
      fetch(`/api/events/live?ne=${encodeURIComponent(ne)}&sw=${encodeURIComponent(sw)}`),
      fetch(`/api/streams/live?ne=${encodeURIComponent(ne)}&sw=${encodeURIComponent(sw)}`),
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData, load]);

  const onRegionChangeComplete = useCallback((r: any) => {
    lastRegionRef.current = r;
    fetchData(r).catch(() => {});
  }, [fetchData]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="map-outline" color={COLORS.text} size={22} />
        <Text style={styles.headerText}>Live Map</Text>
        <TouchableOpacity onPress={load} style={{ marginLeft: "auto" }}>
          <Ionicons name="refresh" color={COLORS.meta} size={20} />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.center}><ActivityIndicator color={COLORS.blue} /></View>
      )}
      {error && (
        <View style={styles.center}><Text style={styles.error}>Error: {error}</Text></View>
      )}

      <NativeMap
        events={events}
        streams={singles}
        onRegionChangeComplete={onRegionChangeComplete}
        initialRegion={DEFAULT_REGION as any}
        loading={loading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { zIndex: 2, position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#00000066", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { color: COLORS.text, fontSize: 18, marginLeft: 8 },
  center: { position: "absolute", top: 48, left: 0, right: 0, alignItems: "center" },
  error: { color: COLORS.danger },
});
