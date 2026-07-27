import { get } from "svelte/store"
import { uid } from "uid"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { getSlidesText } from "../components/edit/scripts/textStyle"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { newToast } from "../utils/common"
import { translateText } from "../utils/language"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, dictionary, groups } from "./../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { trimNameFromString } from "./txt"

interface Song {
    administrator: string
    author: string
    copyright: string
    description: string
    layout_revision: number
    presentation_id: number
    reference_number: string
    revision: number
    rowid: number
    song_item_uid: string
    song_rev_uid: string
    song_uid: string
    tags: string
    title: string
    vendor_id: number
}
interface Words {
    rowid: number
    slide_layout_revisions: null
    slide_revisions: null
    slide_uids: string
    song_id: number
    words: string
}

export function convertEasyWorship(data: any) {
    const categoryId = createCategory("EasyWorship")

    const songs = data?.find((a: any) => a.content?.song)?.content?.song
    const songsWords = data?.find((a: any) => a.content?.word)?.content?.word
    if (!songsWords) {
        newToast("toast.no_songswords_easyworship")
        return
    }

    let i = 0
    const importingText = translateText("popup.importing")

    const tempShows: any[] = []

    const songsCount: number = songsWords.length || 0

    asyncLoop()
    function asyncLoop() {
        const words: Words = songsWords[i]
        const song: Song | null = songs?.find((a: Song) => a.rowid === words.song_id) || null

        const percentage: string = ((i / songsCount) * 100).toFixed()
        activePopup.set("alert")
        alertMessage.set(importingText + " " + String(i) + "/" + String(songsCount) + " (" + percentage + "%)" + "<br>" + (song?.title || ""))

        // skip existing songs
        // if (get(shows)[song?.song_uid || ""] && i < songsCount - 1) {
        //     i++
        //     requestAnimationFrame(asyncLoop)
        //     return
        // }

        const layoutID = uid()
        let show = new ShowObj(false, categoryId, layoutID)
        show.origin = "easyworship"
        if (song) {
            show.meta = {
                title: song?.title || "",
                author: song.author || "",
                copyright: song.copyright || "",
                CCLI: song.reference_number || ""
            }
        }
        if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

        const { slides, layout }: any = createSlides(words)

        // if (!Object.keys(slides).length || !layout.length) {
        //   console.log("ERROR " + i + ", " + song?.title, songsWords, words, slides)
        // }

        const showId = song?.song_uid || uid()

        show.slides = slides
        show.layouts = { [layoutID]: { name: translateText("example.default"), notes: song?.description || "", slides: layout } }
        const allText = trimNameFromString(getSlidesText(slides))
        show.name = checkName(song?.title || allText || showId, showId)
        show.settings.template = "default"

        if (allText.length) tempShows.push({ id: showId, show })

        if (i + 1 < songsCount) {
            i++
            requestAnimationFrame(asyncLoop)
        } else {
            setTempShows(tempShows)
        }
    }
}

function decodeString(input: string) {
    if (!input) return ""

    // 1. Unicode decoding: \u8217? or \u8217 followed by a replacement character
    // RTF uses signed 16-bit integers for \u, so we handle possible negative values too
    const unicodeRegex = /\\u(-?\d+)\??/g
    let decodedString = input.replace(unicodeRegex, (_match, number) => {
        let code = Number(number)
        if (code < 0) code += 65536
        return String.fromCodePoint(code)
    })

    // 2. Hex decoding: \'e5 (common for Latin1 characters in RTF)
    decodedString = decodedString.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
        const byte = parseInt(hex, 16)
        // Try to use latin1 decoder if available, otherwise fallback to fromCharCode
        if (typeof TextDecoder !== "undefined") {
            try {
                return new TextDecoder("windows-1252").decode(Uint8Array.from([byte]))
            } catch (e) {
                return String.fromCharCode(byte)
            }
        }
        return String.fromCharCode(byte)
    })

    return decodedString
}

function cleanRTFTags(text: string) {
    if (!text) return ""

    // 1. Decode unicode escapes BEFORE stripping tags so we don't lose the \u marker
    let decoded = decodeString(text)

    // 2. Remove EasyWorship/RTF groups: {\* ... } or { ... }
    let cleaned = decoded
    let prev
    do {
        prev = cleaned
        cleaned = cleaned.replace(/\{[^{}]*\}/g, " ")
    } while (cleaned !== prev)

    // 3. Remove RTF control words: \f0, \pard, \plain, \sdfsauto, \cf1, etc.
    cleaned = cleaned.replace(/\\[a-z*]+[0-9-]*\s?/gi, " ")

    // 4. Remove any remaining stray braces
    cleaned = cleaned.replace(/[{}]/g, "")

    // 5. Clean up whitespace
    return cleaned.replace(/\s+/g, " ").trim()
}

function createSlides(wordObj: Words) {
    let { words } = wordObj
    const slides: any = {}
    const layout: any[] = []

    const newSlides: any[] = []
    let lines: any[] = []

    // EasyWorship RTF is structured as a series of {\pard ... \par} blocks.
    // Each block contains paragraph metadata and the actual text.

    // 1. extract all paragraph blocks
    const paragraphRegex = /\{\\pard([\s\S]*?)\\par\}/g
    let match

    while ((match = paragraphRegex.exec(words)) !== null) {
        let block = match[1]

        // Remove known EasyWorship markers that shouldn't contribute to text
        if (block.includes("sdslidemarker")) {
            if (lines.length > 0) {
                newSlides.push(lines)
                lines = []
            }
            continue
        }

        const cleanedLine = cleanRTFTags(block)

        if (cleanedLine.length) {
            // Check if this line is a section header (e.g. "Verse 1")
            const globalGroup = getGlobalGroup(cleanedLine)

            if (globalGroup && lines.length > 0) {
                newSlides.push(lines)
                lines = []
            }
            lines.push(cleanedLine)
        }
    }

    if (lines.length) newSlides.push(lines)

    newSlides?.forEach((slideLines: any) => {
        if (!slideLines.length) slideLines = [""]
        if (slideLines.length) {
            const id: string = uid()
            let group = slideLines[0]
                .replace(/[0-9:]/g, "")
                .toLowerCase()
                .trim()
            if (get(groups)[group]) {
                // console.log("REMOVE FIRST", lines)
                slideLines.shift()
            } else {
                let found = false
                Object.keys(get(groups)).forEach((key) => {
                    const g = get(groups)[key]
                    if (
                        g.default &&
                        get(dictionary)
                            .groups?.[key].replace(/[0-9:]/g, "")
                            .toLowerCase() === group &&
                        !found
                    ) {
                        found = true
                        group = key
                        slideLines.shift()
                    }
                })
            }

            layout.push({ id })
            const items = [
                {
                    style: DEFAULT_ITEM_STYLE,
                    lines: slideLines.map((a: any) => ({ align: "", text: [{ style: "", value: a }] }))
                }
            ]
            slides[id] = {
                group: "",
                color: null,
                settings: {},
                notes: "",
                items
            }

            const globalGroup = getGlobalGroup(group)
            slides[id].globalGroup = globalGroup || "verse"
        }
    })
    // TODO: check for duplicates and create merges

    return { slides, layout }
}
