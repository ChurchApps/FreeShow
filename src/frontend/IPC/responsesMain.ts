import { get } from "svelte/store"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import type { ToMainSendPayloads } from "../../types/IPC/ToMain"
import { ToMain } from "../../types/IPC/ToMain"
import type { Project } from "../../types/Projects"
import type { Show, Slide } from "../../types/Show"
import { Transcript } from "../ai/stt/transcript"
import { API_ACTIONS, triggerAction } from "../components/actions/api"
import { receivedMidi } from "../components/actions/midi"
import { menuClick } from "../components/context/menuClick"
import { generateScriptureShowFromReference } from "../components/drawer/bible/scripture"
import { getCurrentTimerValue } from "../components/drawer/timers/timers"
import { _getVariableValue, getDynamicValue } from "../components/edit/scripts/itemHelpers"
import { clone, keysToID } from "../components/helpers/array"
import { addDrawerFolder } from "../components/helpers/dropActions"
import { history } from "../components/helpers/history"
import { captureCanvas, getExtension, getFileName, removeExtension, setMediaTracks } from "../components/helpers/media"
import { getActiveOutputs } from "../components/helpers/output"
import { loadShows, saveTextCache } from "../components/helpers/setShow"
import { checkName, getGlobalGroup, getLabelId } from "../components/helpers/show"
import { joinTimeBig } from "../components/helpers/time"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { processTimecodeFrame, updateTimelineStatus, updateTimelineTime } from "../components/timeline/timecode"
import { importBibles } from "../converters/bible"
import { convertCalendar } from "../converters/calendar"
import { convertChordPro } from "../converters/chordpro"
import { convertCSV } from "../converters/csv"
import { convertEasyslides } from "../converters/easyslides"
import { convertEasyWorship } from "../converters/easyworship"
import { createImageShow } from "../converters/imageShow"
import { createCategory, importAction, importShow, importSpecific, importStage, importTemplate, setTempShows } from "../converters/importHelpers"
import { hasSameSlideContent, matchArrangements, mergeAsNewArrangement } from "../converters/providerArrangement"
import { convertLessonsPresentation } from "../converters/lessonsChurch"
import { convertMediaShout } from "../converters/mediashout"
import { convertOpenLP } from "../converters/openlp"
import { convertOpenSong } from "../converters/opensong"
import { convertPowerpoint } from "../converters/powerpoint/powerpointImporter"
import { addToProject, importProject, updateRecentlyAddedFiles } from "../converters/project"
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
    aiSttStatus,
    alertMessage,
    audioData,
    contentProviderData,
    currentOutputSettings,
    dataPath,
    driveKeys,
    events,
    folders,
    lessonsLoaded,
    media,
    mediaDownloads,
    outputs,
    overlays,
    pdfImports,
    popupData,
    presentationData,
    projects,
    projectTemplates,
    projectView,
    providerConnections,
    recentFiles,
    redoHistory,
    rtmpStatus,
    shows,
    showsCache,
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
import { setupCloudSync } from "../utils/cloudSync"
import { newToast } from "../utils/common"
import { translateText } from "../utils/language"
import { chooseCustom, confirmCustom } from "../utils/popup"
import { initializeClosing, saveComplete } from "../utils/save"
import { invalidateSearchIndex } from "../utils/searchFast"
import { updateSettings, updateSyncedSettings, updateThemeValues } from "../utils/updateSettings"
import type { MainReturnPayloads } from "./../../types/IPC/Main"
import { Main } from "./../../types/IPC/Main"
import { sendMain } from "./main"

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
    [Main.STAGE]: (a) => stageShows.set(a),
    [Main.PROJECTS]: (a) => {
        const projectsList = a.projects || {}

        // remove "Mark as played" on startup
        Object.values(projectsList).forEach((project) => {
            project?.shows?.forEach((item) => {
                delete item.played
            })
        })

        projects.set(projectsList)
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
        invalidateSearchIndex()
    },
    [Main.USAGE]: (a) => usageLog.set(a),

    // MAIN
    [ToMain.MENU]: (a) => menuClick(a),
    [ToMain.API]: async (a) => await API_ACTIONS[a.action]?.(a.data),
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
    // GPU health degradation notice (electron utils/gpu.ts, ~20s after start): verbose alert with what
    // happened, the implications, and concrete remediation. Composed here so every string is i18n'd.
    [ToMain.GPU_HEALTH]: (a) => {
        const compositing = a.issue === "compositing"
        let html = `<h3>${translateText(compositing ? "gpu.no_acceleration" : "gpu.no_video_decode")}</h3><p>${translateText(compositing ? "gpu.no_acceleration_info" : "gpu.no_video_decode_info")}</p>`
        if (a.vaDriverMissing && a.packages?.length) {
            // Linux with no VA-API driver installed at all: name the exact package(s) for the GPU vendor
            html += `<p>${translateText("gpu.va_driver_missing")}</p><pre style="user-select: text;">sudo apt install ${a.packages.join(" ")}</pre>`
        } else {
            html += `<p>${translateText("gpu.update_drivers")}${a.vendorName ? ` (${a.vendorName})` : ""}</p>`
        }
        html += `<p style="opacity: 0.7;">${translateText("gpu.disable_hint")}</p>`
        alertMessage.set(html)
        activePopup.set("alert")
    },
    [ToMain.SPELL_CHECK]: (a) => spellcheck.set(a),
    [Main.CLOSE]: (a) => initializeClosing(a ?? false),
    [ToMain.RECEIVE_MIDI2]: (a) => receivedMidi(a),
    [Main.DELETE_SHOWS]: (a) => {
        if (!a.deleted.length) {
            newToast("toast.delete_shows_empty")
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
        newToast("settings.backup_finished") // + ": " + path)
    },
    [ToMain.RESTORE2]: ({ finished, starting }) => {
        if (!finished) {
            if (get(activePopup) !== "initialize") activePopup.set(null)
            return
        }
        if (starting) return newToast("settings.restore_started")

        // close opened
        activeEdit.set({ items: [] })
        activeShow.set(null)
        activePage.set("show")
        if (get(activePopup) === "initialize") activePopup.set(null)

        newToast("settings.restore_finished")
    },
    [ToMain.RECENTLY_ADDED_FILES]: (data) => updateRecentlyAddedFiles(data.paths),
    [Main.MEDIA_TRACKS]: (data) => setMediaTracks(data),
    [ToMain.API_TRIGGER2]: (data) => triggerAction(data),
    [ToMain.PRESENTATION_STATE]: (data) => presentationData.set(data),
    // TOP BAR
    [Main.MAXIMIZED]: (data) => windowState.set({ ...windowState, maximized: data }),
    // MEDIA CACHE
    [ToMain.CAPTURE_CANVAS]: (data) => captureCanvas(data),
    [ToMain.LESSONS_DONE]: (data) => lessonsLoaded.set({ ...get(lessonsLoaded), [data.showId]: data.status }),
    [ToMain.IMAGES_TO_SHOW]: (data) => createImageShow(data),
    [ToMain.RTMP_STATUS]: (data) => rtmpStatus.update((a) => ({ ...a, [data.outputId]: data.destinations })),
    [ToMain.MEDIA_DOWNLOAD_PROGRESS]: (data) => {
        mediaDownloads.update((downloads) => {
            const newDownloads = new Map(downloads)
            const total = Math.max(1, data.total || 0)
            const progress = data.status === "complete" ? total : Math.min(data.progress || 0, total)
            if (data.status === "complete" || data.status === "error") {
                // Remove completed/errored downloads after a short delay
                setTimeout(() => {
                    mediaDownloads.update((d) => {
                        const updated = new Map(d)
                        updated.delete(data.url)
                        return updated
                    })
                }, 2000)
            }
            newDownloads.set(data.url, { progress, total, status: data.status, name: data.name })
            return newDownloads
        })
    },
    [ToMain.PDF_IMPORT_PROGRESS]: (data) => {
        pdfImports.update((imports) => {
            const updated = new Map(imports)
            updated.set(data.filePath, {
                name: data.name,
                progress: data.progress,
                total: data.total,
                status: data.status,
                message: data.message
            })

            if (data.status === "complete" || data.status === "error") {
                setTimeout(
                    () => {
                        pdfImports.update((current) => {
                            const cleaned = new Map(current)
                            cleaned.delete(data.filePath)
                            return cleaned
                        })
                    },
                    data.status === "error" ? 7000 : 3000
                )
            }

            return updated
        })
    },
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
            if (!a.name) return
            let val = _getVariableValue(id)
            if (Array.isArray(val)) val = val[0]
            variableData[`variable_${getLabelId(a.name, false)}`] = val
        })

        // get timers
        Object.entries(get(timers)).forEach(([id, a]) => {
            if (!a.name) return
            const labelId = getLabelId(a.name, false)
            const currentTime = getCurrentTimerValue(a, { id }, new Date())
            const timeValue = `${currentTime < 0 ? "-" : ""}${joinTimeBig(typeof currentTime === "number" ? currentTime : 0)}`
            variableData[`timer_${labelId}`] = timeValue
            variableData[`timer_${labelId}_seconds`] = currentTime.toString()
            const activeTimer = get(activeTimers).find((timer) => timer.id === id)
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
    // UNIFIED PROVIDER CALLBACKS
    [ToMain.PROVIDER_CONNECT]: (data) => {
        if (!data?.success) return

        providerConnections.update((c) => {
            c[data.providerId] = true
            return c
        })

        if (data.isFirstConnection) newToast("main.finished")

        if (data.providerId !== "churchApps") return
        setTimeout(() => {
            setupCloudSync(!data.isFirstConnection)
        }, 1000)
    },
    [ToMain.PROVIDER_PROJECTS]: async (data) => {
        if (!data.projects) return

        // Planning Center items are seperated into multiple categories based on the type: Songs (default) & Regular items (generic)
        if (data.providerId === "planningcenter" && data.shows.some((a) => a.category === "planning_center_generic")) {
            createCategory("Planning Center (Generic)", "presentation")
        }

        // CREATE CATEGORY
        createCategory(data.categoryName)

        const replaceIds: { [key: string]: string } = {}
        const allShows = keysToID(get(shows))
        const songOrigin = get(contentProviderData)[data.providerId]?.songOrigin
        const linkKey = data.providerId === "planningcenter" ? "pcoLink" : data.providerId === "churchApps" ? "chumsLink" : data.providerId === "amazinglife" ? "alLink" : data.providerId === "onstage" ? "onstageLink" : ""
        const origin = data.providerId === "planningcenter" ? "pco" : data.providerId

        // linkToId stores the provider id, so later syncs recognize this show instead of asking again
        function updateExistingShow(showId: string, linkToId = "") {
            shows.update((a) => {
                if (!a[showId]) return a // should always exist

                a[showId].origin = origin
                if (linkToId && linkKey) {
                    if (!a[showId].quickAccess) a[showId].quickAccess = {}
                    a[showId].quickAccess[linkKey] = linkToId
                }
                return a
            })

            // update showsCache directly in case it's not yet saved to a local file
            showsCache.update((a) => {
                if (!a[showId]) return a

                // we should not set link when requesting to use local show, that way it will ask next time as well
                if (linkToId && linkKey) {
                    if (!a[showId].quickAccess) a[showId].quickAccess = {}
                    a[showId].quickAccess[linkKey] = linkToId
                }

                a[showId].origin = origin
                return a
            })
        }

        // OnStage can add its arrangements to a local song instead of replacing it, so the conflict
        // question has three answers instead of yes/no. This is independent of the song origin
        // setting: the origin decides local vs online, the arrangement question decides whether
        // the online structure replaces the local one or is added next to it.
        const askArrangement = data.providerId === "onstage" && get(contentProviderData).onstage?.askArrangement !== false
        // "only add new songs": a song that already exists locally is left completely alone
        const onlyAddNew = data.providerId === "onstage" && get(contentProviderData).onstage?.syncMode === "new"

        // Project items point at a specific arrangement of a show. When the provider show does not
        // end up stored as-is, its arrangement ids no longer exist and have to be rewritten:
        // a mapped id replaces it, an empty one drops it (falling back to the local arrangement).
        const layoutReplaceIds: { [key: string]: string } = {}

        function mapLayouts(layoutMap: { [key: string]: string }) {
            Object.keys(layoutMap).forEach((incomingLayoutId) => (layoutReplaceIds[incomingLayoutId] = layoutMap[incomingLayoutId]))
        }

        function dropLayouts(providerShow: Show) {
            Object.keys(providerShow.layouts || {}).forEach((layoutId) => (layoutReplaceIds[layoutId] = ""))
        }

        function applyGlobalGroups(providerShow: Show) {
            Object.values<Slide>(providerShow.slides).forEach((slide) => {
                if (slide.globalGroup || !slide.group) return

                const globalGroup = getGlobalGroup(slide.group)
                if (globalGroup) slide.globalGroup = globalGroup
            })
        }

        // What to do with a provider song that already exists locally. "skip" means the provider
        // has nothing new — the local show is left alone without asking anything.
        async function resolveExistingShow(existingId: string, existingName: string, providerShow: Show, prompt: string, providerLabel: string): Promise<{ action: "local" | "replace" | "merge" | "skip"; layoutMap?: { [key: string]: string } }> {
            // an explicit reload of one show is an unambiguous request for the provider version
            if (data.forceReplace) return { action: "replace" }

            if (onlyAddNew) {
                // the local song stays untouched either way — mapping its arrangements when they
                // happen to match just keeps the project items pointing at the right one
                await loadShows([existingId])
                const localShow = get(showsCache)[existingId]
                const layoutMap = localShow ? matchArrangements(localShow, providerShow) : null

                return layoutMap ? { action: "skip", layoutMap } : { action: "local" }
            }

            if (askArrangement) {
                await loadShows([existingId])
                const localShow = get(showsCache)[existingId]

                if (localShow) {
                    // Every arrangement the provider sent already exists locally, so there is no
                    // structural change to ask about. The lyrics can still need rebuilding — the
                    // lines per slide and line length settings change how the same words are
                    // split — so only a song that already matches exactly is left alone.
                    const layoutMap = matchArrangements(localShow, providerShow)
                    if (layoutMap) {
                        if (hasSameSlideContent(localShow, providerShow, layoutMap)) return { action: "skip", layoutMap }

                        return { action: songOrigin === "local" ? "local" : "replace" }
                    }

                    const choice = await chooseCustom(`<b>${existingName}</b> has a different structure at ${providerLabel}.<br><br>What would you like to do?`, [
                        { value: "merge", label: `Add the ${providerLabel} version as a new arrangement`, icon: "add" },
                        { value: "replace", label: `Replace the local song with the ${providerLabel} version`, icon: "cloud_sync" },
                        { value: "local", label: "Keep the local song unchanged", icon: "close" }
                    ])

                    // dismissing the popup must not change the local song
                    return { action: (choice as "local" | "replace" | "merge") || "local" }
                }
            }

            if (songOrigin === "local") return { action: "local" }
            if (songOrigin === "online") return { action: "replace" }

            return { action: (await confirmCustom(prompt)) ? "local" : "replace" }
        }

        // CREATE SHOWS
        const tempShows: { id: string; show: Show }[] = []
        for (const show of data.shows) {
            const id = show.id

            // if empty content and name is a scripture reference, generate slides from the active scripture
            const isEmptyContent = Object.keys(show.slides || {}).length === 0
            if (isEmptyContent) {
                const scriptureShow = await generateScriptureShowFromReference(show.name)
                if (scriptureShow) {
                    const originalId = show.id
                    const originalQuickAccess = show.quickAccess
                    Object.assign(show, scriptureShow)
                    show.id = originalId
                    if (originalQuickAccess) show.quickAccess = originalQuickAccess
                }
            }

            const providerName = data.providerId === "planningcenter" ? "Planning Center" : data.providerId === "churchApps" ? "ChurchApps" : data.providerId === "onstage" ? "OnStage" : "the cloud"

            // first find any shows linked to the id
            const linkedShow = linkKey && allShows.find(({ quickAccess, id: showId }) => quickAccess?.[linkKey] === id || showId === id)
            if (linkedShow) {
                replaceIds[id] = linkedShow.id

                const { action, layoutMap } = await resolveExistingShow(linkedShow.id, linkedShow.name, show, `This show already exists: ${linkedShow.name}.<br><br>Would you like to use the local version instead of the one from ${providerName}?`, providerName)

                if (action === "skip") {
                    mapLayouts(layoutMap || {})
                    continue
                }
                if (action === "local") {
                    dropLayouts(show)
                    continue
                }

                // replace local show with provider song
                applyGlobalGroups(show)

                if (action === "merge") {
                    const localShow = get(showsCache)[linkedShow.id]
                    if (localShow) {
                        const merged = mergeAsNewArrangement(localShow, show, providerName)
                        mapLayouts(merged.layoutMap)

                        tempShows.push({ id: linkedShow.id, show: { ...merged.show, origin, name: checkName(merged.show.name, linkedShow.id) } })
                        continue
                    }
                }

                // set modified to now, so it will update properly in history
                if (show.timestamps) show.timestamps.modified = Date.now()

                delete show.id
                tempShows.push({ id: linkedShow.id, show: { ...show, origin, name: checkName(show.name, linkedShow.id) } })
                continue
            }

            // find existing show with same name and ask to replace
            const showName = show?.name?.toLowerCase() || ""
            const existingShow = allShows.find(({ id: existingId, name }) => existingId !== id && name?.toLowerCase() === showName)
            // const existingShowHasContent = existingShow && (await loadShows([existingShow.id])) && getSlidesText(get(showsCache)[existingShow.id].slides)
            if (existingShow && (songOrigin !== "online" || askArrangement || onlyAddNew) && !data.forceReplace) {
                const { action, layoutMap } = await resolveExistingShow(existingShow.id, existingShow.name, show, `There is an existing show with the same name: ${existingShow.name}.<br><br>Would you like to use the local version instead of the one from ${providerName}?`, providerName)

                if (action === "local") {
                    replaceIds[id] = existingShow.id
                    dropLayouts(show)
                    updateExistingShow(existingShow.id)
                    continue
                }

                // the local song already holds these arrangements — link it so it stops being asked about
                if (action === "skip") {
                    replaceIds[id] = existingShow.id
                    mapLayouts(layoutMap || {})
                    updateExistingShow(existingShow.id, id)
                    continue
                }

                if (action === "merge") {
                    const localShow = get(showsCache)[existingShow.id]
                    if (localShow) {
                        replaceIds[id] = existingShow.id
                        applyGlobalGroups(show)

                        const merged = mergeAsNewArrangement(localShow, show, providerName)
                        mapLayouts(merged.layoutMap)

                        if (linkKey) {
                            if (!merged.show.quickAccess) merged.show.quickAccess = {}
                            merged.show.quickAccess[linkKey] = id
                        }

                        tempShows.push({ id: existingShow.id, show: { ...merged.show, origin, name: checkName(merged.show.name, existingShow.id) } })
                        continue
                    }
                }
            }

            const targetId = existingShow?.id || id
            replaceIds[id] = targetId

            if ((existingShow && songOrigin !== "local") || songOrigin === "online" || data.forceReplace) {
                // set link so we will automatically update from the provider in the future
                if (!show.quickAccess) show.quickAccess = {}
                show.quickAccess[linkKey] = id
            }

            // download:

            // replace group names with existing global groups
            Object.values<Slide>(show.slides).forEach((slide) => {
                if (slide.globalGroup || !slide.group) return

                const globalGroup = getGlobalGroup(slide.group)
                if (globalGroup) slide.globalGroup = globalGroup
            })

            if (show.timestamps) show.timestamps.modified = Date.now()

            delete show.id
            tempShows.push({ id: targetId, show: { ...show, origin, name: checkName(show.name, targetId) } })
        }
        setTempShows(tempShows)

        function createProviderProject(providerId: ContentProviderId, projectBase: Project) {
            const templateId = get(contentProviderData)[providerId]?.projectTemplate || ""
            if (!templateId) return projectBase

            let templateItems = clone(get(projectTemplates)[templateId]?.shows || [])
            let pcoItems = clone(projectBase.shows || [])

            // project template first, then append the synced items (first to any placeholders, then to the end)
            templateItems = templateItems.map((item) => {
                if (item.type === "show_placeholder") {
                    const show = pcoItems.shift()
                    if (show) return show
                }

                return item
            })

            projectBase.shows = [...templateItems, ...pcoItems]
            return projectBase
        }

        data.projects.forEach((currentProject) => {
            // CREATE PROJECT FOLDER
            const folderId = currentProject.folderId
            if (folderId && (!get(folders)[folderId] || get(folders)[folderId].deleted)) {
                history({ id: "UPDATE", newData: { replace: { parent: "/", name: currentProject.folderName } }, oldData: { id: folderId }, location: { page: "show", id: "project_folder" } })
            }

            // CREATE PROJECT
            const projectBase: Project = {
                name: currentProject.name,
                created: currentProject.created,
                used: Date.now(), // show on top in last used list
                parent: folderId || "/",
                shows: currentProject.items || []
            }
            const project = createProviderProject(data.providerId, projectBase)

            // REPLACE IDS
            project.shows = project.shows.map((a) => {
                const item = { ...a, id: replaceIds[a.id] || a.id }

                // the provider arrangement this item points at may have become a local one
                const mappedLayout = item.layout ? layoutReplaceIds[item.layout] : undefined
                if (mappedLayout !== undefined) {
                    if (mappedLayout) item.layout = mappedLayout
                    else delete item.layout
                }

                return item
            })

            const projectId = currentProject.id
            history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        })

        // open closest to today
        const nextProjectId = data.projects.sort((a, b) => a.scheduledTo - b.scheduledTo)[0]?.id
        if (nextProjectId) {
            activeProject.set(nextProjectId)
            projectView.set(false)
        }

        // store available PCO plans for Live timer setup
        if (data.providerId === "planningcenter" && data.pcoPlans?.length) {
            contentProviderData.update((a) => {
                if (!a.planningcenter) a.planningcenter = {}
                const existing = a.planningcenter.availablePlans || []
                a.planningcenter.availablePlans = [...existing.filter((e) => !data.pcoPlans!.some((i) => i.planId === e.planId)), ...data.pcoPlans!]
                return a
            })
        }
    },
    [ToMain.OPEN_FOLDER2]: (a) => {
        const receiveFOLDER = {
            MEDIA: () => addDrawerFolder(a, "media"), // menuClick
            AUDIO: () => addDrawerFolder(a, "audio") // menuClick
        }

        if (!receiveFOLDER[a.channel]) return
        receiveFOLDER[a.channel]()
    },
    [ToMain.IMPORT2]: (a) => {
        const mainData = a.data

        const receiveFilePathIMPORT = {
            // Media
            pdf: () => {
                const paths = mainData as string[]
                paths.forEach((path) => sendMain(Main.PDF_TO_IMAGE, { filePath: path }))

                // remove any PDFs with the same name from the Recommended project items list
                const importedNames = paths.map((p) => removeExtension(getFileName(p)).toLowerCase())
                recentFiles.update((a) => {
                    const toClear = a.all.filter((p) => getExtension(p) === "pdf" && importedNames.includes(removeExtension(getFileName(p)).toLowerCase()))
                    if (toClear.length) a.cleared = [...a.cleared, ...toClear]
                    return a
                })
                updateRecentlyAddedFiles()
            },
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
            freeshow_action: () => importAction(data),
            freeshow_stage: () => importStage(data),
            // Text
            txt: () => convertTexts(data),
            chordpro: () => convertChordPro(data),
            csv: () => convertCSV(data),
            powerpoint: () => convertPowerpoint(data),
            word: () => convertTexts(data),
            // Other programs
            propresenter: () => convertProPresenter(data as { content: any; name: string; extension: string }[]),
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
    },
    // Timecode
    [Main.TIMECODE_VALUE]: (data) => updateTimelineTime(data!),
    [Main.TIMECODE_STATUS]: (data) => updateTimelineStatus(data!),
    [Main.TIMECODE_AUDIO_DATA]: (data) => processTimecodeFrame(data!),

    // AI
    [ToMain.AI_STATUS]: (data) => aiSttStatus.set(data),
    [ToMain.AI_TRANSCRIPT]: (data) => Transcript.push(data)
}
