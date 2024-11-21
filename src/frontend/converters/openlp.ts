import { get } from "svelte/store"
import { uid } from "uid"
import { checkName } from "../components/helpers/show"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, dictionary, groups } from "./../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { xml2json } from "./xml"

interface Song {
    title: string
    meta_title?: string
    notes?: string
    ccli?: string
    copyright?: string
    created?: string
    modified: string
    verseOrder: string
    authors: {
        type: string
        name: string
    }[]
    lyrics: {
        name: string
        lines: string[]
    }[]
}

export function convertOpenLP(data: any) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    let categoryId = createCategory("OpenLP")

    let tempShows: any[] = []

    setTimeout(() => {
        data?.forEach(({ content }: any) => {
            if (typeof content === "object") {
                let songs = sqliteConvert(content)
                songs.forEach(addShow)
                return
            }

            let song = XMLtoObject(content)
            addShow(song)
        })

        setTempShows(tempShows)
    }, 10)

    function addShow(song: Song) {
        let layoutID = uid()
        let show = new ShowObj(false, categoryId, layoutID)
        show.name = checkName(song.title)

        show.meta = {
            title: song.meta_title || show.name,
            author: song.authors?.find((a) => a.type?.includes("words"))?.name || "",
            artist: song.authors?.find((a) => a.type?.includes("music"))?.name || "",
            CCLI: song.ccli || "",
            copyright: song.copyright || "",
        }

        show.timestamps = {
            created: song.created ? new Date(song.created).getTime() : new Date().getTime(),
            modified: new Date(song.modified).getTime(),
            used: null,
        }
        if (!show.timestamps.modified) show.timestamps.modified = show.timestamps.created

        let { slides, layout }: any = createSlides(song)

        show.slides = slides
        show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: song.notes || "", slides: layout } }

        tempShows.push({ id: uid(), show })
    }
}

// Verse, Chorus, Bridge, Pre-Chorus, Intro, Ending, Other
const OLPgroups: any = { V: "verse", C: "chorus", P: "pre_chorus", B: "bridge", O: "tag", I: "intro", E: "outro" }
function createSlides({ verseOrder, lyrics }: Song) {
    let slides: any = {}
    let layout: any[] = []
    let sequence: string[] = verseOrder.split(" ").filter((a) => a)
    let sequences: any = {}

    lyrics.forEach((verse) => {
        if (!verse.lines) return

        let id: string = uid()
        if (verse.name) sequences[verse.name] = id
        layout.push({ id })

        let items = [
            {
                style: "left:50px;top:120px;width:1820px;height:840px;",
                lines: verse.lines.map((a: any) => ({ align: "", text: [{ style: "", value: formatText(a) }] })),
            },
        ]

        slides[id] = {
            group: "",
            color: null,
            settings: {},
            notes: "",
            items,
        }

        let globalGroup = OLPgroups[verse.name.replace(/[0-9]/g, "").toUpperCase()]
        if (get(groups)[globalGroup]) slides[id].globalGroup = globalGroup
    })

    if (sequence.length) {
        let newLayout: any[] = []
        sequence.forEach((group) => {
            if (sequences[group]) newLayout.push({ id: sequences[group] })
        })
        if (newLayout.length) layout = newLayout
    }

    return { slides, layout }
}

function formatText(text: string) {
    // replace OpenLP formatting inside {}
    return text.replace(/ *\{[^}]*\} */g, "")
}

// SQLITE

// WIP import song books as categories
function sqliteConvert(content: any) {
    let songs: any[] = content.songs.map((song) => getSong(song, content))

    return songs
}

function getSong(song: any, content: any) {
    let newSong: Song = {
        title: song.alternate_title || song.title,
        meta_title: song.alternate_title,
        notes: song.comments,
        created: song.create_date,
        modified: song.last_modified,
        copyright: song.copyright,
        ccli: song.ccli_number,
        authors: getAuthors(),
        verseOrder: song.verse_order || "",
        lyrics: getLyrics(),
    }

    return newSong

    function getAuthors() {
        let authors: any[] = []

        let currentSongAuthors = content.authors_songs.filter((a) => a.song_id === song.id)
        authors = currentSongAuthors.map((a) => ({ name: content.authors.find((author) => author.id === a.author_id)?.display_name || "", type: a.author_type || "words" }))

        return authors
    }

    function getLyrics() {
        let lyrics: any = xml2json(song.lyrics)

        lyrics = lyrics.song?.lyrics?.verse || []
        if (!Array.isArray(lyrics)) lyrics = [lyrics]

        lyrics = lyrics.map((a) => ({ name: a["@type"] + a["@label"], lines: a["#cdata"].split("\n") }))

        return lyrics
    }
}

// XML

function XMLtoObject(xml: string) {
    let song = xml2json(xml).song || {}

    let lyrics = song.lyrics || {}
    let properties = song.properties || {}

    let newSong: Song = {
        title: getTitle(),
        notes: song["#comment"] || properties.comments?.map((comment) => comment["#text"] || "").join("\n") || "",
        // created: song["@createDate"],
        modified: song["@modifiedDate"],
        copyright: properties.copyright || "",
        ccli: properties.ccliNo || "",
        authors: getAuthors(),
        verseOrder: formatVerseOrder(properties.verseOrder || ""),
        lyrics: getLyrics(),
    }

    return newSong

    function getTitle() {
        let currentSongTitle = properties.titles?.title || []
        if (Array.isArray(currentSongTitle)) currentSongTitle = currentSongTitle[0]

        let title = typeof currentSongTitle["#text"] != "undefined" ? currentSongTitle["#text"] : currentSongTitle

        return title
    }

    function getAuthors() {
        let currentSongAuthors = properties.authors?.author || []
        if (!Array.isArray(currentSongAuthors)) currentSongAuthors = [currentSongAuthors]

        let authors: any[] = []
        authors = currentSongAuthors.map((author) => ({ name: author["#text"] || "", type: author["@type"] || "words" }))

        return authors
    }

    function formatVerseOrder(verseOrder: string) {
        const hasNumber = /\d+$/
        verseOrder = verseOrder.split(" ").map(format).join(" ")
        function format(id) {
            if (!hasNumber.test(id)) id += "1"
            return id
        }

        return verseOrder
    }

    function getLyrics() {
        lyrics = song.lyrics?.verse || []
        if (!Array.isArray(lyrics)) lyrics = [lyrics]

        lyrics = lyrics.map((a) => ({ name: a["@name"], lines: getLines(a.lines || "") }))

        return lyrics
    }

    function getLines(lines: string | any[]) {
        let newLines: string[] = []

        // might be <lines break="optional">
        if (lines["#text"]) lines = lines["#text"]
        // some openlyrics verses can have multiple <lines> tags
        if (Array.isArray(lines)) {
            let convertedLines: string[] = lines.map(convertToText)
            function convertToText(line: any) {
                if (line["#text"]) return line["#text"]
                return line
            }
            lines = convertedLines.join("\n")
        }

        // remove unused line seperator char
        lines = lines.replaceAll("&#8232;", "")
        // find line breaks
        lines = lines.replaceAll('xmlns="http://openlyrics.info/namespace/2009/song"', "").replaceAll("<br/>", "\n").replaceAll("<br />", "\n")
        newLines = lines.split("\n")

        return newLines
    }
}
