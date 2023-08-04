import { get } from "svelte/store"
import { uid } from "uid"
import { history } from "../components/helpers/history"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { newToast } from "../utils/messages"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, dictionary, groups, shows } from "./../stores"
import { createCategory, setTempShows } from "./importHelpers"

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
    // close drawer to prevent loading songs
    // drawer.set({ height: 40, stored: null })

    createCategory("EasyWorship")

    let songs = data.find((a: any) => a.content.song)?.content.song
    let songsWords = data.find((a: any) => a.content.word)?.content.word
    if (!songsWords) {
        newToast("$toast.no_songswords_easyworship")
        return
    }
    // console.log(songsWords)
    // TODO: promise
    let i = 0
    let importingText = get(dictionary)?.popup.importing || "Importing"

    let tempShows: any[] = []

    asyncLoop()
    // songsWords.forEach(asyncLoop);
    // songsWords?.forEach()
    // activePopup.set(null)
    // console.log(songs)
    // console.log(songsWords)

    // function asyncLoop(words: Words, i: number) {
    function asyncLoop() {
        let words: Words = songsWords[i]
        // let song: Song | null = songs?.[words.song_id - 1] || null
        let song: Song | null = songs?.find((a: Song) => a.rowid === words.song_id) || null

        // let song: Song | null = songs?.[i] || null
        let percentage: string = ((i / songsWords.length) * 100).toFixed()
        activePopup.set("alert")
        alertMessage.set(importingText + " " + i + "/" + songsWords.length + " (" + percentage + "%)" + "<br>" + (song?.title || ""))

        if (get(shows)[song?.song_uid || ""] && i < songsWords.length - 1) {
            i++
            requestAnimationFrame(asyncLoop)
            return
        }

        // let category = get(drawerTabsData).shows?.activeSubTab || null
        // if (category === "all" || category === "unlabeled") category = null

        let layoutID = uid()
        let show = new ShowObj(false, "easyworship", layoutID)
        if (song) {
            show.meta = {
                title: song?.title || "",
                author: song.author || "",
                copyright: song.copyright || "",
                CCLI: song.vendor_id || "",
            }
        }

        let { slides, layout }: any = createSlides(words)

        // if (!Object.keys(slides).length || !layout.length) {
        //   console.log("ERROR " + i + ", " + song?.title, songsWords, words, slides)
        // }

        let showId = song?.song_uid || uid()

        show.slides = slides
        show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: song?.description || "", slides: layout } }
        show.name = checkName(song?.title || (Object.values(slides) as any)[0].items[0].lines?.[0].text?.[0].value, showId)
        show.settings.template = "default"

        tempShows.push({ id: showId, show })

        if (i + 1 < songsWords.length) {
            // wait 5 seconds every 100 seconds to catch up ??
            // let nextTimer: number = 0
            // if (i > 0 && i % 100 === 0) nextTimer = 5000
            i++
            // setTimeout(asyncLoop, nextTimer)
            requestAnimationFrame(asyncLoop)
        } else {
            setTempShows(tempShows)
            history({ id: "SHOWS", newData: { data: tempShows }, location: { page: "show" } })
        }
    }
}

// https://www.ascii-code.com/
const replaceCodes: any = {
    "u34?": '"',
    "u39?": "'",
    "u40?": "(",
    "u41?": ")",
    "u58?": ":",
    "u59?": ";",
    "u63?": "?",
    "u96?": "`",
    "u145?": "'",
    "u146?": "'",
    "u147?": '"',
    "u148?": '"',
    "u171?": "«",
    "u187?": "»",
    "u192?": "À",
    "u193?": "Á",
    "u194?": "Â",
    "u195?": "Ã",
    "u196?": "Ä",
    "u197?": "Å",
    "u198?": "Æ",
    "u199?": "Ç",
    "u200?": "È",
    "u201?": "É",
    "u202?": "Ê",
    "u203?": "Ë",
    "u204?": "Ì",
    "u205?": "Í",
    "u206?": "Î",
    "u207?": "Ï",
    "u208?": "Ð",
    "u209?": "Ñ",
    "u210?": "Ò",
    "u211?": "Ó",
    "u212?": "Ô",
    "u213?": "Õ",
    "u214?": "Ö",
    "u216?": "Ø",
    "u217?": "Ù",
    "u218?": "Ú",
    "u219?": "Û",
    "u220?": "Ü",
    "u221?": "Ý",
    "u222?": "Þ",
    "u223?": "ß",
    "u224?": "à",
    "u225?": "á",
    "u226?": "â",
    "u227?": "ã",
    "u228?": "ä",
    "u229?": "å",
    "u230?": "æ",
    "u231?": "ç",
    "u232?": "è",
    "u233?": "é",
    "u234?": "ê",
    "u235?": "ë",
    "u236?": "ì",
    "u237?": "í",
    "u238?": "î",
    "u239?": "ï",
    "u240?": "ð",
    "u241?": "ñ",
    "u242?": "ò",
    "u243?": "ó",
    "u244?": "ô",
    "u245?": "õ",
    "u246?": "ö",
    "u247?": "÷",
    "u248?": "ø",
    "u249?": "ù",
    "u250?": "ú",
    "u251?": "û",
    "u252?": "ü",
    "u253?": "ý",
    "u254?": "þ",
    "u255?": "ÿ",
    "u8211?": "–",
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
                            .groups[key].replace(/[0-9:]/g, "")
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
