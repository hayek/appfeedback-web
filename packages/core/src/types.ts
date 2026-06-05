/** Bug report or feature request. The string IS the GitHub label value. */
export type FeedbackType = 'bug' | 'feature-request'

/** A single user-supplied feedback submission. */
export interface FeedbackReport {
  type: FeedbackType
  title: string
  description: string
  contactEmail?: string | null
  extraFields?: Record<string, string>
}

/** Per-submission device/app metadata. The navigator-based collector lands in P2b. */
export interface DeviceInfo {
  appName: string
  appVersion: string
  buildNumber: string
  model: string
  osName: string
  osVersion: string
}

/** An attachment already uploaded; drives the body's attachment block. */
export interface UploadedAttachment {
  filename: string
  mimeType: string
  sizeBytes: number
  url: string
}

export interface ParsedAttachment {
  filename: string
  mimeType: string
  url: string
  sizeBytes: number | null
}

export interface ParsedFeedbackBody {
  description: string
  appName: string | null
  appVersion: string | null
  device: string | null
  osVersion: string | null
  email: string | null
  attachments: ParsedAttachment[]
}

/** Where a report gets delivered. Concrete transports (relay, direct) land in P2b.
 *  Returns the backend-assigned identifier (GitHub issue number). */
export interface FeedbackTransport {
  submit(report: FeedbackReport, deviceInfo: DeviceInfo): Promise<number>
}
