import type { LanguageCode } from './languages'

export const MAX_SOURCE_BYTES = 500

const TRANSLATION_ENDPOINT = 'https://translate.googleapis.com/translate_a/single'
const textEncoder = new TextEncoder()

export function parseTranslationResponse(payload: unknown): string {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw new Error('翻译服务返回了无法识别的数据。')
  }

  const translatedText = payload[0]
    .map((segment) => (Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''))
    .join('')

  if (!translatedText) {
    throw new Error('翻译服务没有返回翻译结果。')
  }

  return translatedText
}

export function getUtf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength
}

export function trimToUtf8ByteLimit(value: string, maxBytes: number): string {
  if (getUtf8ByteLength(value) <= maxBytes) {
    return value
  }

  let result = ''
  let byteLength = 0
  for (const character of value) {
    const characterBytes = getUtf8ByteLength(character)
    if (byteLength + characterBytes > maxBytes) {
      break
    }
    result += character
    byteLength += characterBytes
  }
  return result
}

export async function translateText(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  signal?: AbortSignal,
): Promise<string> {
  if (sourceLanguage === targetLanguage || !text.trim()) {
    return text
  }

  const url = new URL(TRANSLATION_ENDPOINT)
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', sourceLanguage)
  url.searchParams.set('tl', targetLanguage)
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text)

  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new Error('无法连接翻译服务，请检查网络后重试。')
  }

  if (!response.ok) {
    throw new Error(`翻译服务请求失败（${response.status}）。`)
  }

  const payload: unknown = await response.json()
  return parseTranslationResponse(payload)
}
