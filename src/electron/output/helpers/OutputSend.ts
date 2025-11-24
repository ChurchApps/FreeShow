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
            if ((msg.data?.id && msg.data.id !== output.id) || !output?.window || output.window.isDestroyed()) return

            let tempMsg: Message = clone(msg)
            if (msg.channel === "OUTPUTS") tempMsg = onlySendToMatchingId(tempMsg, output.id)

            output.window.webContents.send(OUTPUT, tempMsg)

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
        if (!output?.window || output.window.isDestroyed()) return
        output.window.webContents.send(channel, msg)
        // if (!output.previewWindow || output.previewWindow.isDestroyed()) return
        // output.previewWindow.webContents.send(OUTPUT, msg)
    }
}
