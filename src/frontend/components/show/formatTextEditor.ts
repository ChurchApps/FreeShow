import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Line, Show, Slide, SlideData } from "../../../types/Show"
import { activeShow } from "../../stores"
import { getItemText } from "../edit/scripts/textStyle"
import { clone, keysToID, removeDuplicates } from "../helpers/array"
import { history } from "../helpers/history"
import { isEmptyOrSpecial } from "../helpers/output"
import { getGlobalGroup } from "../helpers/show"
import { _show } from "../helpers/shows"

export function formatText(e: any) {
    let newSlidesText = e.detail.split("\n\n")

    let show: Show = clone(_show().get())
    let slides: Slide[] = newSlidesText.map(getSlide)

    // sort oldSlides by their children
    let oldSlideParents: Slide[] = keysToID(show.slides).filter((a) => a.group)
    let oldSlides: Slide[] = []
    oldSlideParents.forEach((slide) => {
        oldSlides.push(slide)
        slide.children?.forEach((childId) => {
            oldSlides.push(show.slides[childId])
        })
    })

    let groupedOldSlides = groupSlides(oldSlides)
    let groupedNewSlides = groupSlides(slides)

    // TODO: renaming existing groups!

    let newSlides: { [key: string]: Slide } = clone(show.slides)
    let newLayoutSlides: SlideData[] = []

    let doneGroupedSlides: any[] = []
    groupedNewSlides.forEach(({ text, slides }: any) => {
        let matchFound: boolean = false

        // check matching from existing slides (both old and new)
        ;[...groupedOldSlides, ...doneGroupedSlides].forEach((old: any) => {
            if (matchFound) return
            if (old.text !== text) return

            matchFound = true

            let id = old.slides[0].id
            newLayoutSlides.push({ id })

            // set changed children
            if (old.slides.length !== slides.length) {
                newSlides[id] = slides.shift()

                if (slides.length) {
                    // children
                    let children: string[] = []
                    slides.forEach((slide) => {
                        let childId = uid()
                        children.push(childId)
                        newSlides[childId] = slide
                    })

                    newSlides[id].children = children
                }
            }
        })

        if (matchFound) return
        doneGroupedSlides.push({ text, slides })

        let children: string[] = []
        slides.forEach((_slide, i) => {
            if (i > 0) {
                slides[i].id = uid()
                children.push(slides[i].id)
            }
        })
        slides[0].id = uid()
        if (children.length) slides[0].children = children

        slides.forEach((slide) => {
            newSlides[slide.id] = slide
        })

        newLayoutSlides.push({ id: slides[0].id })
    })

    let oldLayoutSlides = show.layouts[_show().get("settings.activeLayout")].slides
    let oldLayoutSlideIds: string[] = oldLayoutSlides.map(({ id }) => id)

    // add back all slides without text
    let newLayoutSlideIds: string[] = newLayoutSlides.map(({ id }) => id)
    oldLayoutSlideIds.forEach((slideId) => {
        if (newLayoutSlideIds.includes(slideId)) return
        let slide = show.slides[slideId]

        let textItem = slide.items.find((a) => (a.type || "text") === "text")
        if (textItem) return

        newLayoutSlides.push({ id: slideId })
    })

    // add back layout data
    let replacedIds: any = {}
    newLayoutSlides.forEach(({ id }, i) => {
        if (!oldLayoutSlides.length) return

        let matchingLayoutIndex = oldLayoutSlides.findIndex((a) => a.id === id)
        if (matchingLayoutIndex < 0) {
            let idCommingUp = newLayoutSlides.find((a, index) => index > i && a.id === id)
            if (idCommingUp) return

            let oldLayoutSlide = oldLayoutSlides[0]
            let oldSlideChildren: string[] = show.slides[oldLayoutSlide.id]?.children || []

            // find children data
            if (oldLayoutSlide.children) {
                let newChildrenData: any = {}
                oldSlideChildren.forEach((oldChildId, i) => {
                    let newChildId = newSlides[id].children?.[i]
                    if (!newChildId) return

                    replacedIds[newChildId] = oldChildId
                    newChildrenData[newChildId] = oldLayoutSlide.children[oldChildId]
                })
                oldLayoutSlide.children = newChildrenData
            }

            replacedIds[id] = oldLayoutSlide.id
            newLayoutSlides[i] = { ...oldLayoutSlide, id }
            oldLayoutSlides.splice(0, 1)
            return
        }

        let oldLayoutSlide = oldLayoutSlides[matchingLayoutIndex]
        replacedIds[id] = oldLayoutSlide.id
        newLayoutSlides[i] = oldLayoutSlide
        oldLayoutSlides.splice(0, matchingLayoutIndex + 1)
    })

    show.layouts[_show().get("settings.activeLayout")].slides = newLayoutSlides

    // remove replaced slides
    let allOldSlideIds = Object.keys(show.slides)

    let allUsedSlidesIds: string[] = []
    Object.values(show.layouts).forEach(({ slides }) => {
        allUsedSlidesIds.push(...slides.map(({ id }) => id))
    })
    allUsedSlidesIds = removeDuplicates(allUsedSlidesIds)

    // remove unused slides that was previously used by current layout
    allOldSlideIds.forEach((slideId) => {
        if (oldLayoutSlideIds.includes(slideId) && !allUsedSlidesIds.includes(slideId)) {
            // delete children
            let children = newSlides[slideId].children || []
            children.forEach((childId) => {
                delete newSlides[childId]
            })

            delete newSlides[slideId]
        }
    })

    Object.keys(newSlides).forEach((slideId) => {
        let slide = newSlides[slideId]

        // remove "id" key
        delete slide.id

        // add back old items
        let oldSlideId = replacedIds[slideId] || slideId
        let oldItems = show.slides[oldSlideId]?.items || []
        if (!oldItems.length) return

        let items: Item[] = clone(oldItems)
        let newItems: Item[] = slide.items
        if (newItems.length) {
            // let textboxItemIndex = getFirstNormalTextboxIndex(oldItems)
            let textboxItemIndexes = getTextboxesIndexes(oldItems)
            if (!textboxItemIndexes.length) items.push(...newItems)
            else {
                textboxItemIndexes.forEach((index) => {
                    // set to default if text has been removed
                    items[index] = newItems.splice(index, 1)[0] || clone(defaultItem)
                })

                // new items added
                if (newItems.length) {
                    items.push(...newItems)
                    // remove empty items
                    items = items.filter((item) => getItemText(item).length)
                }
            }
        }

        slide.items = items
        newSlides[slideId] = slide
    })

    // remove first slide if no content
    if (!e.detail && Object.keys(newSlides).length === 1) {
        let textItem = Object.values(newSlides)[0].items.find((a) => (a.type || "text") === "text")
        if (textItem) {
            let fullOldSlideText = getItemText(textItem)
            if (!fullOldSlideText) {
                newSlides = {}
                show.layouts[_show().get("settings.activeLayout")].slides = []
            }
        }
    }

    show.slides = newSlides
    if (!show.settings.template) show.settings.template = "default"

    history({ id: "UPDATE", newData: { data: show }, oldData: { id: get(activeShow)!.id }, location: { page: "show", id: "show_key" } })
}

function getSlide(slideText): Slide {
    let slideLines: string[] = slideText.split("\n")
    let group: any = null

    let firstLine = slideLines[0]
    if (firstLine.indexOf("[") === 0 && firstLine.indexOf("]") >= 0) {
        group = firstLine.slice(firstLine.indexOf("[") + 1, firstLine.indexOf("]"))
        slideLines.splice(0, 1)
    }

    let items: Item[] = linesToTextboxes(slideLines)
    let slide: Slide = { group, color: "", settings: {}, notes: "", items }

    if (group) {
        let globalGroup = getGlobalGroup(group)
        if (globalGroup) slide.globalGroup = globalGroup
    }

    return slide
}

export const defaultItem: Item = { type: "text", lines: [], style: "top:120px;left:50px;height:840px;width:1820px;" }
const textboxRegex = /\[#\d*]/
export function linesToTextboxes(slideLines: string[]) {
    let items: Item[] = []
    let currentItemIndex: number = 0

    slideLines.forEach((line) => {
        let textboxKey = line.match(textboxRegex)?.[0]
        if (textboxKey) {
            let keyIndex = textboxKey.slice(textboxKey.indexOf("#") + 1, textboxKey.indexOf("]"))
            currentItemIndex = Number(keyIndex)
            // if (textboxKey === "[#1]") currentItemIndex = 0
            // else currentItemIndex++

            // add content on current line
            line = line.slice(line.indexOf("]") + 1).trim()
            if (!line.length) return
        }

        if (!items[currentItemIndex]) items[currentItemIndex] = clone(defaultItem)
        items[currentItemIndex].lines!.push(getLine(line))
    })

    return items
}

export function getLine(text: string): Line {
    return { align: "", text: [{ value: text, style: "font-size: 100px;" }] }
}

function groupSlides(slides: Slide[]) {
    let slideGroups: any[] = []
    let currentIndex: number = -1

    slides.forEach((slide, i) => {
        if (i === 0 && !slide.group) {
            slide.group = "Verse"
            slide.globalGroup = "verse"
        }
        if (slide.group) currentIndex++
        if (!slideGroups[currentIndex]) slideGroups[currentIndex] = { text: "", slides: [] }
        slideGroups[currentIndex].slides.push(slide)

        let textItems = getTextboxes(slide.items)
        if (!textItems.length) return

        let fullOldSlideText = textItems.reduce((value, item) => (value += getItemText(item)), "")
        if (!fullOldSlideText) return

        // adding length so line breaks with no text changes works
        let linesLength = textItems.reduce((value, item) => (value += item.lines?.length || 0), 0)
        slideGroups[currentIndex].text += fullOldSlideText + linesLength
    })

    return slideGroups
}

export function getTextboxesIndexes(items: Item[]): number[] {
    let indexes: number[] = []

    items.forEach((item, i) => {
        if (!item?.lines) return

        let special = isEmptyOrSpecial(item)
        if (special) return

        indexes.push(i)
    })

    return indexes
}

export function getTextboxes(items: Item[]) {
    let indexes = getTextboxesIndexes(items)
    return items.filter((_item, i) => indexes.includes(i))
}
