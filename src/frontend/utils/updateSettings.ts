import { get } from "svelte/store"
import { MAIN } from "../../types/Channels"
import { clone, convertObject } from "../components/helpers/array"
import { displayOutputs, setOutput } from "../components/helpers/output"
import {
    activePopup,
    activeProject,
    alertUpdates,
    audioFolders,
    autoOutput,
    autosave,
    calendarAddShow,
    categories,
    defaultProjectName,
    drawSettings,
    drawer,
    drawerTabsData,
    driveData,
    exportPath,
    formatNewShow,
    fullColors,
    groupNumbers,
    groups,
    imageExtensions,
    labelsDisabled,
    language,
    loaded,
    lockedOverlays,
    mediaFolders,
    mediaOptions,
    midiIn,
    openedFolders,
    os,
    outLocked,
    overlayCategories,
    overlays,
    playerVideos,
    ports,
    presenterControllerKeys,
    projectView,
    recordingPath,
    remotePassword,
    resized,
    scripturePath,
    showsPath,
    slidesOptions,
    styles,
    templateCategories,
    theme,
    themes,
    timeFormat,
    timers,
    videoExtensions,
    videoMarkers,
    webFavorites,
} from "../stores"
import { OUTPUT } from "./../../types/Channels"
import type { SaveListSettings, SaveListSyncedSettings } from "./../../types/Save"
import { currentWindow, maxConnections, outputs, scriptureSettings, scriptures, splitLines, transitionData, volume } from "./../stores"
import { setLanguage } from "./language"
import { send } from "./request"

export function updateSyncedSettings(data: any) {
    if (!data || !Object.keys(data).length) return

    Object.entries(data).forEach(([key, value]: any) => {
        if (updateList[key as SaveListSyncedSettings]) updateList[key as SaveListSyncedSettings](value)
        else console.log("MISSING: ", key)
    })
}

export function updateSettings(data: any) {
    // pre v0.8.2 (data contains SaveListSyncedSettings, but it gets overwritten and removed on first save)

    Object.entries(data).forEach(([key, value]: any) => {
        if (updateList[key as SaveListSettings]) updateList[key as SaveListSettings](value)
        else console.log("MISSING: ", key)
    })

    if (get(currentWindow)) return

    // output
    if (data.outputs) {
        convertObject(data.outputs).forEach((output: any) => {
            if (output.enabled) send(OUTPUT, ["CREATE"], output)
        })
    }
    // if (data.outputPosition) send(OUTPUT, ["POSITION"], data.outputPosition)
    // if (data.autoOutput) send(OUTPUT, ["DISPLAY"], { enabled: true, screen: data.outputScreen })

    // remote
    send(MAIN, ["START"], { ports: data.ports || { remote: 5510, stage: 5511 }, max: data.maxConnections === undefined ? 10 : data.maxConnections })

    // theme
    let currentTheme = get(themes)[data.theme]
    if (currentTheme) {
        // update color (upgrading from < v0.9.2)
        if (data.theme === "default" && currentTheme.colors.secondary?.toLowerCase() === "#e6349c") {
            let newTheme = clone(currentTheme)
            newTheme.colors.secondary = "#F0008C"
            newTheme.colors["secondary-opacity"] = "rgba(240, 0, 140, 0.5)"

            themes.update((a) => {
                a[data.theme] = newTheme
                return a
            })

            currentTheme = newTheme
        }

        updateThemeValues(currentTheme)
    }

    // load all shows
    // loadShows(Object.keys(get(shows)))

    loaded.set(true)

    setTimeout(() => {
        window.api.send("LOADED")
    }, 100)
}

export function updateThemeValues(themes: any) {
    Object.entries(themes.colors).forEach(([key, value]: any) => document.documentElement.style.setProperty("--" + key, value))
    Object.entries(themes.font).forEach(([key, value]: any) => {
        // || themeId === "default"
        if (key === "family" && (!value || value === "sans-serif")) value = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif'
        document.documentElement.style.setProperty("--font-" + key, value)
    })
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
    },
    exportPath: (v: any) => {
        if (!v) send(MAIN, ["EXPORT_PATH"])
        else exportPath.set(v)
    },
    scripturePath: (v: any) => {
        if (!v) send(MAIN, ["SCRIPTURE_PATH"])
        else scripturePath.set(v)
    },
    recordingPath: (v: any) => {
        if (!v) send(MAIN, ["RECORDING_PATH"])
        else recordingPath.set(v)
    },
    lockedOverlays: (v: any) => {
        // only get locked overlays
        v = v.filter((id) => get(overlays)[id]?.locked === true)

        lockedOverlays.set(v)

        // start overlays
        setOutput("overlays", v, false, null, true)
    },
    os: (v: any) => {
        if (!v.platform) send(MAIN, ["GET_OS"])
        os.set(v)
    },
    // TODO: get device lang
    language: (v: any) => {
        language.set(v)
        setLanguage(v)
    },
    // events: (v: any) => events.set(v),
    alertUpdates: (v: any) => alertUpdates.set(v === false ? false : true),
    autoOutput: (v: any) => {
        autoOutput.set(v)

        if (v) {
            setTimeout(() => {
                displayOutputs({}, true)
            }, 500)
        }
    },
    maxConnections: (v: any) => maxConnections.set(v),
    ports: (v: any) => ports.set(v),
    autosave: (v: any) => autosave.set(v),
    timeFormat: (v: any) => timeFormat.set(v),
    outputs: (v: any) => {
        Object.keys(v).forEach((id: string) => {
            delete v[id].out
        })
        outputs.set(v)
    },
    styles: (v: any) => styles.set(v),
    remotePassword: (v: any) => remotePassword.set(v),
    audioFolders: (v: any) => audioFolders.set(v),
    defaultProjectName: (v: any) => defaultProjectName.set(v),
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
    presenterControllerKeys: (v: any) => presenterControllerKeys.set(v),
    playerVideos: (v: any) => playerVideos.set(v),
    resized: (v: any) => resized.set(v),
    scriptures: (v: any) => scriptures.set(v),
    scriptureSettings: (v: any) => scriptureSettings.set(v),
    slidesOptions: (v: any) => slidesOptions.set(v),
    splitLines: (v: any) => splitLines.set(v),
    templateCategories: (v: any) => templateCategories.set(v),
    // templates: (v: any) => templates.set(v),
    timers: (v: any) => timers.set(v),
    theme: (v: any) => theme.set(v),
    transitionData: (v: any) => transitionData.set(v),
    // themes: (v: any) => themes.set(v),
    imageExtensions: (v: any) => {
        // set this in case it's not up to date with stores
        if (!v.includes("webp")) v.push("webp")
        imageExtensions.set(v)
    },
    videoExtensions: (v: any) => videoExtensions.set(v),
    webFavorites: (v: any) => webFavorites.set(v),
    volume: (v: any) => volume.set(v),
    midiIn: (v: any) => midiIn.set(v),
    videoMarkers: (v: any) => videoMarkers.set(v),
    driveData: (v: any) => driveData.set(v),
    calendarAddShow: (v: any) => calendarAddShow.set(v),
}
