import { OUTPUT } from "../../../../types/Channels"
import { send } from "../../../utils/request"
import { onStreamFrame } from "../../../utils/streamPort"

// one of this machine's outputs, drawn from its capture preview instead of received over the network
export function subscribeOutputPreview(outputId: string, width: number, onFrame: (frame: any) => void): () => void {
    const subscriber = "t" + Math.random().toString(36).slice(2, 10)
    send(OUTPUT, ["PREVIEW_SUBSCRIBE"], { id: outputId, subscriber, width })
    const stop = onStreamFrame("PREVIEW", (data) => {
        if (data.id === outputId) onFrame(data.frame)
    })
    return () => {
        stop()
        send(OUTPUT, ["PREVIEW_UNSUBSCRIBE"], { id: outputId, subscriber })
    }
}
