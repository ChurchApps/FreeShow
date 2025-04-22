import { get } from "svelte/store"
import { uid } from "uid"
import type { Chords, ID, Item, Layout, Line, Show, Slide, SlideData } from "../../types/Show"
import { TranslationMethod } from "../../types/Songbeamer"
import { ShowObj } from "../classes/Show"
import { history } from "../components/helpers/history"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { categories, globalTags } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"

interface ImportSettings {
    category: string
    encoding: BufferEncoding
    translationMethod: TranslationMethod
}

interface SongbeamerChord {
    x: number
    line: number
    key: string
}
class SongbeamerMetadata {
    lang_count: number = 1
    title: string = ""
    author: string = ""
    copyright: string = ""
    composer: string = ""
    publisher: string = ""
    comments: string = "" // notes
    keywords: string = "" // tags
    format: string = ""
    title_format: string = ""
    background_image: string = ""
    number: string = ""
    ccli: string = ""
    tempo: number = 0
    key: string = ""
    chords: SongbeamerChord[][] = []
    verse_order: { group: string; groupNumber: number | null }[] = []
}

interface SongbeamerLine {
    text: string
    chords: SongbeamerChord[]
}
class SongbeamerSlide {
    group: string | null = null
    globalGroup: string | null = null
    groupNumber: number | null = null
    lines: SongbeamerLine[][] = []
}
function getGroupId(group: string | null, groupNumber: number | null): string | null {
    if (!group) {
        return null
    }
    if (groupNumber !== null) {
        return group + groupNumber
    }
    return group
}

//Songbeamer files include a byte order mark
const BOM8 = String.fromCodePoint(0xef, 0xbb, 0xbf) //UTF-8
const BOM16 = String.fromCodePoint(0xfeff) //UTF-16
export function convertSongbeamerFiles({ files = [], category = "Songbeamer", translationMethod = TranslationMethod.MultiLine, encoding = "utf8" }: any) {
    let settings: ImportSettings = {
        category,
        encoding,
        translationMethod,
    }

    let tempShows: { id: string; show: Show }[] = []
    files.forEach(({ name, content }) => {
        if (content.substring(0, 3) === BOM8) {
            content = content.substring(3)
        }
        if (content.charAt(0) === BOM16) {
            content = content.substring(1)
        }
        let show = convertSongbeamerFileToShow(name, content, settings)
        tempShows.push({
            id: uid(),
            show: show,
        })
    })
    setTempShows(tempShows)
}

function convertSongbeamerFileToShow(name: string, text: string, settings: ImportSettings) {
    let categoryId: string | null = null
    if (get(categories)[settings.category]) {
        categoryId = settings.category
    } else if (settings.category === "songbeamer") {
        categoryId = createCategory("Songbeamer")
    }

    let layoutId = uid()
    let show = new ShowObj(false, categoryId, layoutId)

    text = text.replaceAll("\r", "").replaceAll(/\n\s+\n/g, "\n\n")
    let sections: string[] = text.split(/(?:^|\n)--(?:-|A)?\s*\n/)

    let metadata = parseMetadata(sections[0], settings.encoding)
    if (!metadata.title) {
        metadata.title = name
    }
    sections.shift()

    show.name = checkName(metadata.title)
    show.meta = {
        number: metadata.number,
        title: metadata.title,
        author: metadata.author,
        composer: metadata.composer,
        publisher: metadata.publisher,
        copyright: metadata.copyright,
        CCLI: metadata.ccli,
    }
    if (show.meta.number !== undefined) show.quickAccess = { number: show.meta.number }
    if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

    // add tags
    const tags = getTags(metadata.keywords.split(","))
    if (tags.length) {
        if (!show.quickAccess) show.quickAccess = {}
        show.quickAccess.tags = tags
    }

    let songbeamerSlides = parseSongbeamerSlides(sections, metadata)
    let { slides, layouts } = createSlides(songbeamerSlides, metadata, settings)

    show.slides = slides
    show.layouts[layoutId].notes = metadata.comments
    if (layouts.length) {
        show.layouts[layoutId].name = layouts[0].name
        show.layouts[layoutId].slides = layouts[0].slides
    }
    for (let i = 1; i < layouts.length; ++i) {
        let layout = layouts[i]
        if (layout.id) {
            show.layouts[layout.id] = layout
        }
    }

    return show as Show
}

function getTags(tags: string[]) {
    return tags.map((tag) => getOrCreateTag(tag.trim()))
}
function getOrCreateTag(name: string) {
    // get existing with same name
    const existing = Object.entries(get(globalTags)).find(([_id, tag]) => tag.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing[0]

    const tagId = uid(5)
    history({ id: "UPDATE", newData: { data: { name } }, oldData: { id: tagId }, location: { page: "show", id: "tag" } })
    return tagId
}

function base64Utf8Decode(text: string, encoding: BufferEncoding = "utf8"): string {
    text = atob(text)
    let bytes = new Uint8Array(text.length & 1 ? text.length + 1 : text.length)
    for (let i = 0; i < bytes.length; ++i) {
        bytes[i] = text.charCodeAt(i)
    }
    let decoder = new TextDecoder(encoding)
    return decoder.decode(bytes)
}
function parseMetadata(text: string, encoding: BufferEncoding = "utf8"): SongbeamerMetadata {
    let metadata = new SongbeamerMetadata()

    text.split("\n").forEach((line: string) => {
        if (!line || line[0] !== "#") {
            return
        }
        let parts = line.substring(1).split("=", 2)
        if (parts.length !== 2) {
            return
        }

        switch (parts[0]) {
            case "LangCount":
                let langCount = parseInt(parts[1])
                if (!isNaN(langCount) && langCount > 0) {
                    metadata.lang_count = langCount
                }
                break
            case "Title":
                metadata.title = parts[1].trim()
                break
            case "Author":
                metadata.author = parts[1].trim()
                break
            // case "AddCopyrightInfo":
            case "(c)":
                metadata.copyright = parts[1].trim()
                break
            case "Melody":
                metadata.composer = parts[1].trim()
                break
            case "NatCopyright":
                metadata.publisher = parts[1].trim()
                break
            case "Comments":
                metadata.comments = base64Utf8Decode(parts[1].trim(), encoding)
                break
            case "Keywords":
                metadata.keywords = parts[1].trim() || ""
                break
            case "Format":
                metadata.format = parts[1].trim()
                break
            case "TitleFormat":
                metadata.title_format = parts[1].trim()
                break
            case "BackgroundImage":
                metadata.background_image = parts[1].trim()
                break
            case "ChurchSongID":
                metadata.number = parts[1].trim() || ""
                break
            case "Key":
                metadata.key = parts[1].trim()
                break
            case "Tempo":
                let tempo = parseInt(parts[1])
                if (!isNaN(tempo) && tempo > 0) {
                    metadata.tempo = tempo
                }
                break
            case "Chords":
                let chords: string = base64Utf8Decode(parts[1].trim(), encoding)
                for (const chord of chords.split("\r")) {
                    let chordParts = chord.split(",")
                    let line = parseInt(chordParts[1])
                    if (!Array.isArray(metadata.chords[line])) {
                        metadata.chords[line] = []
                    }
                    metadata.chords[line].push({
                        x: parseFloat(chordParts[0]),
                        line: line,
                        key: chordParts[2],
                    })
                }
                break
            case "CCLI":
                let ccli = parts[1].trim()
                let index = 0
                for (const char of ccli) {
                    if (char < "0" || char > "9") {
                        break
                    }
                    ++index
                }
                metadata.ccli = ccli.substring(0, index)
                break
            case "VerseOrder":
                let slideTags = parts[1].trim().split(",")
                for (const tag of slideTags) {
                    let group: string | null, groupNumber: number | null
                    ;({ group, groupNumber } = slideTagToGroup(tag))
                    if (group !== null) {
                        metadata.verse_order.push({ group, groupNumber })
                    }
                }
                break
        }
    })
    return metadata
}

function convertChord(chord: SongbeamerChord): Chords {
    let pos = Math.ceil(chord.x)
    let key = chord.key.replaceAll("<", "♭").replaceAll("=", "")
    return {
        id: uid(5),
        pos,
        key,
    }
}

const SongbeamerGroups: { [key: string]: string } = {
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
    solo: "Tag",
}
const SongbeamerGlobalGroups: { [key: string]: string } = {
    Intro: "intro",
    Verse: "verse",
    "Pre-Bridge": "pre_bridge",
    Bridge: "bridge",
    "Pre-Chorus": "pre_chorus",
    Chorus: "chorus",
    Break: "break",
    "Pre-Outro": "pre_outro",
    Outro: "outro",
    Tag: "tag",
}
function slideTagToGroup(line: string): { group: string | null; globalGroup: string | null; groupNumber: number | null } {
    if (line.charAt(0) === "#") {
        return { group: null, globalGroup: null, groupNumber: null }
    }
    let parts: string[] = line.split(" ", 2)
    let tag: string = parts[0].toLowerCase()
    let groupNumber: number | null = null
    if (parts.length > 1) {
        groupNumber = parseInt(parts[1])
        if (isNaN(groupNumber) || groupNumber < 1) {
            groupNumber = null
        }
    }

    let group: string | null = null
    let globalGroup: string | null = null
    if (tag in SongbeamerGroups) {
        group = SongbeamerGroups[tag]
        if (group in SongbeamerGlobalGroups) {
            globalGroup = SongbeamerGlobalGroups[group]
        }
    }
    return { group, globalGroup, groupNumber }
}

function createLayoutFromVerseOrder(metadata: SongbeamerMetadata, groupSlides: Map<string, SlideData>): SlideData[] | null {
    if (!metadata.verse_order.length || !groupSlides.size) {
        return null
    }
    let layout: SlideData[] = []
    for (let { group, groupNumber } of metadata.verse_order) {
        let groupId = getGroupId(group, groupNumber)
        if (!groupId) {
            continue
        }
        let slide = groupSlides.get(groupId)
        if (slide) {
            layout.push(slide)
        }
    }
    return layout
}

function getSlideIndexFromLayout(layout: SlideData[], slideId: string): number | null {
    for (let i = 0; i < layout.length; ++i) {
        if (layout[i].id === slideId) {
            return i
        }
    }
    return null
}
function parseSongbeamerSlides(sections: string[], metadata: SongbeamerMetadata): SongbeamerSlide[] {
    let slides: SongbeamerSlide[] = []

    let markerRegex = /^#([a-zA-Z]+)\s+/
    let languageRegex = /^#(#)?(\d)?\s+/
    let chordLine: number = 0
    for (const section of sections) {
        let slide = new SongbeamerSlide()
        for (let i = 0; i < metadata.lang_count; ++i) {
            slide.lines.push([])
        }

        let lines: string[] = section.split("\n")

        //check first line for group tags
        let firstLine: string = lines[0]
        if (firstLine.substring(0, 4) === "$$M=") {
            lines.shift()
            ++chordLine
        } else {
            let { group, globalGroup, groupNumber } = slideTagToGroup(firstLine)
            if (group !== null) {
                lines.shift()
                ++chordLine
                slide.group = group
                slide.globalGroup = globalGroup
                slide.groupNumber = groupNumber
            }
        }

        let language: number = 0
        let lastLineLanguage: number = -1
        for (let lineText of lines) {
            let songbeamerChords: SongbeamerChord[] = metadata.chords[chordLine] || []
            ++chordLine
            if (language >= metadata.lang_count) {
                language = 0
            }

            let currentLineLanguage = language
            let line: SongbeamerLine = {
                text: "",
                chords: songbeamerChords,
            }

            //parse markers beginning with # at the start of a line (e.g. #C)
            let marker = markerRegex.exec(lineText)
            if (marker !== null) {
                //ignore lines that are commented out
                if (marker[1] === "H") {
                    ++language
                    continue
                }
                lineText = lineText.substring(marker[0].length)
            }

            //handle language overwrites for lines (e.g. #1 or ##2)
            let langOverwrite = languageRegex.exec(lineText)
            if (langOverwrite === null) {
                line.text = lineText
                //empty lines aren´t counted in Songbeamer
                if (lineText) {
                    ++language
                }
            } else {
                line.text = lineText.substring(langOverwrite[0].length)
                let langNumber = parseInt(langOverwrite[2])
                if (!langOverwrite[1]) {
                    ++language
                }
                if (!isNaN(langNumber)) {
                    if (langNumber < 1 || langNumber > metadata.lang_count) {
                        continue
                    }
                    currentLineLanguage = langNumber - 1
                }
            }

            line.text = line.text.trim()
            if (metadata.lang_count > 1 && currentLineLanguage === lastLineLanguage) {
                //add to previous line if its the same language so that it gets the same styling from the template
                slide.lines[currentLineLanguage][slide.lines[currentLineLanguage].length - 1].text += "\n" + line.text
            } else {
                slide.lines[currentLineLanguage].push(line)
            }
            lastLineLanguage = currentLineLanguage
        }

        //add a line for the already removed slide delimiter
        ++chordLine
        slides.push(slide)
    }

    return slides
}

function createMultilineTextbox(songbeamerSlide: SongbeamerSlide): Item {
    let textbox: Item = {
        style: "top:50px;inset-inline-start:50px;height:980px;width:1820px;",
        lines: [],
    }
    let lineCount = 0
    songbeamerSlide.lines.map((lines) => {
        if (lines.length > lineCount) {
            lineCount = lines.length
        }
    })
    for (let lineIndex = 0; lineIndex < lineCount; ++lineIndex) {
        songbeamerSlide.lines.map((lines) => {
            let line: Line = {
                align: "",
                text: [
                    {
                        style: "",
                        value: "",
                    },
                ],
            }
            if (lineIndex < lines.length) {
                line.text[0].value = lines[lineIndex].text

                let songbeamerChords = lines[lineIndex].chords
                if (songbeamerChords) {
                    let chords: Chords[] = []
                    for (const chord of songbeamerChords) {
                        chords.push(convertChord(chord))
                    }
                    if (chords.length) {
                        line.chords = chords
                    }
                }
            }
            textbox.lines?.push(line)
        })
    }

    return textbox
}
function createTextboxForLanguage(songbeamerSlide: SongbeamerSlide, language: number): Item {
    let textbox: Item = {
        style: "top:50px;inset-inline-start:50px;height:980px;width:1820px;",
    }
    if (language < 0 || language >= songbeamerSlide.lines.length) {
        return textbox
    }

    textbox.lines = songbeamerSlide.lines[language].map(({ text: lineText, chords: songbeamerChords }): Line => {
        let line: Line = {
            align: "",
            text: [
                {
                    style: "",
                    value: lineText,
                },
            ],
        }
        if (songbeamerChords) {
            let chords: Chords[] = []
            for (const chord of songbeamerChords) {
                chords.push(convertChord(chord))
            }
            if (chords.length) {
                line.chords = chords
            }
        }
        return line
    })

    return textbox
}

function createSlidesMultipleLanguagesPerSlide(songbeamerSlides: SongbeamerSlide[], metadata: SongbeamerMetadata, translationMethod: TranslationMethod): { slides: { [key: ID]: Slide }; layout: SlideData[]; groupSlides: Map<string, SlideData> } {
    let slides: { [key: ID]: Slide } = {}
    let layout: SlideData[] = []
    let groupSlides: Map<string, SlideData> = new Map()

    let lastSlideId: string | null = null
    let lastGroup: string | null = null
    let lastGroupNumber: number | null = null
    for (const songbeamerSlide of songbeamerSlides) {
        let id: string = uid()

        let isChildSlide = false
        if (songbeamerSlide.group !== null) {
            isChildSlide = songbeamerSlide.group === lastGroup && songbeamerSlide.groupNumber === lastGroupNumber
        } else {
            isChildSlide = lastGroup !== null
        }

        let slide: Slide = {
            group: isChildSlide ? null : songbeamerSlide.group,
            color: null,
            settings: {},
            notes: "",
            items: [],
        }
        switch (translationMethod) {
            case TranslationMethod.MultiLine:
                slide.items.push(createMultilineTextbox(songbeamerSlide))
                break

            case TranslationMethod.Textboxes:
                for (let language = 0; language < metadata.lang_count; ++language) {
                    slide.items.push(createTextboxForLanguage(songbeamerSlide, language))
                }
                break
        }

        if (!isChildSlide && songbeamerSlide.globalGroup !== null) {
            let globalGroup = getGlobalGroup(songbeamerSlide.globalGroup) || "verse"
            if (globalGroup) slide.globalGroup = globalGroup
        }
        slides[id] = slide

        //set as child of other slide if they belong together
        let group: string | null = getGroupId(songbeamerSlide.group, songbeamerSlide.groupNumber)
        if (isChildSlide && lastSlideId !== null && lastSlideId in slides) {
            let lastSlide = slides[lastSlideId]
            if (!Array.isArray(lastSlide.children)) {
                lastSlide.children = []
            }
            lastSlide.children.push(id)

            let layoutParentSlideIndex = getSlideIndexFromLayout(layout, lastSlideId)
            if (layoutParentSlideIndex !== null) {
                if (!layout[layoutParentSlideIndex].hasOwnProperty("children")) layout[layoutParentSlideIndex].children = {}
                layout[layoutParentSlideIndex].children![id] = {}
            } else {
                let slideData: SlideData = { id }
                layout.push(slideData)
                if (group) {
                    groupSlides.set(group, slideData)
                }
            }
        } else {
            let slideData: SlideData = { id }
            layout.push(slideData)
            if (group) {
                groupSlides.set(group, slideData)
            }
        }
        if (!isChildSlide && songbeamerSlide.group !== null) {
            lastSlideId = id
            lastGroup = songbeamerSlide.group
            lastGroupNumber = songbeamerSlide.groupNumber
        }
    }

    return { slides, layout, groupSlides }
}

function createSlidesForLanguage(songbeamerSlides: SongbeamerSlide[], language: number, metadata: SongbeamerMetadata): { slides: { [key: ID]: Slide }; layout: SlideData[]; groupSlides: Map<string, SlideData> } {
    let slides: { [key: ID]: Slide } = {}
    let layout: SlideData[] = []
    let groupSlides: Map<string, SlideData> = new Map()
    if (language < 0 || language >= metadata.lang_count) {
        return { slides, layout, groupSlides }
    }

    let lastSlideId: string | null = null
    let lastGroup: string | null = null
    let lastGroupNumber: number | null = null
    for (const songbeamerSlide of songbeamerSlides) {
        let id: string = uid()

        let isChildSlide = false
        if (songbeamerSlide.group !== null) {
            isChildSlide = songbeamerSlide.group === lastGroup && songbeamerSlide.groupNumber === lastGroupNumber
        } else {
            isChildSlide = lastGroup !== null
        }

        let lineObjects: Line[] = songbeamerSlide.lines[language].map(({ text: lineText, chords: songbeamerChords }): Line => {
            let line: Line = {
                align: "",
                text: [
                    {
                        style: "",
                        value: lineText,
                    },
                ],
            }
            if (songbeamerChords) {
                let chords: Chords[] = []
                for (let chord of songbeamerChords) {
                    chords.push(convertChord(chord))
                }
                if (chords.length) {
                    line.chords = chords
                }
            }
            return line
        })

        let slide: Slide = {
            group: isChildSlide ? null : songbeamerSlide.group,
            color: null,
            settings: {},
            notes: "",
            items: [
                {
                    style: "top:50px;inset-inline-start:50px;height:980px;width:1820px;",
                    lines: lineObjects,
                },
            ],
        }

        if (!isChildSlide && songbeamerSlide.globalGroup !== null) {
            let globalGroup = getGlobalGroup(songbeamerSlide.globalGroup) || "verse"
            if (globalGroup) slide.globalGroup = globalGroup
        }
        slides[id] = slide

        //set as child of other slide if they belong together
        let group: string | null = getGroupId(songbeamerSlide.group, songbeamerSlide.groupNumber)
        if (isChildSlide && lastSlideId !== null && lastSlideId in slides) {
            let lastSlide = slides[lastSlideId]
            if (!Array.isArray(lastSlide.children)) {
                lastSlide.children = []
            }
            lastSlide.children.push(id)

            let layoutParentSlideIndex = getSlideIndexFromLayout(layout, lastSlideId)
            if (layoutParentSlideIndex !== null) {
                if (!layout[layoutParentSlideIndex].hasOwnProperty("children")) layout[layoutParentSlideIndex].children = {}
                layout[layoutParentSlideIndex].children![id] = {}
            } else {
                let slideData: SlideData = { id }
                layout.push(slideData)
                if (group) {
                    groupSlides.set(group, slideData)
                }
            }
        } else {
            let slideData: SlideData = { id }
            layout.push(slideData)
            if (group) {
                groupSlides.set(group, slideData)
            }
        }
        if (!isChildSlide && songbeamerSlide.group !== null) {
            lastSlideId = id
            lastGroup = songbeamerSlide.group
            lastGroupNumber = songbeamerSlide.groupNumber
        }
    }

    return { slides, layout, groupSlides }
}

function createSlides(songbeamerSlides: SongbeamerSlide[], metadata: SongbeamerMetadata, settings: ImportSettings): { slides: { [key: ID]: Slide }; layouts: Layout[] } {
    let slides: { [key: ID]: Slide } = {}
    let layouts: Layout[] = []

    console.log(songbeamerSlides)

    switch (settings.translationMethod) {
        case TranslationMethod.MultiLine:
        case TranslationMethod.Textboxes:
            let slidesMultiLang = createSlidesMultipleLanguagesPerSlide(songbeamerSlides, metadata, settings.translationMethod)
            slides = slidesMultiLang.slides
            layouts.push({
                name: "",
                notes: "",
                slides: createLayoutFromVerseOrder(metadata, slidesMultiLang.groupSlides) || slidesMultiLang.layout,
            })
            break

        case TranslationMethod.Layouts:
            for (let language = 0; language < metadata.lang_count; ++language) {
                let { slides: languageSlides, layout: languageLayout, groupSlides } = createSlidesForLanguage(songbeamerSlides, language, metadata)
                slides = { ...slides, ...languageSlides }
                layouts.push({
                    id: uid(),
                    name: `Language ${language + 1}`,
                    notes: "",
                    slides: createLayoutFromVerseOrder(metadata, groupSlides) || languageLayout,
                })
            }
            break
    }

    // add layout slide groups
    layouts[0]?.slides?.forEach(({ id }) => {
        if (slides[id] && !slides[id].group) {
            slides[id].group = ""
            slides[id].globalGroup = "verse"
        }
    })

    return { slides, layouts }
}
