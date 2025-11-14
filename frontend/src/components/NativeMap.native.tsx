import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import Constants from "expo-constants";
import GlowPin from "./GlowPin";
import ClusterMarker from "./ClusterMarker";

export type MapEvent = { id: string; centroid_lat: number; centroid_lng: number; stream_count: number; created_at: string; viewer_count_total?: number };
export type MapStream = { id: string; user_id: string; lat: number; lng: number; viewer_count_peak?: number };
export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export default function NativeMap({
  events, streams, onRegionChangeComplete, initialRegion = { latitude: 41.0082, longitude: 28.9784, latitudeDelta: 0.05, longitudeDelta: 0.05 }, loading,
  onPressEvent, onPressStream,
}: {
  events: MapEvent[]; streams: MapStream[]; onRegionChangeComplete: (r: Region) => void; initialRegion?: Region; loading?: boolean; onPressEvent?: (eventId: string) => void; onPressStream?: (streamId: string) => void;
}) {
  const [region, setRegion] = useState<Region>(initialRegion);
  const [locLoading, setLocLoading] = useState(false);
  const mounted = useRef(true);

  const locate = useCallback(async () => {
    try {
      setLocLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted.current) return;
        setRegion((r) => ({ ...r, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
      }
    } catch {}
    finally { setLocLoading(false); }
  }, []);

  useEffect(() => { mounted.current = true; locate(); return () => { mounted.current = false; }; }, [locate]);

  const handleRegionChangeComplete = useCallback((r: Region) => { setRegion(r); onRegionChangeComplete(r); }, [onRegionChangeComplete]);

  const isExpoGo = Constants.appOwnership === "expo";
  if (isExpoGo) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {(loading || locLoading) && <ActivityIndicator color="#fff" />}
      </View>
    );
  }

  const RNMaps = require("react-native-maps");
  const MapView: any = RNMaps.default;
  const Marker: any = RNMaps.Marker;

  return (
    <View style={{ flex: 1 }}>
      {(loading || locLoading) && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 48, alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      <MapView style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} initialRegion={region} onRegionChangeComplete={handleRegionChangeComplete} showsUserLocation>
        {streams.map((s) => (
          <Marker key={s.id} coordinate={{ latitude: s.lat, longitude: s.lng }} title={`@${s.user_id}`} description="Live stream" onPress={() => onPressStream && onPressStream(s.id)}>
            <GlowPin color="#4D9FFF" size={16 + Math.min(8, Math.round((s.viewer_count_peak || 0) / 10))} intensity={Math.max(1, Math.min(3, (s.viewer_count_peak || 0) / 20))} />
          </Marker>
        ))}
        {events.map((e) => {
          const color = e.stream_count >= 5 ? "#FFB84D" : "#9D4DFF";
          return (
            <Marker key={e.id} coordinate={{ latitude: e.centroid_lat, longitude: e.centroid_lng }} title="Event" description={`${e.stream_count} POVs`} onPress={() => onPressEvent && onPressEvent(e.id)}>
              <ClusterMarker count={e.stream_count} color={color} />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}
