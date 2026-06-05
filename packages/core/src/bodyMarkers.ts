/** The string literals that make up the wire contract. Mirrors the Swift/Kotlin
 *  BodyMarker; one definition so the ends can't drift. */
export const DEVICE_HEADER = 'Device Information:'
export const APP_LABEL = 'App:'
export const APP_VERSION_LABEL = 'App Version:'
export const DEVICE_LABEL = 'Device:'
export const OS_VERSION_SUFFIX = ' Version:'
export const CONTACT_EMAIL_LABEL = 'Contact Email:'
export const HORIZONTAL_RULE = '---'
export const VOTES_FOOTER = '👍 Votes: 0'
export const ATTACHMENTS_OPEN = '<!-- attachments-v1 -->'
export const ATTACHMENTS_CLOSE = '<!-- /attachments-v1 -->'
export const ATTACHMENTS_HEADER = '## Attachments'

export const RECOGNISED_OS_NAMES = [
  'OS', 'macOS', 'iOS', 'iPadOS', 'watchOS', 'tvOS', 'visionOS',
  'Android', 'Windows', 'Linux', 'Web', 'ChromeOS',
] as const

export const OS_VERSION_REGEX = new RegExp(`^(${RECOGNISED_OS_NAMES.join('|')}) Version:`, 'i')
