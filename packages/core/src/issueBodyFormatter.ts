import type { FeedbackReport, DeviceInfo, UploadedAttachment, FeedbackType } from './types'
import { renderDeviceInfo } from './deviceInfo'
import { deterministicByteCount } from './deterministicByteCount'
import {
  HORIZONTAL_RULE, DEVICE_HEADER, CONTACT_EMAIL_LABEL,
  ATTACHMENTS_OPEN, ATTACHMENTS_CLOSE, ATTACHMENTS_HEADER, VOTES_FOOTER,
} from './bodyMarkers'

const USER_SUBMITTED_LABEL = 'user-submitted'

/** Ascending Unicode code-point order. Iterates code points (via spread), not
 *  UTF-16 units, so non-BMP keys order identically across platforms. */
export function codePointOrder(a: string, b: string): number {
  const ca = [...a]
  const cb = [...b]
  const n = Math.min(ca.length, cb.length)
  for (let i = 0; i < n; i++) {
    const d = ca[i].codePointAt(0)! - cb[i].codePointAt(0)!
    if (d !== 0) return d
  }
  return ca.length - cb.length // shorter (prefix) sorts first
}

export function labelsFor(type: FeedbackType): string[] {
  return [type, USER_SUBMITTED_LABEL]
}

export function formatIssueBody(
  report: FeedbackReport,
  deviceInfo: DeviceInfo,
  uploaded: UploadedAttachment[] = [],
): string {
  let body = report.description
  body += `\n\n${HORIZONTAL_RULE}\n**${DEVICE_HEADER}**\n${renderDeviceInfo(deviceInfo)}`

  if (report.contactEmail && report.contactEmail.length > 0) {
    body += `\n\n**${CONTACT_EMAIL_LABEL}**\n${report.contactEmail}`
  }

  const extra = report.extraFields ?? {}
  for (const key of Object.keys(extra).sort(codePointOrder)) {
    body += `\n\n**${key}:**\n${extra[key]}`
  }

  if (uploaded.length > 0) {
    body += `\n\n${ATTACHMENTS_OPEN}\n${ATTACHMENTS_HEADER}\n`
    for (const a of uploaded) {
      const prefix = a.mimeType.startsWith('image/') ? '!' : ''
      const size = deterministicByteCount(a.sizeBytes)
      body += `\n${prefix}[${a.filename}](${a.url}) — ${a.mimeType}, ${size}\n`
    }
    body += `\n${ATTACHMENTS_CLOSE}`
  }

  body += `\n\n${HORIZONTAL_RULE}\n${VOTES_FOOTER}`
  return body
}
