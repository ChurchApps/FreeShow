import { get } from "svelte/store"
import { activeEdit, activeTagFilter, contextData, drawerTabsData, globalTags, groups, outputs, overlays, selected, shows, sorted } from "../../stores"
import { translate } from "../../utils/language"
import { drawerTabs } from "../../values/tabs"
import { actionData } from "../actions/actionData"
import { getEditItems, getEditSlide } from "../edit/scripts/itemHelpers"
import { getSlideText } from "../edit/scripts/textStyle"
import { chordTypes, keys } from "../edit/values/chords"
import { clone, keysToID, sortByName, sortObject } from "../helpers/array"
import { getDynamicIds } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import type { ContextMenuItem } from "./contextMenus"

const loadActions = {
    enabled_drawer_tabs: (items: ContextMenuItem[]) => {
        const tabsToRemove = 2
        const tabs = keysToID(clone(drawerTabs)).slice(tabsToRemove)
        items = tabs.map((a: any) => {
            const enabled = get(drawerTabsData)[a.id]?.enabled !== false
            return { id: a.id, label: a.name, icon: a.icon, enabled }
        })

        return items
    },
    tag_set: () => {
        const selectedShowTags = get(shows)[get(selected).data[0]?.id]?.quickAccess?.tags || []
        const sortedTags = sortObject(sortByName(keysToID(get(globalTags))), "color").map((a) => ({
            ...a,
            label: a.name,
            enabled: selectedShowTags.includes(a.id),
            translate: false,
        }))
        setContextData("tags", sortedTags.length)
        return sortedTags
    },
    tag_filter: () => {
        const sortedTags = sortObject(sortByName(keysToID(get(globalTags))), "color").map((a) => ({
            ...a,
            label: a.name,
            enabled: get(activeTagFilter).includes(a.id),
            translate: false,
        }))
        setContextData("tags", sortedTags.length)
        return sortedTags
    },
    sort_shows: (items: ContextMenuItem[]) => sortItems(items, "shows"),
    sort_projects: (items: ContextMenuItem[]) => sortItems(items, "projects"),
    slide_groups: (items: ContextMenuItem[]) => {
        const selectedIndex = get(selected).data[0]?.index
        const currentSlide = _show().layouts("active").ref()[0]?.[selectedIndex]
        if (!currentSlide) return []

        const currentGroup = currentSlide.data?.globalGroup || ""
        items = Object.entries(get(groups)).map(([id, a]: any) => {
            return {
                id,
                color: a.color,
                label: a.default ? "groups." + a.name : a.name,
                translate: !!a.default,
                enabled: id === currentGroup,
            }
        })

        return sortItemsByLabel(items)
    },
    actions: () => {
        const slideRef: any = _show().layouts("active").ref()[0]?.[get(selected).data[0]?.index]
        const currentActions: any = slideRef?.data?.actions

        const slideActions = [
            { id: "action", label: "midi.start_action", icon: "actions" },
            {
                id: "slide_shortcut",
                label: "actions.play_with_shortcut",
                icon: "play",
                enabled: currentActions?.slide_shortcut || false,
            },
            {
                id: "receiveMidi",
                label: "actions.play_on_midi",
                icon: "play",
                enabled: currentActions?.receiveMidi || false,
            },
            "SEPERATOR",
            {
                id: "nextTimer",
                label: "preview.nextTimer",
                icon: "clock",
                enabled: Number(slideRef?.data?.nextTimer || 0) || false,
            },
            {
                id: "loop",
                label: "preview.to_start",
                icon: "restart",
                enabled: slideRef?.data?.end || false,
            },
            {
                id: "nextAfterMedia",
                label: "actions.next_after_media",
                icon: "forward",
                enabled: currentActions?.nextAfterMedia || false,
            },
            "SEPERATOR",
            {
                id: "animate",
                label: "popup.animate",
                icon: "stars",
                enabled: currentActions?.animate || false,
            },
        ]

        return slideActions
    },
    item_actions: () => {
        const slide = getEditSlide()
        if (!slide) return []

        const selectedItems: number[] = get(activeEdit).items || []
        const currentItemActions: any = slide.items?.[selectedItems[0]]?.actions || {}

        const itemActions: any = [
            // { id: "transition", label: "popup.transition", icon: "transition", enabled: !!currentItemActions.transition },
            {
                id: "showTimer",
                label: "actions.show_timer",
                icon: "time_in",
                enabled: Number(currentItemActions.showTimer || 0) || false,
            },
            {
                id: "hideTimer",
                label: "actions.hide_timer",
                icon: "time_out",
                enabled: Number(currentItemActions.hideTimer || 0) || false,
            },
        ]

        return itemActions
    },
    remove_layers: () => {
        const layoutSlides = _show().layouts("active").ref()[0] || {}
        const layoutSlide: any = layoutSlides[get(selected).data[0]?.index] || {}

        // text content
        let textContent = ""
        get(selected).data.forEach(({ index }) => {
            textContent += getSlideText(_show().slides([layoutSlides[index]?.id]).get()[0])
        })
        setContextData("textContent", textContent)

        const data: any = layoutSlide.data
        if (!data) return []

        const showMedia: any = _show().get().media
        const media: any[] = []

        // get background
        const bg = data.background
        if (bg && showMedia[bg]?.name) {
            media.push({
                id: bg,
                label: showMedia[bg].name.indexOf(".") > -1 ? showMedia[bg].name.slice(0, showMedia[bg].name.lastIndexOf(".")) : showMedia[bg].name,
                translate: false,
                icon: "image",
            })
        }

        // get overlays
        const ol = data.overlays || []
        if (ol.length) {
            if (media.length) media.push("SEPERATOR")
            media.push(
                ...sortByName(
                    ol.map((id: string) => ({
                        id,
                        label: get(overlays)[id].name,
                        translate: false,
                        icon: "overlays",
                    })),
                    "label"
                )
            )
        }

        // get audio
        const audio = data.audio || []
        if (audio.length) {
            if (media.length) media.push("SEPERATOR")
            const audioItems = sortByName(
                audio.map((id: string) => ({
                    id,
                    label: showMedia[id].name.indexOf(".") > -1 ? showMedia[id].name.slice(0, showMedia[id].name.lastIndexOf(".")) : showMedia[id].name,
                    translate: false,
                    icon: "music",
                })),
                "label"
            )
            media.push(...audioItems)
        }

        // get mics
        const mics = data.mics || []
        if (mics.length) {
            if (media.length) media.push("SEPERATOR")
            const micItems = sortByName(
                mics.map((mic: any) => ({
                    id: mic.id,
                    label: mic.name,
                    translate: false,
                    icon: "microphone",
                })),
                "label"
            )
            media.push(...micItems)
        }

        // get slide actions
        const slideActions = data.actions?.slideActions || []
        if (slideActions.length) {
            if (media.length) media.push("SEPERATOR")
            const actionItems = sortByName(
                slideActions.map((action: any) => ({
                    id: action.id,
                    label: actionData[action.triggers?.[0]]?.name || "",
                    icon: actionData[action.triggers?.[0]]?.icon || "actions",
                    type: "action",
                })),
                "label"
            )
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
            chordTypes.forEach((adder) => {
                items.push({ id: key + adder, label: key + adder, translate: false })
            })
        })

        return items
    },
    bind_slide: (_items, isItem = false) => {
        let outputList: any[] = sortByName(keysToID(get(outputs)).filter((a) => !a.isKeyOutput && !a.stageOutput))

        outputList = outputList.map((a) => ({
            id: a.id,
            label: a.name,
            translate: false,
        }))
        if (isItem) outputList.push("SEPERATOR", { id: "stage", label: "menu.stage" })

        let currentBindings: string[] = []
        if (isItem) {
            // get current item bindings
            const editItems: any[] = getEditItems(true)
            currentBindings = editItems[0]?.bindings || []
        } else {
            const selectedIndex = get(selected).data[0]?.index
            const currentSlide = _show().layouts("active").ref()[0]?.[selectedIndex] || {}
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
        let values: any = getDynamicIds().map((id) => ({
            id,
            label: id,
            translate: false,
        }))
        const firstShowIndex = values.findIndex((a) => a.id.includes("show_"))
        const firstVideoIndex = values.findIndex((a) => a.id.includes("video_"))
        const firstMetaIndex = values.findIndex((a) => a.id.includes("meta_"))
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
    const type = get(sorted)[id]?.type || "name"

    items = [
        { id: "name", label: "sort.name", icon: "text", enabled: type === "name" },
        {
            id: "name_des",
            label: "sort.name_des",
            icon: "text",
            enabled: type === "name_des",
        },
        {
            id: "created",
            label: "info.created",
            icon: "calendar",
            enabled: type === "created",
        },
        {
            id: "modified",
            label: "info.modified",
            icon: "calendar",
            enabled: type === "modified",
        },
    ]
    if (id === "shows") {
        items.push({
            id: "used",
            label: "info.used",
            icon: "calendar",
            enabled: type === "used",
        })

        // WIP load used metadata values...
    }

    return items
}

function sortItemsByLabel(items: ContextMenuItem[]) {
    return items.sort((a, b) => {
        const aName = a.translate ? translate(a.label) : a.label
        const bName = b.translate ? translate(b.label) : b.label

        return aName.localeCompare(bName)
    })
}

export function loadItems(id: string): [string, ContextMenuItem][] {
    if (!loadActions[id]) return []

    const items: ContextMenuItem[] = loadActions[id]([])
    const menuItems: [string, ContextMenuItem][] = items.map((a: any) => [a === "SEPERATOR" ? a : id, a])

    return menuItems
}

export function quickLoadItems(id: string) {
    if (!loadActions[id]) return
    loadActions[id]([])
}
