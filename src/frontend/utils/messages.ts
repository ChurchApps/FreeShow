import { get } from "svelte/store"
import { CLOUD, CONTROLLER, OPEN_FILE, OUTPUT_STREAM, REMOTE, STAGE } from "../../types/Channels"
import type { SaveList } from "../../types/Save"
import type { ClientMessage } from "../../types/Socket"
import { clone, removeDuplicates } from "../components/helpers/array"
import { loadShows } from "../components/helpers/setShow"
import {
    activePopup,
    activeShow,
    audioFolders,
    audioStreams,
    autosave,
    categories,
    customizedIcons,
    dataPath,
    disabledServers,
    drawSettings,
    driveData,
    driveKeys,
    events,
    folders,
    formatNewShow,
    fullColors,
    groupNumbers,
    groups,
    imageExtensions,
    labelsDisabled,
    language,
    mediaFolders,
    mediaOptions,
    midiIn,
    overlayCategories,
    overlays,
    playerVideos,
    popupData,
    projects,
    remotePassword,
    saved,
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
    let cachedValues: any = {}
    let s = { ...saveList, folders, projects, showsCache, stageShows }
    setTimeout(() => {
        Object.keys(s).forEach((id) => {
            if (!s[id]) return

            s[id].subscribe((a: any) => {
                if (customSavedListener[id] && a) {
                    a = customSavedListener[id](clone(a))
                    let stringObj = JSON.stringify(a)
                    if (cachedValues[id] === stringObj) return

                    cachedValues[id] = stringObj
                }

                saved.set(false)
            })

            // set cached custom listener on load
            let store = get(s[id])
            if (customSavedListener[id] && store) {
                store = customSavedListener[id](clone(store))
                cachedValues[id] = JSON.stringify(store)
            }
        })

        saved.set(true)
    }, 5000)
}

const customSavedListener = {
    showsCache: (data: any) => {
        Object.keys(data).forEach((id) => {
            delete data[id].timestamps
            delete data[id].settings

            Object.values(data[id].slides).forEach((slide: any) => {
                delete slide.id
            })
        })

        return data
    },
    projects: (data: any) => {
        Object.keys(data).forEach((id) => {
            data[id].shows.map((show) => {
                delete show.layout
            })
        })

        return data
    },
}

export function newToast(msg: string) {
    if (!msg) return
    toastMessages.set(removeDuplicates([...get(toastMessages), msg]))
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

            syncDrive(true)
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
            // you could choose previously, but I don't see a reason anymore as I have implemented "newest file always"
            // if (existingData) {
            //     // WIP this will show over "initialize" popup
            //     activePopup.set("cloud_method")
            //     return
            // }

            driveData.update((a) => {
                a.initializeMethod = existingData ? "done" : "upload"
                return a
            })
        }

        syncDrive(true)
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

        if (get(autosave) === "never") {
            popupData.set(changes)
            activePopup.set("cloud_update")
            return
        }

        newToast("$cloud.sync_complete")
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
    os: null,
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
    theme: theme,
    themes: themes,
    transitionData: transitionData,
    videoExtensions: videoExtensions,
    volume: null,
    gain: null,
    midiIn: midiIn,
    videoMarkers: videoMarkers,
    customizedIcons: customizedIcons,
    driveKeys: driveKeys,
    driveData: driveData,
    calendarAddShow: null,
    special: null,
    companion: null,
}
