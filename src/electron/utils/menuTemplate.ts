import { MAIN } from "../../types/Channels"
import { isProd, openURL, toApp } from ".."
import { app } from "electron"

const isMac: boolean = process.platform === "darwin"

const mc = (id: string) => toApp(MAIN, { channel: "MENU", data: id })

export function template(strings: any): any {
    return [
        ...(isMac
            ? [
                  {
                      label: app.name,
                      submenu: [
                          { label: strings.main?.about || "About", role: "about" },
                          { type: "separator" },
                          { role: "services" },
                          { type: "separator" },
                          { role: "hide" },
                          { role: "hideOthers" },
                          { role: "unhide" },
                          { type: "separator" },
                          { label: strings.main?.quit || "Quit", role: "quit" },
                      ],
                  },
              ]
            : []),
        {
            label: strings.titlebar?.file || "File",
            submenu: [
                { label: strings.actions?.save || "Save", accelerator: "CmdOrCtrl+S", click: () => mc("save") },
                { label: strings.actions?.import || "Import", click: () => mc("import") },
                { label: strings.actions?.export || "Export", click: () => mc("export_more") },
                { type: "separator" },
                { label: strings.main?.quit || "Quit", accelerator: isMac ? "CmdOrCtrl+Q" : "", click: () => mc("quit") },
            ],
        },
        {
            label: strings.titlebar?.edit || "Edit",
            submenu: [
                { label: strings.actions?.undo || "Undo", accelerator: "CmdOrCtrl+Z", click: () => mc("undo") },
                { label: strings.actions?.redo || "Redo", accelerator: "CmdOrCtrl+Y", click: () => mc("redo") },
                { label: strings.popup?.history || "History", click: () => mc("history") },
                { type: "separator" },
                // { label: lang.actions?.cut || "Cut", role: "cut" },
                { label: strings.actions?.copy || "Copy", accelerator: "CmdOrCtrl+C", click: () => mc("copy") },
                { label: strings.actions?.paste || "Paste", accelerator: "CmdOrCtrl+V", click: () => mc("paste") },
                ...(isMac
                    ? [
                          // { label: lang.actions?.pasteAndMatchStyle || "Paste And Match Style", role: "pasteAndMatchStyle", click: () => mc("paste") },
                          { label: strings.actions?.delete || "Delete", click: () => mc("delete") },
                          { label: strings.actions?.selectAll || "Select All", accelerator: "CmdOrCtrl+A", click: () => mc("selectAll") },
                          // { type: "separator" },
                          // {
                          //   label: lang.actions?.speech || "Speech",
                          //   submenu: [
                          //     { label: lang.actions?.startSpeaking || "Start Speaking", role: "startSpeaking" },
                          //     { label: lang.actions?.stopSpeaking || "Stop Speaking", role: "stopSpeaking" },
                          //   ],
                          // },
                      ]
                    : [
                          { label: strings.actions?.delete || "delete", click: () => mc("delete") },
                          { type: "separator" },
                          { label: strings.actions?.selectAll || "Select All", accelerator: "CmdOrCtrl+A", click: () => mc("selectAll") },
                      ]),
            ],
        },
        {
            label: strings.titlebar?.view || "View",
            submenu: [
                ...(isProd ? [] : [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }]),
                { label: strings.actions?.fullscreen || "Toggle Fullscreen", role: "togglefullscreen" },
                // { label: lang.actions?.resetZoom || "Reset Zoom", role: "resetZoom" },
                // { label: lang.actions?.zoomIn || "Zoom In", role: "zoomIn" },
                // { label: lang.actions?.zoomOut || "Zoom Out", role: "zoomOut" },
            ],
        },
        {
            label: strings.titlebar?.help || "Help",
            submenu: [
                { label: strings.popup?.shortcuts || "Shortcuts", click: () => mc("shortcuts") },
                {
                    label: strings.main?.docs || "Docs",
                    click: () => openURL("https://freeshow.app/docs"),
                },
                { label: strings.main?.about || "About", click: () => mc("about") },
            ],
        },
    ]
}
