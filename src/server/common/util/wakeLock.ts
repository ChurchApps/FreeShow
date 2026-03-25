// prevent device sleep
// it only works in https environments
export function requestWakeLock() {
    if ("wakeLock" in navigator) {
        try {
            navigator.wakeLock.request("screen")
        } catch {
            // failed to acquire wake lock
        }
    } else {
        // not supported
    }
}

// export function releaseWakeLock(wakeLock: WakeLockSentinel) {
//     if (wakeLock) {
//         wakeLock.release();
//     } else {
//         // no wake lock to release
//     }
// }
