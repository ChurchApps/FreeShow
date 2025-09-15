import { get } from "svelte/store"
import { uid } from "uid"
import { getSlidesText } from "../components/edit/scripts/textStyle"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { newToast } from "../utils/common"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, dictionary, groups, shows } from "./../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
import { trimNameFromString } from "./txt"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"

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

    const songs = data.find((a: any) => a.content.song)?.content.song
    const songsWords = data.find((a: any) => a.content.word)?.content.word
    if (!songsWords) {
        newToast("toast.no_songswords_easyworship")
        return
    }

    let i = 0
    const importingText = get(dictionary).popup?.importing || "Importing"

    const tempShows: any[] = []

    const songsCount: number = songsWords.length || 0

    asyncLoop()
    function asyncLoop() {
        const words: Words = songsWords[i]
        const song: Song | null = songs?.find((a: Song) => a.rowid === words.song_id) || null

        const percentage: string = ((i / songsCount) * 100).toFixed()
        activePopup.set("alert")
        alertMessage.set(importingText + " " + String(i) + "/" + String(songsCount) + " (" + percentage + "%)" + "<br>" + (song?.title || ""))

        if (get(shows)[song?.song_uid || ""] && i < songsCount - 1) {
            i++
            requestAnimationFrame(asyncLoop)
            return
        }

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
        show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: song?.description || "", slides: layout } }
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

// https://asecuritysite.com/coding/asc2
const replaceCodes: any = {
    "u8211?": "–"
}

function decodeString(input) {
    const regex = /u(\d+)\?/g

    const decodedString = input.replace(regex, (_match, number) => {
        return String.fromCharCode(Number(number))
    })

    return decodedString
}

function createSlides({ words }: Words) {
    const slides: any = {}
    const layout: any[] = []

    // format
    const newSlides: any[] = []
    let lines: any[] = []

    // easyworship2 format not supported

    // .replaceAll('"', '\\"')
    words = words.replaceAll("\\", "").replaceAll("\r\n", "")
    let index = words.indexOf("li0fi0ri0sb0slsa0", words.indexOf("pard")) + 22
    if (index < 22) index = words.indexOf("sdfsauto")
    words = words.slice(index, words.lastIndexOf("}"))
    if (words.charAt(words.length - 2) === "}") words = words.slice(0, words.length - 1)

    // convert ascii decimals to chars
    words = decodeString(words)
    // replace special encoded chars
    Object.keys(replaceCodes).forEach((key) => {
        words = words.replaceAll(key, replaceCodes[key])
    })

    let splitString = "li0fi0ri0sb0slsa0 "
    if (words.indexOf(splitString) < 0) splitString = "sdfsauto"
    const splitted = words?.split(splitString)
    // console.log(splitted)
    splitted.forEach((text: any) => {
        // if (text.includes("plainf1fntnamaut")) {
        // let sliced: string = text.slice(text.indexOf("t ") + 2, text.lastIndexOf("par"))
        // <SIDESKIFT>
        // sdewtemplatestyle101
        const sliced: string = text.slice(text.indexOf(" "), text.indexOf("par")).replaceAll("plainf1fntnamaut ", "").trim()

        // console.log(text.includes("plainf") && sliced.length, sliced)
        if (sliced.length) {
            sliced.split("line").forEach((line: string, i: number) => {
                // \sdewparatemplatestyle102\plain\sdewtemplatestyle102\
                if (line.includes("templatestyle")) return

                // console.log(line, line.slice(line.indexOf(" ") + 1, line.length))
                if (i > 0) line = line.slice(line.indexOf(" ", 2) + 1, line.length)
                let plainIndex = line.indexOf("plainf")
                while (plainIndex > -1) {
                    line = line.slice(0, plainIndex) + line.slice(line.indexOf(" ", plainIndex), line.length)
                    plainIndex = line.indexOf("plainf")
                }

                lines.push(line)
            })
        } else if (text.length) {
            newSlides.push(lines)
            lines = []
        }
    })
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
