import { get } from "svelte/store"
import { MAIN } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import type { Output } from "../../types/Output"
import { clone, keysToID } from "../components/helpers/array"
import { checkWindowCapture, displayOutputs, setOutput } from "../components/helpers/output"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { sendMain } from "../IPC/main"
import {
    actionTags,
    activePopup,
    activeProject,
    alertUpdates,
    audioFolders,
    audioPlaylists,
    audioStreams,
    autoOutput,
    autosave,
    calendarAddShow,
    categories,
    companion,
    customMetadata,
    customizedIcons,
    dataPath,
    disabledServers,
    drawSettings,
    drawer,
    drawerTabsData,
    driveData,
    effectsLibrary,
    emitters,
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
    midiIn,
    openedFolders,
    outLocked,
    overlayCategories,
    overlays,
    playerVideos,
    ports,
    projectView,
    remotePassword,
    resized,
    serverData,
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
    variables,
    version,
    videoMarkers,
    videosData,
    videosTime,
} from "../stores"
import { OUTPUT } from "./../../types/Channels"
import type { SaveListSettings, SaveListSyncedSettings } from "./../../types/Save"
import { currentWindow, maxConnections, outputs, scriptureSettings, scriptures, splitLines, transitionData, volume } from "./../stores"
import { checkForUpdates } from "./checkForUpdates"
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

    if (get(currentWindow)) return

    // output
    if (data.outputs) {
        let outputsList: Output[] = keysToID(data.outputs)

        // get active "ghost" key outputs
        let activeKeyOutputs: string[] = []
        outputsList.forEach((output) => {
            if (output.keyOutput && !output.isKeyOutput) activeKeyOutputs.push(output.id!)
        })

        // remove "ghost" key outputs (they were not removed in versions pre 0.9.6)
        let allOutputs = get(outputs)
        let outputsUpdated: boolean = false
        Object.keys(allOutputs).forEach((outputId) => {
            let output = allOutputs[outputId]
            if (!output.isKeyOutput || activeKeyOutputs.includes(outputId)) return

            delete allOutputs[outputId]
            outputsUpdated = true
        })
        if (outputsUpdated) outputs.set(allOutputs)

        // wait until content is loaded
        setTimeout(() => {
            restartOutputs()
            if (get(autoOutput)) setTimeout(() => displayOutputs({}, true), 500)
            setTimeout(() => checkWindowCapture(true), 1000)
        }, 1500)
    }

    // remote
    let disabled = data.disabledServers || {}
    if (disabled.remote === undefined) disabled.remote = false
    if (disabled.stage === undefined) disabled.stage = false
    send(MAIN, ["START"], { ports: data.ports || { remote: 5510, stage: 5511 }, max: data.maxConnections === undefined ? 10 : data.maxConnections, disabled, data: get(serverData) })

    // theme
    let currentTheme = get(themes)[data.theme]
    if (currentTheme) {
        // update colors (upgrading from < v0.9.2)
        if (data.theme === "default" && currentTheme.colors.secondary?.toLowerCase() === "#e6349c") {
            themes.update((a) => {
                a.default = clone(defaultThemes.default)
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

let videoDataUpdating: boolean = false
export function restartOutputs(id: string = "") {
    let data = clone(videosData)
    let time = clone(videosTime)

    let allOutputs = keysToID(get(outputs))
    let outputIds = id ? [id] : allOutputs.filter((a) => a.enabled).map(({ id }) => id)

    outputIds.forEach((id: string) => {
        let output: Output = get(outputs)[id]
        if (!output) return

        // key output styling
        if (output.isKeyOutput) {
            let parentOutput = allOutputs.find((a) => a.keyOutput === id)
            if (parentOutput) output = { ...parentOutput, ...output, id }
        }

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

export function updateThemeValues(themes: any) {
    if (!themes) return

    Object.entries(themes.colors).forEach(([key, value]: any) => document.documentElement.style.setProperty("--" + key, value))
    Object.entries(themes.font).forEach(([key, value]: any) => {
        if (key === "family" && (!value || value === "sans-serif")) value = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif'
        document.documentElement.style.setProperty("--font-" + key, value)
    })

    // border radius
    if (!themes.border) themes.border = {}
    // set to 0 if nothing is set
    if (themes.border?.radius === undefined) themes.border.radius = "0"
    Object.entries(themes.border).forEach(([key, value]: any) => document.documentElement.style.setProperty("--border-" + key, value))
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
        if (!v) send(MAIN, ["SHOWS_PATH"])
        else showsPath.set(v)

        // LOAD SHOWS FROM FOLDER
        sendMain(Main.SHOWS, { showsPath: v })
    },
    dataPath: (v: any) => {
        if (!v) send(MAIN, ["DATA_PATH"])
        else dataPath.set(v)
    },
    lockedOverlays: (v: any) => {
        // only get locked overlays
        v = v.filter((id) => get(overlays)[id]?.locked === true)

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
        checkForUpdates(get(version))
    },
    autoOutput: (v: any) => autoOutput.set(v),
    maxConnections: (v: any) => maxConnections.set(v),
    ports: (v: any) => ports.set(v),
    disabledServers: (v: any) => disabledServers.set(v),
    serverData: (v: any) => serverData.set(v),
    autosave: (v: any) => autosave.set(v),
    timeFormat: (v: any) => timeFormat.set(v),
    outputs: (v: any) => {
        Object.keys(v).forEach((id: string) => {
            delete v[id].out
        })
        outputs.set(v)
    },
    sorted: (v: any) => sorted.set(v),
    styles: (v: any) => styles.set(v),
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
    emitters: (v: any) => emitters.set(v),
    midiIn: (v: any) => midiIn.set(v),
    videoMarkers: (v: any) => videoMarkers.set(v),
    mediaTags: (v: any) => mediaTags.set(v),
    actionTags: (v: any) => actionTags.set(v),
    customizedIcons: (v: any) => customizedIcons.set(v),
    driveData: (v: any) => driveData.set(v),
    calendarAddShow: (v: any) => calendarAddShow.set(v),
    metronome: (v: any) => metronome.set(v),
    effectsLibrary: (v: any) => effectsLibrary.set(v),
    globalTags: (v: any) => globalTags.set(v),
    customMetadata: (v: any) => customMetadata.set(v),
    companion: (v: any) => {
        companion.set(v)

        if (v.enabled) {
            setTimeout(() => {
                send(MAIN, ["WEBSOCKET_START"], get(ports).companion)
            }, 3000)
        }
    },
    special: (v: any) => {
        if (v.capitalize_words === undefined) v.capitalize_words = "Jesus, Lord" // God
        if (v.autoUpdates !== false) send(MAIN, ["AUTO_UPDATE"])
        special.set(v)
    },
}
