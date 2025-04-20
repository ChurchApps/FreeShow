import { get } from "svelte/store"
import { OUTPUT, REMOTE, STAGE } from "../../types/Channels"
import { midiInListen } from "../components/actions/midi"
import { getActiveOutputs } from "../components/helpers/output"
import { loadShows } from "../components/helpers/setShow"
import { getShowCacheId, updateCachedShow, updateCachedShows, updateShowsList } from "../components/helpers/show"
import {
    $,
    activeProject,
    activeShow,
    cachedShowsData,
    colorbars,
    customMessageCredits,
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
    scriptures,
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

        // dynamic values // this causes performance issues
        // send(OUTPUT, ["SHOWS_DATA"], data)
    })

    let timeout: NodeJS.Timeout | null = null
    showsCache.subscribe((data) => {
        send(OUTPUT, ["SHOWS"], data)

        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => {
            // STAGE
            // sendData(STAGE, { channel: "SLIDES" })
            sendData(STAGE, { channel: "SHOW_DATA" })

            // REMOTE

            // sendData(REMOTE, { channel: "SHOWS", data: get(shows) })

            // WIP convertBackgrounds is triggered many times...

            // TODO: ?
            // send(REMOTE, ["SHOW"], data )
            timedout(REMOTE, { channel: "SHOW", data }, () =>
                eachConnection(REMOTE, "SHOW", async (connection: any) => {
                    return connection.active ? await convertBackgrounds({ ...data[connection.active], id: connection.active }) : null
                })
            )
            // TODO: this, timedout +++
            // this is just for updating output slide pos I guess
            sendData(REMOTE, { channel: "OUT" })

            // cache shows data for faster show loading (if it's less than 100)
            if (Object.keys(data).length < 100) updateCachedShows(data)

            timeout = null
        }, 80)
    })

    templates.subscribe((data) => {
        send(OUTPUT, ["TEMPLATES"], data)

        // set all loaded shows to false, so show style can be updated from template again
        cachedShowsData.update((a) => {
            Object.keys(a).forEach((id) => {
                let customId = getShowCacheId(id, get(showsCache)[id])
                if (!a[customId]?.template) return
                a[customId].template.slidesUpdated = false
            })

            return a
        })
        // Object.keys(get(cachedShowsData)).forEach(id => {
        //     if (get(showsCache)[id]?.settings?.template === id) // set false
        // });
    })
    overlays.subscribe((data) => {
        send(OUTPUT, ["OVERLAYS"], data)
        send(REMOTE, ["OVERLAYS"], data)
    })

    events.subscribe((data) => {
        send(OUTPUT, ["EVENTS"], data)

        // STAGE
        // WIP all stage listeners should not send to all stages, just the connected ids
        send(STAGE, ["EVENTS"], data)
    })
    scriptures.subscribe((data) => {
        send(REMOTE, ["SCRIPTURE"], data)
    })

    outputs.subscribe((data) => {
        send(OUTPUT, ["OUTPUTS"], data)
        // used for stage mirror data
        send(OUTPUT, ["ALL_OUTPUTS"], data)

        // let it update properly
        setTimeout(() => {
            sendData(REMOTE, { channel: "OUT" })
            sendData(REMOTE, { channel: "OUT_DATA" })
        })

        // STAGE
        sendData(STAGE, { channel: "OUT" })
        // sendData(STAGE, { channel: "SLIDES" }, true)
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
        timedout(STAGE, { channel: "LAYOUT", data }, () =>
            eachConnection(STAGE, "LAYOUT", (connection: any) => {
                if (!connection.active) return

                let currentData = data[connection.active]
                if (!currentData.settings.resolution?.width) currentData.settings.resolution = { width: 1920, height: 1080 }
                return currentData
            })
        )
    })

    draw.subscribe((data) => {
        let activeOutputs = getActiveOutputs(get(outputs), true, true, true)
        activeOutputs.forEach((id: any) => {
            send(OUTPUT, ["DRAW"], { id, data })
        })
    })
    drawTool.subscribe((data) => {
        // WIP changing tool while output is not active, will not update tool in output if set to active before changing tool again
        let activeOutputs = getActiveOutputs()
        activeOutputs.forEach((id: any) => {
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

    customMessageCredits.subscribe((data) => {
        send(OUTPUT, ["CUSTOM_CREDITS"], data)
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

    projects.subscribe((a) => {
        sendData(REMOTE, { channel: "PROJECTS" }, true)

        // dynamic values
        send(OUTPUT, ["PROJECTS"], a)
    })
    folders.subscribe((data) => {
        send(REMOTE, ["FOLDERS"], { folders: data, opened: get(openedFolders) })
    })
    activeProject.subscribe((a) => {
        send(REMOTE, ["PROJECT"], a)

        // dynamic values
        send(OUTPUT, ["ACTIVE_PROJECT"], a)
    })

    colorbars.subscribe((a) => {
        send(OUTPUT, ["COLORBARS"], a)
    })

    //

    midiIn.subscribe(midiInListen)

    activeShow.subscribe((data) => {
        if (!data?.id) return
        let type = data?.type || "show"
        if (type !== "show") return

        let show = get(showsCache)[data.id]
        cachedShowsData.update((a) => {
            let customId = getShowCacheId(data.id, show)
            a[customId] = updateCachedShow(data.id, show)
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

const initalOutputData: any = {
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

    // for dynamic values
    PROJECTS: "projects",
    ACTIVE_PROJECT: "activeProject",
    SHOWS_DATA: "shows",

    // received by Output
    VOLUME: "volume",
}

export function sendInitialOutputData() {
    Object.keys(initalOutputData).forEach((KEY) => {
        let storeKey: any = initalOutputData[KEY]

        let storeData: any
        if (storeKey.data) storeData = { data: get($[storeKey.data as keyof typeof $]) }
        else storeData = get($[storeKey as keyof typeof $])
        if (storeData === undefined) storeData = {}

        send(OUTPUT, [KEY], storeData)
    })

    setTimeout(() => {
        send(OUTPUT, ["OUTPUTS"], get(outputs))
        // used for stage mirror data
        send(OUTPUT, ["ALL_OUTPUTS"], get(outputs))
    }, 100)
}
