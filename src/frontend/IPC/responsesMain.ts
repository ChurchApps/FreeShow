import { get } from "svelte/store"
import type { ToMainSendPayloads } from "../../types/IPC/ToMain"
import { ToMain } from "../../types/IPC/ToMain"
import type { Project } from "../../types/Projects"
import type { Show } from "../../types/Show"
import { API_ACTIONS, triggerAction } from "../components/actions/api"
import { receivedMidi } from "../components/actions/midi"
import { menuClick } from "../components/context/menuClick"
import { getCurrentTimerValue } from "../components/drawer/timers/timers"
import { getDynamicValue, _getVariableValue } from "../components/edit/scripts/itemHelpers"
import { getSlidesText } from "../components/edit/scripts/textStyle"
import { clone, keysToID } from "../components/helpers/array"
import { addDrawerFolder } from "../components/helpers/dropActions"
import { history } from "../components/helpers/history"
import { captureCanvas, setMediaTracks } from "../components/helpers/media"
import { getActiveOutputs } from "../components/helpers/output"
import { loadShows, saveTextCache } from "../components/helpers/setShow"
import { checkName, getLabelId } from "../components/helpers/show"
import { joinTimeBig } from "../components/helpers/time"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { importBibles } from "../converters/bible"
import { convertCalendar } from "../converters/calendar"
import { convertChordPro } from "../converters/chordpro"
import { convertCSV } from "../converters/csv"
import { convertEasyslides } from "../converters/easyslides"
import { convertEasyWorship } from "../converters/easyworship"
import { createImageShow } from "../converters/imageShow"
import { createCategory, importShow, importSpecific, importTemplate, setTempShows } from "../converters/importHelpers"
import { convertLessonsPresentation } from "../converters/lessonsChurch"
import { convertMediaShout } from "../converters/mediashout"
import { convertOpenLP } from "../converters/openlp"
import { convertOpenSong } from "../converters/opensong"
import { convertPowerpoint } from "../converters/powerpoint"
import { addToProject, importProject } from "../converters/project"
import { convertProPresenter } from "../converters/propresenter"
import { convertQuelea } from "../converters/quelea"
import { convertSoftProjector } from "../converters/softprojector"
import { convertSongbeamerFiles } from "../converters/songbeamer"
import { convertTexts } from "../converters/txt"
import { convertVerseVIEW } from "../converters/verseview"
import { convertVideopsalm } from "../converters/videopsalm"
import {
    activeEdit,
    activePage,
    activePopup,
    activeProject,
    activeShow,
    activeTimers,
    alertMessage,
    audioData,
    chumsConnected,
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
    spellcheck,
    stageShows,
    templates,
    textCache,
    theme,
    themes,
    timers,
    undoHistory,
    usageLog,
    variables,
    windowState
} from "../stores"
import { newToast } from "../utils/common"
import { confirmCustom } from "../utils/popup"
import { initializeClosing, saveComplete } from "../utils/save"
import { updateSettings, updateSyncedSettings, updateThemeValues } from "../utils/updateSettings"
import type { MainReturnPayloads } from "./../../types/IPC/Main"
import { Main } from "./../../types/IPC/Main"

type MainHandler<ID extends Main | ToMain> = (data: ID extends keyof ToMainSendPayloads ? ToMainSendPayloads[ID] : ID extends keyof MainReturnPayloads ? Awaited<MainReturnPayloads[ID]> : undefined) => void
export type MainResponses = {
    [ID in Main | ToMain]?: MainHandler<ID>
}

export const mainResponses: MainResponses = {
    // STORES
    [ToMain.SAVE2]: (a) => saveComplete(a),
    [Main.SETTINGS]: (a) => updateSettings(a),
    [Main.SYNCED_SETTINGS]: (a) => updateSyncedSettings(a),
    [Main.SHOWS]: async (a) => {
        const difference = Object.keys(a).length - Object.keys(get(shows)).length
        if (difference < 15 && Object.keys(get(shows)).length && difference > 0) {
            // get new shows & cache their content
            const newShowIds = Object.keys(a).filter((id) => !get(shows)[id])
            await loadShows(newShowIds)
            newShowIds.forEach((id) => saveTextCache(id, get(showsCache)[id]))
        }

        shows.set(a)
    },
    [Main.STAGE_SHOWS]: (a) => stageShows.set(a),
    [Main.PROJECTS]: (a) => {
        projects.set(a.projects || {})
        folders.set(a.folders || {})
        projectTemplates.set(a.projectTemplates || {})
    },
    [Main.OVERLAYS]: (a) => overlays.set(a),
    [Main.TEMPLATES]: (a) => templates.set(a),
    [Main.EVENTS]: (a) => events.set(a),
    [Main.MEDIA]: (a) => media.set(a),
    [Main.THEMES]: (a) => {
        themes.set(Object.keys(a).length ? a : clone(defaultThemes))

        // update if themes are loaded after settings
        if (get(theme) !== "default") updateThemeValues(get(themes)[get(theme)])
    },
    [Main.DRIVE_API_KEY]: (a) => driveKeys.set(a),
    [Main.HISTORY]: (a) => {
        undoHistory.set(a.undo || [])
        redoHistory.set(a.redo || [])
    },
    [Main.CACHE]: (a) => {
        textCache.set(a.text || {})
    },
    [Main.USAGE]: (a) => usageLog.set(a),

    // MAIN
    [ToMain.MENU]: (a) => menuClick(a),
    [ToMain.API]: async (a) => await API_ACTIONS[a.action]?.(a.data),
    [Main.SHOWS_PATH]: (a) => showsPath.set(a),
    [Main.DATA_PATH]: (a) => dataPath.set(a),
    [ToMain.ALERT]: (a) => {
        alertMessage.set(a || "")

        if (a === "error.display") {
            const outputIds = getActiveOutputs(get(outputs), false, true)
            currentOutputSettings.set(outputIds[0])
            popupData.set({ activateOutput: true })
            activePopup.set("choose_screen")
            return
        }

        activePopup.set("alert")
    },
    [ToMain.TOAST]: (a) => newToast(a),
    [ToMain.SPELL_CHECK]: (a) => spellcheck.set(a),
    [Main.CLOSE]: (a) => initializeClosing(a ?? false),
    [ToMain.RECEIVE_MIDI2]: (a) => receivedMidi(a),
    [Main.DELETE_SHOWS]: (a) => {
        if (!a.deleted.length) {
            newToast("$toast.delete_shows_empty")
            return
        }

        alertMessage.set("<h3>Deleted " + a.deleted.length + " files</h3><br>● " + a.deleted.join("<br>● "))
        activePopup.set("alert")
    },
    [ToMain.REFRESH_SHOWS2]: (a) => {
        const oldCount = Object.keys(get(shows)).length
        const newCount = Object.keys(a).length

        shows.set(a)

        if (get(activePopup) || get(activePage) !== "settings") return
        alertMessage.set("<h3>Updated shows</h3><br>● Old shows: " + oldCount + "<br>● New shows: " + newCount)
        activePopup.set("alert")
    },
    [ToMain.BACKUP]: ({ finished, path }) => {
        if (!finished) return activePopup.set(null)

        console.info("Backed up to:", path)
        newToast(get(dictionary).settings?.backup_finished || "") // + ": " + path)
    },
    [ToMain.RESTORE2]: ({ finished, starting }) => {
        if (!finished) {
            if (get(activePopup) !== "initialize") activePopup.set(null)
            return
        }
        if (starting) return newToast("$settings.restore_started")

        // close opened
        activeEdit.set({ items: [] })
        activeShow.set(null)
        activePage.set("show")
        if (get(activePopup) === "initialize") activePopup.set(null)

        newToast("$settings.restore_finished")
    },
    [Main.LOCATE_MEDIA_FILE]: (data) => {
        if (!data) return
        let prevPath = ""

        showsCache.update((a) => {
            const mediaData = a[data.ref.showId].media[data.ref.mediaId]
            if (data.ref.cloudId) {
                if (!mediaData.cloud) a[data.ref.showId].media[data.ref.mediaId].cloud = {}
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
    [Main.MEDIA_TRACKS]: (data) => setMediaTracks(data),
    [ToMain.API_TRIGGER2]: (data) => triggerAction(data),
    [ToMain.PRESENTATION_STATE]: (data) => presentationData.set(data),
    // TOP BAR
    [Main.MAXIMIZED]: (data) => windowState.set({ ...windowState, maximized: data }),
    // MEDIA CACHE
    [ToMain.CAPTURE_CANVAS]: (data) => captureCanvas(data),
    [ToMain.LESSONS_DONE]: (data) => lessonsLoaded.set({ ...get(lessonsLoaded), [data.showId]: data.status }),
    [ToMain.IMAGES_TO_SHOW]: (data) => createImageShow(data),
    [ToMain.AUDIO_METADATA]: (data) => {
        audioData.update((a) => {
            a[data.filePath] = { metadata: data.metadata }
            return a
        })
    },

    // Companion dynamic value variables
    [ToMain.GET_DYNAMIC_VALUES]: (data) => {
        const variableData: { [key: string]: string } = {}
        data.forEach((key) => {
            variableData[key] = getDynamicValue(key).replaceAll("<br>", "\n")
        })

        // get "actual" variables
        Object.entries(get(variables)).forEach(([id, a]) => {
            variableData[`variable_${getLabelId(a.name, false)}`] = _getVariableValue(id)
        })

        // get timers
        Object.entries(get(timers)).forEach(([id, a]) => {
            const labelId = getLabelId(a.name, false)
            const currentTime = getCurrentTimerValue(a, { id }, new Date())
            const timeValue = `${currentTime < 0 ? "-" : ""}${joinTimeBig(typeof currentTime === "number" ? currentTime : 0)}`
            variableData[`timer_${labelId}`] = timeValue
            variableData[`timer_${labelId}_seconds`] = currentTime.toString()
            const activeTimer = get(activeTimers).find((activeTimer) => activeTimer.id === id)
            let status = "Stopped"
            if (activeTimer) {
                status = activeTimer.paused ? "Paused" : "Playing"
            }
            variableData[`timer_${labelId}_status`] = status
        })

        // timer status
        const anyActiveTimers = !!get(activeTimers).length
        const anyPlaying = get(activeTimers).find((a) => !a.paused)
        variableData.timer_status = anyPlaying ? "Playing" : anyActiveTimers ? "Paused" : "Stopped"

        return variableData
    },

    // CONNECTION
    [ToMain.PCO_CONNECT]: (data) => {
        if (!data.success) return
        pcoConnected.set(true)
        if (data.isFirstConnection) newToast("$main.finished")
    },
    [ToMain.PCO_PROJECTS]: async (data) => {
        if (!data.projects) return

        // CREATE CATEGORY
        createCategory("Planning Center")

        const replaceIds: { [key: string]: string } = {}
        const allShows = keysToID(get(shows))

        // CREATE SHOWS
        const tempShows: { id: string; show: Show }[] = []
        for (const show of data.shows) {
            const id = show.id

            // TODO: check if name contains scripture reference (and is empty), and load from active scripture

            // first find any shows linked to the id
            const linkedShow = allShows.find(({ quickAccess }) => quickAccess?.pcoLink === id)
            if (linkedShow) {
                replaceIds[id] = linkedShow.id
                continue
            }

            // find existing show with same name and ask to replace.
            const existingShow = allShows.find(({ name }) => name.toLowerCase() === show.name.toLowerCase())
            // const existingShowHasContent = existingShow && (await loadShows([existingShow.id])) && getSlidesText(get(showsCache)[existingShow.id].slides)
            if (existingShow) {
                const useLocal = await confirmCustom(`There is an existing show with the same name: ${existingShow.name}.<br><br>Would you like to use the local version instead of the one from Planning Center?`)
                if (useLocal) {
                    replaceIds[id] = existingShow.id

                    await loadShows([existingShow.id])
                    showsCache.update((a) => {
                        if (!a[existingShow.id].quickAccess) a[existingShow.id].quickAccess = {}
                        a[existingShow.id].quickAccess.pcoLink = id
                        return a
                    })

                    continue
                }
            }

            // don't add/update if already existing (to not mess up any set styles)
            if (get(shows)[id]) continue

            delete show.id
            tempShows.push({ id, show: { ...show, origin: "pco", name: checkName(show.name, id), quickAccess: { pcoLink: id } } })
        }
        setTempShows(tempShows)

        data.projects.forEach((pcoProject) => {
            // CREATE PROJECT FOLDER
            const folderId = pcoProject.folderId
            if (folderId && (!get(folders)[folderId] || get(folders)[folderId].deleted)) {
                history({ id: "UPDATE", newData: { replace: { parent: "/", name: pcoProject.folderName } }, oldData: { id: folderId }, location: { page: "show", id: "project_folder" } })
            }

            // CREATE PROJECT
            const project: Project = {
                name: pcoProject.name,
                created: pcoProject.created,
                used: Date.now(), // show on top in last used list
                parent: folderId || "/",
                shows: pcoProject.items || []
            }

            // REPLACE IDS
            project.shows = project.shows.map((a) => ({ ...a, id: replaceIds[a.id] || a.id }))

            const projectId = pcoProject.id
            history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        })

        // open closest to today
        activeProject.set(data.projects.sort((a, b) => a.scheduledTo - b.scheduledTo)[0]?.id)
        projectView.set(false)
    },
    // CHUMS CONNECTION
    [ToMain.CHUMS_CONNECT]: (data) => {
        if (!data.success) return
        chumsConnected.set(true)
        if (data.isFirstConnection) newToast("$main.finished")
    },
    [ToMain.CHUMS_PROJECTS]: async (data) => {
        if (!data.projects) return

        // CREATE CATEGORY
        createCategory("Chums")

        // CREATE SHOWS
        const replaceIds: { [key: string]: string } = {}
        const tempShows: { id: string; show: Show }[] = []
        for (const show of data.shows) {
            const id = show.id

            // don't add/update if already existing (to not mess up any set styles)
            if (get(shows)[id]) continue

            // replace with existing Chums show, that has the same name (but different ID), if it's without content
            for (const [showId, currentShow] of Object.entries(get(shows))) {
                if (currentShow.name !== show.name || currentShow.origin !== "chums") continue
                await loadShows([showId])

                const loadedShow = get(showsCache)[showId]
                if (!getSlidesText(loadedShow.slides)) {
                    replaceIds[show.id] = showId
                    break
                }
            }

            if (replaceIds[show.id]) continue

            delete show.id
            tempShows.push({ id, show: { ...show, origin: "chums", name: checkName(show.name, id) } })
        }
        setTempShows(tempShows)

        data.projects.forEach((chumsProject) => {
            // CREATE PROJECT FOLDER
            const folderId = chumsProject.folderId
            if (folderId && (!get(folders)[folderId] || get(folders)[folderId].deleted)) {
                history({ id: "UPDATE", newData: { replace: { parent: "/", name: chumsProject.folderName } }, oldData: { id: folderId }, location: { page: "show", id: "project_folder" } })
            }

            // CREATE PROJECT
            const project: Project = {
                name: chumsProject.name,
                created: chumsProject.created,
                used: Date.now(), // show on top in last used list
                parent: folderId || "/",
                shows: chumsProject.items || []
            }

            project.shows = project.shows.map((a) => ({ ...a, id: replaceIds[a.id] || a.id }))

            const projectId = chumsProject.id
            history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        })

        // open closest to today
        activeProject.set(data.projects.sort((a, b) => a.scheduledTo - b.scheduledTo)[0]?.id)
        projectView.set(false)
    },
    [ToMain.OPEN_FOLDER2]: (a) => {
        const receiveFOLDER = {
            MEDIA: () => addDrawerFolder(a, "media"),
            AUDIO: () => addDrawerFolder(a, "audio"),
            SHOWS: () => showsPath.set(a.path),
            DATA: () => dataPath.set(a.path),
            DATA_SHOWS: () => {
                dataPath.set(a.path)
                if (a.showsPath) showsPath.set(a.showsPath)
            }
        }

        if (!receiveFOLDER[a.channel]) return
        receiveFOLDER[a.channel]()
    },
    [ToMain.IMPORT2]: (a) => {
        const mainData = a.data

        const receiveFilePathIMPORT = {
            // Media
            pdf: () => addToProject("pdf", mainData as string[]),
            powerkey: () => addToProject("ppt", mainData as string[])
        }
        if (mainData.find((dataValue) => typeof dataValue === "string")) {
            if (!receiveFilePathIMPORT[a.channel]) return
            receiveFilePathIMPORT[a.channel]()
            return
        }

        const data = mainData as { content: string; name?: string; extension?: string }[]

        const receiveIMPORT = {
            // FreeShow
            freeshow: () => importShow(data),
            freeshow_project: () => importProject(data),
            freeshow_template: () => importTemplate(data),
            freeshow_theme: () => importSpecific(data, themes),
            // Text
            txt: () => convertTexts(data),
            chordpro: () => convertChordPro(data),
            csv: () => convertCSV(data),
            powerpoint: () => convertPowerpoint(data),
            word: () => convertTexts(data),
            // Other programs
            propresenter: () => convertProPresenter(data),
            easyworship: () => convertEasyWorship(data),
            videopsalm: () => convertVideopsalm(data),
            openlp: () => convertOpenLP(data),
            opensong: () => convertOpenSong(data),
            mediashout: () => convertMediaShout(data),
            quelea: () => convertQuelea(data),
            softprojector: () => convertSoftProjector(data),
            songbeamer: () => convertSongbeamerFiles(a.custom),
            easyslides: () => convertEasyslides(data),
            verseview: () => convertVerseVIEW(data),
            // Media
            lessons: () => convertLessonsPresentation(data),
            // Other
            calendar: () => convertCalendar(data),
            // Bibles
            BIBLE: () => importBibles(data)
        }

        if (!receiveIMPORT[a.channel]) return
        receiveIMPORT[a.channel]()
    }
}
