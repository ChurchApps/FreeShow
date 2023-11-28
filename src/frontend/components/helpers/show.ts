import { get } from "svelte/store"
import type { Show, ShowList, Shows, Slide } from "../../../types/Show"
import { activeShow, cachedShowsData, dictionary, groupNumbers, groups, shows, showsCache, sorted, sortedShowsList, stageShows } from "../../stores"
import { clone, keysToID, removeValues, sortObject } from "./array"
import { GetLayout } from "./get"

// check if name exists and add number
export function checkName(name: string = "", showId: string = "") {
    name = formatToFileName(name)

    let number = 1
    while (Object.entries(get(shows)).find(([id, a]: any) => (!showId || showId !== id) && a.name.toLowerCase() === (number > 1 ? name.toLowerCase() + " " + number : name.toLowerCase()))) number++

    return number > 1 ? name + " " + number : name
}

export function formatToFileName(name: string = "") {
    // remove illegal file name characters
    name = name.trim().replace(/[/\\?%*:|"<>╠ê╠è]/g, "")
    // max 255 length
    if (name.length > 255) name = name.slice(0, 255)

    return name
}

// convert any text to a label id format
export function getLabelId(label: string) {
    // TODO: disallow chars in labels: #:;!.,- ??
    return label
        .toLowerCase()
        .replace(/x[0-9]/g, "")
        .replace(/[[\]]/g, "")
        .replace(/[0-9'":]/g, "")
        .trim()
        .replaceAll(" ", "_")
        .replaceAll("-", "_")
    // .replace(/[0-9-]/g, "")
}

// check if label exists as a global label
export function getGlobalGroup(group: string, returnInputIfNull: boolean = false): string {
    group = getLabelId(group)

    if (get(groups)[group]) return group

    let globalGroup: any = ""
    Object.entries(get(dictionary).groups).forEach(([groupId, name]) => {
        if (name.toLowerCase() === group) globalGroup = groupId
    })
    return globalGroup || (returnInputIfNull ? group : "")
}

// mirror & events
export function getListOfShows(removeCurrent: boolean = false) {
    let list: any[] = Object.entries(get(shows)).map(([id, show]: any) => ({ id, name: show.name }))
    if (removeCurrent) list = list.filter((a) => a.id !== get(activeShow)?.id)
    list = list.sort((a, b) => a.name?.localeCompare(b.name))
    return list
}

export function getStageList() {
    return Object.entries(clone(get(stageShows))).map(([id, stage]: any) => ({ id, name: stage.name }))
}

// meta
export function initializeMetadata({ title = "", artist = "", author = "", composer = "", publisher = "", copyright = "", CCLI = "", year = "" }) {
    return { title, artist, author, composer, publisher, copyright, CCLI, year }
}

// create new slides
export function newSlide(data: any): Slide {
    return {
        group: null,
        color: null,
        settings: {},
        notes: "",
        items: [],
        ...data,
    }
}

// update list for drawer
export function updateShowsList(shows: Shows) {
    // sort shows in alphabeticly order & remove private shows
    let showsList = keysToID(shows)

    let sortType = get(sorted).shows?.type || "name"
    // sort by name regardless if many shows have the same date
    let sortedShows: any[] = sortObject(showsList, "name")
    if (sortType === "created") {
        sortedShows = showsList.sort((a, b) => b.timestamps?.created - a.timestamps?.created)
    } else if (sortType === "modified") {
        sortedShows = showsList.sort((a, b) => (b.timestamps?.modified || b.timestamps?.created) - (a.timestamps?.modified || a.timestamps?.created))
    } else if (sortType === "used") {
        sortedShows = showsList.sort((a, b) => (b.timestamps?.used || b.timestamps?.created) - (a.timestamps?.used || a.timestamps?.created))
    }

    let filteredShows: ShowList[] = removeValues(sortedShows, "private", true)
    sortedShowsList.set(filteredShows)
}

// update cached shows
export function updateCachedShows(shows: Shows) {
    let cachedShows = {}
    Object.entries(shows).forEach(([id, show]) => {
        cachedShows[id] = updateCachedShow(id, show)
    })
    cachedShowsData.set(cachedShows)
}

// update cached show
export function updateCachedShow(id: string, show: Show) {
    // WIP looped many times when show not loading
    // console.log(id, show)
    if (!show) return

    let layout = GetLayout(id)
    // $: activeLayout = $showsCache[$activeShow!.id]?.settings?.activeLayout
    // let layout = _show(id).layouts(activeLayout).ref()[0]

    let endIndex = -1
    if (layout.length) {
        let lastEnabledSlide: number = layout.findIndex((a) => a.end === true && a.disabled !== true)
        if (lastEnabledSlide >= 0) endIndex = lastEnabledSlide
    }

    let template = {
        id: show.settings?.template,
        slidesUpdated: cachedShowsData[id]?.template?.slidesUpdated || false,
    }

    // create groups
    let showSlides = clone(show.slides || {})
    let addedGroups: any = {}
    let showGroups: any[] = Object.entries(showSlides).map(createGroups)
    function createGroups([slideId, slide]) {
        // update if global group
        if (slide.globalGroup && get(groups)[slide.globalGroup]) {
            let oldGroup = clone({ group: slide.group, color: slide.color })

            slide.group = get(groups)[slide.globalGroup].name
            // get translated name
            if (get(groups)[slide.globalGroup].default) slide.group = get(dictionary).groups?.[slide.group] || slide.group
            slide.color = get(groups)[slide.globalGroup].color

            // update local group
            if (JSON.stringify(oldGroup) !== JSON.stringify({ group: slide.group, color: slide.color })) {
                showsCache.update((a) => {
                    a[id].slides[slideId].group = slide.group
                    a[id].slides[slideId].color = slide.color
                    return a
                })
            }
        }

        if (!slide.group || !get(groupNumbers)) return { ...slide, id: slideId }

        // add numbers to different slides with same name
        if (addedGroups[slide.group]) {
            addedGroups[slide.group]++
            slide.group += " " + addedGroups[slide.group]
        } else addedGroups[slide.group] = 1

        return { ...slide, id: slideId }
    }
    // sort groups by name
    let sortedGroups = showGroups.filter((a) => a.group !== null && a.group !== undefined).sort((a: any, b: any) => a.group?.localeCompare(b.group))

    return { layout, endIndex, template, groups: sortedGroups }
}
