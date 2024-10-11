import { get } from "svelte/store"
import { MAIN, STORE } from "../../types/Channels"
import { clone, keysToID, removeDeleted } from "../components/helpers/array"
import {
    activePopup,
    activeProject,
    alertUpdates,
    audioFolders,
    audioPlaylists,
    autoOutput,
    autosave,
    bibleApiKey,
    calendarAddShow,
    categories,
    customizedIcons,
    dataPath,
    deletedShows,
    disabledServers,
    drawSettings,
    drawer,
    drawerTabsData,
    driveData,
    driveKeys,
    errorHasOccured,
    events,
    folders,
    formatNewShow,
    fullColors,
    gain,
    globalTags,
    groupNumbers,
    groups,
    imageExtensions,
    labelsDisabled,
    language,
    lockedOverlays,
    maxConnections,
    media,
    mediaFolders,
    mediaOptions,
    metronome,
    midiIn,
    openedFolders,
    outLocked,
    outputs,
    overlayCategories,
    overlays,
    playerVideos,
    ports,
    projects,
    redoHistory,
    remotePassword,
    renamedShows,
    resized,
    saved,
    scriptureSettings,
    scriptures,
    scripturesCache,
    serverData,
    shows,
    showsCache,
    showsPath,
    slidesOptions,
    sorted,
    special,
    splitLines,
    stageShows,
    styles,
    templateCategories,
    templates,
    textCache,
    theme,
    themes,
    timeFormat,
    timers,
    transitionData,
    triggers,
    undoHistory,
    usageLog,
    variables,
    videoExtensions,
    videoMarkers,
    volume,
} from "../stores"
import type { SaveList, SaveListSettings, SaveListSyncedSettings } from "./../../types/Save"
import { audioStreams, companion } from "./../stores"
import { newToast } from "./common"
import { syncDrive } from "./drive"
import { customActionActivation } from "../components/actions/actions"
import { send } from "./request"

export function save(closeWhenFinished: boolean = false, customTriggers: { backup?: boolean; silent?: boolean; changeUserData?: any } = {}) {
    console.log("SAVING...")
    if (!customTriggers.backup) {
        newToast("$toast.saving")
        customActionActivation("save")
    }

    let settings: { [key in SaveListSettings]: any } = {
        initialized: true,
        activeProject: get(activeProject),
        alertUpdates: get(alertUpdates),
        audioFolders: get(audioFolders),
        autoOutput: get(autoOutput),
        maxConnections: get(maxConnections),
        ports: get(ports),
        disabledServers: get(disabledServers),
        serverData: get(serverData),
        autosave: get(autosave),
        timeFormat: get(timeFormat),
        // events: get(events),
        showsPath: get(showsPath),
        dataPath: get(dataPath),
        lockedOverlays: get(lockedOverlays),
        drawer: get(drawer),
        drawerTabsData: get(drawerTabsData),
        groupNumbers: get(groupNumbers),
        fullColors: get(fullColors),
        formatNewShow: get(formatNewShow),
        imageExtensions: get(imageExtensions),
        labelsDisabled: get(labelsDisabled),
        language: get(language),
        mediaFolders: get(mediaFolders),
        mediaOptions: get(mediaOptions),
        openedFolders: get(openedFolders),
        outLocked: get(outLocked),
        outputs: get(outputs),
        sorted: get(sorted),
        styles: get(styles),
        playerVideos: get(playerVideos),
        remotePassword: get(remotePassword),
        resized: get(resized),
        slidesOptions: get(slidesOptions),
        splitLines: get(splitLines),
        // templates: get(templates),
        theme: get(theme),
        transitionData: get(transitionData),
        // themes: get(themes),
        videoExtensions: get(videoExtensions),
        volume: get(volume),
        gain: get(gain),
        driveData: get(driveData),
        calendarAddShow: get(calendarAddShow),
        metronome: get(metronome),
        bibleApiKey: get(bibleApiKey),
        special: get(special),
    }

    // settings exclusive to the local mashine (path names that shouldn't be synced with cloud)
    let syncedSettings: { [key in SaveListSyncedSettings]: any } = {
        categories: get(categories),
        drawSettings: get(drawSettings),
        groups: get(groups),
        overlayCategories: get(overlayCategories),
        scriptures: get(scriptures),
        scriptureSettings: get(scriptureSettings),
        templateCategories: get(templateCategories),
        timers: get(timers),
        variables: get(variables),
        triggers: get(triggers),
        audioStreams: get(audioStreams),
        audioPlaylists: get(audioPlaylists),
        midiIn: get(midiIn),
        videoMarkers: get(videoMarkers),
        customizedIcons: get(customizedIcons),
        companion: get(companion),
        globalTags: get(globalTags),
    }

    let allSavedData: any = {
        path: get(showsPath),
        dataPath: get(dataPath),
        // SETTINGS
        SETTINGS: settings,
        SYNCED_SETTINGS: syncedSettings,
        // SHOWS
        SHOWS: get(shows),
        STAGE_SHOWS: get(stageShows),
        // STORES
        PROJECTS: { projects: get(projects), folders: get(folders) },
        OVERLAYS: get(overlays),
        TEMPLATES: get(templates),
        EVENTS: get(events),
        MEDIA: get(media),
        THEMES: get(themes),
        DRIVE_API_KEY: get(driveKeys),
        // CACHES SAVED TO MULTIPLE FILES
        showsCache: clone(get(showsCache)),
        scripturesCache: clone(get(scripturesCache)),
        deletedShows: clone(get(deletedShows)),
        renamedShows: clone(get(renamedShows)),
    }

    deletedShows.set([])
    renamedShows.set([])

    // CACHES
    allSavedData = {
        ...allSavedData,
        CACHE: { text: get(textCache) },
        HISTORY: { undo: get(undoHistory), redo: get(redoHistory) },
        USAGE: get(usageLog),
    }

    allSavedData.closeWhenFinished = closeWhenFinished
    allSavedData.customTriggers = customTriggers

    if (customTriggers.backup) newToast("$settings.backup_started")
    send(STORE, ["SAVE"], allSavedData)
}

export function saveComplete({ closeWhenFinished, customTriggers }: any) {
    if (!closeWhenFinished) {
        saved.set(true)
        console.log("SAVED!")

        if (!customTriggers?.backup) newToast("$toast.saved")
    }

    if (customTriggers?.backup || customTriggers?.changeUserData) return

    let mainFolderId = get(driveData)?.mainFolderId
    if (!mainFolderId || get(driveData)?.disabled === true) {
        if (closeWhenFinished) closeApp()

        return
    }

    syncDrive(false, closeWhenFinished)
}

export function initializeClosing() {
    if (get(special).showClosePopup || get(errorHasOccured)) activePopup.set("unsaved")
    // "saved" does not count for all minor changes, but should be fine
    else if (get(saved)) saveComplete({ closeWhenFinished: true })
    else save(true)
}

export function closeApp() {
    window.api.send(MAIN, { channel: "CLOSE" })
}

// GET SAVED STATE

let initialized: boolean = false
export function unsavedUpdater() {
    let cachedValues: any = {}
    let s = { ...saveList, folders, projects, showsCache, stageShows }

    Object.keys(s).forEach((id) => {
        if (!s[id]) return

        s[id].subscribe((a: any) => {
            if (customSavedListener[id] && a) {
                a = customSavedListener[id](clone(a))
                let stringObj = JSON.stringify(a)
                if (cachedValues[id] === stringObj) return

                cachedValues[id] = stringObj
            }

            if (initialized) saved.set(false)
        })

        // set cached custom listener on load
        let store = get(s[id])
        if (customSavedListener[id] && store) {
            store = customSavedListener[id](clone(store))
            cachedValues[id] = JSON.stringify(store)
        }
    })

    initialized = true
}

const customSavedListener = {
    showsCache: (data: any) => {
        Object.keys(data).forEach((id) => {
            if (!data[id]?.slides) return

            delete data[id].timestamps
            delete data[id].settings

            Object.values(data[id].slides).forEach((slide: any) => {
                delete slide.id
            })
        })

        return data
    },
    projects: (data: any) => {
        removeDeleted(keysToID(data)).forEach((a) => {
            data[a.id].shows.map((show) => {
                delete show.layout
            })
        })

        return data
    },
}

const saveList: { [key in SaveList]: any } = {
    initialized: null,
    activeProject: null,
    alertUpdates: alertUpdates,
    audioFolders: audioFolders,
    autoOutput: autoOutput,
    categories: categories,
    autosave: autosave,
    timeFormat: timeFormat,
    maxConnections: maxConnections,
    ports: ports,
    disabledServers: disabledServers,
    serverData: serverData,
    events: events,
    showsPath: showsPath,
    dataPath: dataPath,
    lockedOverlays: null,
    drawer: null,
    drawerTabsData: null,
    drawSettings: drawSettings,
    groupNumbers: groupNumbers,
    fullColors: fullColors,
    formatNewShow: formatNewShow,
    groups: groups,
    imageExtensions: imageExtensions,
    labelsDisabled: labelsDisabled,
    language: language,
    mediaFolders: mediaFolders,
    mediaOptions: mediaOptions,
    openedFolders: null,
    outLocked: null,
    outputs: null,
    sorted: null,
    styles: styles,
    overlayCategories: overlayCategories,
    overlays: overlays,
    playerVideos: playerVideos,
    remotePassword: remotePassword,
    resized: null,
    scriptures: scriptures,
    scriptureSettings: scriptureSettings,
    slidesOptions: slidesOptions,
    splitLines: splitLines,
    templateCategories: templateCategories,
    templates: templates,
    timers: timers,
    variables: variables,
    triggers: triggers,
    audioStreams: audioStreams,
    audioPlaylists: audioPlaylists,
    theme: theme,
    themes: themes,
    transitionData: transitionData,
    videoExtensions: null,
    volume: null,
    gain: null,
    midiIn: midiIn,
    videoMarkers: videoMarkers,
    customizedIcons: customizedIcons,
    driveKeys: driveKeys,
    driveData: driveData,
    calendarAddShow: null,
    metronome: null,
    bibleApiKey: null,
    special: special,
    companion: null,
    globalTags: globalTags,
}
