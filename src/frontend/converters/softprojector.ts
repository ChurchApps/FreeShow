import { get } from "svelte/store"
import { uid } from "uid"
import { ShowObj } from "../classes/Show"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"

// interface Songbook {
//     title: string
//     info: string
// }
interface Song {
    alignment_h: null
    alignment_v: null
    background: null
    background_name: string
    category: number
    color: null
    count: number
    date: null
    ending_color: null
    ending_font: null
    font: string
    info_color: null
    info_font: null
    music: string
    notes: string
    number: number
    song_text: string
    title: string
    tune: string
    use_background: null
    use_private: null
    words: string
}

export function convertSoftProjector(data: any) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    let categoryId = createCategory("SoftProjector")

    let tempShows: any[] = []

    // set timeout to allow popup to open
    setTimeout(() => {
        data?.forEach(({ content }: any) => {
            if (content.Songs) content.Songs.map(convertSong)
        })

        setTempShows(tempShows)
    })

    function convertSong(song: Song) {
        let layoutID = uid()
        let show = new ShowObj(false, categoryId, layoutID)
        show.name = checkName(song.title)

        let { slides, layout }: any = createSlides(song)

        show.slides = slides
        show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layout } }

        tempShows.push({ id: uid(), show })
    }
}

function createSlides(song: Song) {
    let lyrics = song.song_text || ""

    let slides: any = {}
    let layout: any[] = []

    if (!lyrics) return { slides, layout }

    let slideLines = lyrics.split("\n\n")
    slideLines.forEach((slideLine) => {
        let lines = slideLine.split("\n")
        let groupName = lines.shift() || ""

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

        let globalGroup = getGlobalGroup(groupName)
        if (globalGroup) slides[id].globalGroup = globalGroup
        else slides[id].group = groupName.replace(/[\s\d]/g, "")
    })

    return { slides, layout }
}
