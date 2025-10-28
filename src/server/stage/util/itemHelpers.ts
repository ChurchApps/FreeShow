import { get } from "svelte/store"
import type { Variable } from "../../../types/Main"
import type { Condition, ConditionValue, Item, LayoutRef } from "../../../types/Show"
import { StageItem, StageLayout } from "../../../types/Stage"
import { keysToID, sortByName } from "../../common/util/helpers"
import { getCurrentTimerValue } from "../../common/util/time"
import { getLayoutRef } from "../helpers/show"
import { getItemText } from "../helpers/textStyle"
import { activeTimers, output, outputSlideCache, showsCache, timers, variables } from "./stores"

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

    if (!Array.isArray(condition)) {
        condition = (condition as any)?.values?.length ? [[[(condition as any).values]]] : []
    }

    // outerOr
    const conditionMet = condition.some(outerAnd => {
        return outerAnd.every(innerOr => {
            return innerOr.some(innerAnd => {
                return innerAnd.every(content => {
                    return checkConditionValue(content, itemsText)
                })
            })
        })
    })

    return conditionMet
}

function checkConditionValue(cVal: ConditionValue, itemsText: string) {
    const element = cVal.element || "text"
    let elementId = cVal.elementId || ""
    if (element === "timer" && !elementId) elementId = getFirstActiveTimer()

    let operator = cVal.operator || "is"
    if (element === "timer") operator = cVal.operator || "isRunning"

    const data = cVal.data || "value"
    let dataValue: string | number = cVal.value ?? ""
    if (data === "seconds" || (element === "timer" && operator !== "isRunning")) dataValue = (cVal.seconds || 0).toString()

    let value = ""
    if (element === "text") value = itemsText
    else if (element === "timer") value = getTimerValue(elementId)
    else if (element === "variable") value = _getVariableValue(elementId)
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

    return get(activeTimers).some((a) => a.id === timerId)
}

export function _getVariableValue(dynamicId: string) {
    const variable = get(variables)[dynamicId]
    if (!variable) {
        return getVariableValue(dynamicId)
    }

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

/////

function getVariableNameId(name: string) {
    return name.toLowerCase().trim().replaceAll(" ", "_")
}

function getSetChars(sets: { name: string; minValue?: number; maxValue?: number }[] | undefined) {
    let chars = 1
    if (!sets) return 4

    sets.forEach((a) => {
        const minChars = (a.minValue ?? 1).toString().length
        const maxChars = (a.maxValue ?? 1000).toString().length
        if (minChars > chars) chars = minChars
        if (maxChars > chars) chars = maxChars
    })

    return chars
}

function getVariableValue(dynamicId: string, ref: any = null) {
    if (dynamicId.includes("variable_set_")) {
        const nameId = dynamicId.slice(13)
        const variable = Object.values<Variable>(get(variables)).find((a) => getVariableNameId(a.name) === nameId)
        if (variable?.type !== "random_number") return ""

        return variable.setName || ""
    }

    if (dynamicId.includes("$") || dynamicId.includes("variable_")) {
        const nameId = dynamicId.includes("$") ? dynamicId.slice(1) : dynamicId.slice(9)
        let variable = Object.values<Variable>(get(variables)).find((a) => getVariableNameId(a.name) === nameId)

        if (!variable && nameId.includes("__")) {
            const textSetId = nameId.slice(0, nameId.indexOf("__"))
            variable = Object.values<Variable>(get(variables)).find((a) => getVariableNameId(a.name) === textSetId)
        }
        if (!variable) return ""

        if (variable.type === "number") return Number(variable.number || 0).toString()
        if (variable.type === "random_number") return (variable.number || 0).toString().padStart(getSetChars(variable.sets), "0")
        if (variable.type === "text_set") {
            const currentSet = variable.textSets?.[variable.activeTextSet ?? 0] || {}
            const setId = nameId.slice(nameId.indexOf("__") + 2)
            const setName = variable.textSetKeys?.find((name) => getVariableNameId(name) === setId) || ""
            return currentSet[setName] || ""
        }

        if (variable.enabled === false) return ""
        if (variable.text?.includes(dynamicId) || !ref) return variable.text || ""
        return variable.text || ""
    }

    return ""
}