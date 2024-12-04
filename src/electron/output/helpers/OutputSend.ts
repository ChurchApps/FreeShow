import { OUTPUT, type ValidChannels } from "../../../types/Channels"
import { OutputHelper } from "../OutputHelper"

export class OutputSend {
    static sendToOutputWindow(msg: any) {
        OutputHelper.getAllOutputs().forEach(sendToWindow)

        function sendToWindow([id, output]: any) {
            if ((msg.data?.id && msg.data.id !== id) || !output?.window || output.window.isDestroyed()) return

            let tempMsg: any = JSON.parse(JSON.stringify(msg))
            if (msg.channel === "OUTPUTS") tempMsg = onlySendToMatchingId(tempMsg, id)

            output.window.webContents.send(OUTPUT, tempMsg)

            //if (!output.previewWindow || output.previewWindow.isDestroyed()) return
            //output.previewWindow.webContents.send(OUTPUT, tempMsg)
        }

        function onlySendToMatchingId(tempMsg: any, id: string) {
            if (!msg.data?.[id]) return tempMsg

            tempMsg.data = { [id]: msg.data[id] }
            return tempMsg
        }
    }

    static sendToWindow(id: string, msg: any, channel: ValidChannels = OUTPUT) {
        const output = OutputHelper.getOutput(id)
        if (!output?.window || output.window.isDestroyed()) return
        output.window.webContents.send(channel, msg)
        //if (!output.previewWindow || output.previewWindow.isDestroyed()) return
        //output.previewWindow.webContents.send(OUTPUT, msg)
    }
}
