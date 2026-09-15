import type { Output } from "../../../types/Output"

// Shared-render: outputs with identical content share one render window and capture,
// and the single readback fans out to every member's sender.
export class RenderGroups {
    static enabled = process.env.FS_SHARE_RENDER !== "0"

    private static keys: { [id: string]: string } = {}
    // group key -> member ids; members[0] is the renderer (owns the window), rest are followers
    private static groups: { [key: string]: string[] } = {}
    private static configs: { [id: string]: Output } = {}

    static getConfig(id: string): Output | undefined {
        return this.configs[id]
    }

    static onChanged: (() => void) | null = null

    // renderer id -> member ids for groups with 2+ members
    static snapshot(): { [rendererId: string]: string[] } {
        const out: { [rendererId: string]: string[] } = {}
        for (const members of Object.values(this.groups)) {
            if (members.length >= 2) out[members[0]] = [...members]
        }
        return out
    }

    // Properties affecting the rendered image. Size is NOT part of it: outputs of the same content at
    // different resolutions share one render (at the largest size) and the smaller ones are downscaled
    // from it. Aspect ratio is, since a different aspect lays the content out differently.
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

    // the size a group's render runs at: the largest member (all members share an aspect ratio)
    static renderSize(id: string): { width: number; height: number } | null {
        let best: { width: number; height: number } | null = null
        for (const m of this.members(id)) {
            const b = this.configs[m]?.bounds
            if (!b?.width || !b?.height) continue
            if (!best || b.width * b.height > best.width * best.height) best = { width: b.width, height: b.height }
        }
        return best
    }

    // the id already rendering this content, if any; callers join it rather than starting a second render
    static existingRenderer(output: Output): string | null {
        if (!this.enabled) return null
        const members = this.groups[this.computeKey(output)]
        return members?.length ? members[0] : null
    }

    static add(id: string, output: Output): { isRenderer: boolean; rendererId: string } {
        if (!this.enabled) return { isRenderer: true, rendererId: id }

        const key = this.computeKey(output)
        this.keys[id] = key
        this.configs[id] = output
        const members = (this.groups[key] ||= [])
        if (!members.includes(id)) members.push(id)
        const rendererId = members[0]
        if (process.env.FS_CAP_STATS) console.info(`[GROUP] add ${id} -> renderer=${rendererId} members=${members.length} key=${key}`)
        this.onChanged?.()
        return { isRenderer: rendererId === id, rendererId }
    }

    // Remove an output and promote the first follower if the renderer was removed
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

        this.onChanged?.()
        return { wasRenderer, newRenderer: wasRenderer ? remaining[0] : undefined, members: remaining }
    }

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
