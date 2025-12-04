import { get } from "svelte/store"
import { uid } from "uid"
import type { Chords, Item, Line, Show, Slide, SlideData } from "../../../types/Show"
import { activeShow } from "../../stores"
import { createChord } from "../edit/scripts/chords"
import { DEFAULT_ITEM_STYLE } from "../edit/scripts/itemHelpers"
import { getItemText, getSlideText } from "../edit/scripts/textStyle"
import { clone, keysToID, removeDuplicates } from "../helpers/array"
import { history } from "../helpers/history"
import { isEmpty } from "../helpers/output"
import { getGlobalGroup } from "../helpers/show"
import { _show } from "../helpers/shows"
import { VIRTUAL_BREAK_CHAR } from "../../show/slides"

export function formatText(text: string, showId = "") {
    if (!showId) showId = get(activeShow)?.id || ""
    const show: Show = clone(_show(showId).get())
    if (!show) return

    const newSlidesText = text.split("\n\n")

    const slides: Slide[] = newSlidesText.map(getSlide)
    let newSlides: { [key: string]: Slide } = clone(show.slides)

    // sort oldSlides by their children
    const oldSlideParents: Slide[] = keysToID(show.slides).filter(a => a.group)
    const oldSlides: Slide[] = []
    oldSlideParents.forEach(slide => {
        oldSlides.push(slide)
        if (slide.children) {
            // add "missing" text content to parent slide with children text content
            if (!getSlideText(oldSlides[oldSlides.length - 1]).length && slide.children.find(id => getSlideText(show.slides[id]))) {
                oldSlides[oldSlides.length - 1].items.push({ ...clone(defaultItem), lines: [getLine(" ", [])] })
                newSlides[slide.id!] = clone(oldSlides[oldSlides.length - 1])
            }

            slide.children.forEach(childId => {
                oldSlides.push(show.slides[childId])
            })
        }
    })

    const groupedOldSlides = groupSlides(oldSlides)
    const groupedNewSlides = groupSlides(slides)

    let newLayoutSlides: SlideData[] = []

    const doneGroupedSlides: { text: string; slides: Slide[] }[] = []
    groupedNewSlides.forEach(({ text: newText, slides: slidesNew }) => {
        let matchFound = false

        // check matching from existing slides (both old and new)
        ;[...groupedOldSlides, ...doneGroupedSlides].forEach(old => {
            if (matchFound) return
            if (old.text !== newText) return

            matchFound = true

            const id = old.slides[0].id || ""
            newLayoutSlides.push({ id })

            // update slide content
            newSlides[id] = slidesNew.shift()!

            // set children
            if (slidesNew.length) {
                const newChildren: string[] = []
                slidesNew.forEach(slide => {
                    const childId = uid()
                    newChildren.push(childId)
                    newSlides[childId] = slide
                })

                newSlides[id].children = newChildren
            }
        })

        if (matchFound) return
        doneGroupedSlides.push({ text: newText, slides: slidesNew })

        const children: string[] = []
        slidesNew.forEach((_slide, i) => {
            if (i > 0) {
                slidesNew[i].id = uid()
                children.push(slidesNew[i].id!)
            }
        })
        slidesNew[0].id = uid()
        if (children.length) slidesNew[0].children = children

        slidesNew.forEach(slide => {
            newSlides[slide.id || ""] = slide
        })

        newLayoutSlides.push({ id: slidesNew[0].id })
    })

    const oldLayoutSlides = show.layouts[_show(showId).get("settings.activeLayout")].slides
    const oldLayoutSlideIds: string[] = oldLayoutSlides.map(({ id }) => id)

    // add back all slides without text
    const newLayoutSlideIds: string[] = newLayoutSlides.map(({ id }) => id)
    oldLayoutSlideIds.forEach((slideId, i) => {
        if (newLayoutSlideIds.includes(slideId)) return
        const slide = show.slides[slideId]
        if (!slide) return

        const textboxes = getTextboxesIndexes(slide.items)
        if (textboxes.length) return

        const layoutData = { id: slideId }

        if (i < newLayoutSlides.length) {
            newLayoutSlides = [...newLayoutSlides.slice(0, i), layoutData, ...newLayoutSlides.slice(i)]
        } else {
            newLayoutSlides.push(layoutData)
        }
    })

    // add back layout data
    const replacedIds: { [key: string]: string } = {}
    newLayoutSlides.forEach(({ id }, i) => {
        if (!oldLayoutSlides.length) return

        const matchingLayoutIndex = oldLayoutSlides.findIndex(a => a.id === id)
        if (matchingLayoutIndex < 0) {
            const idCommingUp = newLayoutSlides.find((a, index) => index > i && a.id === id)
            if (idCommingUp) return

            const oldLayoutSlide2 = oldLayoutSlides[0]
            const oldSlideChildren: string[] = show.slides[oldLayoutSlide2.id]?.children || []

            // find children data
            if (oldSlideChildren.length) {
                const newChildrenData: { [key: string]: any } = {}
                oldSlideChildren.forEach((oldChildId, childIndex) => {
                    const newChildId = newSlides[id].children?.[childIndex]
                    if (!newChildId) return

                    replacedIds[newChildId] = oldChildId
                    if (oldLayoutSlide2.children?.[oldChildId]) newChildrenData[newChildId] = oldLayoutSlide2.children[oldChildId]
                })
                oldLayoutSlide2.children = newChildrenData
            }

            replacedIds[id] = oldLayoutSlide2.id
            newLayoutSlides[i] = { ...oldLayoutSlide2, id }
            oldLayoutSlides.splice(0, 1)
            return
        }

        const oldLayoutSlide = oldLayoutSlides[matchingLayoutIndex]
        replacedIds[id] = oldLayoutSlide.id
        newLayoutSlides[i] = oldLayoutSlide
        oldLayoutSlides.splice(0, matchingLayoutIndex + 1)
    })

    show.layouts[_show(showId).get("settings.activeLayout")].slides = newLayoutSlides

    // remove replaced slides
    const allOldSlideIds = Object.keys(show.slides)

    let allUsedSlidesIds: string[] = []
    Object.values(show.layouts).forEach(({ slides: layoutSlides }) => {
        allUsedSlidesIds.push(...layoutSlides.map(({ id }) => id))
    })
    allUsedSlidesIds = removeDuplicates(allUsedSlidesIds)

    // remove unused slides that was previously used by current layout
    allOldSlideIds.forEach(slideId => {
        if (oldLayoutSlideIds.includes(slideId) && !allUsedSlidesIds.includes(slideId)) {
            // delete children
            const children = newSlides[slideId].children || []
            children.forEach(childId => {
                delete newSlides[childId]
            })

            delete newSlides[slideId]
        }
    })

    const parentStyles: { [key: string]: string } = {}
    const parentItemAlign: { [key: string]: string } = {}
    const parentAlign: { [key: string]: string } = {}
    Object.keys(newSlides).forEach(slideId => {
        let slide = newSlides[slideId]
        const oldSlideId = replacedIds[slideId] || slideId

        // add back previous textbox styles
        const oldSlide = clone(show.slides[oldSlideId] || {})
        const oldTextboxes = getTextboxes(oldSlide.items || [])

        if (oldTextboxes.length && oldSlideId !== slideId) {
            slide.items.forEach((item, i) => {
                const b = oldTextboxes[i]
                if (!b) return

                if (b.align) item.align = b.align
                if (b.style) item.style = b.style
                ;(item.lines || []).forEach((line, j) => {
                    const c = b.lines?.[j] || b.lines?.[0]
                    if (c?.align) line.align = c?.align

                    // remove customType
                    const filteredText = (c?.text || []).filter(a => !a.customType)
                    if (filteredText[0]?.style && line.text?.[0]) {
                        line.text[0].style = filteredText[0].style

                        // store style for new children
                        if (i === 0 && j === 0) {
                            slide.children?.forEach(id => {
                                parentItemAlign[id] = b.align || ""
                                parentStyles[id] = filteredText[0].style
                                parentAlign[id] = line.align
                            })
                        }
                    }
                })

                // add auto size etc.
                const textboxKeys = ["auto", "actions", "autoFontSize", "bindings", "chords", "textFit"]
                textboxKeys.forEach(key => {
                    if (b[key]) item[key] = b[key]
                })
            })
            // newSlides[slideId].items = slide.items
        } else if (show.slides[slideId]) {
            // add back full old slide including its style
            // only if text content is the same ??
            slide = clone(show.slides[slideId])
            newSlides[slideId] = slide
        } else if (parentStyles[slideId]) {
            // newly split and created slide
            // add same style as parent
            slide.items.forEach(item => {
                item.align = parentItemAlign[slideId]
                item.lines?.forEach(line => {
                    line.align = parentAlign[slideId]
                    line.text?.forEach(txt => {
                        txt.style = parentStyles[slideId]
                    })
                })
            })
        }

        // remove "id" key
        delete slide.id

        // add back old items
        const oldItems = show.slides[oldSlideId]?.items || []
        if (!oldItems.length) return

        let items: Item[] = clone(oldItems)
        const newItems: Item[] = slide.items
        if (newItems.length) {
            // let textboxItemIndex = getFirstNormalTextboxIndex(oldItems)
            const textboxItemIndexes = getTextboxesIndexes(oldItems)
            if (!textboxItemIndexes.length) {
                items = [...removeEmptyTextboxes(oldItems), ...newItems]
            } else {
                textboxItemIndexes
                    .sort((a, b) => b - a)
                    .forEach(index => {
                        // set to default if text has been removed
                        items[index] = newItems.splice(index, 1)[0] || clone(defaultItem)
                    })

                // new items added
                if (newItems.length) {
                    items.push(...newItems)
                    // remove empty items
                    items = items.filter(item => (item.type || "text") !== "text" || getItemText(item).length)
                }
            }
        }

        slide.items = items
        newSlides[slideId] = slide
    })

    // remove first slide if no content
    if (!text && Object.keys(newSlides).length === 1) {
        const textItem = Object.values(newSlides)[0]?.items?.find(a => (a.type || "text") === "text")
        if (textItem) {
            const fullOldSlideText = getItemText(textItem)
            if (!fullOldSlideText) {
                newSlides = {}
                show.layouts[_show(showId).get("settings.activeLayout")].slides = []
            }
        }
    }

    // order slides object based on current layout order
    // this is to ensure correct "Verse 1", "Verse 2" order with multiple layouts
    const newSlidesOrdered: typeof newSlides = {}
    allUsedSlidesIds.forEach(id => {
        newSlidesOrdered[id] = newSlides[id]
    })
    Object.keys(newSlides).forEach(id => {
        if (!newSlidesOrdered[id]) newSlidesOrdered[id] = newSlides[id]
    })

    show.slides = newSlidesOrdered
    // if (!show.settings.template) show.settings.template = "default"

    history({ id: "UPDATE", newData: { data: show }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
}

function getSlide(slideText: string): Slide {
    const slideLines: string[] = slideText.split("\n")
    let group: string | null = null

    const firstLine = slideLines[0]
    const textboxKey = firstLine.match(textboxRegex)
    const firstBracketEnd = firstLine.indexOf("]")
    if (!textboxKey && firstLine.indexOf("[") === 0 && firstBracketEnd === firstLine.trim().length - 1) {
        group = firstLine.slice(firstLine.indexOf("[") + 1, firstLine.indexOf("]"))
        slideLines.splice(0, 1)
    }

    const items: Item[] = linesToTextboxes(slideLines)
    const slide: Slide = { group, color: "", settings: {}, notes: "", items }

    if (group) {
        const globalGroup = getGlobalGroup(group)
        if (globalGroup) slide.globalGroup = globalGroup
    }

    return slide
}

export const defaultItem: Item = { type: "text", lines: [], style: DEFAULT_ITEM_STYLE }
const textboxRegex = /\[#(\d+)(?::([^\]]+))?\]/
export function linesToTextboxes(slideLines: string[]) {
    const items: Item[] = []
    let currentItemIndex = 0

    slideLines.forEach(line => {
        const textboxKey = line.match(textboxRegex)
        if (textboxKey) {
            currentItemIndex = Number(textboxKey[1])
            const language = textboxKey[2]
            if (language) {
                if (!items[currentItemIndex]) items[currentItemIndex] = clone(defaultItem)
                items[currentItemIndex].language = language
            }

            // add content on current line
            line = line.slice(line.indexOf("]") + 1).trim()
            if (!line.length) return
        }

        if (!items[currentItemIndex]) items[currentItemIndex] = clone(defaultItem)

        const lineData = getChords(line)
        items[currentItemIndex].lines!.push(getLine(lineData.text, lineData.chords))
    })

    return items.filter(Boolean).reverse()
}

function getChords(line: string) {
    let text = ""
    const chords: Chords[] = []

    let currentlyInChord = false
    let currentChord = ""

    line.split("").forEach(char => {
        if (char === "[") {
            currentlyInChord = true
            currentChord = ""
            return
        }

        if (!currentlyInChord) {
            text += char
            return
        }

        if (char === "]") {
            currentlyInChord = false
            if (currentChord.length > 12 || `[${currentChord}]` === VIRTUAL_BREAK_CHAR)
                text += `[${currentChord}]` // probably not a chord
            else chords.push(createChord(text.length, currentChord))
            return
        }

        currentChord += char
    })

    return { text, chords }
}

export function getLine(text: string, chords: Chords[]): Line {
    const line: Line = { align: "", text: [{ value: text, style: "font-size: 100px;" }] }
    if (chords.length) line.chords = chords
    return line
}

function groupSlides(slides: Slide[]) {
    const slideGroups: { text: string; slides: Slide[] }[] = []
    let currentIndex = -1

    slides.forEach((slide, i) => {
        if (!slide) return

        if (i === 0 && !slide.group) {
            slide.group = "Verse"
            slide.globalGroup = "verse"
        }
        if (slide.group) currentIndex++
        if (!slideGroups[currentIndex]) slideGroups[currentIndex] = { text: slide.group || "", slides: [] }
        slideGroups[currentIndex].slides.push(slide)

        const textItems = getTextboxes(slide.items)
        if (!textItems.length) return

        // Create chord-position-agnostic fingerprint for slide matching when chords are moved
        const textContent = textItems.reduce((value, item) => (value += getItemText(item)), "")
        const chords = new Set<string>()
        textItems.forEach(item => {
            item.lines?.forEach(line => {
                line.chords?.forEach(chord => {
                    chords.add(chord.key)
                })
            })
        })
        const fullOldSlideText = textContent + Array.from(chords).sort().join("")

        if (!fullOldSlideText) return

        // adding length so line breaks with no text changes works
        const linesLength = textItems.reduce((value, item) => (value += item.lines?.length || 0), 0)
        slideGroups[currentIndex].text += fullOldSlideText + String(linesLength)
    })

    return slideGroups
}

export function getTextboxesIndexes(items: Item[]): number[] {
    const indexes: number[] = []

    items.forEach((item, i) => {
        if (!item?.lines) return

        // add if special (otherwise it's removed on change)
        // let special = isEmptyOrSpecial(item)
        const empty = isEmpty(item)
        if (empty) return

        indexes.push(i)
    })

    return indexes
}

function removeEmptyTextboxes(items: Item[]) {
    return items.filter(item => {
        if ((item.type || "text") !== "text") return true
        return getItemText(item).length
    })
}

export function getTextboxes(items: Item[]) {
    const indexes = getTextboxesIndexes(items)
    return items.filter((_item, i) => indexes.includes(i))
}
