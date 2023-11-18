import { get } from "svelte/store"
import { CLOUD, CONTROLLER, OPEN_FILE, OUTPUT_STREAM, REMOTE, STAGE } from "../../types/Channels"
import type { SaveList } from "../../types/Save"
import type { ClientMessage } from "../../types/Socket"
import { loadShows } from "../components/helpers/setShow"
import {
    activePopup,
    activeShow,
    audioFolders,
    autosave,
    calendarAddShow,
    categories,
    customizedIcons,
    defaultProjectName,
    deviceId,
    disabledServers,
    drawSettings,
    driveData,
    driveKeys,
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
    lockedOverlays,
    mediaFolders,
    mediaOptions,
    midiIn,
    os,
    overlayCategories,
    overlays,
    playerVideos,
    popupData,
    presenterControllerKeys,
    projects,
    recordingPath,
    remotePassword,
    saved,
    scripturePath,
    serverData,
    showsCache,
    showsPath,
    slidesOptions,
    stageShows,
    styles,
    templateCategories,
    templates,
    theme,
    themes,
    timeFormat,
    timers,
    toastMessages,
    triggers,
    variables,
    videoExtensions,
    videoMarkers,
    webFavorites,
} from "../stores"
import { alertUpdates, autoOutput, maxConnections, ports, scriptureSettings, scriptures, splitLines, transitionData } from "./../stores"
import { syncDrive, validateKeys } from "./drive"
import { send } from "./request"
import { closeApp } from "./save"
import { client } from "./sendData"
import { stageListen } from "./stageTalk"

export function listen() {
    // FROM CLIENT (EXPRESS SERVERS)
    window.api.receive(REMOTE, (msg: ClientMessage) => client(REMOTE, msg))
    window.api.receive(STAGE, (msg: ClientMessage) => client(STAGE, msg))
    window.api.receive(CONTROLLER, (msg: ClientMessage) => client(CONTROLLER, msg))
    window.api.receive(OUTPUT_STREAM, (msg: ClientMessage) => client(OUTPUT_STREAM, msg))

    window.api.receive(OPEN_FILE, (msg: ClientMessage) => {
        if (fileSelected[msg.channel]) fileSelected[msg.channel](msg.data)
    })

    window.api.receive(CLOUD, (msg: ClientMessage) => {
        if (cloudHelpers[msg.channel]) cloudHelpers[msg.channel](msg.data)
    })

    // TO STAGE
    stageListen()

    // load new show on show change
    activeShow.subscribe((a) => {
        if (a && (a.type === undefined || a.type === "show")) loadShows([a.id])
    })

    // SAVE
    // TODO: better saved check!
    let s = { ...saveList, folders: folders, overlays: overlays, projects: projects, showsCache: showsCache, stageShows: stageShows }
    setTimeout(() => {
        Object.values(s).forEach((a) => {
            if (a) a.subscribe(() => saved.set(false))
        })
        saved.set(true)
    }, 5000)
}

export function newToast(msg: string) {
    if (!msg) return
    toastMessages.set([...new Set([...get(toastMessages), msg])])
}

const fileSelected = {
    GOOGLE_KEYS: ({ files, content }) => {
        let path = files[0]
        let file = content[path]
        if (file) validateKeys(file)
    },
}

const cloudHelpers = {
    DRIVE_CONNECT: ({ status, error }: any) => {
        if (error) {
            newToast(error)
            return
        }
        if (status !== "connected") return

        // WIP set connected status, and see in settings

        if (get(driveData)?.mainFolderId) {
            driveData.update((a) => {
                a.initializeMethod = "done"
                return a
            })

            syncDrive()
            return
        }

        send(CLOUD, ["GET_MAIN_FOLDER"], { method: get(driveData).initializeMethod })
    },
    GET_MAIN_FOLDER: ({ id, error, existingData }: any) => {
        if (error) {
            newToast(error)
            return
        }
        if (!id) return

        driveData.update((a) => {
            a.mainFolderId = id
            return a
        })

        let method = get(driveData).initializeMethod
        if (get(driveData).disableUpload) method = "download"
        if (!method) {
            if (existingData) {
                activePopup.set("cloud_method")
                return
            }

            driveData.update((a) => {
                a.initializeMethod = "upload"
                return a
            })
        }

        syncDrive()
    },
    SYNC_DATA: ({ changes, closeWhenFinished }) => {
        if (closeWhenFinished) {
            closeApp()
            return
        }

        if (changes.error) {
            newToast(changes.error)
            return
        }

        driveData.update((a) => {
            a.initializeMethod = "done"
            return a
        })

        if (!changes.length) {
            if (get(activePopup) !== "cloud_update") return

            popupData.set({})
            activePopup.set(null)

            return
        }

        // reload shows cache (because there could be some changes)
        showsCache.set({})
        activeShow.set(null)

        popupData.set(changes)
        activePopup.set("cloud_update")
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
    defaultProjectName: defaultProjectName,
    events: events,
    showsPath: showsPath,
    exportPath: exportPath,
    scripturePath: scripturePath,
    recordingPath: recordingPath,
    lockedOverlays: lockedOverlays,
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
    os: os,
    outLocked: null,
    outputs: null,
    sorted: null,
    styles: styles,
    overlayCategories: overlayCategories,
    presenterControllerKeys: presenterControllerKeys,
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
    theme: theme,
    themes: themes,
    transitionData: transitionData,
    videoExtensions: videoExtensions,
    webFavorites: webFavorites,
    volume: null,
    gain: null,
    midiIn: midiIn,
    videoMarkers: videoMarkers,
    customizedIcons: customizedIcons,
    driveKeys: driveKeys,
    driveData: driveData,
    calendarAddShow: calendarAddShow,
    special: null,
    deviceId: deviceId,
}
