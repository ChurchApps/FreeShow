import { get } from "svelte/store"
import { obsData } from "../stores"
import { promptCustom } from "./popup"

class OBSWebSocket {
    private socket: WebSocket | null = null

    public isConnected: boolean = false
    private lastErrorMsg: string = ""
    private stateListeners = new Map<string, (connected: boolean, error?: string) => void>()
    private dataListeners = new Map<string, (data: any) => void>()
    private connectionPromise: Promise<boolean> | null = null

    constructor(
        private ip: string,
        private port: number,
        private password: string
    ) {}

    checkData(ip: string, port: number, password: string) {
        return this.ip === ip && this.port === port && this.password === password
    }

    onStateChange(callback: (connected: boolean, error?: string) => void, key?: string) {
        const k = key || callback.toString()
        this.stateListeners.set(k, callback)
        if (this.isConnected) {
            callback(true)
        } else if (this.lastErrorMsg) {
            callback(false, this.lastErrorMsg)
        }
    }

    private updatePassword(password: string) {
        this.password = password
        obsData.update((data) => ({
            ...data,
            password
        }))
    }

    async connect(): Promise<boolean> {
        if (this.isConnected) return true
        if (this.connectionPromise) return this.connectionPromise

        this.connectionPromise = new Promise((resolve) => {
            if (this.socket) this.socket.close()

            this.socket = new WebSocket(`ws://${this.ip}:${this.port}`)

            this.socket!.onclose = (event) => {
                console.log(`OBS Disconnected (Code: ${event.code})`)

                this.setConnected(false)
                if (event.code === 4009 || event.code === 1001) this.updatePassword("") // reset password on auth failure

                let errorMsg = ""
                if (event.code === 1006) errorMsg = "Unable to connect. Please check that the WebSocket server is enabled in OBS, and check the IP/port."
                else if (event.code === 1001) errorMsg = "OBS closed the connection."
                else if (event.code === 4009) errorMsg = "Authentication failed. Please check your password."
                else if (event.code === 4011) errorMsg = "Kicked out."
                else if (event.code !== 1000) errorMsg = `OBS Disconnected (Code: ${event.code})`

                this.lastErrorMsg = errorMsg

                this.stateListeners.forEach((callback) => {
                    callback(false, errorMsg)
                })

                this.connectionPromise = null
                resolve(false)
            }

            this.socket!.onmessage = async (event) => {
                const data = JSON.parse(event.data)

                // Hello
                if (data.op === 0) {
                    let authPayload: any = { rpcVersion: 1, eventSubscriptions: (1 << 0) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 6) | (1 << 7) | (1 << 10) | (1 << 16) } // General, Scenes, Inputs, Transitions, Outputs, SceneItems, UI, InputVolumeMeters

                    if (data.d.authentication) {
                        if (!this.password) {
                            const newPass = await promptCustom("Server Password", "password", "OBS requires authentication. Turn it off, or enter the <b>Server Password</b> found in <b>Show Connect Info</b>.")
                            if (newPass) this.updatePassword(newPass)
                        }
                        if (!this.password) {
                            // cancelled
                            this.socket?.close()
                            return
                        }

                        const authString = await this.generateAuthString(this.password, data.d.authentication.salt, data.d.authentication.challenge)
                        authPayload.authentication = authString
                    }
                    this.send({ op: 1, d: authPayload })
                    return
                }

                // Identified
                if (data.op === 2) {
                    this.setConnected(true)
                    this.lastErrorMsg = ""
                    this.stateListeners.forEach((callback) => {
                        callback(true)
                    })
                    this.connectionPromise = null
                    resolve(true)
                    return
                }

                this.dataListeners.forEach((callback) => {
                    callback(data)
                })
            }
        })

        return this.connectionPromise
    }

    private setConnected(value: boolean) {
        this.isConnected = value
        obsData.update((data) => ({ ...data, connected: value }))
    }

    listen(callback: (data: any) => void, key?: string) {
        const k = key || callback.toString()
        this.dataListeners.set(k, callback)
    }

    // Helper for sending commands (OpCode 6)
    call(requestType: string, requestData?: any) {
        this.send({
            op: 6,
            d: {
                requestType,
                requestId: Math.random().toString(36).substring(7),
                requestData
            }
        })
    }

    send(data: any) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data))
        }
    }

    disconnect() {
        this.socket?.close()
        this.setConnected(false)
    }

    private async generateAuthString(pass: string, salt: string, challenge: string) {
        const encoder = new TextEncoder()
        const hash1 = await crypto.subtle.digest("SHA-256", encoder.encode(pass + salt))
        const hash1Base64 = btoa(String.fromCharCode(...new Uint8Array(hash1)))
        const hash2 = await crypto.subtle.digest("SHA-256", encoder.encode(hash1Base64 + challenge))
        return btoa(String.fromCharCode(...new Uint8Array(hash2)))
    }
}

// Global instance to prevent multiple connections across your app
let obsInstance: OBSWebSocket | null = null
export async function connectToOBS() {
    const data = get(obsData)

    const ip = data.ip || "localhost"
    const port = !isNaN(Number(data.port)) ? Number(data.port) : 4455
    const password = data.password || ""

    if (obsInstance && !obsInstance.checkData(ip, port, password)) {
        obsInstance.disconnect()
        obsInstance = null
    }

    if (!obsInstance) obsInstance = new OBSWebSocket(ip, port, password)
    if (!obsInstance.isConnected) await obsInstance.connect()
    return obsInstance
}

// ACTIONS

export async function obsGetScenes(): Promise<string[]> {
    const obs = await connectToOBS()
    if (!obs.isConnected) return []

    return new Promise((resolve) => {
        obs.listen((msg: any) => {
            if (msg.op === 7 && msg.d?.requestType === "GetSceneList") {
                resolve(
                    (msg.d.responseData?.scenes || [])
                        .slice()
                        .sort((a: any, b: any) => b.sceneIndex - a.sceneIndex)
                        .map((s: any) => s.sceneName)
                )
            }
        }, "get_scenes_once")
        obs.call("GetSceneList")
    })
}

export async function obsSetScene(scene: string) {
    const obs = await connectToOBS()
    if (!obs.isConnected) return
    obs.call("SetCurrentProgramScene", { sceneName: scene })
}

export async function obsStartLivestream() {
    const obs = await connectToOBS()
    if (!obs.isConnected) return
    obs.call("StartStream")
}

export async function obsStopLivestream() {
    const obs = await connectToOBS()
    if (!obs.isConnected) return
    obs.call("StopStream")
}

export async function obsStartRecording() {
    const obs = await connectToOBS()
    if (!obs.isConnected) return
    obs.call("StartRecord")
}

export async function obsStopRecording() {
    const obs = await connectToOBS()
    if (!obs.isConnected) return
    obs.call("StopRecord")
}
