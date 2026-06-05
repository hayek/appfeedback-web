import { describe, it, expect } from 'vitest'
import type { FeedbackTransport } from '../src/types'

describe('FeedbackTransport', () => {
  it('a fake transport satisfies the interface and returns an id', async () => {
    const fake: FeedbackTransport = {
      async submit() { return 42 },
    }
    expect(await fake.submit({ type: 'bug', title: 't', description: 'd' }, {
      appName: 'A', appVersion: '1', buildNumber: '1', model: 'M', osName: 'Web', osVersion: 'x',
    })).toBe(42)
  })
})
