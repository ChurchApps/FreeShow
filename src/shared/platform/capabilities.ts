// ----- FreeShow -----
// Capability flags: the single source of truth for which platform-specific
// features are available to a client. The backend advertises a CapabilitySet
// at the STARTUP handshake; the frontend hides/disables features that aren't
// available instead of scattering desktop/web conditionals across the codebase.

export interface CapabilitySet {
    /** External output windows (OutputHelper / BrowserWindow). */
    outputWindows: boolean
    /** NDI video I/O. */
    ndi: boolean
    /** Blackmagic (DeckLink) video I/O. */
    blackmagic: boolean
    /** Screen / window / camera capture (desktopCapturer, screen). */
    screenCapture: boolean
    /** MIDI input/output. */
    midi: boolean
    /** Native OS open/save dialogs. */
    nativeDialogs: boolean
    /** Direct local filesystem access (file:// URLs, drag-from-disk, showFilePath). */
    localFiles: boolean
    /** Controlling external presentation apps (PowerPoint/Keynote/LibreOffice). */
    presentationControl: boolean
    /** Local Spotify control. */
    spotify: boolean
    /** Native window controls (minimize/maximize/close/fullscreen). */
    windowControls: boolean
    /** Hosting the RemoteShow/StageShow/etc. servers. */
    servers: boolean
}

/** Full desktop capabilities — everything available. Also the frontend default so desktop is unchanged. */
export const ELECTRON_CAPABILITIES: CapabilitySet = {
    outputWindows: true,
    ndi: true,
    blackmagic: true,
    screenCapture: true,
    midi: true,
    nativeDialogs: true,
    localFiles: true,
    presentationControl: true,
    spotify: true,
    windowControls: true,
    servers: true
}

/** Headless/browser capabilities — hardware, native windows/dialogs and local files are unavailable. */
export const HEADLESS_CAPABILITIES: CapabilitySet = {
    outputWindows: false,
    ndi: false,
    blackmagic: false,
    screenCapture: false,
    midi: false,
    nativeDialogs: false,
    localFiles: false,
    presentationControl: false,
    spotify: false,
    windowControls: false,
    servers: false
}
