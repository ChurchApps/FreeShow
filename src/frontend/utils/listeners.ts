import { get } from "svelte/store"
import { OUTPUT, REMOTE } from "../../types/Channels"
import { updateCachedShow, updateCachedShows, updateShowsList } from "../components/helpers/show"
import {
    activeProject,
    activeShow,
    activeTimers,
    cachedShowsData,
    draw,
    drawSettings,
    drawTool,
    events,
    folders,
    groups,
    mediaFolders,
    midiIn,
    openedFolders,
    outputs,
    overlays,
    playerVideos,
    projects,
    shows,
    showsCache,
    templates,
    transitionData,
    volume,
} from "../stores"
import { midiInListen } from "./midi"
import { convertBackgrounds } from "./remoteTalk"
import { send } from "./request"
import { eachConnection, sendData, timedout } from "./sendData"

export function listenForUpdates() {
    shows.subscribe((data) => {
        sendData(REMOTE, { channel: "SHOWS", data })

        // temporary cache shows data
        updateShowsList(data)
    })
    showsCache.subscribe((data) => {
        send(OUTPUT, ["SHOWS"], data)

        // REMOTE

        sendData(REMOTE, { channel: "SHOWS", data: get(shows) })

        // TODO: ?
        // send(REMOTE, ["SHOW"], data )
        timedout(REMOTE, { channel: "SHOW", data }, () =>
            eachConnection(REMOTE, "SHOW", (connection) => {
                return connection.active ? convertBackgrounds(data[connection.active]) : null
            })
        )
        // TODO: this, timedout +++
        sendData(REMOTE, { channel: "OUT" }, true)

        // cache shows data for faster show loading
        updateCachedShows(data)
    })

    templates.subscribe((data) => {
        send(OUTPUT, ["TEMPLATES"], data)

        // set all loaded shows to false, so show style can be updated from template again
        cachedShowsData.update((a) => {
            Object.keys(a).forEach((id) => {
                a[id].template.slidesUpdated = false
            })

            return a
        })
        // Object.keys(get(cachedShowsData)).forEach(id => {
        //     if (get(showsCache)[id]?.settings?.template === id) // set false
        // });
    })
    overlays.subscribe((data) => {
        send(OUTPUT, ["OVERLAYS"], data)
    })

    events.subscribe((data) => {
        send(OUTPUT, ["EVENTS"], data)
    })

    outputs.subscribe((data) => {
        send(OUTPUT, ["OUTPUTS"], data)
        sendData(REMOTE, { channel: "OUT" })
    })
    playerVideos.subscribe((data) => {
        send(OUTPUT, ["PLAYER_VIDEOS"], data)
    })

    draw.subscribe((data) => {
        send(OUTPUT, ["DRAW"], data)
    })
    drawTool.subscribe((data) => {
        send(OUTPUT, ["DRAW_TOOL"], data)
    })
    drawSettings.subscribe((data) => {
        send(OUTPUT, ["DRAW_SETTINGS"], data)
    })

    transitionData.subscribe((data) => {
        send(OUTPUT, ["TRANSITION"], data)
    })
    activeTimers.subscribe((data) => {
        send(OUTPUT, ["ACTIVE_TIMERS"], data)
    })
    mediaFolders.subscribe((data) => {
        send(OUTPUT, ["MEDIA"], data)
    })

    volume.subscribe((data) => {
        send(OUTPUT, ["VOLUME"], data)
    })

    projects.subscribe(() => {
        sendData(REMOTE, { channel: "PROJECTS" }, true)
    })
    folders.subscribe((data) => {
        send(REMOTE, ["FOLDERS"], { folders: data, opened: get(openedFolders) })
    })
    activeProject.subscribe((data) => {
        send(REMOTE, ["PROJECT"], data)
    })

    //

    midiIn.subscribe(midiInListen)

    activeShow.subscribe((data) => {
        if (!data?.id) return
        let type = data?.type || "show"
        if (type !== "show") return

        let show = get(showsCache)[data.id]
        cachedShowsData.update((a) => {
            a[data.id] = updateCachedShow(data.id, show)
            return a
        })
    })

    groups.subscribe(() => {
        // TODO: only update groups, not all the other values
        updateCachedShows(get(showsCache))
    })
}
