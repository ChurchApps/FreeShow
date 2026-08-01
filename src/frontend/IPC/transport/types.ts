// ----- FreeShow -----
// Pluggable transport for the renderer <-> backend boundary.
//
// The entire surface the frontend uses to talk to a backend is `window.api`
// (see src/electron/preload.ts). By making that object pluggable we can run the
// exact same frontend under Electron IPC (desktop) or a Socket.IO connection
// (browser / remote desktop client) without changing any feature code.
//
// FreeShowApi is derived from the global `Window["api"]` declaration
// (src/frontend/global.d.ts) so any adapter is guaranteed to be assignable to
// `window.api`.

export type FreeShowApi = Window["api"]
