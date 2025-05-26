import { get } from "svelte/store"
import type { Condition, Item, ItemType, Slide } from "../../../../types/Show"
import { activeEdit, activeShow, activeStage, allOutputs, outputs, outputSlideCache, overlays, refreshEditSlide, showsCache, stageShows, templates, timers, variables } from "../../../stores"
import { addSlideAction } from "../../actions/actions"
import { createNewTimer, getCurrentTimerValue } from "../../drawer/timers/timers"
import { clone, keysToID, sortByName } from "../../helpers/array"
import { history } from "../../helpers/history"
import { getActiveOutputs, getStageOutputId } from "../../helpers/output"
import { getLayoutRef } from "../../helpers/show"
import { dynamicValueText, replaceDynamicValues } from "../../helpers/showActions"
import { _show } from "../../helpers/shows"
import { getStyles, removeText } from "../../helpers/style"
import { boxes } from "../values/boxes"
import { getItemText } from "./textStyle"
import type { StageItem } from "../../../../types/Stage"

export const DEFAULT_ITEM_STYLE = "top:120px;inset-inline-start:50px;height:840px;width:1820px;"

function getDefaultStyles(type: ItemType, templateItems: Item[] | null = null) {
    // Get position styles from template or use default from boxes.ts
    const positionStyle = templateItems?.find((a) => (a.type || "text") === type)?.style || DEFAULT_ITEM_STYLE

    // Get default styles from boxes configuration
    const boxDefaults = boxes[type]?.edit?.font || []
    let styleString = positionStyle

    // Add default font styles if they exist
    boxDefaults.forEach((def) => {
        if (def.key && def.value) {
            styleString += `${def.key}:${def.value};`
        }
    })

    return styleString
}

export function addItem(type: ItemType, id: string | null = null, options: any = {}, textValue = "") {
    const activeTemplate: string | null = get(activeShow)?.id ? get(showsCache)[get(activeShow)!.id]?.settings?.template : null
    const template = activeTemplate ? get(templates)[activeTemplate]?.items : null

    const newData: Item = {
        style: getDefaultStyles(type, template),
        type
    }
    if (id) newData.id = id

    if (type === "text") newData.lines = [{ align: template?.[0]?.lines?.[0]?.align || "", text: [{ value: textValue, style: template?.[0]?.lines?.[0]?.text?.[0]?.style || "" }] }]
    if (type === "list") newData.list = { items: [] }
    // else if (type === "timer") newData.timer = { id: uid(), name: get(dictionary).timer?.counter || "Counter", type: "counter", start: 300, end: 0 }
    else if (type === "timer") {
        const timerId = sortByName(keysToID(get(timers)))[0]?.id || createNewTimer()
        newData.timer = { id: timerId, ...get(timers)[timerId] }
        if (get(timers)[timerId]?.type === "counter") addSlideAction(get(activeEdit).slide ?? -1, "start_slide_timers")
    } else if (type === "clock") newData.clock = { type: "digital", dateFormat: "none", showTime: true, seconds: false }
    else if (type === "mirror") newData.mirror = {}
    else if (type === "media") newData.src = options.src || ""
    else if (type === "variable") newData.variable = { id: "" }
    else if (type === "slide_tracker") newData.auto = true
    else if (type === "web") newData.web = { url: "" }
    else if (type === "captions") newData.captions = {}
    // else if (type === "button") {
    //     // make square, colored, rounded and center
    //     let size: number = 300
    //     let style = getStyles(newData.style)
    //     let top: string = Number(removeText(style.top)) + Number(removeText(style.height)) / 2 - size / 2 + "px"
    //     let left: string = Number(removeText(style.left)) + Number(removeText(style.width)) / 2 - size / 2 + "px"
    //     style = { ...style, top, left, width: size + "px", height: size + "px", "border-radius": "500px", "background-color": "#ff4136" }
    //     let styleString: string = ""
    //     Object.entries(style).forEach(([key, value]) => {
    //         styleString += `${key}: ${value};`
    //     })
    //     newData.style = styleString }
    else if (type === "icon" && options.color) {
        // make square and center
        const size = 300
        let style = getStyles(newData.style)
        const top: string = Number(removeText(style.top)) + Number(removeText(style.height)) / 2 - size / 2 + "px"
        const insetInlineStart: string = Number(removeText(style.left)) + Number(removeText(style.width)) / 2 - size / 2 + "px"
        style = { ...style, top, insetInlineStart, width: size + "px", height: size + "px", color: options.color }
        let styleString = ""
        Object.entries(style).forEach(([key, value]) => {
            styleString += `${key}: ${value};`
        })
        newData.style = styleString
    } else if (type === "icon" && options.path) {
        newData.customSvg = options.path
    }

    // console.log("NEW ITEM", newData)

    if (!get(activeEdit).id) {
        const ref = getLayoutRef()
        const slideId = ref[get(activeEdit).slide!]?.id
        history({ id: "UPDATE", newData: { data: newData, key: "slides", keys: [slideId], subkey: "items", index: -1 }, oldData: { id: get(activeShow)?.id }, location: { page: "edit", id: "show_key" } })
    } else {
        // overlay, template
        history({ id: "UPDATE", newData: { data: newData, key: "items", index: -1 }, oldData: { id: get(activeEdit).id }, location: { page: "edit", id: get(activeEdit).type } })
    }
}

export function getEditSlide() {
    const active = get(activeEdit)

    if (active.id) {
        if (active.type === "overlay") return get(overlays)[active.id]
        if (active.type === "template") return get(templates)[active.id]
        return null
    }

    const ref = getLayoutRef()
    const editSlideRef = ref?.[active.slide ?? -1]
    return _show().get("slides")?.[editSlideRef?.id] as Slide
}

export function getEditItems(onlyActive = false) {
    const active = get(activeEdit)
    const selectedItems: number[] = active.items

    const editSlide = clone(getEditSlide())
    if (!Array.isArray(editSlide?.items)) return []

    let editItems = editSlide!.items
    if (onlyActive) editItems = editItems.filter((_, i) => selectedItems.includes(i))

    return editItems || []
}

// rearrange
export function rearrangeItems(type: string, startIndex: number = get(activeEdit).items[0]) {
    let items = getEditItems()
    if (!items?.length) return

    const currentItem = items.splice(startIndex, 1)[0]

    if (type === "forward") startIndex = Math.min(startIndex + 1, items.length)
    else if (type === "backward") startIndex = Math.max(startIndex - 1, 0)
    else if (type === "to_front") startIndex = items.length
    else if (type === "to_back") startIndex = 0

    items = [...items.slice(0, startIndex), currentItem, ...items.slice(startIndex)]
    if (!items?.length || items.length < 2) return

    if (!get(activeEdit).id) {
        const ref = getLayoutRef()
        const slideId = ref[get(activeEdit).slide!]?.id
        history({ id: "UPDATE", newData: { data: items, key: "slides", dataIsArray: true, keys: [slideId], subkey: "items" }, oldData: { id: get(activeShow)?.id }, location: { page: "edit", id: "show_key", override: "rearrange_items" } })
    } else {
        // overlay, template
        history({ id: "UPDATE", newData: { data: items, key: "items" }, oldData: { id: get(activeEdit).id }, location: { page: "edit", id: get(activeEdit).type, override: "rearrange_items" } })
    }

    activeEdit.update((a) => {
        // update selected edit item, because it has changed!
        // could set to selected: startIndex, but that's confusing because selected is always in front!
        a.items = []
        return a
    })

    refreshEditSlide.set(true)
}

export function rearrangeStageItems(type: string, itemId: string = get(activeStage).items[0]) {
    let items = getSortedStageItems()
    if (!items?.length || !itemId) return

    let startIndex = items.findIndex((a) => a.id === itemId)
    if (startIndex < 0) return

    const currentItem = items.splice(startIndex, 1)[0]

    if (type === "forward") startIndex = Math.min(startIndex + 1, items.length)
    else if (type === "backward") startIndex = Math.max(startIndex - 1, 0)
    else if (type === "to_front") startIndex = items.length
    else if (type === "to_back") startIndex = 0

    items = [...items.slice(0, startIndex), currentItem, ...items.slice(startIndex)]
    if (!items?.length || items.length < 2) return

    stageShows.update((a) => {
        a[get(activeStage).id!].itemOrder = items.map((item) => item.id)
        return a
    })

    activeStage.update((a) => {
        a.items = []
        return a
    })

    refreshEditSlide.set(true)
}

export function getSortedStageItems(stageId = get(activeStage).id, _updater: any = null) {
    if (!stageId) return []
    const stageShow = clone(get(stageShows)[stageId])
    if (!stageShow) return []

    const itemOrder = stageShow.itemOrder || Object.keys(stageShow.items)
    // if ((stageShow.itemOrder || [])?.length !== Object.keys(stageShow.items).length) {
    if (!stageShow.itemOrder) {
        stageShows.update((a) => {
            a[stageId].itemOrder = itemOrder
            return a
        })
    }

    const sortedItems: (StageItem & { id: string })[] = []
    itemOrder.forEach((itemId) => {
        const item = stageShow.items[itemId]
        if (!item) return
        sortedItems.push({ ...item, id: itemId })
    })

    return sortedItems
}

export function updateSortedStageItems() {
    const stageId = get(activeStage).id || ""
    stageShows.update((a) => {
        const stageLayout = a[stageId]
        const currentItemIds = Object.keys(stageLayout.items)
        let itemOrder = stageLayout.itemOrder || currentItemIds

        // remove items not existing anymore
        itemOrder = itemOrder.filter((id) => currentItemIds.includes(id))
        // add any new items
        const newItems = currentItemIds.filter((id) => !itemOrder.includes(id))

        a[stageId].itemOrder = [...itemOrder, ...newItems]
        return a
    })
}

export function shouldItemBeShown(item: Item, allItems: Item[] = [], { outputId, type }: any = { type: "default" }, _updater: any = null) {
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
    if (!isConditionMet(condition, itemsText, type)) return false

    return true
}

// get "temp" items (scripture) if stage
function getTempItems(item: Item, allItems: Item[]) {
    const stageOutputId = getStageOutputId(get(outputs))
    const currentOutput = get(outputs)[stageOutputId] || get(allOutputs)[stageOutputId] || {}
    const slideOffset = item.type ? Number((item as StageItem).slideOffset || 0) : 0
    const currentSlide = currentOutput.out?.slide || (slideOffset !== 0 ? get(outputSlideCache)[stageOutputId] || null : null)

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

function isConditionMet(condition: Condition | undefined, itemsText: string, type: "default" | "stage") {
    if (!condition) return true

    const conditionValues: boolean[] = condition.values.map((cVal) => {
        const element = cVal.element || "text"
        const elementId = cVal.elementId || ""

        let operator = cVal.operator || "is"
        if (element === "timer") operator = cVal.operator || "isAbove"

        const data = cVal.data || "value"
        let dataValue: string | number = cVal.value ?? ""
        if (data === "seconds") dataValue = (cVal.seconds || 0).toString()

        let value = ""
        if (element === "text") value = itemsText
        else if (element === "timer") value = getTimerValue(elementId)
        else if (element === "variable") value = getVariableValue(elementId)
        else if (element === "dynamicValue") value = getDynamicValue(elementId, type)

        if (operator === "is") {
            return value === dataValue
        } else if (operator === "isNot") {
            return value !== dataValue
        } else if (operator === "has") {
            return value.includes(dataValue)
        } else if (operator === "hasNot") {
            return !value.includes(dataValue)
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

function getTimerValue(timerId: string) {
    const timer = get(timers)[timerId]
    if (!timer) return "0"
    return getCurrentTimerValue(timer, { id: timerId }, new Date()).toString()
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

export function getDynamicValue(id: string, type: "default" | "stage" = "default") {
    const outputId = getActiveOutputs()[0]
    const outSlide = get(outputs)[outputId]?.out?.slide

    const ref = {
        showId: outSlide?.id || get(activeShow)?.id,
        layoutId: outSlide?.layout || _show().get("settings.activeLayout"),
        slideIndex: outSlide?.index ?? get(activeEdit).slide ?? -1,
        type: type === "stage" ? "stage" : get(activeEdit).type || "show_custom",
        id: get(activeEdit).id
    }

    const value = replaceDynamicValues(id.includes("{") ? id : dynamicValueText(id), { ...ref })
    return value
}
