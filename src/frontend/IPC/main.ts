import { get } from "svelte/store"
import { uid } from "uid"
import { ToMain, ToMainReceiveData, ToMainReceiveValue, ToMainSendPayloads } from "../../types/IPC/ToMain"
import type { Project } from "../../types/Projects"
import { triggerAction } from "../components/actions/api"
import { receivedMidi } from "../components/actions/midi"
import { menuClick } from "../components/context/menuClick"
import { clone } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { captureCanvas, setMediaTracks } from "../components/helpers/media"
import { getActiveOutputs } from "../components/helpers/output"
import { loadShows, saveTextCache } from "../components/helpers/setShow"
import { checkName } from "../components/helpers/show"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { createImageShow } from "../converters/imageShow"
import { createCategory, setTempShows } from "../converters/importHelpers"
import {
    activeEdit,
    activePage,
    activePopup,
    activeProject,
    activeShow,
    alertMessage,
    currentOutputSettings,
    dataPath,
    dictionary,
    driveKeys,
    events,
    folders,
    lessonsLoaded,
    media,
    outputs,
    overlays,
    pcoConnected,
    popupData,
    presentationData,
    projects,
    projectTemplates,
    projectView,
    redoHistory,
    shows,
    showsCache,
    showsPath,
    stageShows,
    templates,
    textCache,
    theme,
    themes,
    undoHistory,
    usageLog,
    windowState,
} from "../stores"
import { newToast } from "../utils/common"
import { initializeClosing, saveComplete } from "../utils/save"
import { updateSyncedSettings, updateThemeValues } from "../utils/updateSettings"
import { MAIN, Main, MainReceiveData, MainReceiveValue, MainReturnPayloads, type MainSendValue } from "./../../types/IPC/Main"
import { addDrawerFolder } from "../components/helpers/dropActions"
import { validateKeys } from "../utils/drive"

// @ts-ignore // T extends keyof typeof Main
export function requestMainMultiple<T extends Main>(object: { [K in T]: (data: MainReturnPayloads[K]) => void }) {
    Object.keys(object).forEach((id) => {
        requestMain(id as Main, undefined, object[id])
    })
}

let currentlyAwaiting: string[] = []
// @ts-ignore
export async function requestMain<ID extends Main, V, R = MainReturnPayloads[ID]>(id: ID, value?: MainSendValue<ID, V>, callback?: (data: R) => void) {
    let listenerId = id + uid(5)
    currentlyAwaiting.push(listenerId)

    sendMain(id, value)

    // LISTENER
    const waitingTimeout = 8000
    let timeout: NodeJS.Timeout | null = null
    const returnData: R = await new Promise((resolve) => {
        timeout = setTimeout(() => {
            throw new Error("IPC Message Timed Out!")
        }, waitingTimeout)

        window.api.receive(
            MAIN,
            (msg: MainReceiveValue, listenId: string) => {
                if (msg.channel !== id || listenId !== listenerId) return

                if (timeout) clearTimeout(timeout)
                resolve(msg.data as R)
            },
            listenerId
        )
    })

    let waitIndex = currentlyAwaiting.indexOf(listenerId)
    if (waitIndex > -1) currentlyAwaiting.splice(waitIndex, 1)
    window.api.removeListener(MAIN, listenerId)

    if (callback) callback(returnData)
    return returnData
}

export function sendMain<ID extends Main, V>(id: ID, value?: MainSendValue<ID, V>) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!window.api) return

    window.api.send(MAIN, { channel: id, data: value })
}

const mainResponses = {
    // STORES
    [ToMain.SAVE2]: (a: ToMainSendPayloads[ToMain.SAVE2]) => saveComplete(a),
    [Main.SYNCED_SETTINGS]: (a: MainReturnPayloads[Main.SYNCED_SETTINGS]) => updateSyncedSettings(a),
    [Main.SHOWS]: async (a: MainReturnPayloads[Main.SHOWS]) => {
        let difference = Object.keys(a).length - Object.keys(get(shows)).length
        if (difference < 15 && Object.keys(get(shows)).length && difference > 0) {
            // get new shows & cache their content
            let newShowIds = Object.keys(a).filter((id) => !get(shows)[id])
            await loadShows(newShowIds)
            newShowIds.forEach((id) => saveTextCache(id, get(showsCache)[id]))
        }

        shows.set(a)
    },
    [Main.STAGE_SHOWS]: (a: MainReturnPayloads[Main.STAGE_SHOWS]) => stageShows.set(a),
    [Main.PROJECTS]: (a: MainReturnPayloads[Main.PROJECTS]) => {
        projects.set(a.projects || {})
        folders.set(a.folders || {})
        projectTemplates.set(a.projectTemplates || {})
    },
    [Main.OVERLAYS]: (a: MainReturnPayloads[Main.OVERLAYS]) => overlays.set(a),
    [Main.TEMPLATES]: (a: MainReturnPayloads[Main.TEMPLATES]) => templates.set(a),
    [Main.EVENTS]: (a: MainReturnPayloads[Main.EVENTS]) => events.set(a),
    [Main.DRIVE_API_KEY]: (a: MainReturnPayloads[Main.DRIVE_API_KEY]) => driveKeys.set(a),
    [Main.MEDIA]: (a: MainReturnPayloads[Main.MEDIA]) => media.set(a),
    [Main.THEMES]: (a: MainReturnPayloads[Main.THEMES]) => {
        themes.set(Object.keys(a).length ? a : clone(defaultThemes))

        // update if themes are loaded after settings
        if (get(theme) !== "default") updateThemeValues(get(themes)[get(theme)])
    },
    [Main.CACHE]: (a: MainReturnPayloads[Main.CACHE]) => {
        textCache.set(a.text || {})
    },
    [Main.HISTORY]: (a: MainReturnPayloads[Main.HISTORY]) => {
        undoHistory.set(a.undo || [])
        redoHistory.set(a.redo || [])
    },
    [Main.USAGE]: (a: MainReturnPayloads[Main.USAGE]) => usageLog.set(a),

    // MAIN
    [ToMain.MENU]: (a: ToMainSendPayloads[ToMain.MENU]) => menuClick(a),
    [Main.SHOWS_PATH]: (a: MainReturnPayloads[Main.SHOWS_PATH]) => showsPath.set(a),
    [Main.DATA_PATH]: (a: MainReturnPayloads[Main.DATA_PATH]) => dataPath.set(a),
    [ToMain.ALERT]: (a: ToMainSendPayloads[ToMain.ALERT]) => {
        alertMessage.set(a || "")

        if (a === "error.display") {
            let outputIds = getActiveOutputs(get(outputs), false, true)
            currentOutputSettings.set(outputIds[0])
            popupData.set({ activateOutput: true })
            activePopup.set("choose_screen")
            return
        }

        activePopup.set("alert")
    },
    [ToMain.TOAST]: (a: ToMainSendPayloads[ToMain.TOAST]) => newToast(a),
    [Main.CLOSE]: () => initializeClosing(),
    [Main.RECEIVE_MIDI]: (a: MainReturnPayloads[Main.RECEIVE_MIDI]) => receivedMidi(a),
    [Main.DELETE_SHOWS]: (a: MainReturnPayloads[Main.DELETE_SHOWS]) => {
        if (!a.deleted.length) {
            newToast("$toast.delete_shows_empty")
            return
        }

        alertMessage.set("<h3>Deleted " + a.deleted.length + " files</h3><br>● " + a.deleted.join("<br>● "))
        activePopup.set("alert")
    },
    [Main.REFRESH_SHOWS]: (a: ToMainSendPayloads[ToMain.REFRESH_SHOWS2]) => {
        let oldCount = Object.keys(get(shows)).length
        let newCount = Object.keys(a).length

        shows.set(a)

        if (get(activePopup) || get(activePage) !== "settings") return
        alertMessage.set("<h3>Updated shows</h3><br>● Old shows: " + oldCount + "<br>● New shows: " + newCount)
        activePopup.set("alert")
    },
    [ToMain.BACKUP]: ({ finished, path }: ToMainSendPayloads[ToMain.BACKUP]) => {
        if (!finished) return activePopup.set(null)

        console.log("Backed up to:", path)
        newToast(get(dictionary).settings?.backup_finished || "") // + ": " + path)
    },
    [Main.RESTORE]: ({ finished, starting }: ToMainSendPayloads[ToMain.RESTORE2]) => {
        if (!finished) return activePopup.set(null)
        if (starting) return newToast("$settings.restore_started")

        // close opened
        activeEdit.set({ items: [] })
        activeShow.set(null)
        activePage.set("show")

        newToast("$settings.restore_finished")
    },
    [Main.LOCATE_MEDIA_FILE]: (data: Awaited<MainReturnPayloads[Main.LOCATE_MEDIA_FILE]>) => {
        if (!data) return
        let prevPath: string = ""

        showsCache.update((a) => {
            let media = a[data.ref.showId].media[data.ref.mediaId]
            if (data.ref.cloudId) {
                if (!media.cloud) a[data.ref.showId].media[data.ref.mediaId].cloud = {}
                prevPath = a[data.ref.showId].media[data.ref.mediaId].cloud![data.ref.cloudId]
                a[data.ref.showId].media[data.ref.mediaId].cloud![data.ref.cloudId] = data.path
            } else {
                prevPath = a[data.ref.showId].media[data.ref.mediaId].path || ""
                a[data.ref.showId].media[data.ref.mediaId].path = data.path
            }

            return a
        })

        // sometimes when lagging the image will be "replaced" even when it exists
        if (prevPath !== data.path) newToast("$toast.media_replaced")
    },
    [Main.MEDIA_TRACKS]: (data: Awaited<MainReturnPayloads[Main.MEDIA_TRACKS]>) => setMediaTracks(data),
    [Main.API_TRIGGER]: (data: ToMainSendPayloads[ToMain.API_TRIGGER2]) => triggerAction(data),
    [ToMain.PRESENTATION_STATE]: (data: ToMainSendPayloads[ToMain.PRESENTATION_STATE]) => presentationData.set(data),
    // TOP BAR
    [Main.MAXIMIZED]: (data: MainReturnPayloads[Main.MAXIMIZED]) => windowState.set({ ...windowState, maximized: data }),
    // MEDIA CACHE
    [ToMain.CAPTURE_CANVAS]: (data: ToMainSendPayloads[ToMain.CAPTURE_CANVAS]) => captureCanvas(data),
    [ToMain.LESSONS_DONE]: (data: ToMainSendPayloads[ToMain.LESSONS_DONE]) => lessonsLoaded.set({ ...get(lessonsLoaded), [data.showId]: data.status }),
    [ToMain.IMAGES_TO_SHOW]: (data: ToMainSendPayloads[ToMain.IMAGES_TO_SHOW]) => createImageShow(data),

    // CONNECTION
    [ToMain.PCO_CONNECT]: (data: ToMainSendPayloads[ToMain.PCO_CONNECT]) => {
        if (!data.success) return
        pcoConnected.set(true)
        if (data.isFirstConnection) newToast("$main.finished")
    },
    [ToMain.PCO_PROJECTS]: (data: ToMainSendPayloads[ToMain.PCO_PROJECTS]) => {
        if (!data.projects) return

        // CREATE CATEGORY
        createCategory("Planning Center")

        // CREATE SHOWS
        let tempShows: any[] = []
        data.shows.forEach((show) => {
            let id = show.id
            delete show.id
            tempShows.push({ id, show: { ...show, name: checkName(show.name, id), locked: true } })
        })
        setTempShows(tempShows)

        data.projects.forEach((pcoProject) => {
            // CREATE PROJECT FOLDER
            let folderId = pcoProject.folderId
            if (folderId && (!get(folders)[folderId] || get(folders)[folderId].deleted)) {
                history({ id: "UPDATE", newData: { replace: { parent: "/", name: pcoProject.folderName } }, oldData: { id: folderId }, location: { page: "show", id: "project_folder" } })
            }

            // CREATE PROJECT
            let project: Project = {
                name: pcoProject.name,
                created: pcoProject.created,
                used: Date.now(), // show on top in last used list
                parent: folderId || "/",
                shows: pcoProject.items || [],
            }

            let projectId = pcoProject.id
            history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        })

        // open closest to today
        activeProject.set(data.projects.sort((a, b) => a.scheduledTo - b.scheduledTo)[0]?.id)
        projectView.set(false)
    },
    [ToMain.OPEN_FOLDER2]: (a: ToMainSendPayloads[ToMain.OPEN_FOLDER2]) => {
        const receiveFOLDER: any = {
            MEDIA: () => addDrawerFolder(a, "media"),
            AUDIO: () => addDrawerFolder(a, "audio"),
            SHOWS: () => showsPath.set(a.path),
            DATA: () => dataPath.set(a.path),
            DATA_SHOWS: () => {
                dataPath.set(a.path)
                if (a.showsPath) showsPath.set(a.showsPath)
            },
        }

        receiveFOLDER[a.channel]()
    },
    [ToMain.OPEN_FILE2]: (a: ToMainSendPayloads[ToMain.OPEN_FILE2]) => {
        const receiveFILE = {
            GOOGLE_KEYS: ({ files, content }) => {
                let path = files[0]
                let file = content[path]
                if (file) validateKeys(file)
            },
        }

        receiveFILE[a.channel]()
    },
}

export async function receiveMain() {
    window.api.receive(MAIN, (msg: MainReceiveValue | ToMainReceiveValue) => {
        const id = msg.channel
        if (!Object.values({ ...Main, ...ToMain }).includes(id)) throw new Error(`Invalid channel: ${id}`)
        if (!mainResponses[id]) return // console.error(`No response for channel: ${id}`)

        const data = msg.data // MainReturnPayloads[Main]
        mainResponses[id](data) as MainReceiveData<Main> | ToMainReceiveData<ToMain> // const response =
    })
}
