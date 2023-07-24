import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Line } from "../../types/Show"
import { getSlideText } from "../components/edit/scripts/textStyle"
import { changeValues, clone, keysToID, sortObjectNumbers } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { addParents, cloneSlide, getCurrentLayout } from "../components/helpers/layout"
import { addToPos } from "../components/helpers/mover"
import { _show } from "../components/helpers/shows"
import { similarity } from "../converters/txt"
import { activeShow, refreshEditSlide } from "../stores"

// what I want:
// [parent, parent]: change just the parent groups
// [parent, child, parent]: change just the parent groups
// [child]: change child to parent and add group
// [child, child]: change first child to parent and add group
// [child, __, child]: change children to parents and add groups
// [child, __, child, child, __, parent, parent, __ child]

// always change parents groups
// remove children that have a parent selected
// join all other childs and group connecting with a parent and children

// TODO: changing a child to a group, will bug out!!!!

export function changeSlideGroups(obj: any) {
    let ref: any[] = _show().layouts("active").ref()[0]

    // get selected slides in ascending order
    let selectedSlides: number[] = sortObjectNumbers(obj.sel.data, "index").map(({ index }: any) => index)

    let groups: any[] = getConnectedGroups(obj.menu.id, selectedSlides, ref)

    // combine if next to each other
    groups = combineGroups(groups, selectedSlides)

    let newData: any = getCurrentLayout()
    groups = updateChildren(groups)

    let updated = updateValues(groups, newData)
    groups = updated.groups
    newData = updated.newData
    let newParents: any[] = updated.newParents
    console.log(groups)

    // set new children
    groups.forEach(({ slides }) => {
        // remove exising children
        newData.slides[slides[0].id].children = []
        if (slides.length > 1) {
            newData.slides[slides[0].id].children.push(...slides.slice(1, slides.length).map(({ id }: any) => id))
        }
    })

    // add new parents
    newData = addParents(newData, newParents)
    console.log("SLIDES", newData.slides)

    // set child layout data from old parents
    let newLayout: any[] = []
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

            let newChildData = i === 0 ? clone(layoutRef) : clone(layoutRef.children[slideId] || {})
            delete newChildData.id
            delete newChildData.children
            newData.layout[newParentLayoutIndex].children[slideId] = newChildData
        }
    })
    // remove old parents
    newData.layout = newLayout

    // find matches and combine duplicates
    // TODO: combine duplicates

    let activeLayout: string = _show("active").get("settings.activeLayout")
    history({ id: "slide", newData, location: { layout: activeLayout, page: "show", show: get(activeShow)! } })
}

//

function getConnectedGroups(newGroup: string, slides: number[], ref: any[]): any[] {
    // slides next to each other will be one group
    let groups: any[] = [] // { globalGroup: newGroup, slides: [] }
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

function combineGroups(groups: any[], selectedSlides: number[]) {
    let previousSlide: any = {}

    let newGroups: any[] = []
    groups.forEach((group) => {
        let firstSlide = group.slides[0]
        let lastSlide = group.slides[group.slides.length - 1]

        let bothParents = firstSlide.type === "parent" && previousSlide.type === "parent"
        let bothSelected = selectedSlides.includes(firstSlide.layoutIndex) && selectedSlides.includes(previousSlide.layoutIndex)
        if (firstSlide.layoutIndex === previousSlide.layoutIndex + 1 && (bothParents || bothSelected)) newGroups[newGroups.length - 1].slides.push(...group.slides)
        else newGroups.push(group)

        previousSlide = lastSlide
    })

    return newGroups
}

function updateChildren(groups: any[]) {
    groups.forEach(updateGroup)

    function updateGroup({ slides, globalGroup }: any) {
        let newChildren = clone(slides)
            .slice(1)
            .map(({ id }) => id)
        let groups = clone(slides)
        groups[0].children = newChildren
        if (globalGroup) groups[0].globalGroup = globalGroup
    }

    return groups
}

function updateValues(groups: any[], newData: any) {
    let newParents: any[] = []
    let layouts: any[] = _show().layouts("active").get(null, true)
    let activeLayout: string = _show("active").get("settings.activeLayout")

    groups.forEach(({ globalGroup = "", group = "", slides }) => {
        let firstSlideChildren = slides.filter((slide, i) => (i === 0 ? slides[0].id === slide.id : slides[0].children?.includes(slide.id)))
        let hasChanged = slides[0].clone || slides[0].type === "child" || firstSlideChildren.length !== slides.length

        slides.forEach((slide: any, i: number) => {
            // check if there are more slides
            let otherSlides = layouts.find((layout) => {
                let ref = _show("active").layouts([layout.layoutId]).ref()[0]
                return ref.find((lslide: any) => lslide.id === slide.id && (lslide.index !== slide.index || layout.layoutId !== activeLayout || (i === 0 && slide.type === "child")))
            })

            let activeLayoutIndex = layouts.findIndex((a) => a.layoutId === activeLayout)
            let childData = layouts[activeLayoutIndex].slides?.find((a) => a.children?.[slide.id])?.children?.[slide.id] || {}

            let slideId = slide.id
            if (otherSlides && hasChanged) {
                // (hasChanged || slide.type === "child" || slides.length > 1)
                // clone current if it's not exactly the same children
                slideId = uid()
                newData = cloneSlide(newData, slide.id, slideId, i === 0)
                slides[i].id = slideId
                let end: boolean = true

                if (slide.type === "child") {
                    // TODO: this does not work with multiple layouts
                    newParents.push({ id: slideId, data: childData, parent: slide.parent.id, pos: slide.parent.index + (end ? 1 : 0) })
                } else newData.layout[slide.index].id = slideId
            }

            // delete id, it shouldn't be there!
            delete newData.slides[slideId].id

            if (i === 0) {
                // remove old child
                if (slide.type === "child" && !otherSlides) {
                    newData.slides[slide.parent.id].children.splice(newData.slides[slide.parent.id].children.indexOf(slideId), 1)
                    let end: boolean = false
                    newParents.push({ id: slideId, data: childData, parent: slide.parent.id, pos: slide.parent.index + (end ? 1 : 0) })
                }
                // set as parent
                let newValues: any = { group, color: "" }
                if (globalGroup) newValues.globalGroup = globalGroup
                changeValues(newData.slides[slideId], newValues)
            } else {
                // remove old parent
                if (slide.type === "parent") newData.layout[slide.index].remove = true
                // set as child
                changeValues(newData.slides[slideId], { globalGroup: undefined, group: null, color: null }) // color: parent color
            }
        })
    })

    return { newParents, groups, newData }
}

// move

// layout is old and ref is new
export function changeLayout(layout: any, slides: any, ref: any, moved: any, index: number) {
    let newLayout: any[] = []

    // find parent
    if (moved[0].type !== "parent") {
        while (ref[index].type !== "parent" && index > 0) index--
    }

    // TODO: check if parent is moved into its own children, and set first children as group parent
    ref = checkParentMove(ref, moved, index)
    // WIP dont know why these are the same
    layout = ref

    let parent: string = ref[0].id
    let newChildrenOrder: any = {}

    let allChanged: string[] = ref.filter((a, i) => a.layoutIndex !== i).map(({ id }) => id)

    let skip: number[] = []

    ref.forEach((slideRef: any, i: number) => {
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
        newLayout[index].children[slideRef.id] = layout[i].data

        if (skip.includes(slideRef.parent?.layoutIndex)) return
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
    Object.entries(newChildrenOrder).forEach(([id, children]: any) => {
        slides[id].children = [...new Set(children)]

        // find and remove old children (this is already done but wont remove all always)
        Object.keys(slides).forEach((slideId) => {
            if (slideId === id) return
            children.forEach((childId) => {
                if (slides[slideId].children?.length) {
                    let childIndex = slides[slideId].children.indexOf(childId)
                    if (childIndex < 0) return

                    // remove if it includes child from another slide
                    slides[slideId].children.splice(childIndex, 1)
                }
            })
        })
    })

    return { layout: newLayout, slides }
}

// sorry for the complicated code, this function will check if a parent slide is moved over one of it's own children slides,
// and then change itself to be a child and its own child to be a parent
function checkParentMove(ref, moved, index) {
    let dropSlide = ref.find((a) => a.layoutIndex === index)
    if (dropSlide?.type !== "child") return ref

    let moveToIsChildOfMovedParent = moved.find((a) => dropSlide.parent?.id === a.id)
    if (!moveToIsChildOfMovedParent) return ref

    let oldParentId = dropSlide.parent.id
    let oldParentRef = ref.find((a) => a.id === oldParentId)

    if (oldParentRef.layoutIndex >= index) return ref

    // parent moved over child
    let selectedChildrenOfParent = moved.filter((a) => a.type === "child" && a.parent.id === oldParentId).map(({ id }) => id)
    let newChildren: string[] = oldParentRef.children.filter((id) => !selectedChildrenOfParent.includes(id))

    if (!newChildren.length) return ref

    let newParentId = newChildren[0]
    let newParentRef = ref.find((a) => a.id === newParentId)
    newChildren = newChildren.slice(1)
    // newChildren[0] = oldParentId

    let movedToPosId = ref.find((a) => a.layoutIndex === index + 1)?.id
    let movedToPosChildren = newChildren.findIndex((id) => id === movedToPosId) // + 1
    if (movedToPosChildren < 0) movedToPosChildren = newChildren.length
    newChildren = addToPos(newChildren, [oldParentId], movedToPosChildren)

    // remove new parent
    ref = ref.filter((a) => a.layoutIndex !== newParentRef.layoutIndex)

    // new parent shall become parent of new children, and old parent shall become a child!
    let newChildrenRef: any[] = newChildren.map((id) => {
        let childIndex = ref.findIndex((a) => a.id === id && (a.parent?.layoutIndex === oldParentRef.layoutIndex || a.layoutIndex === newParentRef.parent.layoutIndex))

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

function changeParent(slides: any, parentId: any, slideRef: any) {
    let isParent = slideRef.newType ? slideRef.newType === "parent" : slideRef.type === "parent"
    // remove old children
    if (slideRef.type === "child" && slideRef.parent.id !== parentId) slides[slideRef.parent.id].children?.splice(slideRef.index, 1)
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
            slides[parentId].children.push(slideRef.id)
        }
    }

    // remove children array if nothing left
    if (slides[parentId]?.children && !slides[parentId].children.length) delete slides[parentId].children

    // the label defines if a slide is a child or not
    if (slideRef.type === "child" && slideRef.newType === "parent") {
        slides[slideRef.id].group = slides[slideRef.parent.id].group || ""
        if (slides[slideRef.parent.id].globalGroup) slides[slideRef.id].globalGroup = slides[slideRef.parent.id].globalGroup
    } else if (slideRef.newType === "child") slides[slideRef.id].group = null

    return slides
}

/////

export function removeItemValues(items: Item[]) {
    return items.map((item: any) => {
        if (!item.lines?.length) return item

        item.lines = [item.lines[0]]
        item.lines[0].text = [{ style: item.lines[0].text[0]?.style || "", value: "" }]
        return item
    })

    // .filter((a: any) => !a.type || a.type === "text" || a.lines)

    // return items.map(item => {
    //     item.lines?.forEach((line: any, i: number) => {
    //       line.text?.forEach((_text: any, j: number) => {
    //         item.lines![i].text[j].value = ""
    //       })
    //     })
    //   })
}

// merge duplicates
const similarityNum: number = 0.95
export function mergeDuplicateSlides({ slides, layout }) {
    let newSlides: any = {}
    let convertedText: any = {}
    let changedIds: any = {}

    let parentSlides = keysToID(slides).filter((a) => a.group !== null)
    parentSlides.forEach((slide) => {
        let fullSlideText: string = getSlideText(slide)
        slide.children?.forEach((childId) => {
            let childSlide = slides[childId]
            fullSlideText += getSlideText(childSlide)
        })

        let match: false | string = false
        Object.keys(convertedText).forEach((storedSlideId) => {
            if (match) return

            let difference = similarity(fullSlideText, convertedText[storedSlideId])
            if (difference > similarityNum) {
                match = storedSlideId
            }
        })

        if (match) {
            changedIds[slide.id] = match
        } else {
            let slideId = slide.id
            if (fullSlideText.length > 5) convertedText[slideId] = fullSlideText

            delete slide.id
            newSlides[slideId] = slide

            // add children
            slide.children?.forEach((childId) => {
                let childSlide = slides[childId]
                newSlides[childId] = childSlide
            })
        }
    })

    // convert layout
    layout.forEach((layoutSlide, i) => {
        if (changedIds[layoutSlide.id]) {
            layout[i].id = changedIds[layoutSlide.id]

            // move children layout data
            if (layout[i].children) {
                let oldChildren = slides[layoutSlide.id]?.children || []
                let replacedChildren = slides[changedIds[layoutSlide.id]].children || []
                let newChildren: any = {}
                oldChildren.forEach((childId, j) => {
                    let layoutData = layout[i].children[childId]
                    if (!layoutData) return

                    let newChildId = replacedChildren[j]
                    newChildren[newChildId] = layoutData
                })

                layout[i].children = newChildren
            }
        }
    })

    return { slides: newSlides, layout }
}

// split in half
// WIP simular to Editbox.svelte
export function splitItemInTwo(slideRef: any, itemIndex: number, sel: any = []) {
    let lines: Line[] = _show().slides([slideRef.id]).items([itemIndex]).get("lines")[0][0]

    console.log(lines)
    console.log(slideRef)

    // auto find center line
    if (!sel.length) {
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
        line.text?.forEach((text) => {
            currentIndex += text.value.length
            if (sel[i]?.start !== undefined) start = sel[i].start

            if (start > -1 && currentIndex >= start) {
                if (!secondLines.length) secondLines.push({ align: line.align, text: [] })
                let pos = (sel[i]?.start || 0) - textPos
                if (pos > 0)
                    firstLines[firstLines.length - 1].text.push({
                        style: text.style,
                        value: text.value.slice(0, pos),
                    })
                secondLines[secondLines.length - 1].text.push({
                    style: text.style,
                    value: text.value.slice(pos, text.value.length),
                })
            } else {
                firstLines[firstLines.length - 1].text.push({
                    style: text.style,
                    value: text.value,
                })
            }
            textPos += text.value.length
        })

        if (!firstLines.at(-1)?.text.length) firstLines.pop()
    })

    console.log(lines)
    console.log(firstLines)
    console.log(secondLines)

    let defaultLine = [
        {
            align: lines[0].align || "",
            text: [{ style: lines[0].text[0]?.style || "", value: "" }],
        },
    ]
    if (!firstLines.length || !firstLines[0].text.length) firstLines = defaultLine
    if (!secondLines.length) secondLines = defaultLine

    // create new slide
    let newSlide = { ..._show().slides([slideRef.id]).get()[0] }
    newSlide.items[itemIndex].lines = secondLines
    delete newSlide.id
    delete newSlide.globalGroup
    newSlide.group = null
    newSlide.color = null

    // add new slide
    // TODO: history
    let id = uid()
    _show()
        .slides([id])
        .add([clone(newSlide)])
    // newSlide.id = id
    // history({ id: "SLIDES", newData: { data: clone(newSlide) } })

    // update slide
    history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([firstLines]), slides: [slideRef.id], items: [itemIndex] }, location: { page: "none", override: slideRef.id + itemIndex } })

    // set child
    let parentId = slideRef.type === "child" ? slideRef.parent.id : slideRef.id
    let children = _show().slides([parentId]).get("children")[0] || []
    let slideIndex = slideRef.type === "child" ? slideRef.index + 1 : 0
    children = addToPos(children, [id], slideIndex)
    _show().slides([parentId]).set({ key: "children", value: children })

    refreshEditSlide.set(true)
}
