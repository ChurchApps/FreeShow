import { get } from "svelte/store"
import { uid } from "uid"
import { ShowObj } from "../classes/Show"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { xml2json } from "./xml"

type Song = {
    Contents: string
    CurItemNo: string // "0"
    Folder: string
    SongNumber: string
    Title1: string
}

export function convertEasyslides(data: any) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    let categoryId = createCategory("Easyslides")

    let tempShows: any[] = []

    // set timeout to allow popup to open
    setTimeout(() => {
        data?.forEach(({ content }: any) => {
            const songs = xml2json(content).EasiSlides?.Item || []
            songs.forEach(convertSong)
        })

        setTempShows(tempShows)
    })

    function convertSong(song: Song) {
        let layoutID = uid()
        let show = new ShowObj(false, categoryId, layoutID)
        show.name = checkName(song.Title1)

        let { slides, layout }: any = createSlides(song)

        show.meta = { number: song.SongNumber }
        if (show.meta.number !== undefined) show.quickAccess = { number: show.meta.number }

        show.slides = slides
        show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layout } }

        tempShows.push({ id: uid(), show })
    }
}

function createSlides(song: Song) {
    let lyrics = song.Contents || ""

    let slides: any = {}
    let layout: any[] = []

    if (!lyrics) return { slides, layout }

    // fix incorrect formatting
    lyrics = lyrics.replaceAll("[", "\n\n[").trim()
    lyrics = lyrics.replaceAll("\n\n\n\n", "\n\n")

    lyrics = lyrics.replace(/\[\d+\]/g, "\n\n").replaceAll("\n\n\n", "\n\n")
    const slideLines = lyrics.split("\n\n").filter(Boolean)
    slideLines.forEach((slideLine) => {
        let lines = slideLine.split("\n").filter(Boolean)
        let group = "verse"
        if (lines[0].includes("[") && lines[0].includes("]")) {
            group = lines[0].replace(/[\s\d]/g, "")
            lines.shift()
        }

        let id: string = uid()
        layout.push({ id })

        let items = [
            {
                style: "left:50px;top:120px;width:1820px;height:840px;",
                lines: lines.map((text: any) => ({ align: "", text: [{ style: "", value: text.trim() }] })),
            },
        ]

        slides[id] = {
            group: "",
            color: null,
            settings: {},
            notes: "",
            items,
        }

        let globalGroup = getGlobalGroup(group)
        if (!group) globalGroup = "verse"
        if (globalGroup) slides[id].globalGroup = globalGroup
        else slides[id].group = group
    })

    return { slides, layout }
}
