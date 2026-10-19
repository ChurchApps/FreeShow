import type { Rectangle } from "electron"
import { toApp } from ".."
import { OUTPUT } from "../../types/Channels"
import type { Output } from "../../types/Output"
import type { Message } from "../../types/Socket"
import { CaptureHelper } from "../capture/CaptureHelper"
import { OutputBounds } from "./helpers/OutputBounds"
import { OutputIdentify } from "./helpers/OutputIdentify"
import { OutputLifecycle } from "./helpers/OutputLifecycle"
import { OutputSend } from "./helpers/OutputSend"
import { OutputValues } from "./helpers/OutputValues"
import { OutputVisibility } from "./helpers/OutputVisibility"
import { PreviewStream } from "../capture/PreviewStream"
import { OutputRecording } from "../streaming/OutputRecording"
import { MediaLayers } from "./helpers/MediaLayers"
import type { Output as OutputData } from "./Output"

export class OutputHelper {
    static receiveOutput(_e: Electron.IpcMainEvent, msg: Message) {
        const outputResponses = {
            CREATE: (data: Output) => OutputHelper.Lifecycle.createOutput(data),
            REMOVE: (data: { id: string }) => OutputHelper.Lifecycle.removeOutput(data.id),
            // DISPLAY: (data: { output: Output; enabled?: "toggle" | boolean; autoPosition?: boolean; auto?: boolean; one?: boolean }) => OutputHelper.Visibility.displayOutput(data),
            TOGGLE_OUTPUTS: (data: { outputs: (Output & { id: string })[]; state: boolean; autoStartup?: boolean; autoPosition?: boolean }) => OutputHelper.Visibility.toggleOutputs(data),
            ALIGN_WITH_SCREEN: () => OutputHelper.Bounds.alignWithScreens(),

            MOVE: (data: { enabled: boolean }) => {
                OutputHelper.Bounds.moveEnabled = data.enabled
                OutputHelper.getKeys().forEach((id) => OutputHelper.Lifecycle.updateWindowConstraints(id))
            },

            UPDATE_BOUNDS: (data: { id: string; bounds: Rectangle }) => OutputHelper.Bounds.updateBounds(data),
            SET_VALUE: (data: { id: string; key: string; value: boolean | { key: string; value: boolean } }) => OutputHelper.Values.updateValue(data),
            TO_FRONT: (data: string) => OutputHelper.Bounds.moveToFront(data),

            STREAM_LAYER: (data: { id: string; active: boolean }) => OutputLifecycle.requestVideoLayer(data.id, !!data.active),
            MEDIA_LAYERS: (data: { outputId: string; layers: any[]; fill: number[] }) => MediaLayers.update(data.outputId, data.layers || [], data.fill || [0, 0, 0]),
            PREVIEW_SUBSCRIBE: (data: { id: string; subscriber?: string; width?: number }) => PreviewStream.subscribe(data.id, data.subscriber, data.width),
            PREVIEW_UNSUBSCRIBE: (data: { id: string; subscriber?: string }) => PreviewStream.unsubscribe(data.id, data.subscriber),
            PREVIEW_SIZE: (data: { id: string; subscriber: string; width: number }) => PreviewStream.setWidth(data.id, data.subscriber, data.width),
            CAPTURE: (data: { id: string; captures: { [key: string]: boolean } }) => CaptureHelper.Lifecycle.startCapture(data.id, data.captures),
            RECORD_OUTPUT: (data: { id: string; state: boolean; name?: string; path?: string }) => (data.state ? OutputRecording.start(data.id, data.name || `${data.id}.mp4`, data.path) : OutputRecording.stop(data.id)),

            IDENTIFY_SCREENS: (data: { bounds: Rectangle }[]) => OutputHelper.Identify.identifyScreens(data),
            // PREVIEW_BOUNDS: (data) => OutputHelper.Bounds.setPreviewBounds(data),

            FOCUS: (data: { id: string }) => OutputHelper.Lifecycle.focusOutput(data.id)
        }

        if (msg.channel === "MEDIA_SOURCE_READY") return MediaLayers.sourceReady(_e.sender)
        if (msg.channel.includes("MAIN")) return toApp(OUTPUT, msg)
        if (msg.channel in outputResponses) return outputResponses[msg.channel as keyof typeof outputResponses](msg.data)

        OutputHelper.Send.sendToOutputWindow(msg)
    }

    // static outputWindows: { [key: string]: BrowserWindow } = {}
    private static outputs: { [key: string]: OutputData } = {}

    static getOutput(id: string) {
        return this.outputs[id]
    }

    static getAllOutputs() {
        return Object.entries(this.outputs).map(([id, output]) => ({ ...output, id }))
    }

    // the window a capture reads from: the offscreen surface when one exists, else the output's own window
    static renderWindow(output: OutputData | undefined) {
        const win = output?.captureWindow && !output.captureWindow.isDestroyed() ? output.captureWindow : output?.window
        return win && !win.isDestroyed() ? win : undefined
    }

    static setOutput(id: string, output: OutputData) {
        this.outputs[id] = output
    }

    static deleteOutput(id: string) {
        delete this.outputs[id]
    }

    static getKeys() {
        return Object.keys(OutputHelper.outputs)
    }

    static init() {
        OutputLifecycle.initListeners()
    }

    static Bounds = OutputBounds
    static Identify = OutputIdentify
    static Lifecycle = OutputLifecycle
    static Send = OutputSend
    static Values = OutputValues
    static Visibility = OutputVisibility
}
