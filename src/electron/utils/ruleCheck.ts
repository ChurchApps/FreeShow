// FS_RULE_CHECK=1: logs per second, under [RULE-CHECK], CPU frame processing with a GPU available,
// frame data on main, and silent fallbacks. Silent on a working GPU.

const enabled = !!process.env.FS_RULE_CHECK

export type RuleKind = "cpu-frame" | "main-frame" | "fallback"

const counts = new Map<string, number>()
let reporting = false

// loaded separately in main, the capture worker and the receive process
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
