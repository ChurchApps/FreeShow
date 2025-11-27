import { app } from "electron"
import { isMac, isProd } from ".."
import { ToMain } from "../../types/IPC/ToMain"
import type { Dictionary } from "../../types/Settings"
import { sendToMain } from "../IPC/main"
import { openURL } from "../IPC/responsesMain"

const mc = (id: string) => sendToMain(ToMain.MENU, id)

export function template(strings: Dictionary): any {
    const appMenu = {
        label: app.name,
        submenu: [{ label: strings.main?.about || "About", role: "about" }, { type: "separator" }, { role: "services" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" }, { label: strings.main?.quit || "Quit", role: "quit" }]
    }

    const fileMenu = {
        label: strings.titlebar?.file || "File",
        submenu: [
            { label: strings.actions?.save || "Save", click: () => mc("save") }, // , accelerator: "CmdOrCtrl+S"
            { label: strings.actions?.import || "Import", click: () => mc("import_more") },
            { label: strings.actions?.export || "Export", click: () => mc("export_more") },
            { type: "separator" },
            { label: strings.main?.quit || "Quit", click: () => mc("quit") } // , accelerator: isMac ? "CmdOrCtrl+Q" : ""
        ]
    }

    const editMenu = {
        label: strings.titlebar?.edit || "Edit",
        submenu: [
            { label: strings.actions?.undo || "Undo", click: () => mc("undo") }, // , accelerator: "CmdOrCtrl+Z"
            { label: strings.actions?.redo || "Redo", click: () => mc("redo") }, // CommandOrControl+Shift+Z // , accelerator: "CmdOrCtrl+Y"
            { label: strings.popup?.history || "History", click: () => mc("history") },
            { type: "separator" },
            { label: strings.actions?.cut || "Cut", click: () => mc("cut") },
            { label: strings.actions?.copy || "Copy", click: () => mc("copy") }, // , accelerator: "CmdOrCtrl+C"
            { label: strings.actions?.paste || "Paste", click: () => mc("paste") }, // , accelerator: "CmdOrCtrl+V"
            ...(isMac
                ? [
                      // { label: lang.actions?.pasteAndMatchStyle || "Paste And Match Style", role: "pasteAndMatchStyle", click: () => mc("paste") },
                      { label: strings.actions?.delete || "Delete", click: () => mc("delete") },
                      // WIP: these shortcuts (CMD+A) not working in the MAC file selector modal
                      { label: strings.actions?.selectAll || "Select All", click: () => mc("selectAll") } //   , accelerator: "CmdOrCtrl+A"
                  ]
                : [
                      { label: strings.actions?.delete || "Delete", click: () => mc("delete") },
                      { type: "separator" },
                      { label: strings.actions?.selectAll || "Select All", click: () => mc("selectAll") } //   , accelerator: "CmdOrCtrl+A"
                  ])
        ]
    }

    const viewMenu = {
        label: strings.titlebar?.view || "View",
        submenu: [
            ...(isProd ? [] : [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }]),
            { label: strings.actions?.focus_mode || "Toggle Focus mode", click: () => mc("focus_mode") }, // , accelerator: "CmdOrCtrl+Shift+F"
            { label: strings.actions?.fullscreen || "Toggle Fullscreen", role: "togglefullscreen" }
            // { label: lang.actions?.resetZoom || "Reset Zoom", role: "resetZoom" },
            // { label: lang.actions?.zoomIn || "Zoom In", role: "zoomIn" },
            // { label: lang.actions?.zoomOut || "Zoom Out", role: "zoomOut" },
        ]
    }

    const helpMenu = {
        label: strings.titlebar?.help || "Help",
        submenu: [
            { label: strings.popup?.quick_search || "Quick search", click: () => mc("quick_search") },
            { label: strings.popup?.shortcuts || "Shortcuts", click: () => mc("shortcuts") },
            { label: strings.main?.docs || "Docs", click: () => openURL("https://freeshow.app/docs") },
            { label: strings.guide?.start || "Quick start guide", click: () => mc("quick_start_guide") },
            { label: strings.main?.about || "About", click: () => mc("about") }
        ]
    }

    // as Array<(Electron.MenuItemConstructorOptions) | (Electron.MenuItem)>
    return [...(isMac ? [appMenu] : []), fileMenu, editMenu, viewMenu, helpMenu]
}
