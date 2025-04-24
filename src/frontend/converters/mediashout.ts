import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Layout, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { checkName, initializeMetadata, newSlide } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { xml2json } from "./xml"

type MediaShout5Song = {
    CueType: number
    Title: string
    CreateTime: number
    ModificationTime: number
    Template: null | string
    AutoExpand: number
    AutoCollapse: number
    NotShowOneSubcue: number
    LoopCommand: {
        ControlType: number
    }
    SoundUniqueNumber: number
    PlayOrder: any
    Foreground: {
        SourceType: number
        MediaPos: number
        Commands: any
        Layout: {
            KeepRatio: number
            HorzPos: number
            VertPos: number
            Height: number
            Width: number
            X: number
            Y: number
        }
        TextEffect: any
    }
    TextData: {
        cf: any
        pf: any
        SizeScreenX: number
        SizeScreenY: number
        AlignmentVert: number
        TextEffect: any
    }
    GuidAnnouncement: number
    Duration: number
    BGObjects: any
    StageObjects: null
    SoundObjects: any
    StageFG: any
    StageTextData: any
    StageHeader: any
    StageFooter: any
    AdvanceTime: number
    AdvanceTarget: number
    SplitMode: number
    Headres: {
        Element: {
            SourceType: number
            MediaPos: number
            Commands: any
            Layout: any
            TextEffect: any
            Text: string
        }
    }
    SongTitle: string
    SongID: string
    Author: string
    Copyright: string
    CCLI: string
    Hymnal: null
    Content: {
        Element: {
            Number: number
            Type: number
            Text: string
        }[]
    }
    Groups: null
}

export function convertMediaShout(data: any) {
    alertMessage.set("popup.importing")
    activePopup.set("alert")

    const categoryId = createCategory("MediaShout")

    const tempShows: any[] = []
    data?.forEach(({ content, name }: any) => {
        if (!content) {
            console.log("File missing content!")
            return
        }

        let cues = xml2json(content)?.MediaShout5_Document?.Cues
        if (!Array.isArray(cues)) cues = [cues]
        const cues2: any[] = cues.map((a) => Object.values(a))?.flat(2)

        cues2.forEach((song: MediaShout5Song) => {
            if (!song) return

            const showId = song.SongID || uid()
            const showName = checkName(song.Title || name, showId)
            const show = convertToShow(song, { name: showName, categoryId })
            if (show) tempShows.push({ id: showId, show })
        })
    })

    setTempShows(tempShows)
}

function convertToShow(song: MediaShout5Song, { name, categoryId }) {
    const layoutID = uid()
    const show = new ShowObj(false, categoryId, layoutID)
    show.name = name

    const { slides, layout, media } = convertToSlides(song)
    if (!Object.keys(slides).length) return

    show.slides = slides
    show.layouts = { [layoutID]: layout }
    show.media = media

    show.meta = initializeMetadata({
        title: name,
        author: song.Author,
        copyright: song.Copyright,
        CCLI: song.CCLI,
    })

    return show
}

function convertToSlides(song: MediaShout5Song) {
    const slides: { [key: string]: Slide } = {}
    const layout: Layout = { name: get(dictionary).example?.default || "", slides: [], notes: "" }
    const media: any = {}

    let elements = song.Content?.Element
    if (!Array.isArray(elements)) elements = [elements]
    elements.forEach((element) => {
        if (!element.Text) return
        slides[uid()] = newSlide({ group: "", globalGroup: "verse", items: [convertItem(element.Text)] })
    })

    layout.slides = Object.keys(slides).map((id) => ({ id }))

    return { slides, layout, media }
}
function convertItem(text: string) {
    const newItem: Item = {
        style: DEFAULT_ITEM_STYLE,
        lines: text.split("\n").map(getLine),
    }

    return newItem

    function getLine(text: string) {
        return { align: "", text: [{ value: text, style: "" }] }
    }
}
