// ----- FreeShow -----
// Browser-only behavior guards. Electron doesn't show a native context menu, has
// no browser save/open/print shortcuts, and handles window close via its own flow
// — so these are only needed for the web build. Installed once from main.ts when
// running in a browser (VITE_TARGET === "web"). Keeping them here avoids scattering
// web-vs-desktop conditionals through feature code.

import { get } from "svelte/store"
import { saved } from "../stores"

// browser shortcuts that would trigger browser UI and clash with FreeShow's own handling
const SUPPRESSED_CTRL_KEYS = new Set(["s", "o", "p"])

export function installBrowserGuards() {
    // 1. suppress the native context menu (FreeShow renders its own)
    window.addEventListener("contextmenu", (e) => e.preventDefault())

    // 2. stop the browser acting on Ctrl/Cmd+S (save page), +O (open), +P (print);
    //    FreeShow's own keydown handler still runs and performs its action.
    window.addEventListener(
        "keydown",
        (e) => {
            if (!(e.metaKey || e.ctrlKey) || e.altKey) return
            if (SUPPRESSED_CTRL_KEYS.has(e.key.toLowerCase())) e.preventDefault()
        },
        { capture: true }
    )

    // 3. warn before closing/reloading the tab with unsaved changes
    window.addEventListener("beforeunload", (e) => {
        if (get(saved)) return
        e.preventDefault()
        e.returnValue = "" // required for the browser to show its confirmation prompt
    })
}
