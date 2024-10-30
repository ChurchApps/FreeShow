// homepage: https://www.chordpro.org/chordpro/
// docs: https://github.com/martijnversluis/ChordSheetJS

import { uid } from "uid"
import type { Show, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { clone } from "../components/helpers/array"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary, drawerTabsData, groups } from "../stores"
import { setTempShows } from "./importHelpers"
import { get } from "svelte/store"

const metaKeys = ["number", "title", "artist", "composer", "lyricist", "copyright", "year", "notes", "ccli"]
const chorus = ["start_of_chorus", "soc"]
// const verse = ["start_of_verse", "sov"]
// const end = ["end_of_chorus", "eoc", "end_of_verse", "eov"]

const defaultSlide = { group: "", color: "", globalGroup: "verse", settings: {}, notes: "", items: [] }

export function convertChordPro(data: any) {
    alertMessage.set("popup.importing")
    activePopup.set("alert")

    let tempShows: any[] = []

    setTimeout(() => {
        data.forEach((file) => {
            let name: string = file.name
            let content = file.content

            let slides: Slide[] = [clone(defaultSlide)]
            let metadata: any = {}
            let extraMetadata: string[] = []
            let notes: string = ""

            let newSection: boolean = false
            content.split("\n").forEach(checkLine)
            function checkLine(line: string) {
                if (newSection) {
                    newSection = false

                    let trimmed = line.trim()
                    if (trimmed[trimmed.length - 1] === ":") {
                        // WIP "Bridge (x2):"
                        let group = trimmed.slice(0, -1).replace(/\d+/g, "").trim()
                        group = group.replace("(x)", "").trim()
                        let globalGroup = getGlobalGroup(group)

                        if (globalGroup) slides[slides.length - 1].globalGroup = globalGroup
                        else delete slides[slides.length - 1].globalGroup

                        if (!get(groups)[globalGroup]) globalGroup = ""
                        slides[slides.length - 1].group = globalGroup || group
                        return
                    }
                }

                // comment
                if (line[0] === "#") {
                    notes += line.slice(2) + "\n"
                    return
                }

                // directives
                // Meta-data
                // {title: Amazing Grace}
                // Title: 10,000 Reasons (Bless the Lord)
                if (line.includes(":")) {
                    let metaKey = metaKeys.find((a) => line.toLowerCase().includes(a + ":"))
                    if (metaKey) {
                        if (metaKey === "lyricist") metaKey = "author"
                        if (metaKey === "ccli") metaKey = "CCLI"
                        metadata[metaKey] = line.slice(line.indexOf(":") + 1).trim()
                        metadata[metaKey] = metadata[metaKey].replaceAll("}", "")

                        if (metaKey === "notes") {
                            notes = metadata[metaKey]
                            delete metadata[metaKey]
                        }
                        if (metaKey === "title") name = metadata[metaKey]
                        return
                    }

                    if (line.includes("{") && line.includes(":")) {
                        extraMetadata.push(line.replace("{", "").replace("}", ""))
                        return
                    }

                    // Formatting
                    // {comment: Chorus}

                    // Environment
                    let group = ""
                    let isChorus = chorus.find((a) => line.includes(a))
                    if (isChorus) group = "chorus"
                    // else slides[slides.length - 1].globalGroup = "verse"

                    let groupId = group || Object.keys(get(dictionary).groups || {}).find((a) => line.toLowerCase().includes(a.replaceAll("_", "-")))

                    if (groupId) {
                        slides[slides.length - 1].globalGroup = groupId
                        return
                    }

                    // Fonts, sizes and colours
                    // textfont, textsize, textcolour, chordfont, chordsize, chordcolour
                }

                // section spacing
                if (!line.trim()) {
                    if (slides[slides.length - 1].items.length) {
                        slides.push(clone(defaultSlide))
                        newSection = true
                    }

                    return
                }

                // lines
                let text: string = ""
                let chords: any[] = []
                let isChord: boolean = false
                let letterIndex: number = 0
                line.split("").forEach((char) => {
                    if ((char === "[" || char === "]") && !line.slice(0, -2).includes(":")) {
                        isChord = char === "["
                        if (isChord) chords.push({ id: uid(5), pos: letterIndex, key: "" })
                        return
                    }

                    if (isChord) {
                        chords[chords.length - 1].key += char
                        return
                    }

                    text += char
                    letterIndex++
                })

                text = text.replaceAll("\r", "")

                let slideItems = slides[slides.length - 1].items
                if (!slideItems.length) slideItems.push({ lines: [], style: "left:50px;top:120px;width:1820px;height:840px;" })
                slideItems[slideItems.length - 1].lines!.push({ align: "", text: [{ value: text, style: "" }], chords })
            }

            if (extraMetadata.length) {
                if (notes.length) notes += "\n\n"
                notes += extraMetadata.join("\n")
            }

            let show = createShow({ slides, metadata, name, notes })
            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

function createShow({ slides, metadata, name, notes }) {
    let layoutID: string = uid()
    let category = get(drawerTabsData).shows?.activeSubTab
    if (category === "all" || category === "unlabeled") category = null
    let show: Show = new ShowObj(false, category, layoutID)

    // remove empty slides
    slides = slides.filter((a) => a.items.length)

    let layouts = getLayout(slides)
    let newSlides: any = {}
    layouts.forEach(({ id }, i) => {
        newSlides[id] = slides[i]
    })

    show.name = checkName(name)
    show.slides = newSlides
    show.layouts[layoutID].slides = layouts
    if (notes.trim()) show.layouts[layoutID].notes = notes
    show.meta = metadata

    // history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } })
    return show
}

function getLayout(slides: Slide[]) {
    let layout: any[] = slides.map((_) => ({ id: uid() }))

    return layout
}
