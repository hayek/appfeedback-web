import type { ParsedFeedbackBody, ParsedAttachment } from './types'
import {
  DEVICE_HEADER, APP_LABEL, APP_VERSION_LABEL, DEVICE_LABEL, CONTACT_EMAIL_LABEL,
  HORIZONTAL_RULE, ATTACHMENTS_OPEN, ATTACHMENTS_CLOSE, OS_VERSION_REGEX,
} from './bodyMarkers'

function valueAfter(s: string, marker: string): string | null {
  return s.startsWith(marker) ? s.slice(marker.length).trim() : null
}

export function parseIssueBody(raw: string): ParsedFeedbackBody {
  // Normalize CRLF / lone CR to LF so web-UI-authored bodies parse identically.
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const descLines: string[] = []
  let inDevice = false
  let expectEmail = false
  let appName: string | null = null
  let appVersion: string | null = null
  let device: string | null = null
  let osVersion: string | null = null
  let email: string | null = null

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim().replaceAll('**', '').trim()

    if (trimmed === DEVICE_HEADER) { inDevice = true; continue }
    if (!inDevice) { descLines.push(line); continue }

    if (expectEmail) {
      if (trimmed.length > 0 && trimmed.includes('@')) email = trimmed
      expectEmail = false
      continue
    }

    const appVer = valueAfter(trimmed, APP_VERSION_LABEL)
    const app = valueAfter(trimmed, APP_LABEL)
    const dev = valueAfter(trimmed, DEVICE_LABEL)
    if (appVer !== null) appVersion = appVer
    else if (app !== null) appName = app
    else if (dev !== null) device = dev
    else if (OS_VERSION_REGEX.test(trimmed)) {
      osVersion = trimmed.split(':').slice(1).join(':').trim()
    } else if (trimmed === CONTACT_EMAIL_LABEL) {
      expectEmail = true
    } else {
      const v = valueAfter(trimmed, CONTACT_EMAIL_LABEL)
      if (v !== null) {
        if (v.includes('@')) email = v
        else expectEmail = true
      }
    }
  }

  const description = descLines
    .filter((l) => l.trim() !== HORIZONTAL_RULE)
    .join('\n')
    .trim()

  return {
    description,
    appName,
    appVersion,
    device,
    osVersion,
    email,
    attachments: parseAttachments(normalized),
  }
}

function parseAttachments(raw: string): ParsedAttachment[] {
  const openIdx = raw.indexOf(ATTACHMENTS_OPEN)
  if (openIdx < 0) return []
  const afterOpen = openIdx + ATTACHMENTS_OPEN.length
  const closeIdx = raw.indexOf(ATTACHMENTS_CLOSE, afterOpen)
  const block = closeIdx < 0 ? raw.slice(afterOpen) : raw.slice(afterOpen, closeIdx)

  const out: ParsedAttachment[] = []
  for (const rawLine of block.split('\n')) {
    const att = parseAttachmentLine(rawLine.trim())
    if (att) out.push(att)
  }
  return out
}

function parseAttachmentLine(line: string): ParsedAttachment | null {
  let working: string
  if (line.startsWith('![')) working = line.slice(2)
  else if (line.startsWith('[')) working = line.slice(1)
  else return null

  const nameEnd = working.indexOf('](')
  if (nameEnd < 0) return null
  const filename = working.slice(0, nameEnd)
  const afterName = working.slice(nameEnd + 2)
  const urlEnd = afterName.indexOf(')')
  if (urlEnd < 0) return null
  const url = afterName.slice(0, urlEnd)
  if (url.length === 0) return null
  const rest = afterName.slice(urlEnd + 1).trim()

  let mime: string | null = null
  let size: number | null = null
  if (rest.startsWith('—')) {
    const suffix = rest.slice(1).trim() // '—' is one UTF-16 unit (U+2014)
    const ci = suffix.indexOf(',')
    const mimeField = (ci < 0 ? suffix : suffix.slice(0, ci)).trim()
    const sizeField = ci < 0 ? null : suffix.slice(ci + 1).trim()
    mime = mimeField.length > 0 ? mimeField : null
    if (sizeField !== null) size = parseHumanByteCount(sizeField)
  }
  const resolvedMime = mime ?? inferMimeFromUrl(url)
  return { filename, mimeType: resolvedMime, url, sizeBytes: size }
}

export function parseHumanByteCount(s: string): number | null {
  const sp = s.indexOf(' ')
  const numStr = (sp < 0 ? s : s.slice(0, sp)).trim()
  const unit = sp < 0 ? 'B' : s.slice(sp + 1).trim().toUpperCase()
  if (numStr.length === 0) return null
  const num = Number(numStr)
  if (!Number.isFinite(num)) return null
  const mult = unit === 'KB' ? 1_000 : unit === 'MB' ? 1_000_000 : unit === 'GB' ? 1_000_000_000 : 1
  const scaled = num * mult
  if (!Number.isFinite(scaled) || scaled < 0 || scaled > 100_000_000_000_000) return null
  return Math.trunc(scaled)
}

/** Best-effort MIME from a URL's file extension (query/fragment stripped). Only
 *  used when the body line omits the MIME (not exercised by the conformance corpus). */
export function inferMimeFromUrl(url: string): string {
  const path = url.split(/[?#]/)[0]
  const lastSeg = path.slice(path.lastIndexOf('/') + 1)
  const dot = lastSeg.lastIndexOf('.')
  const ext = dot < 0 ? '' : lastSeg.slice(dot + 1).toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'heic': return 'image/heic'
    case 'webp': return 'image/webp'
    case 'pdf': return 'application/pdf'
    case 'log':
    case 'txt':
    case 'text': return 'text/plain'
    case 'json': return 'application/json'
    case 'xml': return 'application/xml'
    case 'csv': return 'text/csv'
    default: return 'application/octet-stream'
  }
}
