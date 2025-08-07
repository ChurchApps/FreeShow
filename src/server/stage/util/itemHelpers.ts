import { get } from "svelte/store"
import type { Condition, Item, LayoutRef } from "../../../types/Show"
import { StageItem, StageLayout } from "../../../types/Stage"
import { keysToID, sortByName } from "../../common/util/helpers"
import { getCurrentTimerValue } from "../../common/util/time"
import { getItemText } from "../helpers/textStyle"
import { activeTimers, output, outputSlideCache, showsCache, timers, variables } from "./stores"
import { getLayoutRef } from "../helpers/show"

export function getSlideTextItems(stageLayout: StageLayout, item: StageItem, _updater: any = null) {
    console.log(stageLayout)

    const slideOffset = Number(item.slideOffset || 0)
    const currentOutput = get(output)
    const currentSlide = currentOutput?.out?.slide || (slideOffset !== 0 ? get(outputSlideCache)[currentOutput?.id || ""] || null : null)
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

/////

export function shouldItemBeShown(item: Item, allItems: Item[] = [], { outputId, type }: any = { type: "stage" }, _updater: any = null) {
    // check bindings
    if (item.bindings?.length && !item.bindings.includes(outputId)) return false

    if (type === "stage") allItems = getTempItems(item, allItems)

    if (!allItems.length) allItems = [item]
    const slideItems = allItems.filter((a) => !a.bindings?.length || a.bindings.includes(outputId))
    const itemsText = slideItems.reduce((value, currentItem) => (value += getItemText(currentItem)), "")
    // set dynamic values
    // const ref = { showId: get(activeShow)?.id, layoutId: _show().get("settings.activeLayout"), slideIndex: get(activeEdit).slide, type: get(activePage) === "stage" ? "stage" : get(activeEdit).type || "show", id: get(activeEdit).id }
    // itemsText = replaceDynamicValues(itemsText, { ...ref, slideIndex })

    // check conditions
    const condition = item.conditions?.showItem
    if (!isConditionMet(condition, itemsText)) return false

    return true
}

// get "temp" items (scripture) if stage
function getTempItems(item: Item, allItems: Item[]) {
    const slideOffset = item.type ? Number((item as StageItem).slideOffset || 0) : 0
    const currentOutput = get(output)
    const currentSlide = currentOutput?.out?.slide || (slideOffset !== 0 ? get(outputSlideCache)[currentOutput?.id || ""] || null : null)

    if (currentSlide?.id !== "temp") return allItems
    return getTempSlides()

    function getTempSlides() {
        if (slideOffset < 0) {
            const includeLength = (currentSlide.previousSlides || [])?.length
            return currentSlide.previousSlides?.[includeLength - (slideOffset + 1 + includeLength)]
        }
        if (slideOffset > 0) {
            return currentSlide.nextSlides?.[slideOffset - 1]
        }
        return currentSlide.tempItems
    }
}

function isConditionMet(condition: Condition | undefined, itemsText: string) {
    if (!condition) return true

    const conditionValues: boolean[] = condition.values.map((cVal) => {
        const element = cVal.element || "text"
        let elementId = cVal.elementId || ""
        if (element === "timer" && !elementId) elementId = getFirstActiveTimer()

        let operator = cVal.operator || "is"
        if (element === "timer") operator = cVal.operator || "isRunning"

        const data = cVal.data || "value"
        let dataValue: string | number = cVal.value ?? ""
        if (data === "seconds") dataValue = (cVal.seconds || 0).toString()

        let value = ""
        if (element === "text") value = itemsText
        else if (element === "timer") value = getTimerValue(elementId)
        else if (element === "variable") value = getVariableValue(elementId)
        else if (element === "dynamicValue") value = getDynamicValue(elementId)

        if (operator === "is") {
            return value === dataValue
        } else if (operator === "isNot") {
            return value !== dataValue
        } else if (operator === "has") {
            return value.includes(dataValue.toString())
        } else if (operator === "hasNot") {
            return !value.includes(dataValue.toString())
        } else if (operator === "isRunning") {
            if (element === "timer") return isTimerRunning(elementId)
        } else if (operator === "isAbove") {
            return Number(value) > Number(dataValue)
        } else if (operator === "isBelow") {
            return Number(value) < Number(dataValue)
        }

        return true
    })

    const scenario = condition.scenario || "all"
    const filteredValues = [...new Set(conditionValues)]

    if (scenario === "all") {
        return filteredValues.length === 1 && filteredValues[0] === true
    } else if (scenario === "some") {
        return filteredValues.includes(true)
    } else if (scenario === "none") {
        return filteredValues.length === 1 && filteredValues[0] === false
    }

    return true
}

export function getFirstActiveTimer() {
    let firstTimerId = get(activeTimers)[0]?.id
    if (!firstTimerId) firstTimerId = sortByName(keysToID(get(timers))).find((timer) => timer.type !== "counter")?.id || ""

    return firstTimerId
}

function getTimerValue(timerId: string) {
    const timer = get(timers)[timerId]
    if (!timer) return "0"
    return getCurrentTimerValue(timer, { id: timerId }, new Date()).toString()
}

function isTimerRunning(timerId: string) {
    const timer = get(timers)[timerId]
    if (!timer) return false

    if (timer.type === "clock" || timer.type === "event") {
        const value = Number(getTimerValue(timerId))
        return value > 0
    }

    return !!get(activeTimers).find((a) => a.id === timerId)
}

export function getVariableValue(variableId: string) {
    const variable = get(variables)[variableId]
    if (!variable) return ""

    if (variable.type === "text") {
        if (variable.enabled === false) return ""
        return variable.text || ""
    } else {
        return (variable.number ?? 0).toString()
    }
}

export function getDynamicValue(id: string) {
    // WIP get dynamic value
    console.log(id)
    return ""
}
