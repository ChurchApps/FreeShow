import { get } from "svelte/store"
import type { Show, ShowList, Shows, Slide } from "../../../types/Show"
import { activeShow, cachedShowsData, dictionary, groupNumbers, groups, shows, showsCache, sorted, sortedShowsList, stageShows } from "../../stores"
import { clone, keysToID, removeValues, sortByNameAndNumber } from "./array"
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
export function getLabelId(label: string, replaceNumbers: boolean = true) {
    // TODO: disallow chars in labels: #:;!.,- ??
    label = label
        .toLowerCase()
        .replace(/x[0-9]/g, "") // x0-9
        .replace(/[0-9]/g, "") // 0-9
        .replace(/[[\]]/g, "") // []
        .replace(/['":]/g, "") // '":
        .trim()
        .replaceAll(" ", "_") // " " -> _
        .replaceAll("-", "_") // - -> _

    if (replaceNumbers) label = label.replace(/[0-9]/g, "")

    return label
    // .replace(/[0-9-]/g, "")
}

// check if label exists as a global label
export function getGlobalGroup(group: string, returnInputIfNull: boolean = false): string {
    let groupId = getLabelId(group)

    if (get(groups)[groupId]) return groupId

    let matchingName = Object.keys(get(groups)).find((groupId) => {
        return get(groups)[groupId].name === group
    })
    if (matchingName) return matchingName

    // find group based on language
    let globalGroup: any = ""
    Object.entries(get(dictionary).groups || {}).forEach(([id, name]) => {
        if (name.toLowerCase() === groupId) globalGroup = id
    })
    return globalGroup || (returnInputIfNull ? groupId : "")
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
    let sortedShows: any[] = []
    if (sortType === "created") {
        sortedShows = showsList.sort((a, b) => b.timestamps?.created - a.timestamps?.created)
    } else if (sortType === "modified") {
        sortedShows = showsList.sort((a, b) => (b.timestamps?.modified || b.timestamps?.created) - (a.timestamps?.modified || a.timestamps?.created))
    } else if (sortType === "used") {
        sortedShows = showsList.sort((a, b) => (b.timestamps?.used || b.timestamps?.created) - (a.timestamps?.used || a.timestamps?.created))
    } else {
        // sort by name
        sortedShows = sortByNameAndNumber(showsList)
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
    let showSlides = keysToID(clone(show.slides || {}))
    let addedGroups: any = {}

    // sort by order when just one layout
    if (Object.keys(show.layouts).length < 2) {
        let layoutSlides = Object.values(show.layouts)[0]?.slides?.map(({ id }) => id) || []
        showSlides = showSlides.sort((a, b) => layoutSlides.indexOf(a.id) - layoutSlides.indexOf(b.id))
    }

    let showGroups: any[] = showSlides.map(createGroups)
    function createGroups(slide) {
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
                    a[id].slides[slide.id].group = slide.group
                    a[id].slides[slide.id].color = slide.color
                    return a
                })
            }
        }

        if (!slide.group || !get(groupNumbers)) return { ...slide, id: slide.id }

        // add numbers to different slides with same name
        if (addedGroups[slide.group]) {
            addedGroups[slide.group]++
            slide.group += " " + addedGroups[slide.group]
        } else addedGroups[slide.group] = 1

        return { ...slide, id: slide.id }
    }
    // sort groups by name
    let sortedGroups = showGroups.filter((a) => a.group !== null && a.group !== undefined).sort((a: any, b: any) => a.group?.localeCompare(b.group))

    return { layout, endIndex, template, groups: sortedGroups }
}
