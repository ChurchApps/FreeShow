import { get } from "svelte/store"
import { OUTPUT, REMOTE, STAGE } from "../../types/Channels"
import { midiInListen } from "../components/actions/midi"
import { getActiveOutputs } from "../components/helpers/output"
import { loadShows } from "../components/helpers/setShow"
import { updateCachedShow, updateCachedShows, updateShowsList } from "../components/helpers/show"
import {
    $,
    activeProject,
    activeShow,
    cachedShowsData,
    draw,
    drawSettings,
    drawTool,
    driveKeys,
    events,
    folders,
    gain,
    groups,
    media,
    midiIn,
    openedFolders,
    outputs,
    overlays,
    playerVideos,
    projects,
    refreshSlideThumbnails,
    shows,
    showsCache,
    special,
    stageShows,
    styles,
    templates,
    timeFormat,
    timers,
    transitionData,
    variables,
    volume,
} from "../stores"
import { driveConnect } from "./drive"
import { convertBackgrounds } from "./remoteTalk"
import { send } from "./request"
import { arrayToObject, eachConnection, filterObjectArray, sendData, timedout } from "./sendData"

export function storeSubscriber() {
    // load new show on show change
    activeShow.subscribe((a) => {
        if (a && (a.type === undefined || a.type === "show")) loadShows([a.id])
    })

    shows.subscribe((data) => {
        // sendData(REMOTE, { channel: "SHOWS", data })

        // temporary cache shows data
        updateShowsList(data)
    })
    showsCache.subscribe((data) => {
        send(OUTPUT, ["SHOWS"], data)

        // STAGE
        sendData(STAGE, { channel: "SLIDES" })

        // REMOTE

        // sendData(REMOTE, { channel: "SHOWS", data: get(shows) })

        // TODO: ?
        // send(REMOTE, ["SHOW"], data )
        timedout(REMOTE, { channel: "SHOW", data }, () =>
            eachConnection(REMOTE, "SHOW", async (connection) => {
                return connection.active ? await convertBackgrounds({ ...data[connection.active], id: connection.active }) : null
            })
        )
        // TODO: this, timedout +++
        // this is just for updating output slide pos I guess
        sendData(REMOTE, { channel: "OUT" })

        // cache shows data for faster show loading (if it's less than 100)
        if (Object.keys(data).length < 100) updateCachedShows(data)
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

        // STAGE
        // WIP all stage listeners should not send to all stages, just the connected ids
        send(STAGE, ["EVENTS"], data)
    })

    outputs.subscribe((data) => {
        send(OUTPUT, ["OUTPUTS"], data)
        // used for stage mirror data
        send(OUTPUT, ["ALL_OUTPUTS"], data)
        sendData(REMOTE, { channel: "OUT" })

        // STAGE
        sendData(STAGE, { channel: "SLIDES" }, true)
        // send(STAGE, ["OUTPUTS"], data)
        // sendBackgroundToStage(a)
    })
    styles.subscribe((data) => {
        send(OUTPUT, ["STYLES"], data)
    })
    playerVideos.subscribe((data) => {
        send(OUTPUT, ["PLAYER_VIDEOS"], data)
    })
    stageShows.subscribe((data) => {
        send(OUTPUT, ["STAGE_SHOWS"], data)

        // STAGE
        data = arrayToObject(filterObjectArray(data, ["disabled", "name", "settings", "items"]).filter((a: any) => a.disabled === false))
        timedout(STAGE, { channel: "SHOW", data }, () =>
            eachConnection(STAGE, "SHOW", (connection) => {
                if (!connection.active) return

                let currentData = data[connection.active]
                if (!currentData.settings.resolution?.width) currentData.settings.resolution = { width: 1920, height: 1080 }
                return currentData
            })
        )
    })

    draw.subscribe((data) => {
        let activeOutputs = getActiveOutputs()
        activeOutputs.forEach((id) => {
            send(OUTPUT, ["DRAW"], { id, data })
        })
    })
    drawTool.subscribe((data) => {
        let activeOutputs = getActiveOutputs()
        activeOutputs.forEach((id) => {
            send(OUTPUT, ["DRAW_TOOL"], { id, data })
        })
    })
    drawSettings.subscribe((data) => {
        send(OUTPUT, ["DRAW_SETTINGS"], data)
    })

    transitionData.subscribe((data) => {
        send(OUTPUT, ["TRANSITION"], data)
    })
    // timerTick.ts
    // activeTimers.subscribe((data) => {
    //     send(OUTPUT, ["ACTIVE_TIMERS"], data)
    // })

    // used by stage output
    media.subscribe((data) => {
        send(OUTPUT, ["MEDIA"], data)
    })

    timers.subscribe((data) => {
        send(OUTPUT, ["TIMERS"], data)

        // STAGE
        send(STAGE, ["TIMERS"], data)
    })
    variables.subscribe((data) => {
        send(OUTPUT, ["VARIABLES"], data)

        // STAGE
        send(STAGE, ["VARIABLES"], data)
    })

    special.subscribe((data) => {
        send(OUTPUT, ["SPECIAL"], data)
    })

    volume.subscribe((data) => {
        send(OUTPUT, ["VOLUME"], data)
    })
    gain.subscribe((data) => {
        send(OUTPUT, ["GAIN"], data)
    })

    timeFormat.subscribe((a) => {
        send(OUTPUT, ["TIME_FORMAT"], a)

        // STAGE
        send(STAGE, ["DATA"], { timeFormat: a })
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

    driveKeys.subscribe(driveConnect)

    refreshSlideThumbnails.subscribe((_) => {
        setTimeout(() => {
            refreshSlideThumbnails.set(false)
        })
    })
}

const initalOutputData = {
    STYLES: "styles",
    TRANSITION: "transitionData",
    SHOWS: "showsCache",

    TEMPLATES: "templates",
    OVERLAYS: "overlays",
    EVENTS: "events",

    DRAW: { data: "draw" },
    DRAW_TOOL: { data: "drawTool" },
    DRAW_SETTINGS: "drawSettings",

    VIZUALISER_DATA: "visualizerData",
    MEDIA: "media",
    TIMERS: "timers",
    VARIABLES: "variables",
    TIME_FORMAT: "timeFormat",

    SPECIAL: "special",

    PLAYER_VIDEOS: "playerVideos",
    STAGE_SHOWS: "stageShows",

    // received by Output
    VOLUME: "volume",
}

export function sendInitialOutputData() {
    Object.keys(initalOutputData).forEach((KEY) => {
        let storeKey = initalOutputData[KEY]

        let storeData: any
        if (storeKey.data) storeData = { data: get($[storeKey.data]) }
        else storeData = get($[storeKey])
        if (storeData === undefined) storeData = {}

        send(OUTPUT, [KEY], storeData)
    })

    setTimeout(() => {
        send(OUTPUT, ["OUTPUTS"], get(outputs))
        // used for stage mirror data
        send(OUTPUT, ["ALL_OUTPUTS"], get(outputs))
    }, 100)
}
