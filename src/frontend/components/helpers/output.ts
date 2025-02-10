import { get } from "svelte/store"
import { uid } from "uid"
import { MAIN, OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import type { Resolution, Styles } from "../../../types/Settings"
import type { Item, Layout, Media, OutSlide, Show, Slide, Template, TemplateSettings, Transition } from "../../../types/Show"
import {
    activeRename,
    categories,
    currentOutputSettings,
    currentWindow,
    dictionary,
    disabledServers,
    lockedOverlays,
    midiIn,
    outputDisplay,
    outputs,
    outputSlideCache,
    overlays,
    overlayTimers,
    playingVideos,
    serverData,
    showsCache,
    special,
    stageShows,
    styles,
    templates,
    theme,
    themes,
    transitionData,
    usageLog,
} from "../../stores"
import { newToast } from "../../utils/common"
import { send } from "../../utils/request"
import { sendBackgroundToStage } from "../../utils/stageTalk"
import { videoExtensions } from "../../values/extensions"
import { customActionActivation, runAction } from "../actions/actions"
import type { API_camera, API_stage_output_layout } from "../actions/api"
import { getItemText, getSlideText } from "../edit/scripts/textStyle"
import { clearSlide } from "../output/clear"
import { clone, keysToID, removeDuplicates, sortByName, sortObject } from "./array"
import { fadeinAllPlayingAudio, fadeoutAllPlayingAudio } from "./audio"
import { getExtension, getFileName, removeExtension } from "./media"
import { getItemWithMostLines, replaceDynamicValues } from "./showActions"
import { _show } from "./shows"
import { getStyles } from "./style"

export function displayOutputs(e: any = {}, auto: boolean = false) {
    let forceKey = e.ctrlKey || e.metaKey

    // sort so display order can be changed! (needs app restart)
    let enabledOutputs: any[] = sortObject(sortByName(getActiveOutputs(get(outputs), false).map((id) => ({ ...get(outputs)[id], id }))), "stageOutput")

    enabledOutputs.forEach((output) => {
        let autoPosition = enabledOutputs.length === 1
        send(OUTPUT, ["DISPLAY"], { enabled: forceKey || !get(outputDisplay), output, force: output.allowMainScreen || output.boundsLocked || forceKey, auto, autoPosition })
    })
}

export function toggleOutput(id: string) {
    if (!get(outputs)[id]?.enabled) return
    send(OUTPUT, ["DISPLAY"], { enabled: "toggle", one: true, output: { id, ...get(outputs)[id] } })
}

// background: null,
// slide: null,
// overlays: [],
// transition: null,
// TODO: updating a output when a "next slide timer" is active, will "reset/remove" the "next slide timer"
export function setOutput(key: string, data: any, toggle: boolean = false, outputId: string = "", add: boolean = false) {
    outputs.update((a: any) => {
        let bindings = data?.layout ? _show(data.id).layouts([data.layout]).ref()[0]?.[data.index]?.data?.bindings || [] : []
        let allOutputs = bindings.length ? bindings : getActiveOutputs()
        let outs = outputId ? [outputId] : allOutputs
        let inputData = clone(data)

        let firstOutputWithBackground = allOutputs.findIndex((id) => !a[id]?.isKeyOutput && !a[id]?.stageOutput && (get(styles)[get(outputs)[id]?.style || ""]?.layers || ["background"]).includes("background"))
        firstOutputWithBackground = Math.max(0, firstOutputWithBackground)

        // reset slide cache (after update)
        if (key === "slide" && data) setTimeout(() => outputSlideCache.set({}), 50)
        // trigger if show is not currently outputted
        if (key === "slide" && data?.id && get(outputs)[outs?.[0]]?.out?.slide?.id !== data?.id) {
            let category = get(showsCache)[data.id]?.category || ""
            if (get(categories)[category]?.action) runAction(get(midiIn)[get(categories)[category].action!])
            appendShowUsage(data.id)
        }

        let toggleState = false
        outs.forEach((id: string, i: number) => {
            let output: any = a[id]
            if (!output.out) a[id].out = {}
            if (!output.out?.[key]) a[id].out[key] = key === "overlays" ? [] : null
            data = clone(inputData)

            if (key === "slide" && data === null && output.out?.slide?.type === "ppt") {
                send(MAIN, ["PRESENTATION_CONTROL"], { action: "stop" })
            }

            if (key === "background") {
                // clear if PDF/PPT is active
                let slideContent = getOutputContent(id)
                if (data && (slideContent.type === "pdf" || slideContent.type === "ppt")) clearSlide()

                let index = allOutputs.findIndex((outId) => outId === id)
                data = changeOutputBackground(data, { output, id, mute: allOutputs.length > 1 && index !== firstOutputWithBackground })
            }

            let outData = a[id].out?.[key] || null
            if (key === "overlays" && data.length) {
                if (!Array.isArray(data)) data = [data]
                if (toggle && i === 0) toggleState = outData?.includes(data[0])
                if (toggle && toggleState) outData!.splice(outData!.indexOf(data[0]), 1)
                else if (toggle || add) outData = removeDuplicates([...(a[id].out?.[key] || []), ...data])
                else outData = data

                data.forEach((overlayId) => {
                    // timeout so output can update first
                    if (outData.includes(overlayId)) startOverlayTimer(id, overlayId, outData)
                    else if (get(overlayTimers)[id + overlayId]) clearOverlayTimer(id, overlayId)
                })
            } else {
                outData = data

                if (key === "overlays") {
                    clearOverlayTimers(id)
                }
            }

            a[id].out![key] = clone(outData)

            // save locked overlays
            if (key === "overlays") lockedOverlays.set(outData)
        })

        return a
    })
}

function appendShowUsage(showId: string) {
    let show = get(showsCache)[showId]
    if (!show) return

    usageLog.update((a) => {
        let metadata = show.meta || {}
        // remove empty values
        Object.keys(metadata).forEach((key) => {
            if (!metadata[key]) delete metadata[key]
        })

        a.all.push({
            name: show.name,
            time: Date.now(),
            metadata,
        })
        return a
    })
}

function changeOutputBackground(data, { output, id, mute }) {
    if (get(currentWindow) === null) {
        setTimeout(() => {
            // update stage background if any
            sendBackgroundToStage(id)
            // send thumbnail to controller
            // sendBackgroundToController(id)
        }, 100)
    }

    let previousWasVideo: boolean = videoExtensions.includes(getExtension(output.out?.background?.path))

    if (data === null) {
        fadeinAllPlayingAudio()
        if (previousWasVideo) videoEnding()

        return data
    }

    // mute videos in the other output windows if more than one
    // WIP fix multiple outputs: if an output with style without background is first the video will be muted... even if another output should not be muted
    data.muted = data.muted || false
    if (mute) data.muted = true

    let videoData: any = { muted: data.muted, loop: data.loop || false }

    let muteAudio = get(special).muteAudioWhenVideoPlays
    let isVideo = videoExtensions.includes(getExtension(data.path))
    if (!data.muted && muteAudio && isVideo) fadeoutAllPlayingAudio()
    else fadeinAllPlayingAudio()

    if (isVideo) videoStarting()
    else if (previousWasVideo) videoEnding()

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

/// OVERLAY TIMERS

function startOverlayTimer(outputId: string, overlayId: string, outData: string[] = []) {
    if (!outData.length) outData = get(outputs)[outputId]?.out?.overlays || []
    if (!outData.includes(overlayId)) return

    let overlay = get(overlays)[overlayId]
    if (!overlay.displayDuration) return

    overlayTimers.update((a) => {
        let id = outputId + overlayId
        if (a[id]) clearTimeout(a[id].timer)

        a[id] = {
            outputId,
            overlayId,
            timer: setTimeout(() => {
                clearOverlayTimer(outputId, overlayId)
                if (!get(outputs)[outputId]?.out?.overlays?.includes(overlayId)) return

                setOutput("overlays", overlayId, true, outputId)
            }, overlay.displayDuration! * 1000),
        }

        return a
    })
}

export function clearOverlayTimers(outputId: string) {
    Object.values(get(overlayTimers)).forEach((a) => clearOverlayTimer(outputId, a.overlayId))
}

export function clearOverlayTimer(outputId: string, overlayId: string) {
    overlayTimers.update((a) => {
        let id = outputId + overlayId
        if (!a[id]) return a

        clearTimeout(a[id].timer)
        delete a[id]
        return a
    })
}

///

let sortedOutputs: any[] = []
export function getActiveOutputs(updater: any = get(outputs), hasToBeActive: boolean = true, removeKeyOutput: boolean = false, removeStageOutput: boolean = false) {
    // WIP cache outputs
    // if (JSON.stringify(sortedOutputs.map(({ id }) => id)) !== JSON.stringify(Object.keys(updater))) {
    //     sortedOutputs = sortByName(keysToID(updater || {}))
    // }
    sortedOutputs = sortByName(keysToID(updater || {}))

    let enabled: any[] = sortedOutputs.filter((a) => a.enabled === true && (removeKeyOutput ? !a.isKeyOutput : true) && (removeStageOutput ? !a.stageOutput : true))

    if (hasToBeActive && enabled.filter((a) => a.active === true).length) enabled = enabled.filter((a) => a.active === true)

    enabled = enabled.map((a) => a.id)

    if (!enabled.length) {
        if (!sortedOutputs.length && get(currentWindow) === null) addOutput(true)
        if (sortedOutputs[0]) enabled = [sortedOutputs[0].id]
    }

    return enabled
}

export function findMatchingOut(id: string, updater: any = get(outputs)): string | null {
    let match: string | null = null

    // TODO: more than one active

    getActiveOutputs(updater, false, true, true).forEach((outputId: string) => {
        let output: any = updater[outputId]
        if (match === null && output.enabled) {
            // TODO: index & layout: $outSlide?.index === i && $outSlide?.id === $activeShow?.id && $outSlide?.layout === activeLayout
            // slides (edit) + slides
            if (output.out?.slide?.id === id) match = output.color
            else if ((output.out?.background?.path || output.out?.background?.id) === id) match = output.color
            else if (output.out?.overlays?.includes(id)) match = output.color
        }
    })

    // if (match && match === "#F0008C" && get(themes)[get(theme)]?.colors?.secondary) {
    //   match = get(themes)[get(theme)]?.colors?.secondary
    // }

    return match
}

export function refreshOut(refresh: boolean = true) {
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
export function isOutCleared(key: string | null = null, updater: any = get(outputs), checkLocked: boolean = false) {
    let cleared: boolean = true
    let outputIds = getActiveOutputs(updater, true, true, true)

    outputIds.forEach((id: string) => {
        let output: any = updater[id]
        let keys: string[] = key ? [key] : Object.keys(output.out || {})
        keys.forEach((key: string) => {
            // TODO:
            if (output.out?.[key]) {
                if (key === "overlays") {
                    if (checkLocked && output.out.overlays.length) cleared = false
                    else if (!checkLocked && output.out.overlays.filter((id: string) => !get(overlays)[id]?.locked).length) cleared = false
                } else if (output.out[key] !== null) cleared = false
            }
        })
    })

    if (cleared && key === "transition") {
        // check overlay timers
        cleared = !outputIds.find((outputId) => Object.values(get(overlayTimers)).find((a) => a.outputId === outputId))
    }

    return cleared
}

export function getOutputContent(outputId: string = "", updater = get(outputs), key: string = "slide") {
    if (!outputId) outputId = getActiveOutputs(updater, false, true, true)[0]
    return updater[outputId]?.out?.[key] || {}
}

export function outputSlideHasContent(output) {
    if (!output) return false

    let outSlide: OutSlide = output.out?.slide
    if (!outSlide) return false

    let showRef = _show(outSlide.id).layouts([outSlide.layout]).ref()[0] || []
    if (!showRef.length) return false

    let currentSlide = _show(outSlide.id).slides([showRef[outSlide.index!]?.id]).get()[0]
    if (!currentSlide) return false

    return !!getSlideText(currentSlide)?.length
}

// WIP style should override any slide resolution & color ? (it does not)

export function getResolution(initial: Resolution | undefined | null = null, _updater: any = null, _getSlideRes: boolean = false, outputId: string = ""): Resolution {
    if (initial) return initial

    if (!outputId) outputId = getActiveOutputs()[0]
    let currentOutput = get(outputs)[outputId]

    let style: any = currentOutput?.style ? get(styles)[currentOutput?.style] || {} : {}
    let styleRes = style.resolution || null

    // let styleTemplate: any = style.template ? get(templates)[style.template] || {} : {}
    // let styleTemplateRes: any = styleTemplate.settings?.resolution

    // let slideRes: any = null
    // if (getSlideRes) {
    //     let outSlide: any = currentOutput?.out?.slide || {}
    //     let slideRef = _show(outSlide.id || "")
    //         .layouts([outSlide.layout])
    //         .ref()[0]?.[outSlide.index]
    //     let slideOutput = _show(outSlide.id || "").get("slides")?.[slideRef?.id] || null
    //     slideRes = slideOutput?.settings?.resolution
    // }

    // slideRes || styleTemplateRes ||
    return styleRes || { width: 1920, height: 1080 }
}

export function getOutputResolution(outputId: string, _updater = get(outputs), _styleUpdater = get(styles)) {
    let currentOutput = _updater[outputId]
    let style = currentOutput?.style ? _styleUpdater[currentOutput?.style]?.resolution : null

    return style || { width: 1920, height: 1080 }
}

export function checkWindowCapture(startup: boolean = false) {
    getActiveOutputs(get(outputs), false, true, true).forEach((a) => shouldBeCaptured(a, startup))
}

// NDI | OutputShow | Stage CurrentOutput
export function shouldBeCaptured(outputId: string, startup: boolean = false) {
    let output = get(outputs)[outputId]
    let captures: any = {
        ndi: !!output.ndi,
        server: !!(get(disabledServers).output_stream === false && (get(serverData)?.output_stream?.outputId || getActiveOutputs(get(outputs), false, true, true)[0]) === outputId),
        stage: stageHasOutput(outputId),
    }

    // alert user that screen recording starts
    if (!startup && Object.values(captures).filter(Boolean).length) newToast("$toast.output_capture_enabled")

    send(OUTPUT, ["CAPTURE"], { id: outputId, captures })
}
function stageHasOutput(outputId: string) {
    return !!Object.keys(get(stageShows)).find((stageId) => {
        let stageLayout = get(stageShows)[stageId]
        let outputItem = stageLayout.items?.["output#current_output"]

        if (!outputItem?.enabled) return false
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
    screen: null,
}

export function keyOutput(keyId: string, delOutput: boolean = false) {
    if (!keyId) return

    if (delOutput) {
        deleteOutput(keyId)
        return
    }

    // create new "key" output
    outputs.update((a) => {
        let currentOutput = clone(defaultOutput)
        currentOutput.name = "Key"
        currentOutput.isKeyOutput = true
        a[keyId] = currentOutput

        // show
        // , rate: get(special).previewRate || "auto"
        send(OUTPUT, ["CREATE"], { id: keyId, ...currentOutput })
        if (get(outputDisplay)) send(OUTPUT, ["DISPLAY"], { enabled: true, output: { id: keyId, ...currentOutput } })

        return a
    })
}

// WIP history
export function addOutput(onlyFirst: boolean = false) {
    if (onlyFirst && get(outputs).length) return

    outputs.update((output) => {
        let id = uid()
        if (get(themes)[get(theme)]?.colors?.secondary) defaultOutput.color = get(themes)[get(theme)]?.colors?.secondary
        output[id] = clone(defaultOutput)

        // set name
        let n = 0
        while (Object.values(output).find((a: any) => a.name === output[id].name + (n ? " " + n : ""))) n++
        if (n) output[id].name = output[id].name + " " + n
        if (onlyFirst) output[id].name = get(dictionary).theme?.primary || "Primary"

        // show
        // , rate: get(special).previewRate || "auto"
        if (!onlyFirst) send(OUTPUT, ["CREATE"], { id, ...output[id] })
        if (!onlyFirst && get(outputDisplay)) send(OUTPUT, ["DISPLAY"], { enabled: true, output: { id, ...output[id] } })

        if (get(currentOutputSettings) !== id) currentOutputSettings.set(id)
        activeRename.set("output_" + id)
        return output
    })
}

// WIP history
export function enableStageOutput(options: any = {}) {
    let outputIds = getActiveOutputs()
    let bounds = get(outputs)[outputIds[0]]?.bounds || { x: 0, y: 0, width: 100, height: 100 }
    let id = uid()

    outputs.update((a) => {
        a[id] = {
            enabled: true,
            active: true,
            stageOutput: "",
            name: "",
            color: "#555555",
            bounds,
            screen: null,
            ...options,
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
    let outputIds = data.outputId ? [data.outputId] : Object.keys(get(outputs))

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
        let keyOutput = a[outputId].isKeyOutput

        send(OUTPUT, ["REMOVE"], { id: outputId })
        delete a[outputId]

        if (!keyOutput) currentOutputSettings.set(Object.keys(a)[0])
        return a
    })
}

export async function clearPlayingVideo(clearOutput: string = "") {
    let mediaTransition: Transition = getCurrentMediaTransition()

    let duration = (mediaTransition?.duration || 0) + 200
    if (!clearOutput) duration /= 2.4 // a little less than half the time

    return new Promise((resolve) => {
        setTimeout(() => {
            // remove from playing
            playingVideos.update((a) => {
                let existing = -1
                do {
                    existing = a.findIndex((a) => a.location === "output")
                    if (existing > -1) a.splice(existing, 1)
                } while (existing > -1)

                return a
            })

            //   let video = null
            let videoData = {
                time: 0,
                duration: 0,
                paused: !!clearOutput,
                muted: false,
                loop: false,
            }

            // send(OUTPUT, ["UPDATE_VIDEO"], { id: clearOutput, data: videoData, time: 0 })

            resolve(videoData)
        }, duration)
    })
}

export function getCurrentMediaTransition() {
    let transition: Transition = get(transitionData).media

    let outputId = getActiveOutputs(get(outputs))[0]
    let currentOutput = get(outputs)[outputId] || {}
    let out: any = currentOutput?.out || {}
    let slide: any = out.slide || null
    let slideData = get(showsCache) && slide && slide.id !== "temp" ? _show(slide.id).layouts("active").ref()[0]?.[slide.index!]?.data : null
    let slideMediaTransition = slideData ? slideData.mediaTransition : null

    return slideMediaTransition || transition
}

// TEMPLATE

export function mergeWithTemplate(slideItems: Item[], templateItems: Item[], addOverflowTemplateItems: boolean = false, resetAutoSize: boolean = true, templateClicked: boolean = false) {
    // if (!slideItems?.length && !addOverflowTemplateItems) return []
    slideItems = clone(slideItems || []).filter((a) => a && (!templateClicked || !a.fromTemplate))

    if (!templateItems.length) return slideItems
    templateItems = clone(templateItems)

    let sortedTemplateItems = sortItemsByType(templateItems)

    // reduce template textboxes to slide items
    let slideTextboxes = slideItems.reduce((count, a) => (count += (a?.type || "text") === "text" ? 1 : 0), 0)
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

        let type = item.type || "text"

        let templateItem = sortedTemplateItems[type]?.shift()
        if (!templateItem) return finish()

        item.style = templateItem.style || ""
        item.align = templateItem.align || ""

        if (resetAutoSize) delete item.autoFontSize
        item.auto = templateItem.auto || false
        if (templateItem.textFit) item.textFit

        // remove exiting styling & add new if set in template
        const extraStyles = ["chords", "textFit", "actions", "specialStyle", "scrolling", "bindings"]
        extraStyles.forEach((style) => {
            delete item[style]
            if (templateItem![style]) item[style] = templateItem![style]
        })

        if (type !== "text") return finish()

        const allTextColors = [
            ...new Set(
                item.lines
                    ?.map((line) => line.text?.map((text) => getStyles(text.style)["color"] || "#FFFFFF"))
                    .flat()
                    .filter(Boolean)
            ),
        ] as string[]

        item.lines?.forEach((line: any, j: number) => {
            let templateLine = templateItem?.lines?.[j] || templateItem?.lines?.[0]

            line.align = templateLine?.align || ""
            line.text?.forEach((text: any, k: number) => {
                let templateText = templateLine?.text?.[k] || templateLine?.text?.[0]
                if (!text.customType?.includes("disableTemplate")) {
                    let style = templateText?.style || ""

                    // add original text color, if template is not clicked & slide text has multiple colors
                    // - use template color if item text has just one color
                    if (!templateClicked && allTextColors.length > 1) {
                        let textColor = getStyles(text.style)["color"] || "#FFFFFF"
                        style += `color: ${textColor};`
                    }

                    text.style = style
                }

                let firstChar = templateText?.value?.[0] || ""

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

    // let remainingTextTemplateItems: any[] = []
    if (addOverflowTemplateItems) {
        sortedTemplateItems.text = removeTextValue(sortedTemplateItems.text || [])
        // remainingTextTemplateItems = templateItems.filter((a) => (a.type || "text") === "text")
    } else {
        delete sortedTemplateItems.text
    }

    // remove textbox items
    templateItems = templateItems.filter((a) => (a.type || "text") !== "text")
    // remove any duplicate values
    templateItems = templateItems.filter((item) => !newSlideItems.find((a) => JSON.stringify(item) === JSON.stringify(a)))

    // this will ensure the correct order on the remaining items
    let remainingCount = Object.values(sortedTemplateItems).reduce((value, items) => (value += items.length), 0)
    let remainingTemplateItems = remainingCount ? templateItems.slice(remainingCount * -1) : []
    // add template marker
    remainingTemplateItems = remainingTemplateItems.map((a) => ({ ...a, fromTemplate: true }))
    // add behind existing items (any textboxes previously on top not in use will not be replaced by any underneath)
    newSlideItems = [...remainingTemplateItems, ...newSlideItems, ...(sortedTemplateItems.text || [])]

    return newSlideItems
}

export function updateSlideFromTemplate(slide: Slide, template: Template, isFirst: boolean = false, removeOverflow: boolean = false) {
    let settings = template.settings || {}

    // if (settings.resolution || slide.settings.resolution) slide.settings.resolution = getResolution(settings.resolution)
    if (isFirst && (settings.firstSlideTemplate || removeOverflow)) slide.settings.template = settings.firstSlideTemplate || ""
    if (settings.backgroundColor || slide.settings.color) slide.settings.color = settings.backgroundColor || ""

    // add overlay items to slide items
    if (removeOverflow && settings.overlayId) {
        let overlayItems = get(overlays)[settings.overlayId]?.items || []
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
    slideRef: any,
    templateMode: "global" | "group" | "slide",
    removeOverflow: boolean = false
) {
    if (typeof layouts !== "object") layouts = {}
    if (typeof media !== "object") media = {}

    // only alter layout slides if clicking on the template
    if (templateMode === "global" && !removeOverflow) return { layouts, media }

    // no need to add background/actions to slide/group children
    if (slideRef.type !== "parent") return { layouts, media }

    let slideIndex = slideRef.index
    if (!layouts[layoutId]?.slides?.[slideIndex]) return { layouts, media }

    let slide = layouts[layoutId].slides[slideIndex]
    let settings = template.settings || {}
    let oldSettings = oldTemplate.settings || {}

    let bgId = ""
    if (settings.backgroundPath) {
        // find existing
        let existingId = Object.keys(media).find((id) => (media[id].path || media[id].id) === settings.backgroundPath)
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
        let newSlideActions: any[] = []
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
    let newItems: Item[] = []

    // these are set by the output style: resolution, backgroundColor, backgroundPath
    // this is not relevant: firstSlideTemplate

    // add overlay items
    if (templateSettings.overlayId) {
        let overlayItems = get(overlays)[templateSettings.overlayId]?.items || []
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
    let text = getItemText(item)
    if (!text.length) return true
    if (getTemplateText(text)) return true

    return false
}

export function sortItemsByType(items: Item[]) {
    let sortedItems: { [key: string]: Item[] } = {}

    items.forEach((item) => {
        let type = item.type || "text"
        if (!sortedItems[type]) sortedItems[type] = []

        sortedItems[type].push(item)
    })

    return sortedItems
}

export function getItemsCountByType(items: Item[]) {
    let sortedItems = sortItemsByType(items)
    let typeCount: { [key: string]: number } = {}

    Object.keys(sortedItems).forEach((type) => {
        typeCount[type] = sortedItems[type].length
    })

    return typeCount
}

// OUTPUT COMPONENT

export const defaultLayers: string[] = ["background", "slide", "overlays"]

export function getCurrentStyle(styles: { [key: string]: Styles }, styleId: string | undefined): Styles {
    let defaultStyle = { name: "" }

    if (!styleId) return defaultStyle
    return styles[styleId] || defaultStyle
}

export function getOutputTransitions(slideData: any, styleTransition: any, transitionData: any, disableTransitions: boolean) {
    let transitions: { [key: string]: Transition } = {}

    if (disableTransitions) {
        const disabled: Transition = { type: "none", duration: 0, easing: "" }
        transitions = { text: disabled, media: disabled, overlay: disabled }
        return clone(transitions)
    }

    let slideTransitions = {
        text: slideData?.transition?.type ? slideData.transition : null,
        media: slideData?.mediaTransition?.type ? slideData.mediaTransition : null,
    }

    let styleTransitions = {
        text: styleTransition?.text || null,
        media: styleTransition?.media || null,
    }

    transitions.text = slideTransitions.text || styleTransitions.text || transitionData.text || {}
    transitions.media = slideTransitions.media || styleTransitions.media || transitionData.media || {}
    transitions.overlay = styleTransitions.text || transitionData.text || {}

    return clone(transitions)
}

export function getStyleTemplate(outSlide: any, currentStyle: any) {
    let isScripture = outSlide?.id === "temp" || _show(outSlide?.id).get("reference")?.type === "scripture"

    let templateId = currentStyle[`template${isScripture ? "Scripture" : ""}`]
    let template = get(templates)[templateId || ""] || {}

    return template
}

export function slideHasAutoSizeItem(slide: any) {
    return slide?.items?.find((a) => a.auto)
}

export function setTemplateStyle(outSlide: any, currentStyle: any, items: Item[]) {
    let isDrawerScripture = outSlide?.id === "temp"
    let slideItems = isDrawerScripture ? outSlide.tempItems : items

    let template = getStyleTemplate(outSlide, currentStyle)
    let templateItems = template.items || []

    let newItems = mergeWithTemplate(slideItems, templateItems, true) || []
    newItems.push(...getSlideItemsFromTemplate(template.settings || {}))

    return newItems
}

export function getOutputLines(outSlide: any, styleLines: any = 0) {
    if (!outSlide?.id || outSlide.id === "temp") return { start: null, end: null } // , index: 0, max: 0

    let ref = _show(outSlide.id).layouts([outSlide.layout]).ref()[0]
    let showSlide = _show(outSlide.id).slides([ref?.[outSlide.index]?.id]).get()[0]
    let maxLines = showSlide ? getItemWithMostLines(showSlide) : 0
    if (!maxLines) return { start: null, end: null } // , index: 0, max: 0

    let progress = ((outSlide.line || 0) + 1) / maxLines

    let maxStyleLines = Number(styleLines || 0)

    // ensure last content is shown when e.g. two styles has 2 & 3 lines, and the slide has 4 lines
    if ((outSlide.line || 0) + maxStyleLines > maxLines) progress = 1

    let linesIndex = Math.ceil(maxLines * progress) - 1
    let start = maxStyleLines * Math.floor(linesIndex / maxStyleLines)

    return { start: start, end: start + maxStyleLines } // , index: linesIndex, max: maxStyleLines
}

// METADATA

// WIP dynamic placeholder values??: {meta_title?No title}
export const DEFAULT_META_LAYOUT = "Title: {meta_title?No title}; {meta_artist}; {meta_author}; {meta_year};\n{meta_copyright}"
export function createMetadataLayout(layout: string, ref: any, _updater: number = 0) {
    return replaceDynamicValues(layout, ref)
}

export interface OutputMetadata {
    message?: { [key: string]: string }
    display?: string
    style?: string
    transition?: any
    value?: string
    media?: boolean

    messageStyle?: string
    messageTransition?: any
}
const defaultMetadataStyle = "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 30px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
const defaultMessageStyle = "top: 50px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 50px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
export function getMetadata(oldMetadata: any, show: Show | undefined, currentStyle: any, templatesUpdater = get(templates), outSlide: any) {
    let metadata: OutputMetadata = { style: getTemplateStyle("metadata", templatesUpdater) || defaultMetadataStyle }

    if (!show) return metadata
    let settings: any = show.metadata || {}
    let overrideOutput = settings.override
    let templateId: string = overrideOutput ? settings.template : currentStyle.metadataTemplate || "metadata"

    metadata.media = settings.autoMedia
    metadata.message = metadata.media ? {} : show.meta
    metadata.display = overrideOutput ? settings.display : currentStyle.displayMetadata
    metadata.style = getTemplateStyle(templateId, templatesUpdater) || defaultMetadataStyle
    metadata.transition = templatesUpdater[templateId]?.items?.[0]?.actions?.transition || null

    let metadataTemplateValue = templatesUpdater[templateId]?.items?.[0]?.lines?.[0]?.text?.[0]?.value || ""
    // if (metadataTemplateValue || metadata.message || currentStyle)
    getMetaValue()
    function getMetaValue() {
        if (metadata.media) {
            metadata.value = oldMetadata.value || ""
            return
        }

        if (metadataTemplateValue.includes("{")) {
            let ref = { showId: outSlide.id, layoutId: outSlide.layout, slideIndex: outSlide.index }
            metadata.value = replaceDynamicValues(metadataTemplateValue, ref)
            return
        }

        if (!metadata.message) return

        // metadata.value = currentStyle.metadataLayout || DEFAULT_META_LAYOUT
        metadata.value = joinMetadata(metadata.message, currentStyle.metadataDivider)
    }

    let messageTemplate = overrideOutput ? show.message?.template : currentStyle.messageTemplate || "message"
    metadata.messageStyle = getTemplateStyle(messageTemplate!, templatesUpdater) || defaultMessageStyle
    metadata.messageTransition = templatesUpdater[messageTemplate]?.items?.[0]?.actions?.transition || null

    return clone(metadata)
}
export function joinMetadata(message: { [key: string]: string }, divider = "; ") {
    return Object.values(message)
        .filter((a: string) => a.length)
        .join(divider)
}

function getTemplateStyle(templateId: string, templates: any) {
    if (!templateId) return
    let template = templates[templateId]
    if (!template) return

    let style = template.items?.[0]?.style || ""
    let textStyle = template.items?.[0]?.lines?.[0]?.text?.[0]?.style || ""

    return style + textStyle
}

export function decodeExif(data: any) {
    let message: any = {}

    let exif = data.exif
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

export function getSlideFilter(slideData: any) {
    let slideFilter: string = ""

    if (!slideData) return slideFilter
    if (slideData.filterEnabled && !slideData.filterEnabled?.includes("background")) return slideFilter

    if (slideData.filter) slideFilter += "filter: " + slideData.filter + ";"
    if (slideData["backdrop-filter"]) slideFilter += "backdrop-filter: " + slideData["backdrop-filter"] + ";"

    return slideFilter
}

export function getBlending() {
    let blending = Object.values(get(outputs))[0]?.blending
    if (!blending) return ""

    if (!blending.left && !blending.right) return ""

    const opacity = (blending.opacity ?? 50) / 100
    const center = 50 + Number(blending.offset || 0)
    if (blending.centered) return `-webkit-mask-image: linear-gradient(${blending.rotate ?? 90}deg, rgb(0, 0, 0) ${center - blending.left}%, rgba(0, 0, 0, ${opacity}) ${center}%, rgb(0, 0, 0) ${center + Number(blending.right)}%);`
    return `-webkit-mask-image: linear-gradient(${blending.rotate ?? 90}deg, rgba(0, 0, 0, ${opacity}) 0%, rgb(0, 0, 0) ${blending.left}%, rgb(0, 0, 0) ${100 - blending.right}%, rgba(0, 0, 0, ${opacity}) 100%);`
}
