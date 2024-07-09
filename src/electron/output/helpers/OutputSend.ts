import { OUTPUT } from "../../../types/Channels"
import { OutputHelper } from "./OutputHelper"

export class OutputSend {
    static sendToOutputWindow(msg: any) {
        Object.entries(OutputHelper.outputWindows).forEach(sendToWindow)

        function sendToWindow([id, window]: any) {
            if ((msg.data?.id && msg.data.id !== id) || !window || window.isDestroyed()) return

            let tempMsg: any = JSON.parse(JSON.stringify(msg))
            if (msg.channel === "OUTPUTS") tempMsg = onlySendToMatchingId(tempMsg, id)

            window.webContents.send(OUTPUT, tempMsg)
        }

        function onlySendToMatchingId(tempMsg: any, id: string) {
            if (!msg.data?.[id]) return tempMsg

            tempMsg.data = { [id]: msg.data[id] }
            return tempMsg
        }
    }

    static sendToWindow(id: string, msg: any) {
        let window = OutputHelper.outputWindows[id]
        if (!window || window.isDestroyed()) return

        window.webContents.send(OUTPUT, msg)
    }
}
