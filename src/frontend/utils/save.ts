import { get } from "svelte/store"
import { MAIN, STORE } from "../../types/Channels"
import { clone } from "../components/helpers/array"
import {
    activeProject,
    alertUpdates,
    audioFolders,
    autoOutput,
    autosave,
    calendarAddShow,
    categories,
    customizedIcons,
    defaultProjectName,
    deletedShows,
    deviceId,
    disabledServers,
    drawSettings,
    drawer,
    drawerTabsData,
    driveData,
    driveKeys,
    events,
    exportPath,
    folders,
    formatNewShow,
    fullColors,
    gain,
    groupNumbers,
    groups,
    imageExtensions,
    labelsDisabled,
    language,
    lockedOverlays,
    maxConnections,
    media,
    mediaCache,
    mediaFolders,
    mediaOptions,
    midiIn,
    openedFolders,
    os,
    outLocked,
    outputs,
    overlayCategories,
    overlays,
    playerVideos,
    ports,
    presenterControllerKeys,
    projects,
    recordingPath,
    redoHistory,
    remotePassword,
    renamedShows,
    resized,
    saved,
    scripturePath,
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
    variables,
    videoExtensions,
    videoMarkers,
    volume,
    webFavorites,
} from "../stores"
import type { SaveListSettings, SaveListSyncedSettings } from "./../../types/Save"
import { syncDrive } from "./drive"
import { newToast } from "./messages"

export function save(closeWhenFinished: boolean = false, backup: boolean = false) {
    console.log("SAVING...")

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
        defaultProjectName: get(defaultProjectName),
        // events: get(events),
        showsPath: get(showsPath),
        exportPath: get(exportPath),
        scripturePath: get(scripturePath),
        recordingPath: get(recordingPath),
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
        os: get(os),
        outLocked: get(outLocked),
        outputs: get(outputs),
        sorted: get(sorted),
        styles: get(styles),
        presenterControllerKeys: get(presenterControllerKeys),
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
        webFavorites: get(webFavorites),
        volume: get(volume),
        gain: get(gain),
        driveData: get(driveData),
        calendarAddShow: get(calendarAddShow),
        special: get(special),
        deviceId: get(deviceId),
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
        midiIn: get(midiIn),
        videoMarkers: get(videoMarkers),
        customizedIcons: get(customizedIcons),
    }

    let allSavedData: any = {
        path: get(showsPath),
        scripturePath: get(scripturePath),
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
        CACHE: { media: get(mediaCache), text: get(textCache) },
        HISTORY: { undo: get(undoHistory), redo: get(redoHistory) },
    }

    allSavedData.closeWhenFinished = closeWhenFinished
    allSavedData.backup = backup
    window.api.send(STORE, { channel: "SAVE", data: allSavedData })
}

export function saveComplete({ closeWhenFinished, backup }) {
    saved.set(true)
    newToast("$toast.saved")

    if (backup) return

    let mainFolderId = get(driveData)?.mainFolderId
    if (!mainFolderId) {
        if (closeWhenFinished) closeApp()

        return
    }

    syncDrive(false, closeWhenFinished)
}

export function closeApp() {
    window.api.send(MAIN, { channel: "CLOSE" })
}
