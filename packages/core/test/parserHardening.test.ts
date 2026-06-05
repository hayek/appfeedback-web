import { describe, it, expect } from 'vitest'
import { parseHumanByteCount, inferMimeFromUrl } from '../src/issueBodyParser'

describe('parser hardening', () => {
  it('rejects non-finite and oversize byte counts', () => {
    expect(parseHumanByteCount('Infinity KB')).toBe(null)
    expect(parseHumanByteCount('NaN B')).toBe(null)
    expect(parseHumanByteCount('10000000000 GB')).toBe(null)
    expect(parseHumanByteCount('3 GB')).toBe(3_000_000_000)
  })
  it('infer strips query string', () => {
    expect(inferMimeFromUrl('https://e.com/shot.png?token=abc')).toBe('image/png')
  })
})
