import { get } from "svelte/store"
import type { Item, Show, ShowList, Shows, Slide, TrimmedShow, TrimmedShows } from "../../../types/Show"
import { cachedShowsData, customMetadata, dictionary, groupNumbers, groups, shows, showsCache, sorted, sortedShowsList } from "../../stores"
import { translateText } from "../../utils/language"
import { clone, keysToID, removeValues, sortByName } from "./array"
import { GetLayout } from "./get"
import { history } from "./history"
import { _show } from "./shows"

// check if name exists and add number
export function checkName(name = "", showId = "") {
    if (!name || typeof name !== "string") name = translateText("main.unnamed")
    name = formatToFileName(name)

    // if ID exists, check the name if different
    if (showId && get(shows)[showId]) {
        if (get(shows)[showId]?.name !== name) return checkName(name)
        return name
    }

    let number = 1
    while (Object.values(get(shows)).find((a) => a.name?.toLowerCase() === (number > 1 ? name.toLowerCase() + " " + number : name.toLowerCase()))) number++

    // add number if existing name, and trim away spaces from the start/end
    return (number > 1 ? name + " " + number : name).trim()
}

export function formatToFileName(name = "") {
    name = name.replaceAll(":", ",")
    // remove illegal file name characters
    name = name.trim().replace(/[/\\?%*:|"<>╠]/g, "")
    // max 255 length
    if (name.length > 255) name = name.slice(0, 255)

    return name
}

// convert any text to a label id format
export function getLabelId(label: string, replaceNumbers = true) {
    // TODO: disallow chars in labels: #:;!.,- ??
    label = label
        .toLowerCase()
        .replace(/x[0-9]/g, "") // x0-9
        .replace(/[[\]]/g, "") // []
        .replace(/['":]/g, "") // '":
        .trim()
        .replaceAll(" ", "_") // " " -> _
        .replaceAll("-", "_") // - -> _

    if (!get(groupNumbers)) replaceNumbers = false
    if (replaceNumbers) label = label.replace(/[0-9]/g, "")

    return label
    // .replace(/[0-9-]/g, "")
}

// check if label exists as a global label
export function getGlobalGroup(group: string, returnInputIfNull = false): string {
    const groupId = getLabelId(group)

    if (get(groups)[groupId]) return groupId

    const matchingName = Object.keys(get(groups)).find((id) => {
        return get(groups)[id].name === group
    })
    if (matchingName) return matchingName

    // find group based on language
    let globalGroup = ""
    Object.entries(get(dictionary).groups || {}).forEach(([id, name]) => {
        if (name.toLowerCase() === groupId) globalGroup = id
    })
    return globalGroup || (returnInputIfNull ? groupId : "")
}

// get group number (dynamic counter)
export function getGroupName({ show, showId }: { show: Show; showId: string }, slideID: string, groupName: string | null, layoutIndex: number, addHTML = false, layoutNumber = true) {
    if (groupName === ".") return "." // . as name will be hidden

    let name = groupName
    if (name === null) return name // child slide

    if (!name?.length) name = layoutNumber ? "—" : ""
    if (!get(groupNumbers)) return name

    // sort by order when just one layout
    let slides = keysToID(clone(show.slides || {}))
    if (Object.keys(show.layouts || {}).length < 2) {
        const layoutSlides = Object.values(show.layouts || {})[0]?.slides?.map(({ id }) => id) || []
        slides = slides.sort((a, b) => layoutSlides.indexOf(a.id) - layoutSlides.indexOf(b.id))
    }

    // different slides with same name
    const currentSlide = show.slides?.[slideID] || {}
    const allSlidesWithSameGroup = slides.filter((a) => a.group === currentSlide.group)
    const currentIndex = allSlidesWithSameGroup.findIndex((a) => a.id === slideID)
    const currentGroupNumber = allSlidesWithSameGroup.length > 1 ? " " + (currentIndex + 1) : ""
    name += currentGroupNumber

    // same group - count
    const layoutRef = getLayoutRef(showId)
    const allGroupLayoutSlides = layoutRef.filter((a) => a.id === slideID)
    const currentGroupLayoutIndex = allGroupLayoutSlides.findIndex((a) => a.layoutIndex === layoutIndex)
    const currentLayoutNumberHTML = allGroupLayoutSlides.length > 1 ? '<span class="group_count">' + (currentGroupLayoutIndex + 1) + "</span>" : ""
    const currentLayoutNumber = allGroupLayoutSlides.length > 1 ? " (" + (currentGroupLayoutIndex + 1) + ")" : ""
    if (layoutNumber) name += addHTML ? currentLayoutNumberHTML : currentLayoutNumber

    return name
}

// meta
export function initializeMetadata({ number = "", title = "", artist = "", author = "", composer = "", publisher = "", copyright = "", CCLI = "", year = "", key = "" }) {
    return { number, title, artist, author, composer, publisher, copyright, CCLI, year, key }
}
export function getCustomMetadata() {
    const defaultKeys = Object.keys(initializeMetadata({}))

    const customKeys = get(customMetadata).custom?.filter(Boolean) || []
    const values: { [key: string]: string } = {}

    defaultKeys.forEach((key) => {
        if (get(customMetadata).disabled?.includes(key)) return
        values[key] = ""
    })
    customKeys.forEach((key) => {
        values[key] = ""
    })

    return values
}

export const metadataDisplayValues = [
    { id: "never", name: "show_at.never" },
    { id: "first", name: "show_at.first" },
    { id: "last", name: "show_at.last" },
    { id: "first_last", name: "show_at.first_last" },
    { id: "always", name: "show_at.always" }
]

// create new slides
export function newSlide(data: { items?: Item[]; group?: string; globalGroup?: string; notes?: string }): Slide {
    return {
        group: null,
        color: null,
        settings: {},
        notes: "",
        items: [],
        ...data
    }
}

// update list for drawer
export function updateShowsList(allShows: TrimmedShows) {
    // sort shows in alphabeticly order & remove private shows
    const showsList = keysToID(allShows)

    const sortType = get(sorted).shows?.type || "name"
    // sort by name regardless if many shows have the same date
    let sortedShows: (TrimmedShow & { id: string })[] = []
    if (sortType === "created") {
        sortedShows = showsList.sort((a, b) => b.timestamps?.created - a.timestamps?.created)
    } else if (sortType === "modified") {
        sortedShows = showsList.sort((a, b) => (b.timestamps?.modified || b.timestamps?.created) - (a.timestamps?.modified || a.timestamps?.created))
    } else if (sortType === "used") {
        sortedShows = showsList.sort((a, b) => (b.timestamps?.used || b.timestamps?.created) - (a.timestamps?.used || a.timestamps?.created))
    } else {
        // sort by name
        sortedShows = sortByName(showsList)
        if (sortType === "name_des") sortedShows = sortedShows.reverse()
    }

    // const profile = getAccess("shows")
    // const hiddenCategories = Object.entries(profile).filter(([_, type]) => type === "none").map(([id]) => id)

    const filteredShows: ShowList[] = removeValues(sortedShows, "private", true) // .filter((a) => !a.category || !hiddenCategories.includes(a.category))
    sortedShowsList.set(filteredShows)
}

// update cached shows
export function updateCachedShows(newShowsData: Shows) {
    const cachedShows = {}
    Object.entries(newShowsData).forEach(([id, show]) => {
        const customId = getShowCacheId(id, show)
        cachedShows[customId] = updateCachedShow(id, show)
    })
    cachedShowsData.set(cachedShows)
}

export function getShowCacheId(id: string, show: Show | null, layout = "") {
    if (!show && !layout) return ""
    return `${id}_${layout || show?.settings?.activeLayout}`
}

// get cached show by layout (used for multiple of the same shows with different layout selected in "Focus mode")
export function getCachedShow(id: string, layout = "", updater = get(cachedShowsData)) {
    const show = get(showsCache)[id]
    const customId = getShowCacheId(id, show, layout)
    let cachedShow = updater[customId]
    if (cachedShow || !layout) return cachedShow

    cachedShow = updateCachedShow(id, show, layout)
    cachedShowsData.update((a) => {
        a[customId] = cachedShow
        return a
    })

    return cachedShow
}

// update cached show
export function updateCachedShow(showId: string, show: Show, layoutId = "") {
    // WIP looped many times when show not loading
    // console.log(id, show)
    if (!show) return

    const layout = GetLayout(showId, layoutId)
    // $: activeLayout = $showsCache[$activeShow!.id]?.settings?.activeLayout
    // let layout = _show(id).layouts(activeLayout).ref()[0]

    let endIndex = -1
    if (layout.length) {
        const lastEnabledSlide: number = layout.findIndex((a) => a.end === true && a.disabled !== true)
        if (lastEnabledSlide >= 0) endIndex = lastEnabledSlide
    }

    const customId = getShowCacheId(showId, show)
    const template = {
        id: show.settings?.template,
        slidesUpdated: cachedShowsData[customId]?.template?.slidesUpdated || false
    }

    // sort by order when just one layout
    let showSlides = keysToID(clone(show.slides || {}))
    if (Object.keys(show.layouts || {}).length < 2) {
        const layoutSlides = Object.values(show.layouts || {})[0]?.slides?.map(({ id }) => id) || []
        showSlides = showSlides.sort((a, b) => layoutSlides.indexOf(a.id) - layoutSlides.indexOf(b.id))
    }

    // create groups
    const addedGroups: { [key: string]: number } = {}
    const showGroups = showSlides.map(createGroups)
    function createGroups(slide: Slide & { id: string }) {
        // update if global group
        if (slide.globalGroup && get(groups)[slide.globalGroup]) {
            const oldGroup = clone({ group: slide.group, color: slide.color })

            slide.group = get(groups)[slide.globalGroup].name
            // get translated name
            if (get(groups)[slide.globalGroup].default) slide.group = get(dictionary).groups?.[slide.group] || slide.group
            slide.color = get(groups)[slide.globalGroup].color

            // update local group
            if (JSON.stringify(oldGroup) !== JSON.stringify({ group: slide.group, color: slide.color })) {
                showsCache.update((a) => {
                    a[showId].slides[slide.id].group = slide.group
                    a[showId].slides[slide.id].color = slide.color
                    return a
                })
            }
        }

        if (slide.group === null || !get(groupNumbers)) return { ...slide, id: slide.id }
        if (!slide.group) slide.group = "—"

        // add numbers to different slides with same name
        if (addedGroups[slide.group]) {
            addedGroups[slide.group]++
            slide.group += " " + addedGroups[slide.group]
        } else {
            addedGroups[slide.group] = 1

            // find all groups with same name
            const allSameGroups = showSlides.filter((a) => a.group !== null && (a.group || "—") === slide.group)
            if (allSameGroups.length > 1) slide.group += " 1"
        }

        return { ...slide, id: slide.id }
    }
    // sort groups by name
    const sortedGroups = sortByName(
        showGroups.filter((a) => a.group !== null && a.group !== undefined),
        "group"
    )

    return { layout, endIndex, template, groups: sortedGroups }
}

export function removeTemplatesFromShow(showId: string, enableHistory = false) {
    if (!get(showsCache)[showId]) return

    // remove show template
    if (enableHistory) {
        const settings = { ...clone(_show(showId).get("settings") || {}), template: null }
        history({ id: "UPDATE", newData: { data: settings, key: "settings" }, oldData: { id: showId }, location: { page: "none", id: "show_key" } })
    } else {
        _show(showId).set({ key: "settings.template", value: null })
    }

    // remove any slide templates
    showsCache.update((a) => {
        const show = a[showId]
        Object.values(show.slides || {}).forEach((slide) => {
            if (slide.settings?.template) delete slide.settings.template
        })
        return a
    })
}

export function getLayoutRef(showId = "active", _updater?: Shows | Show) {
    return _show(showId).layouts("active").ref()[0] || []
}
