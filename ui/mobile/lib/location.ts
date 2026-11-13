import * as Location from "expo-location";
import { formatNumber, type TFunction } from "@/lib/i18n";

export type LatLng = { lat: number; lng: number };

export type LocationResult =
  | { status: "granted"; coords: LatLng }
  | { status: "denied" }
  | { status: "unavailable" };

/**
 * Asks for "when in use" permission (once) and returns the current position.
 * Never throws: callers fall back to the selected city when it fails.
 */
export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { status: "denied" };
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { status: "granted", coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
  } catch {
    return { status: "unavailable" };
  }
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "850 м" / "1,8 км" / "12 км". */
export function formatDistance(km: number, t: TFunction): string {
  if (km < 1) return t("common.meters", { n: Math.max(10, Math.round((km * 1000) / 10) * 10) });
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return t("common.km", { n: formatNumber(rounded) });
}
