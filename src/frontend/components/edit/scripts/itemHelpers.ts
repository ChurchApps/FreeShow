import { get } from "svelte/store"
import type { Item, ItemType } from "../../../../types/Show"
import { activeEdit, activeShow, overlays, showsCache, templates, timers } from "../../../stores"
import { createNewTimer } from "../../drawer/timers/timers"
import { history } from "../../helpers/history"
import { _show } from "../../helpers/shows"
import { getStyles, removeText } from "../../helpers/style"

export function addItem(type: ItemType, id: any = null, options: any = {}) {
    let activeTemplate: string | null = get(activeShow)?.id ? get(showsCache)[get(activeShow)!.id!]?.settings?.template : null
    let template = activeTemplate ? get(templates)[activeTemplate]?.items : null

    let newData: Item = {
        style: template?.[0]?.style || "top:121px;left:50.5px;height:840px;width:1820px;",
        type,
    }
    if (id) newData.id = id

    if (type === "text") newData.lines = [{ align: template?.[0].lines?.[0].align || "", text: [{ value: "", style: template?.[0].lines?.[0].text?.[0].style || "" }] }]
    if (type === "list") newData.list = { items: [] }
    // else if (type === "timer") newData.timer = { id: uid(), name: get(dictionary).timer?.counter || "Counter", type: "counter", start: 300, end: 0 }
    else if (type === "timer") newData.timerId = Object.keys(get(timers))[0] || createNewTimer()
    else if (type === "clock") newData.clock = { type: "digital", seconds: false }
    else if (type === "mirror") newData.mirror = {}
    else if (type === "media") newData.src = options.src || ""
    else if (type === "variable") newData.variable = { id: "" }
    else if (type === "web") newData.web = { url: "" }
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
    let slide: any = {}

    if (active.id) {
        if (active.type === "overlay") slide = get(overlays)[active.id]
        else if (active.type === "template") slide = get(templates)[active.id]

        return slide
    }

    let editSlideRef: any = _show().layouts("active").ref()[0]?.[active.slide ?? ""] || {}
    slide = _show().get("slides")?.[editSlideRef.id]

    return slide
}

export function getEditItems(onlyActive: boolean = false) {
    let active = get(activeEdit)
    let selectedItems: number[] = active.items

    let editSlide = getEditSlide()
    if (!editSlide?.items) return []

    let editItems = editSlide.items
    if (onlyActive) editItems = editItems.filter((_, i) => selectedItems.includes(i))

    return editItems
}
