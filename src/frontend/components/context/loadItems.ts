import { get } from "svelte/store"
import { activeEdit, drawerTabsData, groups, outputs, overlays, selected, templates } from "../../stores"
import { translate } from "../../utils/language"
import { drawerTabs } from "../../values/tabs"
import { chordAdders, keys } from "../edit/values/chords"
import { keysToID } from "../helpers/array"
import { _show } from "../helpers/shows"
import type { ContextMenuItem } from "./contextMenus"

export function loadItems(id: string): [string, ContextMenuItem][] {
    let items: [string, ContextMenuItem][] = []
    switch (id) {
        case "enabled_drawer_tabs":
            Object.entries(drawerTabs).forEach(([aID, a]: any, i) => {
                if (i >= 2) items.push([id, { id: aID, label: a.name, icon: a.icon, enabled: get(drawerTabsData)[aID]?.enabled !== false }])
            })
            break
        case "slide_groups":
            let selectedIndex = get(selected).data[0]?.index
            let currentSlide = _show().layouts("active").ref()[0][selectedIndex]
            if (!currentSlide) return []
            let currentGroup = currentSlide.data?.globalGroup || ""

            Object.entries(get(groups)).forEach(([aID, a]: any) => {
                items.push([id, { id: aID, color: a.color, label: a.default ? "groups." + a.name : a.name, translate: a.default, enabled: aID === currentGroup }])
            })

            items = items.sort((a, b) => {
                let aName = a[1].translate ? translate(a[1].label) : a[1].label
                let bName = b[1].translate ? translate(b[1].label) : b[1].label
                return aName.localeCompare(bName)
            })
            break
        case "actions":
            let slideRef: any = _show().layouts("active").ref()[0][get(selected).data[0]?.index]
            let currentActions: any = slideRef?.data?.actions

            let actions: any = [
                { id: "nextTimer", label: "preview.nextTimer", icon: "clock", enabled: Number(slideRef?.data?.nextTimer || 0) || false },
                { id: "loop", label: "preview.to_start", icon: "restart", enabled: slideRef?.data?.end || false },
                { id: "animate", label: "popup.animate", icon: "stars", enabled: currentActions?.animate || false },
                { id: "startShow", label: "preview._start", icon: "showIcon", enabled: currentActions?.startShow || false },
                { id: "nextAfterMedia", label: "actions.next_after_media", icon: "forward", enabled: currentActions?.nextAfterMedia || false },
                { id: "startTimer", label: "actions.start_timer", icon: "timer", enabled: currentActions?.startTimer || false },
                { id: "outputStyle", label: "actions.change_output_style", icon: "styles", enabled: currentActions?.outputStyle || false },
                { id: "receiveMidi", label: "actions.play_on_midi", icon: "play" },
                { id: "sendMidi", label: "actions.send_midi", icon: "music" },
            ]
            let clearActions: any = [
                { id: "stopTimers", label: "actions.stop_timers", icon: "stop", enabled: currentActions?.stopTimers || false },
                { id: "clearBackground", label: "clear.background", icon: "background", enabled: currentActions?.clearBackground || false },
                { id: "clearOverlays", label: "clear.overlays", icon: "overlays", enabled: currentActions?.clearOverlays || false },
                { id: "clearAudio", label: "clear.audio", icon: "audio", enabled: currentActions?.clearAudio || false },
            ]
            items = [...items, ...actions.map((a) => [id, a]), ["SEPERATOR"], ...clearActions.map((a) => [id, a])]
            break
        case "item_actions":
            let editSlideRef: any = _show().layouts("active").ref()[0]?.[get(activeEdit).slide ?? ""] || {}
            let slide = _show().get("slides")?.[editSlideRef.id]

            if (get(activeEdit).id) {
                if (get(activeEdit).type === "overlay") slide = get(overlays)[get(activeEdit).id!]
                else if (get(activeEdit).type === "template") slide = get(templates)[get(activeEdit).id!]
            }
            if (!slide) return []

            let selectedItems: number[] = get(activeEdit).items
            let currentItemActions: any = slide.items[selectedItems[0]].actions || {}

            let itemActions: any = [
                { id: "transition", label: "popup.transition", icon: "transition", enabled: !!currentItemActions.transition },
                { id: "showTimer", label: "actions.show_timer", icon: "time_in", enabled: Number(currentItemActions.showTimer || 0) || false },
                { id: "hideTimer", label: "actions.hide_timer", icon: "time_out", enabled: Number(currentItemActions.hideTimer || 0) || false },
            ]

            items = itemActions.map((a) => [id, a])
            break
        case "remove_layers":
            let data: any = _show().layouts("active").ref()[0][get(selected).data[0]?.index]?.data
            if (!data) return []
            let showMedia: any = _show().get().media
            let media: any[] = []

            // get background
            let bg = data.background
            if (bg)
                media.push({
                    id: bg,
                    label: showMedia[bg].name.indexOf(".") > -1 ? showMedia[bg].name.slice(0, showMedia[bg].name.lastIndexOf(".")) : showMedia[bg].name,
                    translate: false,
                    icon: "image",
                })

            // get overlays
            let ol = data.overlays || []
            if (ol.length) {
                if (media.length) media.push({ id: "SEPERATOR", label: "" })
                media.push(...ol.map((id: string) => ({ id, label: get(overlays)[id].name, translate: false, icon: "overlays" })).sort((a, b) => a.label.localeCompare(b.label)))
            }

            // get audio
            let audio = data.audio || []
            if (audio.length) {
                if (media.length) media.push({ id: "SEPERATOR", label: "" })
                media.push(
                    ...audio
                        .map((id: string) => ({
                            id,
                            label: showMedia[id].name.indexOf(".") > -1 ? showMedia[id].name.slice(0, showMedia[id].name.lastIndexOf(".")) : showMedia[id].name,
                            translate: false,
                            icon: "music",
                        }))
                        .sort((a, b) => a.label.localeCompare(b.label))
                )
            }

            // get mics
            let mics = data.mics || []
            if (mics.length) {
                if (media.length) media.push({ id: "SEPERATOR", label: "" })
                media.push(
                    ...mics
                        .map((mic: any) => ({
                            id: mic.id,
                            label: mic.name,
                            translate: false,
                            icon: "microphone",
                        }))
                        .sort((a, b) => a.label.localeCompare(b.label))
                )
            }

            if (media.length) media.forEach((action: any) => items.push([action.id === "SEPERATOR" ? action.id : id, action]))
            else items = [[id, { label: "empty.general", disabled: true }]]

            // items = items.sort((a, b) => a[1].label.localeCompare(b[1].label))
            break
        case "keys":
            items = keys.map((key) => [id, { id: key, label: key, translate: false }])
            break
        case "chord_list":
            keys.forEach((key) => {
                chordAdders.forEach((adder) => {
                    items.push([id, { id: key + adder, label: key + adder, translate: false }])
                })
            })
            break
        case "output_list":
            let outputList: any[] = keysToID(get(outputs))
                .filter((a) => !a.isKeyOutput)
                .sort((a, b) => a.name.localeCompare(b.name))

            outputList = outputList.map((a) => ["bind_item", { id: a.id, label: a.name, translate: false }])
            outputList = [["bind_item", { id: "stage", label: "menu.stage" }], ...outputList]

            // get current item bindings
            // TODO: global function to get item from all different slide types
            let editSlideRef2: any = _show().layouts("active").ref()[0]?.[get(activeEdit).slide ?? ""] || {}
            let slide2 = _show().get("slides")?.[editSlideRef2.id]
            if (get(activeEdit).id) {
                if (get(activeEdit).type === "overlay") slide2 = get(overlays)[get(activeEdit).id!]
                else if (get(activeEdit).type === "template") slide2 = get(templates)[get(activeEdit).id!]
            }
            let selectedItem: number = get(activeEdit).items[0]
            let currentItemBindings: any = slide2 ? slide2.items?.[selectedItem]?.bindings || [] : []
            outputList = outputList.map((a) => {
                if (currentItemBindings.includes(a[1].id)) a[1].enabled = true
                return a
            })

            items.push(...outputList)
            break
    }
    return items
}
