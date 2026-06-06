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
