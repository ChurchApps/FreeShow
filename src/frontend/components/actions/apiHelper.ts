import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"
import { get } from "svelte/store"
import { OUTPUT, STAGE } from "../../../types/Channels"
import type { History } from "../../../types/History"
import type { DropData, Selected, Variable } from "../../../types/Main"
import { AudioPlayer } from "../../audio/audioPlayer"
import { AudioPlaylist } from "../../audio/audioPlaylist"
import {
    activeDrawerTab,
    activeEdit,
    activePage,
    activeProject,
    activeTimers,
    audioPlaylists,
    draw,
    drawSettings,
    drawTool,
    folders,
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
    projects,
    refreshEditSlide,
    selected,
    showsCache,
    sortedShowsList,
    styles,
    timers,
    variables,
    volume
} from "../../stores"
import { newToast } from "../../utils/common"
import { send } from "../../utils/request"
import { getDynamicValue } from "../edit/scripts/itemHelpers"
import { keysToID, removeDeleted, sortByName } from "../helpers/array"
import { ondrop } from "../helpers/drop"
import { dropActions } from "../helpers/dropActions"
import { history } from "../helpers/history"
import { setDrawerTabData } from "../helpers/historyHelpers"
import { getExtension, getFileName, getMediaStyle, getMediaType, removeExtension } from "../helpers/media"
import { getActiveOutputs, getCurrentStyle, isOutCleared, setOutput } from "../helpers/output"
import { setRandomValue } from "../helpers/randomValue"
import { loadShows, setShow } from "../helpers/setShow"
import { getLabelId, getLayoutRef } from "../helpers/show"
import { playNextGroup, updateOut } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import { clearBackground } from "../output/clear"
import { getPlainEditorText } from "../show/getTextEditor"
import { getSlideGroups } from "../show/tools/groups"
import { activeShow } from "./../../stores"
import type { API_add_to_project, API_create_project, API_draw_zoom, API_edit_timer, API_group, API_id_index, API_id_value, API_layout, API_media, API_output_lock, API_rearrange, API_scripture, API_seek, API_slide_index, API_variable } from "./api"

// WIP combine with click() in ShowButton.svelte
export function selectShowByName(name: string) {
    const shows = get(sortedShowsList)
    if (name.includes("{")) name = getDynamicValue(name)
    const sortedShows = sortByClosestMatch(shows, name)
    const showId = sortedShows[0]?.id
    if (!showId) return

    activeShow.set({ id: showId, type: "show" })
    if (get(activeEdit).id) activeEdit.set({ type: "show", slide: 0, items: [] })
    if (get(activePage) === "edit") refreshEditSlide.set(true)
}

// WIP duplicate of Preview.svelte checkGroupShortcuts()
export function gotoGroup(dataGroupId: string) {
    if (get(outLocked)) return

    const outputId = getActiveOutputs(get(outputs))[0]
    const currentOutput = get(outputs)[outputId] || null
    const outSlide = currentOutput.out?.slide
    const currentShowId = outSlide?.id || (get(activeShow) !== null ? (get(activeShow)!.type === undefined || get(activeShow)!.type === "show" ? get(activeShow)!.id : null) : null)
    if (!currentShowId) return

    const showRef = getLayoutRef(currentShowId)
    const groupIds = showRef.map((a) => a.id)
    const showGroups = groupIds.length ? _show(currentShowId).slides(groupIds).get() : []
    if (!showGroups.length) return

    const globalGroupIds: string[] = []
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
    const selectedProject = sortByName(removeDeleted(keysToID(get(projects))))[index]
    if (!selectedProject) {
        newToast("toast.midi_no_project " + index)
        return
    }

    activeProject.set(selectedProject.id)
    if (get(activeShow)) activeShow.set({ ...get(activeShow)!, index: -1 })
}

export function selectProjectByName(name: string) {
    const projectsList = sortByName(removeDeleted(keysToID(get(projects))))
    if (name.includes("{")) name = getDynamicValue(name)
    const sortedProjects = sortByClosestMatch(projectsList, name)
    const projectId = sortedProjects[0]?.id
    if (!projectId) return

    activeProject.set(projectId)
}

export async function selectSlideByIndex(data: API_slide_index) {
    if (data.showId) await loadShows([data.showId])

    const showRef = _show(data.showId || "active")
        .layouts(data.layoutId ? [data.layoutId] : "active")
        .ref()[0]
    if (!showRef) return newToast("toast.midi_no_show")

    const slideRef = showRef[data.index]
    if (!slideRef) return newToast("toast.midi_no_slide " + data.index)

    outputSlide(showRef, data)
}
export function selectSlideByName(name: string) {
    let slides = _show().slides().get()
    // group numbers
    const groupNums: { [key: string]: number } = {}
    slides = slides
        .filter((a) => a.group)
        .map((a) => {
            if (!groupNums[a.group]) groupNums[a.group] = 0
            groupNums[a.group]++

            let group = getLabelId(a.group, false)
            if (get(groupNumbers) && groupNums[a.group] > 1) group += `_${groupNums[a.group]}`

            return { ...a, group }
        })

    if (name.includes("{")) name = getDynamicValue(name)
    const sortedSlides = sortByClosestMatch(slides, getLabelId(name, false), "group")
    if (!sortedSlides[0]) return

    const showRef = getLayoutRef()
    if (!showRef) return newToast("toast.midi_no_show")

    const index = showRef.findIndex((a) => a.id === sortedSlides[0].id)
    const slideRef = showRef[index]
    if (!slideRef) return

    outputSlide(showRef, { index })
}
// WIP duplicate of Slides.svelte:57 (slideClick)
function outputSlide(showRef, data: API_slide_index) {
    if (get(outLocked)) return

    const showId = data.showId || get(activeShow)?.id || ""
    updateOut(showId, data.index, showRef)
    const activeLayout = _show(showId).get("settings.activeLayout")
    setOutput("slide", { id: showId, layout: data.layoutId || activeLayout, index: data.index, line: 0 })
}

export function selectEffectById(id: string) {
    if (get(outLocked)) return

    setOutput("effects", id, false, "", true)
}

function getSortedOverlays() {
    return sortByName(keysToID(get(overlays)))
}
export function selectOverlayByIndex(index: number) {
    if (get(outLocked)) return

    const sortedOverlays = getSortedOverlays()
    const overlayId = sortedOverlays[index]?.id
    if (!overlayId) return // newToast("toast.action_no_id": action_id)

    setOutput("overlays", overlayId, false, "", true)
}
export function selectOverlayByName(name: string) {
    if (get(outLocked)) return

    if (name.includes("{")) name = getDynamicValue(name)
    const sortedOverlays = sortByClosestMatch(getSortedOverlays(), name)
    const overlayId = sortedOverlays[0]?.id
    if (!overlayId) return

    setOutput("overlays", overlayId, false, "", true)
}
export function selectOverlayById(id: string) {
    if (get(outLocked)) return

    setOutput("overlays", id, false, "", true)
}

export function toggleLock(data: API_output_lock) {
    if (!data.outputId) {
        // global lock
        outLocked.set(data.value ?? !get(outLocked))
        return
    }

    const outputIds = data.outputId === "all" ? getActiveOutputs(get(outputs), false, true, true) : [data.outputId]

    const isLocked = get(outputs)[outputIds[0]]?.active === false
    outputIds.forEach(outputId => {
        toggleOutputLock(outputId, typeof data.value === "boolean" ? !data.value : isLocked)
    })
}
// similar to PreviewOutputs.svelte
function toggleOutputLock(outputId: string, value: boolean) {
    outputs.update((a) => {
        if (!a[outputId]?.enabled) return a

        a[outputId].active = value

        const activeList = Object.values(a).filter((o) => !o.stageOutput && o.enabled && o.active === true)
        if (!activeList.length) {
            a[outputId].active = true
            newToast("toast.one_output")
        }

        return a
    })
}

export function moveStageConnection(id: string) {
    if (!id) return
    send(STAGE, ["SWITCH"], { id })
}

// AUDIO

export function startPlaylistByName(name: string) {
    if (get(outLocked)) return

    if (name.includes("{")) name = getDynamicValue(name)
    const sortedPlaylists = sortByClosestMatch(keysToID(get(audioPlaylists)), name)
    const playlistId = sortedPlaylists[0]?.id
    if (!playlistId) return

    AudioPlaylist.start(playlistId)
}

/// EDIT

export function editTimer(data: API_edit_timer) {
    if (!data?.id || !data.key || data.value === undefined) return

    timers.update((a) => {
        if (!a[data.id]) return a

        if (data.key === "start" || data.key === "end") data.value = Number(data.value)
        a[data.id][data.key] = data.value

        return a
    })
}

/// FUNCTIONS

export function changeVariable(data: API_variable) {
    let variable: Variable | undefined
    if (data.id) variable = get(variables)[data.id]
    else if (data.name) variable = sortByClosestMatch(getVariables(), data.name)[0]
    else if (data.index !== undefined) variable = sortByName(getVariables())[data.index - 1]
    if (!variable) return

    const id = data.id || variable.id || ""

    let key = data.key
    if (variable.type === "random_number" && !key) key = "randomize"
    if (variable.type === "text_set" && !key) key = "next"
    else if (!key) key = "enabled"

    if (key === "randomize") {
        setRandomValue(id)
        return
    } else if (key === "reset") {
        resetVariable(id)
        return
    } else if (key === "next" || key === "previous") {
        const activeSet = variable.activeTextSet ?? 0
        const newValue = key === "next" ? Math.min(activeSet + 1, (variable.textSets?.length ?? 1) - 1) : Math.max(activeSet - 1, 0)
        updateVariable(newValue, id, "activeTextSet")
        updateVariable(newValue, id, "activeTextSet")
        return
    }

    let value
    if (key === "expression") {
        const stringValue = (data.value || "").toString()
        const replacedValues = stringValue.includes("{") ? getDynamicValue(stringValue) : stringValue
        // eslint-disable-next-line
        const calculated = new Function(`return ${replacedValues}`)()
        value = Number(calculated)
        key = "number"
    } else if (data.variableAction || variable.type === "number") {
        value = Number(variable.number || variable.default || 0)
        if (data.variableAction === "increment" || key === "increment") value += Number(data.value || variable.step || 1)
        else if (data.variableAction === "decrement" || key === "decrement") value -= Number(data.value || variable.step || 1)
        else if (!data.variableAction) value = Number(data.value || variable.default || 0)
        key = "number"
    } else if (variable.type === "text_set") {
        // if (key === "value") {
        key = "activeTextSet" as any
        value = Number(data.value ?? 1)
    } else if (data.value !== undefined) {
        value = data.value
        if (key === "value" && typeof value !== "boolean") key = variable.type
        if (key === "text" && value.includes("{")) value = getDynamicValue(value)
    } else if (key === "enabled") {
        value = !variable.enabled
    }
    if (value === undefined) return

    updateVariable(value, id, key!)
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
export function resetVariable(id: string) {
    updateVariable(0, id, "number")
    updateVariable("", id, "setName")
    updateVariable([], id, "setLog")
}

// TIMERS

export function getTimersDetailed() {
    const allTimers = get(timers)
    const activeTimersList = get(activeTimers)

    return keysToID(allTimers).map((timer) => ({
        ...timer,
        isActive: activeTimersList.some((activeTimer) => activeTimer.id === timer.id),
        currentTime: activeTimersList.find((activeTimer) => activeTimer.id === timer.id)?.currentTime,
        paused: activeTimersList.find((activeTimer) => activeTimer.id === timer.id)?.paused
    }))
}

export function pauseTimerById(id: string) {
    if (get(outLocked)) return

    const timer = get(timers)[id]
    if (!timer) return

    // Set the specific timer to paused (similar to pauseAllTimers but for one timer)
    activeTimers.update((active) => {
        const timerIndex = active.findIndex((a) => a.id === id)
        if (timerIndex >= 0) {
            active[timerIndex].paused = true
        }
        return active
    })
}

export function pauseTimerByName(name: string) {
    if (get(outLocked)) return

    if (name.includes("{")) name = getDynamicValue(name)
    const timersList = sortByClosestMatch(keysToID(get(timers)), name)
    const timerId = timersList[0]?.id
    if (!timerId) return

    pauseTimerById(timerId)
}

export function stopTimerById(id: string) {
    if (get(outLocked)) return

    const timer = get(timers)[id]
    if (!timer) return

    // Remove from active timers completely (this stops and resets the timer)
    // This is the same as the existing resetTimer function
    activeTimers.update((a) => {
        return a.filter((activeTimer) => activeTimer.id !== id)
    })
}

export function stopTimerByName(name: string) {
    if (get(outLocked)) return

    if (name.includes("{")) name = getDynamicValue(name)
    const timersList = sortByClosestMatch(keysToID(get(timers)), name)
    const timerId = timersList[0]?.id
    if (!timerId) return

    stopTimerById(timerId)
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

export async function getPlainText(showId: string) {
    await loadShows([showId])
    return { id: showId, value: getPlainEditorText(showId) } as API_id_value
}

export function getShowGroups(id: string) {
    return { id, value: getSlideGroups(id) }
}

export async function rearrangeGroups(data: API_rearrange) {
    await loadShows([data.showId])

    const trigger = data.to > data.from ? "end" : ""
    const pos = trigger === "end" ? 1 : 0

    const ref = getLayoutRef(data.showId)
    const dragIndex = ref.find((a) => a.type === "parent" && a.index === data.from)?.layoutIndex
    let dropIndex = (ref.find((a) => a.type === "parent" && a.index === data.to + pos)?.layoutIndex || 0) - pos
    if (isNaN(dropIndex) || dropIndex < 0) dropIndex = ref.length

    const drag: Selected = { id: "slide", data: [{ index: dragIndex, showId: data.showId }] }
    const drop: DropData = { id: "slides", data: { index: dropIndex }, index: dropIndex + pos, center: false } // , trigger, center: false

    const h = await dropActions.slide({ drag, drop }, { location: { page: get(activePage) } } as History)
    if (h && h.id) history(h)
}

export async function addGroup(data: API_group) {
    await loadShows([data.showId])

    selected.set({ id: "group", data: [{ id: data.groupId, showId: data.showId }] })
    ondrop(null, "slide")
    selected.set({ id: null, data: [] })
}

export function setTemplate(templateId: string) {
    const showId = get(activeShow)?.id
    if (!showId) {
        // newToast("empty.show")
        return
    }
    if (_show(showId).get("locked")) {
        newToast("show.locked")
        return
    }

    history({ id: "TEMPLATE", newData: { id: templateId, data: { createItems: true } }, location: { page: "none", override: "show#" + showId } })
}

// PRESENTATION

export function getClearedState() {
    const o = get(outputs)

    const audio = !Object.keys(get(playingAudio)).length && !get(playingMetronome)
    const background = isOutCleared("background", o)
    const slide = isOutCleared("slide", o)
    const overlaysCleared = isOutCleared("overlays", o, true)
    const slideTimers = isOutCleared("transition", o)

    const all = isOutCleared(null, o) && audio

    return { all, background, slide, overlays: overlaysCleared, audio, slideTimers }
}

// "1.1.1" = "Gen 1:1"
export function startScripture(data: API_scripture) {
    const split = data.reference.split(".")
    const ref = { book: Number(split[0]), chapter: Number(split[1]), verses: [split[2]] }

    if (get(activePage) !== "edit") activePage.set("show")
    if (data.id) setDrawerTabData("scripture", data.id) // use active if no ID
    activeDrawerTab.set("scripture")

    openScripture.set({ ...ref, play: true })
}

// MEDIA

export function playMedia(data: API_media) {
    if (get(outLocked)) return

    const extension = getMediaType(getExtension(data.path))

    if (extension === "pdf") {
        const name = removeExtension(getFileName(data.path))
        setOutput("slide", { type: "pdf", id: data.path, page: data.index || 0, pages: data.data?.pageCount ?? 1, name })
        clearBackground()
        return
    }

    const outputId = getActiveOutputs(get(outputs))[0]
    const currentOutput = get(outputs)[outputId] || {}
    const currentStyle = getCurrentStyle(get(styles), currentOutput.style)

    const mediaStyle = getMediaStyle(get(media)[data.path], currentStyle)

    setOutput("background", { path: data.path, ...mediaStyle })
}

export function videoSeekTo(data: API_seek) {
    if (get(outLocked)) return

    const activeOutputIds = getActiveOutputs(get(outputs), true, true, true)
    const timeValues: any = {}
    activeOutputIds.forEach((id) => {
        timeValues[id] = data.seconds
    })

    send(OUTPUT, ["TIME"], timeValues)
}

// AUDIO

export function playAudio(data: API_media) {
    if (get(outLocked)) return
    AudioPlayer.start(data.path, { name: removeExtension(getFileName(data.path)) })
}
export function pauseAudio(data: API_media) {
    if (get(outLocked)) return
    AudioPlayer.pause(data.path)
}
export function stopAudio(data: API_media) {
    if (get(outLocked)) return
    AudioPlayer.stop(data.path)
}
export function audioSeekTo(data: API_seek) {
    if (get(outLocked)) return
    const audioPath = AudioPlayer.getAllPlaying()[0]
    AudioPlayer.setTime(audioPath, data.seconds)
}

let unmutedValue = 1
export function updateVolumeValues(value: number | undefined | "local", changeGain = false) {
    // api mute(unmute)
    if (value === undefined) {
        value = get(volume) ? 0 : unmutedValue
        if (!value) unmutedValue = get(volume)
    }

    if (changeGain) gain.set(Number(Number(value).toFixed(2)))
    else volume.set(Number(Number(value).toFixed(2)))
}

// TIMERS

export function timerSeekTo(data: API_seek) {
    if (get(outLocked)) return

    const timerId = data.id || get(activeTimers)[0]?.id
    const currentTimer = get(timers)[timerId]
    const time = data.seconds
    if (!currentTimer) return

    activeTimers.update((a) => {
        const index = a.findIndex((timer) => timer.id === timerId)
        if (index < 0) a.push({ ...currentTimer, id: timerId, currentTime: time, paused: true })
        else {
            a[index].currentTime = time
            delete a[index].startTime
        }

        return a
    })
}

// SPECIAL

function normalize(str: string) {
    return str
        .replace(/[ \-'’".!?]/g, "") // remove all spaces, and special characters
        .toLowerCase()
        .normalize("NFD") // Decompose accents
        .replace(/[\u0300-\u036f]/g, "") // Remove accent marks
}

export function sortByClosestMatch(array: any[], value: string, key = "name") {
    if (!value) return array

    const normalizedValue = normalize(value)

    // Filter: keep if name or any alias includes the value
    array = array.filter((a) => {
        const keyMatch = a[key] && normalize(a[key]).includes(normalizedValue)
        const aliasMatch = Array.isArray(a.aliases) && a.aliases.some((alias) => normalize(alias).includes(normalizedValue))
        return keyMatch || aliasMatch
    })

    function getSimilarityScoreAndSource(item: any) {
        const sources: { source: string; isAlias: boolean }[] = []

        if (item[key]) {
            sources.push({ source: item[key], isAlias: false })
        }

        if (Array.isArray(item.aliases)) {
            for (const alias of item.aliases) {
                sources.push({ source: alias, isAlias: true })
            }
        }

        let bestScore = -Infinity
        let bestSource: string | undefined
        let isAlias = false

        for (const { source, isAlias: aliasFlag } of sources) {
            const score = normalizedSimilarity(normalize(source), normalizedValue)
            if (score > bestScore) {
                bestScore = score
                bestSource = source
                isAlias = aliasFlag
            }
        }

        return { score: bestScore, alias: isAlias ? bestSource : undefined }
    }

    array = array.map((item) => {
        const { score, alias } = getSimilarityScoreAndSource(item)
        return {
            ...item,
            _similarityScore: score,
            ...(alias ? { aliasMatch: alias } : {})
        }
    })

    // eslint-disable-next-line
    return array.sort((a, b) => b._similarityScore - a._similarityScore).map(({ _similarityScore, ...rest }) => rest)
}

// export function sortByClosestMatch(array: any[], value: string, key = "name") {
//     if (!value) return array

//     const normalizedValue = normalize(value)

//     // Filter: check key or any alias includes the normalized value
//     array = array.filter((a) => {
//         const keyMatch = a[key] && normalize(a[key]).includes(normalizedValue)
//         const aliasMatch = Array.isArray(a.aliases) && a.aliases.some((alias) => normalize(alias.toLowerCase().replaceAll(" ", "")).includes(normalizedValue))
//         return keyMatch || aliasMatch
//     })

//     function similarityScore(item) {
//         const targets = [...(item[key] ? [normalize(item[key])] : []), ...(Array.isArray(item.aliases) ? item.aliases.map(a => normalize(a).toLowerCase().replaceAll(" ", "")) : [])]

//         const match = Math.max(...targets.map((t) => 1 / (1 + levenshteinDistance(t, normalizedValue))))
//         // if (match !== normalize(item[key]))
//         return match
//     }

//     return array.sort((a, b) => similarityScore(b) - similarityScore(a))
// }

function normalizedSimilarity(a: string, b: string): number {
    const dist = levenshteinDistance(a, b)
    const maxLength = Math.max(a.length, b.length)
    return maxLength === 0 ? 1 : 1 - dist / maxLength
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

// PDF

export async function getPDFThumbnails({ path }: API_media) {
    if (!path) return []

    GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"
    const loadingTask = getDocument(path)
    const pdfDoc = await loadingTask.promise
    const pageCount = pdfDoc.numPages

    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) return []

    const pages: string[] = []
    for (let i = 0; i < pageCount; i++) {
        const page = await pdfDoc.getPage(i + 1)
        const viewport = page.getViewport({ scale: 1.5 })

        canvas.height = viewport.height
        canvas.width = viewport.width

        await page.render({ canvas, canvasContext: context, viewport }).promise
        const base64 = canvas.toDataURL("image/jpeg")
        pages.push(base64)
    }

    loadingTask.destroy()
    return { path, pages }
}

// DRAW

export function changeDrawZoom(data: API_draw_zoom) {
    const size = data.size || 100
    drawSettings.update((a) => {
        a.zoom.size = size
        return a
    })

    if (size === 100) {
        draw.set(null)
        drawTool.set("focus")
        return
    }

    // 0-100 %
    draw.set({ x: 1920 * ((data.x ?? 50) / 100), y: 1080 * ((data.y ?? 50) / 100) })
    drawTool.set("zoom")
}

// ADD

export function addToProject(data: API_add_to_project) {
    // open altered project in the app
    activeProject.set(data.projectId)

    projects.update((a) => {
        if (!a[data.projectId]?.shows || a[data.projectId].shows.find((item) => item.id === data.id)) return a
        a[data.projectId].shows.push({ ...(data.data || {}), id: data.id })
        return a
    })

    return get(projects)
}

// CREATE

export function createProject(data: API_create_project) {
    const parentFolder = get(folders)[get(projects)[get(activeProject) || ""]?.parent] ? get(projects)[get(activeProject) || ""]?.parent || "/" : "/"
    history({ id: "UPDATE", save: false, newData: { replace: { parent: parentFolder, name: data.name } }, oldData: { id: data.id }, location: { page: "show", id: "project" } })
}

// DELETE

export function deleteProject(id: string) {
    history({ id: "UPDATE", save: false, newData: { id }, location: { page: "show", id: "project" } })
}

export function removeProjectItem(data: API_id_index) {
    // open altered project in the app
    activeProject.set(data.id)

    const projectItems = get(projects)[data.id]?.shows
    if (!projectItems.length) return

    projectItems.splice(data.index, 1)

    history({ id: "UPDATE", newData: { key: "shows", data: projectItems }, oldData: { id: data.id }, location: { page: "show", id: "project_key" } })
}

// EDIT

export function renameProject(data: any) {
    history({ id: "UPDATE", save: false, newData: { key: "name", data: data.name }, oldData: { id: data.id }, location: { page: "show", id: "project_key" } })
}
