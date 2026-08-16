// AI AUTO SCRIPTURE - nemotron decode host (Electron utilityProcess entry)
// Runs the NemotronDriver in its own process, where its synchronous ONNX decodes are free to
// block: the app's main process only forwards audio and receives segments over the port, so a
// slow decode can never freeze the UI, IPC or the audio feed. A crash in the native addon takes
// down this process alone - the transcriber proxy surfaces it as an engine error.

import { NemotronDriver } from "./driver"
import type { NemotronModelPaths } from "./manager"
import type { TranscriberSegment } from "../types"

export type NemotronWorkerRequest = { type: "start"; paths: NemotronModelPaths; vadModelPath: string; language?: string } | { type: "audio"; data: Uint8Array } | { type: "stop" }

export type NemotronWorkerResponse = { type: "ready" } | { type: "segment"; segment: TranscriberSegment } | { type: "error"; message: string } | { type: "stopped" }

// present only when this file runs as a utilityProcess entry (the type import above is free)
const parentPort = (process as NodeJS.Process & { parentPort?: { postMessage(message: unknown): void; on(event: "message", listener: (event: { data: NemotronWorkerRequest }) => void): void } }).parentPort

if (parentPort) {
    let driver: NemotronDriver | null = null
    const post = (message: NemotronWorkerResponse) => parentPort.postMessage(message)

    const handle = async (message: NemotronWorkerRequest) => {
        try {
            if (message.type === "start") {
                driver = new NemotronDriver({
                    paths: message.paths,
                    vadModelPath: message.vadModelPath,
                    language: message.language,
                    onSegment: (segment) => post({ type: "segment", segment }),
                    onError: (errorMessage) => post({ type: "error", message: errorMessage })
                })
                await driver.start()
                post({ type: "ready" })
            } else if (message.type === "audio") {
                driver?.pushAudio(message.data)
            } else if (message.type === "stop") {
                // stop() flushes the open utterance first, so its segment message precedes "stopped"
                await driver?.stop()
                driver = null
                post({ type: "stopped" })
            }
        } catch (err) {
            post({ type: "error", message: String((err as Error)?.message || err) })
        }
    }

    parentPort.on("message", (event) => void handle(event.data))
}
