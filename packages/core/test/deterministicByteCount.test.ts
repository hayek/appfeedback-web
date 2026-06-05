import { describe, it, expect } from 'vitest'
import { deterministicByteCount as fmt } from '../src/deterministicByteCount'

describe('deterministicByteCount', () => {
  it('bytes', () => {
    expect(fmt(0)).toBe('0 B')
    expect(fmt(-5)).toBe('0 B')
    expect(fmt(512)).toBe('512 B')
    expect(fmt(999)).toBe('999 B')
  })
  it('kilobytes half-up', () => {
    expect(fmt(1000)).toBe('1 KB')
    expect(fmt(1234)).toBe('1.2 KB')
    expect(fmt(1050)).toBe('1.1 KB')
    expect(fmt(1500)).toBe('1.5 KB')
    expect(fmt(4096)).toBe('4.1 KB')
    expect(fmt(319488)).toBe('319.5 KB')
  })
  it('mb/gb, no-carry, large', () => {
    expect(fmt(2000000)).toBe('2 MB')
    expect(fmt(1500000)).toBe('1.5 MB')
    expect(fmt(999999)).toBe('1000 KB')
    expect(fmt(1000000000)).toBe('1 GB')
    expect(fmt(3000000000)).toBe('3 GB')
  })
})
