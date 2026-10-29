import { en } from './en.js';
import { ru } from './ru.js';
import type { Locale, LanguageCode } from './types.js';

export type { Locale, LanguageCode } from './types.js';

// Add a new language by: 1) creating src/i18n/xx.ts implementing Locale,
// 2) registering it here, 3) adding 'xx' to LanguageCode in types.ts.
export const locales: Record<LanguageCode, Locale> = { en, ru };

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function getLocale(code: string | null | undefined): Locale {
  if (code && code in locales) return locales[code as LanguageCode];
  return locales[DEFAULT_LANGUAGE];
}

/** Maps Telegram's ctx.from.language_code (e.g. "ru", "ru-RU") to a supported LanguageCode. */
export function detectLanguage(telegramLanguageCode: string | undefined): LanguageCode {
  if (!telegramLanguageCode) return DEFAULT_LANGUAGE;
  const base = telegramLanguageCode.split('-')[0]?.toLowerCase();
  return base && base in locales ? (base as LanguageCode) : DEFAULT_LANGUAGE;
}

export function availableLocales(): Locale[] {
  return Object.values(locales);
}
