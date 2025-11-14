import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, FlatList, Dimensions, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Video } from "expo-video";
import { apiGet, presenceWatch, presenceLeave, getEventPresence, followUser, getFollowStatus } from "../../src/utils/api";
import { useViewerStore } from "../../src/state/viewerStore";
import { CURRENT_USER_ID } from "../../src/constants/user";

const COLORS = { bg: "#0A0A0A", surface: "#1A1A1A", blue: "#4D9FFF", violet: "#9D4EDD", amber: "#FFB800", text: "#FFFFFF", meta: "#A0A0A0", danger: "#FF4D4D" } as const;
const { width } = Dimensions.get("window");

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [presence, setPresence] = useState<{ watching_now: number; friends_watching: number } | null>(null);
  const [followingPOV, setFollowingPOV] = useState<boolean>(false);

  const povs = useViewerStore((s) => s.povs);
  const activeIndex = useViewerStore((s) => s.activeIndex);
  const setEvent = useViewerStore((s) => s.setEvent);
  const setActiveIndex = useViewerStore((s) => s.setActiveIndex);

  const streams = useMemo(() => (data?.streams ?? []), [data]);
  const activeStream = povs[activeIndex] ?? streams[0];
  const isLive = (data?.event?.status ?? "ended") === "live";

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setLoading(true);
      const d = await apiGet<any>(`/api/events/${id}`);
      setData(d);
      setEvent(id!, (d.streams || []).map((s: any) => ({ 
        id: s.id, 
        user_id: s.user_id, 
        playback_url: s.playback_url,
        livepeer_playback_id: s.livepeer_playback_id
      })));
      try {
        const p = await getEventPresence(String(id), CURRENT_USER_ID);
        setPresence({ watching_now: p.watching_now, friends_watching: p.friends_watching });
      } catch {}
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, setEvent]);

  useEffect(() => { load(); }, [load]);

  // Presence keepalive and polling
  useEffect(() => {
    if (!id) return;
    let keepalive: any;
    let poll: any;
    const start = async () => {
      try { await presenceWatch(CURRENT_USER_ID, String(id)); } catch {}
      keepalive = setInterval(async () => { try { await presenceWatch(CURRENT_USER_ID, String(id)); } catch {} }, 60000);
      poll = setInterval(async () => {
        try {
          const p = await getEventPresence(String(id), CURRENT_USER_ID);
          setPresence({ watching_now: p.watching_now, friends_watching: p.friends_watching });
        } catch {}
      }, 15000);
    };
    start();
    return () => { clearInterval(keepalive); clearInterval(poll); presenceLeave(CURRENT_USER_ID, String(id)).catch(() => {}); };
  }, [id]);

  // Follow status for active POV
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!activeStream?.user_id) { setFollowingPOV(false); return; }
      try {
        const st = await getFollowStatus(CURRENT_USER_ID, activeStream.user_id);
        if (!cancelled) setFollowingPOV(!!st.following);
      } catch { if (!cancelled) setFollowingPOV(false); }
    };
    check();
    return () => { cancelled = true; };
  }, [activeStream?.user_id]);

  const renderThumb = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity onPress={() => setActiveIndex(index)} style={[styles.thumb, index === activeIndex && styles.thumbActive]}>
      <Ionicons name="videocam" color={index === activeIndex ? COLORS.text : COLORS.meta} size={18} />
      <Text style={[styles.thumbText, index === activeIndex && styles.thumbTextActive]}>@{item.user_id}</Text>
    </TouchableOpacity>
  );

  const followActive = useCallback(async () => {
    if (!activeStream?.user_id || followingPOV) return;
    try {
      await followUser(CURRENT_USER_ID, activeStream.user_id);
      setFollowingPOV(true);
      Alert.alert("Followed", `You are now following @${activeStream.user_id}`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to follow");
    }
  }, [activeStream, followingPOV]);

  const presenceText = presence ? (presence.friends_watching > 0 ? `${presence.friends_watching} friends watching` : `${presence.watching_now} watching now`) : undefined;

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.blue} /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.error}>Error: {error}</Text></View>
      ) : data ? (
        <View style={{ flex: 1 }}>
          <View style={styles.metaBar}>
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: isLive ? "#D91E18" : COLORS.surface }]}>
                <Text style={styles.badgeText}>{isLive ? "LIVE" : "REPLAY"}</Text>
              </View>
              <Text style={styles.metaText}>{data.event.stream_count} POVs</Text>
              {presenceText ? <View style={styles.chip}><Text style={styles.chipText}>{presenceText}</Text></View> : null}
            </View>
            <View style={styles.row}>
              <TouchableOpacity onPress={followActive} disabled={followingPOV} style={[styles.followBtn, followingPOV && { opacity: 0.6 }]}>
                <Text style={styles.followText}>{followingPOV ? "Following" : "Follow POV"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={load}><Ionicons name="refresh" color={COLORS.meta} size={20} /></TouchableOpacity>
            </View>
          </View>

          <View style={styles.playerWrap}>
            {activeStream?.playback_url ? (
              <Video style={styles.player} source={{ uri: activeStream.playback_url }} useNativeControls resizeMode="cover" />
            ) : activeStream?.livepeer_playback_id ? (
              <Video 
                style={styles.player} 
                source={{ uri: `https://livepeercdn.studio/hls/${activeStream.livepeer_playback_id}/index.m3u8` }} 
                useNativeControls 
                resizeMode="cover" 
              />
            ) : (
              <View style={[styles.player, styles.playerPlaceholder]}>
                <Ionicons name="videocam-off" color={COLORS.meta} size={48} />
                <Text style={styles.meta}>No playback available</Text>
                <Text style={styles.metaSmall}>Broadcast using RTMP from Go Live tab</Text>
              </View>
            )}
            <View style={styles.overlay}>
              <Text style={styles.overlayTitle}>@{activeStream?.user_id ?? "unknown"}</Text>
              <Text style={styles.overlayMeta}>{isLive ? "Live" : "Replay"}</Text>
            </View>
          </View>

          <View style={styles.povBar}>
            <FlatList horizontal data={povs.length ? povs : streams} keyExtractor={(item) => item.id} renderItem={renderThumb} ItemSeparatorComponent={() => <View style={{ width: 8 }} />} contentContainerStyle={{ paddingHorizontal: 12 }} showsHorizontalScrollIndicator={false} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.title}>Event</Text>
            <Text style={styles.meta}>Centroid: {data.event.centroid_lat.toFixed(5)}, {data.event.centroid_lng.toFixed(5)}</Text>
            <Text style={styles.metaSmall}>Created: {new Date(data.event.created_at).toLocaleString()}</Text>
            <View style={{ height: 12 }} />
            <Text style={styles.title}>Streams</Text>
            {(povs.length ? povs : streams).map((s: any) => (
              <View key={s.id} style={styles.card}>
                <Text style={styles.meta}>@{s.user_id}</Text>
                <Text style={styles.metaSmall}>{s.playback_url ? 'Has Replay' : 'No Replay'}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.center}><Text style={styles.meta}>No data</Text></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  metaBar: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: COLORS.text, fontWeight: "700", fontSize: 12 },
  metaText: { color: COLORS.meta },
  chip: { backgroundColor: "#00000066", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chipText: { color: COLORS.meta, fontSize: 12 },
  followBtn: { borderColor: COLORS.blue, borderWidth: 2, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  followText: { color: COLORS.blue, fontWeight: "700", fontSize: 12 },
  playerWrap: { width: "100%", height: Math.round(width * 9 / 16), backgroundColor: "#000" },
  player: { width: "100%", height: "100%", backgroundColor: "#000" },
  playerPlaceholder: { alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", left: 12, bottom: 12, backgroundColor: "#00000066", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  overlayTitle: { color: COLORS.text, fontWeight: "700" },
  overlayMeta: { color: COLORS.meta, marginTop: 2 },
  povBar: { paddingVertical: 10, backgroundColor: "#00000066" },
  title: { color: COLORS.text, fontSize: 18, marginBottom: 8 },
  meta: { color: COLORS.meta, marginTop: 4 },
  metaSmall: { color: COLORS.meta, marginTop: 4, fontSize: 12 },
  error: { color: COLORS.danger },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginTop: 8 },
});
