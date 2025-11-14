import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

const PRIVACY_OPTIONS = [
  { key: "exact", label: "Exact location" },
  { key: "masked_100m", label: "Mask ~100m" },
  { key: "masked_1km", label: "Mask ~1km" },
] as const;

type PrivacyKey = typeof PRIVACY_OPTIONS[number]["key"];

type StreamResp = {
  id: string;
  event_id?: string | null;
  status: "live" | "ended";
};

export default function LiveScreen() {
  const [privacy, setPrivacy] = useState<PrivacyKey>("exact");
  const [camera, setCamera] = useState<"front" | "back">("back");
  const [activeStream, setActiveStream] = useState<StreamResp | null>(null);
  const [loading, setLoading] = useState(false);

  const canEnd = useMemo(() => !!activeStream, [activeStream]);

  const requestLocationAsync = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Location permission is needed to go live.");
      throw new Error("Permission denied");
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }, []);

  const handleGoLive = useCallback(async () => {
    try {
      setLoading(true);
      const { lat, lng } = await requestLocationAsync();
      const payload = { user_id: "demo-user", lat, lng, privacy_mode: privacy, device_camera: camera };
      const res = await fetch(`/api/streams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setActiveStream({ id: data.id, event_id: data.event_id, status: data.status });
      Alert.alert("Live!", `Stream started. ID: ${data.id}`);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to start stream");
    } finally {
      setLoading(false);
    }
  }, [privacy, camera, requestLocationAsync]);

  const handleEnd = useCallback(async () => {
    if (!activeStream) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/streams/${activeStream.id}/end`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed to end: ${res.status}`);
      setActiveStream(null);
      Alert.alert("Ended", "Stream ended successfully");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to end stream");
    } finally {
      setLoading(false);
    }
  }, [activeStream]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="radio-outline" color="#4D9FFF" size={22} />
        <Text style={styles.headerText}>Go Live</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Privacy</Text>
        <View style={styles.row}>
          {PRIVACY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setPrivacy(opt.key)}
              style={[styles.chip, privacy === opt.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, privacy === opt.key && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Camera</Text>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => setCamera("back")} style={[styles.chip, camera === "back" && styles.chipActive]}>
            <Text style={[styles.chipText, camera === "back" && styles.chipTextActive]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCamera("front")} style={[styles.chip, camera === "front" && styles.chipActive]}>
            <Text style={[styles.chipText, camera === "front" && styles.chipTextActive]}>Front</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleGoLive}
          disabled={loading || !!activeStream}
          style={[styles.primaryBtn, (loading || !!activeStream) && styles.btnDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.btnText}>Start Live</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleEnd}
          disabled={loading || !canEnd}
          style={[styles.secondaryBtn, (loading || !canEnd) && styles.btnDisabledBorder]}
        >
          <Text style={styles.secondaryText}>End Stream</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
  headerText: { color: "#FFFFFF", fontSize: 18, marginLeft: 8 },
  section: { paddingHorizontal: 16, paddingVertical: 12 },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#4D9FFF22", backgroundColor: "#1A1A1A" },
  chipActive: { borderColor: "#4D9FFF", backgroundColor: "#162335" },
  chipText: { color: "#A0A0A0" },
  chipTextActive: { color: "#FFFFFF" },
  footer: { marginTop: "auto", padding: 16, gap: 12 },
  primaryBtn: { backgroundColor: "#4D9FFF", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#FFFFFF", fontWeight: "600" },
  secondaryBtn: { borderWidth: 2, borderColor: "#4D9FFF", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  secondaryText: { color: "#4D9FFF", fontWeight: "600" },
  btnDisabledBorder: { opacity: 0.6 },
});
