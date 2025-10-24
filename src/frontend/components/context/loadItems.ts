import { get } from "svelte/store"
import type { Media } from "../../../types/Show"
import {
    actions,
    actionTags,
    activeActionTagFilter,
    activeEdit,
    activeMediaTagFilter,
    activeTagFilter,
    activeVariableTagFilter,
    contextData,
    drawerTabsData,
    globalTags,
    groups,
    media,
    mediaTags,
    outputs,
    overlays,
    selected,
    shows,
    sorted,
    variables,
    variableTags
} from "../../stores"
import { translateText } from "../../utils/language"
import { drawerTabs } from "../../values/tabs"
import { actionData } from "../actions/actionData"
import { getActionName, getActionTriggerId } from "../actions/actions"
import { getEditItems, getEditSlide } from "../edit/scripts/itemHelpers"
import { getSlideText } from "../edit/scripts/textStyle"
import { chordTypes, keys } from "../edit/values/chords"
import { clone, keysToID, sortByName, sortObject } from "../helpers/array"
import { removeExtension } from "../helpers/media"
import { getLayoutRef } from "../helpers/show"
import { _show } from "../helpers/shows"
import type { ContextMenuItem } from "./contextMenus"

const loadActions = {
    enabled_drawer_tabs: (items: ContextMenuItem[]) => {
        const tabsToRemove = 2
        const tabs = keysToID(clone(drawerTabs)).slice(tabsToRemove)
        items = tabs.map((a) => {
            const enabled = get(drawerTabsData)[a.id]?.enabled !== false
            return { id: a.id, label: a.name, icon: a.icon, iconColor: "var(--secondary)", enabled }
        })

        return items
    },

    // TAGS
    tag_set: () => {
        const selectedShowTags = get(shows)[get(selected).data[0]?.id]?.quickAccess?.tags || []
        const sortedTags: (ContextMenuItem | "SEPARATOR")[] = sortObject(sortByName(keysToID(get(globalTags))), "color").map((a) => ({ ...a, label: a.name, enabled: selectedShowTags.includes(a.id), translate: false }))
        const create = { label: "popup.manage_tags", icon: "edit", iconColor: "#97c7ff", id: "create" }
        if (sortedTags.length) sortedTags.push("SEPARATOR")
        sortedTags.push(create)
        return sortedTags
    },
    tag_filter: () => {
        const sortedTags = sortObject(sortByName(keysToID(get(globalTags))), "color").map((a) => ({ ...a, label: a.name, enabled: get(activeTagFilter).includes(a.id), translate: false }))
        setContextData("tags", sortedTags.length)
        return sortedTags
    },
    media_tag_set: () => {
        const selectedTags = get(media)[get(selected).data[0]?.path]?.tags || []
        const sortedTags: (ContextMenuItem | "SEPARATOR")[] = sortObject(sortByName(keysToID(get(mediaTags))), "color").map((a) => ({ ...a, label: a.name, enabled: selectedTags.includes(a.id), translate: false }))
        const create = { label: "popup.manage_tags", icon: "edit", iconColor: "#97c7ff", id: "create" }
        if (sortedTags.length) sortedTags.push("SEPARATOR")
        sortedTags.push(create)
        return sortedTags
    },
    media_tag_filter: () => {
        const sortedTags = sortObject(sortByName(keysToID(get(mediaTags))), "color").map((a) => ({ ...a, label: a.name, enabled: get(activeMediaTagFilter).includes(a.id), translate: false }))
        setContextData("media_tags", sortedTags.length)
        return sortedTags
    },
    action_tag_set: () => {
        const selectedTags = get(actions)[get(selected).data[0]?.id]?.tags || []
        const sortedTags: (ContextMenuItem | "SEPARATOR")[] = sortObject(sortByName(keysToID(get(actionTags))), "color").map((a) => ({ ...a, label: a.name, enabled: selectedTags.includes(a.id), translate: false }))
        const create = { label: "popup.manage_tags", icon: "edit", iconColor: "#97c7ff", id: "create" }
        if (sortedTags.length) sortedTags.push("SEPARATOR")
        sortedTags.push(create)
        return sortedTags
    },
    action_tag_filter: () => {
        let sortedTags = sortObject(sortByName(keysToID(get(actionTags))), "color").map((a) => ({ ...a, label: a.name, enabled: get(activeActionTagFilter).includes(a.id), translate: false }))
        if (get(activeActionTagFilter).length) sortedTags = sortedTags.filter((a) => a.id !== get(drawerTabsData).functions?.activeSubmenu)
        setContextData("action_tags", sortedTags.length)
        return sortedTags
    },
    variable_tag_set: () => {
        const selectedTags = get(variables)[get(selected).data[0]?.id]?.tags || []
        const sortedTags: (ContextMenuItem | "SEPARATOR")[] = sortObject(sortByName(keysToID(get(variableTags))), "color").map((a) => ({ ...a, label: a.name, enabled: selectedTags.includes(a.id), translate: false }))
        const create = { label: "popup.manage_tags", icon: "edit", iconColor: "#97c7ff", id: "create" }
        if (sortedTags.length) sortedTags.push("SEPARATOR")
        sortedTags.push(create)
        return sortedTags
    },
    variable_tag_filter: () => {
        let sortedTags = sortObject(sortByName(keysToID(get(variableTags))), "color").map((a) => ({ ...a, label: a.name, enabled: get(activeVariableTagFilter).includes(a.id), translate: false }))
        sortedTags = sortedTags.filter((a) => a.id !== get(drawerTabsData).functions?.activeSubmenu)
        setContextData("variable_tags", sortedTags.length)
        return sortedTags
    },

    sort_shows: (items: ContextMenuItem[]) => sortItems(items, "shows"),
    sort_projects: (items: ContextMenuItem[]) => sortItems(items, "projects"),
    sort_media: (items: ContextMenuItem[]) => sortItems(items, "media"),
    slide_groups: (items: ContextMenuItem[]) => {
        const selectedIndex = get(selected).data[0]?.index
        const slideRef = getLayoutRef()?.[selectedIndex] || {}
        const currentSlide = _show().get("slides")[slideRef.id]
        if (!currentSlide) return []

        const currentGroup: string = currentSlide.globalGroup || ""
        const noGroup = currentSlide.group === "." || currentGroup === "none"
        const isParent = slideRef.type === "parent"

        items = Object.entries(get(groups)).map(([id, a]) => {
            // strange bug, where name is { "isTrusted": true }, maybe an old issue
            // https://www.reddit.com/r/freeshowapp/comments/1j0w6mt/freeshow_keeps_on_freezing
            if (typeof a.name !== "string") a.name = ""
            return { id, color: a.color, label: a.default ? "groups." + a.name : a.name, translate: !!a.default, enabled: id === currentGroup }
        })

        if (!isParent && !items.length) return [{ label: "empty.general", disabled: true }]
        // , icon: "remove"
        return [...(isParent ? [{ id: "none", label: "main.none", enabled: noGroup, style: "opacity: 0.8;" }] : []), ...sortItemsByLabel(items)]
    },
    actions: () => {
        const slideRef = getLayoutRef()?.[get(selected).data[0]?.index]
        const currentActions = slideRef?.data?.actions

        const slideActions = [
            { id: "action", label: "midi.start_action", icon: "actions", iconColor: "#d497ff" },
            "SEPARATOR",
            { id: "slide_shortcut", label: "actions.play_with_shortcut", icon: "play", iconColor: "#7d81ff", enabled: currentActions?.slide_shortcut || false },
            { id: "receiveMidi", label: "actions.play_on_midi", icon: "play", iconColor: "#7d81ff", enabled: currentActions?.receiveMidi || false },
            "SEPARATOR",
            { id: "nextTimer", label: "preview.nextTimer", icon: "clock", iconColor: "#fca4ff", enabled: Number(slideRef?.data?.nextTimer || 0) || false },
            { id: "loop", label: "preview.to_start", icon: "restart", iconColor: "#fca4ff", enabled: slideRef?.data?.end || false },
            { id: "nextAfterMedia", label: "actions.next_after_media", iconColor: "#fca4ff", icon: "forward", enabled: currentActions?.nextAfterMedia || false },
            "SEPARATOR",
            { id: "animate", label: "popup.animate", icon: "stars", iconColor: "#fff1ad", enabled: currentActions?.animate || false }
        ]

        return slideActions
    },
    item_actions: () => {
        const slide = getEditSlide()
        if (!slide) return []

        const selectedItems: number[] = get(activeEdit).items || []
        const currentItem = slide.items?.[selectedItems[0]]
        const currentItemActions = currentItem?.actions || {}

        const itemActions: any[] = []
        if (get(activeEdit).type !== "overlay") {
            itemActions.push({ id: "clickReveal", label: "actions.click_reveal", icon: "click_action", iconColor: "#d4a3f6", enabled: !!currentItem?.clickReveal })
            if (currentItem?.type === "text" || currentItem?.lines) itemActions.push({ id: "lineReveal", label: "actions.line_reveal", icon: "line_reveal", iconColor: "#d4a3f6", enabled: !!currentItem?.lineReveal })
        }

        itemActions.push(
            ...[
                // { id: "transition", label: "popup.transition", icon: "transition", enabled: !!currentItemActions.transition },
                { id: "showTimer", label: "actions.show_timer", icon: "time_in", iconColor: "#cd86ff", enabled: Number(currentItemActions.showTimer || 0) || false },
                { id: "hideTimer", label: "actions.hide_timer", icon: "time_out", iconColor: "#cd86ff", enabled: Number(currentItemActions.hideTimer || 0) || false }
            ]
        )

        return itemActions
    },
    remove_layers: () => {
        const layoutSlides = getLayoutRef()
        const layoutSlide = layoutSlides[get(selected).data[0]?.index] || {}

        // text content
        let textContent = ""
        get(selected).data.forEach(({ index }) => {
            textContent += getSlideText(_show().slides([layoutSlides[index]?.id]).get()?.[0])
        })
        setContextData("textContent", textContent)

        const data = layoutSlide.data
        if (!data) return []

        const showMedia: { [key: string]: Media } = _show().get()?.media || {}
        const mediaList: (ContextMenuItem | "SEPARATOR")[] = []

        // get background
        const bg = data.background
        if (bg && showMedia[bg]?.name) {
            mediaList.push({
                id: bg,
                label: removeExtension(showMedia[bg].name!),
                translate: false,
                icon: "image"
            })
        }

        // get overlays
        const ol = data.overlays || []
        if (ol.length) {
            if (mediaList.length) mediaList.push("SEPARATOR")
            mediaList.push(
                ...sortByName(
                    ol.map((id: string) => ({ id, label: get(overlays)[id]?.name, translate: false, icon: "overlays" })),
                    "label"
                )
            )
        }

        // get audio
        const audio = data.audio || []
        if (audio.length) {
            if (mediaList.length) mediaList.push("SEPARATOR")
            const audioItems = sortByName(
                audio.map((id: string) => {
                    const name = showMedia[id]?.name || ""
                    return {
                        id,
                        label: name.indexOf(".") > -1 ? name.slice(0, name.lastIndexOf(".")) : name,
                        translate: false,
                        icon: "music"
                    }
                }),
                "label"
            )
            mediaList.push(...audioItems)
        }

        // get mics
        const mics = data.mics || []
        if (mics.length) {
            if (mediaList.length) mediaList.push("SEPARATOR")
            const micItems = sortByName(
                mics.map((mic) => ({
                    id: mic.id,
                    label: mic.name,
                    translate: false,
                    icon: "microphone"
                })),
                "label"
            )
            mediaList.push(...micItems)
        }

        // get slide actions
        const slideActions = data.actions?.slideActions || []
        if (slideActions.length) {
            if (mediaList.length) mediaList.push("SEPARATOR")
            const actionItems = sortByName(
                slideActions.map((action) => {
                    const triggerId = getActionTriggerId(action.triggers?.[0])
                    const customData = actionData[triggerId] || {}
                    const actionValue = action?.actionValues?.[triggerId] || action?.actionValues?.[action.triggers?.[0]] || {}
                    const customName = getActionName(triggerId, actionValue) || (action.name !== translateText(customData.name) ? action.name : "")

                    const label = translateText(actionData[triggerId]?.name || "") + (customName ? ` (${customName})` : "")
                    const icon = actionData[triggerId]?.icon || "actions"

                    return { id: action.id || triggerId, label, translate: false, icon, type: "action" }
                }),
                "label"
            )
            mediaList.push(...actionItems)
        }

        setContextData("layers", !!mediaList?.length)

        if (mediaList.length) return mediaList
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
        const outputList: any[] = sortByName(keysToID(get(outputs)).filter((a) => !a.stageOutput))

        let contextOutputList: (ContextMenuItem | "SEPARATOR")[] = outputList.map((a) => ({ id: a.id, label: a.name, translate: false }))
        const isOverlay = get(activeEdit).type === "overlay"
        // overlay items does not show up in stage view anyway
        if (isItem && !isOverlay) contextOutputList.push("SEPARATOR", { id: "stage", label: "menu.stage" })

        let currentBindings: string[] = []
        if (isItem) {
            // get current item bindings
            const editItems = getEditItems(true)
            currentBindings = editItems[0]?.bindings || []
        } else {
            const selectedIndex = get(selected).data[0]?.index
            const currentSlide = getLayoutRef()?.[selectedIndex] || {}
            currentBindings = currentSlide.data?.bindings || []
        }

        contextOutputList = contextOutputList.map((a) => {
            if (typeof a !== "string" && currentBindings.includes(a.id!)) a.enabled = true
            return a
        })

        setContextData("outputList", contextOutputList?.length > 1)

        return contextOutputList
    },
    bind_item: () => loadActions.bind_slide([], true)
}

function setContextData(key: string, data: boolean | string | number) {
    contextData.update((a) => {
        a[key] = data
        return a
    })
}

function sortItems(items: ContextMenuItem[], id: "shows" | "projects" | "media") {
    const type = get(sorted)[id]?.type || "name"

    items = [
        { id: "name", label: "sort.name", icon: "text", enabled: type === "name" },
        { id: "name_des", label: "sort.name_des", icon: "text", enabled: type === "name_des" },
        { id: "created", label: "info.created", icon: "calendar", enabled: type === "created" },
        { id: "modified", label: "info.modified", icon: "calendar", enabled: type === "modified" }
    ]
    if (id === "shows") {
        items.push({ id: "used", label: "info.used", icon: "calendar", enabled: type === "used" })

        // WIP load used metadata values...
    }

    return items
}

function sortItemsByLabel(items: ContextMenuItem[]) {
    return items.sort((a, b) => {
        const aName = a.translate ? translateText(a.label) : a.label
        const bName = b.translate ? translateText(b.label) : b.label

        return aName.localeCompare(bName)
    })
}

export function loadItems(id: string): [string, ContextMenuItem | "SEPARATOR"][] {
    if (!loadActions[id]) return []

    const items: (ContextMenuItem | "SEPARATOR")[] = loadActions[id]([])
    const menuItems: [string, ContextMenuItem | "SEPARATOR"][] = items.map((a) => [a === "SEPARATOR" ? a : id, a])

    return menuItems
}

export function quickLoadItems(id: string) {
    if (!loadActions[id]) return
    loadActions[id]([])
}
