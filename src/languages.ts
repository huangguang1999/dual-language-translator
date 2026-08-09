export const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文', shortCode: '中' },
  { code: 'en', label: 'English', shortCode: 'EN' },
  { code: 'ja', label: '日本語', shortCode: '日' },
  { code: 'ko', label: '한국어', shortCode: '한' },
  { code: 'fr', label: 'Français', shortCode: 'FR' },
  { code: 'es', label: 'Español', shortCode: 'ES' },
  { code: 'de', label: 'Deutsch', shortCode: 'DE' },
  { code: 'it', label: 'Italiano', shortCode: 'IT' },
  { code: 'pt', label: 'Português', shortCode: 'PT' },
  { code: 'ru', label: 'Русский', shortCode: 'RU' },
  { code: 'ar', label: 'العربية', shortCode: 'AR' },
  { code: 'hi', label: 'हिन्दी', shortCode: 'HI' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LEFT_LANGUAGE: LanguageCode = 'zh-CN'
export const DEFAULT_RIGHT_LANGUAGE: LanguageCode = 'en'

export function getLanguage(code: LanguageCode) {
  const language = LANGUAGES.find((option) => option.code === code)
  if (!language) {
    throw new Error(`Unsupported language: ${code}`)
  }
  return language
}
