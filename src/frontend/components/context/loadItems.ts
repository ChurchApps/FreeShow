import { get } from "svelte/store"
import { activeEdit, contextData, drawerTabsData, groups, outputs, overlays, selected, sorted } from "../../stores"
import { translate } from "../../utils/language"
import { drawerTabs } from "../../values/tabs"
import { getEditItems, getEditSlide } from "../edit/scripts/itemHelpers"
import { chordAdders, keys } from "../edit/values/chords"
import { clone, keysToID, sortByName } from "../helpers/array"
import { getDynamicIds } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import type { ContextMenuItem } from "./contextMenus"
import { actionData } from "../actions/actionData"
import { getSlideText } from "../edit/scripts/textStyle"

const loadActions = {
    enabled_drawer_tabs: (items: ContextMenuItem[]) => {
        const tabsToRemove = 2
        let tabs = keysToID(clone(drawerTabs)).slice(tabsToRemove)
        items = tabs.map((a: any) => {
            let enabled = get(drawerTabsData)[a.id]?.enabled !== false
            return { id: a.id, label: a.name, icon: a.icon, enabled }
        })

        return items
    },
    sort_shows: (items: ContextMenuItem[]) => sortItems(items, "shows"),
    sort_projects: (items: ContextMenuItem[]) => sortItems(items, "projects"),
    slide_groups: (items: ContextMenuItem[]) => {
        let selectedIndex = get(selected).data[0]?.index
        let currentSlide = _show().layouts("active").ref()[0][selectedIndex]
        if (!currentSlide) return []

        let currentGroup = currentSlide.data?.globalGroup || ""
        items = Object.entries(get(groups)).map(([id, a]: any) => {
            return { id, color: a.color, label: a.default ? "groups." + a.name : a.name, translate: !!a.default, enabled: id === currentGroup }
        })

        return sortItemsByLabel(items)
    },
    actions: () => {
        let slideRef: any = _show().layouts("active").ref()[0][get(selected).data[0]?.index]
        let currentActions: any = slideRef?.data?.actions

        let slideActions = [
            { id: "action", label: "midi.start_action", icon: "actions" },
            { id: "receiveMidi", label: "actions.play_on_midi", icon: "play", enabled: currentActions?.receiveMidi || false },
            "SEPERATOR",
            { id: "nextTimer", label: "preview.nextTimer", icon: "clock", enabled: Number(slideRef?.data?.nextTimer || 0) || false },
            { id: "loop", label: "preview.to_start", icon: "restart", enabled: slideRef?.data?.end || false },
            { id: "nextAfterMedia", label: "actions.next_after_media", icon: "forward", enabled: currentActions?.nextAfterMedia || false },
            "SEPERATOR",
            { id: "animate", label: "popup.animate", icon: "stars", enabled: currentActions?.animate || false },
        ]

        return slideActions
    },
    item_actions: () => {
        let slide = getEditSlide()
        if (!slide) return []

        let selectedItems: number[] = get(activeEdit).items || []
        let currentItemActions: any = slide.items?.[selectedItems[0]]?.actions || {}

        let itemActions: any = [
            { id: "transition", label: "popup.transition", icon: "transition", enabled: !!currentItemActions.transition },
            { id: "showTimer", label: "actions.show_timer", icon: "time_in", enabled: Number(currentItemActions.showTimer || 0) || false },
            { id: "hideTimer", label: "actions.hide_timer", icon: "time_out", enabled: Number(currentItemActions.hideTimer || 0) || false },
        ]

        return itemActions
    },
    remove_layers: () => {
        let layoutSlide: any = _show().layouts("active").ref()[0][get(selected).data[0]?.index] || {}

        // text content
        let hasTextContent = getSlideText(_show().slides([layoutSlide.id]).get()[0])
        setContextData("textContent", hasTextContent)

        let data: any = layoutSlide.data
        if (!data) return []

        let showMedia: any = _show().get().media
        let media: any[] = []

        // get background
        let bg = data.background
        if (bg && showMedia[bg]?.name) {
            media.push({
                id: bg,
                label: showMedia[bg].name.indexOf(".") > -1 ? showMedia[bg].name.slice(0, showMedia[bg].name.lastIndexOf(".")) : showMedia[bg].name,
                translate: false,
                icon: "image",
            })
        }

        // get overlays
        let ol = data.overlays || []
        if (ol.length) {
            if (media.length) media.push("SEPERATOR")
            media.push(...ol.map((id: string) => ({ id, label: get(overlays)[id].name, translate: false, icon: "overlays" })).sort((a, b) => a.label.localeCompare(b.label)))
        }

        // get audio
        let audio = data.audio || []
        if (audio.length) {
            if (media.length) media.push("SEPERATOR")
            let audioItems = audio
                .map((id: string) => ({
                    id,
                    label: showMedia[id].name.indexOf(".") > -1 ? showMedia[id].name.slice(0, showMedia[id].name.lastIndexOf(".")) : showMedia[id].name,
                    translate: false,
                    icon: "music",
                }))
                .sort((a, b) => a.label.localeCompare(b.label))
            media.push(...audioItems)
        }

        // get mics
        let mics = data.mics || []
        if (mics.length) {
            if (media.length) media.push("SEPERATOR")
            let micItems = mics
                .map((mic: any) => ({
                    id: mic.id,
                    label: mic.name,
                    translate: false,
                    icon: "microphone",
                }))
                .sort((a, b) => a.label.localeCompare(b.label))
            media.push(...micItems)
        }

        // get slide actions
        let slideActions = data.actions?.slideActions || []
        if (slideActions.length) {
            if (media.length) media.push("SEPERATOR")
            let actionItems = slideActions
                .map((action: any) => ({
                    id: action.id,
                    label: actionData[action.triggers?.[0]]?.name || "",
                    icon: actionData[action.triggers?.[0]]?.icon || "actions",
                    type: "action",
                }))
                .sort((a, b) => a.label.localeCompare(b.label))
            media.push(...actionItems)
        }

        setContextData("layers", !!media?.length)

        if (media.length) return media
        return [{ label: "empty.general", disabled: true }]
    },
    keys: () => {
        return keys.map((key) => ({ id: key, label: key, translate: false }))
    },
    chord_list: (items: ContextMenuItem[]) => {
        keys.forEach((key) => {
            chordAdders.forEach((adder) => {
                items.push({ id: key + adder, label: key + adder, translate: false })
            })
        })

        return items
    },
    bind_slide: (_items, isItem: boolean = false) => {
        let outputList: any[] = sortByName(keysToID(get(outputs)).filter((a) => !a.isKeyOutput && !a.stageOutput))

        outputList = outputList.map((a) => ({ id: a.id, label: a.name, translate: false }))
        if (isItem) outputList.push("SEPERATOR", { id: "stage", label: "menu.stage" })

        let currentBindings: string[] = []
        if (isItem) {
            // get current item bindings
            let editItems: any[] = getEditItems(true)
            currentBindings = editItems[0]?.bindings || []
        } else {
            let selectedIndex = get(selected).data[0]?.index
            let currentSlide = _show().layouts("active").ref()[0]?.[selectedIndex] || {}
            currentBindings = currentSlide.data?.bindings || []
        }

        outputList = outputList.map((a) => {
            if (currentBindings.includes(a.id)) a.enabled = true
            return a
        })

        setContextData("outputList", outputList?.length > 1)

        return outputList
    },
    bind_item: () => loadActions.bind_slide([], true),
    dynamic_values: () => {
        let values: any = getDynamicIds().map((id) => ({ id, label: id, translate: false }))
        let firstShowIndex = values.findIndex((a) => a.id.includes("show_"))
        let firstVideoIndex = values.findIndex((a) => a.id.includes("video_"))
        let firstMetaIndex = values.findIndex((a) => a.id.includes("meta_"))
        values = [...values.slice(0, firstShowIndex), "SEPERATOR", ...values.slice(firstShowIndex, firstVideoIndex), "SEPERATOR", ...values.slice(firstVideoIndex, firstMetaIndex), "SEPERATOR", ...values.slice(firstMetaIndex)]

        return values
    },
}

function setContextData(key: string, data: any) {
    contextData.update((a) => {
        a[key] = data
        return a
    })
}

function sortItems(items: ContextMenuItem[], id: "projects" | "shows") {
    let type = get(sorted)[id]?.type || "name"

    items = [
        { id: "name", label: "sort.name", icon: "text", enabled: type === "name" },
        { id: "created", label: "info.created", icon: "calendar", enabled: type === "created" },
    ]
    if (id === "shows") {
        items.push({ id: "modified", label: "info.modified", icon: "calendar", enabled: type === "modified" })
        items.push({ id: "used", label: "info.used", icon: "calendar", enabled: type === "used" })
    }

    return items
}

function sortItemsByLabel(items: ContextMenuItem[]) {
    return items.sort((a, b) => {
        let aName = a.translate ? translate(a.label) : a.label
        let bName = b.translate ? translate(b.label) : b.label

        return aName.localeCompare(bName)
    })
}

export function loadItems(id: string): [string, ContextMenuItem][] {
    if (!loadActions[id]) return []

    let items: ContextMenuItem[] = loadActions[id]([])
    let menuItems: [string, ContextMenuItem][] = items.map((a: any) => [a === "SEPERATOR" ? a : id, a])

    return menuItems
}

export function quickLoadItems(id: string) {
    if (!loadActions[id]) return
    loadActions[id]([])
}
