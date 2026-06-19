/**
 * Reverse-geocoding helper — turns a lat/lng pair into a human-readable
 * address (street, city, state).
 *
 * Uses OpenStreetMap's Nominatim service, which is free, requires no
 * API key, and works on any platform (iOS, Android, web). We send a
 * descriptive `User-Agent` per Nominatim's usage policy; on web the
 * browser sets the header automatically, on native we use a fetch
 * wrapper that sets it via the `headers` field.
 *
 * The endpoint is rate-limited to 1 req/sec; callers should debounce
 * or cache results. For the register flow we only call this once per
 * visit so this is fine.
 *
 * @see https://nominatim.org/release-docs/develop/api/Reverse/
 */

export interface ReverseGeocodeResult {
  /** Building / house number, e.g. "42B" (may be empty) */
  houseNumber: string;
  /** Street / road name, e.g. "Ring Road" (may be empty) */
  road: string;
  /** Neighbourhood / suburb, e.g. "Satellite" (may be empty) */
  neighbourhood: string;
  /** City / town, e.g. "Ahmedabad" */
  city: string;
  /** State / region, e.g. "Gujarat" */
  state: string;
  /** Country, e.g. "India" */
  country: string;
  /** Full formatted address returned by Nominatim */
  displayName: string;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

/**
 * Reverse-geocode coordinates to an address. Returns `null` on any
 * network / parse failure so the caller can degrade gracefully.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${encodeURIComponent(latitude)}` +
    `&lon=${encodeURIComponent(longitude)}` +
    `&zoom=18&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Nominatim usage policy requires a real UA. On web the browser
        // supplies one; on native we set it explicitly.
        "User-Agent": "TailorBook/2.0 (contact@tailorbook.com)",
      },
    });
    if (!res.ok) {
      console.warn("[geocode] HTTP", res.status, "for", latitude, longitude);
      return null;
    }
    const data = (await res.json()) as NominatimResponse;
    if (!data.address) return null;
    const a = data.address;
    return {
      houseNumber: a.house_number ?? "",
      road: a.road ?? "",
      neighbourhood: a.neighbourhood ?? a.suburb ?? "",
      // Nominatim returns "city" for bigger towns, "town" for smaller,
      // "village" for villages. Pick whichever it gave us.
      city: a.city ?? a.town ?? a.village ?? "",
      state: a.state ?? "",
      country: a.country ?? "",
      displayName: data.display_name ?? "",
    };
  } catch (err) {
    console.warn("[geocode] reverseGeocode failed:", err);
    return null;
  }
}
