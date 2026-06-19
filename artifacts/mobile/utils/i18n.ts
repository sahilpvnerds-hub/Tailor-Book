/**
 * i18next bootstrap for the Tailor Book mobile app.
 *
 * Three supported languages (English / Hindi / Gujarati). The active
 * language is persisted in two places:
 *   1. i18next's own storage (in-memory + AsyncStorage) so the UI can
 *      switch instantly without a network call.
 *   2. The `users.preferredLanguage` column on the backend, so the same
 *      language is restored on the next device / fresh login.
 *
 * Use `useTranslation()` from `react-i18next` in components, e.g.
 *   const { t, i18n } = useTranslation();
 *   <Text>{t("home.greetingMorning")}</Text>
 *   <Button onPress={() => i18n.changeLanguage("hi")} />
 */
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { getLocales } from "expo-localization";

import en from "@/locales/en.json";
import hi from "@/locales/hi.json";
import gu from "@/locales/gu.json";

export type SupportedLanguage = "en" | "hi" | "gu";
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "hi", "gu"];

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  gu: { translation: gu },
} as const;

/**
 * Map an expo-localale string (e.g. "en-IN", "hi", "gu-IN") to one of our
 * three supported language codes. Returns "en" as the safe default.
 */
function deviceLanguage(): SupportedLanguage {
  try {
    const locales = getLocales();
    for (const loc of locales) {
      const code = loc.languageCode?.toLowerCase();
      if (code === "hi" || code === "gu" || code === "en") {
        return code as SupportedLanguage;
      }
    }
  } catch {
    // ignore — expo-localization not available
  }
  return "en";
}

let initialised = false;

/**
 * Initialise i18next. Safe to call multiple times.
 * Pass `language` to override the device default (e.g. after login).
 */
export function initI18n(language?: SupportedLanguage): typeof i18n {
  if (initialised) {
    if (language) i18n.changeLanguage(language);
    return i18n;
  }
  i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: "v4",
      resources,
      lng: language ?? deviceLanguage(),
      fallbackLng: "en",
      interpolation: { escapeValue: false }, // React already escapes
      returnNull: false,
    });
  initialised = true;
  return i18n;
}

export { i18n, useTranslation };

/**
 * Re-export of `useTranslation` with the default namespace forced to
 * "translation" so callers don't have to type it every time.
 */
export function useT() {
  return useTranslation();
}

/**
 * Convenience helper for places that don't have a component context
 * (e.g. inside `Linking.openURL` callbacks).
 */
export function translate(key: string, params?: Record<string, unknown>): string {
  if (!initialised) initI18n();
  return String(i18n.t(key, params as never));
}
