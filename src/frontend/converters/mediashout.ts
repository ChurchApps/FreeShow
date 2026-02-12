import { uid } from "uid"
import type { Item, Layout, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { checkName, initializeMetadata, newSlide } from "../components/helpers/show"
import { activePopup, alertMessage } from "../stores"
import { translateText } from "../utils/language"
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
            console.error("File missing content!")
            return
        }

        if (typeof content === "object") {
            const songs = mdbConvert(content, categoryId)
            tempShows.push(...songs)
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
    show.origin = "mediashout"
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
        CCLI: song.CCLI
    })

    return show
}

function convertToSlides(song: MediaShout5Song) {
    const slides: { [key: string]: Slide } = {}
    const layout: Layout = { name: translateText("example.default"), slides: [], notes: "" }
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
        lines: text.split("\n").map(getLine)
    }

    return newItem

    function getLine(lineText: string) {
        return { align: "", text: [{ value: lineText, style: "" }] }
    }
}

// MDB

interface MDBContents {
    CCLI: any[]
    Groups: any[]
    Keys: any[]
    PlayOrder: any[]
    SongGroups: any[]
    SongThemes: any[]
    Songs: MDBSong[]
    Themes: any[]
    Verses: MDBVerse[]
}

interface MDBSong {
    Record: number
    Author: string
    CCLI: string
    CP: boolean
    Copyright: string
    Cue: string
    Hymnal: string
    ImportDate: string
    ModificationTime: string
    Notes: string
    Protection: null
    Reserved: null
    SamePageSongGUID: null
    SamePageSongID: number
    SongID: string
    SongSource: string
    Title: string
    WTSongID: string
    WTSongViewID: string
}

interface MDBVerse {
    Record: number
    Number: number
    Text: string
    Type: number
}

function mdbConvert(content: MDBContents, categoryId: string) {
    const songs = content.Songs.map((song) => getSong(song, content, categoryId))
    return songs
}

function getSong(song: MDBSong, content: MDBContents, categoryId: string) {
    const layoutId = uid()
    const showId = song.SongID
    const show = new ShowObj(false, categoryId, layoutId)
    show.origin = "mediashout"
    show.name = checkName(song.Title, showId)
    show.timestamps.modified = new Date(song.ModificationTime).getTime()

    show.meta = {
        title: song.Title,
        author: song.Author,
        copyright: song.Copyright,
        CCLI: song.CCLI
    }

    const DBnum = song.Record
    const songVerses: MDBVerse[] = []
    // remove from list while searching, so the list becomes smaller and smaller
    for (let i = 0; i < content.Verses.length; i++) {
        if (content.Verses[i].Record === DBnum) {
            songVerses.push(content.Verses.splice(i, 1)[0])
        }
    }

    const sortedVerses = songVerses.sort((a, b) => a.Number - b.Number)

    const { slides, layout, media } = convertToSlidesMDB(sortedVerses)
    if (!Object.keys(slides).length) return

    layout.notes = song.Notes || ""

    show.slides = slides
    show.layouts = { [layoutId]: layout }
    show.media = media

    return { show, id: showId }
}

function convertToSlidesMDB(verses: MDBVerse[]) {
    const slides: { [key: string]: Slide } = {}
    const layout: Layout = { name: translateText("example.default"), slides: [], notes: "" }
    const media: any = {}

    verses.forEach((verse) => {
        const isRTF = verse.Type === 102
        if (!verse.Text || isRTF) return
        // const text = RTFToText(verse.Text)
        const text = verse.Text
        slides[uid()] = newSlide({ group: "", globalGroup: "verse", items: [convertItem(text)] })
    })

    layout.slides = Object.keys(slides).map((id) => ({ id }))

    return { slides, layout, media }
}
