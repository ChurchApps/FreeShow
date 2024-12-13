import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Line } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { isChordLine, parseChordLine } from "../components/edit/scripts/chords"
import { clone } from "../components/helpers/array"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { xml2json } from "./xml"
import { setQuickAccessMetadata } from "../components/helpers/setShow"

type Song = {
    title: string

    author?: string
    capo?: string
    ccli?: string
    copyright?: string
    key?: string
    publisher?: string
    translation?: any
    translationoptions?: any
    updateInDB?: "true" | "false"
    year?: string
    notes?: string

    lyrics: Lyrics
    sequence?: string
}

type Lyrics = {
    section: {
        "@capitalise": "true" | "false"
        "@title": string
        lyrics: string
        smalllines: string
        theme: string
    }[]
}

export function convertQuelea(data: any) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    let categoryId = createCategory("Quelea")

    let tempShows: any[] = []

    // set timeout to allow popup to open
    setTimeout(() => {
        data?.forEach(({ content }: any) => {
            convertSong(xml2json(content).song)
        })

        setTempShows(tempShows)
    }, 50)

    function convertSong(song: Song) {
        let layoutID = uid()
        let show = new ShowObj(false, categoryId, layoutID)
        show.name = checkName(song.title)

        let { slides, layout }: any = createSlides(song)

        show.meta = {
            title: song.title || "",
            CCLI: song.ccli || "",
            copyright: song.copyright || "",
            author: song.author || "",
            key: song.key || "",
            publisher: song.publisher || "",
            year: song.year || "",
        }
        if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

        show.slides = slides
        show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: song.notes || "", slides: layout } }

        tempShows.push({ id: uid(), show })
    }
}

function createSlides(song: Song) {
    let lyrics = song.lyrics?.section || []

    let slides: any = {}
    let layout: any[] = []

    if (!lyrics) return { slides, layout }

    // translations
    let translations: any[] = song.translation || []
    if (!Array.isArray(translations)) translations = [translations]
    let translationItems: any[] = translations.map(({ name, tlyrics }) => ({ name, lyrics: (tlyrics || "").split("\n\n") }))

    if (!Array.isArray(lyrics)) lyrics = [lyrics]
    lyrics.forEach((slideLine, slideIndex) => {
        let lines = (slideLine.lyrics || "").split("\n").filter(Boolean)
        let groupName = slideLine["@title"] || ""

        let id: string = uid()
        layout.push({ id })

        let items: Item[] = [
            {
                style: "left:50px;top:120px;width:1820px;height:840px;",
                lines: parseLines(lines),
            },
        ]

        // custom translations
        let tItems: Item[] = []
        translationItems.forEach(({ name, lyrics }) => {
            let lines = (lyrics[slideIndex] || "").split("\n").filter(Boolean)
            tItems.push(clone(items[0]))
            tItems[tItems.length - 1].language = name
            tItems[tItems.length - 1].lines = parseLines(lines)
        })

        items = [...tItems, ...items]

        slides[id] = {
            group: "",
            color: null,
            settings: {},
            notes: "",
            items,
        }

        let globalGroup = getGlobalGroup(groupName) || "verse"
        if (globalGroup) slides[id].globalGroup = globalGroup
        else slides[id].group = groupName.replace(/[\s\d]/g, "")
    })

    return { slides, layout }
}

// CHORDS

function parseLines(lines: string[]) {
    let newLines: any[] = []
    let chords: string = ""

    lines.forEach((text: any) => {
        if (isChordLine(text)) {
            chords = text
            return
        }

        let line: Line = { align: "", text: [{ style: "", value: text }] }

        if (chords) {
            line.chords = parseChordLine(chords)
            chords = ""
        }

        newLines.push(line)
    })

    return newLines
}
