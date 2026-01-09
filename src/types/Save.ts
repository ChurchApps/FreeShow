import type { Bible } from "json-bible/lib/Bible"
import type { Event } from "./Calendar"
import type { History, HistoryNew } from "./History"
import type { Media } from "./Main"
import type { Folders, Projects } from "./Projects"
import type { Themes } from "./Settings"
import type { Overlays, Shows, Templates, TrimmedShows } from "./Show"
import type { StageLayouts } from "./Stage"

export type SaveList = SaveListSettings | SaveListSyncedSettings | "themes" | "events" | "templates" | "overlays" | "driveKeys"

export type SaveListSyncedSettings = "categories" | "drawSettings" | "overlayCategories" | "templateCategories" | "styles" | "profiles" | "timers" | "variables" | "triggers" | "audioStreams" | "audioPlaylists" | "scriptures" | "scriptureSettings" | "groups" | "midiIn" | "emitters" | "playerVideos" | "videoMarkers" | "mediaTags" | "actionTags" | "variableTags" | "customizedIcons" | "companion" | "globalTags" | "customMetadata" | "effects"

export type SaveListSettings =
    | "initialized"
    | "activeProject"
    | "alertUpdates"
    | "audioFolders"
    | "autoOutput"
    | "autosave"
    | "timeFormat"
    | "showsPath"
    | "dataPath"
    | "lockedOverlays"
    | "drawer"
    | "drawerTabsData"
    | "groupNumbers"
    | "fullColors"
    | "formatNewShow"
    | "labelsDisabled"
    | "language"
    | "maxConnections"
    | "mediaFolders"
    | "mediaOptions"
    | "openedFolders"
    | "outputs"
    | "sorted"
    | "outLocked"
    | "ports"
    | "disabledServers"
    | "serverData"
    | "remotePassword"
    | "resized"
    | "slidesOptions"
    | "splitLines"
    | "theme"
    | "transitionData"
    | "volume"
    | "gain"
    | "audioChannelsData"
    | "cloudSyncData"
    | "driveData"
    | "calendarAddShow"
    | "metronome"
    | "equalizerConfig"
    | "eqPresets"
    | "effectsLibrary"
    | "special"
    | "contentProviderData"

export interface SaveData {
    // SETTINGS
    SETTINGS: { [key in SaveListSettings]: any } | {}
    SYNCED_SETTINGS: { [key in SaveListSyncedSettings]: any } | {}
    // SHOWS
    SHOWS: TrimmedShows
    STAGE: StageLayouts
    // STORES
    PROJECTS: { projects: Projects; folders: Folders; projectTemplates: Projects }
    OVERLAYS: Overlays
    TEMPLATES: Templates
    EVENTS: { [key: string]: Event }
    MEDIA: Media
    THEMES: { [key: string]: Themes }
    DRIVE_API_KEY: any
    // CACHES SAVED TO MULTIPLE FILES
    showsCache?: Shows
    scripturesCache?: { [key: string]: Bible }
    deletedShows?: { name: string; id: string }[]
    renamedShows?: { id: string; name: string; oldName: string }[]
    // CACHES
    CACHE: { text: any }
    HISTORY: { undo: (History | HistoryNew)[]; redo: (History | HistoryNew)[] }
    USAGE: any
    // SAVE INFO DATA
    closeWhenFinished: boolean
    customTriggers: SaveActions
}
export type SaveActions = { backup?: boolean; isAutoBackup?: boolean; backupShows?: boolean; autosave?: boolean; reset?: boolean }
