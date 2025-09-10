import { get } from "svelte/store"
import { uid } from "uid"
import type { Chords, Line } from "../../types/Show"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
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
        chords: Chords[][]
    }[]
}

export function convertOpenLP(data: any) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    const categoryId = createCategory("OpenLP")

    const tempShows: any[] = []

    setTimeout(() => {
        data?.forEach(({ content }: any) => {
            if (typeof content === "object") {
                const songs = sqliteConvert(content)
                songs.forEach(addShow)
                return
            }

            const song = XMLtoObject(content)
            addShow(song)
        })

        setTempShows(tempShows)
    }, 10)

    function addShow(song: Song) {
        const layoutID = uid()
        let show = new ShowObj(false, categoryId, layoutID)
        show.origin = "openlyrics"
        show.name = checkName(song.title)

        show.meta = {
            title: song.meta_title || show.name,
            author: song.authors?.find((a) => a.type?.includes("words"))?.name || "",
            artist: song.authors?.find((a) => a.type?.includes("music"))?.name || "",
            CCLI: song.ccli || "",
            copyright: song.copyright || ""
        }
        if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

        show.timestamps = {
            created: song.created ? new Date(song.created).getTime() : new Date().getTime(),
            modified: new Date(song.modified).getTime(),
            used: null
        }
        if (!show.timestamps.modified) show.timestamps.modified = show.timestamps.created

        const { slides, layout }: any = createSlides(song)

        show.slides = slides
        show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: song.notes || "", slides: layout } }

        tempShows.push({ id: uid(), show })
    }
}

// Verse, Chorus, Bridge, Pre-Chorus, Intro, Ending, Other
const OLPgroups: any = { V: "verse", C: "chorus", P: "pre_chorus", B: "bridge", O: "tag", I: "intro", E: "outro" }
function createSlides({ verseOrder, lyrics }: Song) {
    const slides: any = {}
    let layout: any[] = []
    const sequence: string[] = verseOrder.split(" ").filter((a) => a)
    const sequences: any = {}

    // split into multiple sub slides (https://github.com/ChurchApps/FreeShow/issues/1743)
    const slidesList: ((typeof lyrics)[number] & { isChild: boolean })[] = []
    lyrics.forEach((lyricSlide) => {
        const currentSlides = lyricSlide.lines.join("__BREAK__").split(/<p\s*style=["']page-break-after:\s*always;["']\s*\/?>/i)
        currentSlides.forEach((slideData, i) => {
            const mergedLines = slideData.trim().split("__BREAK__").filter(Boolean)
            // Chords will "break" if splitted into multiple
            slidesList.push({ name: lyricSlide.name, isChild: i > 0, lines: mergedLines, chords: lyricSlide.chords })
        })
    })

    slidesList.forEach((verse) => {
        if (!verse.lines) return

        const id: string = uid()
        if (!verse.isChild) {
            if (verse.name) sequences[verse.name] = id
            layout.push({ id })
        }

        const items = [
            {
                style: "inset-inline-start:50px;top:120px;width:1820px;height:840px;",
                lines: verse.lines.map((a, i) => {
                    const line: Line = { align: "", text: [{ style: "", value: formatText(a) }] }
                    if (verse.chords?.[i]?.length) line.chords = verse.chords[i]
                    return line
                })
            }
        ]

        slides[id] = {
            group: verse.isChild ? null : "",
            color: null,
            settings: {},
            notes: "",
            items
        }

        if (verse.isChild) {
            const parentId = sequences[verse.name]
            if (!slides[parentId].children) slides[parentId].children = []
            slides[parentId].children.push(id)
            return
        }

        const globalGroup = OLPgroups[verse.name.replace(/[0-9]/g, "").toUpperCase()]
        if (get(groups)[globalGroup]) slides[id].globalGroup = globalGroup
    })

    if (sequence.length) {
        const newLayout: any[] = []
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
    const songs: any[] = content.songs.map((song) => getSong(song, content))

    return songs
}

function getSong(song: any, content: any) {
    const newSong: Song = {
        title: song.alternate_title || song.title,
        meta_title: song.alternate_title,
        notes: song.comments,
        created: song.create_date,
        modified: song.last_modified,
        copyright: song.copyright,
        ccli: song.ccli_number,
        authors: getAuthors(),
        verseOrder: song.verse_order || "",
        lyrics: getLyrics()
    }

    return newSong

    function getAuthors() {
        let authors: any[] = []

        const currentSongAuthors = content.authors_songs.filter((a) => a.song_id === song.id)
        authors = currentSongAuthors.map((a) => ({ name: content.authors.find((author) => author.id === a.author_id)?.display_name || "", type: a.author_type || "words" }))

        return authors
    }

    function getLyrics() {
        let lyrics: any = xml2json(song.lyrics)

        lyrics = lyrics.song?.lyrics?.verse || []
        if (!Array.isArray(lyrics)) lyrics = [lyrics]

        lyrics = lyrics.map((a) => {
            const { lines, chords } = extractChordLines(a["#cdata"] || "")
            return { name: a["@type"] + a["@label"], lines, chords }
        })

        return lyrics
    }
}

// XML

function XMLtoObject(xml: string) {
    const song = xml2json(xml).song || {}

    let lyrics = song.lyrics || {}
    const properties = song.properties || {}

    const notes =
        song["#comment"] ||
        (Array.isArray(properties.comments)
            ? properties.comments?.map((comment) => comment["#text"] || "").join("\n")
            : typeof properties.comments?.comment === "string"
              ? properties.comments.comment
              : typeof properties.comments === "string"
                ? properties.comments
                : "") ||
        ""

    const newSong: Song = {
        title: getTitle(),
        notes,
        // created: song["@createDate"],
        modified: song["@modifiedDate"],
        copyright: properties.copyright || "",
        ccli: properties.ccliNo || "",
        authors: getAuthors(),
        verseOrder: formatVerseOrder(properties.verseOrder || ""),
        lyrics: getLyrics()
    }

    return newSong

    function getTitle() {
        let currentSongTitle = properties.titles?.title || []
        if (Array.isArray(currentSongTitle)) currentSongTitle = currentSongTitle[0]
        if (!currentSongTitle) return ""

        const title = typeof currentSongTitle["#text"] != "undefined" ? currentSongTitle["#text"] : currentSongTitle

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

        lyrics = lyrics.map((a) => {
            const { lines, chords } = getLines(a.lines || "")
            return { name: a["@name"], lines, chords }
        })

        return lyrics
    }

    function getLines(lines: string | any) {
        if (lines.tag) lines = lines.tag.tag?.["#text"]

        // might be <lines break="optional">
        if (lines["#text"]) lines = lines["#text"]
        // some openlyrics verses can have multiple <lines> tags
        if (Array.isArray(lines)) {
            const convertedLines: string[] = lines.map(convertToText)
            function convertToText(line: any) {
                if (line["#text"]) return line["#text"]
                return line
            }
            lines = convertedLines.join("\n")
        }

        if (typeof lines !== "string") lines = ""

        // remove unused line separator char
        lines = lines.replaceAll("&#8232;", "")
        // find line breaks
        lines = lines.replaceAll('xmlns="http://openlyrics.info/namespace/2009/song"', "").replaceAll("<br/>", "\n").replaceAll("<br />", "\n")

        return extractChordLines(lines)
    }
}

function extractChordLines(lines: string) {
    // CHORDS
    const chords: Chords[][] = []
    const newLines: string[] = lines
        .split("\n")
        .map((lineText: string) => {
            let newText = ""
            const lineChords: Chords[] = []

            // WIP duplicate of VideoPsalm
            lineText.split("]").forEach((t) => {
                let chordStart = t.indexOf("[")
                if (chordStart < 0) chordStart = t.length

                const chordText = t.slice(0, chordStart)
                newText += chordText

                const chord = t.slice(chordStart + 1)
                if (!chord) return
                // only: [Gm], not: [info] [x4]
                if (chord.length > 5 || chord.includes("x")) newText += `[${chord}]`
                else {
                    const chordId = uid(5)
                    lineChords.push({ id: chordId, pos: newText.length, key: chord })
                }
            })

            if (!newText.length) return ""

            chords.push(lineChords)

            return newText
        })
        .filter(Boolean)

    return { lines: newLines, chords }
}
