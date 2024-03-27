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

    createCategory("OpenLP")

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
        let show = new ShowObj(false, "openlp", layoutID)
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

const OLPgroups: any = { V: "verse", C: "chorus", B: "bridge", T: "tag", O: "outro" }
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
    let parser = new DOMParser()

    // remove first line (standalone attribute): <?xml version="1.0" encoding="UTF-8"?> / <?xml-stylesheet href="stylesheets.css" type="text/css"?>
    while (xml.indexOf("<?xml") >= 0) {
        let splitted = xml.split("\n")
        xml = splitted.slice(1, splitted.length).join("\n")
    }

    let xmlDoc = parser.parseFromString(xml, "text/xml").children[0]

    let properties = getChild(xmlDoc, "properties")
    let lyrics = getChild(xmlDoc, "lyrics")

    let object: Song = {
        title: getChild(getChild(properties, "titles"), "title").textContent || "",
        modified: xmlDoc.getAttribute("modifiedDate") || "",
        verseOrder: getChild(properties, "verseOrder").textContent || "",
        authors: getChild(properties, "authors").children
            ? [...getChild(properties, "authors").children].map((a: any) => ({
                  type: a.getAttribute("type") ? a.getAttribute("type") : "words",
                  name: a.textContent,
              }))
            : [],
        notes: getChild(properties, "comments").children ? [...getChild(properties, "comments").children].map((comment) => comment.textContent).join("\n") : "",
        copyright: getChild(properties, "copyright").textContent || "",
        ccli: getChild(properties, "ccliNo").textContent || "",
        lyrics: [...lyrics.getElementsByTagName("verse")].map((verse) => ({
            name: verse.getAttribute("name")!,
            lines: getChild(verse, "lines")
                ?.innerHTML.toString()
                .replaceAll('xmlns="http://openlyrics.info/namespace/2009/song"', "")
                .replaceAll("<br/>", "<br />")
                .replaceAll("\n", "<br />")
                ?.split("<br />")
                .filter((a) => a.trim().length),
        })),
    }

    return object
}

const getChild = (parent: any, name: string) => parent.getElementsByTagName(name)[0] || {}
