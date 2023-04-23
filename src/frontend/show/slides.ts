import { get } from "svelte/store"
import { uid } from "uid"
import type { Item } from "../../types/Show"
import { changeValues, clone, sortObjectNumbers } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { addParents, cloneSlide, getCurrentLayout } from "../components/helpers/layout"
import { _show } from "../components/helpers/shows"
import { activeShow } from "../stores"

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

    let slides: any[] = sortObjectNumbers(obj.sel.data, "index")
    let groups: any[] = getConnectedGroups(obj.menu.id, slides, ref)

    let newData: any = getCurrentLayout()
    groups = updateChildren(groups, ref, newData)

    let updated = updateValues(groups, newData)
    groups = updated.groups
    newData = updated.newData
    let newParents: any[] = updated.newParents

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

    // remove old parents
    newData.layout = newData.layout.filter((a: any) => !a.remove)

    // find matches and combine duplicates
    // TODO: combine duplicates

    let activeLayout: string = _show("active").get("settings.activeLayout")
    history({ id: "slide", newData, location: { layout: activeLayout, page: "show", show: get(activeShow)! } })
}

//

function getConnectedGroups(newGroup: string, slides: any[], ref: any[]): any[] {
    // slides next to each other will be one group
    let groups: any[] = [{ globalGroup: newGroup, slides: [] }]
    let previousIndex: number = -1
    slides.forEach(({ index }: any, i: number) => {
        let slideRef = ref[index]
        if (previousIndex + 1 === index || i === 0) groups[groups.length - 1].slides.push(slideRef)
        else groups.push({ globalGroup: newGroup, slides: [slideRef] })

        previousIndex = index
    })

    return groups
}

function updateChildren(groups: any[], ref: any[], newData: any) {
    groups.forEach(updateGroup)
    function updateGroup({ slides }: any, i: number) {
        const state = {
            isParent: slides[0].type === "parent",
            hasChildren: slides[0].children?.length,
            nextSlideIsChild: slides[0].children?.[0] === slides[1]?.id,
        }

        // add children of parent if not selected
        if (state.isParent && state.hasChildren && !state.nextSlideIsChild) {
            slides.push(...slides[0].children.map((_id: string, i: number) => ref[slides[0].layoutIndex + i + 1]))
            groups[i].slides = clone(slides)
        }

        // find any non selected parents to selected childs or children to parents
        let refs: any[] = slides.filter((slide: any) => !slides.find((checkSlide: any) => checkIfSlideIsChildOfCurrent(slide, checkSlide)))
        function checkIfSlideIsChildOfCurrent(slide: any, checkSlide: any) {
            // if (slide.type !== "child") return false
            // if (checkSlide.id !== slide.parent.id) return newData.slides[slide.id].children.includes(checkSlide.id)
            // return newData.slides[slide.id].children?.length

            // return slide.type === "child" ? checkSlide.id === slide.parent.id : newData.slides[slide.id].children?.length ? newData.slides[slide.id].children.includes(checkSlide.id) : true

            if (slide.type === "child") return checkSlide.id === slide.parent.id
            if (newData.slides[slide.id].children?.length) return newData.slides[slide.id].children.includes(checkSlide.id)
            return true
        }

        console.log(groups)

        // only 1 possible!
        if (!refs.length) return
        console.log("FOUND", refs)

        refs.forEach((slide) => {
            let newSlides: any[] = []

            // get the refs of related slides not selected
            if (slide.type === "child") newSlides = [{ clone: true, ...ref[slide.parent.layoutIndex] }]
            else {
                let slideChildrenWithoutCurrent: any[] = newData.slides[slide.id].children.filter((id: string) => !slides.find((a: any) => a.id === id))
                newSlides = slideChildrenWithoutCurrent.map(getChildRef)
            }
            console.log(newSlides)

            function getChildRef(id: string) {
                let index = newData.slides[slide.id].children.indexOf(id)
                return { type: "child", index, layoutIndex: slide.index + index, id, parent: { id: slide.id, index: slide.index } }
            }

            // let parent = ref[slide.parent.index]
            let s: any = { slides: newSlides }
            let id: string = newSlides[0].parent?.id || newSlides[0].id
            if (newData.slides[id].globalGroup) s.globalGroup = newData.slides[id].globalGroup
            else s.group = newData.slides[id].group
            groups.push(s)

            // TODO: remove old child from the new parent clone
            // newData.layout[slide.index].removeChild = slide.id
        })
    }

    return groups
}

function updateValues(groups: any[], newData: any) {
    let newParents: any[] = []
    let layouts: any[] = _show().layouts("active").get(null, true)
    let activeLayout: string = _show("active").get("settings.activeLayout")

    groups.forEach(({ globalGroup = null, group = "", slides }) => {
        let firstSlideChildren = slides.filter((slide, i) => (i === 0 ? slides[0].id === slide.id : slides[0].children?.includes(slide.id)))
        let hasChanged = slides[0].clone || slides[0].type === "child" || firstSlideChildren.length !== slides.length

        slides.forEach((slide: any, i: number) => {
            // check if there are more slides
            let otherSlides = layouts.find((layout) => {
                let ref = _show("active").layouts([layout.layoutId]).ref()[0]
                return ref.find((lslide: any) => lslide.id === slide.id && (lslide.index !== slide.index || layout.layoutId !== activeLayout || (i === 0 && slide.type === "child")))
            })

            let slideId = slide.id
            if (otherSlides && hasChanged) {
                // (hasChanged || slide.type === "child" || slides.length > 1)
                // clone current if it's not exactly the same children
                slideId = uid()
                newData = cloneSlide(newData, slide.id, slideId, i === 0)
                slides[i].id = slideId
                let end: boolean = true
                if (slide.type === "child") newParents.push({ id: slideId, parent: slide.parent.id, pos: slide.parent.index + (end ? 1 : 0) })
                else newData.layout[slide.index].id = slideId
            }

            // delete id, it shouldn't be there!
            delete newData.slides[slideId].id

            if (i === 0) {
                if (slide.type === "child" && !otherSlides) {
                    newData.slides[slide.parent.id].children.splice(newData.slides[slide.parent.id].children.indexOf(slideId), 1)
                    let end: boolean = false
                    newParents.push({ id: slideId, parent: slide.parent.id, pos: slide.parent.index + (end ? 1 : 0) })
                }
                changeValues(newData.slides[slideId], { globalGroup, group, color: "" })
            } else {
                if (slide.type === "parent") newData.layout[slide.index].remove = true
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

    let parent: string = ref[0].id
    let newChildrenOrder: any = {}

    ref.forEach((slideRef: any, i: number) => {
        let isParent: boolean = slideRef.newType ? slideRef.newType === "parent" : slideRef.type === "parent"

        // set current parent
        if (isParent) parent = slideRef.id
        // update slide children
        slides = changeParent(clone(slides), parent, slideRef)

        console.log(layout[i])
        if (layout[i].data?.color) delete layout[i].data.color

        if (isParent) {
            newLayout.push({ ...layout[i].data, id: slideRef.id })
        } else {
            // update children order
            if (slideRef.layoutIndex !== i) {
                if (!newChildrenOrder[parent]) newChildrenOrder[parent] = []
                newChildrenOrder[parent].push(slideRef.id)
            }

            // set new child data
            let index: number = newLayout.length - 1
            // if (!newLayout[index]) newLayout[index] = {}
            if (!newLayout[index].children) newLayout[index].children = {}
            newLayout[index].children[slideRef.id] = layout[i].data
        }
    })

    // update children order
    Object.entries(newChildrenOrder).forEach(([id, children]: any) => {
        slides[id].children = [...new Set(children)]
    })

    return { layout: newLayout, slides }
}

function changeParent(slides: any, parentId: any, slideRef: any) {
    // remove old children
    if (slideRef.type === "child" && slideRef.parent.id !== parentId) slides[slideRef.parent.id].children?.splice(slideRef.index, 1)
    if (slideRef.newType ? slideRef.newType === "child" : slideRef.type === "child") {
        // // remove children
        // if (slideRef.type === "parent") delete slides[slideRef.id].children
        // add new children
        if (slideRef.id !== parentId && slideRef.parent.id !== parentId) {
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
