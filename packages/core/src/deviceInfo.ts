import type { DeviceInfo } from './types'
import { APP_LABEL, APP_VERSION_LABEL, DEVICE_LABEL, OS_VERSION_SUFFIX } from './bodyMarkers'

export function renderDeviceInfo(d: DeviceInfo): string {
  return (
    `${APP_LABEL} ${d.appName}\n` +
    `${APP_VERSION_LABEL} ${d.appVersion} (${d.buildNumber})\n` +
    `${DEVICE_LABEL} ${d.model}\n` +
    `${d.osName}${OS_VERSION_SUFFIX} ${d.osVersion}`
  )
}
