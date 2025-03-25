import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Layout, LayoutRef, Line, Show, Slide, SlideData } from "../../types/Show"
import { getItemText } from "../components/edit/scripts/textStyle"
import { changeValues, clone, removeDuplicates, sortObjectNumbers } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { addParents, cloneSlide, getCurrentLayout } from "../components/helpers/layout"
import { addToPos } from "../components/helpers/mover"
import { _show } from "../components/helpers/shows"
import { activeEdit, activeShow, refreshEditSlide } from "../stores"
import { getLayoutRef } from "../components/helpers/show"

export function changeSlideGroups(obj: { sel: { data: { index: number }[] }; menu: { id: string } }) {
    let ref = getLayoutRef()

    // get selected slides in ascending order
    let selectedSlides: number[] = sortObjectNumbers(obj.sel.data, "index").map(({ index }) => index)

    let groups = getConnectedGroups(obj.menu.id, selectedSlides, ref)

    // combine if next to each other
    groups = combineGroups(groups, selectedSlides)

    let newData = getCurrentLayout()
    groups = updateChildren(groups)

    let updated = updateValues(groups, newData)
    groups = updated.groups
    newData = updated.newData
    let newParents = updated.newParents

    // set new children
    groups.forEach(({ slides }) => {
        // remove exising children
        newData.slides[slides[0].id].children = []
        if (slides.length > 1) {
            newData.slides[slides[0].id].children!.push(...slides.slice(1, slides.length).map(({ id }) => id))
        }
    })

    // add new parents
    newData = addParents(newData, newParents)

    // set child layout data from old parents
    let newLayout: SlideData[] = []
    newData.layout.forEach((layoutRef) => {
        if (!layoutRef.remove) {
            newLayout.push(layoutRef)
            return
        }

        let allNewChildIds = [layoutRef.id, ...Object.keys(layoutRef.children || {})]

        let newParentId = Object.keys(newData.slides).find((id) => newData.slides[id]?.children?.includes(layoutRef.id))
        if (!newParentId) return

        allNewChildIds.forEach(getData)

        function getData(slideId, i) {
            let newParentLayoutIndex = newData.layout.findIndex((a) => a.id === newParentId)
            if (!newData.layout[newParentLayoutIndex].children) newData.layout[newParentLayoutIndex].children = {}

            let newChildData = i === 0 ? clone(layoutRef) : clone(layoutRef.children?.[slideId] || {})
            delete newChildData.id
            delete newChildData.children
            newData.layout[newParentLayoutIndex].children![slideId] = newChildData
        }
    })
    // remove old parents
    newData.layout = newLayout

    // find matches and combine duplicates
    // TODO: combine duplicates (text editor does that)

    let activeLayout: string = _show().get("settings.activeLayout")
    history({ id: "slide", newData, location: { layout: activeLayout, page: "show", show: get(activeShow)! } })
}

//

function getConnectedGroups(newGroup: string, slides: number[], ref: LayoutRef[]) {
    // slides next to each other will be one group
    let groups: { globalGroup: string; slides: LayoutRef[] }[] = [] // { globalGroup: newGroup, slides: [] }
    let parentIndexes = slides.map((index) => ref[index].parent?.layoutIndex ?? index)

    let previousParentIndex = -1
    ref.forEach((slideRef) => {
        let parentIndex = slideRef.parent?.layoutIndex ?? slideRef.layoutIndex
        if (!parentIndexes.includes(parentIndex)) return

        let parentIndexPos = parentIndexes.findIndex((a) => a === parentIndex)
        let selectedIndexWithinGroup = slides[parentIndexPos]

        let globalGroup = ""
        if (slideRef.layoutIndex >= selectedIndexWithinGroup) globalGroup = newGroup
        parentIndex = slideRef.layoutIndex >= selectedIndexWithinGroup ? selectedIndexWithinGroup : parentIndex

        if (parentIndex === previousParentIndex) groups[groups.length - 1].slides.push(slideRef)
        else groups.push({ globalGroup, slides: [slideRef] })

        previousParentIndex = parentIndex
    })

    return groups
}

function combineGroups(groups: { globalGroup: string; slides: LayoutRef[] }[], selectedSlides: number[]) {
    let previousSlide: LayoutRef | null = null

    let newGroups: { globalGroup: string; slides: LayoutRef[] }[] = []
    groups.forEach((group) => {
        let firstSlide = group.slides[0]
        let lastSlide = group.slides[group.slides.length - 1]

        let bothParents = firstSlide.type === "parent" && previousSlide?.type === "parent"
        let bothSelected = selectedSlides.includes(firstSlide.layoutIndex) && selectedSlides.includes(previousSlide?.layoutIndex || -1)
        if (previousSlide && firstSlide.layoutIndex === previousSlide.layoutIndex + 1 && (bothParents || bothSelected)) newGroups[newGroups.length - 1].slides.push(...group.slides)
        else newGroups.push(group)

        previousSlide = lastSlide
    })

    return newGroups
}

function updateChildren(groups: { globalGroup: string; slides: LayoutRef[] }[]) {
    groups.forEach(updateGroup)

    function updateGroup({ slides, globalGroup }) {
        let newChildren = clone(slides)
            .slice(1)
            .map(({ id }) => id)
        let groups = clone(slides)
        groups[0].children = newChildren
        if (globalGroup) groups[0].globalGroup = globalGroup
    }

    return groups
}

function updateValues(groups: { globalGroup: string; slides: LayoutRef[] }[], newData: { slides: { [key: string]: Slide }; layout: SlideData[] }) {
    let newParents: { id: string; data: SlideData; parent: string; pos: number }[] = []
    let layouts: (Layout & { layoutId: string })[] = _show().layouts("active").get(null, true)
    let activeLayout: string = _show().get("settings.activeLayout")

    // , group = ""
    groups.forEach(({ globalGroup = "", slides }) => {
        let firstSlideChildren = slides.filter((slide, i) => (i === 0 ? slides[0].id === slide.id : slides[0].children?.includes(slide.id)))
        let hasChanged = slides[0].clone || slides[0].type === "child" || firstSlideChildren.length !== slides.length

        slides.forEach((slide, i) => {
            let otherSlides = layouts.find((l) => checkIfSlideExistsMorePlaces(l, slide, i))
            let activeLayoutIndex = layouts.findIndex((a) => a.layoutId === activeLayout)
            let childData = layouts[activeLayoutIndex].slides?.find((a) => a.children?.[slide.id])?.children?.[slide.id] || {}

            let slideId = slide.id
            let originalHasChanged = otherSlides && hasChanged
            if (originalHasChanged) cloneOtherSlides()

            // delete id, it shouldn't be there!
            delete newData.slides[slideId].id

            let isFirstSlide = i === 0
            if (isFirstSlide) {
                let oldChildNotInUse = slide.type === "child" && !otherSlides
                if (oldChildNotInUse) removeChild()

                setAsParent()
            } else {
                let wasParent = slide.type === "parent"
                if (wasParent) removeParent()

                setAsChild()
            }

            function cloneOtherSlides() {
                slideId = uid()
                newData = cloneSlide(newData, slide.id, slideId, i === 0)
                slides[i].id = slideId
                let end: boolean = true

                if (slide.type === "child") {
                    // TODO: this does not work with multiple layouts
                    newParents.push({ id: slideId, data: childData, parent: slide.parent!.id, pos: slide.parent!.index + (end ? 1 : 0) })
                    return
                }

                newData.layout[slide.index].id = slideId
            }

            function removeChild() {
                if (!slide.parent) return

                newData.slides[slide.parent.id].children?.splice(newData.slides[slide.parent.id].children!.indexOf(slideId), 1)
                let end: boolean = false
                newParents.push({ id: slideId, data: childData, parent: slide.parent.id, pos: slide.parent.index + (end ? 1 : 0) })
            }

            function removeParent() {
                newData.layout[slide.index].remove = true
            }

            function setAsParent() {
                let newValues: { group: string; color: string; globalGroup?: string } = { group: "", color: "" }
                if (globalGroup) newValues.globalGroup = globalGroup
                changeValues(newData.slides[slideId], newValues)
            }

            function setAsChild() {
                changeValues(newData.slides[slideId], { globalGroup: undefined, group: null, color: null }) // color: parent color
            }
        })
    })

    return { newParents, groups, newData }

    function checkIfSlideExistsMorePlaces(layout, slide, i) {
        let ref = _show().layouts([layout.layoutId]).ref()[0]
        return ref.find((lslide) => lslide.id === slide.id && (lslide.index !== slide.index || layout.layoutId !== activeLayout || (i === 0 && slide.type === "child")))
    }
}

// move

// layout is old and ref is new
export function changeLayout(layout: LayoutRef[], slides: { [key: string]: Slide }, ref: LayoutRef[], moved: LayoutRef[], index: number) {
    let newLayout: (SlideData & { id: string })[] = []

    // find parent
    if (moved[0].type !== "parent") {
        while (ref[index].type !== "parent" && index > 0) index--
    }

    ref = checkParentMove(ref, moved, index)
    // WIP dont know why these are the same
    layout = ref

    let parent: string = ref[0].id
    let newChildrenOrder: { [key: string]: string[] } = {}

    let allChanged: string[] = ref.filter((a, i) => a.layoutIndex !== i).map(({ id }) => id)

    let skip: number[] = []

    ref.forEach((slideRef, i) => {
        let alreadyChanged: boolean = slideRef.layoutIndex === i ? allChanged.includes(slideRef.id) : false
        // if (!alreadyChanged) alreadyChanged = checkChanged(slideRef)

        let isParent: boolean = slideRef.newType ? slideRef.newType === "parent" : slideRef.type === "parent"
        let changedButNotThis = slideRef.newType ? false : ref.find((a) => a.id === slideRef.id && a.layoutIndex !== slideRef.layoutIndex && !a.newType) || true
        let replacesParent = slideRef.newType ? false : ref.find((a) => (a.id === slideRef.id || a.parent?.id === slideRef.id) && a.replacesParent)
        if (!replacesParent) changedButNotThis = false

        if (changedButNotThis) {
            let changedSlide = ref.find((a) => a.id === slideRef.id && a.layoutIndex !== slideRef.layoutIndex && a.newType)
            if (changedSlide) isParent = changedSlide.newType === "parent"
        }

        // set current parent
        if (isParent) parent = slideRef.id
        // update slide children
        if (!changedButNotThis && !alreadyChanged) slides = changeParent(clone(slides), parent, slideRef)

        if (layout[i].data?.color) delete layout[i].data.color

        if (isParent) {
            // // remove old children
            // delete layout[i].data.children
            newLayout.push({ ...layout[i].data, id: slideRef.id })

            return
        }

        // set new child data
        let index: number = newLayout.length - 1
        // if (!newLayout[index]) newLayout[index] = {}
        if (!newLayout[index].children) newLayout[index].children = {}
        newLayout[index].children![slideRef.id] = layout[i].data

        if (skip.includes(slideRef.parent?.layoutIndex ?? -1)) return
        if (changedButNotThis || alreadyChanged) {
            // skip will allow children of the same parent, in other than the first group in layout to be reordered
            if (slideRef.parent) skip.push(slideRef.parent.layoutIndex)
            return
        }

        // update children order
        // let differentSlideButSameId = moved.find((a) => a.id === slideRef.id && a.layoutIndex !== slideRef.layoutIndex)

        if (!newChildrenOrder[parent]) newChildrenOrder[parent] = []
        newChildrenOrder[parent].push(slideRef.id)
    })

    // update children order
    Object.entries(newChildrenOrder).forEach(([id, children]) => {
        slides[id].children = removeDuplicates(children)

        // find and remove old children (this is already done but wont remove all always)
        Object.keys(slides).forEach((slideId) => {
            if (slideId === id) return
            children.forEach((childId) => {
                if (slides[slideId].children?.length) {
                    let childIndex = slides[slideId].children!.indexOf(childId)
                    if (childIndex < 0) return

                    // remove if it includes child from another slide
                    slides[slideId].children!.splice(childIndex, 1)
                }
            })
        })
    })

    return { layout: newLayout, slides }
}

// sorry for the complicated code, this function will check if a parent slide is moved over one of it's own children slides,
// and then change itself to be a child and its own child to be a parent
function checkParentMove(ref: LayoutRef[], moved: LayoutRef[], index: number) {
    let dropSlide = ref.find((a) => a.layoutIndex === index)!
    if (!dropSlide || dropSlide.type !== "child") return ref

    let moveToIsChildOfMovedParent = moved.find((a) => dropSlide.parent?.id === a.id)
    if (!moveToIsChildOfMovedParent) return ref

    let oldParentId = dropSlide.parent?.id || ""
    let oldParentRef = ref.find((a) => a.id === oldParentId)
    if (oldParentRef === undefined) return ref

    if (oldParentRef.layoutIndex >= index) return ref

    // parent moved over child
    let selectedChildrenOfParent = moved.filter((a) => a.type === "child" && a.parent?.id === oldParentId).map(({ id }) => id)
    let newChildren = oldParentRef.children?.filter((id) => !selectedChildrenOfParent.includes(id)) || []

    if (!newChildren.length) return ref

    let newParentId = newChildren[0]
    let newParentRef = ref.find((a) => a.id === newParentId)
    if (newParentRef === undefined) return ref

    newChildren = newChildren.slice(1)
    // newChildren[0] = oldParentId

    let movedToPosId = ref.find((a) => a.layoutIndex === index + 1)?.id
    let movedToPosChildren = newChildren.findIndex((id) => id === movedToPosId) // + 1
    if (movedToPosChildren < 0) movedToPosChildren = newChildren.length
    newChildren = addToPos(newChildren, [oldParentId], movedToPosChildren)

    // remove new parent
    ref = ref.filter((a) => a.layoutIndex !== newParentRef!.layoutIndex)

    // new parent shall become parent of new children, and old parent shall become a child!
    let newChildrenRef = newChildren.map((id) => {
        let childIndex = ref.findIndex((a) => a.id === id && (a.parent?.layoutIndex === oldParentRef!.layoutIndex || a.layoutIndex === newParentRef!.parent?.layoutIndex))

        let newRef = clone(ref[childIndex])
        ref.splice(childIndex, 1)

        if (id === oldParentId) newRef.newType = "child"

        return newRef
    })

    newParentRef.newType = "parent"
    newParentRef.replacesParent = true
    newChildrenRef = [newParentRef, ...newChildrenRef]

    ref = addToPos(ref, newChildrenRef, oldParentRef.layoutIndex)

    return ref
}

function changeParent(slides: { [key: string]: Slide }, parentId: string, slideRef: LayoutRef) {
    let isParent = slideRef.newType ? slideRef.newType === "parent" : slideRef.type === "parent"
    // remove old children
    if (slideRef.type === "child" && slideRef.parent?.id !== parentId) slides[slideRef.parent?.id || ""].children?.splice(slideRef.index, 1)
    if (!isParent) {
        // // remove children
        // if (slideRef.type === "parent") delete slides[slideRef.id].children

        // previously a parent
        if (slideRef.type === "parent") {
            delete slides[slideRef.id].children
            delete slides[slideRef.id].globalGroup
            slides[slideRef.id].group = null
            slides[slideRef.id].color = null
        }

        if (slideRef.id !== parentId && slideRef.parent?.id !== parentId) {
            // add new children
            if (!slides[parentId].children) slides[parentId].children = []
            slides[parentId].children!.push(slideRef.id)
        }
    }

    // remove children array if nothing left
    if (slides[parentId]?.children && !slides[parentId].children!.length) delete slides[parentId].children

    // the label defines if a slide is a child or not
    if (slideRef.type === "child" && slideRef.newType === "parent") {
        slides[slideRef.id].group = slides[slideRef.parent?.id || ""].group || ""
        if (slides[slideRef.parent?.id || ""].globalGroup) slides[slideRef.id].globalGroup = slides[slideRef.parent!.id].globalGroup
    } else if (slideRef.newType === "child") slides[slideRef.id].group = null

    return slides
}

/////

export function removeItemValues(items: Item[]) {
    return items.map((item) => {
        if (!item.lines?.length) return item

        item.lines = [item.lines[0]]
        item.lines[0].text = [{ style: item.lines[0].text[0]?.style || "", value: "" }]
        return item
    })
}

// merge duplicates
// const similarityNum: number = 0.95
// export function mergeDuplicateSlides({ slides, layout }) {
//     let newSlides = {}
//     let convertedText = {}
//     let changedIds = {}

//     let parentSlides = keysToID(slides).filter((a) => a.group !== null)
//     parentSlides.forEach((slide) => {
//         let fullSlideText: string = getSlideText(slide)
//         slide.children?.forEach((childId) => {
//             let childSlide = slides[childId]
//             fullSlideText += getSlideText(childSlide)
//         })

//         let match: false | string = false
//         Object.keys(convertedText).forEach((storedSlideId) => {
//             if (match) return

//             let difference = similarity(fullSlideText, convertedText[storedSlideId])
//             if (difference > similarityNum) {
//                 match = storedSlideId
//             }
//         })

//         if (match) {
//             changedIds[slide.id] = match
//         } else {
//             let slideId = slide.id
//             if (fullSlideText.length > 5) convertedText[slideId] = fullSlideText

//             delete slide.id
//             newSlides[slideId] = slide

//             // add children
//             slide.children?.forEach((childId) => {
//                 let childSlide = slides[childId]
//                 newSlides[childId] = childSlide
//             })
//         }
//     })

//     // convert layout
//     layout.forEach((layoutSlide, i) => {
//         if (changedIds[layoutSlide.id]) {
//             layout[i].id = changedIds[layoutSlide.id]

//             // move children layout data
//             if (layout[i].children) {
//                 let oldChildren = slides[layoutSlide.id]?.children || []
//                 let replacedChildren = slides[changedIds[layoutSlide.id]].children || []
//                 let newChildren = {}
//                 oldChildren.forEach((childId, j) => {
//                     let layoutData = layout[i].children[childId]
//                     if (!layoutData) return

//                     let newChildId = replacedChildren[j]
//                     newChildren[newChildId] = layoutData
//                 })

//                 layout[i].children = newChildren
//             }
//         }
//     })

//     return { slides: newSlides, layout }
// }

// split in half
// WIP simular to Editbox.svelte
export function splitItemInTwo(slideRef: LayoutRef, itemIndex: number, sel: { start?: number; end?: number }[] = [], cutIndex: number = -1) {
    let lines: Line[] = _show().slides([slideRef.id]).items([itemIndex]).get("lines")[0][0]
    lines = lines.filter((a) => a.text?.[0]?.value?.length)

    // if only one line (like scriptures, split by text)
    if (cutIndex === -1 && lines.length === 1 && lines[0]?.text?.length > 1) {
        let newLines: Line[] = []
        let centerTextIndex = Math.ceil(lines[0]?.text?.length / 2)
        if (lines[0]?.text?.[centerTextIndex - 1]?.customType) centerTextIndex++
        newLines.push({ ...lines[0], text: lines[0]?.text.slice(0, centerTextIndex) || [] })
        if (centerTextIndex < lines[0]?.text?.length) newLines.push({ ...lines[0], text: lines[0].text.slice(centerTextIndex) })
        lines = newLines
    }

    // split text content directly in half
    if (cutIndex === -1 && lines.length === 1 && lines[0]?.text?.[0]?.value?.length) {
        // verse number style
        const custom = lines[0].text[0].customType ? lines[0].text.shift() : null

        let text = getItemText({ lines } as Item)
        const [firstHalf, secondHalf] = splitTextContentInHalf(text)
        let newLines: Line[] = []
        // try getting second text first (if customType is first)
        let styling = lines[0].text[1] || lines[0].text[0]
        newLines.push({ ...lines[0], text: [...(custom ? [custom] : []), { ...styling, value: firstHalf }] })
        newLines.push({ ...lines[0], text: [{ ...styling, value: secondHalf }] })

        lines = newLines
    }

    if (lines.length <= 1) return

    if (cutIndex > -1) {
        sel = []
        sel[cutIndex] = { start: 0 }
    } else if (!sel.length) {
        // auto find center line
        // round up to 5 = 3+2
        let centerLineIndex = Math.ceil(lines.length / 2)
        sel[centerLineIndex] = { start: 0 }
    }

    let firstLines: Line[] = []
    let secondLines: Line[] = []

    let currentIndex = 0
    let textPos = 0
    let start = -1

    // split lines in two
    lines.forEach((line, i) => {
        if (start > -1 && currentIndex >= start) secondLines.push({ align: line.align, text: [] })
        else firstLines.push({ align: line.align, text: [] })

        textPos = 0
        line.text?.forEach(splitLines)

        if (!firstLines.at(-1)?.text.length) firstLines.pop()

        function splitLines(text) {
            currentIndex += text.value.length
            if (sel[i]?.start !== undefined) start = sel[i].start!

            if (start < 0 || currentIndex < start) {
                firstLines[firstLines.length - 1].text.push({
                    style: text.style,
                    value: text.value,
                })

                textPos += text.value.length
                return
            }

            if (!secondLines.length) secondLines.push({ align: line.align, text: [] })
            let pos = (sel[i]?.start || 0) - textPos

            if (pos > 0) {
                firstLines[firstLines.length - 1].text.push({
                    style: text.style,
                    value: text.value.slice(0, pos),
                })
            }
            secondLines[secondLines.length - 1].text.push({
                style: text.style,
                value: text.value.slice(0, text.value.length),
            })

            textPos += text.value.length
        }
    })

    let defaultLine = [
        {
            align: lines[0].align || "",
            text: [{ style: lines[0].text[0]?.style || "", value: "" }],
        },
    ]
    if (!firstLines.length || !firstLines[0].text.length) firstLines = defaultLine
    if (!secondLines.length) secondLines = defaultLine

    // add chords
    let chordLines = clone(lines.map((a) => a.chords || []))
    ;[...firstLines, ...secondLines].forEach((line) => {
        let oldLineChords = chordLines.shift()
        if (oldLineChords?.length) line.chords = oldLineChords
    })

    // create new slide
    let newSlide = clone(_show().slides([slideRef.id]).get()[0])
    newSlide.items[itemIndex].lines = secondLines
    delete newSlide.id
    delete newSlide.globalGroup
    newSlide.group = null
    newSlide.color = null

    // add new slide
    let slideId = uid()
    let slides = clone(_show().get("slides"))

    slides[slideId] = newSlide
    slides[slideRef.id].items[itemIndex].lines = firstLines

    // set child
    let parentId = slideRef.type === "child" ? slideRef.parent!.id : slideRef.id
    let children = _show().slides([parentId]).get("children")[0] || []
    let slideIndex = slideRef.type === "child" ? slideRef.index + 1 : 0
    children = addToPos(children, [slideId], slideIndex)
    slides[parentId].children = children

    let showId = get(activeShow)?.id
    history({ id: "UPDATE", newData: { key: "slides", data: clone(slides) }, oldData: { id: showId }, location: { page: "show", id: "show_key", override: "show_slides_" + showId } })

    refreshEditSlide.set(true)
}

function splitTextContentInHalf(text: string) {
    const center = Math.floor(text.length / 2)

    // find split index based on input "./,/!/?" closest to center
    function findSplitIndex(chars) {
        const MARGIN = center / 2
        let index = -1
        for (let i = center - MARGIN; i <= center + MARGIN; i++) {
            if (chars.includes(text[i])) index = i + 1
        }
        return index
    }

    function checkForSpaces(left: boolean = true) {
        let index = -1
        for (let i = center; left ? i >= 0 : i < text.length; i += left ? -1 : 1) {
            if (text[i] === " ") {
                index = i
                break
            }
        }
        return index
    }

    const splitChars = [".", ",", "!", "?"]
    let splitIndex = findSplitIndex(splitChars)

    // split by the closest space if no punctuations matched
    if (splitIndex === -1) {
        let leftIndex = checkForSpaces(true)
        let rightIndex = checkForSpaces(false)

        // get the closest space
        if (leftIndex !== -1 && (rightIndex === -1 || center - leftIndex <= rightIndex - center)) splitIndex = leftIndex
        else splitIndex = rightIndex
    }

    if (splitIndex === -1) return [text]

    const firstHalf = text.slice(0, splitIndex).trim()
    const secondHalf = text.slice(splitIndex).trim()
    return [firstHalf, secondHalf]
}

export function mergeSlides(indexes: { index: number }[]) {
    let layoutRef = getLayoutRef()

    let allMergedSlideIds: string[] = []
    let firstSlideIndex = indexes[0].index
    let firstSlideId: string = layoutRef[firstSlideIndex]?.id
    let newSlide: Slide = clone(_show().slides([firstSlideId]).get()[0])
    let previousTextboxStyles = newSlide.items.filter((a) => (a.type || "text") === "text").map((a) => a.style || "")

    if (newSlide.group === null) {
        newSlide.group = ""
        newSlide.globalGroup = "verse"
    }
    newSlide.items = []
    let pushedItems: string[] = []
    let newLines: Line[][] = []
    let sameTextboxCount =
        new Set(
            indexes.map(({ index }) => {
                let slide: Slide = _show().slides([layoutRef[index]?.id]).get()[0]
                return (slide?.items || []).filter((a) => (a.type || "text") === "text").length
            })
        ).size === 1

    indexes.forEach(({ index }) => {
        let ref = layoutRef[index]
        if (!ref || allMergedSlideIds.includes(ref.id)) return
        allMergedSlideIds.push(ref.id)

        let currentSlide: Slide = _show().slides([ref.id]).get()[0]
        let textItemIndex = 0
        currentSlide.items.forEach((item) => {
            if ((item.type || "text") === "text") {
                let index = sameTextboxCount ? textItemIndex : 0
                if (!newLines[index]) newLines[index] = []
                newLines[index].push(...(item.lines || []))
                textItemIndex++
            } else {
                let uniqueItem = JSON.stringify(item)
                if (pushedItems.includes(uniqueItem)) return

                newSlide.items.push(item)
                pushedItems.push(uniqueItem)
            }
        })
    })

    // add textbox
    newSlide.items = [...getTextItems(), ...newSlide.items]
    function getTextItems() {
        return newLines.map((lines, i) => ({ type: "text", lines, style: previousTextboxStyles[i] }) as Item)
    }

    let newShow: Show = clone(_show().get())
    let activeLayoutId = newShow.settings.activeLayout
    let layoutIndex = layoutRef[firstSlideIndex].index

    // add to layout if child
    if (layoutRef[firstSlideIndex].parent) {
        let slides = newShow.layouts[activeLayoutId].slides
        let parentIndex = layoutRef[firstSlideIndex].parent?.index ?? -1
        layoutIndex = parentIndex + 1
        newShow.layouts[activeLayoutId].slides = [...slides.slice(0, layoutIndex), { id: firstSlideId }, ...slides.slice(layoutIndex)]
    }

    // delete parents child refs
    let firstLayoutIndex = layoutRef[firstSlideIndex].parent?.index ?? layoutRef[firstSlideIndex].index
    indexes.forEach(({ index }) => {
        let ref = layoutRef[index]
        if (!ref.parent) {
            if (firstLayoutIndex > ref.index) layoutIndex--
            return
        }

        let children = newShow.slides[ref.parent.id]?.children || []
        let childIndex = children.indexOf(ref.id)
        if (childIndex < 0) return

        children.splice(childIndex, 1)
        newShow.slides[ref.parent.id].children = children
    })

    // delete layout slides (except for first one)
    let activeLayoutIndex = Object.keys(newShow.layouts).findIndex((id) => id === activeLayoutId)
    Object.values(newShow.layouts).forEach((layout, currentIndex) => {
        layout.slides = layout.slides.filter((a, i) => {
            if (activeLayoutIndex === currentIndex && i === layoutIndex) return true
            return !allMergedSlideIds.includes(a.id)
        })
    })

    // delete slides
    allMergedSlideIds.forEach((id) => {
        // only delete if no children or they are selected!
        let children = newShow.slides[id].children || []
        // return if at least one children is not selected
        if (children.find((childId) => !allMergedSlideIds.includes(childId))) {
            if (id === firstSlideId) {
                newShow.layouts[activeLayoutId].slides.push({ id: firstSlideId })
                layoutIndex = newShow.layouts[activeLayoutId].slides.length - 1
                // remove extra children
                delete newSlide.children
            }
            return
        }

        delete newShow.slides[id]
    })

    // add new slide
    delete newSlide.id // delete old id if it's there
    let newSlideId = uid()
    newShow.slides[newSlideId] = newSlide
    if (!newShow.layouts[newShow.settings.activeLayout].slides[layoutIndex]) return // something went wrong!
    newShow.layouts[newShow.settings.activeLayout].slides[layoutIndex].id = newSlideId

    history({ id: "UPDATE", newData: { data: newShow }, oldData: { id: get(activeShow)?.id }, location: { page: "show", id: "show_key" } }) // , override: "merge_slides"
}

export function mergeTextboxes(customSlideIndex: number = -1) {
    let editSlideIndex: number = customSlideIndex < 0 ? (get(activeEdit).slide ?? -1) : customSlideIndex
    if (editSlideIndex < 0) return

    let slideRef = getLayoutRef()[editSlideIndex] || {}
    let slide: Slide = clone(
        _show()
            .slides([slideRef.id || ""])
            .get()[0]
    )
    if (!slide) return

    let selected = get(activeEdit).items
    if (!selected.length) selected = slide.items.map((_, i) => i)
    let selectedItems = slide.items.filter((a, i) => selected.includes(i) && (a.type || "text") === "text")
    if (selectedItems.length < 2) return

    // add all lines into one
    let newLines: Line[] = []
    selectedItems.forEach((item) => {
        newLines.push(...(item.lines || []))
    })

    // create new textbox
    let newTextbox: Item = clone(selectedItems[0])
    newTextbox.lines = newLines

    // set new item & remove old ones
    slide.items[selected.shift()!] = newTextbox
    selected.forEach((i) => {
        slide.items.splice(i, 1)
    })

    // update
    history({ id: "UPDATE", newData: { data: slide, key: "slides", keys: [slideRef.id] }, oldData: { id: get(activeShow)?.id }, location: { page: "edit", id: "show_key" } })
}
