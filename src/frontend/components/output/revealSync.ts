// Lets the layers of one output (background, slide text) hold back their reveal
// until every changing layer is ready, so they swap in the same frame.
// Without it, new text can show over the previous background (or the other way around).

export const REVEAL_SYNC_KEY = "outputRevealSync"

export type RevealSync = ReturnType<typeof createRevealSync>

export function createRevealSync() {
    const pending = new Map<string, NodeJS.Timeout>()
    let listeners: (() => void)[] = []

    // maxHold makes sure a layer that never reports back can't block the others
    function hold(id: string, maxHold: number) {
        const existing = pending.get(id)
        if (existing) clearTimeout(existing)
        pending.set(
            id,
            setTimeout(() => release(id), maxHold)
        )
    }

    function release(id: string) {
        const existing = pending.get(id)
        if (!existing) return
        clearTimeout(existing)
        pending.delete(id)
        if (pending.size) return

        // call all waiting layers synchronously so they update in the same frame
        const waiting = listeners
        listeners = []
        waiting.forEach((callback) => callback())
    }

    // run callback once no layer is holding (or after maxWait), returns a cancel function
    function whenClear(callback: () => void, maxWait: number) {
        let done = false
        const finish = () => {
            if (done) return
            done = true
            clearTimeout(timer)
            listeners = listeners.filter((a) => a !== finish)
            callback()
        }
        const timer = setTimeout(finish, maxWait)

        if (!pending.size) finish()
        else listeners.push(finish)

        return () => {
            done = true
            clearTimeout(timer)
            listeners = listeners.filter((a) => a !== finish)
        }
    }

    return { hold, release, whenClear }
}
