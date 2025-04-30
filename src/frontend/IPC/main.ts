import { uid } from "uid"
import type { ToMainReceiveValue, ToMainSendPayloads } from "../../types/IPC/ToMain"
import { ToMain } from "../../types/IPC/ToMain"
import type { MainReceiveValue, MainReturnPayloads } from "./../../types/IPC/Main"
import { MAIN, Main, type MainSendValue } from "./../../types/IPC/Main"
import { mainResponses } from "./responsesMain"

// @ts-ignore // T extends keyof typeof Main
export function requestMainMultiple<T extends Main>(object: { [K in T]: (data: MainReturnPayloads[K]) => void }) {
    Object.keys(object).forEach((id) => {
        requestMain(id as T, undefined, object[id])
    })
}

const currentlyAwaiting: string[] = []
// @ts-ignore
export async function requestMain<ID extends Main, R = Awaited<MainReturnPayloads[ID]>>(id: ID, value?: MainSendValue<ID>, callback?: (data: R) => void) {
    const listenerId = id + uid(5)
    currentlyAwaiting.push(listenerId)

    sendMain(id, value, listenerId)

    // LISTENER
    const waitingTimeout = 15000
    let timeout: NodeJS.Timeout | null = null
    const returnData: R = await new Promise((resolve) => {
        timeout = setTimeout(() => {
            throw new Error(`IPC Message Timed Out: ${id}`)
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

    const waitIndex = currentlyAwaiting.indexOf(listenerId)
    if (waitIndex > -1) currentlyAwaiting.splice(waitIndex, 1)
    window.api.removeListener(MAIN, listenerId)

    if (callback) callback(returnData)
    return returnData
}

export function sendMainMultiple<T extends Main>(keys: T[]) {
    keys.forEach((id) => sendMain(id))
}

export function sendMain<ID extends Main>(id: ID, value?: MainSendValue<ID>, listenerId?: string) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    if (!window.api) return

    window.api.send(MAIN, { channel: id, data: value }, listenerId)
}

export function receiveMainGlobal() {
    window.api.receive(MAIN, async (msg: MainReceiveValue | ToMainReceiveValue, listenerId?: string) => {
        const id = msg.channel
        if (!Object.values({ ...Main, ...ToMain }).includes(id)) throw new Error(`Invalid channel: ${id}`)
        if (!mainResponses[id]) return // console.error(`No response for channel: ${id}`)

        const data = msg.data // MainReturnPayloads[Main]
        const response = await (mainResponses[id] as any)(data)
        if (!response) return

        window.api.send(MAIN, { channel: id, data: response }, listenerId)
    })
}

// @ts-ignore works as it should
export function receiveMain<ID extends Main, R = Awaited<MainReturnPayloads[ID]>>(id: ID, callback: (data: R) => void) {
    if (!Object.values(Main).includes(id)) throw new Error(`Invalid channel: ${id}`)
    const listenerId = uid()

    window.api.receive(
        MAIN,
        (msg: MainReceiveValue) => {
            if (msg.channel === id) callback(msg.data as R)
        },
        listenerId
    )

    return listenerId
}

export function receiveToMain<ID extends ToMain, R = Awaited<ToMainSendPayloads[ID]>>(id: ID, callback: (data: R) => void) {
    if (!Object.values(ToMain).includes(id)) throw new Error(`Invalid channel: ${id}`)
    const listenerId = uid()

    window.api.receive(
        MAIN,
        (msg: ToMainReceiveValue) => {
            if (msg.channel === id) callback(msg.data as R)
        },
        listenerId
    )

    return listenerId
}

export function destroyMain(listenerId: string) {
    window.api.removeListener(MAIN, listenerId)
}
