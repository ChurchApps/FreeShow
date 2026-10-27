import type { Output } from "../../../types/Output"

// Shared render: outputs that would render the same picture share one render, and its single readback
// fans out to every member's consumers. Every output keeps a page of its own, fed all the same data, so
// sharing never decides what an output shows: a member only takes another page's frames while the app
// reports that both pages have identical render inputs (renderSignature.ts), and it goes back to its own
// page the moment that stops being true, before the change reaches any page.
//
// Two levels decide it:
// - the CLASS: the output settings a page's pixels depend on that main knows itself (style, stage layout,
//   resolution, aspect, transparency, cropping, blending). Pages of one class render at the class's
//   largest size, so a member can take any other member's frames at its own size.
// - the SIGNATURE: everything else the page renders from, computed by the app per output.
export class RenderGroups {
    static enabled = process.env.FS_SHARE_RENDER !== "0"

    private static classes = new Map<string, string>()
    private static configs = new Map<string, Output>()
    private static signatures = new Map<string, string>()
    // pages with a transition or animation still running, and a hash of each still page's content: an
    // output gives up its own page's frames for another's only once both pages are still and show the same
    // content, so a fade is never cut short and nothing changes on the switch
    private static busy = new Set<string>()
    private static content = new Map<string, string>()
    // message seqs per output: sent, applied (in the last page report), and sent at the last signature change
    private static sent = new Map<string, number>()
    private static applied = new Map<string, number>()
    private static changedAt = new Map<string, number>()
    // outputs with an offscreen page to share: an offscreen output's own window, or a displayed output's
    // capture surface. A displayed output without one renders on screen and shares with nobody.
    private static renderable = new Set<string>()
    // id -> the id whose page it shows (itself when it renders its own)
    private static renderer = new Map<string, string>()
    // registration order, so renderer choice is stable
    private static order: string[] = []

    /** called with every output whose source changed: (id, previous renderer, new renderer) */
    static onMembership: ((changes: { id: string; from: string; to: string }[]) => void) | null = null
    static onChanged: (() => void) | null = null

    static getConfig(id: string): Output | undefined {
        return this.configs.get(id)
    }

    // The output settings that change a page's pixels. Size is not one: a class renders at its largest
    // member's size and each member is sent at its own. Aspect is, since it changes the layout.
    static computeKey(output: Output): string {
        const w = output.bounds?.width || 0
        const h = output.bounds?.height || 0
        return JSON.stringify({
            stage: output.stageOutput || "",
            style: output.style || "",
            resolution: output.forcedResolution || null,
            aspect: w && h ? Math.round((w / h) * 1000) : null,
            transparent: !!output.transparent,
            cropping: output.cropping || null,
            blending: output.blending || null
        })
    }

    static register(id: string, output: Output) {
        if (!this.enabled) return
        this.configs.set(id, output)
        this.classes.set(id, this.computeKey(output))
        if (!this.order.includes(id)) this.order.push(id)
        if (!this.renderer.has(id)) this.renderer.set(id, id)
        this.recompute()
    }

    /** an output's settings changed: its class (and the class's size) follow */
    static updateConfig(id: string, output: Output) {
        if (!this.classes.has(id)) return
        this.configs.set(id, output)
        const key = this.computeKey(output)
        if (key === this.classes.get(id)) return
        this.classes.set(id, key)
        this.recompute()
    }

    static isRegistered(id: string) {
        return this.classes.has(id)
    }

    static remove(id: string) {
        this.configs.delete(id)
        this.classes.delete(id)
        this.signatures.delete(id)
        this.busy.delete(id)
        this.content.delete(id)
        this.sent.delete(id)
        this.applied.delete(id)
        this.changedAt.delete(id)
        this.renderable.delete(id)
        this.order = this.order.filter((o) => o !== id)
        const had = this.renderer.delete(id)
        if (had) this.recompute()
    }

    /** the app's render signatures; outputs missing from the map have none and render alone */
    static setSignatures(sigs: { [id: string]: string }) {
        if (!this.enabled) return
        let changed = false
        for (const id of this.classes.keys()) {
            const sig = sigs[id]
            if (this.signatures.get(id) === sig) continue
            if (sig === undefined) this.signatures.delete(id)
            else this.signatures.set(id, sig)
            this.changedAt.set(id, this.sent.get(id) || 0)
            changed = true
        }
        if (changed) this.recompute()
    }

    static setRenderable(id: string, renderable: boolean) {
        if (renderable === this.renderable.has(id)) return
        if (renderable) this.renderable.add(id)
        else this.renderable.delete(id)
        this.recompute()
    }

    /** next message seq for this output */
    static stamp(id: string): number {
        const seq = (this.sent.get(id) || 0) + 1
        this.sent.set(id, seq)
        return seq
    }

    static setPageState(id: string, busy: boolean, content: string, seq: number) {
        this.applied.set(id, seq)
        if (busy) this.busy.add(id)
        else this.busy.delete(id)
        if (content) this.content.set(id, content)
        else this.content.delete(id)
        // only a still page can let an output join another's render; anything else never changes membership
        if (!busy) this.recompute()
    }

    // the last report covers the latest signature change
    private static current(id: string): boolean {
        return (this.applied.get(id) || 0) > (this.changedAt.get(id) ?? -1)
    }

    private static showsSame(a: string, b: string): boolean {
        if (a === b) return true
        if (!this.current(a) || !this.current(b)) return false
        if (this.busy.has(a) || this.busy.has(b)) return false
        const ca = this.content.get(a)
        return !!ca && ca === this.content.get(b)
    }

    private static groupKey(id: string): string | null {
        const cls = this.classes.get(id)
        const sig = this.signatures.get(id)
        return cls === undefined || sig === undefined || !this.renderable.has(id) ? null : `${cls}\n${sig}`
    }

    private static recompute() {
        const prev = new Map(this.renderer)
        const next = new Map<string, string>()

        const buckets = new Map<string, string[]>()
        for (const id of this.order) {
            if (!this.classes.has(id)) continue
            const key = this.groupKey(id)
            if (key === null) {
                next.set(id, id)
                continue
            }
            const list = buckets.get(key) || []
            list.push(id)
            buckets.set(key, list)
        }

        for (const ids of buckets.values()) {
            // keep the page that already renders for the most of these outputs
            let chosen = ids[0]
            let best = -1
            for (const r of ids) {
                if (prev.get(r) !== r) continue
                const following = ids.filter((m) => prev.get(m) === r).length
                if (following > best) {
                    best = following
                    chosen = r
                }
            }
            // An output showing its own page joins once both pages are still and show the same content (the
            // signatures can match before a page has applied the change that made them match); until then it
            // keeps its own page.
            for (const m of ids) {
                const showingOwn = (prev.get(m) ?? m) === m
                if (!showingOwn) continue
                next.set(m, this.showsSame(m, chosen) ? chosen : m)
            }
            // An output showing another page stays with it while that page still renders the same content
            // for itself; otherwise it moves now, since what it was showing is no longer its content.
            for (const m of ids) {
                const was = prev.get(m) ?? m
                if (was === m) continue
                next.set(m, ids.includes(was) && next.get(was) === was ? was : chosen)
            }
        }

        const changes: { id: string; from: string; to: string }[] = []
        for (const [id, to] of next) {
            const from = prev.get(id) ?? id
            if (from !== to) changes.push({ id, from, to })
        }
        this.renderer = next
        if (!changes.length) return
        if (process.env.FS_CAP_STATS) for (const c of changes) console.info(`[GROUP] ${c.id}: ${c.from === c.id ? "own page" : c.from} -> ${c.to === c.id ? "own page" : c.to}`)
        this.onMembership?.(changes)
        this.onChanged?.()
    }

    /** the outputs shown from this page: itself and every output following it */
    static members(id: string): string[] {
        const r = this.renderer.get(id)
        if (r === undefined) return [id]
        return this.order.filter((m) => this.renderer.get(m) === r)
    }

    static rendererOf(id: string): string {
        return this.renderer.get(id) ?? id
    }

    static isRenderer(id: string): boolean {
        return this.rendererOf(id) === id
    }

    static isFollower(id: string): boolean {
        return this.rendererOf(id) !== id
    }

    /** whether any other registered output is of the same class (could share this output's render) */
    static hasClassmates(id: string): boolean {
        const cls = this.classes.get(id)
        if (cls === undefined) return false
        for (const [other, c] of this.classes) if (other !== id && c === cls) return true
        return false
    }

    /** the size every page of this output's class renders at: its largest member */
    static renderSize(id: string): { width: number; height: number } | null {
        const cls = this.classes.get(id)
        let best: { width: number; height: number } | null = null
        for (const [m, c] of this.classes) {
            if (c !== cls) continue
            const b = this.configs.get(m)?.bounds
            if (!b?.width || !b?.height) continue
            if (!best || b.width * b.height > best.width * best.height) best = { width: b.width, height: b.height }
        }
        return best
    }

    static classMembers(id: string): string[] {
        const cls = this.classes.get(id)
        return this.order.filter((m) => this.classes.get(m) === cls)
    }

    // renderer id -> member ids for groups with 2+ members
    static snapshot(): { [rendererId: string]: string[] } {
        const out: { [rendererId: string]: string[] } = {}
        for (const id of this.order) {
            if (!this.isRenderer(id)) continue
            const m = this.members(id)
            if (m.length >= 2) out[id] = m
        }
        return out
    }
}
