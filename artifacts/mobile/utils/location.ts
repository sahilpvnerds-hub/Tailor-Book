/**
 * GPS helper for the Tailor Book mobile app.
 *
 * - `requestLocationPermission()` — asks the user for foreground location
 *   permission. Returns a stable string status the caller can use to show
 *   friendly UI ("granted" / "denied" / "undetermined").
 * - `getCurrentCoords()` — reads the device's last known location (or
 *   fetches a fresh one). Returns `{ latitude, longitude, accuracy }` or
 *   `null` if unavailable.
 * - `openMapsAtCoords()` — convenience helper that opens the device's
 *   default map app at the given lat/lng (used from customer / order
 *   detail screens).
 *
 * Wrapped in try/catch because `expo-location` throws on web when the
 * browser does not expose the Geolocation API. In that case we degrade
 * gracefully — the user can still type the address manually.
 */
import * as Location from "expo-location";
import { Alert, Linking, Platform } from "react-native";

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type PermissionStatus = "granted" | "denied" | "undetermined" | "unsupported";

/**
 * Ask for foreground location permission. Resolves to a stable status.
 * Caches nothing — call it every time the user taps "Use my location".
 */
export async function requestLocationPermission(): Promise<PermissionStatus> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return "granted";
    if (status === Location.PermissionStatus.DENIED) return "denied";
    return "undetermined";
  } catch (err) {
    console.warn("[location] requestForegroundPermissionsAsync failed:", err);
    return "unsupported";
  }
}

/**
 * Read the device's current coordinates. Caller should have already
 * requested permission. If permission is denied, returns `null` so the
 * caller can show a friendly message.
 */
export async function getCurrentCoords(): Promise<Coords | null> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      Alert.alert(
        "Location services off",
        "Please enable location services in your device settings to auto-fill your shop location.",
      );
      return null;
    }

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return null;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
    };
  } catch (err) {
    console.warn("[location] getCurrentPositionAsync failed:", err);
    return null;
  }
}

/**
 * Best-effort helper: ask for permission, then fetch coordinates. Returns
 * `null` if the user denies or the platform doesn't support geolocation.
 * Suitable for direct use in form "Use my current location" buttons.
 */
export async function requestAndGetCoords(): Promise<Coords | null> {
  const status = await requestLocationPermission();
  if (status !== "granted") {
    if (status === "denied") {
      Alert.alert(
        "Permission denied",
        "Please allow location access in your device settings to auto-fill the shop address.",
      );
    }
    return null;
  }
  return getCurrentCoords();
}

/**
 * Open the device's default maps app at the given lat/lng. Falls back to
 * Google Maps on web.
 */
export async function openMapsAtCoords(coords: Coords, label?: string): Promise<void> {
  const q = encodeURIComponent(label ?? "");
  const url =
    Platform.OS === "ios"
      ? `maps:0,0?q=${coords.latitude},${coords.longitude}${q ? `(${q})` : ""}`
      : `geo:${coords.latitude},${coords.longitude}${q ? `?q=${coords.latitude},${coords.longitude}(${q})` : ""}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // fall through to web URL
  }
  // Web / unsupported platforms — open Google Maps directly.
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
  await Linking.openURL(webUrl);
}
