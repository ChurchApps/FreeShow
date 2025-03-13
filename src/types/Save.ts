import type { Bible } from "./Bible"
import type { Event } from "./Calendar"
import type { Media } from "./Main"
import type { Folders, Projects } from "./Projects"
import type { Themes } from "./Settings"
import type { Overlays, Shows, Templates } from "./Show"
import type { StageLayouts } from "./Stage"

export type SaveList = SaveListSettings | SaveListSyncedSettings | "themes" | "events" | "templates" | "overlays" | "driveKeys"

export type SaveListSyncedSettings =
    | "categories"
    | "drawSettings"
    | "overlayCategories"
    | "templateCategories"
    | "timers"
    | "variables"
    | "triggers"
    | "audioStreams"
    | "audioPlaylists"
    | "scriptures"
    | "scriptureSettings"
    | "groups"
    | "midiIn"
    | "emitters"
    | "playerVideos"
    | "videoMarkers"
    | "mediaTags"
    | "actionTags"
    | "customizedIcons"
    | "companion"
    | "globalTags"
    | "customMetadata"

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
    | "styles"
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
    | "driveData"
    | "calendarAddShow"
    | "metronome"
    | "effectsLibrary"
    | "special"

export interface SaveData {
    path: string
    dataPath: string
    // SETTINGS
    SETTINGS: { [key in SaveListSettings]: any }
    SYNCED_SETTINGS: { [key in SaveListSyncedSettings]: any }
    // SHOWS
    SHOWS: any
    STAGE_SHOWS: StageLayouts
    // STORES
    PROJECTS: { projects: Projects; folders: Folders; projectTemplates: Projects }
    OVERLAYS: Overlays
    TEMPLATES: Templates
    EVENTS: { [key: string]: Event }
    MEDIA: Media
    THEMES: { [key: string]: Themes }
    DRIVE_API_KEY: any
    // CACHES SAVED TO MULTIPLE FILES
    showsCache: Shows
    scripturesCache: { [key: string]: Bible }
    deletedShows: any[]
    renamedShows: any[]
    // CACHES
    CACHE: { text: any }
    HISTORY: { undo: any[]; redo: any[] } // History
    USAGE: any
    // SAVE INFO DATA
    closeWhenFinished: boolean
    customTriggers: SaveActions
}
export type SaveActions = { backup?: boolean; silent?: boolean; changeUserData?: any; autosave?: boolean }
