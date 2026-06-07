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
  /** Accessible name for the feedback-type radiogroup (`aria-label`). */
  typeGroup: string
  /** Accessible name for the form element (`aria-label`), distinct from the submit button. */
  formLabel: string
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
  typeGroup: 'Feedback type',
  formLabel: 'Feedback form',
}

const STYLE = `
.afb-widget{--afb-accent:#3b82f6;font-family:system-ui,-apple-system,sans-serif;max-width:380px}
.afb-form{display:flex;flex-direction:column;gap:8px}
.afb-types{display:flex;gap:8px}
.afb-type{flex:1;padding:8px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;font:inherit}
.afb-type[aria-checked="true"]{border-color:var(--afb-accent);color:var(--afb-accent);font-weight:600}
.afb-title,.afb-description,.afb-email{padding:8px;border:1px solid #d1d5db;border-radius:8px;font:inherit;width:100%;box-sizing:border-box}
.afb-title[aria-invalid="true"],.afb-description[aria-invalid="true"]{border-color:#dc2626}
.afb-description{min-height:84px;resize:vertical}
.afb-submit{padding:10px;border:0;border-radius:8px;background:var(--afb-accent);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.afb-submit:disabled{opacity:.6;cursor:default}
.afb-widget :focus-visible{outline:2px solid var(--afb-accent);outline-offset:2px}
.afb-status{font-size:14px;min-height:18px}
/* Two stacked live regions share .afb-status; only one holds text at a time.
   The empty one collapses (but stays in the a11y tree — not display:none — so it
   can still announce), keeping the widget visually identical to a single region. */
.afb-status:empty{min-height:0}
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

  // Type toggle — exposed as a radio group so assistive tech announces it as a
  // single-select control rather than two independent toggle buttons.
  const types = elem('div', 'afb-types')
  types.setAttribute('role', 'radiogroup')
  types.setAttribute('aria-label', copy.typeGroup)
  const makeType = (t: FeedbackType, label: string): HTMLButtonElement => {
    const b = elem('button', 'afb-type')
    b.type = 'button'
    b.dataset.type = t
    b.textContent = label
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-checked', String(t === type))
    // Roving tabindex: only the checked radio is in the tab order.
    b.tabIndex = t === type ? 0 : -1
    return b
  }
  const bugBtn = makeType('bug', copy.bug)
  const featBtn = makeType('feature-request', copy.feature)
  types.append(bugBtn, featBtn)

  const form = document.createElement('form')
  form.className = 'afb-form'
  form.setAttribute('aria-label', copy.formLabel)
  form.noValidate = true

  const titleInput = elem('input', 'afb-title')
  titleInput.type = 'text'
  titleInput.placeholder = copy.title
  titleInput.setAttribute('aria-label', copy.title)
  titleInput.setAttribute('aria-required', 'true')

  const descInput = elem('textarea', 'afb-description')
  descInput.placeholder = copy.description
  descInput.setAttribute('aria-label', copy.description)
  descInput.setAttribute('aria-required', 'true')

  const emailInput = elem('input', 'afb-email')
  emailInput.type = 'email'
  emailInput.placeholder = copy.email
  emailInput.setAttribute('aria-label', copy.email)

  const submitBtn = elem('button', 'afb-submit')
  submitBtn.type = 'submit'
  submitBtn.textContent = copy.submit

  // Two stable, persistent live regions instead of one node that flips its
  // role/aria-live: some screen readers don't reliably re-announce when those
  // attributes mutate on a long-lived node. Polite region carries success /
  // submitting; assertive region carries errors / validation. Exactly one holds
  // text at a time (the other is cleared), so only one is announced.
  const politeStatus = elem('div', 'afb-status afb-status--polite')
  politeStatus.setAttribute('role', 'status')
  politeStatus.setAttribute('aria-live', 'polite')

  const assertiveStatus = elem('div', 'afb-status afb-status--assertive')
  assertiveStatus.setAttribute('role', 'alert')
  assertiveStatus.setAttribute('aria-live', 'assertive')

  function setType(t: FeedbackType): void {
    type = t
    const radios: [HTMLButtonElement, FeedbackType][] = [[bugBtn, 'bug'], [featBtn, 'feature-request']]
    for (const [btn, value] of radios) {
      const checked = value === t
      btn.setAttribute('aria-checked', String(checked))
      btn.tabIndex = checked ? 0 : -1
    }
  }
  bugBtn.addEventListener('click', () => setType('bug'))
  featBtn.addEventListener('click', () => setType('feature-request'))
  // Arrow-key movement within the radio group (WAI-ARIA radio pattern).
  const moveType = (next: FeedbackType, focusBtn: HTMLButtonElement): void => {
    setType(next)
    focusBtn.focus()
  }
  for (const btn of [bugBtn, featBtn]) {
    btn.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        moveType('feature-request', featBtn)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        moveType('bug', bugBtn)
      }
    })
  }

  // Clear the invalid flag as soon as the user supplies a value.
  const clearInvalidOn = (el: HTMLInputElement | HTMLTextAreaElement): void => {
    el.addEventListener('input', () => {
      if (el.value.trim()) el.removeAttribute('aria-invalid')
    })
  }
  clearInvalidOn(titleInput)
  clearInvalidOn(descInput)

  function setStatus(text: string, state: string): void {
    // Errors/validation go to the assertive region; success/submitting to the
    // polite one. Write text into exactly one region and clear the other so only
    // the intended live region announces. `data-state` is mirrored onto both for
    // styling/queryability; the empty region collapses via `.afb-status:empty`.
    const assertive = state === 'error' || state === 'invalid'
    const active = assertive ? assertiveStatus : politeStatus
    const inactive = assertive ? politeStatus : assertiveStatus
    active.textContent = text
    inactive.textContent = ''
    politeStatus.dataset.state = state
    assertiveStatus.dataset.state = state
  }

  async function submit(): Promise<void> {
    const title = titleInput.value.trim()
    const description = descInput.value.trim()
    titleInput.setAttribute('aria-invalid', String(!title))
    descInput.setAttribute('aria-invalid', String(!description))
    if (!title || !description) {
      setStatus(copy.validation, 'invalid')
      // Move focus to the first invalid field so its error is discoverable.
      ;(!title ? titleInput : descInput).focus()
      return
    }
    titleInput.removeAttribute('aria-invalid')
    descInput.removeAttribute('aria-invalid')
    submitBtn.disabled = true
    submitBtn.setAttribute('aria-busy', 'true')
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
      submitBtn.removeAttribute('aria-busy')
      root.dataset.submitted = String(issueNumber)
      options.onSubmit?.(issueNumber)
    } catch (error) {
      setStatus(copy.error, 'error')
      submitBtn.disabled = false
      submitBtn.removeAttribute('aria-busy')
      submitBtn.textContent = copy.submit
      options.onError?.(error)
    }
  }
  // Submitting via the form lets Enter in any field submit; preventDefault keeps
  // the SPA from navigating and routes through the existing async handler.
  form.addEventListener('submit', (e: SubmitEvent) => {
    e.preventDefault()
    void submit()
  })

  form.append(types, titleInput, descInput, emailInput, submitBtn, politeStatus, assertiveStatus)
  root.appendChild(form)
  target.appendChild(root)

  return { root, unmount: () => root.remove() }
}
