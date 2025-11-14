import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import NativeMap from "../../src/components/NativeMap";
import { useRouter } from "expo-router";
import { apiGet } from "../../src/utils/api";
import TimelineScrubber from "../../src/components/TimelineScrubber";
import PreviewCard from "../../src/components/PreviewCard";

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

type Selected = { type: "event"; id: string; meta?: string } | { type: "stream"; id: string; meta?: string } | null;

export default function MapRoute() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastRegionRef = useRef(DEFAULT_REGION);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [minutesOffset, setMinutesOffset] = useState(0); // 0 = LIVE
  const [selected, setSelected] = useState<Selected>(null);

  const singles = useMemo(() => streams.filter((s) => !s.event_id), [streams]);

  const fetchLive = useCallback(async (r = lastRegionRef.current) => {
    const { ne, sw } = regionToBbox(r);
    const [ev, st] = await Promise.all([
      apiGet<any[]>(`/api/events/live?ne=${encodeURIComponent(ne)}&sw=${encodeURIComponent(sw)}`),
      apiGet<{ streams: any[] }>(`/api/streams/live?ne=${encodeURIComponent(ne)}&sw=${encodeURIComponent(sw)}`),
    ]);
    setEvents(ev);
    setStreams(st.streams ?? []);
  }, []);

  const fetchRange = useCallback(async (r = lastRegionRef.current) => {
    const { ne, sw } = regionToBbox(r);
    const now = new Date();
    const focus = new Date(now.getTime() - minutesOffset * 60 * 1000);
    const from = new Date(focus.getTime() - 30 * 60 * 1000).toISOString();
    const to = new Date(focus.getTime() + 30 * 60 * 1000).toISOString();
    const ev = await apiGet<any[]>(`/api/events/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&ne=${encodeURIComponent(ne)}&sw=${encodeURIComponent(sw)}`);
    setEvents(ev);
    setStreams([]);
  }, [minutesOffset]);

  const fetchData = useCallback(async (r = lastRegionRef.current) => {
    if (minutesOffset === 0) return fetchLive(r);
    return fetchRange(r);
  }, [fetchLive, fetchRange, minutesOffset]);

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
    intervalRef.current = setInterval(() => {
      if (minutesOffset === 0) fetchLive().catch(() => {});
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLive, load, minutesOffset]);

  useEffect(() => {
    if (minutesOffset !== 0) {
      fetchRange().catch(() => {});
    } else {
      fetchLive().catch(() => {});
    }
  }, [minutesOffset, fetchLive, fetchRange]);

  const onRegionChangeComplete = useCallback((r: any) => {
    lastRegionRef.current = r;
    fetchData(r).catch(() => {});
  }, [fetchData]);

  const onPressEvent = useCallback((id: string) => {
    const e = events.find((x) => x.id === id);
    setSelected({ type: "event", id, meta: e ? `${e.stream_count} POVs` : undefined });
  }, [events]);

  const onPressStream = useCallback((id: string) => {
    const s = singles.find((x) => x.id === id);
    setSelected({ type: "stream", id, meta: s ? `@${s.user_id}` : undefined });
  }, [singles]);

  const openSelected = useCallback(() => {
    if (!selected) return;
    if (selected.type === "event") router.push(`/event/${selected.id}`);
    // stream open action TBD (profile or single-viewer)
    setSelected(null);
  }, [router, selected]);

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
        onPressEvent={onPressEvent}
        onPressStream={onPressStream}
      />

      {selected && (
        <View style={styles.preview}>
          <PreviewCard
            title={selected.type === "event" ? "Event" : "Live Stream"}
            subtitle={selected.meta}
            primaryText={selected.type === "event" ? "Open Event" : "Open"}
            onPrimary={openSelected}
            onSecondary={() => setSelected(null)}
            secondaryText="Close"
          />
        </View>
      )}

      <View style={styles.timeline}>
        <TimelineScrubber minutesOffset={minutesOffset} onChange={setMinutesOffset} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { zIndex: 3, position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#00000066", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { color: COLORS.text, fontSize: 18, marginLeft: 8 },
  center: { position: "absolute", top: 48, left: 0, right: 0, alignItems: "center" },
  error: { color: COLORS.danger },
  preview: { zIndex: 3, position: "absolute", left: 16, right: 16, bottom: 80 },
  timeline: { zIndex: 2, position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#00000066" },
});
