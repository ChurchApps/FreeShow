import { get } from "svelte/store"
import { OUTPUT, REMOTE, STAGE } from "../../types/Channels"
import { AudioPlayer } from "../audio/audioPlayer"
import { midiInListen } from "../components/actions/midi"
import { getActiveOutputs } from "../components/helpers/output"
import { loadShows } from "../components/helpers/setShow"
import { getShowCacheId, updateCachedShow, updateCachedShows, updateShowsList } from "../components/helpers/show"
import {
    $,
    actions,
    actionTags,
    activeProject,
    activeScripture,
    activeShow,
    activeTimers,
    audioChannelsData,
    audioData,
    cachedShowsData,
    colorbars,
    customMessageCredits,
    customMetadata,
    draw,
    drawSettings,
    drawTool,
    driveKeys,
    effects,
    equalizerConfig,
    events,
    folders,
    gain,
    groups,
    livePrepare,
    media,
    metronome,
    metronomeTimer,
    openedFolders,
    outputs,
    outputSlideCache,
    overlayCategories,
    overlays,
    playerVideos,
    playingAudio,
    projects,
    refreshSlideThumbnails,
    runningActions,
    scriptures,
    shows,
    showsCache,
    special,
    stageShows,
    styles,
    templateCategories,
    templates,
    timeFormat,
    timers,
    transitionData,
    triggers,
    variableTags,
    variables,
    volume
} from "../stores"
import { hasNewerUpdate } from "./common"
import { driveConnect } from "./drive"
import { convertBackgrounds } from "./remoteTalk"
import { send } from "./request"
import { arrayToObject, eachConnection, filterObjectArray, sendData, timedout } from "./sendData"

export function storeSubscriber() {
    shows.subscribe(async (data) => {
        if (await hasNewerUpdate("LISTENER_SHOWS", 200)) return

        // sendData(REMOTE, { channel: "SHOWS", data })

        // temporary cache shows data
        updateShowsList(data)

        // dynamic values // this causes performance issues
        // send(OUTPUT, ["SHOWS_DATA"], data)
    })

    showsCache.subscribe(async (data) => {
        if (await hasNewerUpdate("LISTENER_SHOWSCACHE")) return

        // needs to be sent before output data
        send(OUTPUT, ["SHOWS"], data)

        if (await hasNewerUpdate("LISTENER_SHOWSCACHE_LONGER", 50)) return

        // STAGE
        // sendData(STAGE, { channel: "SLIDES" })
        sendData(STAGE, { channel: "SHOW_DATA" })

        // REMOTE

        // sendData(REMOTE, { channel: "SHOWS", data: get(shows) })

        // WIP convertBackgrounds is triggered many times...

        // TODO: ?
        // send(REMOTE, ["SHOW"], data )
        timedout(REMOTE, { channel: "SHOW", data }, () =>
            eachConnection(REMOTE, "SHOW", async (connection) => {
                return connection.active ? await convertBackgrounds({ ...data[connection.active], id: connection.active }) : null
            })
        )
        // TODO: this, timedout +++
        // this is just for updating output slide pos I guess
        // sendData(REMOTE, { channel: "OUT" })

        // cache shows data for faster show loading (if it's less than 100)
        if (Object.keys(data).length < 100) updateCachedShows(data)
    })

    templates.subscribe(async (data) => {
        if (await hasNewerUpdate("LISTENER_TEMPLATES", 50)) return

        send(OUTPUT, ["TEMPLATES"], data)
        send(REMOTE, ["TEMPLATES"], data)

        // set all loaded shows to false, so show style can be updated from template again
        cachedShowsData.update((a) => {
            Object.keys(a).forEach((id) => {
                const customId = getShowCacheId(id, get(showsCache)[id])
                if (!a[customId]?.template) return
                a[customId].template.slidesUpdated = false
            })

            return a
        })
        // Object.keys(get(cachedShowsData)).forEach(id => {
        //     if (get(showsCache)[id]?.settings?.template === id) // set false
        // });
    })
    templateCategories.subscribe(async (data) => {
        if (await hasNewerUpdate("LISTENER_TEMPLATE_CATEGORIES", 50)) return

        send(REMOTE, ["TEMPLATE_CATEGORIES"], data)
    })
    overlays.subscribe(async (data) => {
        if (await hasNewerUpdate("LISTENER_OVERLAYS", 50)) return

        send(OUTPUT, ["OVERLAYS"], data)
        send(REMOTE, ["OVERLAYS"], data)
    })
    overlayCategories.subscribe(async (data) => {
        if (await hasNewerUpdate("LISTENER_OVERLAY_CATEGORIES", 50)) return

        send(REMOTE, ["OVERLAY_CATEGORIES"], data)
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
    activeScripture.subscribe(async (data) => {
        // Debounce and filter ACTIVE_SCRIPTURE to avoid sending partial states (book-only/chapter-only)
        if (await hasNewerUpdate("LISTENER_ACTIVE_SCRIPTURE", 120)) return

        const source: any = (data && ((data as any).api || (data as any).bible)) || data || {}
        const hasBook = source.bookId !== undefined && source.bookId !== null
        const hasChapter = source.chapterId !== undefined && source.chapterId !== null
        const hasVerses = Array.isArray(source.activeVerses) && source.activeVerses.length > 0
        if (hasBook && hasChapter && hasVerses) send(REMOTE, ["ACTIVE_SCRIPTURE"], data)
    })

    outputs.subscribe(async (data) => {
        // wait in case multiple slide layers get activated right after each other - to reduce the amount of updates
        if (await hasNewerUpdate("LISTENER_OUTPUTS", 1)) return

        send(OUTPUT, ["OUTPUTS"], data)
        // used for stage mirror data
        send(OUTPUT, ["ALL_OUTPUTS"], data)

        // REMOTE
        send(REMOTE, ["OUTPUTS"], data)

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
    stageShows.subscribe(async (data) => {
        if (await hasNewerUpdate("LISTENER_STAGE", 50)) return

        send(OUTPUT, ["STAGE"], data)

        // STAGE
        data = arrayToObject(filterObjectArray(data, ["disabled", "name", "settings", "items"]).filter((a: any) => a.disabled === false))
        timedout(STAGE, { channel: "LAYOUT", data }, () =>
            eachConnection(STAGE, "LAYOUT", (connection) => {
                if (!connection.active) return

                const currentData = data[connection.active]
                if (!currentData) return

                if (!currentData.settings.resolution?.width) currentData.settings.resolution = { width: 1920, height: 1080 }
                return currentData
            })
        )
    })

    draw.subscribe((data) => {
        // if (await hasNewerUpdate("LISTENER_DRAW")) return

        const allOutputs = getActiveOutputs(get(outputs), false, false, true)
        const activeOutputs = getActiveOutputs(get(outputs), true, false, true)
        allOutputs.forEach((id) => {
            if (activeOutputs.includes(id)) send(OUTPUT, ["DRAW"], { id, data })
            else send(OUTPUT, ["DRAW"], { id, data: null })
        })
    })
    drawTool.subscribe((data) => {
        // WIP changing tool while output is not active, will not update tool in output if set to active before changing tool again
        const allOutputs = getActiveOutputs(get(outputs), false, false, true)
        const activeOutputs = getActiveOutputs(get(outputs), true, false, true)
        allOutputs.forEach((id) => {
            if (activeOutputs.includes(id)) send(OUTPUT, ["DRAW_TOOL"], { id, data })
            else send(OUTPUT, ["DRAW_TOOL"], { id, data: "focus" })
        })
    })
    drawSettings.subscribe((data) => {
        const allOutputs = getActiveOutputs(get(outputs), false, false, true)
        const activeOutputs = getActiveOutputs(get(outputs), true, false, true)
        allOutputs.forEach((id) => {
            if (activeOutputs.includes(id)) send(OUTPUT, ["DRAW_SETTINGS"], data)
            else {
                send(OUTPUT, ["DRAW_TOOL"], { id, data: "focus" })
                send(OUTPUT, ["DRAW"], { id, data: null })
            }
        })
    })

    transitionData.subscribe((data) => {
        send(OUTPUT, ["TRANSITION"], data)
    })

    // used by stage output
    media.subscribe((data) => {
        send(OUTPUT, ["MEDIA"], data)
        send(REMOTE, ["MEDIA"], data)
    })
    outputSlideCache.subscribe(async (a) => {
        if (await hasNewerUpdate("LISTENER_SLIDE_CACHE", 50)) return

        send(OUTPUT, ["OUT_SLIDE_CACHE"], a)
        send(STAGE, ["OUT_SLIDE_CACHE"], a)
    })

    customMetadata.subscribe((data) => {
        send(OUTPUT, ["CUSTOM_METADATA"], data)
    })
    customMessageCredits.subscribe((data) => {
        send(OUTPUT, ["CUSTOM_CREDITS"], data)
    })

    effects.subscribe(async (data) => {
        if (await hasNewerUpdate("LISTENER_EFFECTS", 50)) return

        send(OUTPUT, ["EFFECTS"], data)
    })

    timers.subscribe((data) => {
        send(OUTPUT, ["TIMERS"], data)

        // STAGE
        send(STAGE, ["TIMERS"], data)

        // REMOTE
        send(REMOTE, ["TIMERS"], data)
    })
    activeTimers.subscribe((data) => {
        send(OUTPUT, ["ACTIVE_TIMERS"], data)

        // REMOTE
        send(REMOTE, ["ACTIVE_TIMERS"], data)
    })
    variables.subscribe((data) => {
        send(OUTPUT, ["VARIABLES"], data)

        // STAGE
        send(STAGE, ["VARIABLES"], data)

        // REMOTE
        send(REMOTE, ["VARIABLES"], data)
    })
    variableTags.subscribe((data) => {
        // REMOTE
        send(REMOTE, ["VARIABLE_TAGS"], data)
    })

    special.subscribe((data) => {
        send(OUTPUT, ["SPECIAL"], data)
    })

    volume.subscribe((data) => {
        send(OUTPUT, ["VOLUME"], data)
        send(REMOTE, ["VOLUME"], data)
    })
    gain.subscribe((data) => {
        send(OUTPUT, ["GAIN"], data)
    })
    audioChannelsData.subscribe((data) => {
        send(OUTPUT, ["AUDIO_CHANNELS_DATA"], data)
        send(REMOTE, ["AUDIO_CHANNELS_DATA"], data)
    })

    equalizerConfig.subscribe((data) => {
        send(OUTPUT, ["EQUALIZER_CONFIG"], data)
    })

    metronome.subscribe((data) => {
        send(OUTPUT, ["METRONOME"], data)
    })
    metronomeTimer.subscribe((data) => {
        send(OUTPUT, ["METRONOME_TIMER"], data)
        // WIP send to stage
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

    // dynamic values
    playingAudio.subscribe(() => {
        const playing = AudioPlayer.getAllPlaying()
        send(OUTPUT, ["PLAYING_AUDIO"], playing)
        send(REMOTE, ["PLAYING_AUDIO"], playing)
    })
    audioData.subscribe((a) => {
        send(OUTPUT, ["AUDIO_DATA"], a)
    })

    colorbars.subscribe((a) => {
        send(OUTPUT, ["COLORBARS"], a)
    })
    livePrepare.subscribe((a) => {
        send(OUTPUT, ["LIVE_PREPARE"], a)
    })

    //

    actions.subscribe((data) => {
        midiInListen()

        // REMOTE
        send(REMOTE, ["ACTIONS"], data)
    })
    actionTags.subscribe((data) => {
        // REMOTE
        send(REMOTE, ["ACTION_TAGS"], data)
    })
    triggers.subscribe((data) => {
        // REMOTE
        send(REMOTE, ["TRIGGERS"], data)
    })
    runningActions.subscribe((data) => {
        // REMOTE
        send(REMOTE, ["RUNNING_ACTIONS"], data)
    })

    activeShow.subscribe((data) => {
        if (!data?.id) return
        const type = data?.type || "show"
        if (type !== "show") return

        // load new show on show change
        loadShows([data.id])

        const show = get(showsCache)[data.id]
        cachedShowsData.update((a) => {
            const customId = getShowCacheId(data.id, show)
            a[customId] = updateCachedShow(data.id, show)
            return a
        })
    })

    groups.subscribe(() => {
        // TODO: only update groups, not all the other values
        updateCachedShows(get(showsCache))
    })

    driveKeys.subscribe(driveConnect)

    refreshSlideThumbnails.subscribe(() => {
        setTimeout(() => {
            refreshSlideThumbnails.set(false)
        })
    })
}

const initalOutputData = {
    LANGUAGE: "language",

    STYLES: "styles",
    TRANSITION: "transitionData",
    SHOWS: "showsCache",

    TEMPLATES: "templates",
    OVERLAYS: "overlays",
    EVENTS: "events",

    DRAW: { data: "draw" },
    DRAW_TOOL: { data: "drawTool" },
    DRAW_SETTINGS: "drawSettings",

    VISUALIZER_DATA: "visualizerData",
    MEDIA: "media",
    EFFECTS: "effects",
    TIMERS: "timers",
    VARIABLES: "variables",
    TIME_FORMAT: "timeFormat",

    SPECIAL: "special",

    PLAYER_VIDEOS: "playerVideos",
    STAGE: "stageShows",

    // for dynamic values
    PROJECTS: "projects",
    ACTIVE_PROJECT: "activeProject",
    SHOWS_DATA: "shows",
    CUSTOM_METADATA: "customMetadata",
    CUSTOM_CREDITS: "customMessageCredits",

    // received by Output
    VOLUME: "volume",
    AUDIO_CHANNELS_DATA: "audioChannelsData"
}

export function sendInitialOutputData() {
    Object.keys(initalOutputData).forEach((KEY) => {
        const storeKey = initalOutputData[KEY]

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
