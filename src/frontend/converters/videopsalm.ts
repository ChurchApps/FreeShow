import { get } from "svelte/store"
import { uid } from "uid"
import { checkName } from "../components/helpers/show"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, dictionary, groups } from "./../stores"
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
    "Tempo",
]
export function convertVideopsalm(data: any) {
    let categoryId = createCategory("VideoPsalm")

    let tempShows: any[] = []

    data.forEach(({ content }: any) => {
        // add quotes to the invalid JSON formatting
        if (content.length) {
            content = content.replaceAll("{\n", "{").replaceAll("}\n", "}").replaceAll("\n", "<br>").replaceAll("FontStyle", "Font")
            content = content.split("Style:").map(removeStyle).join("Style:")
            content = content.split(":").map(fixJSON).join(":")
            content = content.replaceAll("\t", "").replaceAll("\v", "").replaceAll("\r", "").replaceAll("\f", "").replaceAll(',<br>"', ',"').replaceAll("﻿", "") // remove this invisible character

            content = parseContent(content)
            if (!content) return
        }

        if (!Object.keys(content).length) {
            activePopup.set(null)
            return
        }

        let i: number = 0
        let importingText = get(dictionary)?.popup.importing || "Importing"

        let album: string = content?.Text
        if (content.Songs?.length) asyncLoop()

        function asyncLoop() {
            let song: Song = content.Songs[i]
            let title = (song.Text || "").replaceAll("<br>", "")

            let percentage: string = ((i / content.Songs.length) * 100).toFixed()
            activePopup.set("alert")
            alertMessage.set(importingText + " " + i + "/" + content.Songs.length + " (" + percentage + "%)" + "<br>" + title)

            let layoutID = uid()
            let show = new ShowObj(false, categoryId, layoutID)
            let showId = song.Guid || uid()
            let name = title || get(dictionary).main?.unnamed || "Unnamed"
            show.name = checkName(name, showId) || ""
            show.meta = {
                number: song.ID || "",
                title: show.name,
                artist: album || "",
                author: song.Author || "",
                composer: song.Composer || "",
                copyright: song.Copyright || "",
                CCLI: song.CCLI || "",
            }

            let { slides, layout, notes }: any = createSlides(song)
            show.slides = slides
            show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: notes || "", slides: layout } }

            tempShows.push({ id: showId, show })

            if (i < content.Songs.length - 1) {
                i++
                requestAnimationFrame(asyncLoop)
            } else {
                setTempShows(tempShows)
            }
        }
    })
}

let previousIndex: number = -1
function parseContent(content: string): VideoPsalm | null {
    let newContent: VideoPsalm | null = null

    try {
        newContent = JSON.parse(content || "{}")
    } catch (e: any) {
        console.error(e)
        let pos = Number(e.toString().replace(/\D+/g, "") || 100)
        console.log(pos, content.slice(pos - 10, pos) + "[HERE>]" + content.slice(pos, pos + 10), content.slice(pos - 100, pos + 100))

        if (pos === previousIndex) return newContent

        // TRY to auto fix this (by adding "")
        let start = content.slice(0, pos)
        let wordEndIndex = content.indexOf(":", pos)
        let wordId = content.slice(pos, wordEndIndex)
        let end = content.slice(wordEndIndex)
        content = `${start}"${wordId}"${end}`

        previousIndex = pos
        newContent = parseContent(content)
    }

    return newContent
}

const removeKeys = ["Body", "Background", "Footer", "Header", "Version"]
function removeStyle(s) {
    if (!removeKeys.find((key) => s.includes(`{${key}:`))) return s

    let openCount = 0
    let closeCount = 0
    let index: number = -1
    do {
        index++
        if (s[index] === "{") openCount++
        else if (s[index] === "}") closeCount++
        if (index === s.length - 1) closeCount = openCount
    } while (index < 1 || openCount !== closeCount)

    s = "{" + s.substring(index)

    return s
}

function fixJSON(s: string) {
    let index = s.length - 1
    while (s[index]?.match(/[a-z0-9]/i) !== null && index > -1) index--
    let word: string = s.slice(index + 1, s.length)
    let notKey = index < 0 || index >= s.length - 1 || !keys.includes(word)
    if (word === "ID" && !notKey && !s.includes("{ID") && !s.includes(",ID")) notKey = true
    if (!notKey && keys.includes(word) && s.indexOf('"' + word) === 0 && s.indexOf(word, 3) < 0) {
        // ,{Author:"Author:",Copyright:"Copyright:",
        notKey = true
    }
    return notKey ? s : s.slice(0, index + 1) + '"' + word + '"'
}

const VPgroups: any = { V: "verse", S: "verse", C: "chorus", R: "chorus", P: "pre_chorus", B: "bridge", T: "tag", I: "intro", O: "outro", N: "break" }
function createSlides({ Verses, Sequence }: Song) {
    // VerseOrderIndex
    let slides: any = {}
    let layout: any[] = []
    let sequence: string[] = Sequence?.split(" ") || []
    let sequences: any = {}

    Verses.forEach((verse, i) => {
        if (!verse.Text) return

        let id: string = uid()
        let sequenceKey = sequence[i]
        if (sequenceKey) {
            // find next if already matching
            if (sequences[sequenceKey]) sequenceKey = sequence.find((key) => !sequences[key]) || ""
            if (sequenceKey) sequences[sequenceKey] = id
        }
        layout.push({ id })

        let lines: any[] = []
        verse.Text.split("<br>").forEach((text) => {
            let line: any = { align: "", text: [] }

            let chords: any[] = []
            let newText: string = ""
            text.split("]").forEach((t) => {
                let chordStart = t.indexOf("[")
                if (chordStart < 0) chordStart = t.length

                let text = t.slice(0, chordStart)
                newText += text

                let chord = t.slice(chordStart + 1)
                if (!chord) return
                // only: [Gm], not: [info] [x4]
                if (chord.length > 5 || chord.includes("x")) newText += `[${chord}]`
                else {
                    let id = uid(5)
                    chords.push({ id, pos: newText.length, key: chord })
                }
            })

            if (!newText.length) return

            if (chords.length) line.chords = chords

            // fix some text having special HTML tags
            newText = newText.replaceAll("<fNirmala UI>", "").replaceAll("</f>", "").trim()

            line.text = [{ style: "", value: newText }]
            lines.push(line)
        })

        let items = [{ style: "left:50px;top:120px;width:1820px;height:840px;", lines }]

        slides[id] = {
            group: "",
            color: null,
            settings: {},
            notes: "",
            items,
        }
        let globalGroup = sequenceKey ? VPgroups[sequenceKey.replace(/[0-9]/g, "")] : "verse"
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
