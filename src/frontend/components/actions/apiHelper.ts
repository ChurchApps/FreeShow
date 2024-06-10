import { get } from "svelte/store"
import { STAGE } from "../../../types/Channels"
import { keysToID, sortByName } from "../helpers/array"
import { getActiveOutputs, setOutput } from "../helpers/output"
import { playNextGroup, updateOut } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import { activeEdit, activePage, activeProject, activeShow, dictionary, groups, outLocked, outputs, overlays, projects, refreshEditSlide, sortedShowsList, variables } from "../../stores"
import type { API_variable } from "./api"
import { send } from "../../utils/request"
import { getLabelId } from "../helpers/show"
import { newToast } from "../../utils/common"

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
    let currentOutput: any = outputId ? get(outputs)[outputId] || {} : {}
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

export function selectProjectByIndex(index: number) {
    if (index < 0) return

    // select project
    let selectedProject = keysToID(get(projects)).sort((a, b) => a.name.localeCompare(b.name))[index]
    if (!selectedProject) {
        newToast(get(dictionary).toast?.midi_no_project + " " + index)
        return
    }

    activeProject.set(selectedProject.id)
}

export function selectSlideByIndex(index: number) {
    let showRef = _show().layouts("active").ref()[0]
    if (!showRef) return newToast("$toast.midi_no_show")

    let slideRef = showRef[index]
    if (!slideRef) return newToast(get(dictionary).toast?.midi_no_slide + " " + index)

    outputSlide(showRef, index)
}
export function selectSlideByName(name: string) {
    let slides = _show().slides().get()
    let sortedSlides = sortByClosestMatch(slides, getLabelId(name), "group")
    if (!sortedSlides[0]) return

    let showRef = _show().layouts("active").ref()[0]
    if (!showRef) return newToast("$toast.midi_no_show")

    let index = showRef.findIndex((a) => a.id === sortedSlides[0].id)
    let slideRef = showRef[index]
    if (!slideRef) return

    outputSlide(showRef, index)
}
// WIP duplicate of Slides.svelte:57 (slideClick)
function outputSlide(showRef, index) {
    if (get(outLocked)) return

    updateOut("active", index, showRef)
    let showId = get(activeShow)!.id
    let activeLayout = _show().get("settings.activeLayout")
    setOutput("slide", { id: showId, layout: activeLayout, index, line: 0 })
}

function getSortedOverlays() {
    return keysToID(get(overlays)).sort((a, b) => a.name.localeCompare(b.name))
}
export function selectOverlayByIndex(index: number) {
    if (get(outLocked)) return

    let sortedOverlays = getSortedOverlays()
    let overlayId = sortedOverlays[index]?.id
    if (!overlayId) return

    setOutput("overlays", overlayId, true)
}
export function selectOverlayByName(name: string) {
    if (get(outLocked)) return

    let sortedOverlays = sortByClosestMatch(getSortedOverlays(), name)
    let overlayId = sortedOverlays[0]?.id
    if (!overlayId) return

    setOutput("overlays", overlayId, true)
}

export function toggleLock(value?: boolean) {
    outLocked.set(value ?? !get(outLocked))
}

export function moveStageConnection(id: string) {
    if (!id) return
    send(STAGE, ["SWITCH"], { id })
}

export function changeVariable(data: API_variable) {
    let variable: any
    if (data.name) variable = sortByClosestMatch(getVariables(), data.name)[0]
    else if (data.index !== undefined) variable = sortByName(getVariables())[data.index - 1]
    if (!variable) return

    let value
    let key = data.key || "enabled"
    if (data.variableAction) {
        if (data.variableAction === "increment") value = Number(variable.number || 0) + Number(variable.step || 1)
        else if (data.variableAction === "decrement") value = Number(variable.number || 0) - Number(variable.step || 1)
        key = "number"
    } else if (data.value !== undefined) {
        value = data.value
        key = variable.type === "number" ? "number" : "text"
    } else if (key === "enabled") {
        value = !variable.enabled
    }
    if (value === undefined) return

    updateVariable(value, variable.id, key)
}
function getVariables() {
    return keysToID(get(variables))
}
function updateVariable(value: any, id: string, key: string) {
    variables.update((a) => {
        a[id][key] = value
        return a
    })
}

// SPECIAL

function sortByClosestMatch(array: any[], value: string, key: string = "name") {
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

    const matrix: any[] = []

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
