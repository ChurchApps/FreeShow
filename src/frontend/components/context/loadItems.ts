import { get } from "svelte/store"
import { drawerTabsData, groups, overlays, selected } from "../../stores"
import { translate } from "../../utils/language"
import { drawerTabs } from "../../values/tabs"
import { keys } from "../edit/values/chords"
import { _show } from "../helpers/shows"
import type { ContextMenuItem } from "./contextMenus"

export function loadItems(id: string): [string, ContextMenuItem][] {
    let items: [string, ContextMenuItem][] = []
    switch (id) {
        case "enabled_drawer_tabs":
            Object.entries(drawerTabs).forEach(([aID, a]: any, i) => {
                if (i >= 2) items.push([id, { id: aID, label: a.name, icon: a.icon, enabled: get(drawerTabsData)[aID]?.enabled }])
            })
            break
        case "slide_groups":
            let selectedIndex = get(selected).data[0]?.index
            let currentSlide = _show().layouts("active").ref()[0][selectedIndex]
            let currentGroup = currentSlide?.data?.globalGroup
            if (!currentGroup) return []

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
                { id: "loop", label: "preview.to_start", icon: "restart", enabled: slideRef?.data?.end || false },
                { id: "nextAfterMedia", label: "actions.next_after_media", icon: "forward", enabled: currentActions?.nextAfterMedia || false },
                { id: "startTimer", label: "actions.start_timer", icon: "timer", enabled: currentActions?.startTimer || false },
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
        case "remove_media":
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
            if (ol.length) media.push(...ol.map((id: string) => ({ id, label: get(overlays)[id].name, translate: false, icon: "overlays" })))
            // get audio
            let audio = data.audio || []
            if (audio.length)
                media.push(
                    ...audio.map((id: string) => ({
                        id,
                        label: showMedia[id].name.indexOf(".") > -1 ? showMedia[id].name.slice(0, showMedia[id].name.lastIndexOf(".")) : showMedia[id].name,
                        translate: false,
                        icon: "music",
                    }))
                )

            if (media.length) media.forEach((action: any) => items.push([id, action]))
            else items = [[id, { label: "empty.general" }]]

            items = items.sort((a, b) => a[1].label.localeCompare(b[1].label))
            break
        case "keys":
            items = keys.map((key) => [id, { id: key, label: key, translate: false }])
            break
    }
    return items
}
