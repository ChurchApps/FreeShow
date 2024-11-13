import { get } from "svelte/store"
import type { Item, ItemType } from "../../../../types/Show"
import { activeEdit, activeShow, overlays, refreshEditSlide, showsCache, templates, timers } from "../../../stores"
import { createNewTimer } from "../../drawer/timers/timers"
import { history } from "../../helpers/history"
import { _show } from "../../helpers/shows"
import { getStyles, removeText } from "../../helpers/style"
import { addSlideAction } from "../../actions/actions"
import { clone, keysToID, sortByName } from "../../helpers/array"

export function addItem(type: ItemType, id: any = null, options: any = {}) {
    let activeTemplate: string | null = get(activeShow)?.id ? get(showsCache)[get(activeShow)!.id!]?.settings?.template : null
    let template = activeTemplate ? get(templates)[activeTemplate]?.items : null

    let newData: Item = {
        style: template?.[0]?.style || "top:121px;left:50.5px;height:840px;width:1820px;",
        type,
    }
    if (id) newData.id = id

    if (type === "text") newData.lines = [{ align: template?.[0]?.lines?.[0]?.align || "", text: [{ value: "", style: template?.[0]?.lines?.[0]?.text?.[0]?.style || "" }] }]
    if (type === "list") newData.list = { items: [] }
    // else if (type === "timer") newData.timer = { id: uid(), name: get(dictionary).timer?.counter || "Counter", type: "counter", start: 300, end: 0 }
    else if (type === "timer") {
        newData.timerId = sortByName(keysToID(get(timers)))[0]?.id || createNewTimer()
        if (get(timers)[newData.timerId || ""]?.type === "counter") addSlideAction(get(activeEdit).slide ?? -1, "start_slide_timers")
    } else if (type === "clock") newData.clock = { type: "digital", seconds: false }
    else if (type === "mirror") newData.mirror = {}
    else if (type === "media") newData.src = options.src || ""
    else if (type === "variable") newData.variable = { id: "" }
    else if (type === "slide_tracker") newData.auto = true
    else if (type === "web") newData.web = { url: "" }
    else if (type === "captions") newData.captions = {}
    else if (type === "icon" && options.color) {
        // make square and center
        let size: number = 300
        let style: any = getStyles(newData.style)
        let top: string = Number(removeText(style.top)) + Number(removeText(style.height)) / 2 - size / 2 + "px"
        let left: string = Number(removeText(style.left)) + Number(removeText(style.width)) / 2 - size / 2 + "px"
        style = { ...style, top, left, width: size + "px", height: size + "px", color: options.color }
        let styleString: string = ""
        Object.entries(style).forEach(([key, value]: any) => {
            styleString += `${key}: ${value};`
        })
        newData.style = styleString
    } else if (type === "icon" && options.path) {
        newData.customSvg = options.path
    }

    console.log(newData)

    if (!get(activeEdit).id) {
        let ref = _show().layouts("active").ref()[0]
        let slideId = ref[get(activeEdit).slide!]?.id
        history({ id: "UPDATE", newData: { data: newData, key: "slides", keys: [slideId], subkey: "items", index: -1 }, oldData: { id: get(activeShow)?.id }, location: { page: "edit", id: "show_key" } })
    } else {
        // overlay, template
        history({ id: "UPDATE", newData: { data: newData, key: "items", index: -1 }, oldData: { id: get(activeEdit).id }, location: { page: "edit", id: get(activeEdit).type } })
    }
}

export function getEditSlide() {
    let active = get(activeEdit)

    if (active.id) {
        if (active.type === "overlay") return get(overlays)[active.id]
        if (active.type === "template") return get(templates)[active.id]
        return {}
    }

    let editSlideRef: any = _show().layouts("active").ref()[0]?.[active.slide ?? ""] || {}
    return _show().get("slides")?.[editSlideRef.id]
}

export function getEditItems(onlyActive: boolean = false) {
    let active = get(activeEdit)
    let selectedItems: number[] = active.items

    let editSlide = clone(getEditSlide())
    if (!Array.isArray(editSlide?.items)) return []

    let editItems = editSlide.items
    if (onlyActive) editItems = editItems.filter((_, i) => selectedItems.includes(i))

    return editItems || []
}

// rearrange
export function rearrangeItems(type: string, startIndex: number = get(activeEdit).items[0]) {
    let items = getEditItems()
    if (!items?.length) return

    let currentItem = items.splice(startIndex, 1)[0]

    if (type === "forward") startIndex = Math.min(startIndex + 1, items.length)
    else if (type === "backward") startIndex = Math.max(startIndex - 1, 0)
    else if (type === "to_front") startIndex = items.length
    else if (type === "to_back") startIndex = 0

    items = [...items.slice(0, startIndex), currentItem, ...items.slice(startIndex)]
    if (!items?.length || items.length < 2) return

    if (!get(activeEdit).id) {
        let ref = _show().layouts("active").ref()[0]
        let slideId = ref[get(activeEdit).slide!]?.id
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
