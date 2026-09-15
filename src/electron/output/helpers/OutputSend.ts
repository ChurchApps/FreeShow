import type { ValidChannels } from "../../../types/Channels"
import { OUTPUT } from "../../../types/Channels"
import type { Message } from "../../../types/Socket"
import { clone } from "../../utils/helpers"
import type { Output } from "../Output"
import { OutputHelper } from "../OutputHelper"

export class OutputSend {
    static sendToOutputWindow(msg: Message) {
        OutputHelper.getAllOutputs().forEach(sendToWindow)

        function sendToWindow(output: Output & { id: string }) {
            // shared-render FOLLOWERS own no window (they reference the renderer's) and render no content of
            // their own — never send their OUTPUT data to the shared window or it would corrupt the renderer.
            // a presenter draws another output's render; sending it content would render it a second time
            if ((output as any).follower || (output as any).presenter) return
            if ((msg.data?.id && msg.data.id !== output.id) || !output?.window || output.window.isDestroyed()) return

            let tempMsg: Message = clone(msg)
            if (msg.channel === "OUTPUTS") tempMsg = onlySendToMatchingId(tempMsg, output.id)

            output.window.webContents.send(OUTPUT, tempMsg)
            // the offscreen capture surface renders the same output, so it needs the same data
            const surface = (output as any).captureWindow
            if (surface && !surface.isDestroyed()) surface.webContents.send(OUTPUT, tempMsg)

            // if (!output.previewWindow || output.previewWindow.isDestroyed()) return
            // output.previewWindow.webContents.send(OUTPUT, tempMsg)
        }

        function onlySendToMatchingId(tempMsg: Message, id: string) {
            if (!msg.data?.[id]) return tempMsg

            tempMsg.data = { [id]: msg.data[id] }
            return tempMsg
        }
    }

    static sendToWindow(id: string, msg: any, channel: ValidChannels = OUTPUT) {
        const output = OutputHelper.getOutput(id)
        // a shared-render follower's window is the renderer's — don't inject the follower's data into it
        if (!output?.window || output.window.isDestroyed() || (output as any).follower || (output as any).presenter) return
        output.window.webContents.send(channel, msg)
        const surface = (output as any).captureWindow
        if (surface && !surface.isDestroyed()) surface.webContents.send(channel, msg)
        // if (!output.previewWindow || output.previewWindow.isDestroyed()) return
        // output.previewWindow.webContents.send(OUTPUT, msg)
    }
}
