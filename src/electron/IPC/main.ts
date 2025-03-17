import { mainWindow } from ".."
import { MAIN, Main, type MainReceiveValue } from "./../../types/IPC/Main"
import { ToMain, type ToMainSendValue } from "./../../types/IPC/ToMain"
import { mainResponses } from "./responsesMain"

export function sendMain<ID extends ToMain, V>(id: ID, value: ToMainSendValue<ID, V>) {
    if (!Object.values(ToMain).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainWindow || mainWindow.isDestroyed()) return

    mainWindow.webContents.send(MAIN, { channel: id, data: value })
}

export async function receiveMain(e: Electron.IpcMainEvent, msg: MainReceiveValue) {
    const id = msg.channel
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!mainResponses[id]) return console.error(`No response for channel: ${id}`)

    // const data = msg.data as any // MainSendPayloads[Main]
    // // const response = (await mainResponses[id](data)) as MainReturnPayloads[Main]
    // const response = (await mainResponses[id](data)) as MainSendData<Main>

    // const handler = mainResponses[id as keyof typeof mainResponses] as (data: ID extends keyof MainSendPayloads ? MainSendPayloads[ID] : unknown) => ID extends keyof MainReturnPayloads ? MainReturnPayloads[Main] : void
    // const handler = mainResponses[id as Main] as (
    //     data: Main extends keyof MainSendPayloads ? MainSendPayloads[Main] : unknown
    // ) => Main extends keyof MainReturnPayloads ? MainReturnPayloads[Main] : void

    const handler = mainResponses[id as Main]
    const data = msg.data
    const response = await (handler as any)(data, e)

    if (response !== undefined) e.reply(MAIN, { channel: msg.channel, data: response })
}
