import { get } from "svelte/store"
import { uid } from "uid"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
import { checkName } from "../components/helpers/show"
import { translateText } from "../utils/language"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, groups } from "./../stores"
import { createCategory, setTempShows } from "./importHelpers"

interface VideoPsalm {
    Guid: string
    Text: string
    Songs: Song[]
}
interface Song {
    Guid: string
    IsCompressed: number
    IsSearchable: number
    VersionDate?: string
    Text: string
    ID?: number
    Reference?: string
    Verses: {
        Tag: number
        ID: number
        Text: string
    }[]
    Style: {
        Body: any
        Background: any
        Footer?: any
        Header?: any
    }
    Sequence: string
    VideoDuration: number
    VerseOrderIndex: number
    Composer: string
    Author: string
    Copyright: string
    CCLI: string
    Theme: string
    AudioFile: string
    Memo1: string
    Memo2: string
    Memo3: string
}

const keys = [
    "Abbreviation",
    "IsCompressed",
    "IsSearchable",
    "Guid",
    "Songs",
    "Text",
    "Verses",
    "Style",
    // "Version",
    // "Body",
    // "Background",
    // "Footer",
    // "Header",
    "Tag",
    "ID",
    "Key",
    "Alias",
    "Color",
    "Reference",
    "Sequence",
    "VersionDate",
    "VideoDuration",
    "VerseOrderIndex",
    "Composer",
    "Author",
    "Copyright",
    "CCLI",
    "Theme",
    "AudioFile",
    "Memo1",
    "Memo2",
    "Memo3",
    "Capo",
    "PrintCapo",
    "IsDisplayed",
    "KeyLine",
    "Note",

    "Description",
    "Publisher",
    "TimeSignature",
    "Culture",
    "Tonality",
    "Language",
    "IsAudioFileEnabled",
    "Tempo"
]
export function convertVideopsalm(data: any) {
    const categoryId = createCategory("VideoPsalm")

    const tempShows: any[] = []

    data.forEach(({ content }: any) => {
        // add quotes to the invalid JSON formatting
        if (content.length) {
            content = content.replaceAll("{\n", "{").replaceAll("}\n", "}").replaceAll("\n", "<br>").replaceAll("FontStyle", "Font")
            content = content.split("Style:").map(removeStyle).join("Style:")
            content = content.split("Text:").map(fixText).join("Text:")
            content = content.split(":").map(fixJSON).join(":")
            content = content.replaceAll("[[==]]", "") // get back keywords inside text
            content = content.replaceAll("\t", "").replaceAll("\v", "").replaceAll("\r", "").replaceAll("\f", "").replaceAll(',<br>"', ',"').replaceAll("﻿", "") // remove this invisible character

            content = parseContent(content)
            if (!content) return
        }

        if (!Object.keys(content).length) {
            activePopup.set(null)
            return
        }

        let i = 0
        const importingText = translateText("popup.importing")

        const album: string = content?.Text
        const songsCount: number = content.Songs?.length || 0
        if (songsCount) asyncLoop()

        function asyncLoop() {
            const song: Song = content.Songs[i]
            const title = (song.Text || "").replaceAll("<br>", "")

            const percentage: string = ((i / songsCount) * 100).toFixed()
            activePopup.set("alert")
            alertMessage.set(importingText + " " + String(i) + "/" + String(songsCount) + " (" + percentage + "%)" + "<br>" + title)

            const layoutID = uid()
            let show = new ShowObj(false, categoryId, layoutID)
            show.origin = "videopsalm"
            const showId = song.Guid || uid()
            const name = title || translateText("main.unnamed")
            show.name = checkName(name, showId) || ""
            show.meta = {
                number: (song.ID || "").toString(),
                title: show.name,
                artist: album || "",
                author: song.Author || "",
                composer: song.Composer || "",
                copyright: song.Copyright || "",
                CCLI: song.CCLI || ""
            }
            if (show.meta.number !== undefined) show.quickAccess = { number: show.meta.number }
            if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

            const { slides, layout, notes }: any = createSlides(song)
            show.slides = slides
            show.layouts = { [layoutID]: { name: translateText("example.default"), notes: notes || "", slides: layout } }

            tempShows.push({ id: showId, show })

            if (i < songsCount - 1) {
                i++
                requestAnimationFrame(asyncLoop)
            } else {
                setTempShows(tempShows)
            }
        }
    })
}

let previousIndex = -1
function parseContent(content: string): VideoPsalm | null {
    let newContent: VideoPsalm | null = null

    try {
        newContent = JSON.parse(content || "{}")
    } catch (e: any) {
        console.error(e)
        const posError = e.toString().replace(/ *\([^)]*\) */g, "")
        const pos = Number(posError.replace(/\D+/g, "") || 100)
        console.info(pos, content.slice(pos - 10, pos) + "[HERE>]" + content.slice(pos, pos + 10), content.slice(pos - 100, pos + 100))

        if (pos === previousIndex) return newContent

        // TRY to auto fix this (by adding "")
        const start = content.slice(0, pos)
        const wordEndIndex = content.indexOf(":", pos)
        const wordId = content.slice(pos, wordEndIndex)
        const end = content.slice(wordEndIndex)
        content = `${start}"${wordId}"${end}`

        previousIndex = pos
        newContent = parseContent(content)
    }

    return newContent
}

const removeKeys = ["Body", "Background", "Footer", "Header", "Version"]
function removeStyle(s: string) {
    if (!removeKeys.find((key) => s.includes(`{${key}:`))) return s

    let openCount = 0
    let closeCount = 0
    let index = -1
    do {
        index++
        if (s[index] === "{") openCount++
        else if (s[index] === "}") closeCount++
        if (index === s.length - 1) closeCount = openCount
    } while (index < 1 || openCount !== closeCount)

    s = "{" + s.substring(index)

    return s
}

function fixText(s: string, i: number) {
    if (i === 0) return s
    const openingIndex = s.indexOf('"') + 1
    const closingIndex = s.indexOf('"', openingIndex)
    if (openingIndex < 0 || closingIndex < 0) return s

    let textContent = s.slice(openingIndex, closingIndex)
    let keyword: string | undefined = ""
    while ((keyword = keys.find((a) => textContent.includes(a)))) {
        const index = textContent.indexOf(keyword)
        // obfusticate keyword
        keyword = keyword.slice(0, 1) + "[[==]]" + keyword.slice(1)
        textContent = textContent.slice(0, index) + textContent.slice(index + keyword.length)
    }

    s = s.slice(0, openingIndex) + textContent + s.slice(closingIndex)
    return s
}

function fixJSON(s: string) {
    let index = s.length - 1
    while (s[index]?.match(/[a-z0-9]/i) !== null && index > -1) index--
    const word: string = s.slice(index + 1, s.length)
    let notKey = index < 0 || index >= s.length - 1 || !keys.includes(word)
    if (word === "ID" && !notKey && !s.includes("{ID") && !s.includes(",ID")) notKey = true

    // if content includes keyword
    if (!notKey && keys.includes(word) && s.indexOf('"' + word) === 0 && s.indexOf(word, 3) < 0) {
        // ,{Author:"Author:",Copyright:"Copyright:",
        notKey = true
    }
    // if (!notKey && word !== "ID" && s.indexOf('"') > 1) notKey = true

    return notKey ? s : s.slice(0, index + 1) + '"' + word + '"'
}

const VPgroups: any = { V: "verse", S: "verse", C: "chorus", R: "chorus", P: "pre_chorus", B: "bridge", T: "tag", I: "intro", O: "outro", N: "break" }
function createSlides({ Verses, Sequence }: Song) {
    // VerseOrderIndex
    const slides: any = {}
    let layout: any[] = []
    const sequence: string[] = Sequence?.split(" ") || []
    const sequences: any = {}

    Verses.forEach((verse, i) => {
        if (!verse.Text) return

        const id: string = uid()
        let sequenceKey = sequence[i]
        if (sequenceKey) {
            // find next if already matching
            if (sequences[sequenceKey]) sequenceKey = sequence.find((key) => !sequences[key]) || ""
            if (sequenceKey) sequences[sequenceKey] = id
        }
        layout.push({ id })

        const lines: any[] = []
        verse.Text.split("<br>").forEach((text) => {
            const line: any = { align: "", text: [] }

            const chords: any[] = []
            let newText = ""
            text.split("]").forEach((t) => {
                let chordStart = t.indexOf("[")
                if (chordStart < 0) chordStart = t.length

                const chordText = t.slice(0, chordStart)
                newText += chordText

                const chord = t.slice(chordStart + 1)
                if (!chord) return
                // only: [Gm], not: [info] [x4]
                if (chord.length > 5 || chord.includes("x")) newText += `[${chord}]`
                else {
                    const chordId = uid(5)
                    chords.push({ id: chordId, pos: newText.length, key: chord })
                }
            })

            if (!newText.length) return

            if (chords.length) line.chords = chords

            // fix some text having special HTML tags
            newText = newText.replaceAll("<fNirmala UI>", "").replaceAll("</f>", "").trim()

            line.text = [{ style: "", value: newText }]
            lines.push(line)
        })

        const items = [{ style: DEFAULT_ITEM_STYLE, lines }]

        slides[id] = {
            group: "",
            color: null,
            settings: {},
            notes: "",
            items
        }
        const globalGroup = sequenceKey ? VPgroups[sequenceKey.replace(/[0-9]/g, "")] : "verse"
        if (get(groups)[globalGroup]) slides[id].globalGroup = globalGroup
    })

    let notes = ""
    if (sequence.length >= layout.length) {
        layout = []
        sequence.forEach((group) => {
            if (sequences[group]) layout.push({ id: sequences[group] })
        })
    } else if (sequence.length > 1) notes = sequence.join(", ")

    return { slides, layout, notes }
}
