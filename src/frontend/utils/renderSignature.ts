import type { Output, Outputs } from "../../types/Output"
import { isOutputBound } from "../components/helpers/output"

// Two outputs may share one render (main's RenderGroups.ts) only while their pages would render the same
// picture. A page renders from the data this window sends it, so its signature is computed from exactly
// that data, as sent: a mirror of every message to the output windows, not the live stores, which can be
// ahead of what the pages have. The signatures go out ahead of each message, so an output that stops
// matching has its own page back before the change reaches any page.
//
// What makes one output's page differ from another's, given the same messages:
// - its entry in OUTPUTS (each window is sent only its own), minus the fields no page draws;
// - any message keyed by output id (colorbars, the live-prepare blackout, ...), taken generically;
// - its playing-video state, keyed "<path>_<output id>";
// - every binding to outputs anywhere in the content it can show, evaluated for it as its page does;
// - the draw messages sent to it alone (main routes them by id), and the strokes its page has painted,
//   which each page keeps for itself.

// main handles these itself; no page draws from them
const CONTROL = new Set([
    "CREATE",
    "REMOVE",
    "TOGGLE_OUTPUTS",
    "ALIGN_WITH_SCREEN",
    "MOVE",
    "UPDATE_BOUNDS",
    "SET_VALUE",
    "TO_FRONT",
    "STREAM_LAYER",
    "MEDIA_LAYERS",
    "PREVIEW_SUBSCRIBE",
    "PREVIEW_UNSUBSCRIBE",
    "PREVIEW_SIZE",
    "CAPTURE",
    "RECORD_OUTPUT",
    "IDENTIFY_SCREENS",
    "FOCUS",
    "RENDER_SIGNATURES",
    "RENDER_BUSY"
])

// Output fields no page draws from: where its window is, how it is sent, what it is called (bindings by
// name are evaluated below). Everything else counts, so a field added later splits outputs rather than
// letting one show another's content.
const NOT_DRAWN = new Set(["id", "name", "color", "screen", "boundsLocked", "alwaysOnTop", "taskbar", "hideFromPreview", "invisible", "ndi", "ndiData", "omt", "omtData", "blackmagic", "blackmagicData", "webrtc", "webrtcData", "rtmp", "rtmpData"])

const sent: { [channel: string]: any } = {}
// per output: the last DRAW and DRAW_TOOL it was sent (a page that was sent none has the defaults), and
// every stroke its page painted: a page paints the DRAW data it gets while its tool is "paint"
const draws: { [outputId: string]: { data: any; tool: string; painted: number } } = {}
let lastSent = ""

/** For request.ts: every message to the output windows goes through here first; changed signatures are
 *  sent ahead of it. */
export function renderSignatureHook(channel: string, data: any): { channel: string; data: any } | null {
    const sigs = renderSignaturesBefore(channel, data)
    return sigs ? { channel: "RENDER_SIGNATURES", data: sigs } : null
}

function renderSignaturesBefore(channel: string, data: any): { [id: string]: string } | null {
    if (CONTROL.has(channel)) return null
    noteMessage(channel, data)

    const outputs: Outputs = sent.OUTPUTS || {}
    const sigs: { [id: string]: string } = {}
    for (const id of Object.keys(outputs)) sigs[id] = signature(id, outputs[id])
    const str = JSON.stringify(sigs)
    if (str === lastSent) return null
    lastSent = str
    return sigs
}

function noteMessage(channel: string, data: any) {
    // a message addressed to one window changes only that page
    if ((channel === "DRAW" || channel === "DRAW_TOOL") && data?.id) {
        const d = (draws[data.id] ||= { data: null, tool: "focus", painted: 0 })
        if (channel === "DRAW_TOOL") d.tool = data.data
        else {
            d.data = data.data ?? null
            if (d.data !== null && d.tool === "paint") d.painted = hash(`${d.painted}|${JSON.stringify(d.data)}`)
        }
        return
    }
    sent[channel] = data
}

function signature(id: string, output: Output): string {
    const own: { [key: string]: any } = {}
    for (const [key, value] of Object.entries(output || {})) {
        if (NOT_DRAWN.has(key)) continue
        if (key === "bounds") continue
        own[key] = value
    }
    // every page reads transparency as a truth value, and saved outputs hold false, null or nothing
    own.transparent = !!output?.transparent
    // The aspect lays the page out. The exact size does too where a style uses it as the resolution, and
    // for a stage layout; elsewhere a page of any size draws the same picture scaled.
    const b = output?.bounds
    const style = sent.STYLES?.[output?.style || ""]
    const exactSize = !!output?.stageOutput || !!style?.aspectRatio?.outputResolutionAsRatio
    own.bounds = exactSize ? { width: b?.width, height: b?.height } : { aspect: b?.width && b?.height ? Math.round((b.width / b.height) * 1000) : null }

    const keyed: [string, any][] = []
    for (const [channel, data] of Object.entries(sent)) {
        // SYNCED_OUTPUTS holds output names, which only bindings use (evaluated below)
        if (channel === "OUTPUTS" || channel === "ALL_OUTPUTS" || channel === "PLAYING_VIDEO_STATE" || channel === "SYNCED_OUTPUTS") continue
        if (data && typeof data === "object" && !Array.isArray(data) && Object.prototype.hasOwnProperty.call(data, id)) keyed.push([channel, data[id]])
    }

    // the playing clock is shared by every output linked to a video; the rest is per output
    const video: [string, any][] = []
    for (const [key, state] of Object.entries(sent.PLAYING_VIDEO_STATE || {})) {
        if (!key.endsWith(`_${id}`)) continue
        const { currentTime: _t, at: _a, muted: _m, ...rest } = (state as any) || {}
        video.push([key.slice(0, -id.length - 1), rest])
    }

    // the page evaluates bindings with only its own output known to it
    const ownMap: Outputs = { [id]: output }
    const bound = bindingsIn(id, output).map((b) => (isOutputBound(b, id, ownMap) ? "1" : "0")).join("")

    const d = draws[id] || { data: null, tool: "focus", painted: 0 }

    return hash(stableJson([own, keyed, video, bound, d.data, d.tool, d.painted])).toString(36)
}

// every binding list in the content this output shows: its own out (slide, background, overlays, effects,
// scene), the slide on it and that slide's place in the layout, the overlays and effects it shows, and
// every template any of these or its style name (a style's templates, scripture and metadata templates)
function bindingsIn(_id: string, output: Output): string[][] {
    const lists: string[][] = []
    const out = output?.out
    const sources: any[] = [out, sent.STYLES?.[output?.style || ""]]
    const show = out?.slide?.id ? sent.SHOWS?.[out.slide.id] : null
    if (show) {
        sources.push(show.settings)
        const ref = layoutRef(show, out?.slide?.layout)[out?.slide?.index ?? -1]
        // a slide that cannot be placed counts as the whole show, which can only split, never join
        if (ref) sources.push(ref.data, show.slides?.[ref.id], ref.parent ? show.slides?.[ref.parent] : null)
        else sources.push(show)
    }
    for (const overlayId of out?.overlays || []) sources.push(sent.OVERLAYS?.[overlayId])
    for (const effectId of out?.effects || []) sources.push(sent.EFFECTS?.[effectId])

    // templates named anywhere in that content, and in those templates
    const templates = sent.TEMPLATES || {}
    const seen = new Set<string>()
    const queue = [...sources]
    while (queue.length) {
        const value = queue.shift()
        collect(value, lists)
        for (const tid of templateIds(value, templates)) {
            if (seen.has(tid)) continue
            seen.add(tid)
            queue.push(templates[tid])
        }
    }
    return lists
}

// the layout as an output indexes it: each slide, then its child slides
function layoutRef(show: any, layoutId: string | undefined): { id: string; parent?: string; data: any }[] {
    const layout = show?.layouts?.[layoutId || show?.settings?.activeLayout || ""]
    const refs: { id: string; parent?: string; data: any }[] = []
    for (const entry of layout?.slides || []) {
        refs.push({ id: entry.id, data: entry })
        for (const childId of show?.slides?.[entry.id]?.children || []) refs.push({ id: childId, parent: entry.id, data: entry.children?.[childId] || {} })
    }
    return refs
}

function templateIds(value: any, templates: { [id: string]: any }, out: string[] = [], depth = 0): string[] {
    if (!value || depth > 64) return out
    if (typeof value === "string") {
        if (templates[value]) out.push(value)
        return out
    }
    if (typeof value !== "object") return out
    for (const v of Array.isArray(value) ? value : Object.values(value)) templateIds(v, templates, out, depth + 1)
    return out
}

function collect(value: any, lists: string[][], depth = 0) {
    if (!value || typeof value !== "object" || depth > 64) return
    if (Array.isArray(value)) {
        for (const v of value) collect(v, lists, depth + 1)
        return
    }
    for (const [key, v] of Object.entries(value)) {
        if (key === "bindings" && Array.isArray(v)) lists.push(v as string[])
        else collect(v, lists, depth + 1)
    }
}

// JSON with object keys in a fixed order: two outputs saved with the same fields in a different order
// render the same
function stableJson(value: any): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
    const keys = Object.keys(value)
        .filter((k) => value[k] !== undefined)
        .sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`
}

// cyrb53: a fast 53-bit string hash
function hash(str: string): number {
    let h1 = 0xdeadbeef
    let h2 = 0x41c6ce57
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i)
        h1 = Math.imul(h1 ^ ch, 2654435761)
        h2 = Math.imul(h2 ^ ch, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
