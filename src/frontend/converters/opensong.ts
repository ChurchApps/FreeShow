import { get } from "svelte/store"
import { uid } from "uid"
import type { Chords } from "../../types/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
import { checkName, formatToFileName } from "../components/helpers/show"
import { translateText } from "../utils/language"
import type { Bible, Book, Chapter, Verse } from "json-bible/lib/Bible"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, groups, scriptures, scripturesCache } from "./../stores"
import { setActiveScripture } from "./bible"
import { createCategory, setTempShows } from "./importHelpers"

interface Song {
    title: string
    author: string
    copyright: string
    presentation?: string
    // capo: string
    // tempo: string
    ccli: string
    // theme: string
    // user1: string
    // user2: string
    // user3: string
    lyrics: string
    hymn_number: string
    key: string
    aka?: string
    // key_line: string
    // linked_songs: string
    time_sig: string
    backgrounds?: string
}

export function convertOpenSong(data: any) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    const categoryId = createCategory("OpenSong")

    const tempShows: any[] = []

    setTimeout(() => {
        data?.forEach(({ content }: any) => {
            let song: any = {}
            if (content.includes("<html>")) song = HTMLtoObject(content)
            else song = XMLtoObject(content)
            // console.log(content, song)

            const layoutID = uid()
            let show = new ShowObj(false, categoryId, layoutID)
            show.origin = "opensong"
            show.name = checkName(song.title)
            show.meta = {
                number: song.hymn_number || "",
                title: song.title || "",
                author: song.author || "",
                copyright: song.copyright || "",
                key: song.key || "",
                CCLI: song.ccli || ""
            }
            if (show.meta.number !== undefined) show.quickAccess = { number: show.meta.number }
            if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

            const { slides, layout, media }: any = createSlides(song)

            show.slides = slides
            show.media = media
            show.layouts = { [layoutID]: { name: translateText("example.default"), notes: song.aka || "", slides: layout } }

            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

// Added Pre-chorus as a common global group
const OSgroups: any = { V: "verse", C: "chorus", B: "bridge", T: "tag", O: "outro", I: "intro", P: "pre_chorus" }
function createSlides({ lyrics, presentation, backgrounds }: Song) {
    const slides: any = {}
    const media: any = {}
    let layout: any[] = []
    if (!lyrics) return { slides, layout }

    // fix incorrect formatting
    lyrics = lyrics.replaceAll("\n \n", "\n\n").trim()
    lyrics = lyrics.replaceAll("\n\n\n\n", "\n\n")
    lyrics = lyrics.replaceAll("||", "__CHILD_SLIDE__")

    const slideRef: any = {}
    let slideOrder: string[] = []

    // split into groups: if square-bracket group markers exist, split at each '[' (keep '[' with group)
    let splittedgroups = lyrics.includes("[") ? lyrics.split(/(?=\[)/) : [lyrics]

    // Mimic Opensong handling of duplicate [] tags. 
    // Combine groups with identical [] tags into the first occurrence (remove extra [] markers and later groups)
    if (splittedgroups.length > 1) {
        const seen: Record<string, number> = {}
        for (let i = 0; i < splittedgroups.length; i++) {
            const grp = splittedgroups[i]
            if (!grp) continue
            const firstLine = grp.split("\n")[0] || ""
            let tag = ""
            const openIdx = firstLine.indexOf("[")
            if (openIdx !== -1) {
                const closeIdx = firstLine.indexOf("]", openIdx + 1)
                tag = closeIdx !== -1 ? firstLine.slice(openIdx + 1, closeIdx) : firstLine.slice(openIdx + 1)
            } else {
                tag = ""
            }
            tag = (tag || "").trim()
            if (!tag) continue
            if (!(tag in seen)) {
                seen[tag] = i
                continue
            }

            const firstIdx = seen[tag]
            // remove the leading [tag] from this duplicate group
            const escapedTag = tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
            const newContent = grp.replace(new RegExp("^\\[" + escapedTag + "\\]"), "").trim()
            // append to first occurrence with spacing
            splittedgroups[firstIdx] = (splittedgroups[firstIdx].trim() + "\n\n" + newContent).trim()
            // mark duplicate for removal
            splittedgroups[i] = ""
        }
        splittedgroups = splittedgroups.filter((g) => g && g.length)
    }

    splittedgroups.forEach((slide) => {
        // Trim each line and remove empty lines (keep significant content only)
        const groupText = slide
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length)
            .join('\n')
            .replaceAll("|", "\n")

        // Determine group from first line: take text between '[' and ']', or from '[' to end-of-line if no closing ']'.
        const firstLine = groupText.split("\n")[0] || ""
        let group = ""
        const openIdx = firstLine.indexOf("[")
        if (openIdx !== -1) {
            const closeIdx = firstLine.indexOf("]", openIdx + 1)
            group = closeIdx !== -1 ? firstLine.slice(openIdx + 1, closeIdx) : firstLine.slice(openIdx + 1)
        } else {
            group = "V" // default to Verse if no group found
        }
        group = (group || "").trim()
        if (group.startsWith(".")) group = "V"
        if (!groupText) return

        slideOrder.push(group)
        const parentId = uid()
        const children: string[] = []
        groupText.split("__CHILD_SLIDE__").forEach((slideText, i) => {
            const lines = slideText.trim().split("\n")
            if (i === 0 && lines[0].includes("[")) lines.shift()

            // extract comment lines (starting with ';'), to add as slide notes
            const commentData = lines
                .filter((l: string) => l.trim().startsWith(";"))
                .map((l: string) => l.trim().slice(1).trim())

            const contentLines = lines.filter((l) => !l.trim().startsWith(";"))

            const newLines: any[] = []
            let pendingChords: Chords[] | null = null

            for (const line of contentLines) {
                if (line.startsWith(".")) {
                    const chords: Chords[] = []
                    let pos = -1
                    line.slice(1)
                        .split(" ")
                        .forEach((letter) => {
                            pos++
                            if (letter === "") return
                            chords.push({ id: uid(5), pos, key: letter })
                            pos++ // add extra " " removed by split
                        })
                    pendingChords = chords
                } else if (line.trim() !== "") {
                    newLines.push({
                        align: "",
                        text: [{ style: "", value: line.replaceAll("_", "").trim() }],
                        chords: pendingChords || []
                    })
                    pendingChords = null // Reset for next line
                }
            }

            const id: string = i === 0 ? parentId : uid()
            if (i === 0) slideRef[group] = id
            else children.push(id)

            const items = [
                {
                    style: DEFAULT_ITEM_STYLE,
                    lines: newLines
                }
            ]

            slides[id] = {
                group: i === 0 ? "" : null,
                color: null,
                settings: {},
                notes: commentData && commentData.length ? commentData.join("\n") : "",
                items
            }

            if (i > 0) return

            const globalGroup = OSgroups[group.replace(/[0-9]/g, "").trim().toUpperCase()]
            if (get(groups)[globalGroup]) slides[id].globalGroup = globalGroup
            else slides[id].group = group
        })

        if (children.length) {
            slides[parentId].children = children
        }
    })

    // custom slide order
    if (presentation) slideOrder = presentation.split(" ")
    if (slideOrder.length) {
        layout = []
        slideOrder.forEach((group) => {
            // case-insensitive lookup in slideRef
            let id = slideRef[group]
            if (!id) {
                const key = Object.keys(slideRef).find((k) => k.toLowerCase() === group.toLowerCase())
                if (key) id = slideRef[key]
            }
            if (id) layout.push({ id })
        })
    }

    if (!layout.length) {
        layout = Object.keys(slides).map((id) => ({ id }))
    }

    // add backgrounds
    if (backgrounds?.length) {
        const bgId = uid(5)
        layout[0].background = bgId
        media[bgId] = { path: "data:image/jpeg;base64," + backgrounds } // base64:
    }

    return { slides, layout, media }
}

function XMLtoObject(xml: string) {
    const parser = new DOMParser()
    const song = parser.parseFromString(xml, "text/xml").children[0]

    const object: Song = {
        title: song.getElementsByTagName("title")[0]?.textContent || "",
        author: song.getElementsByTagName("author")[0]?.textContent || "",
        copyright: song.getElementsByTagName("copyright")[0]?.textContent || "",
        presentation: song.getElementsByTagName("presentation")[0]?.textContent || "",
        // capo: song.getElementsByTagName("capo")[0]?.textContent || "",
        // tempo: song.getElementsByTagName("tempo")[0]?.textContent || "",
        ccli: song.getElementsByTagName("ccli")[0]?.textContent || "",
        // theme: song.getElementsByTagName("theme")[0]?.textContent || "",
        // user1: song.getElementsByTagName("user1")[0]?.textContent || "",
        // user2: song.getElementsByTagName("user2")[0]?.textContent || "",
        // user3: song.getElementsByTagName("user3")[0]?.textContent || "",
        lyrics: song.getElementsByTagName("lyrics")[0]?.textContent || "",
        hymn_number: song.getElementsByTagName("hymn_number")[0]?.textContent || "",
        key: song.getElementsByTagName("key")[0]?.textContent || "",
        aka: song.getElementsByTagName("aka")[0]?.textContent || "",
        // key_line: song.getElementsByTagName("key_line")[0]?.textContent || "",
        // linked_songs: song.getElementsByTagName("linked_songs")[0]?.textContent || "",
        time_sig: song.getElementsByTagName("time_sig")[0]?.textContent || "",
        backgrounds: song.getElementsByTagName("backgrounds")[0]?.textContent || ""
    }

    return object
}

export function convertOpenSongBible(data: any[]) {
    data.forEach((bible) => {
        const obj = XMLtoBible(bible.content)
        obj.name = bible.name || ""
        obj.name = formatToFileName(obj.name)

        const id = uid()
        // create folder & file
        scripturesCache.update((a) => {
            a[id] = obj
            return a
        })

        scriptures.update((a) => {
            a[id] = { name: obj.name, id }
            return a
        })

        setActiveScripture(id)
    })
}

function XMLtoBible(xml: string) {
    const parser = new DOMParser()
    // remove first line (standalone attribute): <?xml version="1.0"?>
    xml = xml.split("\n").slice(1, xml.split("\n").length).join("\n")
    const xmlDoc = parser.parseFromString(xml, "text/xml").children[0]

    const booksObj = getChildren(xmlDoc, "b")
    const books: Book[] = []

    ;[...booksObj].forEach((book: any, i: number) => {
        let length = 0
        const name = book.getAttribute("n")
        const number = i + 1
        const chapters: Chapter[] = []

        ;[...getChildren(book, "c")].forEach((chapter: any) => {
            const chapterNumber = chapter.getAttribute("n")
            const verses: Verse[] = []

            ;[...getChildren(chapter, "v")].forEach((verse: any) => {
                const text = verse.innerHTML
                    .toString()
                    .replace(/\[\d+\] /g, "") // remove [1], not [text]
                    .trim()
                length += text.length
                if (text.length) verses.push({ number: verse.getAttribute("n"), text })
            })

            chapters.push({ number: chapterNumber, verses })
        })

        if (length) books.push({ name, number, chapters })
    })

    return { name: "", metadata: { copyright: "" }, books } as Bible
}

const getChildren = (parent: any, name: string) => parent.getElementsByTagName(name)

function HTMLtoObject(content: string) {
    const parser = new DOMParser()
    const html = parser.parseFromString(content, "text/html").children[0]?.querySelector("body")

    // WIP chords

    const divs = content.includes('<div class="heading">')
    content = content.replaceAll('<div class="heading">', '<span class="heading">')
    const slideGroups = content.split('<span class="heading">').slice(1)
    let lyrics = ""
    slideGroups.forEach((group) => {
        const linesEnd = group.lastIndexOf("<br/>")
        const g = group.slice(0, linesEnd)
        const lines = group.indexOf("<table") > -1 ? g.split("<table").slice(1) : g.split('class="lyrics">').slice(1)

        const groupName = group.slice(0, group.indexOf(divs ? "</div>" : "</span>")).trim()
        lyrics += `[${groupName}]\n`

        lines.forEach((line) => {
            const sections = line.indexOf('class="lyrics">') > -1 ? line.split('class="lyrics">').slice(1) : [line]

            sections.forEach((section) => {
                const text = section.slice(0, section.indexOf("</td>"))
                lyrics += text
            })

            lyrics += "\n"
        })

        lyrics = lyrics.trim() + "\n\n"
    })

    lyrics = lyrics.trim()

    const object: Song = {
        title: html?.querySelector("#title")?.textContent || "",
        author: html?.querySelector("#author")?.textContent || "",
        ccli: html?.querySelector("#ccli")?.textContent || "",
        copyright: html?.querySelector("#copyright")?.textContent || "",
        time_sig: html?.querySelector("#time_sig")?.textContent || "",
        lyrics,
        hymn_number: html?.querySelector("#hymn_number")?.textContent || "",
        key: html?.querySelector("#key")?.textContent || "",
        backgrounds: html?.querySelector("#backgrounds")?.textContent || ""
    }

    return object
}
