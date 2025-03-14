import { uid } from "uid"
import { MAIN, Main, MainReceiveData, MainReceiveValue, MainReturnPayloads, type MainSendValue } from "./../../types/IPC/Main"

// @ts-ignore // T extends keyof typeof Main
export function requestMainMultiple<T extends Main>(object: { [K in T]: (data: MainReturnPayloads[K]) => void }) {
    Object.keys(object).forEach((id) => {
        requestMain(id as Main, undefined, object[id])
    })
}

let currentlyAwaiting: string[] = []
// @ts-ignore
export async function requestMain<ID extends Main, V, R = MainReturnPayloads[ID]>(id: ID, value?: MainSendValue<ID, V>, callback?: (data: R) => void) {
    let listenerId = id + uid(5)
    currentlyAwaiting.push(listenerId)

    sendMain(id, value)

    // LISTENER
    const waitingTimeout = 8000
    let timeout: NodeJS.Timeout | null = null
    const returnData: R = await new Promise((resolve) => {
        timeout = setTimeout(() => {
            throw new Error("IPC Message Timed Out!")
        }, waitingTimeout)

        window.api.receive(
            MAIN,
            (msg: MainReceiveValue, listenId: string) => {
                if (msg.channel !== id || listenId !== listenerId) return

                if (timeout) clearTimeout(timeout)
                resolve(msg.data as R)
            },
            listenerId
        )
    })

    let waitIndex = currentlyAwaiting.indexOf(listenerId)
    if (waitIndex > -1) currentlyAwaiting.splice(waitIndex, 1)
    window.api.removeListener(MAIN, listenerId)

    if (callback) callback(returnData)
    return returnData
}

export function sendMain<ID extends Main, V>(id: ID, value?: MainSendValue<ID, V>) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!window.api) return

    window.api.send(MAIN, { channel: id, data: value })
}

const mainResponses = {
    // [Main.SAVE]: async () => null,
    [Main.VERSION]: (data: MainReturnPayloads[Main.VERSION]) => {
        console.log(data)
    },
}

export async function receiveMain() {
    window.api.receive(MAIN, (msg: MainReceiveValue) => {
        const id = msg.channel
        if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
        if (!mainResponses[id]) return console.error(`No response for channel: ${id}`)

        const data = msg.data // MainReturnPayloads[Main]
        mainResponses[id](data) as MainReceiveData<Main> // const response =
    })
}
