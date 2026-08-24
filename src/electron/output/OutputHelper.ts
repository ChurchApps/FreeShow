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
import { RenderGroups } from "./helpers/RenderGroups"
import type { Output as OutputData } from "./Output"

export class OutputHelper {
    static receiveOutput(_e: Electron.IpcMainEvent, msg: Message) {
        const outputResponses = {
            CREATE: (data: Output) => OutputHelper.Lifecycle.createOutput(data),
            REMOVE: (data: { id: string }) => OutputHelper.Lifecycle.removeOutput(data.id),
            // DISPLAY: (data: { output: Output; enabled?: "toggle" | boolean; force?: boolean; autoPosition?: boolean; auto?: boolean; one?: boolean }) => OutputHelper.Visibility.displayOutput(data),
            TOGGLE_OUTPUTS: (data: { outputs: (Output & { id: string })[]; state: boolean; force?: boolean; autoStartup?: boolean; autoPosition?: boolean }) => OutputHelper.Visibility.toggleOutputs(data),
            ALIGN_WITH_SCREEN: () => OutputHelper.Bounds.alignWithScreens(),

            MOVE: (data: { enabled: boolean }) => {
                OutputHelper.Bounds.moveEnabled = data.enabled
                OutputHelper.getKeys().forEach((id) => OutputHelper.Lifecycle.updateWindowConstraints(id))
            },

            UPDATE_BOUNDS: (data: { id: string; bounds: Rectangle }) => OutputHelper.Bounds.updateBounds(data),
            SET_VALUE: (data: { id: string; key: string; value: boolean | { key: string; value: boolean } }) => OutputHelper.Values.updateValue(data),
            TO_FRONT: (data: string) => OutputHelper.Bounds.moveToFront(data),

            REQUEST_PREVIEW: (data: { id: string; previewId: string }) => CaptureHelper.Transmitter.requestPreview(data),
            CAPTURE: (data: { id: string; captures: { [key: string]: boolean } }) => CaptureHelper.Lifecycle.startCapture(data.id, data.captures),

            IDENTIFY_SCREENS: (data: { bounds: Rectangle }[]) => OutputHelper.Identify.identifyScreens(data),
            // PREVIEW_BOUNDS: (data) => OutputHelper.Bounds.setPreviewBounds(data),

            FOCUS: (data: { id: string }) => OutputHelper.Lifecycle.focusOutput(data.id)
        }

        if (msg.channel.includes("MAIN")) return toApp(OUTPUT, OutputHelper.expandToRenderGroupMembers(msg))
        if (msg.channel in outputResponses) return outputResponses[msg.channel as keyof typeof outputResponses](msg.data)

        OutputHelper.Send.sendToOutputWindow(msg)
    }

    // Shared-render: a FOLLOWER output has no window, so nothing ever emits the id-keyed video sync messages
    // (MAIN_TIME / MAIN_DATA) under the follower's id — only the group RENDERER's window sends them, keyed by
    // the renderer's id. The main window's preview mirror for the follower depends on exactly those messages:
    // mirror videos never loop natively (BackgroundMedia skips updateValues for mirrors) and rely on the
    // videosTime/videosData sync to snap back across a loop boundary — without it the follower's preview
    // thumbnail plays the video ONCE and freezes on its last frame. Fan the renderer's entries out to every
    // group member id so follower previews sync exactly like the renderer's.
    private static expandToRenderGroupMembers(msg: Message): Message {
        if (msg.channel !== "MAIN_TIME" && msg.channel !== "MAIN_DATA") return msg
        const data = msg.data
        if (!data || typeof data !== "object") return msg

        let expanded: { [id: string]: unknown } | null = null
        for (const id of Object.keys(data)) {
            const members = RenderGroups.members(id)
            if (members.length < 2) continue
            const target: { [id: string]: unknown } = expanded || { ...data }
            expanded = target
            for (const memberId of members) {
                if (!(memberId in target)) target[memberId] = data[id]
            }
        }

        return expanded ? { ...msg, data: expanded } : msg
    }

    // static outputWindows: { [key: string]: BrowserWindow } = {}
    private static outputs: { [key: string]: OutputData } = {}

    static getOutput(id: string) {
        return this.outputs[id]
    }

    static getAllOutputs() {
        return Object.entries(this.outputs).map(([id, output]) => ({ ...output, id }))
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
