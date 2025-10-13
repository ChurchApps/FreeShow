import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import type { Projects } from "../../types/Projects"
import type { Shows } from "../../types/Show"
import { customActionActivation } from "../components/actions/actions"
import { clone, keysToID, removeDeleted } from "../components/helpers/array"
import { sendMain } from "../IPC/main"
import {
    actionTags,
    actions,
    activePopup,
    activeProject,
    alertUpdates,
    audioFolders,
    audioPlaylists,
    autoOutput,
    autosave,
    calendarAddShow,
    categories,
    contentProviderData,
    customMetadata,
    customizedIcons,
    dataPath,
    deletedShows,
    disabledServers,
    drawSettings,
    drawer,
    drawerTabsData,
    driveData,
    driveKeys,
    effects,
    effectsLibrary,
    emitters,
    errorHasOccurred,
    events,
    folders,
    formatNewShow,
    fullColors,
    gain,
    globalTags,
    groupNumbers,
    groups,
    labelsDisabled,
    language,
    lockedOverlays,
    maxConnections,
    media,
    mediaFolders,
    mediaOptions,
    mediaTags,
    metronome,
    openedFolders,
    outLocked,
    outputs,
    overlayCategories,
    overlays,
    playerVideos,
    ports,
    profiles,
    projectTemplates,
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
    variableTags,
    variables,
    videoMarkers,
    volume
} from "../stores"
import type { SaveActions, SaveData, SaveList, SaveListSettings, SaveListSyncedSettings } from "./../../types/Save"
import { audioStreams, companion } from "./../stores"
import { newToast } from "./common"
import { syncDrive } from "./drive"

export function save(closeWhenFinished = false, customTriggers: SaveActions = {}) {
    console.info("SAVING...")
    if ((!customTriggers.autosave || !get(saved)) && !customTriggers.backup) {
        newToast("toast.saving")
        customActionActivation("save")
    }

    const settings: { [key in SaveListSettings]: any } = {
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
        labelsDisabled: get(labelsDisabled),
        language: get(language),
        mediaFolders: get(mediaFolders),
        mediaOptions: get(mediaOptions),
        openedFolders: get(openedFolders),
        outLocked: get(outLocked),
        outputs: get(outputs),
        sorted: get(sorted),
        remotePassword: get(remotePassword),
        resized: get(resized),
        slidesOptions: get(slidesOptions),
        splitLines: get(splitLines),
        // templates: get(templates),
        theme: get(theme),
        transitionData: get(transitionData),
        // themes: get(themes),
        volume: get(volume),
        gain: get(gain),
        driveData: get(driveData),
        calendarAddShow: get(calendarAddShow),
        metronome: get(metronome),
        effectsLibrary: get(effectsLibrary),
        special: get(special),
        contentProviderData: get(contentProviderData),
    }

    // settings exclusive to the local machine (path names that shouldn't be synced with cloud)
    const syncedSettings: { [key in SaveListSyncedSettings]: any } = {
        categories: get(categories),
        drawSettings: get(drawSettings),
        groups: get(groups),
        overlayCategories: get(overlayCategories),
        scriptures: get(scriptures),
        scriptureSettings: get(scriptureSettings),
        templateCategories: get(templateCategories),
        styles: get(styles),
        profiles: get(profiles),
        timers: get(timers),
        variables: get(variables),
        triggers: get(triggers),
        audioStreams: get(audioStreams),
        audioPlaylists: get(audioPlaylists),
        midiIn: get(actions),
        emitters: get(emitters),
        playerVideos: get(playerVideos),
        videoMarkers: get(videoMarkers),
        mediaTags: get(mediaTags),
        actionTags: get(actionTags),
        variableTags: get(variableTags),
        customizedIcons: get(customizedIcons),
        companion: get(companion),
        globalTags: get(globalTags),
        customMetadata: get(customMetadata),
        effects: get(effects)
    }

    const allSavedData: SaveData = {
        path: get(showsPath) || "",
        dataPath: get(dataPath),
        // SETTINGS
        SETTINGS: settings,
        SYNCED_SETTINGS: syncedSettings,
        // SHOWS
        SHOWS: get(shows),
        STAGE_SHOWS: get(stageShows),
        // STORES
        PROJECTS: { projects: get(projects), folders: get(folders), projectTemplates: get(projectTemplates) },
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
        // CACHES
        CACHE: { text: get(textCache) },
        HISTORY: { undo: get(undoHistory), redo: get(redoHistory) },
        USAGE: get(usageLog),
        // SAVE INFO DATA
        closeWhenFinished,
        customTriggers
    }

    deletedShows.set([])
    renamedShows.set([])

    if (customTriggers.backup) newToast("settings.backup_started")
    // trigger toast before saving
    setTimeout(() => sendMain(Main.SAVE, allSavedData))
}

export function saveComplete({ closeWhenFinished, customTriggers }: { closeWhenFinished: boolean; customTriggers?: SaveActions }) {
    if (!closeWhenFinished) {
        if ((!customTriggers?.autosave || !get(saved)) && !customTriggers?.backup) newToast("toast.saved")

        saved.set(true)
        console.info("SAVED!")
    }

    if (customTriggers?.backup || customTriggers?.changeUserData) return

    const mainFolderId = get(driveData)?.mainFolderId
    if (!mainFolderId || get(driveData)?.disabled === true || !Object.keys(get(driveKeys)).length) {
        if (closeWhenFinished) closeApp()

        return
    }

    syncDrive(false, closeWhenFinished)
}

export function initializeClosing(skipPopup = false) {
    // don't save automatically if an error has happened in case it breaks something
    if (!skipPopup && (get(special).showClosePopup || get(errorHasOccurred))) activePopup.set("unsaved")
    // "saved" does not count for all minor changes, but should be fine
    else if (get(saved)) saveComplete({ closeWhenFinished: true })
    else save(true)
}

export function closeApp() {
    sendMain(Main.CLOSE)
}

// GET SAVED STATE

export function unsavedUpdater() {
    const cachedValues: { [key: string]: string } = {}
    const s = { ...saveList, folders, projects, showsCache, stageShows, deletedShows, renamedShows }

    let initialized = false
    Object.keys(s).forEach((id) => {
        if (!s[id]) return

        s[id].subscribe((a: any) => {
            if (customSavedListener[id] && a) {
                a = customSavedListener[id](clone(a))
                const stringObj = JSON.stringify(a)
                if (cachedValues[id] === stringObj) return

                cachedValues[id] = stringObj
            }

            if (!initialized) return

            saved.set(false)
            if (id === "deletedShows" || id === "renamedShows") {
                setTimeout(() => saved.set(false))
            }
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
    showsCache: (data: Shows) => {
        Object.keys(data).forEach((id) => {
            if (!data[id]?.slides) return

            delete (data[id] as any).timestamps
            delete (data[id] as any).settings

            Object.values(data[id].slides).forEach((slide) => {
                delete slide.id
            })
        })

        return data
    },
    projects: (data: Projects) => {
        removeDeleted(keysToID(data)).forEach((a) => {
            data[a.id].shows.map((show) => {
                delete show.layout
            })
        })

        return data
    }
}

const saveList: { [key in SaveList]: any } = {
    initialized: null,
    activeProject: null,
    alertUpdates,
    audioFolders,
    autoOutput,
    categories,
    autosave,
    timeFormat,
    maxConnections,
    ports,
    disabledServers,
    serverData,
    events,
    showsPath,
    dataPath,
    lockedOverlays: null,
    drawer: null,
    drawerTabsData: null,
    drawSettings,
    groupNumbers,
    fullColors,
    formatNewShow,
    groups,
    labelsDisabled,
    language,
    mediaFolders,
    mediaOptions,
    openedFolders: null,
    outLocked: null,
    outputs: null,
    sorted: null,
    styles,
    profiles,
    overlayCategories,
    overlays,
    playerVideos,
    remotePassword,
    resized: null,
    scriptures,
    scriptureSettings,
    slidesOptions,
    splitLines,
    templateCategories,
    templates,
    timers,
    variables,
    triggers,
    audioStreams,
    audioPlaylists,
    theme,
    themes,
    transitionData,
    volume: null,
    gain: null,
    midiIn: actions,
    emitters,
    videoMarkers,
    mediaTags,
    actionTags,
    variableTags,
    customizedIcons,
    driveKeys,
    driveData,
    calendarAddShow: null,
    metronome: null,
    effectsLibrary: null,
    special,
    companion: null,
    globalTags,
    customMetadata: null,
    contentProviderData,
    effects
}
