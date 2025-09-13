import { get } from "svelte/store"
import { uid } from "uid"
import { OUTPUT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import type { Output, Outputs } from "../../../types/Output"
import type { Resolution, Styles } from "../../../types/Settings"
import type { Item, Layout, LayoutRef, Media, OutSlide, Show, Slide, SlideData, Template, Templates, TemplateSettings, Transition } from "../../../types/Show"
import { AudioAnalyser } from "../../audio/audioAnalyser"
import { fadeinAllPlayingAudio, fadeoutAllPlayingAudio } from "../../audio/audioFading"
import { sendMain } from "../../IPC/main"
import {
    actions,
    activeProject,
    activeRename,
    allOutputs,
    categories,
    currentOutputSettings,
    currentWindow,
    dictionary,
    disabledServers,
    effects,
    lockedOverlays,
    outputDisplay,
    outputs,
    outputSlideCache,
    outputState,
    overlays,
    overlayTimers,
    playingVideos,
    projects,
    scriptures,
    serverData,
    showsCache,
    special,
    stageShows,
    styles,
    templates,
    theme,
    themes,
    transitionData,
    usageLog
} from "../../stores"
import { trackScriptureUsage } from "../../utils/analytics"
import { newToast } from "../../utils/common"
import { send } from "../../utils/request"
import { sendBackgroundToStage } from "../../utils/stageTalk"
import { videoExtensions } from "../../values/extensions"
import { customActionActivation, runAction } from "../actions/actions"
import type { API_camera, API_screen, API_stage_output_layout } from "../actions/api"
import { getItemText, getItemTextArray, getSlideText } from "../edit/scripts/textStyle"
import type { EditInput } from "../edit/values/boxes"
import { clearSlide } from "../output/clear"
import { clone, keysToID, removeDuplicates, sortByName, sortObject } from "./array"
import { getExtension, getFileName, removeExtension } from "./media"
import { getLayoutRef } from "./show"
import { getFewestOutputLines, getItemWithMostLines, replaceDynamicValues } from "./showActions"
import { _show } from "./shows"
import { getStyles } from "./style"

export function toggleOutputs(outputIds: string[] | null = null, options: { force?: boolean, autoStartup?: boolean, state?: boolean } = {}) {
    if (outputIds === null) outputIds = getActiveOutputs(get(outputs), false)
    // if (outputIds === null) outputIds = Object.keys(get(outputs))

    const outputsList = outputIds.map((id) => ({ ...get(outputs)[id], id })).filter(a => a.enabled)
    if (!outputsList.length) return

    // sort so display order can be changed! (needs app restart)
    const sortedOutputs = sortObject(sortByName(outputsList), "stageOutput")

    const currentOutputState = !!get(outputState).find(a => a.id === outputIds[0])?.active
    const state = typeof options.state === "boolean" ? options.state : options.force || !(outputIds.length === 1 ? currentOutputState : get(outputDisplay))

    const autoPosition = sortedOutputs.length === 1 && !sortedOutputs[0].forcedResolution?.width

    send(OUTPUT, ["TOGGLE_OUTPUTS"], { outputs: sortedOutputs, state, force: options.force, autoStartup: options.autoStartup, autoPosition })
}

export function toggleOutput(id: string) {
    toggleOutputs([id])
}

// background: null,
// slide: null,
// overlays: [],
// transition: null,
// TODO: updating a output when a "next slide timer" is active, will "reset/remove" the "next slide timer"
let resetActionTrigger = false
export function setOutput(type: string, data: any, toggle = false, outputId = "", add = false) {
    const ref = data?.layout ? _show(data.id).layouts([data.layout]).ref()[0] || [] : []

    // track usage (& set attributionString)
    if (type === "slide" && data?.id) {
        const showReference = _show(data.id).get("reference")
        if (showReference?.type === "scripture") {
            const translation = showReference.data
            const slide = _show(data.id).get("slides")[ref[data.index]?.id]

            const scripture = get(scriptures)[translation.collection] || {}
            const versions = scripture.collection?.versions || [scripture.id || ""]
            versions.forEach((id) => {
                const name = get(scriptures)[id]?.name || translation.version || ""
                const scriptureId = get(scriptures)[id]?.id || id
                const apiId = translation.api ? scriptureId : null
                if (name || apiId) trackScriptureUsage(name, apiId, slide.group)
            })

            // set attributionString
            if (translation.attributionString) data.attributionString = translation.attributionString
        }
    }

    outputs.update((a) => {
        const bindings = data?.bindings || (data?.layout ? ref[data.index]?.data?.bindings || [] : [])
        const allOutputIds = bindings.length ? bindings : getActiveOutputs(a, true, false, true)
        const outs = outputId ? [outputId] : allOutputIds
        const inputData = clone(data)

        let firstOutputWithBackground = allOutputIds.findIndex((id) => {
            let layers = get(styles)[get(outputs)[id]?.style || ""]?.layers
            if (!Array.isArray(layers)) layers = ["background"]
            return !a[id]?.isKeyOutput && !a[id]?.stageOutput && layers.includes("background")
        })
        firstOutputWithBackground = Math.max(0, firstOutputWithBackground)

        if (type === "slide" && data?.id) {
            // reset slide cache (after update)
            setTimeout(() => outputSlideCache.set({}), 50)

            const currentOutSlideId = get(outputs)[outs?.[0]]?.out?.slide?.id || ""

            // log usage if show is not currently outputted
            if (currentOutSlideId !== data?.id) appendShowUsage(data.id)

            const overrideCategoryAction = ref[data?.index]?.data?.actions?.slideActions?.find((action) =>
                Object.values(action.customData || {}).find((a1) => Object.entries(a1).find(([key, value]) => key === "overrideCategoryAction" && value === true))
            )

            // run category action if show slide is not currently outputted, and it does not have a custom override action
            if (currentOutSlideId !== data?.id || resetActionTrigger) {
                const category = get(showsCache)[data.id]?.category || ""
                const categoryActionId = get(categories)[category]?.action
                if (!overrideCategoryAction && categoryActionId) runAction(get(actions)[categoryActionId], {}, true)
            }

            if (overrideCategoryAction) resetActionTrigger = true
            else resetActionTrigger = false
        }

        let toggleState = false
        outs.forEach((id: string, i: number) => {
            const output = a[id]
            if (!output.out) a[id].out = {}
            if (!output.out?.[type]) a[id].out![type] = type === "overlays" || type === "effects" ? [] : null
            data = clone(inputData)

            if (type === "slide" && data === null && output.out?.slide?.type === "ppt") {
                sendMain(Main.PRESENTATION_CONTROL, { action: "stop" })
            }

            if (type === "background") {
                // clear if PDF/PPT is active
                const slideContent = getOutputContent(id)
                if (data && (slideContent.type === "pdf" || slideContent.type === "ppt")) clearSlide()

                const index = allOutputIds.findIndex((outId) => outId === id)
                data = changeOutputBackground(data, { output, id, mute: allOutputIds.length > 1 && index !== firstOutputWithBackground, videoOutputId: allOutputIds[firstOutputWithBackground] })
            }

            let outData = a[id].out?.[type] || null
            if ((type === "overlays" || type === "effects") && data.length) {
                if (!Array.isArray(data)) data = [data]
                if (toggle && i === 0) toggleState = outData?.includes(data[0])
                if (toggle && toggleState) outData.splice(outData.indexOf(data[0]), 1)
                else if (toggle || add) outData = removeDuplicates([...(a[id].out?.[type] || []), ...data])
                else outData = data

                data.forEach((overlayId) => {
                    // timeout so output can update first
                    if (outData.includes(overlayId)) startOverlayTimer(id, overlayId, outData, type)
                    else if (get(overlayTimers)[id + overlayId]) clearOverlayTimer(id, overlayId)
                })
            } else {
                if (data) delete data.bindings // currently used for bg muting
                outData = data

                if (type === "overlays" || type === "effects") {
                    clearOverlayTimers(id)
                }
            }

            a[id].out![type] = clone(outData)

            // save locked overlays
            if (type === "overlays") lockedOverlays.set(outData)
        })

        return a
    })
}

export function startFolderTimer(folderPath: string, file: { type: string; path: string }) {
    // WIP timer loop does not work if project is changed (should be global for the folder instead of per project item)
    const projectItems = get(projects)[get(activeProject) || ""]?.shows
    // this does not work with multiple of the same folder
    const projectItemIndex = projectItems.findIndex((a) => a.type === "folder" && a.id === folderPath)
    const timer = Number(projectItems?.[projectItemIndex]?.data?.timer ?? 10)
    if (!timer || file.type !== "image") return

    // newSlideTimer played from Preview.svelte
    setOutput("transition", { duration: timer, folderPath })
}

function appendShowUsage(showId: string) {
    const show = get(showsCache)[showId]
    if (!show) return

    usageLog.update((a) => {
        const metadata = show.meta || {}
        // remove empty values
        Object.keys(metadata).forEach((key) => {
            if (!metadata[key]) delete metadata[key]
        })

        a.all.push({
            name: show.name,
            time: Date.now(),
            metadata
        })
        return a
    })
}

function changeOutputBackground(data, { output, id, mute, videoOutputId }) {
    if (get(currentWindow) === null) {
        setTimeout(() => {
            // update stage background if any
            sendBackgroundToStage(id)
            // send thumbnail to controller
            // sendBackgroundToController(id)
        }, 100)
    }

    const previousWasVideo: boolean = videoExtensions.includes(getExtension(output.out?.background?.path))

    if (data === null) {
        if (id === videoOutputId) fadeinAllPlayingAudio()
        if (previousWasVideo) videoEnding()

        return data
    }

    // mute videos in the other output windows if more than one
    // WIP fix multiple outputs: if an output with style without background is first the video will be muted... even if another output should not be muted
    data.muted = data.muted || false
    if (mute) data.muted = true

    const videoData = { muted: data.muted, loop: data.loop || false }

    if (id === videoOutputId) {
        const muteAudio = get(special).muteAudioWhenVideoPlays
        const isVideo = videoExtensions.includes(getExtension(data.path))
        if (!data.muted && muteAudio && isVideo) fadeoutAllPlayingAudio()
        else fadeinAllPlayingAudio()

        if (isVideo) videoStarting()
        else if (previousWasVideo) videoEnding()
    }

    // wait for video receiver to change
    setTimeout(() => {
        // data is sent directly in output as well ??
        send(OUTPUT, ["DATA"], { [id]: videoData })
        if (data.startAt !== undefined) send(OUTPUT, ["TIME"], { [id]: data.startAt || 0 })
    }, 600)

    return data
}

function videoEnding() {
    setTimeout(() => {
        customActionActivation("video_end")
    })
}
function videoStarting() {
    customActionActivation("video_start")
}

export function startCamera(cam: API_camera) {
    setOutput("background", { name: cam.name || "", id: cam.id, cameraGroup: cam.groupId, type: "camera" })
}

export function startScreen(screen: API_screen) {
    setOutput("background", { name: screen.name || "", id: screen.id, type: "screen" })
}

/// OVERLAY TIMERS

function startOverlayTimer(outputId: string, overlayId: string, outData: string[] = [], type: "overlays" | "effects" = "overlays") {
    if (!outData.length) outData = get(outputs)[outputId]?.out?.[type] || []
    if (!outData.includes(overlayId)) return

    const overlay = type === "overlays" ? get(overlays)[overlayId] : get(effects)[overlayId]
    if (!overlay?.displayDuration) return

    overlayTimers.update((a) => {
        const id = outputId + overlayId
        if (a[id]) clearTimeout(a[id].timer)

        a[id] = {
            outputId,
            overlayId,
            timer: setTimeout(() => {
                clearOverlayTimer(outputId, overlayId)
                if (!get(outputs)[outputId]?.out?.[type]?.includes(overlayId)) return

                setOutput(type, overlayId, true, outputId)
            }, overlay.displayDuration! * 1000)
        }

        return a
    })
}

export function clearOverlayTimers(outputId: string) {
    Object.values(get(overlayTimers)).forEach((a) => clearOverlayTimer(outputId, a.overlayId))
}

export function clearOverlayTimer(outputId: string, overlayId: string) {
    overlayTimers.update((a) => {
        const id = outputId + overlayId
        if (!a[id]) return a

        clearTimeout(a[id].timer)
        delete a[id]
        return a
    })
}

///

let sortedOutputs: (Output & { id: string })[] = []
export function getActiveOutputs(updater: Outputs = get(outputs), hasToBeActive = true, removeKeyOutput = false, shouldRemoveStageOutput = false) {
    // WIP cache outputs
    // if (JSON.stringify(sortedOutputs.map(({ id }) => id)) !== JSON.stringify(Object.keys(updater))) {
    //     sortedOutputs = sortByName(keysToID(updater || {}))
    // }
    sortedOutputs = sortByName(keysToID(updater || {}))

    let enabled = sortedOutputs.filter((a) => a.enabled === true && (removeKeyOutput ? !a.isKeyOutput : true) && (shouldRemoveStageOutput ? !a.stageOutput : true))

    if (hasToBeActive && enabled.filter((a) => a.active === true).length) enabled = enabled.filter((a) => a.active === true)

    let enabledIds = enabled.map((a) => a.id)

    if (!enabledIds.length) {
        if (!sortedOutputs.length && get(currentWindow) === null) addOutput(true)
        if (sortedOutputs[0]) enabledIds = [sortedOutputs[0].id]
    }

    return enabledIds
}

export function findMatchingOut(id: string, updater: Outputs = get(outputs)): string | null {
    let match: string | null = null

    // TODO: more than one active

    getActiveOutputs(updater, false, true, true).forEach((outputId: string) => {
        const output = updater[outputId]
        if (match === null && output.enabled) {
            // TODO: index & layout: $outSlide?.index === i && $outSlide?.id === $activeShow?.id && $outSlide?.layout === activeLayout
            // slides (edit) + slides
            if (output.out?.slide?.id === id) match = output.color
            else if ((output.out?.background?.path || output.out?.background?.id) === id) match = output.color
            else if (output.out?.overlays?.includes(id)) match = output.color
            else if (output.out?.effects?.includes(id)) match = output.color
        }
    })

    // if (match && match === "#F0008C" && get(themes)[get(theme)]?.colors?.secondary) {
    //   match = get(themes)[get(theme)]?.colors?.secondary
    // }

    return match
}

export function refreshOut(refresh = true) {
    outputs.update((a) => {
        getActiveOutputs().forEach((id: string) => {
            a[id].out = { ...a[id].out, refresh }
        })
        return a
    })

    if (refresh) {
        setTimeout(() => {
            refreshOut(false)
        }, 100)
    }
}

// outputs is just for updates
export function isOutCleared(key: string | null = null, updater: Outputs = get(outputs), checkLocked = false) {
    let cleared = true
    const outputIds = getActiveOutputs(updater, true, true, true)

    outputIds.forEach((outputId: string) => {
        if (!cleared) return

        const output = updater[outputId]
        const keys: string[] = key ? [key] : Object.keys(output.out || {})
        cleared = !keys.find((type: string) => {
            if (!output.out?.[type]) return

            if (type === "overlays") {
                if (checkLocked && output.out.overlays?.length) return true
                if (!checkLocked && output.out.overlays?.filter((id: string) => !get(overlays)[id]?.locked).length) return true
                return false
            }
            if (type === "effects") {
                return output.out.effects?.length
            }

            return output.out[type] !== null
        })
    })

    if (cleared && key === "transition") {
        // check overlay timers
        cleared = !outputIds.find((outputId) => Object.values(get(overlayTimers)).find((a) => a.outputId === outputId))
    }

    return cleared
}

export function getOutputContent(outputId = "", updater = get(outputs), key = "slide") {
    if (!outputId) outputId = getActiveOutputs(updater, false, true, true)[0]
    return updater[outputId]?.out?.[key] || {}
}

export function outputSlideHasContent(output) {
    if (!output) return false

    const outSlide: OutSlide = output.out?.slide
    if (!outSlide) return false

    const showRef = _show(outSlide.id).layouts([outSlide.layout]).ref()[0] || []
    if (!showRef.length) return false

    const currentSlide = _show(outSlide.id).slides([showRef[outSlide.index!]?.id]).get()?.[0]
    if (!currentSlide) return false

    return !!getSlideText(currentSlide)?.length
}

// WIP style should override any slide resolution & color ? (it does not)

// this actually gets aspect ratio
export function getResolution(initial: Resolution | undefined | null = null, _updater: any = null, _getSlideRes = false, outputId = "", styleIdOverride = ""): Resolution {
    if (initial) return initial

    if (!outputId) outputId = getActiveOutputs()[0]
    const currentOutput = get(outputs)[outputId]

    if (currentOutput?.stageOutput) return currentOutput.bounds

    const style = styleIdOverride || currentOutput?.style ? get(styles)[(styleIdOverride || currentOutput?.style)!] || null : null
    const styleRatio: any = style?.aspectRatio || style?.resolution

    const ratio = styleRatio?.outputResolutionAsRatio ? currentOutput?.bounds : styleRatio

    return ratio || { width: 16, height: 9 }
}

// this will get the first available stage output
export function getStageOutputId(_updater = get(outputs)) {
    return keysToID(_updater).find((a) => a.stageOutput && a.enabled)?.id || ""
}
export function getStageResolution(outputId = "", _updater = get(outputs)): Resolution {
    if (!outputId) outputId = getStageOutputId()
    return getOutputResolution(outputId)
}

// calculate actual output resolution based on style aspect ratio
export const DEFAULT_BOUNDS = { width: 1920, height: 1080 }
export function getOutputResolution(outputId: string, _updater = get(outputs), scaled = false, styleIdOverride = "") {
    const currentOutput = _updater[outputId]
    const outputRes = clone(currentOutput?.bounds || DEFAULT_BOUNDS)

    const styleRatio = getResolution(null, null, false, outputId, styleIdOverride)
    const styleAspectRatio = styleRatio.width / styleRatio.height

    const defaultRatio = DEFAULT_BOUNDS.width / DEFAULT_BOUNDS.height

    // set the width OR height based on the relative size
    const outputAspectRatio = outputRes.width / outputRes.height
    if (outputAspectRatio < 1 && styleAspectRatio > 1 && styleAspectRatio === defaultRatio) {
        outputRes.height = DEFAULT_BOUNDS.height
        outputRes.width = Math.round(DEFAULT_BOUNDS.height * outputAspectRatio)
    } else {
        outputRes.width = DEFAULT_BOUNDS.width
        outputRes.height = Math.round(DEFAULT_BOUNDS.width / outputAspectRatio)
    }

    if (!scaled) return outputRes

    // return styleRatio

    // output window size is narrow
    //  && outputAspectRatio > 1
    if (styleAspectRatio < 1) {
        outputRes.width = Math.round(outputRes.height * styleAspectRatio)
    } else {
        outputRes.height = Math.round(outputRes.width / styleAspectRatio)
    }

    // WIP: correct values....
    // const outputRes2 = clone(currentOutput?.bounds || DEFAULT_BOUNDS)
    // const newAspectRatio = outputRes.width / outputRes.height
    // if (outputRes2.width < outputRes2.height) {
    //     outputRes2.height = Math.round(newAspectRatio < 1 && styleAspectRatio > 1 ? outputRes2.width * newAspectRatio : outputRes2.width / newAspectRatio)
    //     // outputRes2.width = outputRes2.width
    // } else {
    //     outputRes2.width = Math.round(newAspectRatio < 1 && styleAspectRatio > 1 ? outputRes2.height / newAspectRatio : outputRes2.height * newAspectRatio)
    // }

    // if (newStyleAspectRatio < 1) {
    //     outputRes2.height = Math.round(outputRes.width / newStyleAspectRatio)
    // } else {
    //     outputRes2.width = Math.round(outputRes.height * newStyleAspectRatio)
    // }

    return outputRes
}

export function stylePosToPercentage(stylesData: { [key: string]: any }) {
    if (stylesData.left) stylesData.left = (Number(stylesData.left) / DEFAULT_BOUNDS.width) * 100
    if (stylesData.top) stylesData.top = (Number(stylesData.top) / DEFAULT_BOUNDS.height) * 100
    if (stylesData.width) stylesData.width = (Number(stylesData.width) / DEFAULT_BOUNDS.width) * 100
    if (stylesData.height) stylesData.height = (Number(stylesData.height) / DEFAULT_BOUNDS.height) * 100

    return stylesData
}

export function percentageStylePos(style: string, resolution: Resolution) {
    let stylesData = getStyles(style, true)
    stylesData = stylePosToPercentage(stylesData)

    const aspectRatio = resolution.width / resolution.height
    const width = DEFAULT_BOUNDS.width
    const height = DEFAULT_BOUNDS.width / aspectRatio

    if (stylesData.left) style += "left: " + width * (Number(stylesData.left) / 100) + "px;"
    if (stylesData.top) style += "top: " + height * (Number(stylesData.top) / 100) + "px;"
    if (stylesData.width) style += "width: " + width * (Number(stylesData.width) / 100) + "px;"
    if (stylesData.height) style += "height: " + height * (Number(stylesData.height) / 100) + "px;"

    return style
}

export function percentageToAspectRatio(input: EditInput) {
    if (input.id !== "style") return input

    if (input.key === "left" || input.key === "width") input.value = DEFAULT_BOUNDS.width * (trimPixelValue(input.value) / 100) + "px"
    else if (input.key === "top" || input.key === "height") input.value = DEFAULT_BOUNDS.height * (trimPixelValue(input.value) / 100) + "px"

    return input
}

function trimPixelValue(value: any) {
    return Number(value?.toString().replace("px", ""))
}

export function checkWindowCapture(startup = false) {
    getActiveOutputs(get(outputs), false, true, true).forEach((a) => shouldBeCaptured(a, startup))

    AudioAnalyser.recorderActivate()
}

// NDI | OutputShow | Stage CurrentOutput
export function shouldBeCaptured(outputId: string, startup = false) {
    const output = get(outputs)[outputId]
    const captures = {
        ndi: !!output.ndi,
        server: !!(get(disabledServers).output_stream === false && (get(serverData)?.output_stream?.outputId || getActiveOutputs(get(outputs), false, true, true)[0]) === outputId),
        stage: stageHasOutput(outputId)
    }

    // alert user that screen recording starts
    if (!startup && Object.values(captures).filter(Boolean).length) newToast("toast.output_capture_enabled")

    send(OUTPUT, ["CAPTURE"], { id: outputId, captures })
}
function stageHasOutput(outputId: string) {
    return !!Object.keys(get(stageShows)).find((stageId) => {
        const stageLayout = get(stageShows)[stageId]
        let outputItem = stageLayout.items ? stageLayout.items["output#current_output"] : undefined

        if (!outputItem?.enabled) {
            outputItem = Object.values(stageLayout.items).find((a) => a.type === "current_output")
            if (!outputItem) return false
        }

        return (stageLayout.settings?.output || outputId) === outputId

        // WIP check that this stage layout is not disabled & used in a output or (web enabled (disabledServers) + has connection)!
    })
}

// settings

export const defaultOutput: Output = {
    enabled: true,
    active: true,
    name: "Output",
    color: "#F0008C",
    bounds: { x: 0, y: 0, width: 1920, height: 1080 }, // x: 1920 ?
    screen: null
}

export function keyOutput(keyId: string, delOutput = false) {
    if (!keyId) return

    if (delOutput) {
        deleteOutput(keyId)
        return
    }

    // create new "key" output
    outputs.update((a) => {
        const currentOutput = clone(defaultOutput)
        currentOutput.name = "Key"
        currentOutput.isKeyOutput = true
        a[keyId] = currentOutput

        // show
        // , rate: get(special).previewRate || "auto"
        send(OUTPUT, ["CREATE"], { id: keyId, ...currentOutput })
        if (get(outputDisplay)) toggleOutput(keyId)

        return a
    })
}

// WIP history
export function addOutput(onlyFirst = false, styleId = "") {
    if (onlyFirst && get(outputs).length) return

    outputs.update((output) => {
        const id = uid()
        if (get(themes)[get(theme)]?.colors?.secondary) defaultOutput.color = get(themes)[get(theme)].colors.secondary!
        output[id] = clone(defaultOutput)
        if (styleId) output[id].style = styleId

        // set name
        let n = 0
        while (Object.values(output).find((a) => a.name === output[id].name + (n ? " " + n : ""))) n++
        if (n) output[id].name = output[id].name + " " + n
        if (onlyFirst) output[id].name = get(dictionary).theme?.primary || "Primary"

        // show
        // , rate: get(special).previewRate || "auto"
        if (!onlyFirst) send(OUTPUT, ["CREATE"], { id, ...output[id] })
        if (!onlyFirst && get(outputDisplay)) toggleOutput(id)

        if (get(currentOutputSettings) !== id) currentOutputSettings.set(id)
        activeRename.set("output_" + id)
        return output
    })
}

// WIP history
export function enableStageOutput(options: any = {}) {
    const outputIds = getActiveOutputs()
    const bounds = get(outputs)[outputIds[0]]?.bounds || { x: 0, y: 0, width: 100, height: 100 }
    const id = uid()

    outputs.update((a) => {
        a[id] = {
            enabled: true,
            active: true,
            stageOutput: "",
            name: "",
            color: "#555555",
            bounds,
            screen: null,
            ...options
        }

        send(OUTPUT, ["CREATE"], { ...a[id], id })
        activeRename.set("output_" + id)

        return a
    })

    return id
}

export function removeStageOutput(outputId: string) {
    outputs.update((a) => {
        if (!a[outputId]) return a

        delete a[outputId]
        send(OUTPUT, ["REMOVE"], { id: outputId })

        return a
    })
}

export function changeStageOutputLayout(data: API_stage_output_layout) {
    const outputIds = data.outputId ? [data.outputId] : Object.keys(get(outputs))

    outputs.update((a) => {
        outputIds.forEach((id) => {
            if (!a[id]?.stageOutput) return
            a[id].stageOutput = data.stageLayoutId
        })

        return a
    })
}

export function deleteOutput(outputId: string) {
    if (Object.keys(get(outputs)).length <= 1) return

    outputs.update((a) => {
        const isKeyOutput = a[outputId].isKeyOutput

        send(OUTPUT, ["REMOVE"], { id: outputId })
        delete a[outputId]

        if (!isKeyOutput) currentOutputSettings.set(Object.keys(a)[0])
        return a
    })
}

export async function clearPlayingVideo(clearOutput = "") {
    const mediaTransition: Transition = getCurrentMediaTransition()

    let duration = (mediaTransition?.duration || 0) + 200
    if (!clearOutput) duration /= 2.4 // a little less than half the time

    return new Promise((resolve) => {
        setTimeout(() => {
            // remove from playing
            playingVideos.update((playingVideo) => {
                let existing = -1
                do {
                    existing = playingVideo.findIndex((a) => (clearOutput ? a.id === clearOutput : a.location === "output") || a.location === "preview")
                    if (existing > -1) playingVideo.splice(existing, 1)
                } while (existing > -1)

                return playingVideo
            })
            // playingVideos.set([])

            //   let video = null
            const videoData = {
                time: 0,
                duration: 0,
                paused: !!clearOutput,
                muted: false,
                loop: false
            }

            // if (!AudioAnalyser.shouldAnalyse()) {
            //     // wait for video to clear in output
            //     setTimeout(() => AudioAnalyserMerger.stop(), 5000)
            // }

            // send(OUTPUT, ["UPDATE_VIDEO"], { id: clearOutput, data: videoData, time: 0 })

            resolve(videoData)
        }, duration)
    })
}

export function getCurrentMediaTransition() {
    const transition: Transition = get(transitionData).media

    const outputId = getActiveOutputs(get(outputs))[0]
    const currentOutput = get(outputs)[outputId] || {}
    const out = currentOutput?.out || {}
    const slide = out.slide || null
    const slideData = get(showsCache) && slide && slide.id !== "temp" ? getLayoutRef(slide.id)[slide.index!]?.data : null
    const slideMediaTransition = slideData ? slideData.mediaTransition : null

    return slideMediaTransition || transition
}

// TEMPLATE

export function mergeWithTemplate(slideItems: Item[], templateItems: Item[], addOverflowTemplateItems = false, resetAutoSize = true, templateClicked = false) {
    // if (!slideItems?.length && !addOverflowTemplateItems) return []
    slideItems = clone(slideItems || []).filter((a) => a && (!templateClicked || !a.fromTemplate))

    if (!templateItems.length) return slideItems
    templateItems = clone(templateItems).reverse()

    const sorted = sortItemsByType(templateItems)
    const sortedTemplateItems = clone(sorted)

    // reduce template textboxes to slide items
    const slideTextboxes = slideItems.reduce((count, a) => (count += (a?.type || "text") === "text" ? 1 : 0), 0)
    if (!templateClicked && slideTextboxes < (sortedTemplateItems.text?.length || 0)) {
        sortedTemplateItems.text = sortedTemplateItems.text.slice(0, slideTextboxes)
    }

    // remove slide items if no text
    if (addOverflowTemplateItems && templateItems.length < slideItems.length) {
        slideItems = slideItems.filter((a) => (a?.type || "text") !== "text" || getItemText(a).length)
    }

    let newSlideItems: Item[] = []
    slideItems.forEach((item: Item) => {
        if (!item) return

        const type = item.type || "text"

        const templateItem = sortedTemplateItems[type]?.shift()
        if (!templateItem) return finish()

        item.style = templateItem.style || ""
        item.align = templateItem.align || ""

        if (resetAutoSize) delete item.autoFontSize
        item.auto = templateItem.auto || false
        if (templateItem.textFit) item.textFit = templateItem.textFit
        if (templateItem.list) item.list = templateItem.list

        // use original line reveal if style template does not have the value set
        const hasLineReveal = item.lineReveal
        if (hasLineReveal && !addOverflowTemplateItems) templateItem.lineReveal = true
        // const hasClickReveal = item.clickReveal
        // if (hasClickReveal) templateItem.clickReveal = true

        // remove exiting styling & add new if set in template
        const extraStyles = ["chords", "textFit", "actions", "specialStyle", "scrolling", "bindings", "conditions", "clickReveal", "lineReveal", "fit", "filter", "flipped", "flippedY"]
        extraStyles.forEach((style) => {
            delete item[style]
            if (templateItem[style]) item[style] = templateItem[style]
        })

        if (type !== "text") return finish()

        const allTextColors = [
            ...new Set(
                item.lines
                    ?.map((line) => line.text?.filter((a) => !a.customType).map((text) => getStyles(text.style).color || "#FFFFFF"))
                    .flat()
                    .filter(Boolean)
            )
        ] as string[]

        item.lines?.forEach((line, j) => {
            const templateLine = templateItem?.lines?.[j] || templateItem?.lines?.[0]

            line.align = templateLine?.align || ""
            line.text?.forEach((text, k) => {
                const templateText = templateLine?.text?.[k] || templateLine?.text?.[0]
                if (!text.customType?.includes("disableTemplate")) {
                    let style = templateText?.style || ""

                    // add original text color, if template is not clicked & slide text has multiple colors
                    // - use template color if item text has just one color
                    if (!templateClicked && allTextColors.length > 1) {
                        const textColor = getStyles(text.style).color || "#FFFFFF"
                        style += `color: ${textColor};`
                    }

                    text.style = style
                }

                const firstChar = templateText?.value?.[0] || ""

                // add dynamic values
                if (!text.value?.length && firstChar === "{" && templateItem?.lines?.[j]) {
                    text.value = templateText!.value
                }

                if (!text.value?.[0]) return

                // add bullets
                if (firstChar === "•" || firstChar === "-") {
                    if (text.value[0] === firstChar) return
                    line.text[k].value = `${firstChar} ${text.value.trim()}`
                } else if (addOverflowTemplateItems && (text.value[0] === "•" || text.value[0] === "-")) {
                    // remove bullets
                    line.text[k].value = text.value.replace(text.value[0], "").trim()
                }
            })
        })

        finish()
        function finish() {
            newSlideItems.push(item)
        }
    })

    if (addOverflowTemplateItems) {
        const remainingTextTemplateItems = sorted.text?.slice(slideTextboxes) || []
        sortedTemplateItems.text = removeTextValue(remainingTextTemplateItems)
    } else {
        delete sortedTemplateItems.text

        // // don't add overflow textboxes that are not empty or does not have a dynamic value ({) ?
        // sortedTemplateItems.text = sortedTemplateItems.text.filter(a => {
        //     const text = getItemText(a)
        //     return !text || text.includes("{")
        // })
    }

    // remove textbox items
    templateItems = templateItems.filter((a) => (a.type || "text") !== "text")
    // remove any duplicate values
    templateItems = templateItems.filter((item) => !newSlideItems.find((a) => JSON.stringify(item) === JSON.stringify(a)))

    // this will ensure the correct order on the remaining items
    const remainingCount = Object.values(sortedTemplateItems).reduce((value, items) => (value += items.length), 0)
    let remainingTemplateItems = remainingCount ? templateItems.slice(remainingCount * -1) : []
    // add template marker
    remainingTemplateItems = remainingTemplateItems.map((a) => ({ ...a, fromTemplate: true }))
    // add behind existing items (any textboxes previously on top not in use will not be replaced by any underneath)
    newSlideItems = [...remainingTemplateItems, ...newSlideItems, ...(sortedTemplateItems.text || [])]

    return newSlideItems.reverse()
}

export function updateSlideFromTemplate(slide: Slide, template: Template, isFirst = false, removeOverflow = false) {
    const settings = template.settings || {}

    // if (settings.resolution || slide.settings.resolution) slide.settings.resolution = getResolution(settings.resolution)
    if (isFirst && (settings.firstSlideTemplate || removeOverflow)) slide.settings.template = settings.firstSlideTemplate || ""
    if (settings.backgroundColor || slide.settings.color) slide.settings.color = settings.backgroundColor || ""

    // add overlay items to slide items
    if (removeOverflow && settings.overlayId) {
        const overlayItems = get(overlays)[settings.overlayId]?.items || []
        slide.items.push(...overlayItems)
    }

    return slide
}

export function updateLayoutsFromTemplate(
    layouts: { [key: string]: Layout },
    media: { [key: string]: Media },
    template: Template,
    oldTemplate: Template,
    layoutId: string,
    slideRef: LayoutRef,
    templateMode: "global" | "group" | "slide",
    removeOverflow = false
) {
    if (typeof layouts !== "object") layouts = {}
    if (typeof media !== "object") media = {}

    // only alter layout slides if clicking on the template
    if (templateMode === "global" && !removeOverflow) return { layouts, media }

    // no need to add background/actions to slide/group children
    if (slideRef.type !== "parent") return { layouts, media }

    const slideIndex = slideRef.index
    if (!layouts[layoutId]?.slides?.[slideIndex]) return { layouts, media }

    const slide = layouts[layoutId].slides[slideIndex]
    const settings = template.settings || {}
    const oldSettings = oldTemplate.settings || {}

    let bgId = ""
    if (settings.backgroundPath) {
        // find existing
        const existingId = Object.keys(media).find((id) => (media[id].path || media[id].id) === settings.backgroundPath)
        bgId = existingId || uid()
        if (!existingId) media[bgId] = { path: settings.backgroundPath, name: removeExtension(getFileName(settings.backgroundPath)) }
    } else if ((templateMode !== "global" || slideIndex === 0) && oldSettings.backgroundPath && oldSettings.backgroundPath === media[slide.background || ""]?.path) {
        // remove background if previous template has current background
        if (slide.background) slide.background = ""
    }

    if (settings.backgroundPath) slide.background = bgId
    if (settings.actions?.length) {
        if (!slide.actions) slide.actions = {}

        // remove existing
        const newSlideActions: any[] = []
        slide.actions.slideActions?.forEach((action) => {
            if (settings.actions?.find((a) => a.id === action.id || a.triggers?.[0] === action.triggers?.[0])) return
            newSlideActions.push(action)
        })

        slide.actions.slideActions = [...newSlideActions, ...settings.actions]
    }

    layouts[layoutId].slides[slideIndex] = slide
    return { layouts, media }
}

function getSlideItemsFromTemplate(templateSettings: TemplateSettings) {
    const newItems: Item[] = []

    // these are set by the output style: resolution, backgroundColor, backgroundPath
    // this is not relevant: firstSlideTemplate

    // add overlay items
    if (templateSettings.overlayId) {
        const overlayItems = get(overlays)[templateSettings.overlayId]?.items || []
        newItems.push(...overlayItems)
    }

    return newItems
}

function removeTextValue(items: Item[]) {
    items.forEach((item) => {
        if (!item.lines) return
        item.lines = item.lines.map((line) => ({ align: line.align, text: [{ style: line.text?.[0]?.style, value: getTemplateText(line.text?.[0]?.value) }] }))
    })

    return items
}

export function getTemplateText(value) {
    // if text has {} it will not get removed (useful for preset text, and dynamic values)
    if (value?.includes("{")) return value
    return ""
}

export function isEmptyOrSpecial(item: Item) {
    const text = getItemText(item)
    if (!text.length) return true
    if (getTemplateText(text)) return true

    return false
}

export function isEmpty(item: Item) {
    return !getItemText(item).length
}

export function sortItemsByType(items: Item[]) {
    const sortedItems: { [key: string]: Item[] } = {}

    items.forEach((item) => {
        const type = item.type || "text"
        if (!sortedItems[type]) sortedItems[type] = []

        sortedItems[type].push(item)
    })

    return sortedItems
}

export function getItemsCountByType(items: Item[]) {
    const sortedItems = sortItemsByType(items)
    const typeCount: { [key: string]: number } = {}

    Object.keys(sortedItems).forEach((type) => {
        typeCount[type] = sortedItems[type].length
    })

    return typeCount
}

// OUTPUT COMPONENT

export const defaultLayers: string[] = ["background", "slide", "overlays"]

export function getCurrentStyle(stylesUpdater: { [key: string]: Styles }, styleId: string | undefined): Styles {
    const defaultStyle = { name: "" }

    if (!styleId) return defaultStyle
    return stylesUpdater[styleId] || defaultStyle
}

export function getOutputTransitions(slideData: SlideData | null, styleTransition: any, transitionDataUpdater: any, disableTransitions: boolean) {
    let transitions: { [key: string]: Transition } = {}

    if (disableTransitions) {
        const disabled: Transition = { type: "none", duration: 0, easing: "" }
        transitions = { text: disabled, media: disabled, overlay: disabled }
        return clone(transitions)
    }

    const slideTransitions = {
        text: slideData?.transition?.type ? slideData.transition : null,
        media: slideData?.mediaTransition?.type ? slideData.mediaTransition : null
    }

    const styleTransitions = {
        text: styleTransition?.text || null,
        media: styleTransition?.media || null
    }

    transitions.text = slideTransitions.text || styleTransitions.text || transitionDataUpdater.text || {}
    transitions.media = slideTransitions.media || styleTransitions.media || transitionDataUpdater.media || {}
    transitions.overlay = styleTransitions.text || transitionDataUpdater.text || {}

    return clone(transitions)
}

export function getStyleTemplate(outSlide: OutSlide, currentStyle: Styles | undefined) {
    if (!currentStyle) return {} as Template

    // scripture
    const reference = _show(outSlide?.id).get("reference")
    const isScripture = outSlide?.id === "temp" || reference?.type === "scripture"

    const translations: number = outSlide?.id === "temp" ? outSlide.translations || 1 : reference?.data?.translations || reference?.data?.version?.split("+")?.length || 1
    const translationKey = translations > 1 ? `_${translations}` : ""

    const templateId = isScripture ? currentStyle[`templateScripture${translationKey}`] || currentStyle.templateScripture : currentStyle.template
    const template = get(templates)[templateId || ""] || {}

    return template
}

export function slideHasAutoSizeItem(slide: Slide | Template) {
    return slide?.items?.find((a) => a.auto)
}

export function setTemplateStyle(outSlide: OutSlide, currentStyle: Styles, items: Item[] | undefined, outputId: string) {
    const isDrawerScripture = outSlide?.id === "temp"
    const slideItems = isDrawerScripture ? outSlide.tempItems : items?.filter(checkSpecificOutput)

    const template = getStyleTemplate(outSlide, currentStyle)
    const templateItems = template.items || []
    const newItems = mergeWithTemplate(slideItems || [], templateItems, true) || []
    newItems.push(...getSlideItemsFromTemplate(template.settings || {}))

    return newItems

    function checkSpecificOutput(item: Item) {
        return !item.bindings?.length || item.bindings.includes(outputId)
    }
}

// , currentSlide: Slide | null = null
export function getOutputLines(outSlide: OutSlide, styleLines = 0) {
    if (!outSlide?.id || outSlide.id === "temp") return { start: null, end: null } // , index: 0, max: 0

    const ref = _show(outSlide.id).layouts([outSlide.layout]).ref()[0]
    const showSlide: Slide | null =
        _show(outSlide.id)
            .slides([ref?.[outSlide.index ?? -1]?.id])
            .get()[0] || null
    const maxLines = showSlide ? getItemWithMostLines(showSlide) : 0

    const clickRevealItems = (showSlide?.items || []).filter((a) => a.clickReveal)
    const clickRevealed = clickRevealItems.length ? !!outSlide.itemClickReveal : true

    if (!maxLines) return { start: null, end: null, clickRevealed } // , index: 0, max: 0

    let progress = ((outSlide.line || 0) + 1) / maxLines

    const maxStyleLines = Number(styleLines || 0)

    // ensure last content is shown when e.g. two styles has 2 & 3 lines, and the slide has 4 lines
    const outputsList = get(currentWindow) === "output" ? get(allOutputs) : get(outputs)
    const amountOfLinesToShow: number = getFewestOutputLines(outputsList)
    if ((outSlide.line || 0) + amountOfLinesToShow > maxLines) progress = 1

    const linesIndex = Math.ceil(maxLines * progress) - 1
    let start = maxStyleLines ? maxStyleLines * Math.floor(linesIndex / maxStyleLines) : 0

    // current style lines does not match another output lines index
    // e.g. styles set to 5 lines & 2 lines, with slide text of 6 lines
    const highestLinePos = getHighestOutputLinePos()
    const isEnding = maxLines && highestLinePos + amountOfLinesToShow >= maxLines
    const overflow = maxStyleLines ? maxLines % maxStyleLines : 0
    if (isEnding && overflow > 0) start = maxLines - overflow

    const end = start + maxStyleLines

    // if the value is 3 & 2 lines, with slide text of 6 lines, the center will not match, but I probably can't do anything about that

    // lines reveal
    const linesRevealItems = (showSlide?.items || []).filter((a) => a.lineReveal)
    const currentReveal = outSlide.revealCount ?? 0
    let linesStart: number | null = null
    let linesEnd: number | null = null
    if (linesRevealItems.length) {
        linesStart = maxStyleLines ? Math.max(0, currentReveal - maxStyleLines) : 0
        linesEnd = currentReveal
    }

    return {
        start: !!maxStyleLines ? start : null,
        end: !!maxStyleLines ? end : null,
        linesStart: !!linesRevealItems.length ? linesStart : null,
        linesEnd: !!linesRevealItems.length ? linesEnd : null,
        clickRevealed
    } // , index: linesIndex, max: maxStyleLines
}

function getHighestOutputLinePos() {
    const outputsList = get(currentWindow) === "output" ? get(allOutputs) : get(outputs)
    const outputIds = getActiveOutputs(outputsList, true, true, true)
    let highestLine = 0
    outputIds.forEach((outputId) => {
        const outputSlide = outputsList[outputId]?.out?.slide
        const line = Number(outputSlide?.line || 0)
        if (line > highestLine) highestLine = line
    })
    return highestLine
}

// METADATA

// WIP dynamic placeholder values??: {meta_title?No title}
export const DEFAULT_META_LAYOUT = "Title: {meta_title?No title}; {meta_artist}; {meta_author}; {meta_year};\n{meta_copyright}"
export function createMetadataLayout(layout: string, ref: any, _updater = 0) {
    return replaceDynamicValues(layout, ref)
}

export interface OutputMetadata {
    message?: { [key: string]: string }
    display?: string
    style?: string
    transition?: any
    value?: string
    media?: boolean
    condition?: any

    messageStyle?: string
    messageTransition?: any
}
const defaultMetadataStyle = "top: 910px;inset-inline-start: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 30px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
const defaultMessageStyle = "top: 50px;inset-inline-start: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 50px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
export function getMetadata(oldMetadata: any, show: Show | undefined, currentStyle: Styles, templatesUpdater = get(templates), outSlide: OutSlide | null) {
    const metadata: OutputMetadata = { style: getTemplateStyle("metadata", templatesUpdater) || defaultMetadataStyle }

    if (!show) return metadata
    const settings: any = show.metadata || {}
    const overrideOutput = settings.override
    const templateId: string = overrideOutput ? settings.template : currentStyle.metadataTemplate || "metadata"

    metadata.media = settings.autoMedia
    metadata.message = metadata.media ? {} : show.meta
    metadata.display = overrideOutput ? settings.display : currentStyle.displayMetadata
    metadata.style = getTemplateStyle(templateId, templatesUpdater) || defaultMetadataStyle
    metadata.style += getTemplateAlignment(templateId, templatesUpdater)
    metadata.transition = templatesUpdater[templateId]?.items?.[0]?.actions?.transition || null
    metadata.condition = templatesUpdater[templateId]?.items?.[0]?.conditions || {}

    const metadataTemplateValue = getItemTextArray(templatesUpdater[templateId]?.items?.[0])
    // if (metadataTemplateValue || metadata.message || currentStyle)
    getMetaValue()
    function getMetaValue() {
        if (metadata.media) {
            metadata.value = oldMetadata.value || ""
            return
        }

        if (metadataTemplateValue.find((a) => a.includes("{"))) {
            if (!outSlide) return
            const ref = { showId: outSlide.id, layoutId: outSlide.layout, slideIndex: outSlide.index }
            metadata.value = replaceDynamicValues(metadataTemplateValue.join("<br>"), ref)
            return
        }

        if (!metadata.message) return

        // metadata.value = currentStyle.metadataLayout || DEFAULT_META_LAYOUT
        metadata.value = joinMetadata(metadata.message, currentStyle.metadataDivider)
    }

    const messageTemplate = overrideOutput ? show.message?.template || "" : currentStyle.messageTemplate || "message"
    metadata.messageStyle = getTemplateStyle(messageTemplate, templatesUpdater) || defaultMessageStyle
    metadata.messageStyle += getTemplateAlignment(messageTemplate, templatesUpdater)
    metadata.messageTransition = templatesUpdater[messageTemplate]?.items?.[0]?.actions?.transition || null

    return clone(metadata)
}
export function joinMetadata(message: { [key: string]: string }, divider = "; ") {
    return Object.values(message)
        .filter((a: string) => a.length)
        .join(divider)
}

function getTemplateStyle(templateId: string, templatesUpdater: Templates) {
    if (!templateId) return
    const template = templatesUpdater[templateId]
    if (!template) return

    const style = template.items?.[0]?.style || ""
    const textStyle = template.items?.[0]?.lines?.[0]?.text?.[0]?.style || ""

    return style + textStyle
}

function getTemplateAlignment(templateId: string, templatesUpdater: Templates) {
    if (!templateId) return
    const template = templatesUpdater[templateId]
    if (!template) return

    const itemAlign = template.items?.[0]?.align || ""
    const lineAlign = template.items?.[0]?.lines?.[0]?.align || ""

    return itemAlign + lineAlign.replace("text-align", "justify-content")
}

export function decodeExif(data: any) {
    const message: any = {}

    const exif = data.exif
    if (!exif) return message

    if (exif.exif.DateTimeOriginal) message.taken = "Date: " + exif.exif.DateTimeOriginal
    if (exif.exif.ApertureValue) message.aperture = "Aperture: " + exif.exif.ApertureValue
    if (exif.exif.BrightnessValue) message.brightness = "Brightness: " + exif.exif.BrightnessValue
    if (exif.exif.ExposureTime) message.exposure_time = "Exposure Time: " + exif.exif.ExposureTime.toFixed(4)
    if (exif.exif.FNumber) message.fnumber = "F Number: " + exif.exif.FNumber
    if (exif.exif.Flash) message.flash = "Flash: " + exif.exif.Flash
    if (exif.exif.FocalLength) message.focallength = "Focal Length: " + exif.exif.FocalLength
    if (exif.exif.ISO) message.iso = "ISO: " + exif.exif.ISO
    if (exif.exif.InteropOffset) message.interopoffset = "Interop Offset: " + exif.exif.InteropOffset
    if (exif.exif.LightSource) message.lightsource = "Light Source: " + exif.exif.LightSource
    if (exif.exif.ShutterSpeedValue) message.shutterspeed = "Shutter Speed: " + exif.exif.ShutterSpeedValue

    if (exif.exif.LensMake) message.lens = "Lens: " + exif.exif.LensMake
    if (exif.exif.LensModel) message.lensmodel = "Lens Model: " + exif.exif.LensModel

    if (exif.gps.GPSLatitude) message.gps = "Position: " + exif.gps.GPSLatitudeRef + exif.gps.GPSLatitude[0]
    if (exif.gps.GPSLongitude) message.gps += " " + exif.gps.GPSLongitudeRef + exif.gps.GPSLongitude[0]
    if (exif.gps.GPSAltitude) message.gps += " " + exif.gps.GPSAltitude

    if (exif.image.Make) message.device = "Device: " + exif.image.Make
    if (exif.image.Model) message.device += " " + exif.image.Model
    if (exif.image.Software) message.software = "Software: " + exif.image.Software

    return message
}

export function getSlideFilter(slideData: SlideData | null) {
    return slideData?.filter ? "filter: " + slideData.filter + ";" : ""
    // let slideFilter = ""

    // if (!slideData) return slideFilter
    // if (Array.isArray(slideData.filterEnabled) && !slideData.filterEnabled?.includes("background")) return slideFilter

    // if (slideData.filter) slideFilter += "filter: " + slideData.filter + ";"
    // if (slideData["backdrop-filter"]) slideFilter += "backdrop-filter: " + slideData["backdrop-filter"] + ";"

    // return slideFilter
}

export function getBlending() {
    const blending = Object.values(get(outputs))[0]?.blending
    if (!blending) return ""

    if (!blending.left && !blending.right) return ""

    const opacity = (blending.opacity ?? 50) / 100
    const center = 50 + Number(blending.offset || 0)
    if (blending.centered) return `-webkit-mask-image: linear-gradient(${blending.rotate ?? 90}deg, rgb(0, 0, 0) ${center - blending.left}%, rgba(0, 0, 0, ${opacity}) ${center}%, rgb(0, 0, 0) ${center + Number(blending.right)}%);`
    return `-webkit-mask-image: linear-gradient(${blending.rotate ?? 90}deg, rgba(0, 0, 0, ${opacity}) 0%, rgb(0, 0, 0) ${blending.left}%, rgb(0, 0, 0) ${100 - blending.right}%, rgba(0, 0, 0, ${opacity}) 100%);`
}
