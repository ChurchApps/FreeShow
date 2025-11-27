import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import type { Output } from "../../types/Output"
import type { Themes } from "../../types/Settings"
import { clone, keysToID } from "../components/helpers/array"
import { checkWindowCapture, setOutput, toggleOutputs } from "../components/helpers/output"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { sendMain } from "../IPC/main"
import {
    actionTags,
    actions,
    activePopup,
    activeProject,
    alertUpdates,
    audioChannelsData,
    audioFolders,
    audioPlaylists,
    audioStreams,
    autoOutput,
    autosave,
    calendarAddShow,
    categories,
    companion,
    contentProviderData,
    customMetadata,
    customizedIcons,
    dataPath,
    disabledServers,
    drawSettings,
    drawer,
    drawerTabsData,
    driveData,
    effects,
    effectsLibrary,
    emitters,
    eqPresets,
    equalizerConfig,
    formatNewShow,
    fullColors,
    gain,
    globalTags,
    groupNumbers,
    groups,
    labelsDisabled,
    language,
    loaded,
    loadedState,
    lockedOverlays,
    mediaFolders,
    mediaOptions,
    mediaTags,
    metronome,
    openedFolders,
    os,
    outLocked,
    overlayCategories,
    overlays,
    playerVideos,
    ports,
    profiles,
    projectView,
    remotePassword,
    resized,
    serverData,
    showRecentlyUsedProjects,
    showsPath,
    slidesOptions,
    sorted,
    special,
    styles,
    templateCategories,
    theme,
    themes,
    timeFormat,
    timers,
    triggers,
    variableTags,
    variables,
    version,
    videoMarkers,
    videosData,
    videosTime
} from "../stores"
import { OUTPUT } from "./../../types/Channels"
import type { SaveListSettings, SaveListSyncedSettings } from "./../../types/Save"
import { maxConnections, outputs, scriptureSettings, scriptures, splitLines, transitionData, volume } from "./../stores"
import { checkForUpdates } from "./checkForUpdates"
import { isMainWindow, startAutosave } from "./common"
import { setLanguage } from "./language"
import { send } from "./request"

export function updateSyncedSettings(data: any) {
    if (!data || !Object.keys(data).length) return

    Object.entries(data).forEach(([key, value]: any) => {
        if (updateList[key as SaveListSyncedSettings]) updateList[key as SaveListSyncedSettings](value)
        else console.info("RECEIVED UNKNOWN SETTINGS KEY:", key)
    })

    loadedState.set([...get(loadedState), "synced_settings"])
}

export function updateSettings(data: any) {
    // pre v0.8.2 (data contains SaveListSyncedSettings, but it gets overwritten and removed on first save)

    Object.entries(data).forEach(([key, value]: any) => {
        if (updateList[key as SaveListSettings]) updateList[key as SaveListSettings](value)
        else console.info("RECEIVED UNKNOWN SETTINGS KEY:", key)
    })

    if (!isMainWindow()) return

    // output
    if (data.outputs) {
        // wait until content is loaded
        setTimeout(
            () => {
                restartOutputs()
                if (get(autoOutput)) setTimeout(() => toggleOutputs(null, { autoStartup: true }), get(os).platform === "darwin" ? 1500 : 500)
                setTimeout(() => checkWindowCapture(true), get(os).platform === "darwin" ? 2000 : 1000)
            },
            get(os).platform === "darwin" ? 2500 : 1500
        )
    }

    // remote
    const disabled = data.disabledServers || {}
    if (disabled.remote === undefined) disabled.remote = false
    if (disabled.stage === undefined) disabled.stage = false
    const customPorts: { [key: string]: number } = data.ports || { remote: 5510, stage: 5511 }
    sendMain(Main.START, { ports: customPorts, max: data.maxConnections === undefined ? 10 : data.maxConnections, disabled, data: get(serverData) })

    // theme
    let currentTheme = get(themes)[data.theme]
    if (currentTheme) {
        // update colors (pre 0.9.2 or 1.4.9)
        const pre092 = currentTheme.colors.secondary?.toLowerCase() === "#e6349c"
        const pre149 = currentTheme.colors.primary?.toLowerCase() === "#292c36"
        if (data.theme === "default" && (pre092 || pre149)) {
            themes.update(a => {
                a.default = clone(defaultThemes.default)
                currentTheme = a.default
                return a
            })
        }

        updateThemeValues(currentTheme)
    }

    // load all shows
    // loadShows(Object.keys(get(shows)))

    loaded.set(true)

    window.api.send("LOADED")
}

let videoDataUpdating = false
export function restartOutputs(specificId = "") {
    const data = clone(videosData)
    const time = clone(videosTime)

    const allOutputs = keysToID(get(outputs))
    const outputIds = specificId ? [specificId] : allOutputs.filter(a => a.enabled).map(({ id }) => id)

    outputIds.forEach((id: string) => {
        const output: Output = get(outputs)[id]
        if (!output) return

        // , rate: get(special).previewRate || "auto"
        send(OUTPUT, ["CREATE"], { ...output, id })
    })

    if (videoDataUpdating) return
    videoDataUpdating = true

    // restore output video data when recreating window
    // WIP values are empty when sent
    setTimeout(() => {
        send(OUTPUT, ["DATA"], data)
        send(OUTPUT, ["TIME"], time)
        videoDataUpdating = false
    }, 2200)
}

export function updateThemeValues(themeValues: Themes) {
    if (!themeValues) return

    Object.entries(themeValues.colors).forEach(([key, value]) => document.documentElement.style.setProperty("--" + key, value))
    Object.entries(themeValues.font).forEach(([key, value]) => {
        if (key === "family" && (!value || value === "sans-serif")) value = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif'
        document.documentElement.style.setProperty("--font-" + key, value)
    })

    // // border radius
    // if (!themeValues.border) themeValues.border = {}
    // // set to 0 if nothing is set
    // if (themeValues.border?.radius === undefined) themeValues.border.radius = "0"
    // Object.entries(themeValues.border).forEach(([key, value]) => document.documentElement.style.setProperty("--border-" + key, value))
}

const updateList: { [key in SaveListSettings | SaveListSyncedSettings]: any } = {
    initialized: (v: any) => {
        if (!v) {
            // FIRST TIME USER
            activePopup.set("initialize")
        }
    },
    activeProject: (v: any) => {
        activeProject.set(v)
        if (v) projectView.set(false)
    },
    showsPath: (v: any) => {
        if (!v) return

        // DEPRECATED (keep for backward compatibility)
        showsPath.set(v)
    },
    dataPath: (v: any) => {
        if (!v) return

        // DEPRECATED (keep for backward compatibility)
        dataPath.set(v)
    },
    lockedOverlays: (v: any) => {
        // only get locked overlays
        v = v.filter(id => get(overlays)[id]?.locked === true)

        lockedOverlays.set(v)

        // start overlays
        if (v.length) setOutput("overlays", v, false, "", true)
    },
    language: (v: any) => {
        language.set(v)
        setLanguage(v)
    },
    alertUpdates: (v: any) => {
        alertUpdates.set(v !== false)
        // make sure "special" is set before checking
        setTimeout(() => checkForUpdates(get(version)), 50)
    },
    autoOutput: (v: any) => autoOutput.set(v),
    maxConnections: (v: any) => maxConnections.set(v),
    ports: (v: any) => ports.set(v),
    disabledServers: (v: any) => disabledServers.set(v),
    serverData: (v: any) => serverData.set(v),
    autosave: (v: any) => {
        autosave.set(v)
        startAutosave()
    },
    timeFormat: (v: any) => timeFormat.set(v),
    outputs: (v: any) => {
        Object.keys(v).forEach((id: string) => {
            delete v[id].out
        })
        outputs.set(v)
    },
    sorted: (v: any) => sorted.set(v),
    styles: (v: any) => styles.set(v),
    profiles: (v: any) => profiles.set(v),
    remotePassword: (v: any) => remotePassword.set(v),
    audioFolders: (v: any) => audioFolders.set(v),
    categories: (v: any) => categories.set(v),
    drawer: (v: any) => drawer.set(v),
    drawerTabsData: (v: any) => drawerTabsData.set(v),
    drawSettings: (v: any) => drawSettings.set(v),
    groupNumbers: (v: any) => groupNumbers.set(v),
    fullColors: (v: any) => fullColors.set(v),
    formatNewShow: (v: any) => formatNewShow.set(v),
    groups: (v: any) => groups.set(v),
    labelsDisabled: (v: any) => labelsDisabled.set(v),
    mediaFolders: (v: any) => mediaFolders.set(v),
    mediaOptions: (v: any) => mediaOptions.set(v),
    openedFolders: (v: any) => openedFolders.set(v),
    outLocked: (v: any) => outLocked.set(v),
    overlayCategories: (v: any) => overlayCategories.set(v),
    playerVideos: (v: any) => playerVideos.set(v),
    resized: (v: any) => resized.set(v),
    scriptures: (v: any) => scriptures.set(v),
    scriptureSettings: (v: any) => scriptureSettings.set(v),
    slidesOptions: (v: any) => slidesOptions.set(v),
    splitLines: (v: any) => splitLines.set(v),
    templateCategories: (v: any) => templateCategories.set(v),
    timers: (v: any) => timers.set(v),
    variables: (v: any) => variables.set(v),
    triggers: (v: any) => triggers.set(v),
    audioStreams: (v: any) => audioStreams.set(v),
    audioPlaylists: (v: any) => audioPlaylists.set(v),
    theme: (v: any) => theme.set(v),
    transitionData: (v: any) => transitionData.set(v),
    volume: (v: any) => volume.set(v),
    gain: (v: any) => gain.set(v),
    audioChannelsData: (v: any) => audioChannelsData.set(v),
    emitters: (v: any) => emitters.set(v),
    midiIn: (v: any) => actions.set(v),
    videoMarkers: (v: any) => videoMarkers.set(v),
    mediaTags: (v: any) => mediaTags.set(v),
    actionTags: (v: any) => actionTags.set(v),
    variableTags: (v: any) => variableTags.set(v),
    customizedIcons: (v: any) => customizedIcons.set(v),
    driveData: (v: any) => driveData.set(v),
    calendarAddShow: (v: any) => calendarAddShow.set(v),
    metronome: (v: any) => metronome.set(v),
    equalizerConfig: (v: any) => equalizerConfig.set(v),
    eqPresets: (v: any) => eqPresets.set(v),
    effectsLibrary: (v: any) => effectsLibrary.set(v),
    globalTags: (v: any) => globalTags.set(v),
    customMetadata: (v: any) => customMetadata.set(v),
    companion: (v: any) => {
        companion.set(v)

        if (v.enabled) {
            setTimeout(() => {
                sendMain(Main.WEBSOCKET_START, get(ports).companion)
            }, 3000)
        }
    },
    special: (v: any) => {
        if (v.capitalize_words === undefined) v.capitalize_words = "Jesus, Lord" // God
        if (v.autoUpdates) sendMain(Main.AUTO_UPDATE)
        // don't backup when just initialized (or reset)
        if (!v.autoBackupPrevious) v.autoBackupPrevious = Date.now()
        if (v.startupProjectsList) {
            // skip the "Recently used" list, and open "all projects"
            // let "activeProject" setting update first
            setTimeout(() => projectView.set(true))
            showRecentlyUsedProjects.set(false)
        }

        // DEPRECATED (migrate)
        if (v.pcoLocalAlways) {
            contentProviderData.update(a => ({ ...a, planningcenter: { localAlways: true } }))
            delete v.pcoLocalAlways
        }

        // DEPRECATED (migrate)
        v.customUserDataLocation = true

        special.set(v)
    },
    // @ts-ignore - DEPERACTED (migrate)
    chumsSyncCategories: (v: any) => {
        if (v?.length > 1) contentProviderData.set({ ...get(contentProviderData), churchApps: { syncCategories: v } })
    },
    contentProviderData: (v: any) => contentProviderData.set(v),
    effects: (a: any) => effects.set(a)
}
