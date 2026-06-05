import { describe, it, expect } from 'vitest'
import { parseIssueBody, parseHumanByteCount } from '../src/issueBodyParser'

describe('issueBodyParser', () => {
  it('parses device block + email', () => {
    const raw = 'Desc line.\n\n---\n**Device Information:**\nApp: Acme\nApp Version: 1.0 (1)\nDevice: Pixel 8\nAndroid Version: 14\n\n**Contact Email:**\nme@example.com\n\n---\n👍 Votes: 0'
    const p = parseIssueBody(raw)
    expect(p.description).toBe('Desc line.')
    expect(p.appName).toBe('Acme')
    expect(p.appVersion).toBe('1.0 (1)')
    expect(p.device).toBe('Pixel 8')
    expect(p.osVersion).toBe('14')
    expect(p.email).toBe('me@example.com')
  })
  it('normalizes CRLF', () => {
    const raw = 'D\r\n\r\n---\r\n**Device Information:**\r\nApp: A\r\nApp Version: 1 (1)\r\nDevice: M\r\nWeb Version: Chrome 120\r\n\r\n---\r\n👍 Votes: 0'
    const p = parseIssueBody(raw)
    expect(p.description).toBe('D')
    expect(p.osVersion).toBe('Chrome 120')
  })
  it('parses attachments and infers empty mime', () => {
    const raw = 'd\n\n---\n**Device Information:**\nApp: A\nApp Version: 1 (1)\nDevice: M\nmacOS Version: 15.1\n\n<!-- attachments-v1 -->\n## Attachments\n\n![shot.png](https://e.com/shot.png) — , 4 KB\n\n<!-- /attachments-v1 -->\n\n---\n👍 Votes: 0'
    const p = parseIssueBody(raw)
    expect(p.attachments.length).toBe(1)
    expect(p.attachments[0].mimeType).toBe('image/png')
    expect(p.attachments[0].sizeBytes).toBe(4000)
  })
  it('parseHumanByteCount handles units and rejects junk', () => {
    expect(parseHumanByteCount('312 KB')).toBe(312000)
    expect(parseHumanByteCount('4.1 KB')).toBe(4100)
    expect(parseHumanByteCount('3 GB')).toBe(3000000000)
    expect(parseHumanByteCount('')).toBe(null)
    expect(parseHumanByteCount('abc KB')).toBe(null)
  })
})
