import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export type AppLanguage = "en" | "zh";

export function normalizeLanguage(lang: unknown): AppLanguage {
  if (!lang) return "en";
  const s = String(lang).toLowerCase();
  if (s === "zh" || s === "cn" || s === "chinese") return "zh";
  return "en";
}

let _initialized = false;

export function initI18n(language?: unknown) {
  if (_initialized) return i18n;

  i18n.use(initReactI18next).init({
    lng: normalizeLanguage(language),
    fallbackLng: "en",
    // keys are English phrases: return the key verbatim when no resource loaded
    defaultNS: "app",
    ns: ["app"],
    keySeparator: false,
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
    returnNull: false,
  });

  _initialized = true;

  // Eagerly load English resources — already on the critical path because this
  // runs at module scope on every page — but use a dynamic import so
  // Turbopack can keep the 176KB JSON out of the entry-point module graph.
  import("@/locales/en/app.json").then((mod) => {
    i18n.addResourceBundle("en", "app", mod.default, true, true);
  });

  return i18n;
}

export async function ensureLanguage(language: AppLanguage) {
  if (i18n.hasResourceBundle(language, "app")) return;
  if (language === "en") {
    const enApp = (await import("@/locales/en/app.json")).default;
    i18n.addResourceBundle("en", "app", enApp, true, true);
  } else if (language === "zh") {
    const zhApp = (await import("@/locales/zh/app.json")).default;
    i18n.addResourceBundle("zh", "app", zhApp, true, true);
  }
}
