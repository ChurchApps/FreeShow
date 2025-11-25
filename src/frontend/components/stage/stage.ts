import { get } from "svelte/store"
import type { Item, LayoutRef } from "../../../types/Show"
import type { StageItem, StageLayout } from "../../../types/Stage"
import { isOutputWindow } from "../../utils/common"
import { translateText } from "../../utils/language"
import { arrayToObject, filterObjectArray } from "../../utils/sendData"
import { getItemText } from "../edit/scripts/textStyle"
import { getActiveOutputs } from "../helpers/output"
import { getLayoutRef } from "../helpers/show"
import { STAGE } from "./../../../types/Channels"
import { activeStage, allOutputs, connections, outputs, outputSlideCache, showsCache, stageShows, timers, variables } from "./../../stores"

export function updateStageShow() {
    Object.entries(get(connections).STAGE || {}).forEach(([id, stage]) => {
        const show = arrayToObject(filterObjectArray([get(stageShows)[stage.active || ""]], ["disabled", "name", "settings", "items"]))[0]
        if (!show.disabled) window.api.send(STAGE, { channel: "LAYOUT", id, data: show })
    })
}

export function getCustomStageLabel(itemId: string, item: StageItem, _updater: any = null): string {
    if (!itemId.includes("#")) {
        let name = ""

        if (itemId === "variable") name = get(variables)[item.variable?.id || ""]?.name
        else if (itemId === "timer") name = get(timers)[item.timer?.id]?.name
        else if (itemId === "text") name = dynamicValueString(getItemText(item as Item))

        name = name || translateText(`items.${itemId}`)

        const slideOffset = Number(item.slideOffset || 0)
        if (itemId === "slide_text" && slideOffset === 0) name = translateText("stage.current_slide_text") || name
        else if (itemId === "slide_text" && slideOffset === 1) name = translateText("stage.next_slide_text") || name + " +1"
        else if ((itemId === "slide_text" || itemId === "slide_notes") && slideOffset) name += ` ${slideOffset > 0 ? "+" : ""}${slideOffset}`

        return name
    }

    // < 1.4.0
    if (itemId.includes("global_timers") && !itemId.includes("first_active_timer")) return get(timers)[getStageItemId(itemId)]?.name || ""
    if (itemId.includes("variables")) return get(variables)[getStageItemId(itemId)]?.name || ""

    return translateText(`stage.${itemId.split("#")[1]}`)
}

function dynamicValueString(text: string) {
    // check if it is a dynamic value
    const regex = /^\{.*\}$/
    if (!regex.test(text)) return ""

    text = text.slice(1, -1)
    if (!text.length || text.includes("{") || text.includes("}")) return ""

    text = text.replace("$", "").replace("variable_", "")
    // if (text.includes("$") || text.includes("variable_")) {
    //     text = text.replace("$", "variable_").replace("variable_", "variable:_")
    //     // text = (get(dictionary).items?.variable || "Variable") + ": " + (text.replace("$", "").replace("variable_", ""))
    // }

    // return text.split("_").map((a) => `${a[0].toUpperCase()}${a.slice(1)}`).join(" ")
    return text[0].toUpperCase() + text.slice(1).replaceAll("_", " ")
}

export function getStageItemId(itemId: string) {
    return itemId.split("#")[1]
}

export function stageItemToItem(item: StageItem) {
    const newItem: Item = {
        style: item?.style || "",
    }
    if (!item) return newItem

    // type, align, auto, src, timer, clock, tracker, variable, etc.
    if (item.chords) newItem.chords = typeof item.chords === "boolean" ? { enabled: item.chords, ...((item as any).chordsData || {}) } : item.chords
    // if (item.clock) newItem.clock = { seconds: true, ...item.clock }

    return { ...item, ...newItem } as Item
}

export function getSlideTextItems(stageLayout: StageLayout, item: StageItem, _updater: any = null) {
    const slideOffset = Number(item.slideOffset || 0)
    const currentShow = stageLayout === null ? (get(activeStage).id ? get(stageShows)[get(activeStage).id!] : null) : stageLayout
    const stageMainOutputId = currentShow?.settings?.output || getActiveOutputs(isOutputWindow() ? get(allOutputs) : get(outputs), false, true, true)[0]
    const currentOutput = get(outputs)[stageMainOutputId] || get(allOutputs)[stageMainOutputId] || {}
    const currentSlide = currentOutput.out?.slide || (slideOffset !== 0 ? get(outputSlideCache)[stageMainOutputId] || null : null)
    const showRef = currentSlide ? getLayoutRef(currentSlide.id) : []

    const slideIndex = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index : null
    const customOffset = getStageTextLayoutOffset(showRef, slideOffset, slideIndex)

    const slideId = (customOffset !== null || slideIndex !== null) && showRef ? showRef[(customOffset ?? slideIndex)!]?.id || null : null
    const currentItems = get(showsCache)[currentSlide?.id]?.slides?.[slideId || ""]?.items || []
    return currentItems
}

// GET CORRECT INDEX OFFSET, EXCLUDING DISABLED SLIDES
export function getStageTextLayoutOffset(showRef: LayoutRef[], slideOffset: number, slideIndex: number | null) {
    let customOffset: number | null = null
    if (slideOffset > 0 && slideIndex !== null && showRef) {
        let layoutOffset = slideIndex
        let offsetFromCurrentExcludingDisabled = 0
        while (offsetFromCurrentExcludingDisabled < slideOffset && layoutOffset <= showRef.length) {
            layoutOffset++
            if (!showRef[layoutOffset]?.data?.disabled) offsetFromCurrentExcludingDisabled++
        }
        customOffset = layoutOffset
    } else if (slideOffset < 0 && slideIndex !== null && showRef) {
        let layoutOffset = slideIndex
        let offsetFromCurrentExcludingDisabled = 0
        while (offsetFromCurrentExcludingDisabled > slideOffset && layoutOffset >= 0) {
            layoutOffset--
            if (!showRef[layoutOffset]?.data?.disabled) offsetFromCurrentExcludingDisabled--
        }
        customOffset = layoutOffset
    } else customOffset = null

    return customOffset
}
