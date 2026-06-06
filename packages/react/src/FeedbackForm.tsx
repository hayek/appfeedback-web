import * as React from 'react'
import { useEffect, useRef } from 'react'
import { mountFeedbackWidget, type WidgetOptions } from '@appfeedback/widget'

export type FeedbackFormProps = WidgetOptions

/** Thin React wrapper: mounts the shared `@appfeedback/widget` into a div.
 *  One UI implementation, no duplication. Options are captured at mount. */
export function FeedbackForm(props: FeedbackFormProps): React.ReactElement {
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
