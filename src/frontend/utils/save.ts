import { get } from "svelte/store"
import { STORE } from "../../types/Channels"
import { clone } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import {
    activeProject,
    alertUpdates,
    audioFolders,
    autoOutput,
    categories,
    defaultProjectName,
    drawer,
    drawerTabsData,
    drawSettings,
    events,
    exportPath,
    folders,
    formatNewShow,
    fullColors,
    groupNumbers,
    groups,
    imageExtensions,
    labelsDisabled,
    language,
    lastSavedCache,
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
    redoHistory,
    remotePassword,
    resized,
    saved,
    scriptures,
    scripturesCache,
    scriptureSettings,
    shows,
    showsCache,
    showsPath,
    slidesOptions,
    splitLines,
    stageShows,
    templateCategories,
    templates,
    textCache,
    theme,
    themes,
    timeFormat,
    timers,
    transitionData,
    undoHistory,
    videoExtensions,
    volume,
    webFavorites,
} from "../stores"
import type { SaveListSettings } from "./../../types/Save"

export function save() {
    console.log("SAVING...")

    let settings: { [key in SaveListSettings]: any } = {
        initialized: true,
        activeProject: get(activeProject),
        alertUpdates: get(alertUpdates),
        audioFolders: get(audioFolders),
        autoOutput: get(autoOutput),
        maxConnections: get(maxConnections),
        ports: get(ports),
        categories: get(categories),
        timeFormat: get(timeFormat),
        defaultProjectName: get(defaultProjectName),
        // events: get(events),
        showsPath: get(showsPath),
        exportPath: get(exportPath),
        drawer: get(drawer),
        drawerTabsData: get(drawerTabsData),
        drawSettings: get(drawSettings),
        groupNumbers: get(groupNumbers),
        fullColors: get(fullColors),
        formatNewShow: get(formatNewShow),
        groups: get(groups),
        imageExtensions: get(imageExtensions),
        labelsDisabled: get(labelsDisabled),
        language: get(language),
        mediaFolders: get(mediaFolders),
        mediaOptions: get(mediaOptions),
        openedFolders: get(openedFolders),
        os: get(os),
        outLocked: get(outLocked),
        outputs: get(outputs),
        overlayCategories: get(overlayCategories),
        presenterControllerKeys: get(presenterControllerKeys),
        playerVideos: get(playerVideos),
        remotePassword: get(remotePassword),
        resized: get(resized),
        scriptures: get(scriptures),
        scriptureSettings: get(scriptureSettings),
        slidesOptions: get(slidesOptions),
        splitLines: get(splitLines),
        templateCategories: get(templateCategories),
        // templates: get(templates),
        timers: get(timers),
        theme: get(theme),
        transitionData: get(transitionData),
        // themes: get(themes),
        videoExtensions: get(videoExtensions),
        webFavorites: get(webFavorites),
        volume: get(volume),
        midiIn: get(midiIn),
    }
    // save settings & shows
    // , shows: get(shows)

    let allSavedData: any = {
        path: get(showsPath),
        // SETTINGS
        SETTINGS: settings,
        // STORES
        SHOWS: get(shows),
        STAGE_SHOWS: get(stageShows),
        PROJECTS: { projects: get(projects), folders: get(folders) },
        OVERLAYS: get(overlays),
        TEMPLATES: get(templates),
        EVENTS: get(events),
        MEDIA: get(media),
        THEMES: get(themes),
        // CACHES SAVED TO MULTIPLE FILES
        showsCache: get(showsCache),
        scripturesCache: get(scripturesCache),
    }

    // TODO: fix undefined when saving HISTORY... (maybe file is undefined?)

    // SAVE STATE
    let savedAt: number = Date.now()
    // only save if it's not the same as last save
    if (JSON.stringify(allSavedData) !== get(lastSavedCache)) {
        lastSavedCache.set(JSON.stringify(allSavedData))
        history({ id: "SAVE", newData: { id: savedAt } })
        // store saved data to it's own files
        allSavedData.savedCache = { name: savedAt, data: clone(allSavedData) }
    }

    // CACHES
    allSavedData = {
        ...allSavedData,
        CACHE: { media: get(mediaCache), text: get(textCache) },
        HISTORY: { undo: get(undoHistory), redo: get(redoHistory) },
    }

    window.api.send(STORE, { channel: "SAVE", data: allSavedData })

    saved.set(true)
}
