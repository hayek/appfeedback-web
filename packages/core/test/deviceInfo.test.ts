import { describe, it, expect } from 'vitest'
import { renderDeviceInfo } from '../src/deviceInfo'
import type { DeviceInfo } from '../src/types'

describe('renderDeviceInfo', () => {
  it('renders the device block exactly', () => {
    const d: DeviceInfo = {
      appName: 'Acme', appVersion: '1.2.3', buildNumber: '456',
      model: 'iPhone15,2', osName: 'iOS', osVersion: 'Version 18.2 (Build 22C150)',
    }
    expect(renderDeviceInfo(d)).toBe(
      'App: Acme\nApp Version: 1.2.3 (456)\nDevice: iPhone15,2\niOS Version: Version 18.2 (Build 22C150)',
    )
  })
})
