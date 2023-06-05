// homepage: https://www.chordpro.org/chordpro/
// docs: https://github.com/martijnversluis/ChordSheetJS

import { uid } from "uid"
import type { Show, Slide } from "../../types/Show"
import { clone } from "../components/helpers/array"
import { ShowObj } from "../classes/Show"
import { checkName } from "../components/helpers/show"
import { history } from "../components/helpers/history"
import { get } from "svelte/store"
import { activeProject } from "../stores"

const metaKeys = ["title", "artist", "composer", "lyricist", "copyright", "year"]
const chorus = ["start_of_chorus", "soc"]
// const verse = ["start_of_verse", "sov"]
// const end = ["end_of_chorus", "eoc", "end_of_verse", "eov"]

const defaultSlide = { group: "", color: "", globalGroup: "verse", settings: {}, notes: "", items: [] }

export function convertChordPro(data: any) {
    data.forEach((file) => {
        let name: string = file.name
        let content = file.content

        let slides: Slide[] = [clone(defaultSlide)]
        let metadata: any = {}
        let notes: string = ""

        content.split("\n").forEach(checkLine)
        function checkLine(line: string) {
            // comment
            if (line[0] === "#") {
                notes += line.slice(2) + "\n"
                return
            }

            // directives
            if (line[0] === "{" && line.includes("}")) {
                // Meta-data
                // {title: Amazing Grace}
                let metaKey = metaKeys.find((a) => line.includes(a + ":"))
                if (metaKey) {
                    if (metaKey === "lyricist") metaKey = "author"
                    metadata[metaKey] = line.slice(line.indexOf(":") + 1, line.indexOf("}")).trim()
                    if (metaKey === "title") name = metadata[metaKey]
                    return
                }

                // Formatting
                // {comment: Chorus}

                // Environment
                let isChorus = chorus.find((a) => line.includes(a))
                if (isChorus) slides[slides.length - 1].globalGroup = "chorus"
                // else slides[slides.length - 1].globalGroup = "verse"

                // Fonts, sizes and colours
                // textfont, textsize, textcolour, chordfont, chordsize, chordcolour

                return
            }

            // section spacing
            if (!line.trim()) {
                if (slides[slides.length - 1].items.length) {
                    slides.push(clone(defaultSlide))
                }

                return
            }

            // lines
            let text: string = ""
            let chords: any[] = []
            let isChord: boolean = false
            line.split("").forEach((char, i) => {
                if (char === "[" || char === "]") {
                    isChord = char === "["
                    if (isChord) chords.push({ id: uid(5), pos: i, key: "" })
                    return
                }

                if (isChord) {
                    chords[chords.length - 1].key += char
                    return
                }

                text += char
            })

            text = text.replaceAll("\r", "")

            let slideItems = slides[slides.length - 1].items
            if (!slideItems.length) slideItems.push({ lines: [], style: "" })
            slideItems[slideItems.length - 1].lines!.push({ align: "", text: [{ value: text, style: "" }], chords })
        }

        createShow({ slides, metadata, name, notes })
    })
}

function createShow({ slides, metadata, name, notes }) {
    let layoutID: string = uid()
    let show: Show = new ShowObj(false, null, layoutID)

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

    history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } })
}

function getLayout(slides: Slide[]) {
    let layout: any[] = slides.map((_) => ({ id: uid() }))

    return layout
}
