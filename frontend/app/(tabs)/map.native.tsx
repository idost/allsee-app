import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, Region } from "react-native-maps";

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

const DEFAULT_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

function regionToBbox(region: Region) {
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

export default function MapScreen() {
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const singles = useMemo(() => streams.filter((s) => !s.event_id), [streams]);

  const loadLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setRegion((r) => ({ ...r, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
      }
    } catch {}
  }, []);

  const fetchData = useCallback(async (r: Region) => {
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
      await fetchData(region);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchData, region]);

  useEffect(() => {
    loadLocation();
    load();
    intervalRef.current && clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchData(region).catch(() => {}), 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegionChangeComplete = useCallback((r: Region) => {
    setRegion(r);
    fetchData(r).catch(() => {});
  }, [fetchData]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="map-outline" color={COLORS.text} size={22} />
        <Text style={styles.headerText}>Live Map</Text>
        <TouchableOpacity onPress={() => fetchData(region)} style={{ marginLeft: "auto" }}>
          <Ionicons name="refresh" color={COLORS.meta} size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.blue} />
          <Text style={styles.meta}>Loading map…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>Error: {error}</Text>
        </View>
      ) : (
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation
        >
          {singles.map((s: any) => (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={`@${s.user_id}`}
              description={`Live stream`}
            >
              <View style={[styles.pin, { backgroundColor: COLORS.blue }]} />
            </Marker>
          ))}

          {events.map((e: any) => {
            const color = e.stream_count >= 5 ? COLORS.amber : COLORS.violet;
            return (
              <Marker
                key={e.id}
                coordinate={{ latitude: e.centroid_lat, longitude: e.centroid_lng }}
                title={`Event`}
                description={`${e.stream_count} POVs`}
              >
                <View style={[styles.cluster, { borderColor: color }]}> 
                  <View style={[styles.clusterInner, { backgroundColor: color }]}> 
                    <Text style={styles.clusterText}>{e.stream_count}</Text>
                  </View>
                </View>
              </Marker>
            );
          })}
        </MapView>
      )}

      <View style={styles.footer}>
        <Text style={styles.meta}>LIVE NOW</Text>
        <Text style={styles.meta}>{events.length} events • {streams.length} streams</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { zIndex: 2, position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#00000066", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { color: COLORS.text, fontSize: 18, marginLeft: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: COLORS.danger },
  pin: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#ffffff" },
  cluster: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: "#00000099" },
  clusterInner: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  clusterText: { color: "#fff", fontWeight: "700" },
  footer: { zIndex: 2, position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#00000066", paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
  meta: { color: COLORS.meta },
});
