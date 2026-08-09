import { describe, expect, it } from 'vitest'
import { getUtf8ByteLength, trimToUtf8ByteLimit } from './translation'

describe('translation text limits', () => {
  it('counts UTF-8 bytes for Latin and Chinese text', () => {
    expect(getUtf8ByteLength('hello')).toBe(5)
    expect(getUtf8ByteLength('你好')).toBe(6)
  })

  it('keeps complete Unicode characters when trimming', () => {
    expect(trimToUtf8ByteLimit('你好abc', 7)).toBe('你好a')
    expect(trimToUtf8ByteLimit('a🙂b', 5)).toBe('a🙂')
  })

  it('returns short text unchanged', () => {
    expect(trimToUtf8ByteLimit('short', 500)).toBe('short')
  })
})
