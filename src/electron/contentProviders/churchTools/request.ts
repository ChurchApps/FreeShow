/**
 * WARNING: This file should ONLY be accessed through ChurchToolsProvider.
 * Do not import or use functions from this file directly in other parts of the application.
 * Use ContentProviderRegistry or ChurchToolsProvider instead.
 */

import fs from "fs"
import path from "path"
import { uid } from "uid"
import { ToMain } from "../../../types/IPC/ToMain"
import { SNG_SECTION_RE, parseSngMeta, sngSlideTagToGroup } from "../../../types/Songbeamer"
import type { Show, Slide, SlideData } from "../../../types/Show"
import { sendToMain } from "../../IPC/main"
import { importShow } from "../../data/import"
import { getDataFolderPath, sanitizeFileName } from "../../utils/files"
import { httpsRequest } from "../../utils/requests"
import { ctGetAccess } from "./connect"

const ITEM_STYLE = "left:50px;top:120px;width:1820px;height:840px;"
const ITEM_STYLE_TOP    = "left:50px;top:80px;width:1820px;height:430px;"
const ITEM_STYLE_BOTTOM = "left:50px;top:530px;width:1820px;height:430px;"
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

let msOfficePptConverter: ((inputPath: string) => Promise<any>) | null = null
try {
    // Optional converter module from the dedicated PPT PR.
    // Falls back to the normal import pipeline when unavailable.
    const mod = require("../../output/ppt/msOfficeConverter")
    if (typeof mod?.convertPptFileToSlides === "function") msOfficePptConverter = mod.convertPptFileToSlides
} catch {}

// ── API request ──────────────────────────────────────────────────────────────

function ctGet(domain: string, token: string, endpoint: string, params?: Record<string, string>): Promise<any> {
    return new Promise((resolve) => {
        let path = `/api/${endpoint}`
        if (params && Object.keys(params).length) path += `?${new URLSearchParams(params).toString()}`
        const headers = { Authorization: `Login ${token}`, Accept: "application/json" }
        httpsRequest(domain, path, "GET", headers, {}, (err, result) => {
            if (err) {
                if (err.statusCode !== 404) console.warn(`ChurchTools [${endpoint}]:`, err.message)
                return resolve(null)
            }
            resolve(result)
        })
    })
}

// ── Lyrics parser ────────────────────────────────────────────────────────────

// CT stores lyrics in a chordChart field; strips chord lines (e.g. "Am G C F") and parses [Section] markers.
function parseLyrics(text: string): { label: string; lines: string[] }[] {
    if (!text?.trim()) return []

    const sections: { label: string; lines: string[] }[] = []
    let label = "Verse"
    let block: string[] = []
    let labelUsed = false

    function flush() {
        const content = block.map((l) => l.trim()).filter(Boolean)
        if (!content.length) return
        sections.push({ label: labelUsed ? `${label} ${sections.filter((s) => s.label.startsWith(label)).length + 1}` : label, lines: content })
        labelUsed = true
        block = []
    }

    const chordLineRe = /^([A-G][b#]?(?:m|maj|min|sus|add|aug|dim|7|9|11|13)?\d*(?:\/[A-G][b#]?)?\s*){2,}$/i

    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()
        if (/^-{2,}$/.test(line)) continue          // separator ---
        if (chordLineRe.test(line)) continue         // chord-only line

        const sectionMatch = line.match(/^\[(.+)\]$/)
        if (sectionMatch) {
            flush()
            label = sectionMatch[1].trim()
            labelUsed = false
            continue
        }

        if (!line) {
            flush()
            continue
        }

        block.push(line)
    }
    flush()

    return sections
}

// ── Show builders ────────────────────────────────────────────────────────────

function buildSongShow(title: string, author: string, ccli: string, key: string, copyright: string, lyrics: string): { showId: string; show: Show } {
    const sections = parseLyrics(lyrics)
    const slides: { [id: string]: Slide } = {}
    const layout: SlideData[] = []

    if (!sections.length) {
        // No lyrics in the CT song database — create a single title slide
        const id = uid()
        slides[id] = { group: title, color: null, settings: {}, notes: "", items: [{ style: ITEM_STYLE, lines: [{ align: "text-align:center;", text: [{ style: "font-size:80px;font-weight:bold;", value: title }] }] }] }
        layout.push({ id })
    } else {
        sections.forEach(({ label, lines }) => {
            const id = uid()
            slides[id] = {
                group: label,
                globalGroup: label.toLowerCase().replace(/\s+\d+$/, "").trim(),
                color: null,
                settings: {},
                notes: "",
                items: [{ style: ITEM_STYLE, lines: lines.map((l) => ({ align: "", text: [{ style: "", value: l }] })) }]
            }
            layout.push({ id })
        })
    }

    const layoutId = uid()
    const show: Show = {
        name: title,
        category: "churchtools",
        timestamps: { created: Date.now(), modified: null, used: null },
        meta: { title, author, CCLI: ccli, key, copyright },
        settings: { activeLayout: layoutId, template: null },
        layouts: { [layoutId]: { name: "Default", notes: "", slides: layout } },
        slides,
        media: {}
    }

    return { showId: `ctsong_${uid(8)}`, show }
}

function buildHeaderShow(title: string, note: string, dateLabel: string): { showId: string; show: Show } {
    // Include service date so headers from different weeks are always treated as distinct shows
    const qualifiedName = `${dateLabel} ${title}`
    const slideId = uid()
    const layoutId = uid()
    const show: Show = {
        name: qualifiedName,
        category: "churchtools",
        timestamps: { created: Date.now(), modified: null, used: null },
        meta: { title },
        settings: { activeLayout: layoutId, template: null },
        layouts: {
            [layoutId]: {
                name: "Default",
                notes: note,
                slides: [{
                    id: slideId,
                    // automatically clears video/background when this slide is activated
                    actions: { slideActions: [{ id: uid(8), triggers: ["clear_background"], actionValues: {} }] }
                }]
            }
        },
        slides: {
            [slideId]: {
                group: title,
                color: null,
                settings: { color: "#000000" },  // black screen — no text, clears content when activated
                notes: note,
                items: []
            }
        },
        media: {}
    }
    return { showId: `ctheader_${uid(8)}`, show }
}

// ── File attachments ────────────────────────────────────────────────────────

function buildVideoShow(filename: string, localPath: string): { showId: string; show: Show } {
    const slideId = uid()
    const mediaId = uid()
    const layoutId = uid()
    const show: Show = {
        name: filename,
        category: "churchtools",
        timestamps: { created: Date.now(), modified: null, used: null },
        meta: { title: filename },
        settings: { activeLayout: layoutId, template: null },
        layouts: { [layoutId]: { name: "Default", notes: "", slides: [{ id: slideId, background: mediaId }] } },
        slides: { [slideId]: { group: filename, color: null, settings: {}, notes: "", items: [] } },
        media: { [mediaId]: { name: filename, path: localPath, type: "video", loop: false } as any }
    }
    return { showId: `ctvideo_${uid(8)}`, show }
}

// CT file downloads require a 2-step session: first request returns 302 + Set-Cookie, second with that cookie returns the file
function downloadCtFile(_domain: string, token: string, frontendUrl: string, destPath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const https = require("https")
        const fsSync = require("fs")
        const parsed = new URL(frontendUrl)
        const baseHeaders = { Authorization: `Login ${token}`, "User-Agent": "FreeShow/1.0", Accept: "*/*" }

        // Step 1: collect session cookie from the 302 response
        const req1 = https.request({ hostname: parsed.hostname, port: 443, path: parsed.pathname + parsed.search, method: "GET", headers: baseHeaders }, (res1: any) => {
            const setCookie: string = ((res1.headers["set-cookie"] ?? []) as string[]).map((c) => c.split(";")[0]).join("; ")
            res1.resume()

            // Step 2: re-request same URL with cookie — CT returns the actual file
            const req2 = https.request({ hostname: parsed.hostname, port: 443, path: parsed.pathname + parsed.search, method: "GET", headers: { ...baseHeaders, Cookie: setCookie } }, (res2: any) => {
                if (res2.statusCode !== 200) { res2.resume(); return resolve(false) }
                const file = fsSync.createWriteStream(destPath)
                res2.pipe(file)
                file.on("finish", () => { file.close(); resolve(fsSync.statSync(destPath).size > 1000) })
                file.on("error", () => resolve(false))
            })
            req2.on("error", () => resolve(false))
            req2.end()
        })
        req1.on("error", () => resolve(false))
        req1.end()
    })
}

async function fetchEventAttachments(domain: string, token: string, eventId: number, eventFiles: any[]): Promise<{ name: string; localPath: string; isVideo: boolean }[]> {
    // CT eventFiles uses flat structure on event object — download via 2-step cookie session using frontendUrl
    console.info(`ChurchTools: event ${eventId} attachments: ${eventFiles.length}`)
    if (!eventFiles.length) return []

    const destFolder = getDataFolderPath("imports", "ChurchTools")
    await fs.promises.mkdir(destFolder, { recursive: true })

    const downloaded: { name: string; localPath: string; isVideo: boolean }[] = []
    for (const file of eventFiles) {
        const name = (file.title ?? file.name ?? "").trim()
        if (!name || !/\.(pptx?|pdf|mp4|mov|avi|mkv|webm|m4v)$/i.test(name)) continue
        const downloadUrl: string = file.frontendUrl ?? file.apiUrl ?? ""
        if (!downloadUrl) continue
        const localPath = path.join(destFolder, sanitizeFileName(name))
        const isVideo = /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(name)
        const ok = await downloadCtFile(domain, token, downloadUrl, localPath)
        if (ok) {
            downloaded.push({ name, localPath, isVideo })
            console.info(`ChurchTools: downloaded attachment "${name}"`)
        } else {
            console.warn(`ChurchTools: download failed for "${name}"`)
        }
    }
    return downloaded
}

// ── .sng fallback index ──────────────────────────────────────────────────────

// Windows-1252 code points 0x80-0x9F that differ from ISO-8859-1
const WIN1252: Record<number, string> = {
    0x80: "\u20AC", 0x82: "\u201A", 0x83: "\u0192", 0x84: "\u201E", 0x85: "\u2026",
    0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02C6", 0x89: "\u2030", 0x8A: "\u0160",
    0x8B: "\u2039", 0x8C: "\u0152", 0x8E: "\u017D", 0x91: "\u2018", 0x92: "\u2019",
    0x93: "\u201C", 0x94: "\u201D", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
    0x98: "\u02DC", 0x99: "\u2122", 0x9A: "\u0161", 0x9B: "\u203A", 0x9C: "\u0153",
    0x9E: "\u017E", 0x9F: "\u0178"
}

// Read a .sng file with correct encoding (SongBeamer defaults to Windows-1252/Latin-1)
async function readSngFile(filePath: string): Promise<string> {
    const buf = await fs.promises.readFile(filePath)
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.slice(3).toString("utf-8") // UTF-8 BOM
    const header = buf.slice(0, 512).toString("latin1")
    const enc = header.match(/^#Encoding=(.+)$/im)?.[1]?.trim().toLowerCase() ?? ""
    if (enc === "utf-8" || enc === "utf8") return buf.toString("utf-8")
    // Default: Latin-1 with Windows-1252 overrides for curly quotes, em-dash etc.
    return buf.toString("latin1").replace(/[\x80-\x9F]/g, (c) => WIN1252[c.charCodeAt(0)] ?? c)
}

// Build a normalized-title → filepath map from all .sng files in a folder.
async function buildSngIndex(folderPath: string): Promise<{ byTitle: Map<string, string>; byCcli: Map<string, string> }> {
    const byTitle = new Map<string, string>()
    const byCcli  = new Map<string, string>()

    async function scan(dir: string) {
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true })
            await Promise.all(entries.map(async (e) => {
                const full = path.join(dir, e.name)
                if (e.isDirectory()) { await scan(full); return }
                if (!e.isFile() || !e.name.toLowerCase().endsWith(".sng")) return
                try {
                    const raw = await readSngFile(full)
                    const { title, ccli } = parseSngMeta(raw)
                    if (title) byTitle.set(title.toLowerCase().trim(), full)
                    if (ccli)  byCcli.set(ccli.trim(), full)
                    // Also index by CCLI number prefix in filename (e.g. "7213077 Praise.sng")
                    const filenameNum = e.name.match(/^(\d+)\s/)
                    if (filenameNum) byCcli.set(filenameNum[1], full)
                    // Fallback: index by title extracted from filename (strip CCLI prefix + extension)
                    const filenameTitle = e.name.replace(/^\d+\s+/, "").replace(/\.sng$/i, "").trim()
                    if (filenameTitle) byTitle.set(filenameTitle.toLowerCase(), full)
                } catch {}
            }))
        } catch {}
    }

    try {
        await scan(folderPath)
    } catch (err: any) {
        console.warn("ChurchTools: cannot read SongBeamer folder:", err.message)
    }
    console.info(`ChurchTools: sng index built — ${byTitle.size} titles, ${byCcli.size} CCLIs from "${folderPath}"`)
    if (byTitle.size === 0 && folderPath) sendToMain(ToMain.ALERT, `ChurchTools: SongBeamer folder found 0 .sng files.\nCheck path: ${folderPath}`)
    return { byTitle, byCcli }
}

// Convert raw .sng lyric body to [Section]\nLines format consumed by parseLyrics().
function sngToLyricsText(raw: string): string {
    const sections = raw.split(SNG_SECTION_RE).slice(1) // first part is headers
    return sections
        .map((section) => {
            const lines = section.split("\n").map((l) => l.trim()).filter(Boolean)
            if (!lines.length) return ""
            const { group, groupNumber } = sngSlideTagToGroup(lines[0])
            if (group !== null) {
                const label = groupNumber ? `${group} ${groupNumber}` : group
                return `[${label}]\n${lines.slice(1).join("\n")}`
            }
            return lines.join("\n")
        })
        .filter(Boolean)
        .join("\n\n")
}

// ── Bilingual .sng helpers ───────────────────────────────────────────────────

function getSngLangCount(raw: string): number {
    const header = raw.split(SNG_SECTION_RE)[0]
    const m = /^#LangCount=(\d+)/m.exec(header)
    const n = m ? parseInt(m[1], 10) : 1
    return isNaN(n) || n < 1 ? 1 : n
}

function sngToBilingualSections(raw: string, langCount: number): { label: string; langLines: string[][] }[] {
    const markerRe = /^#([A-Za-z]+)\s+/
    const langOverwriteRe = /^(#)?#(\d)\s+/
    return raw.split(SNG_SECTION_RE).slice(1).flatMap((section) => {
        const rawLines = section.split("\n")
        let label = ""
        let startIdx = 0
        const first = rawLines[0]?.trim() ?? ""
        if (first) {
            const { group, groupNumber } = sngSlideTagToGroup(first)
            if (group !== null) { label = groupNumber ? `${group} ${groupNumber}` : group; startIdx = 1 }
        }
        const langLines: string[][] = Array.from({ length: langCount }, () => [])
        let lang = 0
        for (let i = startIdx; i < rawLines.length; i++) {
            let line = rawLines[i].trim()
            if (!line) continue
            const marker = markerRe.exec(line)
            if (marker) {
                if (marker[1].toUpperCase() === "H") { lang++; continue }
                line = line.substring(marker[0].length)
            }
            const langMatch = langOverwriteRe.exec(line)
            if (langMatch) {
                const idx = parseInt(langMatch[2], 10) - 1
                const noInc = !!langMatch[1]
                const text = line.substring(langMatch[0].length).trim()
                if (idx >= 0 && idx < langCount && text) langLines[idx].push(text)
                if (!noInc) lang++
                continue
            }
            if (lang >= langCount) lang = 0
            langLines[lang].push(line)
            lang++
        }
        return langLines.some((l) => l.length > 0) ? [{ label, langLines }] : []
    })
}

function buildBilingualSongShow(title: string, author: string, ccli: string, key: string, copyright: string, raw: string, langCount: number): { showId: string; show: Show } {
    const sections = sngToBilingualSections(raw, langCount)
    if (!sections.length) return buildSongShow(title, author, ccli, key, copyright, sngToLyricsText(raw))

    const slides: { [id: string]: Slide } = {}
    const layout: SlideData[] = []
    const labelCounts: Record<string, number> = {}

    for (const { label, langLines } of sections) {
        const base = label || "Verse"
        labelCounts[base] = (labelCounts[base] ?? 0) + 1
        const group = labelCounts[base] > 1 ? `${base} ${labelCounts[base]}` : base
        const id = uid()
        slides[id] = {
            group,
            globalGroup: group.toLowerCase().replace(/\s+\d+$/, "").trim(),
            color: null,
            settings: {},
            notes: "",
            items: langLines.map((lines, i) => ({
                style: i === 0 ? ITEM_STYLE_TOP : ITEM_STYLE_BOTTOM,
                lines: (lines.length ? lines : [""]).map((l) => ({ align: "", text: [{ style: "", value: l }] }))
            }))
        }
        layout.push({ id })
    }

    const layoutId = uid()
    const show: Show = {
        name: title,
        category: "churchtools",
        timestamps: { created: Date.now(), modified: null, used: null },
        meta: { title, author, CCLI: ccli, key, copyright },
        settings: { activeLayout: layoutId, template: null },
        layouts: { [layoutId]: { name: "Default", notes: "", slides: layout } },
        slides,
        media: {}
    }
    return { showId: `ctsong_${uid(8)}`, show }
}

// ── Song/lyrics fetching ─────────────────────────────────────────────────────

async function fetchArrangementLyrics(domain: string, token: string, songId: number, arrangementId?: number): Promise<string> {
    if (!arrangementId) {
        const arrs = await ctGet(domain, token, `songs/${songId}/arrangements`)
        const arr = arrs?.data?.find((a: any) => a.attributes?.isDefault) ?? arrs?.data?.[0]
        if (arr?.id) arrangementId = arr.id
    }
    if (arrangementId) {
        const result = await ctGet(domain, token, `songs/${songId}/arrangements/${arrangementId}`)
        const attr = result?.data?.attributes ?? {}
        return attr.chordChart ?? attr.lyrics ?? ""
    }
    return ""
}

// CT agenda titles often prefix the type: "Song: Title", "Lied: Title" — strip it for matching
function stripTypePrefix(title: string): string {
    return title.replace(/^(?:song|lied|lob|worship|musik)\W+/i, "").trim()
}

async function lookupSng(sngIndex: { byTitle: Map<string, string>; byCcli: Map<string, string> }, title: string, ccli?: string): Promise<{ lyrics: string; raw: string; langCount: number; sngMeta: ReturnType<typeof parseSngMeta> } | null> {
    // CCLI match is the most reliable
    let sngPath = ccli ? sngIndex.byCcli.get(ccli.trim()) : undefined

    if (!sngPath && title) {
        const key = title.toLowerCase().trim()
        sngPath = sngIndex.byTitle.get(key)
        if (!sngPath) {
            const baseTitle = title.replace(/\s*[-\u2013]\s*.+$/, "").trim()
            if (baseTitle && baseTitle !== title) sngPath = sngIndex.byTitle.get(baseTitle.toLowerCase())
        }
        // Last resort: substring match (catches minor title variations)
        if (!sngPath && key.length > 4) {
            for (const [t, p] of sngIndex.byTitle.entries()) {
                if (t.includes(key) || key.includes(t)) { sngPath = p; break }
            }
        }
    }

    if (!sngPath) {
        console.info(`ChurchTools lookupSng MISS: title="${title}" ccli="${ccli ?? ""}" byTitle.size=${sngIndex.byTitle.size} byCcli.size=${sngIndex.byCcli.size}`)
        return null
    }
    try {
        const raw = await readSngFile(sngPath)
        const lyrics = sngToLyricsText(raw)
        if (lyrics.trim()) {
            console.info(`ChurchTools: .sng match for "${title}"${ccli ? ` (CCLI ${ccli})` : ""}`)
            const langCount = getSngLangCount(raw)
            const sngMeta = parseSngMeta(raw)
            return { lyrics, raw, langCount, sngMeta }
        }
    } catch {}
    return null
}

async function fetchSongMeta(domain: string, token: string, songId: number): Promise<{ title: string; author: string; ccli: string; key: string }> {
    const result = await ctGet(domain, token, `songs/${songId}`)
    const attr = result?.data?.attributes ?? {}
    // CT may use ccliNo, ccli, or ccliNumber depending on version
    const rawCcli = attr.ccliNo ?? attr.ccli ?? attr.ccliNumber ?? attr.ccliId ?? null
    console.info(`ChurchTools song ${songId}: name="${attr.name ?? attr.title}", ccliField keys=${Object.keys(attr).filter((k) => k.toLowerCase().includes("ccli")).join(",")}, ccli="${rawCcli}"`)
    return {
        title:  attr.name ?? attr.title ?? "",
        author: attr.author ?? attr.composer ?? "",
        ccli:   rawCcli != null && rawCcli !== "" ? String(rawCcli) : "",
        key:    attr.key ?? attr.keyOfSong ?? ""
    }
}

// ── Agenda item processing ───────────────────────────────────────────────────

async function processAgendaItem(domain: string, token: string, item: any, sngIndex?: { byTitle: Map<string, string>; byCcli: Map<string, string> }, dateLabel = "", translationMethod: "multiline" | "textboxes" = "textboxes"): Promise<{ showId: string; show: Show } | null> {
    const title = (item.title ?? item.name ?? "").trim()
    const note = (item.note ?? "").trim()

    // CT uses type="song" for linked songs and type="text" with a "Song: " prefix for unlinked song entries
    const isSongLike = item.type === "song" || (item.type === "text" && /^(?:song|lied|lob|worship|musik)\W/i.test(title))
    if (isSongLike) {
        const songTitle = stripTypePrefix(title)
        // CT may embed song under different property names depending on API version/include params
        const songObj = item.song ?? item.arrangement ?? item.songArrangement ?? null
        const linkedSongId: number | undefined = songObj?.id ?? songObj?.songId
        // Title and CCLI may be embedded directly in the song object from CT
        const embeddedTitle = (songObj?.title ?? songObj?.name ?? songObj?.song?.title ?? "").trim()
        const embeddedCcli  = String(songObj?.ccliNo ?? songObj?.ccli ?? songObj?.song?.ccliNo ?? "")
        console.info(`ChurchTools: song item title="${title}" songObj=${JSON.stringify(songObj)?.slice(0, 200)}`)

        if (linkedSongId) {
            // Song linked to CT database — get metadata + CT lyrics, fall back to .sng
            const songId: number = linkedSongId
            const arrangementId: number | undefined = songObj?.arrangements?.[0]?.id ?? songObj?.arrangementId
            const meta = await fetchSongMeta(domain, token, songId)
            // Merge: prefer API meta, fall back to embedded data from agenda item
            const resolvedTitle = meta.title || embeddedTitle || songTitle || "Song"
            const resolvedCcli  = meta.ccli  || embeddedCcli
            const ctLyrics = await fetchArrangementLyrics(domain, token, songId, arrangementId)
            const sngResult = sngIndex ? await lookupSng(sngIndex, resolvedTitle, resolvedCcli) : null
            const finalLyrics = ctLyrics || sngResult?.lyrics || ""
            const sngMeta = sngResult?.sngMeta
            const resolvedAuthor = meta.author || sngMeta?.author || ""
            const resolvedKey    = meta.key    || sngMeta?.key    || ""
            const finalCcli      = resolvedCcli || sngMeta?.ccli  || ""
            const copyright      = sngMeta?.copyright || ""
            const showName = finalCcli ? `${finalCcli} ${resolvedTitle}` : resolvedTitle
            if (translationMethod === "textboxes" && sngResult && sngResult.langCount >= 2) {
                return buildBilingualSongShow(showName, resolvedAuthor, finalCcli, resolvedKey, copyright, sngResult.raw, sngResult.langCount)
            }
            return buildSongShow(showName, resolvedAuthor, finalCcli, resolvedKey, copyright, finalLyrics)
        }

        // Song not linked to CT database — only promote to song show if .sng lyrics are found
        if (sngIndex && songTitle) {
            const sngResult = await lookupSng(sngIndex, songTitle)
            if (sngResult) {
                const sm = sngResult.sngMeta
                if (translationMethod === "textboxes" && sngResult.langCount >= 2) {
                    return buildBilingualSongShow(songTitle, sm.author, sm.ccli, sm.key, sm.copyright, sngResult.raw, sngResult.langCount)
                }
                return buildSongShow(songTitle, sm.author, sm.ccli, sm.key, sm.copyright, sngResult.lyrics)
            }
        }
        // No lyrics found: fall through to date-prefixed header show
    }

    if (!title) return null
    return buildHeaderShow(title, note, dateLabel)
}

// ── Calendar events ────────────────────────────────────────────────────────────

function toICalDateTime(dateStr: string): string {
    const d = new Date(dateStr)
    if (!dateStr || isNaN(d.getTime())) return ""
    return d.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z"
}

function escapeIcal(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

function buildICalContent(appointments: any[], calName: string, domain: string): string {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FreeShow//ChurchTools//EN", `X-WR-CALNAME:${escapeIcal(calName)}`]
    for (const appt of appointments) {
        const startRaw = appt.startDate ?? appt.base?.startDate ?? ""
        const endRaw   = appt.endDate   ?? appt.base?.endDate   ?? startRaw
        const name     = escapeIcal((appt.base?.title ?? appt.base?.caption ?? appt.title ?? appt.name ?? "").trim())
        const loc      = escapeIcal((appt.base?.location ?? appt.location ?? "").trim())
        const start    = toICalDateTime(startRaw)
        const end      = toICalDateTime(endRaw) || start
        if (!name || !start) continue
        lines.push("BEGIN:VEVENT", `UID:ct-${appt.id ?? uid(8)}@${domain}`, `SUMMARY:${name}`, `DTSTART:${start}`, `DTEND:${end}`)
        if (loc) lines.push(`LOCATION:${loc}`)
        lines.push("END:VEVENT")
    }
    lines.push("END:VCALENDAR")
    return lines.join("\r\n")
}

async function ctLoadCalendarEvents(domain: string, token: string, from: string, to: string): Promise<void> {
    let appointments: any[] = []

    // CT requires calendar_ids[] — fetch all calendars first, then build URL with IDs
    const cals = await ctGet(domain, token, "calendars")
    const calList: any[] = cals?.data ?? []
    if (calList.length) {
        const idParams = calList.map((c: any) => `calendar_ids[]=${encodeURIComponent(c.id)}`).join("&")
        const r = await ctGet(domain, token, `calendars/appointments?${idParams}&from=${from}&to=${to}`)
        if (r?.data?.length) appointments = r.data
    }

    // Fallback: per-calendar fetch if combined didn't work
    if (!appointments.length) {
        for (const cal of calList) {
            const r = await ctGet(domain, token, `calendars/${cal.id}/appointments`, { from, to })
            if (r?.data?.length) appointments.push(...r.data)
        }
    }

    if (!appointments.length) return

    // Group by calendar so each gets its own color in FreeShow
    const calMap = new Map<string, { name: string; items: any[] }>()
    for (const appt of appointments) {
        const calId   = String(appt.calendar?.id ?? appt.calendarId ?? "ct")
        const calName = appt.calendar?.name ?? "ChurchTools"
        if (!calMap.has(calId)) calMap.set(calId, { name: calName, items: [] })
        calMap.get(calId)!.items.push(appt)
    }

    const calendarData = Array.from(calMap.entries()).map(([calId, { name, items }]) => ({
        content: buildICalContent(items, name, domain),
        name,
        id: `ct_cal_${calId}`
    }))

    sendToMain(ToMain.IMPORT2, { channel: "calendar", data: calendarData as any })
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function ctLoadServices(serviceId?: number): Promise<void> {
    const access = ctGetAccess()
    if (!access?.domain || !access?.access_token) return

    const { domain, access_token: token } = access
    const weeks = Math.max(1, access.weeksAhead ?? 2)
    const now = new Date()
    const from = now.toISOString().slice(0, 10)
    const to = new Date(now.getTime() + weeks * ONE_WEEK_MS).toISOString().slice(0, 10)

    const params: Record<string, string> = { from, to, include: "eventFiles" }
    if (serviceId) params.serviceId = String(serviceId)

    const eventsResult = await ctGet(domain, token, "events", params)
    const events: any[] = eventsResult?.data ?? []

    if (!events.length) {
        sendToMain(ToMain.TOAST, "No upcoming ChurchTools services found in the next 8 weeks")
        return
    }

    sendToMain(ToMain.TOAST, `Loading ${events.length} service(s) from ChurchTools…`)

    const sngIndex = access.sngFolder ? await buildSngIndex(access.sngFolder) : undefined as { byTitle: Map<string, string>; byCcli: Map<string, string> } | undefined
    const translationMethod: "multiline" | "textboxes" = "textboxes"
    const pad = (n: number) => n.toString().padStart(2, "0")

    const projects: any[] = []
    const shows: any[] = []

    await Promise.all(
        events.map(async (event: any) => {
            const eventId: number = event.id
            const eventName: string = event.attributes?.name ?? event.name ?? `Service ${eventId}`
            const startDate: string = event.attributes?.startDate ?? event.startDate ?? now.toISOString()
            const timestamp = new Date(startDate).getTime() || Date.now()
            const d = new Date(startDate)
            const dateLabel = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${pad(d.getHours())}.${pad(d.getMinutes())}`
            const projectName = `${dateLabel} ${eventName}`

            const agendaResult = await ctGet(domain, token, `events/${eventId}/agenda`, { include: "songs" })
            const rawItems: any[] = agendaResult?.data?.attributes?.items ?? agendaResult?.data?.items ?? []
            if (!rawItems.length) return

            const sortedItems = [...rawItems].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

            const projectItems: any[] = []
            let seenBeforeEvent = false
            let eventStartInserted = false

            for (const item of sortedItems) {
                // CT section headers become FreeShow project dividers (no show created)
                if (item.type === "header" && item.title) {
                    projectItems.push({ type: "section", id: uid(5), name: item.title, scheduleLength: 0 })
                    continue
                }

                // CT renders "Eventstart" when isBeforeEvent transitions from true → false
                if (item.isBeforeEvent === true) seenBeforeEvent = true
                if (seenBeforeEvent && !eventStartInserted && item.isBeforeEvent !== true && item.type !== "header") {
                    projectItems.push({ type: "section", id: uid(5), name: "Eventstart", scheduleLength: 0 })
                    eventStartInserted = true
                }
                let result: Awaited<ReturnType<typeof processAgendaItem>> | null = null
                try {
                    result = await processAgendaItem(domain, token, item, sngIndex, dateLabel, translationMethod)
                } catch (err: any) {
                    console.warn(`ChurchTools: error on item "${item.title}": ${err?.message ?? err}`)
                }
                if (!result) continue
                shows.push({ id: result.showId, ...result.show })
                projectItems.push({ type: "show", id: result.showId, scheduleLength: item.duration ?? 0 })
            }

            // eventFiles is already in the flat event object; fallback to detail fetch if absent
            let rawEventFiles: any[] = event.eventFiles ?? event.attributes?.eventFiles ?? []
            if (!rawEventFiles.length) {
                const detail = await ctGet(domain, token, `events/${eventId}`, { include: "eventFiles" })
                rawEventFiles = detail?.data?.eventFiles ?? detail?.data?.attributes?.eventFiles ?? []
            }
            const attachments = await fetchEventAttachments(domain, token, eventId, rawEventFiles)
            // Append attachments: videos as playable shows, PPTX/PDF auto-converted to slides
            for (const att of attachments) {
                if (att.isVideo) {
                    const { showId, show } = buildVideoShow(att.name, att.localPath)
                    shows.push({ id: showId, ...show })
                    projectItems.push({ type: "show", id: showId, scheduleLength: 0 })
                } else {
                    const lowerName = att.name.toLowerCase()
                    if (/\.pdf$/i.test(lowerName)) {
                        sendToMain(ToMain.IMPORT2, { channel: "pdf", data: [att.localPath] })
                    } else if (/\.(ppt|pptx)$/i.test(lowerName)) {
                        if (msOfficePptConverter) {
                            await msOfficePptConverter(att.localPath).catch(() => {})
                        } else {
                            await importShow("powerpoint", [att.localPath], {})
                        }
                    }
                    projectItems.push({ type: "section", id: uid(5), name: `📎 ${att.name}`, notes: att.localPath, scheduleLength: 0 })
                }
            }

            if (projectItems.length) {
                projects.push({
                    id: String(eventId),
                    name: projectName,
                    scheduledTo: timestamp,
                    created: timestamp,
                    folderId: "",
                    folderName: "",
                    items: projectItems
                })
            }
        })
    )

    if (!projects.length) {
        sendToMain(ToMain.TOAST, "ChurchTools: no services with agenda items found")
        return
    }

    const sngSummary = sngIndex ? `sng:${sngIndex.byTitle.size}t/${sngIndex.byCcli.size}c` : "sng:none"
    const eventKeys = Object.keys(events[0]?.attributes ?? events[0] ?? {}).slice(0, 8).join(",")
    sendToMain(ToMain.TOAST, `CT: ${projects.length} services | ${sngSummary} | evKeys:${eventKeys}`)
    sendToMain(ToMain.PROVIDER_PROJECTS, { providerId: "churchtools", categoryName: "ChurchTools", shows, projects })

    // Import CT calendar appointments into the FreeShow calendar widget
    await ctLoadCalendarEvents(domain, token, from, to)
}
