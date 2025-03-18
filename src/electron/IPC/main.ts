import { mainWindow } from ".."
import { MAIN, Main, MainSendValue, type MainReceiveValue } from "./../../types/IPC/Main"
import { ToMain, type ToMainSendValue } from "./../../types/IPC/ToMain"
import { mainResponses } from "./responsesMain"

export function sendMain<ID extends ToMain, V>(id: ID, value: ToMainSendValue<ID, V>) {
    if (!Object.values(ToMain).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainWindow || mainWindow.isDestroyed()) return

    mainWindow.webContents.send(MAIN, { channel: id, data: value })
}

export function sendMainMain<ID extends Main, V>(id: ID, value: MainSendValue<ID, V>) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainWindow || mainWindow.isDestroyed()) return

    mainWindow.webContents.send(MAIN, { channel: id, data: value })
}

export async function receiveMain(e: Electron.IpcMainEvent, msg: MainReceiveValue) {
    const id = msg.channel
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainResponses[id]) return console.error(`No response for channel: ${id}`)

    const handler = mainResponses[id as Main]
    const data = msg.data
    const response = await (handler as any)(data, e)

    if (response !== undefined) e.reply(MAIN, { channel: msg.channel, data: response })
}
