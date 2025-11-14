import { apiGet } from "./api";

const cache = new Map<string, string | null>();

export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const res = await apiGet<{ label: string | null }>(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
    cache.set(key, res.label ?? null);
    return res.label ?? null;
  } catch {
    cache.set(key, null);
    return null;
  }
}
