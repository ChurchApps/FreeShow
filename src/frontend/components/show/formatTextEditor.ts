import { uid } from "uid"
import type { Item, Line, Show, Slide, SlideData } from "../../../types/Show"
import { similarity } from "../../converters/txt"
import { getItemText } from "../edit/scripts/textStyle"
import { clone, keysToID } from "../helpers/array"
import { history } from "../helpers/history"
import { getGlobalGroup } from "../helpers/show"
import { _show } from "../helpers/shows"
import { get } from "svelte/store"
import { activeShow } from "../../stores"

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

    let newSlides: { [key: string]: Slide } = clone(show.slides)
    let newLayoutSlides: SlideData[] = []

    let doneGroupedSlides: any[] = []
    groupedNewSlides.forEach(({ text, slides }: any) => {
        let matchFound: boolean = false

        // check matching from existing slides (both old and new)
        ;[...groupedOldSlides, ...doneGroupedSlides].forEach((old: any) => {
            if (matchFound) return
            let similar = similarity(old.text, text)
            if (similar < 1) return

            matchFound = true

            newLayoutSlides.push({ id: old.slides[0].id })
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

    // TODO: children with no text will get removed!!!

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
    newLayoutSlides.forEach(({ id }, i) => {
        if (!oldLayoutSlides.length) return

        let matchingLayoutIndex = oldLayoutSlides.findIndex((a) => a.id === id)
        if (matchingLayoutIndex < 0) {
            let idCommingUp = newLayoutSlides.find((a, index) => index > i && a.id === id)
            if (idCommingUp) return

            let currentStyle = oldLayoutSlides[0]
            let oldSlideChildren: string[] = show.slides[currentStyle.id]?.children || []

            // find children data
            if (currentStyle.children) {
                let newChildrenData: any = {}
                oldSlideChildren.forEach((oldChildId, i) => {
                    let newChildId = newSlides[id].children?.[i]
                    if (!newChildId) return

                    newChildrenData[newChildId] = currentStyle.children[oldChildId]
                })
                currentStyle.children = newChildrenData
            }

            newLayoutSlides[i] = { ...currentStyle, id }
            oldLayoutSlides.splice(0, 1)
            return
        }

        newLayoutSlides[i] = oldLayoutSlides[matchingLayoutIndex]
        oldLayoutSlides.splice(0, matchingLayoutIndex + 1)
    })

    show.layouts[_show().get("settings.activeLayout")].slides = newLayoutSlides

    // remove replaced slides
    let allOldSlideIds = Object.keys(show.slides)

    let allUsedSlidesIds: string[] = []
    Object.values(show.layouts).forEach(({ slides }) => {
        allUsedSlidesIds.push(...slides.map(({ id }) => id))
    })
    allUsedSlidesIds = [...new Set(allUsedSlidesIds)]

    // remove unused slides that was previously used by current layout
    allOldSlideIds.forEach((slideId) => {
        if (oldLayoutSlideIds.includes(slideId) && !allUsedSlidesIds.includes(slideId)) delete newSlides[slideId]
    })

    // remove "id" key
    Object.keys(newSlides).forEach((slideId) => {
        delete newSlides[slideId].id
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

    history({ id: "UPDATE", newData: { data: show }, oldData: { id: get(activeShow)!.id }, location: { page: "show", id: "show_data" } })
}

function getSlide(slideText): Slide {
    let slideLines: string[] = slideText.split("\n")
    let group: any = null

    let firstLine = slideLines[0]
    if (firstLine.indexOf("[") === 0 && firstLine.indexOf("]") >= 0) {
        group = firstLine.slice(firstLine.indexOf("[") + 1, firstLine.indexOf("]"))
        slideLines.splice(0, 1)
    }

    let lines: Line[] = slideLines.map(getLine)
    let item: Item = { type: "text", lines, style: "top:120px;left:50px;height:840px;width:1820px;" }

    let slide: Slide = { group, color: "", settings: {}, notes: "", items: [item] }
    if (group) {
        let globalGroup = getGlobalGroup(group)
        if (globalGroup) slide.globalGroup = globalGroup
    }

    return slide
}

function getLine(text: string): Line {
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

        let firstTextItem = slide.items.find((a) => (a.type || "text") === "text")
        if (!firstTextItem) return

        let fullOldSlideText = getItemText(firstTextItem)
        if (!fullOldSlideText) return

        slideGroups[currentIndex].text += fullOldSlideText
    })

    return slideGroups
}
