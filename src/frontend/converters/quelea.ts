import { uid } from "uid"
import type { Item, Line } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { isChordLine, parseChordLine } from "../components/edit/scripts/chords"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { clone } from "../components/helpers/array"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { activePopup, alertMessage } from "../stores"
import { translateText } from "../utils/language"
import { createCategory, setTempShows } from "./importHelpers"
import { xml2json } from "./xml"

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

    const categoryId = createCategory("Quelea")

    const tempShows: any[] = []

    // set timeout to allow popup to open
    setTimeout(() => {
        data?.forEach(({ content }: any) => {
            convertSong(xml2json(content).song)
        })

        setTempShows(tempShows)
    }, 50)

    function convertSong(song: Song) {
        const layoutID = uid()
        let show = new ShowObj(false, categoryId, layoutID)
        show.origin = "quelea"
        show.name = checkName(song.title)

        const { slides, layout }: any = createSlides(song)

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
        show.layouts = { [layoutID]: { name: translateText("example.default"), notes: song.notes || "", slides: layout } }

        tempShows.push({ id: uid(), show })
    }
}

function createSlides(song: Song) {
    let lyrics = song.lyrics?.section || []

    const slides: any = {}
    const layout: any[] = []

    if (!lyrics) return { slides, layout }

    // translations
    let translations: any[] = song.translation || []
    if (!Array.isArray(translations)) translations = [translations]
    const translationItems: any[] = translations.map(({ name, tlyrics }) => ({ name, lyrics: (tlyrics || "").split("\n\n") }))

    if (!Array.isArray(lyrics)) lyrics = [lyrics]
    lyrics.forEach((slideLine, slideIndex) => {
        const allLines = (slideLine.lyrics || "").split("\n").filter(Boolean)
        const groupName = slideLine["@title"] || ""

        const id: string = uid()
        layout.push({ id })

        let items: Item[] = [
            {
                style: DEFAULT_ITEM_STYLE,
                lines: parseLines(allLines),
            },
        ]

        // custom translations
        const tItems: Item[] = []
        translationItems.forEach(({ name, lyrics: lineTexts }) => {
            const lines = (lineTexts[slideIndex] || "").split("\n").filter(Boolean)
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

        const globalGroup = getGlobalGroup(groupName) || "verse"
        if (globalGroup) slides[id].globalGroup = globalGroup
        else slides[id].group = groupName.replace(/[\s\d]/g, "")
    })

    return { slides, layout }
}

// CHORDS

function parseLines(lines: string[]) {
    const newLines: any[] = []
    let chords = ""

    lines.forEach((text: any) => {
        if (isChordLine(text)) {
            chords = text
            return
        }

        const line: Line = { align: "", text: [{ style: "", value: text }] }

        if (chords) {
            line.chords = parseChordLine(chords)
            chords = ""
        }

        newLines.push(line)
    })

    return newLines
}
