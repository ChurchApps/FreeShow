import { app, ipcMain } from "electron"
import { mainWindow, resetMainWindow } from ".."
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { NdiReceiver } from "../ndi/NdiReceiver"
import { OutputHelper } from "../output/OutputHelper"
import { closeServers } from "../servers"
import { stopApiListener } from "./api"
import { stopMidi } from "./midi"

export let dialogClose: boolean = false // is unsaved
export function callClose(e: Electron.Event) {
    if (dialogClose) return
    e.preventDefault()

    sendToMain(ToMain.CLOSE2, true)
}

export async function exitApp() {
    console.log("Closing app!")

    dialogClose = false

    await OutputHelper.Lifecycle.closeAllOutputs()
    NdiReceiver.stopReceiversNDI()

    closeServers()
    stopApiListener()

    stopMidi()

    // relaunch does not work very well as it launched new processes
    // if (!isProd) {
    //     console.log("Dev mode active - Relaunching...")
    //     app.relaunch()
    // } else {
    // this has to be called to actually remove the process!
    // https://stackoverflow.com/a/43520274
    mainWindow?.removeAllListeners("close")
    ipcMain.removeAllListeners()
    // }

    resetMainWindow()

    try {
        app.quit()

        // shouldn't need to use exit!
        setTimeout(() => {
            app.exit()
        }, 500)
    } catch (err) {
        console.error("Failed closing app:", err)
    }
}

export function closeMain() {
    dialogClose = true
    mainWindow?.close()
}

export function forceCloseApp() {
    sendToMain(ToMain.ALERT, "actions.closing")
    // let user read message and action finish
    setTimeout(exitApp, 2000)
}
