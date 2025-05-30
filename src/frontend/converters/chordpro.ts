// homepage: https://www.chordpro.org/chordpro/
// docs: https://github.com/martijnversluis/ChordSheetJS

import { get } from "svelte/store"
import { uid } from "uid"
import type { Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { clone } from "../components/helpers/array"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
import { checkName, getGlobalGroup } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary, drawerTabsData, groups } from "../stores"
import { setTempShows } from "./importHelpers"

const metaKeys = ["number", "title", "artist", "composer", "lyricist", "copyright", "year", "notes", "ccli"]
const chorus = ["start_of_chorus", "soc"]
// const verse = ["start_of_verse", "sov"]
// const end = ["end_of_chorus", "eoc", "end_of_verse", "eov"]

const defaultSlide = { group: "", color: "", globalGroup: "verse", settings: {}, notes: "", items: [] }

export function convertChordPro(data: any) {
    alertMessage.set("popup.importing")
    activePopup.set("alert")

    const tempShows: any[] = []

    setTimeout(() => {
        data.forEach((file) => {
            let name: string = file.name
            const content = file.content

            const slides: Slide[] = [clone(defaultSlide)]
            const metadata: any = {}
            const extraMetadata: string[] = []
            let notes = ""

            let newSection = false
            content.split("\n").forEach(checkLine)
            function checkLine(line: string) {
                if (line.includes("end_of_")) {
                    newSection = true
                    return
                }

                const sectionStart = line.includes("start_of_")
                if (newSection || sectionStart) {
                    newSection = false

                    const trimmed = line.trim()
                    if (trimmed[trimmed.length - 1] === ":" || sectionStart) {
                        // WIP "Bridge (x2):"
                        let group = trimmed.slice(0, -1).replace(/\d+/g, "").trim()
                        group = group.replace("(x)", "").trim()
                        if (sectionStart) group = trimmed.slice(trimmed.lastIndexOf("_") + 1, trimmed.indexOf("}"))

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
                    const isChorus = chorus.find((a) => line.includes(a))
                    if (isChorus) group = "chorus"
                    // else slides[slides.length - 1].globalGroup = "verse"

                    const groupId = group || Object.keys(get(dictionary).groups || {}).find((a) => line.toLowerCase().includes(a.replaceAll("_", "-")))

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
                let text = ""
                const chords: any[] = []
                let isChord = false
                let letterIndex = 0
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

                const slideItems = slides[slides.length - 1].items
                if (!slideItems.length) slideItems.push({ lines: [], style: "inset-inline-start:50px;top:120px;width:1820px;height:840px;" })
                slideItems[slideItems.length - 1].lines!.push({ align: "", text: [{ value: text, style: "" }], chords })
            }

            if (extraMetadata.length) {
                if (notes.length) notes += "\n\n"
                notes += extraMetadata.join("\n")
            }

            const show = createShow({ slides, metadata, name, notes })
            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

function createShow({ slides, metadata, name, notes }) {
    const layoutID: string = uid()
    let category = get(drawerTabsData).shows?.activeSubTab
    if (category === "all" || category === "unlabeled") category = null
    let show = new ShowObj(false, category, layoutID)

    // remove empty slides
    slides = slides.filter((a) => a.items.length)

    const layouts = getLayout(slides)
    const newSlides: any = {}
    layouts.forEach(({ id }, i) => {
        newSlides[id] = slides[i]
    })

    show.name = checkName(name)
    show.slides = newSlides
    show.layouts[layoutID].slides = layouts
    if (notes.trim()) show.layouts[layoutID].notes = notes
    show.meta = metadata
    if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

    // history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } })
    return show
}

function getLayout(slides: Slide[]) {
    const layout: any[] = slides.map(() => ({ id: uid() }))
    return layout
}
