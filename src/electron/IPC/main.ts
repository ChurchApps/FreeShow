import { ipcMain, type IpcMainEvent } from "electron"
import { uid } from "uid"
import { mainWindow } from ".."
import { MAIN, Main, type MainReceiveValue, type ToMainSendValue2 } from "./../../types/IPC/Main"
import { ToMain, ToMainReceiveValue, ToMainReturnPayloads, type ToMainSendValue } from "./../../types/IPC/ToMain"
import { mainResponses } from "./responsesMain"

export function sendToMain<ID extends ToMain>(id: ID, value: ToMainSendValue<ID>, listenerId?: string) {
    if (!Object.values(ToMain).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainWindow || mainWindow.isDestroyed()) return

    mainWindow.webContents.send(MAIN, { channel: id, data: value }, listenerId)
}

export function sendMain<ID extends Main>(id: ID, value: ToMainSendValue2<ID>, listenerId?: string) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainWindow || mainWindow.isDestroyed()) return

    mainWindow.webContents.send(MAIN, { channel: id, data: value }, listenerId)
}

export async function receiveMain(e: Electron.IpcMainEvent, msg: MainReceiveValue, listenerId: string) {
    const id = msg.channel
    if (!Object.values(Main).includes(id)) {
        if (Object.values(ToMain).includes(id as any)) return
        throw new Error(`Invalid channel: ${id}`)
    }
    if (!mainResponses[id]) return console.error(`No response for channel: ${id}`)

    const handler = mainResponses[id ]
    const data = msg.data
    const response = await (handler as any)(data, e)

    // e.reply(MAIN, ) does not include message ID
    // if (response !== undefined) sendMain(id, response, listenerId)
    if (response !== undefined) e.reply(MAIN, { channel: msg.channel, data: response }, listenerId)
}

const currentlyAwaiting: string[] = []
// @ts-ignore
export async function requestToMain<ID extends ToMain, R = Awaited<ToMainReturnPayloads[ID]>>(id: ID, value: ToMainSendValue<ID>, callback?: (data: R) => void) {
    const listenerId = id + uid(5)
    currentlyAwaiting.push(listenerId)

    sendToMain(id, value, listenerId)

    // LISTENER
    const waitingTimeout = 15000
    let timeout: NodeJS.Timeout | null = null
    const returnData: R = await new Promise((resolve) => {
        timeout = setTimeout(() => {
            throw new Error(`IPC Message Timed Out: ${id}`)
        }, waitingTimeout)

        ipcMain.on(MAIN, receive)

        function receive(_e: IpcMainEvent, msg: ToMainReceiveValue, listenId: string) {
            if (msg.channel !== id || listenId !== listenerId) return

            if (timeout) clearTimeout(timeout)
            resolve(msg.data as R)
            ipcMain.removeListener(MAIN, receive)
        }
    })

    const waitIndex = currentlyAwaiting.indexOf(listenerId)
    if (waitIndex > -1) currentlyAwaiting.splice(waitIndex, 1)

    if (callback) callback(returnData)
    return returnData
}
