import { describe, it, expect } from 'vitest'
import { currentWebDeviceInfo } from '../src/deviceInfo'

describe('currentWebDeviceInfo', () => {
  it('fills app fields from options and platform fields from navigator', () => {
    const d = currentWebDeviceInfo({ appName: 'Acme', appVersion: '1.2.3' })
    expect(d.appName).toBe('Acme')
    expect(d.appVersion).toBe('1.2.3')
    expect(d.buildNumber).toBe('0')          // web default when unspecified
    expect(d.osName).toBe('Web')             // recognised by the inbox parser
    expect(typeof d.osVersion).toBe('string') // best-effort UA string
    expect(typeof d.model).toBe('string')
  })
})
