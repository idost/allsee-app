import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import NativeMap from "../../src/components/NativeMap";
import { useRouter } from "expo-router";
import { apiGet, getEventPresence, followUser } from "../../src/utils/api";
import { reverseGeocodeLabel } from "../../src/utils/geocode";
import TimelineScrubber from "../../src/components/TimelineScrubber";
import PreviewCard from "../../src/components/PreviewCard";

const COLORS = { bg: "#0A0A0A", surface: "#1A1A1A", blue: "#4D9FFF", text: "#FFFFFF", meta: "#A0A0A0", danger: "#FF4D4D" } as const;
const DEFAULT_REGION = { latitude: 41.0082, longitude: 28.9784, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const CURRENT_USER = "demo-user";

type Selected = { type: "event"; id: string; meta?: string; centroid?: { lat: number; lng: number }; label?: string } | { type: "stream"; id: string; meta?: string } | null;

export default function MapRoute() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastRegionRef = useRef(DEFAULT_REGION);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const presencePollRef = useRef<NodeJS.Timeout | null>(null);
  const [minutesOffset, setMinutesOffset] = useState(0);
  const [selected, setSelected] = useState<Selected>(null);
  const [presence, setPresence] = useState<{ watching_now: number; friends_watching: number } | null>(null);
  const [eventStreamers, setEventStreamers] = useState<string[]>([]);

  const singles = useMemo(() => streams.filter((s) => !s.event_id), [streams]);

  const regionToBboxSafe = useCallback((r: any) => {
    const ne = { lat: r.latitude + r.latitudeDelta / 2, lng: r.longitude + r.longitudeDelta / 2 };
    const sw = { lat: r.latitude - r.latitudeDelta / 2, lng: r.longitude - r.longitudeDelta / 2 };
    return { ne: `${ne.lat},${ne.lng}`, sw: `${sw.lat},${sw.lng}` };
  }, []);

  const fetchLive = useCallback(async (r = lastRegionRef.current) => {
    const { ne, sw } = regionToBboxSafe(r);
    const [ev, st] = await Promise.all([
      apiGet<any[]>(`/api/events/live?ne=${encodeURIComponent(ne)}&sw=${encodeURIComponent(sw)}`),
      apiGet<{ streams: any[] }>(`/api/streams/live?ne=${encodeURIComponent(ne)}&sw=${encodeURIComponent(sw)}`),
    ]);
    setEvents(ev);
    setStreams(st.streams ?? []);
  }, [regionToBboxSafe]);

  const fetchRange = useCallback(async (r = lastRegionRef.current) => {
    const { ne, sw } = regionToBboxSafe(r);
    const now = new Date();
    const focus = new Date(now.getTime() - minutesOffset * 60 * 1000);
    const from = new Date(focus.getTime() - 30 * 60 * 1000).toISOString();
    const to = new Date(focus.getTime() + 30 * 60 * 1000).toISOString();
    const ev = await apiGet<any[]>(`/api/events/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&ne=${encodeURIComponent(ne)}&sw=${encodeURIComponent(sw)}`);
    setEvents(ev);
    setStreams([]);
  }, [minutesOffset, regionToBboxSafe]);

  const fetchData = useCallback(async (r = lastRegionRef.current) => {
    if (minutesOffset === 0) return fetchLive(r);
    return fetchRange(r);
  }, [fetchLive, fetchRange, minutesOffset]);

  const load = useCallback(async () => {
    try { setError(null); setLoading(true); await fetchData(); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [fetchData]);

  useEffect(() => {
    load();
    intervalRef.current && clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { if (minutesOffset === 0) fetchLive().catch(() => {}); }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLive, load, minutesOffset]);

  useEffect(() => { if (minutesOffset !== 0) { fetchRange().catch(() => {}); } else { fetchLive().catch(() => {}); } }, [minutesOffset, fetchLive, fetchRange]);

  const onRegionChangeComplete = useCallback((r: any) => { lastRegionRef.current = r; fetchData(r).catch(() => {}); }, [fetchData]);

  const clearPresencePoll = () => { if (presencePollRef.current) { clearInterval(presencePollRef.current); presencePollRef.current = null; } };

  const onPressEvent = useCallback(async (id: string) => {
    const e = events.find((x) => x.id === id);
    const centroid = e ? { lat: e.centroid_lat, lng: e.centroid_lng } : undefined;
    let label: string | undefined = undefined;
    if (centroid) {
      const l = await reverseGeocodeLabel(centroid.lat, centroid.lng);
      if (l) label = l.split(",")[0];
    }
    setSelected({ type: "event", id, meta: e ? `${e.stream_count} POVs` : undefined, centroid, label });
    try {
      const detail = await apiGet<any>(`/api/events/${id}`);
      const streamers = (detail.streams || []).map((s: any) => s.user_id);
      setEventStreamers(streamers);
      const p = await getEventPresence(id, CURRENT_USER);
      setPresence({ watching_now: p.watching_now, friends_watching: p.friends_watching });
      clearPresencePoll();
      presencePollRef.current = setInterval(async () => {
        try { const p2 = await getEventPresence(id, CURRENT_USER); setPresence({ watching_now: p2.watching_now, friends_watching: p2.friends_watching }); } catch {}
      }, 15000) as any;
    } catch {}
  }, [events]);

  const onPressStream = useCallback((id: string) => {
    const s = singles.find((x) => x.id === id);
    setSelected({ type: "stream", id, meta: s ? `@${s.user_id}` : undefined });
    setPresence(null); setEventStreamers([]); clearPresencePoll();
  }, [singles]);

  const openSelected = useCallback(() => { if (!selected) return; if (selected.type === "event") router.push(`/event/${selected.id}`); setSelected(null); clearPresencePoll(); }, [router, selected]);

  const followSelectedEventStreamers = useCallback(async () => {
    if (!selected || selected.type !== "event" || !eventStreamers.length) return;
    try { await Promise.all(eventStreamers.map((uid) => followUser(CURRENT_USER, uid))); Alert.alert("Followed", `You are now following ${eventStreamers.length} streamer(s)`); }
    catch (e: any) { Alert.alert("Error", e?.message || "Failed to follow"); }
  }, [selected, eventStreamers]);

  const presenceText = useMemo(() => { if (!presence) return undefined; if (presence.friends_watching > 0) return `${presence.friends_watching} friends watching`; return `${presence.watching_now} watching now`; }, [presence]);

  const subtitle = useMemo(() => {
    if (!selected || selected.type !== "event") return undefined;
    if (selected.label) return selected.label;
    if (selected.centroid) return `${selected.centroid.lat.toFixed(5)}, ${selected.centroid.lng.toFixed(5)}`;
    return undefined;
  }, [selected]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="map-outline" color={COLORS.text} size={22} />
        <Text style={styles.headerText}>Live Map</Text>
        <TouchableOpacity onPress={load} style={{ marginLeft: "auto" }}>
          <Ionicons name="refresh" color={COLORS.meta} size={20} />
        </TouchableOpacity>
      </View>

      {loading && (<View style={styles.center}><ActivityIndicator color={COLORS.blue} /></View>)}
      {error && (<View style={styles.center}><Text style={styles.error}>Error: {error}</Text></View>)}

      <NativeMap events={events} streams={singles} onRegionChangeComplete={onRegionChangeComplete} initialRegion={DEFAULT_REGION as any} loading={loading} onPressEvent={onPressEvent} onPressStream={onPressStream} />

      {selected && selected.type === "event" && (
        <View style={styles.preview}>
          <PreviewCard title="Event" subtitle={subtitle} meta={selected.meta} presenceText={presenceText} primaryText="Open Event" followText="Follow" onPrimary={openSelected} onSecondary={() => { setSelected(null); clearPresencePoll(); }} onFollow={followSelectedEventStreamers} />
        </View>
      )}

      {selected && selected.type === "stream" && (
        <View style={styles.preview}>
          <PreviewCard title="Live Stream" subtitle={selected.meta} primaryText="Open" onPrimary={() => setSelected(null)} onSecondary={() => setSelected(null)} />
        </View>
      )}

      <View style={styles.timeline}><TimelineScrubber minutesOffset={minutesOffset} onChange={setMinutesOffset} /></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { zIndex: 3, position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#00000080", paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { color: COLORS.text, fontSize: 18, marginLeft: 8, fontWeight: "600" },
  center: { position: "absolute", top: 50, left: 0, right: 0, alignItems: "center" },
  error: { color: COLORS.danger },
  preview: { zIndex: 3, position: "absolute", left: 16, right: 16, bottom: 80 },
  timeline: { zIndex: 2, position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#00000066" },
});
