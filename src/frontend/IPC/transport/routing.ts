// ----- FreeShow -----
// HYBRID TRANSPORT ROUTING — the single source of truth for which IPC channels a
// remote-connected DESKTOP client sends to the REMOTE server vs its LOCAL Electron
// main. (Web clients don't use this — they are pure remote; desktop-local clients
// are pure IPC. Only a desktop connected to a server uses the hybrid.)
//
// PRINCIPLE:
//   REMOTE (server) = the shared, co-edited library CONTENT:
//       shows, scripture, and the "portable" resource stores
//       (projects / overlays / templates / events / stage / themes / synced settings).
//   LOCAL  (this machine's Electron main) = everything machine-specific or hardware:
//       presentation / output windows, NDI / Blackmagic / audio, screen & slide capture,
//       MIDI, the RemoteShow/StageShow servers this machine hosts, the file system,
//       machine settings (outputs, ports, screens), and local caches.
//
// Rule of thumb when adding a NEW Main channel:
//   - Does it read/write SHARED library content that other editors should see? -> REMOTE.
//   - Does it touch this machine's hardware, windows, files, or local config?  -> LOCAL.
// When unsure, leave it LOCAL (safe: behaves exactly like the desktop app does today).

import type { ValidChannels } from "../../../types/Channels"

export type Route = "local" | "remote"

// ---- transport-level (ValidChannels) ----

// Transport channels that ALWAYS go to the remote server.
export const REMOTE_TRANSPORTS: ValidChannels[] = [
    "YJS" // real-time show co-editing
]

// Transport channels that ALWAYS stay local (documented for clarity; anything not
// listed as remote is treated as local by default).
export const LOCAL_TRANSPORTS: ValidChannels[] = [
    "OUTPUT", // output windows (present)
    "NDI",
    "BLACKMAGIC",
    "AUDIO",
    "EXPORT", // writes files on this machine
    "CLOUD", // this machine's own cloud sync
    "REMOTE", // RemoteShow server hosted by this machine
    "STAGE", // StageShow server hosted by this machine
    "CONTROLLER",
    "OUTPUT_STREAM",
    "STARTUP" // window type + capabilities come from the local main (keeps full desktop capabilities)
]

// ---- MAIN sub-channels (Main enum values) that go to the remote server ----
// (Everything else sent over MAIN stays local.)
export const REMOTE_MAIN_CHANNELS: ReadonlySet<string> = new Set([
    // shows
    "SHOW",
    "SHOWS",
    "FULL_SHOWS_LIST",
    "DELETE_SHOWS",
    "DELETE_SHOWS_NI",
    "REFRESH_SHOWS",
    "GET_EMPTY_SHOWS",
    // scripture
    "BIBLE",
    "READ_BIBLES_FOLDER",
    // browsing / creating the server's media/audio folders
    "READ_FOLDER",
    "CREATE_FOLDER",
    // shared library stores (reusable content: overlays, templates, projects, ...)
    "SYNCED_SETTINGS",
    "PROJECTS",
    "OVERLAYS",
    "TEMPLATES",
    "EVENTS",
    "THEMES",
    "MEDIA" // media LIBRARY metadata (the file bytes are a separate concern, see MEDIA FILES note)
    // NOTE: STAGE (stage-display layouts) is intentionally NOT here — it references
    // machine-specific outputs, so it stays LOCAL on a desktop client (like SETTINGS).
    // NOTE: the batched SAVE channel carries BOTH resource and machine stores, so it is
    // split across both sides (see REMOTE_SAVE_KEYS / hybridTransport.ts) rather than
    // being routed wholesale here.
    //
    // MEDIA FILES (future): media/audio referenced by the library live on the server.
    // The MEDIA store above is only metadata; actual bytes need a server-served virtual
    // filesystem (HTTP /media gateway) with local caching. Until that exists, library
    // media won't resolve on a remote desktop client (text/overlays/templates do).
])

// keys of the batched SaveData that belong to the REMOTE (resource) save;
// every other SaveData key is persisted LOCALLY. Control flags are sent to both.
export const REMOTE_SAVE_KEYS: readonly string[] = ["showsCache", "SHOWS", "deletedShows", "renamedShows", "scripturesCache", "SYNCED_SETTINGS", "PROJECTS", "OVERLAYS", "TEMPLATES", "EVENTS", "THEMES", "MEDIA"]

/** Decide where a message goes. `subChannel` is the Main enum value for MAIN messages. */
export function routeChannel(channel: string, subChannel?: string): Route {
    if (REMOTE_TRANSPORTS.includes(channel as ValidChannels)) return "remote"
    if (channel === "MAIN") return REMOTE_MAIN_CHANNELS.has(subChannel ?? "") ? "remote" : "local"
    return "local"
}
