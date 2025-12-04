import { get } from "svelte/store"
import type { Condition, ConditionValue, Item, ItemType, Slide } from "../../../../types/Show"
import type { StageItem } from "../../../../types/Stage"
import { activeEdit, activeShow, activeStage, activeTimers, allOutputs, outputs, outputSlideCache, overlays, refreshEditSlide, showsCache, stageShows, templates, timers, variables } from "../../../stores"
import { addSlideAction } from "../../actions/actions"
import { createNewTimer, getCurrentTimerValue } from "../../drawer/timers/timers"
import { clone, keysToID, sortByName } from "../../helpers/array"
import { history } from "../../helpers/history"
import { getFirstActiveOutput, getStageOutputId } from "../../helpers/output"
import { getLayoutRef } from "../../helpers/show"
import { dynamicValueText, getVariableValue, replaceDynamicValues } from "../../helpers/showActions"
import { _show } from "../../helpers/shows"
import { getStyles, removeText } from "../../helpers/style"
import { itemBoxes } from "../values/boxes"
import { getItemText } from "./textStyle"

export const DEFAULT_ITEM_STYLE = "top:120px;left:50px;height:840px;width:1820px;"

function getDefaultStyles(type: ItemType, templateItems: Item[] | null = null) {
    // Get position styles from template or use default from boxes.ts
    const positionStyle = templateItems?.find(a => (a.type || "text") === type)?.style || DEFAULT_ITEM_STYLE

    // Get default styles from boxes configuration
    const boxDefaults = itemBoxes[type]?.sections?.font?.inputs?.flat() || []
    let styleString = positionStyle

    // Add default font styles if they exist
    boxDefaults.forEach(def => {
        if (def.type === "toggle" || def.type === "radio") return
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

    // selected item is always on top, deselect to make new item on top
    activeEdit.set({ ...get(activeEdit), items: [] })

    if (type === "text") newData.lines = [{ align: template?.[0]?.lines?.[0]?.align || "", text: [{ value: textValue, style: template?.[0]?.lines?.[0]?.text?.[0]?.style || "" }] }]
    if (type === "list") newData.list = { items: [] }
    // else if (type === "timer") newData.timer = { id: uid(), name: get(dictionary).timer?.counter || "Counter", type: "counter", start: 300, end: 0 }
    else if (type === "timer") {
        const timerId = options.timer?.id || sortByName(keysToID(get(timers)))[0]?.id || createNewTimer()
        newData.timer = { id: timerId, ...get(timers)[timerId] }
        if (get(timers)[timerId]?.type === "counter") addSlideAction(get(activeEdit).slide ?? -1, "start_slide_timers")
    } else if (type === "clock") newData.clock = { type: "digital", dateFormat: "none", showTime: true, seconds: false }
    else if (type === "weather") {
        newData.weather = {}

        let style = getStyles(newData.style)
        style = { ...style, width: "1530px", height: "680px", left: "195px", top: "200px" }
        let styleString = ""
        Object.entries(style).forEach(([key, value]) => {
            styleString += `${key}: ${value};`
        })
        newData.style = styleString
    } else if (type === "mirror") newData.mirror = {}
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
        const left: string = Number(removeText(style.left)) + Number(removeText(style.width)) / 2 - size / 2 + "px"
        style = { ...style, top, left, width: size + "px", height: size + "px", color: options.color }
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

    activeEdit.update(a => {
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

    let startIndex = items.findIndex(a => a.id === itemId)
    if (startIndex < 0) return

    const currentItem = items.splice(startIndex, 1)[0]

    if (type === "forward") startIndex = Math.min(startIndex + 1, items.length)
    else if (type === "backward") startIndex = Math.max(startIndex - 1, 0)
    else if (type === "to_front") startIndex = items.length
    else if (type === "to_back") startIndex = 0

    items = [...items.slice(0, startIndex), currentItem, ...items.slice(startIndex)]
    if (!items?.length || items.length < 2) return

    stageShows.update(a => {
        a[get(activeStage).id!].itemOrder = items.map(item => item.id)
        return a
    })

    activeStage.update(a => {
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
        stageShows.update(a => {
            a[stageId].itemOrder = itemOrder
            return a
        })
    }

    const sortedItems: (StageItem & { id: string })[] = []
    itemOrder.forEach(itemId => {
        const item = stageShow.items[itemId]
        if (!item) return
        sortedItems.push({ ...item, id: itemId })
    })

    return sortedItems
}

export function updateSortedStageItems() {
    const stageId = get(activeStage).id || ""
    stageShows.update(a => {
        const stageLayout = a[stageId]
        if (!stageLayout) return a

        const currentItemIds = Object.keys(stageLayout.items)
        let itemOrder = stageLayout.itemOrder || currentItemIds

        // remove items not existing anymore
        itemOrder = itemOrder.filter(id => currentItemIds.includes(id))
        // add any new items
        const newItems = currentItemIds.filter(id => !itemOrder.includes(id))

        a[stageId].itemOrder = [...itemOrder, ...newItems]
        return a
    })
}

export function shouldItemBeShown(item: Item, allItems: Item[] = [], { outputId, type }: any = { type: "default" }, _updater: any = null, preview = false) {
    // check bindings
    if (!preview && item.bindings?.length && !item.bindings.includes(outputId)) return false

    if (type === "stage") allItems = getTempItems(item, allItems)

    if (!allItems.length) allItems = [item]
    const slideItems = allItems.filter(a => !a?.bindings?.length || a.bindings.includes(outputId))
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

export function isConditionMet(condition: Condition | undefined, itemsText: string, type: "default" | "stage", _updater: any = null) {
    if (!condition) return true

    if (!Array.isArray(condition)) {
        condition = (condition as any)?.values?.length ? [[[(condition as any).values]]] : []
    }

    // outerOr
    const conditionMet = !!condition.find(outerAnd => {
        return outerAnd.every(innerOr => {
            return !!innerOr.find(innerAnd => {
                return innerAnd.every(content => {
                    return checkConditionValue(content, itemsText, type)
                })
            })
        })
    })

    return conditionMet
}

export function checkConditionValue(cVal: ConditionValue, itemsText: string, type: "default" | "stage", _updater: any = null) {
    const element = cVal.element || "text"
    let elementId = cVal.elementId || ""
    if (element === "timer" && !elementId) elementId = getFirstActiveTimer()

    let operator = cVal.operator || "is"
    if (element === "timer") operator = cVal.operator || "isRunning"

    const data = cVal.data || "value"
    let dataValue: string | number = cVal.value ?? ""
    if (data === "seconds" || (element === "timer" && operator !== "isRunning")) dataValue = (cVal.seconds || 0).toString()
    // dynamic value text
    if (dataValue.toString().includes("{")) dataValue = getDynamicValue(dataValue.toString(), type)

    let value = ""
    if (element === "text") value = itemsText
    else if (element === "timer") value = getTimerValue(elementId)
    else if (element === "variable") value = _getVariableValue(elementId)
    else if (element === "dynamicValue") value = getDynamicValue(elementId, type)

    if (operator === "is") {
        return value === dataValue
    } else if (operator === "isNot") {
        return value !== dataValue
    } else if (operator === "has") {
        return value.includes(dataValue)
    } else if (operator === "hasNot") {
        return !value.includes(dataValue)
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
    if (!firstTimerId) firstTimerId = sortByName(keysToID(get(timers))).find(timer => timer.type !== "counter")?.id || ""

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

    return !!get(activeTimers).find(a => a.id === timerId)
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

export function getDynamicValue(id: string, type: "default" | "stage" = "default") {
    const outSlide = getFirstActiveOutput()?.out?.slide

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
