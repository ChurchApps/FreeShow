import { get } from "svelte/store"
import { uid } from "uid"
import { ShowObj } from "../classes/Show"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary } from "../stores"
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
    translation?: string
    translationoptions?: string
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
    })

    function convertSong(song: Song) {
        let layoutID = uid()
        let show = new ShowObj(false, categoryId, layoutID)
        show.name = checkName(song.title)

        let { slides, layout }: any = createSlides(song)

        show.meta = {
            title: song.title || "",
            ccli: song.ccli || "",
            copyright: song.copyright || "",
            author: song.author || "",
            key: song.key || "",
            publisher: song.publisher || "",
            year: song.year || "",
        }

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

    lyrics.forEach((slideLine) => {
        let lines = slideLine.lyrics.split("\n").filter(Boolean)
        let groupName = slideLine["@title"] || ""

        let id: string = uid()
        layout.push({ id })

        let items = [
            {
                style: "left:50px;top:120px;width:1820px;height:840px;",
                lines: lines.map((text: any) => ({ align: "", text: [{ style: "", value: text }] })),
            },
        ]

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
