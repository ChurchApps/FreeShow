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
    let categoryId = createCategory("EasyWorship")

    let songs = data.find((a: any) => a.content.song)?.content.song
    let songsWords = data.find((a: any) => a.content.word)?.content.word
    if (!songsWords) {
        newToast("$toast.no_songswords_easyworship")
        return
    }

    let i = 0
    let importingText = get(dictionary).popup?.importing || "Importing"

    let tempShows: any[] = []

    asyncLoop()
    function asyncLoop() {
        let words: Words = songsWords[i]
        let song: Song | null = songs?.find((a: Song) => a.rowid === words.song_id) || null

        let percentage: string = ((i / songsWords.length) * 100).toFixed()
        activePopup.set("alert")
        alertMessage.set(importingText + " " + i + "/" + songsWords.length + " (" + percentage + "%)" + "<br>" + (song?.title || ""))

        if (get(shows)[song?.song_uid || ""] && i < songsWords.length - 1) {
            i++
            requestAnimationFrame(asyncLoop)
            return
        }

        let layoutID = uid()
        let show = new ShowObj(false, categoryId, layoutID)
        if (song) {
            show.meta = {
                title: song?.title || "",
                author: song.author || "",
                copyright: song.copyright || "",
                CCLI: song.reference_number || "",
            }
        }
        if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

        let { slides, layout }: any = createSlides(words)

        // if (!Object.keys(slides).length || !layout.length) {
        //   console.log("ERROR " + i + ", " + song?.title, songsWords, words, slides)
        // }

        let showId = song?.song_uid || uid()

        show.slides = slides
        show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: song?.description || "", slides: layout } }
        let allText = trimNameFromString(getSlidesText(slides))
        show.name = checkName(song?.title || allText || showId, showId)
        show.settings.template = "default"

        if (allText.length) tempShows.push({ id: showId, show })

        if (i + 1 < songsWords.length) {
            i++
            requestAnimationFrame(asyncLoop)
        } else {
            setTempShows(tempShows)
        }
    }
}

// https://asecuritysite.com/coding/asc2
const replaceCodes: any = {
    "u8211?": "–",
}

function decodeString(input) {
    let regex = /u(\d+)\?/g

    let decodedString = input.replace(regex, (_match, number) => {
        return String.fromCharCode(Number(number))
    })

    return decodedString
}

function createSlides({ words }: Words) {
    let slides: any = {}
    let layout: any[] = []

    // format
    let newSlides: any[] = []
    let lines: any[] = []

    // .replaceAll('"', '\\"')
    words = words.replaceAll("\\", "").replaceAll("\r\n", "")
    let index = words.indexOf("pardli0fi0ri0sb0slsa0") + 22
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
    let splitted = words?.split(splitString)
    // console.log(splitted)
    splitted.forEach((text: any) => {
        // if (text.includes("plainf1fntnamaut")) {
        // let sliced: string = text.slice(text.indexOf("t ") + 2, text.lastIndexOf("par"))
        // <SIDESKIFT>
        // sdewtemplatestyle101
        let sliced: string = text.slice(text.indexOf(" "), text.indexOf("par")).replaceAll("plainf1fntnamaut ", "").trim()

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

    newSlides?.forEach((lines: any) => {
        if (!lines.length) lines = [""]
        if (lines.length) {
            let id: string = uid()
            let group = lines[0]
                .replace(/[0-9:]/g, "")
                .toLowerCase()
                .trim()
            if (get(groups)[group]) {
                // console.log("REMOVE FIRST", lines)
                lines.shift()
            } else {
                let found: boolean = false
                Object.keys(get(groups)).forEach((key) => {
                    let g = get(groups)[key]
                    if (
                        g.default &&
                        get(dictionary)
                            .groups?.[key].replace(/[0-9:]/g, "")
                            .toLowerCase() === group &&
                        !found
                    ) {
                        found = true
                        group = key
                        lines.shift()
                    }
                })
            }

            layout.push({ id })
            let items = [
                {
                    style: "left:50px;top:120px;width:1820px;height:840px;",
                    lines: lines.map((a: any) => ({ align: "", text: [{ style: "", value: a }] })),
                },
            ]
            slides[id] = {
                group: "",
                color: null,
                settings: {},
                notes: "",
                items,
            }

            let globalGroup = getGlobalGroup(group)
            slides[id].globalGroup = globalGroup || "verse"
        }
    })
    // TODO: check for duplicates and create merges

    return { slides, layout }
}
