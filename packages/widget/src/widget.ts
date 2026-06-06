import type { FeedbackTransport, FeedbackType, FeedbackReport } from '@appfeedback/core'
import { currentWebDeviceInfo } from './deviceInfo'

export interface WidgetTheme {
  /** Accent colour for the active type + submit button. */
  accent?: string
}

export interface WidgetCopy {
  bug: string
  feature: string
  title: string
  description: string
  email: string
  submit: string
  submitting: string
  success: string
  error: string
  validation: string
}

export interface WidgetOptions {
  transport: FeedbackTransport
  appName: string
  appVersion: string
  buildNumber?: string
  defaultType?: FeedbackType
  theme?: WidgetTheme
  copy?: Partial<WidgetCopy>
  onSubmit?: (issueNumber: number) => void
  onError?: (error: unknown) => void
}

export interface WidgetHandle {
  readonly root: HTMLElement
  unmount(): void
}

const DEFAULT_COPY: WidgetCopy = {
  bug: 'Bug',
  feature: 'Feature request',
  title: 'Summary',
  description: 'What happened?',
  email: 'Email (optional)',
  submit: 'Send feedback',
  submitting: 'Sending…',
  success: 'Thanks for the feedback!',
  error: 'Something went wrong. Please try again.',
  validation: 'Please add a summary and a description.',
}

const STYLE = `
.afb-widget{--afb-accent:#3b82f6;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;gap:8px;max-width:380px}
.afb-types{display:flex;gap:8px}
.afb-type{flex:1;padding:8px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;font:inherit}
.afb-type[aria-pressed="true"]{border-color:var(--afb-accent);color:var(--afb-accent);font-weight:600}
.afb-title,.afb-description,.afb-email{padding:8px;border:1px solid #d1d5db;border-radius:8px;font:inherit;width:100%;box-sizing:border-box}
.afb-description{min-height:84px;resize:vertical}
.afb-submit{padding:10px;border:0;border-radius:8px;background:var(--afb-accent);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.afb-submit:disabled{opacity:.6;cursor:default}
.afb-status{font-size:14px;min-height:18px}
.afb-status[data-state="invalid"],.afb-status[data-state="error"]{color:#dc2626}
.afb-status[data-state="success"]{color:#16a34a}
`

function elem<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = className
  return e
}

/** Mounts a self-contained feedback form into `target`. Returns a handle whose
 *  `unmount()` removes it. UI is built with `textContent`/properties (no
 *  innerHTML), so caller-supplied copy can't inject markup. */
export function mountFeedbackWidget(target: HTMLElement, options: WidgetOptions): WidgetHandle {
  const copy = { ...DEFAULT_COPY, ...options.copy }
  let type: FeedbackType = options.defaultType ?? 'bug'

  const root = elem('div', 'afb-widget')
  root.setAttribute('data-appfeedback', 'widget')
  if (options.theme?.accent) root.style.setProperty('--afb-accent', options.theme.accent)

  const style = document.createElement('style')
  style.textContent = STYLE
  root.appendChild(style)

  // Type toggle
  const types = elem('div', 'afb-types')
  types.setAttribute('role', 'group')
  const makeType = (t: FeedbackType, label: string): HTMLButtonElement => {
    const b = elem('button', 'afb-type')
    b.type = 'button'
    b.dataset.type = t
    b.textContent = label
    b.setAttribute('aria-pressed', String(t === type))
    return b
  }
  const bugBtn = makeType('bug', copy.bug)
  const featBtn = makeType('feature-request', copy.feature)
  types.append(bugBtn, featBtn)

  const titleInput = elem('input', 'afb-title')
  titleInput.type = 'text'
  titleInput.placeholder = copy.title
  titleInput.setAttribute('aria-label', copy.title)

  const descInput = elem('textarea', 'afb-description')
  descInput.placeholder = copy.description
  descInput.setAttribute('aria-label', copy.description)

  const emailInput = elem('input', 'afb-email')
  emailInput.type = 'email'
  emailInput.placeholder = copy.email
  emailInput.setAttribute('aria-label', copy.email)

  const submitBtn = elem('button', 'afb-submit')
  submitBtn.type = 'button'
  submitBtn.textContent = copy.submit

  const status = elem('div', 'afb-status')
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  function setType(t: FeedbackType): void {
    type = t
    bugBtn.setAttribute('aria-pressed', String(t === 'bug'))
    featBtn.setAttribute('aria-pressed', String(t === 'feature-request'))
  }
  bugBtn.addEventListener('click', () => setType('bug'))
  featBtn.addEventListener('click', () => setType('feature-request'))

  function setStatus(text: string, state: string): void {
    status.textContent = text
    status.dataset.state = state
  }

  async function submit(): Promise<void> {
    const title = titleInput.value.trim()
    const description = descInput.value.trim()
    if (!title || !description) {
      setStatus(copy.validation, 'invalid')
      return
    }
    submitBtn.disabled = true
    submitBtn.textContent = copy.submitting
    setStatus('', 'submitting')
    const report: FeedbackReport = {
      type,
      title,
      description,
      contactEmail: emailInput.value.trim() || null,
      extraFields: {},
    }
    const device = currentWebDeviceInfo({
      appName: options.appName,
      appVersion: options.appVersion,
      buildNumber: options.buildNumber,
    })
    try {
      const issueNumber = await options.transport.submit(report, device)
      setStatus(copy.success, 'success')
      root.dataset.submitted = String(issueNumber)
      options.onSubmit?.(issueNumber)
    } catch (error) {
      setStatus(copy.error, 'error')
      submitBtn.disabled = false
      submitBtn.textContent = copy.submit
      options.onError?.(error)
    }
  }
  submitBtn.addEventListener('click', () => { void submit() })

  root.append(types, titleInput, descInput, emailInput, submitBtn, status)
  target.appendChild(root)

  return { root, unmount: () => root.remove() }
}
