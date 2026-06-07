import { formatIssueBody, labelsFor, type FeedbackReport, type DeviceInfo, type FeedbackType } from '@appfeedback/core'

/**
 * The wire payload accepted by {@link handleFeedback}.
 *
 * Note on attachments: the AppFeedback spec defines an optional `attachments`
 * field, but this reference handler does NOT process uploads — it only opens a
 * GitHub issue from the text fields below. If you need attachment support,
 * implement the upload yourself in your adapter (store the file, then embed the
 * resulting URL in `description`/`extraFields` before calling this handler).
 */
export interface RelayRequest {
  type: FeedbackType
  title: string
  description: string
  contactEmail?: string | null
  extraFields?: Record<string, string>
  deviceInfo: DeviceInfo
  captchaToken?: string | null
}

export interface RelayConfig {
  githubToken: string
  owner: string
  repo: string
  /** Optional bot-mitigation check. Return false to reject (403). */
  verifyCaptcha?: (token: string | null) => Promise<boolean> | boolean
  fetchImpl?: typeof fetch
}

export interface RelayResult {
  issueNumber: number
  issueUrl: string
}

/** Error carrying the HTTP status an adapter should return. */
export class RelayError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'RelayError'
  }
}

const VALID_TYPES: ReadonlyArray<string> = ['bug', 'feature-request']

/** Validate → (CAPTCHA) → format → create GitHub issue. Holds the credential
 *  server-side; the browser never sees it.
 *
 *  Attachments are not handled: this reference handler ignores any uploads and
 *  only creates an issue from the text fields. Adopters needing file uploads
 *  must implement them in their own adapter (see {@link RelayRequest}). */
export async function handleFeedback(req: RelayRequest, config: RelayConfig): Promise<RelayResult> {
  if (
    !req || !VALID_TYPES.includes(req.type) ||
    typeof req.title !== 'string' || req.title.length === 0 ||
    typeof req.description !== 'string' || req.description.length === 0 ||
    !req.deviceInfo || typeof req.deviceInfo.osName !== 'string'
  ) {
    throw new RelayError('invalid submission', 400)
  }

  if (config.verifyCaptcha) {
    const ok = await config.verifyCaptcha(req.captchaToken ?? null)
    if (!ok) throw new RelayError('captcha verification failed', 403)
  }

  const report: FeedbackReport = {
    type: req.type,
    title: req.title,
    description: req.description,
    contactEmail: req.contactEmail ?? null,
    extraFields: req.extraFields ?? {},
  }
  const body = formatIssueBody(report, req.deviceInfo)
  const labels = labelsFor(req.type)

  const doFetch = config.fetchImpl ?? fetch
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues`
  let res: Response
  try {
    res = await doFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title: req.title, body, labels }),
    })
  } catch (e) {
    throw new RelayError(`GitHub upstream request failed: ${(e as Error).message}`, 502)
  }
  // Preserve GitHub's rate-limit signal (429) instead of collapsing it to 502,
  // so adopters can surface "try again later" and back off.
  if (res.status === 429) throw new RelayError('GitHub rate limit exceeded', 429)
  if (!res.ok) throw new RelayError(`GitHub upstream error (${res.status})`, 502)

  const data = (await res.json()) as { number: number; html_url: string }
  return { issueNumber: data.number, issueUrl: data.html_url }
}
