import { get } from "svelte/store"
import { uid } from "uid"
import { ShowObj } from "../classes/Show"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"

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

    const categoryId = createCategory("SoftProjector")

    const tempShows: any[] = []

    // set timeout to allow popup to open
    setTimeout(() => {
        data?.forEach(({ content }: any) => {
            if (content.Songs) content.Songs.map(convertSong)
        })

        setTempShows(tempShows)
    })

    function convertSong(song: Song) {
        const layoutID = uid()
        const show = new ShowObj(false, categoryId, layoutID)
        show.origin = "softprojector"
        show.name = checkName(song.title)

        show.meta = {
            number: song.number || "",
            title: song.title || "",
        }
        if (show.meta.number !== undefined) show.quickAccess = { number: show.meta.number }

        const { slides, layout }: any = createSlides(song)

        show.slides = slides
        show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layout } }

        tempShows.push({ id: uid(), show })
    }
}

function createSlides(song: Song) {
    const lyrics = song.song_text || ""

    const slides: any = {}
    const layout: any[] = []

    if (!lyrics) return { slides, layout }

    const slideLines = lyrics.split("\n\n")
    slideLines.forEach((slideLine) => {
        const lines = slideLine.split("\n")
        const groupName = lines.shift() || ""

        const id: string = uid()
        layout.push({ id })

        const items = [
            {
                style: DEFAULT_ITEM_STYLE,
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

        const globalGroup = getGlobalGroup(groupName)
        if (globalGroup) slides[id].globalGroup = globalGroup
        else slides[id].group = groupName.replace(/[\s\d]/g, "")
    })

    return { slides, layout }
}
