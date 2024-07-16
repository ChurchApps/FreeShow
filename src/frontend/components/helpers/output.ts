import { get } from "svelte/store"
import { uid } from "uid"
import { OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import type { Resolution, Styles } from "../../../types/Settings"
import type { Item, Layout, Media, OutSlide, Show, Slide, Template, TemplateSettings, Transition } from "../../../types/Show"
import { currentOutputSettings, disabledServers, lockedOverlays, outputDisplay, outputs, overlays, playingVideos, serverData, showsCache, special, stageShows, styles, templates, theme, themes, transitionData, videoExtensions } from "../../stores"
import { send } from "../../utils/request"
import { sendBackgroundToStage } from "../../utils/stageTalk"
import { getItemText, getSlideText } from "../edit/scripts/textStyle"
import { clone, keysToID, removeDuplicates, sortByName } from "./array"
import { getExtension, getFileName, removeExtension } from "./media"
import { replaceDynamicValues } from "./showActions"
import { _show } from "./shows"
import { fadeinAllPlayingAudio, fadeoutAllPlayingAudio } from "./audio"
import { customActionActivation } from "../actions/actions"

export function displayOutputs(e: any = {}, auto: boolean = false) {
    let enabledOutputs: any[] = getActiveOutputs(get(outputs), false)
    enabledOutputs.forEach((id) => {
        let output: any = { id, ...get(outputs)[id] }
        let autoPosition = enabledOutputs.length === 1
        send(OUTPUT, ["DISPLAY"], { enabled: !get(outputDisplay), output, force: output.allowMainScreen || e.ctrlKey || e.metaKey, auto, autoPosition })
    })
}

// background: null,
// slide: null,
// overlays: [],
// transition: null,
// TODO: updating a output when a "next slide timer" is active, will "reset/remove" the "next slide timer"
export function setOutput(key: string, data: any, toggle: boolean = false, outputId: string = "", add: boolean = false) {
    outputs.update((a: any) => {
        let bindings = data?.layout ? _show(data.id).layouts([data.layout]).ref()[0]?.[data.index]?.data?.bindings || [] : []
        let outs = bindings.length ? bindings : getActiveOutputs()
        if (outputId) outs = [outputId]

        outs.forEach((id: string, i: number) => {
            let output: any = a[id]
            if (!output.out) a[id].out = {}
            if (!output.out?.[key]) a[id].out[key] = key === "overlays" ? [] : null

            if (key === "background") data = changeOutputBackground(data, { outs, output, id, i })

            let outData = a[id].out?.[key] || null
            if (key === "overlays" && data.length) {
                if (!Array.isArray(data)) data = [data]
                if (toggle && outData?.includes(data[0])) outData!.splice(outData!.indexOf(data[0]), 1)
                else if (toggle || add) outData = removeDuplicates([...(a[id].out?.[key] || []), ...data])
                else outData = data
            } else outData = data

            a[id].out![key] = clone(outData)

            // save locked overlays
            if (key === "overlays") lockedOverlays.set(outData)
        })

        return a
    })
}

function changeOutputBackground(data, { outs, output, id, i }) {
    setTimeout(() => {
        // update stage background if any
        sendBackgroundToStage(id)
    }, 100)

    let previousWasVideo: boolean = get(videoExtensions).includes(getExtension(output.out?.background?.path))

    if (data === null) {
        fadeinAllPlayingAudio()
        if (previousWasVideo) videoEnding()

        return data
    }

    // mute videos in the other output windows if more than one
    data.muted = data.muted || false
    if (outs.length > 1 && i > 0) data.muted = true

    let videoData: any = { muted: data.muted, loop: data.loop || false }

    let muteAudio = get(special).muteAudioWhenVideoPlays
    let isVideo = get(videoExtensions).includes(getExtension(data.path))
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
        if (!sortedOutputs.length) addOutput(true)
        if (sortedOutputs[0]) enabled = [sortedOutputs[0].id]
    }

    return enabled
}

export function findMatchingOut(id: string, updater: any = get(outputs)): string | null {
    let match: string | null = null

    // TODO: more than one active

    getActiveOutputs(updater, false).forEach((outputId: string) => {
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

    getActiveOutputs(updater, true, true, true).forEach((id: string) => {
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

    return cleared
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

export function getResolution(initial: Resolution | undefined | null = null, _updater: any = null, getSlideRes: boolean = false): Resolution {
    let currentOutput = get(outputs)[getActiveOutputs()[0]]
    let style = currentOutput?.style ? get(styles)[currentOutput?.style]?.resolution : null
    let slideRes: any = null

    if (!initial && !style && getSlideRes) {
        let outSlide: any = currentOutput?.out?.slide || {}
        let slideRef = _show(outSlide.id || "")
            .layouts([outSlide.layout])
            .ref()[0]?.[outSlide.index]
        let slideOutput = _show(outSlide.id || "").get("slides")?.[slideRef?.id] || null
        slideRes = slideOutput?.settings?.resolution
    }

    return initial || style || slideRes || { width: 1920, height: 1080 }
}

export function checkWindowCapture() {
    getActiveOutputs(get(outputs), false, true, true).forEach(shouldBeCaptured)
}

// NDI | OutputShow | Stage CurrentOutput
export function shouldBeCaptured(outputId: string) {
    let output = get(outputs)[outputId]
    let captures: any = {
        ndi: !!output.ndi,
        server: !!(get(disabledServers).output_stream === false && (get(serverData)?.output_stream?.outputId || getActiveOutputs(get(outputs), false, true, true)[0]) === outputId),
        stage: stageHasOutput(outputId),
    }

    send(OUTPUT, ["CAPTURE"], { id: outputId, captures })
}
function stageHasOutput(outputId: string) {
    return !!Object.keys(get(stageShows)).find((stageId) => {
        let stageLayout = get(stageShows)[stageId]
        let outputItem = stageLayout.items?.["output#current_output"]

        if (!outputItem?.enabled) return false
        return (stageLayout.settings?.output || outputId) === outputId
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
        send(OUTPUT, ["CREATE"], { id: keyId, ...currentOutput, rate: get(special).previewRate || "auto" })
        if (get(outputDisplay)) send(OUTPUT, ["DISPLAY"], { enabled: true, output: { id: keyId, ...currentOutput } })

        return a
    })
}

export function addOutput(onlyFirst: boolean = false) {
    if (onlyFirst && get(outputs).length) return

    outputs.update((output) => {
        let id = uid()
        if (get(themes)[get(theme)]?.colors?.secondary) defaultOutput.color = get(themes)[get(theme)]?.colors?.secondary
        output[id] = clone(defaultOutput)

        // set name
        let n = 0
        while (Object.values(output).find((a) => a.name === output[id].name + (n ? " " + n : ""))) n++
        if (n) output[id].name = output[id].name + " " + n
        if (onlyFirst) output[id].name = "Primary"

        // show
        if (!onlyFirst) send(OUTPUT, ["CREATE"], { id, ...output[id], rate: get(special).previewRate || "auto" })
        if (!onlyFirst && get(outputDisplay)) send(OUTPUT, ["DISPLAY"], { enabled: true, output: { id, ...output[id] } })

        if (get(currentOutputSettings) !== id) currentOutputSettings.set(id)
        return output
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

export function mergeWithTemplate(slideItems: Item[], templateItems: Item[], addOverflowTemplateItems: boolean = false, resetAutoSize: boolean = true) {
    slideItems = clone(slideItems)
    if (!templateItems.length) return slideItems

    let sortedTemplateItems = sortItemsByType(templateItems)

    let newSlideItems: Item[] = []
    slideItems.forEach((item: Item) => {
        let type = item.type || "text"

        let templateItem = sortedTemplateItems[type]?.shift()
        if (!templateItem) return finish()

        item.style = templateItem.style || ""
        item.align = templateItem.align || ""

        if (resetAutoSize) delete item.autoFontSize
        item.auto = templateItem.auto || false

        // remove exiting styling & add new if set in template
        const extraStyles = ["chords", "actions", "specialStyle", "scrolling", "bindings"]
        extraStyles.forEach((style) => {
            delete item[style]
            if (templateItem![style]) item[style] = templateItem![style]
        })

        if (type !== "text") return finish()

        item.lines?.forEach((line: any, j: number) => {
            let templateLine = templateItem?.lines?.[j] || templateItem?.lines?.[0]

            line.align = templateLine?.align || ""
            line.text?.forEach((text: any, k: number) => {
                let templateText = templateLine?.text[k] || templateLine?.text[0]
                if (text.customType !== "disableTemplate") text.style = templateText?.style || ""

                // add dynamic values
                if (!text.value?.length && templateText?.value?.[0] === "{") {
                    text.value = templateText.value
                }
            })
        })

        finish()
        function finish() {
            newSlideItems.push(item)
        }
    })

    if (addOverflowTemplateItems) {
        templateItems = removeTextValue(templateItems)
    } else {
        delete sortedTemplateItems.text
        templateItems = templateItems.filter((a) => (a.type || "text") !== "text")
    }

    // remove any duplicate values
    templateItems = templateItems.filter((item) => !newSlideItems.find((a) => JSON.stringify(item) === JSON.stringify(a)))

    // this will ensure the correct order on the remaining items
    let remainingCount = Object.values(sortedTemplateItems).reduce((value, items) => (value += items.length), 0)
    let remainingTemplateItems = remainingCount ? templateItems.slice(remainingCount * -1) : []
    // add behind existing items (any textboxes previously on top not in use will not be replaced by any underneath)
    newSlideItems = [...remainingTemplateItems, ...newSlideItems]

    return newSlideItems
}

export function updateSlideFromTemplate(slide: Slide, template: Template, isFirst: boolean = false, removeOverflow: boolean = false) {
    let settings = template.settings || {}

    if (settings.resolution || slide.settings.resolution) slide.settings.resolution = getResolution(settings.resolution)
    if (isFirst && (settings.firstSlideTemplate || removeOverflow)) slide.settings.template = settings.firstSlideTemplate || ""
    if (settings.backgroundColor || slide.settings.color) slide.settings.color = settings.backgroundColor || ""

    // add overlay items to slide items
    if (removeOverflow && settings.overlayId) {
        let overlayItems = get(overlays)[settings.overlayId]?.items || []
        slide.items.push(...overlayItems)
    }

    return slide
}

export function updateLayoutsFromTemplate(layouts: { [key: string]: Layout }, media: { [key: string]: Media }, template: Template, removeOverflow: boolean = false) {
    // only alter layout slides if clicking on the template
    if (!removeOverflow) return { layouts, media }

    let settings = template.settings || {}

    let bgId = ""
    if (settings.backgroundPath) {
        // find existing
        let existingId = Object.keys(media).find((id) => (media[id].path || media[id].id) === id)
        bgId = existingId || uid()
        if (!existingId) media[bgId] = { path: settings.backgroundPath, name: removeExtension(getFileName(settings.backgroundPath)) }
    }

    Object.keys(layouts).forEach((layoutId) => {
        let slides = layouts[layoutId].slides
        slides.forEach((slide, i) => {
            if (i === 0 && settings.backgroundPath) slide.background = bgId

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
        })

        layouts[layoutId].slides = slides
    })

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
    if (value.includes("{")) return value
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

export function getOutputTransitions(slideData: any, transitionData: any, disableTransitions: boolean) {
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

    transitions.text = slideTransitions.text || transitionData.text || {}
    transitions.media = slideTransitions.media || transitionData.media || {}
    transitions.overlay = transitionData.text || {}

    return clone(transitions)
}

export function setTemplateStyle(outSlide: any, currentStyle: any, items: Item[]) {
    let isScripture = outSlide?.id === "temp"
    let slideItems = isScripture ? outSlide.tempItems : items

    let templateId = currentStyle[`template${isScripture ? "Scripture" : ""}`]
    let template = get(templates)[templateId || ""] || {}
    let templateItems = template.items || []

    let newItems = mergeWithTemplate(slideItems, templateItems, true) || []
    newItems.push(...getSlideItemsFromTemplate(template.settings || {}))

    return newItems
}

export function getOutputLines(outSlide: any, styleLines: any = 0) {
    let maxLines: number = styleLines ? Number(styleLines) : 0
    let linesIndex: number | null = maxLines && outSlide && outSlide.id !== "temp" ? outSlide.line || 0 : null

    let start = linesIndex !== null && outSlide?.id ? maxLines * linesIndex : null
    let end = start !== null ? start + maxLines : null

    return { start, end, index: linesIndex, max: maxLines }
}

export interface OutputMetadata {
    message?: { [key: string]: string }
    display?: string
    style?: string
    value?: string
    media?: boolean

    messageStyle?: string
}
const defaultMetadataStyle = "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 30px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
const defaultMessageStyle = "top: 50px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 50px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
export function getMetadata(oldMetadata: any, show: Show | undefined, currentStyle: any, templatesUpdater = get(templates), outSlide: any) {
    let metadata: OutputMetadata = {}

    if (!show) return metadata
    let settings: any = show.metadata || {}
    let overrideOutput = settings.override
    let templateId: string = overrideOutput ? settings.template : currentStyle.metadataTemplate || "metadata"

    metadata.media = settings.autoMedia
    metadata.message = metadata.media ? {} : show.meta
    metadata.display = overrideOutput ? settings.display : currentStyle.displayMetadata
    metadata.style = getTemplateStyle(templateId, templatesUpdater) || defaultMetadataStyle

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

        metadata.value = joinMetadata(metadata.message, currentStyle.metadataDivider)
    }

    let messageTemplate = overrideOutput ? show.message?.template : currentStyle.messageTemplate || "message"
    metadata.messageStyle = getTemplateStyle(messageTemplate!, templatesUpdater) || defaultMessageStyle

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

    let style = template.items[0]?.style || ""
    let textStyle = template.items[0]?.lines?.[0]?.text?.[0]?.style || ""

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
