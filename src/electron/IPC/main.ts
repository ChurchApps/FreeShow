import { ipcMain, type IpcMainEvent } from "electron"
import { uid } from "uid"
import { isProd, mainWindow } from ".."
import { MAIN, Main, type MainReceiveValue, type ToMainSendValue2 } from "./../../types/IPC/Main"
import type { ToMainReceiveValue, ToMainReturnPayloads } from "./../../types/IPC/ToMain"
import { ToMain, type ToMainSendValue } from "./../../types/IPC/ToMain"
import { mainResponses } from "./responsesMain"

export function sendToMain<ID extends ToMain>(id: ID, value: ToMainSendValue<ID>, listenerId?: string) {
    if (!Object.values(ToMain).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed?.()) return

    mainWindow.webContents.send(MAIN, { channel: id, data: value }, listenerId)
}

export function sendMain<ID extends Main>(id: ID, value: ToMainSendValue2<ID>, listenerId?: string) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed?.()) return

    mainWindow.webContents.send(MAIN, { channel: id, data: value }, listenerId)
}

export async function receiveMain(e: Electron.IpcMainEvent, msg: MainReceiveValue, listenerId: string) {
    const id = msg.channel
    if (!Object.values(Main).includes(id)) {
        if (Object.values(ToMain).includes(id as any)) return
        throw new Error(`Invalid channel: ${id}`)
    }
    if (!mainResponses[id]) return console.error(`No response for channel: ${id}`)

    const handler = mainResponses[id]
    const data = msg.data
    const response = await (handler as any)(data, e)

    // e.reply(MAIN, ) does not include message ID
    // if (response !== undefined) sendMain(id, response, listenerId)
    if (response !== undefined) e.reply(MAIN, { channel: msg.channel, data: response }, listenerId)
}

const currentlyAwaiting: string[] = []
// single shared MAIN listener that routes each reply to its awaiting request by listenerId
const pendingToMain = new Map<string, (msg: ToMainReceiveValue) => void>()
let toMainDispatcherRegistered = false
function ensureToMainDispatcher() {
    if (toMainDispatcherRegistered) return
    toMainDispatcherRegistered = true
    ipcMain.on(MAIN, (_e: IpcMainEvent, msg: ToMainReceiveValue, listenId: string) => {
        if (!listenId) return
        const resolver = pendingToMain.get(listenId)
        if (resolver) resolver(msg)
    })
}

// @ts-ignore
export async function requestToMain<ID extends ToMain, R = Awaited<ToMainReturnPayloads[ID]>>(id: ID, value: ToMainSendValue<ID>, callback?: (data: R | null) => void, timeoutMs = 15000) {
    const listenerId = id + uid(5)
    currentlyAwaiting.push(listenerId)
    ensureToMainDispatcher()

    // LISTENER
    const waitingTimeout = timeoutMs
    let timeout: NodeJS.Timeout | null = null
    let settled = false
    const cleanup = () => {
        if (timeout) clearTimeout(timeout)
        pendingToMain.delete(listenerId)

        const waitIndex = currentlyAwaiting.indexOf(listenerId)
        if (waitIndex > -1) currentlyAwaiting.splice(waitIndex, 1)
    }

    const returnData: R | null = await new Promise((resolve) => {
        timeout = setTimeout(() => {
            if (settled) return
            settled = true

            if (!isProd) console.error(`IPC Message Timed Out: ${id}`)
            cleanup()
            resolve(null)
        }, waitingTimeout)

        pendingToMain.set(listenerId, (msg: ToMainReceiveValue) => {
            if (settled) return
            if (msg.channel !== id) return

            settled = true
            cleanup()
            resolve(msg.data as R)
        })

        sendToMain(id, value, listenerId)
    })

    if (callback) callback(returnData)
    return returnData
}
