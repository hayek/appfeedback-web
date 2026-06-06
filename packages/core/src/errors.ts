/** Thrown by transports when a submission fails. `status` is the HTTP status
 *  from the relay or GitHub when applicable. */
export class FeedbackSubmissionError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'FeedbackSubmissionError'
  }
}
