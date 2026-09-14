import { uid } from "uid"
import type { Item, Show, Slide, SlideData } from "../../types/Show"

// Latin basic + Latin-1 Supplement + Latin Extended-A/B, so Romanian ă â î ș ț count as letters.
const NON_LYRIC_REGEX = /[^A-Za-z0-9À-ɏ ]/g

/**
 * The lyrics of one slide group (parent + its children) as a comparable string. Slide and line
 * boundaries are dropped on purpose: the same section re-split into two lines per slide has to
 * still count as the same section.
 */
export function getGroupSignature(show: Show, slideId: string): string {
    const slide = show.slides?.[slideId]
    if (!slide) return ""

    const groupIds = [slideId, ...(slide.children || [])]
    return groupIds
        .map((id) => getSlideWords(show.slides?.[id]))
        .join(" ")
        .toLowerCase()
        .replace(NON_LYRIC_REGEX, "")
        .replace(/\s+/g, " ")
        .trim()
}

function getSlideWords(slide: Slide | undefined): string {
    if (!slide?.items?.length) return ""
    return slide.items.map(getItemWords).join(" ")
}

// kept local (instead of the edit helpers) so this module stays free of editor and store imports
function getItemWords(item: Item): string {
    if (!Array.isArray(item?.lines)) return ""

    return item.lines
        .map((line) =>
            Array.isArray(line?.text)
                ? line.text
                      .map((content) => content?.value || "")
                      .filter(Boolean)
                      .join("")
                : ""
        )
        .join(" ")
}

function clone<T>(object: T): T {
    if (object === null || typeof object !== "object") return object
    return structuredClone(object)
}

/** One signature per slide reference in an arrangement, in presentation order. */
export function getArrangementSignature(show: Show, layoutId?: string): string {
    const layout = show.layouts?.[layoutId || show.settings?.activeLayout]
    if (!layout?.slides?.length) return ""

    return layout.slides.map((ref) => getGroupSignature(show, ref.id)).join("\n|\n")
}

/**
 * The exact text of one slide group — slide and line boundaries included. Two songs holding the
 * same words differ here when the lyrics are split into slides or lines differently, which is
 * what a change to the lines-per-slide or line-length settings produces.
 */
function getGroupContent(show: Show, slideId: string): string {
    const slide = show.slides?.[slideId]
    if (!slide) return ""

    return [slideId, ...(slide.children || [])].map((id) => getSlideLines(show.slides?.[id])).join("\n--\n")
}

function getSlideLines(slide: Slide | undefined): string {
    if (!slide?.items?.length) return ""

    return slide.items
        .map((item) =>
            (item.lines || [])
                .map((line) =>
                    (line?.text || [])
                        .map((content) => content?.value || "")
                        .join("")
                        .trim()
                )
                .join("\n")
        )
        .join("\n")
}

/** The exact lyrics an arrangement presents, in order. */
export function getArrangementContent(show: Show, layoutId?: string): string {
    const layout = show.layouts?.[layoutId || show.settings?.activeLayout]
    if (!layout?.slides?.length) return ""

    return layout.slides.map((ref) => getGroupContent(show, ref.id)).join("\n==\n")
}

/**
 * Whether the local song already presents the provider lyrics exactly — same words AND the same
 * split into slides and lines. A structural match is not enough: after the lines-per-slide or
 * line-length setting changes, the words are unchanged but the slides have to be rebuilt.
 */
export function hasSameSlideContent(existing: Show, incoming: Show, layoutMap: { [key: string]: string }): boolean {
    return Object.keys(layoutMap).every((incomingLayoutId) => getArrangementContent(incoming, incomingLayoutId) === getArrangementContent(existing, layoutMap[incomingLayoutId]))
}

/**
 * Maps every arrangement the provider sent onto the local arrangement that already presents it,
 * or null when at least one of them is new. Every local arrangement is checked, not just the
 * active one, so a song synced twice does not ask again about an arrangement already added.
 */
export function matchArrangements(existing: Show, incoming: Show): { [key: string]: string } | null {
    const incomingLayoutIds = Object.keys(incoming.layouts || {})
    if (!incomingLayoutIds.length) return null

    const localIdBySignature: { [key: string]: string } = {}
    Object.keys(existing.layouts || {}).forEach((layoutId) => {
        const signature = getArrangementSignature(existing, layoutId)
        if (signature && !localIdBySignature[signature]) localIdBySignature[signature] = layoutId
    })

    const layoutMap: { [key: string]: string } = {}
    for (const incomingLayoutId of incomingLayoutIds) {
        const signature = getArrangementSignature(incoming, incomingLayoutId)
        const localLayoutId = signature ? localIdBySignature[signature] : ""
        if (!localLayoutId) return null

        layoutMap[incomingLayoutId] = localLayoutId
    }

    return layoutMap
}

/**
 * Add the provider's arrangements to the local song instead of overwriting it: sections whose
 * lyrics already exist locally are reused (keeping their local styling and edits) and only
 * genuinely new lyrics are added as new slides. Every provider arrangement is added, so a song
 * scheduled differently in several services keeps one arrangement per structure.
 *
 * Returns the merged show and, for each provider arrangement, the local arrangement it became —
 * the caller needs that to keep the project items pointing at the right arrangement.
 */
export function mergeAsNewArrangement(existing: Show, incoming: Show, arrangementName = "OnStage"): { show: Show; layoutMap: { [key: string]: string } } {
    const merged = clone(existing)
    if (!merged.slides) merged.slides = {}
    if (!merged.layouts) merged.layouts = {}

    // local lyrics -> local slide, so a section that already exists is referenced, not duplicated
    const localIdBySignature: { [key: string]: string } = {}
    Object.keys(merged.slides).forEach((slideId) => {
        // only parents carry a group; children are reached through their parent
        if (!merged.slides[slideId].group) return

        const signature = getGroupSignature(merged, slideId)
        if (signature && !localIdBySignature[signature]) localIdBySignature[signature] = slideId
    })

    // a section used by several incoming arrangements is copied once and referenced again
    const copiedByIncomingId: { [key: string]: string } = {}
    const layoutMap: { [key: string]: string } = {}

    // the provider's own arrangement comes first, so it is the one left active
    const incomingLayoutIds = Object.keys(incoming.layouts || {})
    const activeFirst = [incoming.settings?.activeLayout, ...incomingLayoutIds].filter((layoutId, i, all) => layoutId && incoming.layouts[layoutId] && all.indexOf(layoutId) === i)

    activeFirst.forEach((incomingLayoutId) => {
        const layoutSlides: SlideData[] = []

        ;(incoming.layouts[incomingLayoutId].slides || []).forEach((ref) => {
            const alreadyCopied = copiedByIncomingId[ref.id]
            if (alreadyCopied) {
                layoutSlides.push({ id: alreadyCopied })
                return
            }

            // an empty signature (instrumental section) has no lyrics to match on, so it is copied
            const signature = getGroupSignature(incoming, ref.id)
            const localId = signature ? localIdBySignature[signature] : ""
            if (localId) {
                layoutSlides.push({ id: localId })
                return
            }

            const copiedId = copyGroup(merged, incoming, ref.id)
            if (!copiedId) return

            copiedByIncomingId[ref.id] = copiedId
            layoutSlides.push({ id: copiedId })
        })

        if (!layoutSlides.length) return

        // this exact arrangement may already exist locally (or have been added a moment ago)
        const arrangementSignature = getSlideIdSignature(layoutSlides)
        const knownLayoutId = Object.keys(merged.layouts).find((id) => getSlideIdSignature(merged.layouts[id].slides || []) === arrangementSignature)
        if (knownLayoutId) {
            layoutMap[incomingLayoutId] = knownLayoutId
            return
        }

        const incomingName = incoming.layouts[incomingLayoutId].name
        const name = !incomingName || incomingName === "Default" ? arrangementName : incomingName

        const newLayoutId = uid()
        merged.layouts[newLayoutId] = { name: getUniqueArrangementName(merged, name), notes: "", slides: layoutSlides }
        layoutMap[incomingLayoutId] = newLayoutId
    })

    const firstLayoutId = layoutMap[activeFirst[0]]
    if (firstLayoutId) merged.settings.activeLayout = firstLayoutId

    // fill in song details the local version never had, without overwriting local corrections
    const metaKeys = ["title", "artist", "CCLI", "copyright", "key"] as const
    metaKeys.forEach((key) => {
        if (!merged.meta) merged.meta = {}
        if (!merged.meta[key] && incoming.meta?.[key]) merged.meta[key] = incoming.meta[key]
    })

    if (merged.timestamps) merged.timestamps.modified = Date.now()

    return { show: merged, layoutMap }
}

function getSlideIdSignature(slides: SlideData[]): string {
    return slides.map((slide) => slide.id).join(",")
}

/** Copy a slide group (parent + children) into the target show under fresh ids. */
function copyGroup(target: Show, source: Show, parentId: string): string {
    const parent = source.slides?.[parentId]
    if (!parent) return ""

    const parentCopy = clone(parent)
    const childIds = (parent.children || [])
        .map((childId) => {
            const child = source.slides?.[childId]
            if (!child) return ""

            const newChildId = uid()
            target.slides[newChildId] = clone(child)
            return newChildId
        })
        .filter(Boolean)

    if (childIds.length) parentCopy.children = childIds
    else delete parentCopy.children

    const newParentId = uid()
    target.slides[newParentId] = parentCopy
    return newParentId
}

function getUniqueArrangementName(show: Show, name: string): string {
    const existingNames = Object.values(show.layouts || {}).map((layout) => layout?.name || "")
    if (!existingNames.includes(name)) return name

    let counter = 2
    while (existingNames.includes(`${name} ${counter}`)) counter++
    return `${name} ${counter}`
}
