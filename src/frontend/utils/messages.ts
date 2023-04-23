import { get } from "svelte/store"
import { CLOUD, CONTROLLER, OPEN_FILE, OUTPUT, REMOTE, STAGE } from "../../types/Channels"
import type { SaveList } from "../../types/Save"
import type { ClientMessage } from "../../types/Socket"
import {
    audioFolders,
    categories,
    defaultProjectName,
    drawSettings,
    driveConnected,
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
    mediaFolders,
    mediaOptions,
    midiIn,
    os,
    overlayCategories,
    overlays,
    playerVideos,
    presenterControllerKeys,
    projects,
    remotePassword,
    saved,
    showsCache,
    showsPath,
    slidesOptions,
    stageShows,
    templateCategories,
    templates,
    theme,
    themes,
    timeFormat,
    timers,
    videoExtensions,
    webFavorites,
} from "../stores"
import { alertUpdates, autoOutput, maxConnections, ports, scriptureSettings, scriptures, splitLines, transitionData, volume } from "./../stores"
import { validateKeys } from "./drive"
import { send } from "./request"
import { client } from "./sendData"
import { stageListen } from "./stageTalk"

export function listen() {
    // FROM CLIENT (EXPRESS SERVERS)
    window.api.receive(REMOTE, (msg: ClientMessage) => client(REMOTE, msg))
    window.api.receive(STAGE, (msg: ClientMessage) => client(STAGE, msg))
    window.api.receive(CONTROLLER, (msg: ClientMessage) => client(CONTROLLER, msg))

    window.api.receive(OPEN_FILE, (msg: ClientMessage) => {
        if (fileSelected[msg.channel]) fileSelected[msg.channel](msg.data)
    })

    window.api.receive(CLOUD, (msg: ClientMessage) => {
        if (cloudHelpers[msg.channel]) cloudHelpers[msg.channel](msg.data)
    })

    // TO STAGE
    stageListen()

    // SAVE
    // TODO: better saving!
    let s = { ...saveList, folders: folders, overlays: overlays, projects: projects, showsCache: showsCache, stageShows: stageShows }
    setTimeout(() => {
        Object.values(s).forEach((a) => {
            if (a) a.subscribe(() => saved.set(false))
        })
        saved.set(true)
    }, 5000)
}

export function sendInitialOutputData() {
    send(OUTPUT, ["SHOWS"], get(showsCache))
    send(OUTPUT, ["TRANSITION"], get(transitionData))
    send(OUTPUT, ["MEDIA"], get(mediaFolders))
    send(OUTPUT, ["PLAYER_VIDEOS"], get(playerVideos))
    send(OUTPUT, ["VOLUME"], get(volume))
    send(OUTPUT, ["TEMPLATES"], get(templates))
    send(OUTPUT, ["OVERLAYS"], get(overlays))
}

const fileSelected = {
    GOOGLE_KEYS: ({ files, content }) => {
        let path = files[0]
        let file = content[path]
        if (file) validateKeys(file)
    },
}

const cloudHelpers = {
    DRIVE_CONNECT: ({ status }: any) => {
        if (status !== "connected") return

        driveConnected.set(true)

        if (get(driveData).mainFolderId) {
            send(CLOUD, ["SYNC_DATA"], { mainFolderId: get(driveData).mainFolderId, path: get(showsPath) })
            return
        }

        send(CLOUD, ["GET_MAIN_FOLDER"])
    },
    GET_MAIN_FOLDER: ({ id }: any) => {
        if (!id) return

        driveData.update((a) => {
            a.mainFolderId = id
            return a
        })

        send(CLOUD, ["SYNC_DATA"], { mainFolderId: id, path: get(showsPath) })
    },
}

const saveList: { [key in SaveList]: any } = {
    initialized: null,
    activeProject: null,
    alertUpdates: alertUpdates,
    audioFolders: audioFolders,
    autoOutput: autoOutput,
    categories: categories,
    timeFormat: timeFormat,
    maxConnections: maxConnections,
    ports: ports,
    defaultProjectName: defaultProjectName,
    events: events,
    showsPath: showsPath,
    exportPath: exportPath,
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
    theme: theme,
    themes: themes,
    transitionData: transitionData,
    videoExtensions: videoExtensions,
    webFavorites: webFavorites,
    volume: null,
    midiIn: midiIn,
    driveKeys: driveKeys,
    driveData: driveData,
}
