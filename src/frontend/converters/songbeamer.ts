import { get } from "svelte/store"
import { uid } from "uid"
import type { Chords, ID, Item, Line, Show, Slide, SlideData } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { history } from "../components/helpers/history"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { activePopup, alertMessage, categories, drawerTabsData, globalTags } from "../stores"
import { translateText } from "../utils/language"
import { createCategory, setTempShows } from "./importHelpers"

interface SongbeamerChord {
    x: number
    line: number
    key: string
}

interface SongbeamerLine {
    text: string
    chords: SongbeamerChord[]
}

interface SongbeamerSlide {
    group: string | null
    globalGroup: string | null
    groupNumber: number | null
    lines: SongbeamerLine[][]
}

interface SongbeamerMetadata {
    lang_count: number
    title: string
    author: string
    copyright: string
    composer: string
    publisher: string
    comments: string
    keywords: string
    format: string
    title_format: string
    background_image: string
    number: string
    ccli: string
    tempo: number
    key: string
    chords: SongbeamerChord[][]
    verse_order: { group: string; groupNumber: number | null }[]
}

function getGroupId(group: string | null, groupNumber: number | null): string | null {
    if (!group) return null
    return groupNumber !== null ? `${group}${groupNumber}` : group
}

// Songbeamer files include a byte order mark
const BOM8 = String.fromCodePoint(0xef, 0xbb, 0xbf) // UTF-8
const BOM16 = String.fromCodePoint(0xfeff) // UTF-16

export function convertSongbeamerFiles(data: any) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    const activeCategory = get(drawerTabsData).shows?.activeSubTab
    const defaultCategory = activeCategory && activeCategory !== "all" && activeCategory !== "unlabeled" ? activeCategory : "songbeamer"
    const categoryId = get(categories)[defaultCategory] ? defaultCategory : createCategory("Songbeamer")

    const files = Array.isArray(data) ? data : data?.files || []
    const tempShows: { id: string; show: Show }[] = []

    setTimeout(() => {
        files.forEach(({ name, content }: any) => {
            if (!content || typeof content !== "string") return
            if (content.startsWith(BOM8)) content = content.slice(3)
            if (content.startsWith(BOM16)) content = content.slice(1)

            const show = convertSongbeamerFileToShow(name || "Song", content, categoryId)
            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

function convertSongbeamerFileToShow(name: string, text: string, categoryId: string): Show {
    const layoutId = uid()
    let show = new ShowObj(false, categoryId, layoutId)
    show.origin = "songbeamer"

    text = text.replaceAll("\r", "").replaceAll(/\n\s+\n/g, "\n\n")
    const sections: string[] = text.split(/(?:^|\n)--(?:-|A)?\s*\n/)

    const metadata = parseMetadata(sections.shift() || "")
    if (!metadata.title) metadata.title = name

    show.name = checkName(metadata.title)
    show.meta = {
        number: metadata.number,
        title: metadata.title,
        author: metadata.author,
        composer: metadata.composer,
        publisher: metadata.publisher,
        copyright: metadata.copyright,
        CCLI: metadata.ccli
    }
    if (show.meta.number !== undefined) show.quickAccess = { number: show.meta.number }
    if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

    // add tags
    const tags = getTags(metadata.keywords.split(",").filter((t) => t.trim()))
    if (tags.length) {
        if (!show.quickAccess) show.quickAccess = {}
        show.quickAccess.tags = tags
    }

    const songbeamerSlides = parseSongbeamerSlides(sections, metadata)
    const { slides, layout } = createSlides(songbeamerSlides, metadata)

    show.slides = slides
    show.layouts = {
        [layoutId]: {
            name: translateText("example.default"),
            notes: metadata.comments,
            slides: layout
        }
    }

    return show as Show
}

function getTags(tags: string[]) {
    return tags.map((tag) => getOrCreateTag(tag.trim()))
}

function getOrCreateTag(name: string) {
    const existing = Object.entries(get(globalTags)).find(([_id, tag]) => tag.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing[0]

    const tagId = uid(5)
    history({ id: "UPDATE", newData: { data: { name } }, oldData: { id: tagId }, location: { page: "show", id: "tag" } })
    return tagId
}

function base64Decode(text: string): string {
    try {
        const decoded = atob(text)
        const bytes = new Uint8Array(decoded.length)
        for (let i = 0; i < bytes.length; ++i) {
            bytes[i] = decoded.charCodeAt(i)
        }
        try {
            return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        } catch {
            return new TextDecoder("iso-8859-1").decode(bytes)
        }
    } catch {
        return text
    }
}

function parseMetadata(text: string): SongbeamerMetadata {
    const metadata: SongbeamerMetadata = {
        lang_count: 1,
        title: "",
        author: "",
        copyright: "",
        composer: "",
        publisher: "",
        comments: "",
        keywords: "",
        format: "",
        title_format: "",
        background_image: "",
        number: "",
        ccli: "",
        tempo: 0,
        key: "",
        chords: [],
        verse_order: []
    }

    text.split("\n").forEach((line: string) => {
        if (!line || !line.startsWith("#")) return
        const [key, ...rest] = line.slice(1).split("=")
        if (rest.length === 0) return
        const val = rest.join("=").trim()

        switch (key) {
            case "LangCount": {
                const langCount = parseInt(val, 10)
                if (!isNaN(langCount) && langCount > 0) metadata.lang_count = langCount
                break
            }
            case "Title":
                metadata.title = val
                break
            case "Author":
                metadata.author = val
                break
            case "(c)":
                metadata.copyright = val
                break
            case "Melody":
                metadata.composer = val
                break
            case "NatCopyright":
                metadata.publisher = val
                break
            case "Comments":
                metadata.comments = base64Decode(val)
                break
            case "Keywords":
                metadata.keywords = val
                break
            case "Format":
                metadata.format = val
                break
            case "TitleFormat":
                metadata.title_format = val
                break
            case "BackgroundImage":
                metadata.background_image = val
                break
            case "ChurchSongID":
                metadata.number = val
                break
            case "Key":
                metadata.key = val
                break
            case "Tempo": {
                const tempo = parseInt(val, 10)
                if (!isNaN(tempo) && tempo > 0) metadata.tempo = tempo
                break
            }
            case "Chords": {
                const chords = base64Decode(val)
                for (const chord of chords.split("\r")) {
                    const chordParts = chord.split(",")
                    if (chordParts.length < 3) continue
                    const chordLine = parseInt(chordParts[1], 10)
                    if (isNaN(chordLine)) continue
                    if (!metadata.chords[chordLine]) metadata.chords[chordLine] = []
                    metadata.chords[chordLine].push({
                        x: parseFloat(chordParts[0]),
                        line: chordLine,
                        key: chordParts[2]
                    })
                }
                break
            }
            case "CCLI": {
                const match = val.match(/^\d+/)
                if (match) metadata.ccli = match[0]
                break
            }
            case "VerseOrder": {
                const slideTags = val.split(",")
                for (const tag of slideTags) {
                    const { group, groupNumber } = slideTagToGroup(tag.trim())
                    if (group !== null) metadata.verse_order.push({ group, groupNumber })
                }
                break
            }
        }
    })

    return metadata
}

function convertChord(chord: SongbeamerChord): Chords {
    return {
        id: uid(5),
        pos: Math.ceil(chord.x),
        key: chord.key.replaceAll("<", "♭").replaceAll("=", "")
    }
}

const SongbeamerGroups: Record<string, string> = {
    unbekannt: "",
    unbenannt: "",
    unknown: "",
    intro: "Intro",
    vers: "Verse",
    verse: "Verse",
    strophe: "Verse",
    "pre-bridge": "Pre-Bridge",
    bridge: "Bridge",
    misc: "Misc",
    "pre-refrain": "Pre-Chorus",
    refrain: "Chorus",
    "pre-chorus": "Pre-Chorus",
    chorus: "Chorus",
    zwischenspiel: "Break",
    instrumental: "Break",
    interlude: "Break",
    "pre-coda": "Pre-Outro",
    coda: "Outro",
    ending: "Outro",
    outro: "Outro",
    teil: "Tag",
    part: "Tag",
    chor: "Tag",
    solo: "Tag"
}

const SongbeamerGlobalGroups: Record<string, string> = {
    Intro: "intro",
    Verse: "verse",
    "Pre-Bridge": "pre_bridge",
    Bridge: "bridge",
    "Pre-Chorus": "pre_chorus",
    Chorus: "chorus",
    Break: "break",
    "Pre-Outro": "pre_outro",
    Outro: "outro",
    Tag: "tag"
}

function slideTagToGroup(line: string): { group: string | null; globalGroup: string | null; groupNumber: number | null } {
    if (line.startsWith("#")) return { group: null, globalGroup: null, groupNumber: null }
    const [rawTag, rawNumber] = line.split(" ", 2)
    const tag = rawTag.toLowerCase()
    const parsedNumber = rawNumber ? parseInt(rawNumber, 10) : null
    const groupNumber = parsedNumber && !isNaN(parsedNumber) && parsedNumber >= 1 ? parsedNumber : null

    const group = tag in SongbeamerGroups ? SongbeamerGroups[tag] : null
    const globalGroup = group && group in SongbeamerGlobalGroups ? SongbeamerGlobalGroups[group] : null

    return { group, globalGroup, groupNumber }
}

function createLayoutFromVerseOrder(metadata: SongbeamerMetadata, groupSlides: Map<string, SlideData>): SlideData[] | null {
    if (!metadata.verse_order.length || !groupSlides.size) return null
    const layout: SlideData[] = []
    for (const { group, groupNumber } of metadata.verse_order) {
        const groupId = getGroupId(group, groupNumber)
        if (!groupId) continue
        const slide = groupSlides.get(groupId)
        if (slide) layout.push(slide)
    }
    return layout
}

function parseSongbeamerSlides(sections: string[], metadata: SongbeamerMetadata): SongbeamerSlide[] {
    const slides: SongbeamerSlide[] = []
    const markerRegex = /^#([a-zA-Z]+)\s+/
    const languageRegex = /^#(#)?(\d)?\s+/
    let chordLine = 0

    for (const section of sections) {
        const slide: SongbeamerSlide = {
            group: null,
            globalGroup: null,
            groupNumber: null,
            lines: Array.from({ length: metadata.lang_count }, () => [])
        }

        const lines = section.split("\n")
        const firstLine = lines[0] || ""

        if (firstLine.startsWith("$$M=")) {
            lines.shift()
            chordLine++
        } else {
            const { group, globalGroup, groupNumber } = slideTagToGroup(firstLine)
            if (group !== null) {
                lines.shift()
                chordLine++
                slide.group = group
                slide.globalGroup = globalGroup
                slide.groupNumber = groupNumber
            }
        }

        let language = 0
        let lastLineLanguage = -1

        for (let lineText of lines) {
            const chords = metadata.chords[chordLine] || []
            chordLine++

            if (language >= metadata.lang_count) language = 0
            let currentLineLanguage = language

            const marker = markerRegex.exec(lineText)
            if (marker) {
                if (marker[1] === "H") {
                    language++
                    continue
                }
                lineText = lineText.slice(marker[0].length)
            }

            const langOverwrite = languageRegex.exec(lineText)
            if (!langOverwrite) {
                if (lineText) language++
            } else {
                lineText = lineText.slice(langOverwrite[0].length)
                const langNumber = parseInt(langOverwrite[2], 10)
                if (!langOverwrite[1]) language++
                if (!isNaN(langNumber)) {
                    if (langNumber < 1 || langNumber > metadata.lang_count) continue
                    currentLineLanguage = langNumber - 1
                }
            }

            lineText = lineText.trim()
            const line: SongbeamerLine = { text: lineText, chords }

            if (metadata.lang_count > 1 && currentLineLanguage === lastLineLanguage) {
                const targetLines = slide.lines[currentLineLanguage]
                if (targetLines.length) {
                    targetLines[targetLines.length - 1].text += `\n${lineText}`
                } else {
                    targetLines.push(line)
                }
            } else {
                slide.lines[currentLineLanguage].push(line)
            }
            lastLineLanguage = currentLineLanguage
        }

        chordLine++ // account for section delimiter
        slides.push(slide)
    }

    return slides
}

function lineToItemLine(lineText: string, chords?: SongbeamerChord[]): Line {
    const line: Line = {
        align: "",
        text: [{ style: "", value: lineText }]
    }
    if (chords?.length) {
        line.chords = chords.map(convertChord)
    }
    return line
}

function createMultilineTextbox(songbeamerSlide: SongbeamerSlide): Item {
    const textbox: Item = { style: DEFAULT_ITEM_STYLE, lines: [] }
    const lineCount = Math.max(0, ...songbeamerSlide.lines.map((l) => l.length))

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        for (const lines of songbeamerSlide.lines) {
            if (lineIndex < lines.length) {
                textbox.lines?.push(lineToItemLine(lines[lineIndex].text, lines[lineIndex].chords))
            } else {
                textbox.lines?.push({ align: "", text: [{ style: "", value: "" }] })
            }
        }
    }

    return textbox
}

function createSlides(
    songbeamerSlides: SongbeamerSlide[],
    metadata: SongbeamerMetadata
): { slides: Record<ID, Slide>; layout: SlideData[] } {
    const slides: Record<ID, Slide> = {}
    const layout: SlideData[] = []
    const groupSlides = new Map<string, SlideData>()

    let lastSlideId: string | null = null
    let lastGroup: string | null = null
    let lastGroupNumber: number | null = null

    for (const songbeamerSlide of songbeamerSlides) {
        const id: string = uid()
        const isChildSlide =
            songbeamerSlide.group !== null
                ? songbeamerSlide.group === lastGroup && songbeamerSlide.groupNumber === lastGroupNumber
                : lastGroup !== null

        const slide: Slide = {
            group: isChildSlide ? null : songbeamerSlide.group,
            color: null,
            settings: {},
            notes: "",
            items: [createMultilineTextbox(songbeamerSlide)]
        }

        if (!isChildSlide && songbeamerSlide.globalGroup !== null) {
            slide.globalGroup = getGlobalGroup(songbeamerSlide.globalGroup) || "verse"
        }
        slides[id] = slide

        const group = getGroupId(songbeamerSlide.group, songbeamerSlide.groupNumber)
        if (isChildSlide && lastSlideId && slides[lastSlideId]) {
            const lastSlide = slides[lastSlideId]
            if (!Array.isArray(lastSlide.children)) lastSlide.children = []
            lastSlide.children.push(id)

            const layoutParent = layout.find((s) => s.id === lastSlideId)
            if (layoutParent) {
                if (!layoutParent.children) layoutParent.children = {}
                layoutParent.children[id] = {}
            } else {
                const slideData: SlideData = { id }
                layout.push(slideData)
                if (group) groupSlides.set(group, slideData)
            }
        } else {
            const slideData: SlideData = { id }
            layout.push(slideData)
            if (group) groupSlides.set(group, slideData)
        }

        if (!isChildSlide && songbeamerSlide.group !== null) {
            lastSlideId = id
            lastGroup = songbeamerSlide.group
            lastGroupNumber = songbeamerSlide.groupNumber
        }
    }

    const finalLayout = createLayoutFromVerseOrder(metadata, groupSlides) || layout

    finalLayout.forEach(({ id }) => {
        if (slides[id] && !slides[id].group) {
            slides[id].group = ""
            slides[id].globalGroup = "verse"
        }
    })

    return { slides, layout: finalLayout }
}
