import { MAIN } from "../../types/Channels"
import { openURL, toApp } from ".."
import { app } from "electron"

const isMac: boolean = process.platform === "darwin"
const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

const mc = (id: string) => toApp(MAIN, { channel: "MENU", data: id })

export function template(lang: any): any {
  return [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: lang.main?.about || "About", role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { label: lang.main?.quit || "Quit", role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: lang.titlebar?.file || "File",
      submenu: [
        { label: lang.actions?.save || "Save", accelerator: "CmdOrCtrl+S", click: () => mc("save") },
        { label: lang.actions?.import || "Import", submenu: [{ label: "txt" }] },
        { label: lang.actions?.export || "Export", submenu: [{ label: "txt" }] },
        { type: "separator" },
        { label: lang.main?.quit || "Quit", accelerator: isMac ? "CmdOrCtrl+Q" : "", click: () => mc("quit") },
      ],
    },
    {
      label: lang.titlebar?.edit || "Edit",
      submenu: [
        { label: lang.actions?.undo || "Undo", accelerator: "CmdOrCtrl+Z", click: () => mc("undo") },
        { label: lang.actions?.redo || "Redo", accelerator: "CmdOrCtrl+Y", click: () => mc("redo") },
        { type: "separator" },
        { label: lang.actions?.cut || "Cut", role: "cut" },
        { label: lang.actions?.copy || "Copy", role: "copy" },
        { label: lang.actions?.paste || "Paste", role: "paste" },
        ...(isMac
          ? [
              { label: lang.actions?.pasteAndMatchStyle || "Paste And Match Style", role: "pasteAndMatchStyle" },
              { label: lang.actions?.delete || "Delete", role: "delete" },
              { label: lang.actions?.selectAll || "Select All", role: "selectAll" },
              { type: "separator" },
              {
                label: lang.actions?.speech || "Speech",
                submenu: [
                  { label: lang.actions?.startSpeaking || "Start Speaking", role: "startSpeaking" },
                  { label: lang.actions?.stopSpeaking || "Stop Speaking", role: "stopSpeaking" },
                ],
              },
            ]
          : [{ label: lang.actions?.delete || "delete", role: "Delete" }, { type: "separator" }, { label: lang.actions?.selectAll || "Select All", role: "selectAll" }]),
      ],
    },
    {
      label: lang.titlebar?.view || "View",
      submenu: [
        ...(isProd && Number(app.getVersion()[0]) > 0 ? [] : [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }]),
        { label: lang.actions?.fullscreen || "Toggle Fullscreen", role: "togglefullscreen" },
        { label: lang.actions?.resetZoom || "Reset Zoom", role: "resetZoom" },
        { label: lang.actions?.zoomIn || "Zoom In", role: "zoomIn" },
        { label: lang.actions?.zoomOut || "Zoom Out", role: "zoomOut" },
      ],
    },
    {
      label: lang.titlebar?.help || "Help",
      submenu: [
        { label: lang.popup?.shortcuts || "Shortcuts", click: () => mc("shortcuts") },
        {
          label: lang.main?.docs || "Docs",
          click: () => openURL("https://freeshow.app/docs"),
        },
        { label: lang.main?.about || "About", click: () => mc("about") },
      ],
    },
  ]
}
