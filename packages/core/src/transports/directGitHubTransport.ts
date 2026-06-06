import type { FeedbackTransport, FeedbackReport, DeviceInfo } from '../types'
import { formatIssueBody, labelsFor } from '../issueBodyFormatter'
import { FeedbackSubmissionError } from '../errors'

export interface DirectGitHubTransportConfig {
  owner: string
  repo: string
  token: string
  /** REQUIRED. Shipping a writable token in browser JS is world-readable —
   *  use RelayTransport in production. This flag exists to make the risk explicit. */
  dangerouslyUseClientToken: true
  fetchImpl?: typeof fetch
}

/** Dev/internal-only transport that calls GitHub directly with a client-held
 *  token. NEVER deploy on a public site — the token is world-readable. */
export class DirectGitHubTransport implements FeedbackTransport {
  constructor(private readonly config: DirectGitHubTransportConfig) {
    if (config.dangerouslyUseClientToken !== true) {
      throw new Error(
        'DirectGitHubTransport requires `dangerouslyUseClientToken: true`. It exposes a ' +
        'writable GitHub token in the browser (world-readable). Use RelayTransport in production.',
      )
    }
  }

  async submit(report: FeedbackReport, deviceInfo: DeviceInfo): Promise<number> {
    const doFetch = this.config.fetchImpl ?? fetch
    const url = `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/issues`
    const payload = {
      title: report.title,
      body: formatIssueBody(report, deviceInfo),
      labels: labelsFor(report.type),
    }

    let res: Response
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      throw new FeedbackSubmissionError(`GitHub request failed: ${(e as Error).message}`)
    }

    if (!res.ok) {
      throw new FeedbackSubmissionError(`GitHub responded ${res.status}`, res.status)
    }
    const data = (await res.json()) as { number: number }
    return data.number
  }
}
