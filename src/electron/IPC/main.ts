import { mainWindow } from ".."
import { save } from "../data/save"
import { updateDataPath, userDataPath } from "../data/store"
import { MAIN, Main, MainReceiveValue, MainReturnPayloads, MainSendPayloads, type MainSendValue } from "./../../types/IPC/Main"

export function sendMain<ID extends Main, V>(id: ID, value: MainSendValue<ID, V>) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainWindow || mainWindow.isDestroyed()) return

    // console.log(`Sending on channel: ${id}`, value)
    mainWindow.webContents.send(MAIN, { channel: id, data: value })
}

const mainResponses = {
    [Main.SAVE]: async (data: MainSendPayloads[Main.SAVE]) => {
        if (userDataPath === null) updateDataPath()
        save(data)
    },
}

export async function receiveMain(e: Electron.IpcMainEvent, msg: MainReceiveValue) {
    const id = msg.channel
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainResponses[id]) return console.error(`No response for channel: ${id}`)

    const data = msg.data as any // MainSendPayloads[Main]
    const response = (await mainResponses[id](data)) as MainReturnPayloads[Main]

    if (response !== undefined) e.reply(MAIN, { channel: msg.channel, data: response })
}
