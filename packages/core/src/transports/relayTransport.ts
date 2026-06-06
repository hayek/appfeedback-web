import type { FeedbackTransport, FeedbackReport, DeviceInfo } from '../types'
import { FeedbackSubmissionError } from '../errors'

export interface RelayTransportConfig {
  /** Absolute URL of the adopter-operated relay (per relay-contract.md). */
  endpoint: string
  /** Optional bot-mitigation token provider (Turnstile/hCaptcha). */
  getCaptchaToken?: () => Promise<string | null> | string | null
  /** Injectable fetch (tests). Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
}

/** Default web transport: POSTs structured feedback to the adopter's relay,
 *  which holds the GitHub credential server-side. */
export class RelayTransport implements FeedbackTransport {
  constructor(private readonly config: RelayTransportConfig) {}

  async submit(report: FeedbackReport, deviceInfo: DeviceInfo): Promise<number> {
    const doFetch = this.config.fetchImpl ?? fetch
    const captchaToken = this.config.getCaptchaToken ? (await this.config.getCaptchaToken()) : null

    const payload = {
      type: report.type,
      title: report.title,
      description: report.description,
      contactEmail: report.contactEmail ?? null,
      extraFields: report.extraFields ?? {},
      deviceInfo,
      captchaToken: captchaToken ?? null,
    }

    let res: Response
    try {
      res = await doFetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      throw new FeedbackSubmissionError(`relay request failed: ${(e as Error).message}`)
    }

    if (!res.ok) {
      let message = `relay responded ${res.status}`
      try {
        const j = (await res.json()) as { error?: string }
        if (j?.error) message = j.error
      } catch { /* non-JSON error body */ }
      throw new FeedbackSubmissionError(message, res.status)
    }

    const data = (await res.json()) as { issueNumber: number }
    return data.issueNumber
  }
}
