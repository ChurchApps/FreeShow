import { get } from "svelte/store"
import { STAGE } from "../../../types/Channels"
import type { Variable } from "../../../types/Main"
import {
    activeDrawerTab,
    activeEdit,
    activePage,
    activeProject,
    dictionary,
    gain,
    groupNumbers,
    groups,
    media,
    openScripture,
    outLocked,
    outputs,
    overlays,
    playingAudio,
    playingMetronome,
    playScripture,
    projects,
    refreshEditSlide,
    selected,
    showsCache,
    sortedShowsList,
    styles,
    variables,
    volume,
} from "../../stores"
import { newToast } from "../../utils/common"
import { send } from "../../utils/request"
import { keysToID, removeDeleted, sortByName } from "../helpers/array"
import { ondrop } from "../helpers/drop"
import { dropActions } from "../helpers/dropActions"
import { history } from "../helpers/history"
import { setDrawerTabData } from "../helpers/historyHelpers"
import { getMediaStyle } from "../helpers/media"
import { getActiveOutputs, getCurrentStyle, isOutCleared, setOutput } from "../helpers/output"
import { loadShows, setShow } from "../helpers/setShow"
import { getLabelId } from "../helpers/show"
import { playNextGroup, updateOut } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import { getPlainEditorText } from "../show/getTextEditor"
import { getSlideGroups } from "../show/tools/groups"
import { activeShow } from "./../../stores"
import type { API_group, API_id_value, API_layout, API_media, API_rearrange, API_scripture, API_slide_index, API_variable } from "./api"

// WIP combine with click() in ShowButton.svelte
export function selectShowByName(name: string) {
    let shows = get(sortedShowsList)
    let sortedShows = sortByClosestMatch(shows, name)
    let showId = sortedShows[0]?.id
    if (!showId) return

    activeShow.set({ id: showId, type: "show" })
    if (get(activeEdit).id) activeEdit.set({ type: "show", slide: 0, items: [] })
    if (get(activePage) === "edit") refreshEditSlide.set(true)
}

// WIP duplicate of Preview.svelte checkGroupShortcuts()
export function gotoGroup(dataGroupId: string) {
    if (get(outLocked)) return

    let outputId = getActiveOutputs(get(outputs))[0]
    let currentOutput = get(outputs)[outputId] || null
    let outSlide = currentOutput.out?.slide
    let currentShowId = outSlide?.id || (get(activeShow) !== null ? (get(activeShow)!.type === undefined || get(activeShow)!.type === "show" ? get(activeShow)!.id : null) : null)
    if (!currentShowId) return

    let showRef = _show(currentShowId).layouts("active").ref()[0] || []
    let groupIds = showRef.map((a) => a.id)
    let showGroups = groupIds.length ? _show(currentShowId).slides(groupIds).get() : []
    if (!showGroups.length) return

    let globalGroupIds: string[] = []
    Object.keys(get(groups)).forEach((groupId: string) => {
        if (groupId !== dataGroupId) return

        showGroups.forEach((slide) => {
            if (slide.globalGroup === groupId) globalGroupIds.push(slide.id)
        })
    })

    playNextGroup(globalGroupIds, { showRef, outSlide, currentShowId })
}

export function selectProjectById(id: string) {
    if (!get(projects)[id]) return

    activeProject.set(id)
}

export function selectProjectByIndex(index: number) {
    if (index < 0) return

    // select project
    let selectedProject = sortByName(removeDeleted(keysToID(get(projects))))[index]
    if (!selectedProject) {
        newToast(get(dictionary).toast?.midi_no_project + " " + index)
        return
    }

    activeProject.set(selectedProject.id)
}

export async function selectSlideByIndex(data: API_slide_index) {
    if (data.showId) await loadShows([data.showId])

    let showRef = _show(data.showId || "active")
        .layouts(data.layoutId ? [data.layoutId] : "active")
        .ref()[0]
    if (!showRef) return newToast("$toast.midi_no_show")

    let slideRef = showRef[data.index]
    if (!slideRef) return newToast(get(dictionary).toast?.midi_no_slide + " " + data.index)

    outputSlide(showRef, data)
}
export function selectSlideByName(name: string) {
    let slides = _show().slides().get()
    // group numbers
    let groupNums: { [key: string]: number } = {}
    slides = slides
        .filter((a) => a.group)
        .map((a) => {
            if (!groupNums[a.group]) groupNums[a.group] = 0
            groupNums[a.group]++

            let group = getLabelId(a.group, false)
            if (get(groupNumbers) && groupNums[a.group] > 1) group += `_${groupNums[a.group]}`

            return { ...a, group }
        })

    let sortedSlides = sortByClosestMatch(slides, getLabelId(name, false), "group")
    if (!sortedSlides[0]) return

    let showRef = _show().layouts("active").ref()[0]
    if (!showRef) return newToast("$toast.midi_no_show")

    let index = showRef.findIndex((a) => a.id === sortedSlides[0].id)
    let slideRef = showRef[index]
    if (!slideRef) return

    outputSlide(showRef, { index })
}
// WIP duplicate of Slides.svelte:57 (slideClick)
function outputSlide(showRef, data: API_slide_index) {
    if (get(outLocked)) return

    let showId = data.showId || get(activeShow)?.id || ""
    updateOut(showId, data.index, showRef)
    let activeLayout = _show(showId).get("settings.activeLayout")
    setOutput("slide", { id: showId, layout: data.layoutId || activeLayout, index: data.index, line: 0 })
}

function getSortedOverlays() {
    return sortByName(keysToID(get(overlays)))
}
export function selectOverlayByIndex(index: number) {
    if (get(outLocked)) return

    let sortedOverlays = getSortedOverlays()
    let overlayId = sortedOverlays[index]?.id
    if (!overlayId) return // newToast("$toast.action_no_id": action_id)

    setOutput("overlays", overlayId, false, "", true)
}
export function selectOverlayByName(name: string) {
    if (get(outLocked)) return

    let sortedOverlays = sortByClosestMatch(getSortedOverlays(), name)
    let overlayId = sortedOverlays[0]?.id
    if (!overlayId) return

    setOutput("overlays", overlayId, false, "", true)
}
export function selectOverlayById(id: string) {
    if (get(outLocked)) return

    setOutput("overlays", id, false, "", true)
}

export function toggleLock(value?: boolean) {
    outLocked.set(value ?? !get(outLocked))
}

export function moveStageConnection(id: string) {
    if (!id) return
    send(STAGE, ["SWITCH"], { id })
}

export function changeVariable(data: API_variable) {
    let variable: Variable | undefined
    if (data.id) variable = get(variables)[data.id]
    else if (data.name) variable = sortByClosestMatch(getVariables(), data.name)[0]
    else if (data.index !== undefined) variable = sortByName(getVariables())[data.index - 1]
    if (!variable) return

    let value
    let key = data.key || "enabled"
    if (data.variableAction || variable.type === "number") {
        value = Number(variable.number || variable.default || 0)
        if (data.variableAction === "increment" || key === "increment") value += Number(data.value || variable.step || 1)
        else if (data.variableAction === "decrement" || key === "decrement") value -= Number(data.value || variable.step || 1)
        else if (!data.variableAction) value = Number(data.value || variable.default || 0)
        key = "number"
    } else if (data.value !== undefined) {
        value = data.value
        if (key === "value" && typeof value !== "boolean") key = variable.type
    } else if (key === "enabled") {
        value = !variable.enabled
    }
    if (value === undefined) return

    updateVariable(value, data.id || variable.id || "", key)
}
function getVariables() {
    return keysToID(get(variables))
}
function updateVariable(value: any, id: string, key: string) {
    variables.update((a) => {
        if (a[id]) a[id][key] = value
        return a
    })
}

// SHOW

export async function changeShowLayout(data: API_layout) {
    await loadShows([data.showId])
    showsCache.update((a) => {
        if (!a[data.showId]?.layouts[data.layoutId]) return a

        a[data.showId].settings.activeLayout = data.layoutId
        return a
    })
}

export async function setShowAPI(id: string, value: string) {
    await loadShows([id])
    try {
        setShow(id, JSON.parse(value))
    } catch (err) {
        console.error(err)
    }
}

export async function getPlainText(id: string) {
    await loadShows([id])
    return { id, value: getPlainEditorText(id) } as API_id_value
}

export function getShowGroups(id: string) {
    return { id, value: getSlideGroups(id) }
}

export async function rearrangeGroups(data: API_rearrange) {
    await loadShows([data.showId])

    let trigger = data.to > data.from ? "end" : ""
    let pos = trigger === "end" ? 1 : 0

    let ref = _show(data.showId).layouts("active").ref()[0]
    let dragIndex = ref.find((a) => a.type === "parent" && a.index === data.from)?.layoutIndex
    let dropIndex = ref.find((a) => a.type === "parent" && a.index === data.to + pos)?.layoutIndex! - pos
    if (isNaN(dropIndex)) dropIndex = ref.length

    const drag = { id: "slide", data: [{ index: dragIndex, showId: data.showId }] }
    const drop = { id: "slides", data: { index: dropIndex }, index: dropIndex + pos } // , trigger, center: false

    let h = dropActions.slide({ drag, drop }, {})
    if (h && h.id) history(h)
}

export async function addGroup(data: API_group) {
    await loadShows([data.showId])

    selected.set({ id: "group", data: [{ id: data.groupId, showId: data.showId }] })
    ondrop(null, "slide")
    selected.set({ id: null, data: [] })
}

export function setTemplate(templateId: string) {
    let showId = get(activeShow)?.id
    if (!showId) {
        // newToast("$empty.show")
        return
    }
    if (_show(showId).get("locked")) {
        newToast("$show.locked")
        return
    }

    history({ id: "TEMPLATE", newData: { id: templateId, data: { createItems: true } }, location: { page: "none", override: "show#" + showId } })
}

// PRESENTATION

export function getClearedState() {
    let o = get(outputs)

    const audio = !Object.keys(get(playingAudio)).length && !get(playingMetronome)
    const background = isOutCleared("background", o)
    const slide = isOutCleared("slide", o)
    const overlays = isOutCleared("overlays", o, true)
    const slideTimers = isOutCleared("transition", o)

    const all = isOutCleared(null, o) && audio

    return { all, background, slide, overlays, audio, slideTimers }
}

// "1.1.1" = "Gen 1:1"
export function startScripture(data: API_scripture) {
    const split = data.reference.split(".")
    const ref = { book: Number(split[0]) - 1, chapter: Number(split[1]), verses: [split[2]] }

    setDrawerTabData("scripture", data.id)
    activeDrawerTab.set("scripture")

    openScripture.set({ ...ref })
    setTimeout(() => playScripture.set(true), 500)
}

// MEDIA

export function playMedia(data: API_media) {
    if (get(outLocked)) return

    let outputId = getActiveOutputs(get(outputs))[0]
    let currentOutput = get(outputs)[outputId] || {}
    let currentStyle = getCurrentStyle(get(styles), currentOutput.style)

    const mediaStyle = getMediaStyle(get(media)[data.path], currentStyle)

    setOutput("background", { path: data.path, ...mediaStyle })
}

// AUDIO

let unmutedValue = 1
export function updateVolumeValues(value: number | undefined | "local", changeGain: boolean = false) {
    // api mute(unmute)
    if (value === undefined) {
        value = get(volume) ? 0 : unmutedValue
        if (!value) unmutedValue = get(volume)
    }

    if (changeGain) gain.set(Number(Number(value).toFixed(2)))
    else volume.set(Number(Number(value).toFixed(2)))
}

// SPECIAL

export function sortByClosestMatch(array: any[], value: string, key: string = "name") {
    if (!value) return array

    // the object key must contain the input string
    array = array.filter((a) => a[key] && a[key].toLowerCase().includes(value.toLowerCase()))

    function similaritySort(a, b) {
        const similarityA = 1 / (1 + levenshteinDistance(a[key].toLowerCase(), value.toLowerCase()))
        const similarityB = 1 / (1 + levenshteinDistance(b[key].toLowerCase(), value.toLowerCase()))

        return similarityB - similarityA
    }

    return array.sort(similaritySort)
}
// WIP duplicate of files.ts
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length

    const matrix: number[][] = []

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) matrix[i] = [i]
    // increment each column in the first row
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i
    // fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
            }
        }
    }

    return matrix[b.length][a.length]
}
