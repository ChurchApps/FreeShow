import { get } from "svelte/store"
import { uid } from "uid"
import { checkName } from "../components/helpers/show"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, dictionary, groups, shows } from "./../stores"
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
]
export function convertVideopsalm(data: any) {
    createCategory("VideoPsalm")

    let tempShows: any[] = []

    data.forEach(({ content }: any) => {
        // add quotes to the invalid JSON formatting
        if (content.length) {
            content = content.replaceAll("{\n", "{").replaceAll("\n", "<br>").replaceAll("FontStyle", "Font")
            content = content.split("Style:").map(removeStyle).join("Style:")
            content = content.split(":").map(fixJSON).join(":")
            content = content.replaceAll("\t", "").replaceAll("\v", "").replaceAll(',<br>"', ',"').replaceAll("﻿", "") // remove this invisible character

            try {
                content = JSON.parse(content || {}) as VideoPsalm
            } catch (e: any) {
                console.error(e)
                let pos = Number(e.toString().replace(/\D+/g, "") || 100)
                console.log(pos, content.slice(pos - 5, pos + 5), content.slice(pos - 100, pos + 100))
            }
        }

        let i: number = 0
        let importingText = get(dictionary)?.popup.importing || "Importing"

        let album: string = content?.Text
        if (content.Songs?.length) asyncLoop()

        function asyncLoop() {
            let song: Song = content.Songs[i]

            let percentage: string = ((i / content.Songs.length) * 100).toFixed()
            activePopup.set("alert")
            alertMessage.set(importingText + " " + i + "/" + content.Songs.length + " (" + percentage + "%)" + "<br>" + (song.Text || ""))

            if (get(shows)[song.Guid] && i < content.Songs.length - 1) {
                i++
                requestAnimationFrame(asyncLoop)
                return
            }

            let layoutID = uid()
            let show = new ShowObj(false, "videopsalm", layoutID)
            show.name = checkName(song.Text) || ""
            show.meta = {
                title: show.name,
                artist: album || "",
                author: song.Author || "",
                composer: song.Composer || "",
                copyright: song.Copyright || "",
                CCLI: song.CCLI || "",
            }

            let { slides, layout }: any = createSlides(song)
            show.slides = slides
            show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layout } }

            tempShows.push({ id: song.Guid || uid(), show })

            if (i < content.Songs.length - 1) {
                i++
                requestAnimationFrame(asyncLoop)
            } else {
                setTempShows(tempShows)
            }
        }
    })
}

function removeStyle(s) {
    if (s.includes("{Body:") || s.includes("{Background:") || s.includes("{Footer:") || s.includes("{Header:")) {
        let openCount = 0
        let closeCount = 0
        let index: number = -1
        do {
            index++
            if (s[index] === "{") openCount++
            else if (s[index] === "}") closeCount++
            if (index === s.length - 1) closeCount = openCount
        } while (openCount !== closeCount)

        s = "{" + s.substring(index)
    }
    return s
}

function fixJSON(s: string) {
    let index = s.length - 1
    while (s[index]?.match(/[a-z0-9]/i) !== null && index > -1) index--
    let word: string = s.slice(index + 1, s.length)
    let notKey = index < 0 || index >= s.length - 1 || !keys.includes(word)
    if (word === "ID" && !notKey && !s.includes("{ID") && !s.includes(",ID")) notKey = true
    if (!notKey && keys.includes(word) && s.indexOf('"' + word) === 0) {
        // ,{Author:"Author:",Copyright:"Copyright:",
        notKey = true
    }
    return notKey ? s : s.slice(0, index + 1) + '"' + word + '"'
}

const VPgroups: any = { V: "verse", C: "chorus", B: "bridge", T: "tag", O: "outro" }
function createSlides({ Verses, Sequence, VerseOrderIndex }: Song) {
    console.log(VerseOrderIndex)

    let slides: any = {}
    let layout: any[] = []
    let sequence: string[] = Sequence?.split(" ") || []
    let sequences: any = {}
    Verses.forEach((verse, i) => {
        if (verse.Text) {
            let id: string = uid()
            if (sequence[i]) sequences[sequence[i]] = id
            layout.push({ id })
            let items = [
                {
                    style: "left:50px;top:120px;width:1820px;height:840px;",
                    lines: verse.Text.split("<br>").map((a: any) => ({ align: "", text: [{ style: "", value: a }] })),
                },
            ]
            // TODO: chords \[.*?\]
            slides[id] = {
                group: "",
                color: null,
                settings: {},
                notes: "",
                items,
            }
            let globalGroup = sequence[i] ? VPgroups[sequence[i].replace(/[0-9]/g, "")] : "verse"
            if (get(groups)[globalGroup]) slides[id].globalGroup = globalGroup
        }
    })
    if (sequence.length) {
        layout = []
        sequence.forEach((group) => {
            if (sequences[group]) layout.push({ id: sequences[group] })
        })
    }

    return { slides, layout }
}
