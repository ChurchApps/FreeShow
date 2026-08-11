// ----- FreeNote -----
// Real FreeShow creation from markdown. Each Shift+Enter adds a slide to the
// active FreeNote show and broadcasts it live. Title = first # heading.

import { get, writable } from "svelte/store"
import { uid } from "uid"
import { EXPORT } from "../../../types/Channels"
import type { Item, Show } from "../../../types/Show"
import { activePage, activeProject, activeShow, focusedArea, freeNoteActive, freeNoteDrafts, freeNoteHistory, freeNoteMode, freeNoteProjection, freeNoteSlides, freeNoteNow, outputs, projects, saved, shows, showsCache } from "../../stores"
import { translateText } from "../../utils/language"
import { send } from "../../utils/request"
import { generateScriptureShowFromReference } from "../drawer/bible/scripture"
import { getFileName } from "../helpers/media"
import { sendFreeNote } from "../helpers/output"
import { history } from "../helpers/history"
import { checkName } from "../helpers/show"
import { loadShows } from "../helpers/setShow"
import { blockToItem, renderMarkdown, splitBlocks, extractFirstHeading } from "./markdown"
import { chunkRichHtml, htmlToItems, htmlToMarkdown, plainTextOfChunk, sanitizeRich } from "./rich"
import { convertText } from "../../converters/txt"

export type FreeNoteTemplate = {
    id: string
    name: string
    backgroundColor: string
    itemStyle?: string
    textAlign?: string
    textColor?: string
    fontSize?: string
}

export type FreeNoteSlide = {
    id: string
    blockIndex: number
    name: string
    summary: string
    src: string
    items: Item[]
    settings: { backgroundColor?: string }
    outputId: string
}

export type FreeNoteHistoryItem = {
    id: string
    src: string
    name: string
    time: number
    mode?: "markdown" | "rich"
}

export type FreeNoteDraft = {
    id: string
    src: string
    updated: number
    mode?: "markdown" | "rich"
}

// set by the Ctrl+Shift+B shortcut to open a specific existing note in the editor
export const freeNoteOpenShow = writable("")

// bumped to ask the editor to start blank (a brand-new note session)
export const freeNoteResetToken = writable(0)

// open the editor with a fresh, empty note (a new FreeNote show is created on first build)
export function createNewFreeNote() {
    freeNoteShowId = null // next build creates a brand-new session note
    freeNoteResetToken.update((a) => a + 1)
    freeNoteActive.set(true)
    if (get(activePage) !== "show") activePage.set("show")
    setTimeout(() => focusedArea.set("free_note"))
}

let freeNoteShowId: string | null = null
let freeNoteShowName: string | null = null
let freeNoteShowCategory: string | null = null

// TEMPLATE PRESETS
export const freeNoteTemplates: FreeNoteTemplate[] = [
    {
        id: "full_announcement",
        name: "Full Announcement",
        backgroundColor: "",
        textAlign: "text-align:center;"
    },
    {
        id: "center_verse",
        name: "Center Verse",
        backgroundColor: "",
        textAlign: "text-align:center;",
        textColor: "#ffffff"
    },
    {
        id: "lower_third",
        name: "Lower Third",
        backgroundColor: "#00000000",
        itemStyle: "top:620px;left:50px;height:460px;width:1820px;",
        textAlign: "text-align:center;"
    },
    {
        id: "emergency_banner",
        name: "Emergency Banner",
        backgroundColor: "#c00000",
        itemStyle: "top:0px;left:0px;height:1080px;width:1920px;",
        textAlign: "text-align:center;",
        textColor: "#ffffff",
        fontSize: "2.2em"
    }
]

export function getFreeNoteTemplate(id: string | null): FreeNoteTemplate | null {
    return freeNoteTemplates.find((a) => a.id === id) || null
}

// Vertical position of the text block within the slide ("", top, center, bottom)
export const FREENOTE_VERTICALS: { id: string; label: string }[] = [
    { id: "top", label: "top" },
    { id: "center", label: "center" },
    { id: "bottom", label: "bottom" }
]

export const freeNoteVertical = writable<string>("")

// Block-level horizontal position of the text block ("", left, center, right)
export const FREENOTE_HORIZONTALS: { id: string; label: string }[] = [
    { id: "left", label: "left" },
    { id: "center", label: "center" },
    { id: "right", label: "right" }
]

export const freeNoteHorizontal = writable<string>("")

// Default font family applied to every typed line ("", or a font family name)
export const freeNoteFont = writable<string>("")

// verified temp-slide payload shape (scripture.ts:335 / output.ts:60)
export function buildTempPayload(items: Item[], _outputId = "", settings: { backgroundColor?: string } = {}) {
    return {
        id: "temp",
        categoryId: "",
        tempItems: items,
        previousSlides: [],
        nextSlides: [],
        settings,
        customDynamicValues: {}
    }
}

// b:John 3:16 shortcode expansion via the native scripture pipeline
export async function expandBibleShortcode(reference: string): Promise<Item[][] | null> {
    const show = await generateScriptureShowFromReference(reference)
    if (!show?.slides?.length) return null
    return show.slides
}

// build slides for one block. Returns array (shortcode blocks can expand).
export async function buildBlockSlides(block: string, blockIndex: number, template: FreeNoteTemplate | null, outputId = "", vertical = get(freeNoteVertical), horizontal = get(freeNoteHorizontal), defaultFont = get(freeNoteFont)): Promise<FreeNoteSlide[]> {
    const trimmed = block.trim()
    const shortcode = trimmed.match(/^([bh]):(.+)$/i)

    if (shortcode) {
        const type = shortcode[1].toLowerCase()
        const reference = shortcode[2].trim()

        if (type === "b") {
            const scriptureSlides = await expandBibleShortcode(reference)
            if (scriptureSlides?.length) {
                return scriptureSlides.map((items, i) => createSlide(items, blockIndex, block, template, outputId, i))
            }
        }
    }

    const item = blockToItem(trimmed, template, vertical, horizontal, defaultFont)
    return [createSlide([item], blockIndex, block, template, outputId, 0)]
}

function createSlide(items: Item[], blockIndex: number, block: string, template: FreeNoteTemplate | null, outputId = "", index = 0): FreeNoteSlide {
    const settings = template?.backgroundColor ? { backgroundColor: template.backgroundColor } : {}
    const firstText = getFirstTextLine(items) || ""
    const name = firstText.slice(0, 40) || `Slide ${blockIndex + 1}`
    const summary = block
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(" · ")
        .slice(0, 120)

    return {
        id: uid(6),
        blockIndex,
        name: index > 0 ? `${name} (${index + 1})` : name,
        summary,
        src: block,
        items,
        settings,
        outputId
    }
}

function getFirstTextLine(items: Item[]): string {
    for (const item of items) {
        for (const line of item.lines || []) {
            const value = (line.text || []).map((a) => a.value).join("")
            if (value.trim()) return value.trim()
        }
    }
    return ""
}

// Build all slides from the markdown source (pure — does not touch the show).
// This is the list of slides that CAN be displayed.
export async function buildAllSlides(src: string, template: FreeNoteTemplate | null, outputId = "", vertical = get(freeNoteVertical), horizontal = get(freeNoteHorizontal), defaultFont = get(freeNoteFont)): Promise<FreeNoteSlide[]> {
    const blocks = splitBlocks(src)
    const slides: FreeNoteSlide[] = []
    for (let i = 0; i < blocks.length; i++) {
        slides.push(...(await buildBlockSlides(blocks[i], i, template, outputId, vertical, horizontal, defaultFont)))
    }
    return slides
}

// Build all slides from the rich HTML (pure — does not touch the show).
// `<hr>` elements split the document into one chunk (slide) each, and every
// chunk passes the DOMPurify gate inside htmlToItems.
export async function buildRichSlides(html: string, template: FreeNoteTemplate | null, outputId = "", vertical = get(freeNoteVertical), horizontal = get(freeNoteHorizontal), defaultFont = get(freeNoteFont), projection = get(freeNoteProjection)): Promise<FreeNoteSlide[]> {
    const chunks = chunkRichHtml(html)
    const slides: FreeNoteSlide[] = []
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const plain = plainTextOfChunk(chunk)

        // b: shortcode expands through the native scripture pipeline
        const shortcode = plain.match(/^([bh]):(.+)$/i)
        if (shortcode && shortcode[1].toLowerCase() === "b") {
            const scriptureSlides = await expandBibleShortcode(shortcode[2].trim())
            if (scriptureSlides?.length) {
                scriptureSlides.forEach((slideItems, k) => slides.push(createSlide(slideItems, i, chunk, template, outputId, k)))
                continue
            }
        }

        const items = htmlToItems(chunk, template, vertical, horizontal, defaultFont, projection)
        if (!items.length) continue
        slides.push(createSlide(items, i, chunk, template, outputId, 0))
    }
    return slides
}

// Commit the current slide list into the real FreeNote show + update the mirror.
// (Title creation only happens once, when the show is first built.)
async function commitSlidesToShow(slides: FreeNoteSlide[], title: string): Promise<void> {
    if (!slides.length) {
        freeNoteSlides.set([])
        return
    }

    // Ensure we have a FreeNote show
    await ensureFreeNoteShow(title)

    // Replace the show's slides with the current set (full show lives in showsCache)
    const showId = freeNoteShowId!
    showsCache.update((cache) => {
        const show = cache[showId]
        if (!show) return cache

        const layoutId = Object.keys(show.layouts)[0]
        if (!layoutId) return cache

        const newSlides: { [key: string]: any } = {}
        const layoutSlides: { id: string }[] = []
        slides.forEach((slide) => {
            const slideId = uid()
            newSlides[slideId] = {
                id: slideId,
                group: null,
                color: null,
                settings: slide.settings,
                notes: "",
                items: slide.items
            }
            layoutSlides.push({ id: slideId })
        })
        show.slides = newSlides
        show.layouts[layoutId].slides = layoutSlides

        if (show.timestamps) show.timestamps.modified = Date.now()
        return cache
    })

    // Mark unsaved so FreeShow persists the new slides to disk
    saved.set(false)

    // Update local slides store for UI (mirror)
    freeNoteSlides.set(slides)
}

// Sync the full slide list into the real FreeNote show and update the local mirror.
export async function syncFreeNoteSlides(src: string, template: FreeNoteTemplate | null, outputId = "", vertical = get(freeNoteVertical), horizontal = get(freeNoteHorizontal), defaultFont = get(freeNoteFont)): Promise<FreeNoteSlide[]> {
    const slides = await buildAllSlides(src, template, outputId, vertical, horizontal, defaultFont)
    await commitSlidesToShow(slides, extractFirstHeading(src))
    return slides
}

// Rich variant of syncFreeNoteSlides — HTML source, rich builder.
export async function syncRichSlides(html: string, template: FreeNoteTemplate | null, outputId = "", vertical = get(freeNoteVertical), horizontal = get(freeNoteHorizontal), defaultFont = get(freeNoteFont), projection = get(freeNoteProjection)): Promise<FreeNoteSlide[]> {
    const slides = await buildRichSlides(html, template, outputId, vertical, horizontal, defaultFont, projection)
    const firstChunk = chunkRichHtml(html)[0] || ""
    const title = plainTextOfChunk(firstChunk).split("\n")[0].slice(0, 60)
    await commitSlidesToShow(slides, title)
    return slides
}

// Explicitly save the FreeNote show (persists the current slides to disk).
export function saveFreeNoteShow(): boolean {
    if (!freeNoteShowId || !get(shows)[freeNoteShowId]) return false
    saved.set(false)
    return true
}

// Bind the session to an existing FreeNote show so later syncs update it instead
// of creating a duplicate show after a restart.
export function setFreeNoteShow(id: string) {
    freeNoteShowId = id
    const show = get(showsCache)[id]
    freeNoteShowName = show?.name ?? null
    freeNoteShowCategory = (show as any)?.category ?? null
}

// Ensure a real FreeShow exists for this FreeNote session.
// Title comes from the passed heading (markdown) or first plain-text line (rich).
async function ensureFreeNoteShow(title: string): Promise<void> {
    if (freeNoteShowId && get(shows)[freeNoteShowId]) return

    const safeTitle = checkName(title || "FreeNote")

    // Use convertText to create a proper show structure
    const { id: showId, show } = convertText({
        name: safeTitle,
        category: freeNoteShowCategory,
        text: "", // start empty, we'll add slides manually
        origin: "freenote",
        returnData: true
    })

    freeNoteShowId = showId
    freeNoteShowName = safeTitle
    freeNoteShowCategory = show.category

    // Persist locally
    const store = get(projects)[get(activeProject) || ""]
    const index = store?.shows?.length ?? 0
    history({
        id: "UPDATE",
        newData: { data: show, remember: { project: get(activeProject), index } },
        oldData: { id: showId },
        location: { page: "show", id: "show" }
    })

    // Set as active show
    activeShow.set({ id: showId, type: "show", index })
    await loadShows([showId])
}

export async function showSlideAtIndex(slideIndex: number, outputId = ""): Promise<void> {
    if (!freeNoteShowId) return

    const show = get(showsCache)[freeNoteShowId]
    if (!show) return

    const layoutId = Object.keys(show.layouts)[0]
    const layoutSlides = show.layouts[layoutId]?.slides || []
    if (slideIndex < 0 || slideIndex >= layoutSlides.length) return

    const slideId = layoutSlides[slideIndex].id
    const slide = show.slides[slideId]
    if (!slide) return

    freeNoteNow.set(slideIndex)

    // Broadcast via temp slide (for live preview on projector)
    sendFreeNote(buildTempPayload(slide.items, outputId, slide.settings), outputId)
}

// Hot refresh: rebuild the currently shown slide from source
let airSrc: string | null = null
let airTemplateId: string | null = null
let airOutputId = ""
let hotRefreshTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleHotRefresh(src: string, templateId: string | null, outputId = "") {
    airSrc = src
    airTemplateId = templateId
    airOutputId = outputId

    if (hotRefreshTimer) clearTimeout(hotRefreshTimer)
    hotRefreshTimer = setTimeout(() => refreshAirSlide(), 250)
}

export async function refreshAirSlide() {
    const showIndex = get(freeNoteNow)
    if (showIndex < 0 || airSrc === null) return

    const template = getFreeNoteTemplate(airTemplateId)
    let rebuilt: FreeNoteSlide | undefined

    if (get(freeNoteMode) === "rich") {
        // rich mode: rebuild the on-air chunk from the raw HTML
        const chunks = chunkRichHtml(airSrc)
        if (showIndex >= chunks.length) return
        const items = htmlToItems(chunks[showIndex], template, get(freeNoteVertical), get(freeNoteHorizontal), get(freeNoteFont), get(freeNoteProjection))
        if (!items.length) return
        rebuilt = createSlide(items, showIndex, chunks[showIndex], template, airOutputId, 0)
    } else {
        const blocks = splitBlocks(airSrc)
        if (showIndex >= blocks.length) return
        const block = blocks[showIndex]
        rebuilt = (await buildBlockSlides(block, showIndex, template, airOutputId, get(freeNoteVertical), get(freeNoteHorizontal), get(freeNoteFont)))[0]
    }
    if (!rebuilt) return

    // Update the real show's slide
    if (freeNoteShowId) {
        showsCache.update((cache) => {
            const show = cache[freeNoteShowId!]
            if (!show) return cache
            const layoutId = Object.keys(show.layouts)[0]
            const layoutSlides = show.layouts[layoutId]?.slides || []
            const slideId = layoutSlides[showIndex]?.id
            if (slideId && show.slides[slideId]) {
                show.slides[slideId] = {
                    ...show.slides[slideId],
                    items: rebuilt.items,
                    settings: rebuilt.settings
                }
                if (show.timestamps) show.timestamps.modified = Date.now()
            }
            return cache
        })
        saved.set(false)
    }

    // Update local mirror
    freeNoteSlides.update((arr) => arr.map((s, i) => (i === showIndex ? { ...rebuilt, id: s.id } : s)))

    // Re-broadcast
    sendFreeNote(buildTempPayload(rebuilt.items, airOutputId, rebuilt.settings), airOutputId)
}

// RECENTS / HISTORY

function saveHistory(slide: FreeNoteSlide) {
    const item: FreeNoteHistoryItem = { id: uid(6), src: slide.src, name: slide.name, time: Date.now(), mode: get(freeNoteMode) }
    freeNoteHistory.update((a) => [item, ...a.filter((h) => h.src !== slide.src)].slice(0, 20))
    persist()
}

export function rebroadcastHistoryItem(id: string) {
    const item = get(freeNoteHistory).find((a) => a.id === id)
    if (!item) return
    const rebuild = item.mode === "rich" ? buildRichSlides(item.src, null) : buildBlockSlides(item.src, 0, null).then((slides) => slides)
    rebuild.then((slides) => {
        if (slides[0]) showSlideAtIndex(0) // will create show if needed
    })
}

export function clearHistory() {
    freeNoteHistory.set([])
    persist()
}

// PERSISTENCE (queue/history -> localStorage)

const STORAGE_KEY = "freeshow_freenote"
const DRAFT_KEY = "freeshow_freenote_draft"

export function persist() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                slides: get(freeNoteSlides),
                history: get(freeNoteHistory),
                font: get(freeNoteFont),
                mode: get(freeNoteMode),
                projection: get(freeNoteProjection)
            })
        )
    } catch (err) {
        console.error("Error persisting FreeNote slides:", err)
    }
}

export function restore() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            const data = JSON.parse(saved)
            if (Array.isArray(data?.slides)) freeNoteSlides.set(data.slides)
            if (Array.isArray(data?.history)) freeNoteHistory.set(data.history)
            if (typeof data?.font === "string") freeNoteFont.set(data.font)
            if (data?.mode === "markdown" || data?.mode === "rich") freeNoteMode.set(data.mode)
            if (typeof data?.projection === "string") freeNoteProjection.set(data.projection)
        }
        const draft = localStorage.getItem(DRAFT_KEY)
        if (draft) {
            const draftData = JSON.parse(draft)
            if (draftData?.src) {
                const d: FreeNoteDraft = { id: draftData.id || uid(6), src: draftData.src, updated: draftData.updated || Date.now(), mode: draftData.mode === "rich" ? "rich" : "markdown" }
                freeNoteDrafts.set([d])
                if (d.mode) freeNoteMode.set(d.mode)
            }
        }
    } catch (err) {
        console.error("Error restoring FreeNote data:", err)
    }
}

let draftTimer: ReturnType<typeof setTimeout> | null = null
export function saveDraft(src: string, mode: "markdown" | "rich" = get(freeNoteMode)) {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
        try {
            const current = get(freeNoteDrafts)[0]
            const draft: FreeNoteDraft = { id: current?.id || uid(6), src, updated: Date.now(), mode }
            freeNoteDrafts.set([draft])
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
        } catch (err) {
            console.error("Error saving FreeNote draft:", err)
        }
    }, 400)
}

export function deleteDraft() {
    freeNoteDrafts.set([])
    try {
        localStorage.removeItem(DRAFT_KEY)
    } catch (err) {
        console.error("Error removing FreeNote draft:", err)
    }
}

// EXPORT

export function exportMarkdown(src: string) {
    const name = getExportFileName()
    send(EXPORT, ["TEXT"], { content: src, name, extension: ".md" })
}

export function exportHtml(src: string) {
    const title = getExportFileName()
    const body = renderMarkdown(src)
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
    body { background-color: #101014; color: #f0f0f5; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 40px; }
    main { max-width: 900px; margin: 0 auto; font-size: 1.6em; line-height: 1.5; }
    h1, h2, h3 { color: #ffffff; }
    pre, code { background: rgba(255,255,255,0.08); border-radius: 6px; }
    pre { padding: 12px; overflow-x: auto; }
    code { padding: 2px 5px; }
    blockquote { border-left: 3px solid #f0008c; margin-left: 0; padding-left: 16px; }
    li { margin: 4px 0; }
</style>
</head>
<body>
<main>${body}</main>
</body>
</html>`
    send(EXPORT, ["TEXT"], { content: html, name: title, extension: ".html" })
}

function getExportFileName() {
    const firstBlock = get(freeNoteSlides)[0]?.name || "FreeNote"
    return firstBlock.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "FreeNote"
}

// rich-mode exports: .md is derived from the plain text, .html stays sanitized
export function exportRichMarkdown(html: string) {
    exportMarkdown(htmlToMarkdown(html))
}

export function exportRichHtml(html: string) {
    const title = getExportFileName()
    const body = sanitizeRich(html)
    const escaped = escapeHtml(title)
    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaped}</title>
<style>
    body { background-color: #101014; color: #f0f0f5; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 40px; }
    main { max-width: 1000px; margin: 0 auto; font-size: 1.6em; line-height: 1.5; }
    h1, h2, h3 { color: #ffffff; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; }
    hr { border: none; border-top: 2px solid #f0008c; margin: 40px 0; }
    blockquote { border-left: 3px solid #f0008c; margin-left: 0; padding-left: 16px; }
</style>
</head>
<body>
<main>${body}</main>
</body>
</html>`
    send(EXPORT, ["TEXT"], { content: htmlDoc, name: title, extension: ".html" })
}

function escapeHtml(value: string) {
    const map: { [key: string]: string } = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
    return value.replace(/[&<>"']/g, (char) => map[char])
}

// OUTPUT TARGETS

export function getFreeNoteOutputs() {
    return Object.entries(get(outputs))
        .filter(([, output]) => output.enabled)
        .map(([id, output]) => ({ id, name: output.name || id }))
}

export function outputLabel(id: string, outputsList: { id: string; name: string }[]) {
    if (!id) return translateText("freenote.all_outputs")
    return outputsList.find((a) => a.id === id)?.name || id
}

// MEDIA STRIP

const FULLSCREEN_ITEM_STYLE = "top:0px;left:0px;height:1080px;width:1920px;"

export function createMediaItem(path: string): Item {
    return { style: FULLSCREEN_ITEM_STYLE, type: "media", src: path, fit: "contain", textFit: "none" }
}

export function createTimerItem(): Item {
    return { style: FULLSCREEN_ITEM_STYLE, type: "timer", timer: { id: uid(6), name: "Counter", type: "counter", start: 300, end: 0 }, textFit: "none" }
}

export function createClockItem(): Item {
    return { style: FULLSCREEN_ITEM_STYLE, type: "clock", clock: { type: "digital", dateFormat: "none", showTime: true, seconds: false }, textFit: "none" }
}

export function createWebItem(): Item {
    return { style: FULLSCREEN_ITEM_STYLE, type: "web", web: { url: "" }, textFit: "none" }
}

export function createCameraItem(): Item {
    return { style: FULLSCREEN_ITEM_STYLE, type: "camera", textFit: "none" }
}

// Add media to the currently shown slide
export function addMediaItem(item: Item) {
    const showIndex = get(freeNoteNow)
    if (showIndex < 0 || !freeNoteShowId) return

    showsCache.update((cache) => {
        const show = cache[freeNoteShowId!]
        if (!show) return cache

        const layoutId = Object.keys(show.layouts)[0]
        const layoutSlides = show.layouts[layoutId]?.slides || []
        const slideId = layoutSlides[showIndex]?.id
        if (!slideId || !show.slides[slideId]) return cache

        show.slides[slideId] = {
            ...show.slides[slideId],
            items: [...(show.slides[slideId].items || []), item]
        }
        if (show.timestamps) show.timestamps.modified = Date.now()
        return cache
    })

    saved.set(false)

    // Mirror the media into the local slide so the preview reflects it
    freeNoteSlides.update((arr) => arr.map((s, i) => (i === showIndex ? { ...s, items: [...(s.items || []), item] } : s)))

    // Re-broadcast the updated slide
    const show = get(showsCache)[freeNoteShowId]
    if (show) {
        const layoutId = Object.keys(show.layouts || {})[0]
        const slides = show.layouts?.[layoutId]?.slides || []
        const slide = slides[showIndex]?.id ? show.slides[slides[showIndex].id] : null
        if (slide) sendFreeNote(buildTempPayload(slide.items, "", slide.settings), "")
    }
}

export function addMediaItemLive(item: Item, outputId = "") {
    addMediaItem(item) // same as above now
}

// Reset FreeNote session (new show on next use)
export function resetFreeNoteSession() {
    freeNoteShowId = null
    freeNoteShowName = null
    freeNoteShowCategory = null
    freeNoteNow.set(-1)
    freeNoteSlides.set([])
}
