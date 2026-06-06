# P2b-2 — Web Widget + React Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a framework-agnostic `@appfeedback/widget` (a drop-in feedback form mirroring the iOS/Android sheet) and a thin `@appfeedback/react` wrapper, plus the browser `DeviceInfo` collector — all jsdom-tested.

**Architecture:** `mountFeedbackWidget(target, options)` renders a self-contained form (type toggle → title → description → optional email → submit, with success/error states) using plain DOM (no framework, XSS-safe via `textContent`/properties), themeable via a CSS custom property. On submit it collects browser `DeviceInfo`, builds a `FeedbackReport`, and calls the injected `FeedbackTransport` (normally `RelayTransport`). `@appfeedback/react`'s `<FeedbackForm>` is a thin wrapper that mounts the same widget into a ref'd `<div>` (one UI implementation, no duplication). Tests run under vitest's jsdom environment with a mock transport.

**Tech Stack:** TypeScript 5.7+, vitest 2.1+ (jsdom env), jsdom 25, React 18.3 + `@testing-library/react` 16, pnpm workspace. No network in tests.

**Reference:** `@appfeedback/core` exports `FeedbackTransport`, `FeedbackReport`, `FeedbackType`, `DeviceInfo`.

---

## Conventions
- Repo: `/Users/amir/Developer/appfeedback-web`. Prefix commands with `cd /Users/amir/Developer/appfeedback-web && …`.
- Widget tests: `cd /Users/amir/Developer/appfeedback-web/packages/widget && pnpm test`. React tests: `… packages/react && pnpm test`. Workspace: `pnpm -r test` / `pnpm -r typecheck` from root.
- After creating a package's `package.json`, run `cd /Users/amir/Developer/appfeedback-web && pnpm install` to link workspace deps before importing across packages.

---

### Task 1: Scaffold `@appfeedback/widget` + browser DeviceInfo collector

**Files:** Create `packages/widget/{package.json,tsconfig.json,vitest.config.ts}`, `packages/widget/src/deviceInfo.ts`. Test: `packages/widget/test/deviceInfo.test.ts`.

- [ ] **Step 1: `packages/widget/package.json`**
```json
{
  "name": "@appfeedback/widget",
  "version": "0.1.0",
  "description": "Framework-agnostic feedback widget for AppFeedback.",
  "type": "module",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@appfeedback/core": "workspace:*" },
  "devDependencies": { "jsdom": "^25.0.0", "typescript": "^5.7.0", "vitest": "^2.1.0" }
}
```

- [ ] **Step 2: `packages/widget/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "resolveJsonModule": true, "esModuleInterop": true,
    "strict": true, "skipLibCheck": true, "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: `packages/widget/vitest.config.ts`**
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'jsdom' } })
```

- [ ] **Step 4: `cd /Users/amir/Developer/appfeedback-web && pnpm install 2>&1 | tail -6`** (links `@appfeedback/core`).

- [ ] **Step 5: Write the failing test** — `packages/widget/test/deviceInfo.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { currentWebDeviceInfo } from '../src/deviceInfo'

describe('currentWebDeviceInfo', () => {
  it('fills app fields from options and platform fields from navigator', () => {
    const d = currentWebDeviceInfo({ appName: 'Acme', appVersion: '1.2.3' })
    expect(d.appName).toBe('Acme')
    expect(d.appVersion).toBe('1.2.3')
    expect(d.buildNumber).toBe('0')          // web default when unspecified
    expect(d.osName).toBe('Web')             // recognised by the inbox parser
    expect(typeof d.osVersion).toBe('string') // best-effort UA string
    expect(typeof d.model).toBe('string')
  })
})
```

- [ ] **Step 6: Run → fail** — `cd /Users/amir/Developer/appfeedback-web/packages/widget && pnpm test 2>&1 | tail -8` (unresolved import).

- [ ] **Step 7: Implement** — `packages/widget/src/deviceInfo.ts`:
```ts
import type { DeviceInfo } from '@appfeedback/core'

export interface WebDeviceInfoOptions {
  appName: string
  appVersion: string
  buildNumber?: string
}

/** Best-effort device info from the browser. The web exposes far less than
 *  native, so `model`/`osVersion` are coarse. `osName` is always "Web" (a
 *  recognised inbox OS name). */
export function currentWebDeviceInfo(opts: WebDeviceInfoOptions): DeviceInfo {
  const nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined
  const uaData = (nav as unknown as { userAgentData?: { platform?: string } })?.userAgentData
  const platform = uaData?.platform || (nav as unknown as { platform?: string })?.platform || 'Unknown'
  return {
    appName: opts.appName,
    appVersion: opts.appVersion,
    buildNumber: opts.buildNumber ?? '0',
    model: String(platform),
    osName: 'Web',
    osVersion: nav?.userAgent ?? 'Unknown',
  }
}
```

- [ ] **Step 8: Run → pass; commit**
```bash
cd /Users/amir/Developer/appfeedback-web/packages/widget && pnpm test 2>&1 | tail -6
cd /Users/amir/Developer/appfeedback-web && git add -A && git commit -q -m "feat(widget): scaffold + browser DeviceInfo collector"
```

---

### Task 2: `mountFeedbackWidget`

**Files:** Create `packages/widget/src/widget.ts`, `packages/widget/src/index.ts`. Test: `packages/widget/test/widget.test.ts`.

- [ ] **Step 1: Write the failing test** — `packages/widget/test/widget.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountFeedbackWidget } from '../src/widget'
import type { FeedbackTransport } from '@appfeedback/core'

function mount(transport: FeedbackTransport) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const handle = mountFeedbackWidget(target, { transport, appName: 'Acme', appVersion: '1.0' })
  return { target, handle }
}
const q = <T extends Element>(t: Element, s: string) => t.querySelector(s) as T

beforeEach(() => { document.body.innerHTML = '' })

describe('mountFeedbackWidget', () => {
  it('renders the form scaffold', () => {
    const { target } = mount({ submit: vi.fn(async () => 1) })
    expect(q(target, '[data-appfeedback="widget"]')).toBeTruthy()
    expect(q(target, '.afb-title')).toBeTruthy()
    expect(q(target, '.afb-description')).toBeTruthy()
    expect(q(target, '.afb-submit')).toBeTruthy()
    expect(target.querySelectorAll('.afb-type').length).toBe(2)
  })

  it('submits a bug report and shows success', async () => {
    const submit = vi.fn(async () => 42)
    const { target } = mount({ submit })
    q<HTMLInputElement>(target, '.afb-title').value = 'Crash'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'It broke'
    q<HTMLInputElement>(target, '.afb-email').value = 'me@x.com'
    q<HTMLButtonElement>(target, '.afb-submit').click()
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    const [report, device] = submit.mock.calls[0]
    expect(report).toMatchObject({ type: 'bug', title: 'Crash', description: 'It broke', contactEmail: 'me@x.com' })
    expect(device.osName).toBe('Web')
    await vi.waitFor(() => expect(q(target, '.afb-status').getAttribute('data-state')).toBe('success'))
  })

  it('does not submit with empty title or description', () => {
    const submit = vi.fn(async () => 1)
    const { target } = mount({ submit })
    q<HTMLButtonElement>(target, '.afb-submit').click()
    expect(submit).not.toHaveBeenCalled()
    expect(q(target, '.afb-status').getAttribute('data-state')).toBe('invalid')
  })

  it('switches type to feature-request', async () => {
    const submit = vi.fn(async () => 1)
    const { target } = mount({ submit })
    q<HTMLButtonElement>(target, '.afb-type[data-type="feature-request"]').click()
    q<HTMLInputElement>(target, '.afb-title').value = 'Dark mode'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'please'
    q<HTMLButtonElement>(target, '.afb-submit').click()
    await vi.waitFor(() => expect(submit.mock.calls[0][0].type).toBe('feature-request'))
  })

  it('shows an error state when the transport rejects', async () => {
    const submit = vi.fn(async () => { throw new Error('nope') })
    const { target } = mount({ submit })
    q<HTMLInputElement>(target, '.afb-title').value = 'X'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'Y'
    q<HTMLButtonElement>(target, '.afb-submit').click()
    await vi.waitFor(() => expect(q(target, '.afb-status').getAttribute('data-state')).toBe('error'))
    expect(q<HTMLButtonElement>(target, '.afb-submit').disabled).toBe(false) // re-enabled to retry
  })

  it('omits empty email as null', async () => {
    const submit = vi.fn(async () => 1)
    const { target } = mount({ submit })
    q<HTMLInputElement>(target, '.afb-title').value = 'X'
    q<HTMLTextAreaElement>(target, '.afb-description').value = 'Y'
    q<HTMLButtonElement>(target, '.afb-submit').click()
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())
    expect(submit.mock.calls[0][0].contactEmail).toBeNull()
  })

  it('unmount removes the widget', () => {
    const { target, handle } = mount({ submit: vi.fn(async () => 1) })
    handle.unmount()
    expect(target.querySelector('[data-appfeedback="widget"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run → fail** — `cd /Users/amir/Developer/appfeedback-web/packages/widget && pnpm test 2>&1 | tail -8`.

- [ ] **Step 3: Implement** — `packages/widget/src/widget.ts`:
```ts
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
```

- [ ] **Step 4: `packages/widget/src/index.ts`**
```ts
export {
  mountFeedbackWidget,
  type WidgetOptions,
  type WidgetHandle,
  type WidgetTheme,
  type WidgetCopy,
} from './widget'
export { currentWebDeviceInfo, type WebDeviceInfoOptions } from './deviceInfo'
```

- [ ] **Step 5: Run → pass; typecheck; commit**
```bash
cd /Users/amir/Developer/appfeedback-web/packages/widget && pnpm test 2>&1 | tail -8 && pnpm typecheck 2>&1 | tail -3
cd /Users/amir/Developer/appfeedback-web && git add -A && git commit -q -m "feat(widget): mountFeedbackWidget feedback form (type toggle, validation, success/error)"
```

---

### Task 3: `@appfeedback/react` wrapper

**Files:** Create `packages/react/{package.json,tsconfig.json,vitest.config.ts}`, `packages/react/src/{FeedbackForm.tsx,index.ts}`. Test: `packages/react/test/FeedbackForm.test.tsx`.

- [ ] **Step 1: `packages/react/package.json`**
```json
{
  "name": "@appfeedback/react",
  "version": "0.1.0",
  "description": "React wrapper for the AppFeedback widget.",
  "type": "module",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@appfeedback/widget": "workspace:*", "@appfeedback/core": "workspace:*" },
  "peerDependencies": { "react": ">=18 <20", "react-dom": ">=18 <20" },
  "devDependencies": {
    "@testing-library/react": "^16.0.0", "jsdom": "^25.0.0",
    "react": "^18.3.1", "react-dom": "^18.3.1",
    "typescript": "^5.7.0", "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: `packages/react/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"], "jsx": "react-jsx",
    "esModuleInterop": true, "strict": true, "skipLibCheck": true, "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: `packages/react/vitest.config.ts`**
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'jsdom' } })
```

- [ ] **Step 4: `cd /Users/amir/Developer/appfeedback-web && pnpm install 2>&1 | tail -6`** (links workspace deps + React).

- [ ] **Step 5: Write the failing test** — `packages/react/test/FeedbackForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FeedbackForm } from '../src/FeedbackForm'
import type { FeedbackTransport } from '@appfeedback/core'

beforeEach(() => cleanup())

describe('FeedbackForm', () => {
  it('mounts the widget into the React tree', () => {
    const transport: FeedbackTransport = { submit: vi.fn(async () => 1) }
    const { container } = render(<FeedbackForm transport={transport} appName="Acme" appVersion="1.0" />)
    expect(container.querySelector('[data-appfeedback="widget"]')).toBeTruthy()
    expect(container.querySelector('.afb-submit')).toBeTruthy()
  })

  it('submits through the underlying widget', async () => {
    const submit = vi.fn(async () => 7)
    const { container } = render(<FeedbackForm transport={{ submit }} appName="Acme" appVersion="1.0" />)
    ;(container.querySelector('.afb-title') as HTMLInputElement).value = 'T'
    ;(container.querySelector('.afb-description') as HTMLTextAreaElement).value = 'D'
    ;(container.querySelector('.afb-submit') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    expect(submit.mock.calls[0][0]).toMatchObject({ type: 'bug', title: 'T', description: 'D' })
  })

  it('unmounts the widget on React unmount', () => {
    const { container, unmount } = render(<FeedbackForm transport={{ submit: vi.fn(async () => 1) }} appName="Acme" appVersion="1.0" />)
    unmount()
    expect(container.querySelector('[data-appfeedback="widget"]')).toBeNull()
  })
})
```

- [ ] **Step 6: Run → fail** — `cd /Users/amir/Developer/appfeedback-web/packages/react && pnpm test 2>&1 | tail -8`.

- [ ] **Step 7: Implement** — `packages/react/src/FeedbackForm.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { mountFeedbackWidget, type WidgetOptions } from '@appfeedback/widget'

export type FeedbackFormProps = WidgetOptions

/** Thin React wrapper: mounts the shared `@appfeedback/widget` into a div.
 *  One UI implementation, no duplication. Options are captured at mount. */
export function FeedbackForm(props: FeedbackFormProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const target = containerRef.current
    if (!target) return
    const handle = mountFeedbackWidget(target, propsRef.current)
    return () => handle.unmount()
  }, [])

  return <div ref={containerRef} />
}
```

`packages/react/src/index.ts`:
```ts
export { FeedbackForm, type FeedbackFormProps } from './FeedbackForm'
```

- [ ] **Step 8: Run → pass; typecheck; commit**
```bash
cd /Users/amir/Developer/appfeedback-web/packages/react && pnpm test 2>&1 | tail -8 && pnpm typecheck 2>&1 | tail -3
cd /Users/amir/Developer/appfeedback-web && git add -A && git commit -q -m "feat(react): FeedbackForm wrapper around the widget"
```

> If `JSX.Element` is unresolved under the React 18 types, change the return type to `React.ReactElement` and `import * as React from 'react'`, or remove the explicit return annotation (let it infer). Pick whichever typechecks; do not add `@types/react` pinning beyond what React 18.3 brings.

---

### Task 4: Final verification

```bash
cd /Users/amir/Developer/appfeedback-web && pnpm -r test 2>&1 | tail -20
cd /Users/amir/Developer/appfeedback-web && pnpm -r typecheck 2>&1 | tail -8
cd /Users/amir/Developer/appfeedback-web && git log --oneline | head -8 && git status --short
```
Expected: all four packages green (core, relay, widget, react); typecheck clean; commits for Tasks 1–3; clean tree.

---

## Self-Review (plan author)

**Spec coverage (design §6, P2b-2 slice):** ✅ framework-agnostic widget (`mountFeedbackWidget`, Tasks 1–2); ✅ React wrapper (Task 3); ✅ `navigator`-based `DeviceInfo` collector with `osName: "Web"` (Task 1); ✅ themeable (CSS custom property) + customizable copy; ✅ uses the injected `FeedbackTransport` (normally `RelayTransport` from P2b-1). Deferred to P2c: tsup dual ESM/CJS build, npm publish, `'use client'` directive for RSC; deferred/optional: a `<appfeedback-widget>` custom element (the mount function is the framework-agnostic primitive), attachments, Vue/Svelte adapters.

**jsdom discipline:** every package with DOM code sets `environment: 'jsdom'`; transports are mocked (`vi.fn`), no network. React in `peerDependencies` (`>=18 <20`), real React only a devDependency for tests.

**Placeholder scan:** none; every step has complete code/commands (the one `JSX.Element` note is a typed fallback instruction, not a placeholder).

**Type/name consistency:** `mountFeedbackWidget`/`WidgetOptions`/`WidgetHandle`/`WidgetTheme`/`WidgetCopy`, `currentWebDeviceInfo`/`WebDeviceInfoOptions`, `FeedbackForm`/`FeedbackFormProps` are consistent across tasks; the widget imports `FeedbackTransport`/`FeedbackReport`/`FeedbackType`/`DeviceInfo` from `@appfeedback/core`; `@appfeedback/react` imports `mountFeedbackWidget`/`WidgetOptions` from `@appfeedback/widget`. CSS classes (`afb-widget`/`afb-type`/`afb-title`/`afb-description`/`afb-email`/`afb-submit`/`afb-status`) and the `data-appfeedback="widget"` / `data-state` attributes match between `widget.ts` and both test files.
