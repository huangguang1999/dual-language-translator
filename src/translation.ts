import type { LanguageCode } from './languages'

export const MAX_SOURCE_BYTES = 500

const TRANSLATION_ENDPOINT = 'https://api.mymemory.translated.net/get'
const textEncoder = new TextEncoder()

type JsonRecord = Record<string, unknown>

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readTranslatedText(payload: unknown): string {
  if (!isJsonRecord(payload)) {
    throw new Error('翻译服务返回了无法识别的数据。')
  }

  const status = Number(payload.responseStatus)
  if (!Number.isNaN(status) && status >= 400) {
    const details = typeof payload.responseDetails === 'string' ? payload.responseDetails : ''
    throw new Error(details || '翻译服务暂时不可用，请稍后重试。')
  }

  const responseData = payload.responseData
  if (!isJsonRecord(responseData) || typeof responseData.translatedText !== 'string') {
    throw new Error('翻译服务没有返回翻译结果。')
  }

  return responseData.translatedText
}

function decodeHtmlEntities(value: string): string {
  const textArea = document.createElement('textarea')
  textArea.innerHTML = value
  return textArea.value
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
  url.searchParams.set('q', text)
  url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`)
  url.searchParams.set('mt', '1')

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
  return decodeHtmlEntities(readTranslatedText(payload))
}
