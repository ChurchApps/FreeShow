// FS_RULE_CHECK=1 turns the standing rules about video frames into something the running app reports on
// instead of something a reader has to remember:
//
//   - no frame is converted or scaled pixel by pixel on a CPU while a GPU is available
//   - no frame-sized data is handled in the main process
//   - no path silently degrades to a CPU or main-thread fallback
//
// Every count printed under [RULE-CHECK] is a rule being broken. On a machine with a working GPU the
// expected output is nothing at all. It is off unless the variable is set, and costs one boolean when it
// is off.

const enabled = !!process.env.FS_RULE_CHECK

export type RuleKind = "cpu-frame" | "main-frame" | "fallback"

const counts = new Map<string, number>()
let reporting = false

// which process this instance is in, since the module is loaded separately in main, the capture worker
// and the receive process
function role() {
    if (process.env.FS_RULE_ROLE) return process.env.FS_RULE_ROLE
    return (process as unknown as { parentPort?: unknown }).parentPort ? "receive" : "main/worker"
}

export function ruleViolation(kind: RuleKind, site: string, times = 1) {
    if (!enabled) return
    const key = kind + " " + site
    counts.set(key, (counts.get(key) || 0) + times)
    if (reporting) return
    reporting = true
    setInterval(() => {
        if (!counts.size) return
        const worst = [...counts.entries()].sort((a, b) => b[1] - a[1])
        console.info(`[RULE-CHECK ${role()}] ` + worst.map(([k, n]) => `${n}x ${k}`).join(" | "))
        counts.clear()
    }, 1000).unref?.()
}

export const ruleCheckEnabled = enabled
