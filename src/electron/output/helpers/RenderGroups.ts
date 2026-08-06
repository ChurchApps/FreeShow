import type { Output } from "../../../types/Output"

// Shared-render (opt-in via FS_SHARE_RENDER=1). Multiple FreeShow outputs frequently render PIXEL-IDENTICAL
// frames — every "Normal" output shows the program feed, and every "Stage" output sharing a Stage Layout shows
// the same template. Rendering each in its own offscreen window means the GPU decodes+composites the same 4K
// content N times, which is what caps concurrent 4K. When outputs are provably identical we can render/capture
// ONCE and fan the single readback out to every member's sender.
//
// SAFETY: identity is derived ONLY from config that affects the rendered pixels (never per-frame guessing), so
// two outputs share a render iff their group key matches exactly; anything different renders independently.
// The set was confirmed with the user: { stageOutput (layout), style, resolution, transparent, cropping,
// blending }. If ANY differs, the key differs and they do NOT share — the conservative, correct fallback.
export class RenderGroups {
    // On by default — outputs that render pixel-identically share one decode/capture (the big win for multiple
    // 4K outputs of the same content). Only ever groups provably-identical outputs; anything different renders
    // independently, so it's safe. Opt out with FS_SHARE_RENDER=0 if a problem is ever traced to it.
    static enabled = process.env.FS_SHARE_RENDER !== "0"

    // output id -> its current group key
    private static keys: { [id: string]: string } = {}
    // group key -> ordered member ids; members[0] is the RENDERER (owns the window), the rest are FOLLOWERS
    private static groups: { [key: string]: string[] } = {}
    // output id -> its source config, kept so a follower can be recreated (promoted) if its renderer is removed
    private static configs: { [id: string]: Output } = {}

    static getConfig(id: string): Output | undefined {
        return this.configs[id]
    }

    // Everything that affects the rendered image. Missing a field here would let two outputs that render
    // DIFFERENTLY share one capture (wrong content) — so include every render-affecting property.
    static computeKey(output: Output): string {
        return JSON.stringify({
            stage: output.stageOutput || "",
            style: output.style || "",
            resolution: output.forcedResolution || null,
            width: output.bounds?.width ?? null,
            height: output.bounds?.height ?? null,
            transparent: !!output.transparent,
            cropping: output.cropping || null,
            blending: output.blending || null
        })
    }

    // Register an output. Returns whether it owns the render (renderer) and who the renderer is.
    static add(id: string, output: Output): { isRenderer: boolean; rendererId: string } {
        if (!this.enabled) return { isRenderer: true, rendererId: id }

        const key = this.computeKey(output)
        this.keys[id] = key
        this.configs[id] = output
        const members = (this.groups[key] ||= [])
        if (!members.includes(id)) members.push(id)
        const rendererId = members[0]
        return { isRenderer: rendererId === id, rendererId }
    }

    // Remove an output. If it was the renderer and followers remain, the first follower is promoted (the caller
    // must then create a window for `newRenderer`). Returns the remaining members (may be empty).
    static remove(id: string): { wasRenderer: boolean; newRenderer?: string; members: string[] } {
        const key = this.keys[id]
        delete this.keys[id]
        delete this.configs[id]
        if (!key || !this.groups[key]) return { wasRenderer: true, members: [] }

        const members = this.groups[key]
        const wasRenderer = members[0] === id
        const remaining = members.filter((m) => m !== id)
        if (remaining.length) this.groups[key] = remaining
        else delete this.groups[key]

        return { wasRenderer, newRenderer: wasRenderer ? remaining[0] : undefined, members: remaining }
    }

    // All member ids that share this output's render (renderer first), or just [id] when sharing is off/unknown.
    static members(id: string): string[] {
        if (!this.enabled) return [id]
        const key = this.keys[id]
        const members = key ? this.groups[key] : undefined
        return members && members.length ? members : [id]
    }

    static rendererOf(id: string): string {
        return this.members(id)[0]
    }

    static isRenderer(id: string): boolean {
        return this.rendererOf(id) === id
    }

    static isFollower(id: string): boolean {
        return this.enabled && !!this.keys[id] && !this.isRenderer(id)
    }
}
