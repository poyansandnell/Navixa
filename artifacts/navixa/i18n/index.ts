import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import enBase from './locales/en.json';
import svBase from './locales/sv.json';
import onlinePartial from './partials/online';
import socialPartial from './partials/social';
import metaPartial from './partials/meta';
import adminPartial from './partials/admin';
import legalDocsPartial from './partials/legalDocs';

/** Deep-merge translation objects (partials extend, never clobber, base namespaces). */
function mergeDeep(
  base: Record<string, unknown>,
  ...overrides: Record<string, unknown>[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const override of overrides) {
    for (const [key, value] of Object.entries(override)) {
      const existing = out[key];
      if (
        existing &&
        typeof existing === 'object' &&
        !Array.isArray(existing) &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        out[key] = mergeDeep(
          existing as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        out[key] = value;
      }
    }
  }
  return out;
}

const en = mergeDeep(
  enBase,
  onlinePartial.en,
  socialPartial.en,
  metaPartial.en,
  adminPartial.en,
  legalDocsPartial.en,
);
const sv = mergeDeep(
  svBase,
  onlinePartial.sv,
  socialPartial.sv,
  metaPartial.sv,
  adminPartial.sv,
  legalDocsPartial.sv,
);
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import pl from './locales/pl.json';
import nl from './locales/nl.json';
import da from './locales/da.json';
import no from './locales/no.json';
import fi from './locales/fi.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

/** All languages the app ships with. English is the ultimate fallback. */
export const SUPPORTED_LANGUAGES = [
  'en',
  'sv',
  'de',
  'es',
  'fr',
  'pt',
  'it',
  'pl',
  'nl',
  'da',
  'no',
  'fi',
  'ja',
  'ko',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = {
  en: { translation: en },
  sv: { translation: sv },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
  it: { translation: it },
  pl: { translation: pl },
  nl: { translation: nl },
  da: { translation: da },
  no: { translation: no },
  fi: { translation: fi },
  ja: { translation: ja },
  ko: { translation: ko },
} as const;

/** Resolve the device's preferred language to a supported one, else 'en'. */
export function getDeviceLanguage(): SupportedLanguage {
  const locales = getLocales();
  for (const locale of locales) {
    const code = locale.languageCode?.toLowerCase();
    if (code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as SupportedLanguage;
    }
  }
  return 'en';
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });
}

/** Change the active language at runtime. Pass 'system' to use device locale. */
export function setLanguage(language: SupportedLanguage | 'system'): void {
  const next = language === 'system' ? getDeviceLanguage() : language;
  if (i18n.language !== next) {
    void i18n.changeLanguage(next);
  }
}

export default i18n;
