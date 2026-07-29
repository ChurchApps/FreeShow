import { AudioInputCapture } from "./audioInputCapture"
import { AudioRoutingManager } from "./audioRoutingManager"

export class AudioNodeRouter {
    private manager: AudioRoutingManager

    constructor() {
        this.manager = AudioRoutingManager.getInstance()
    }

    public connectSourceToMerger(sourceNode: AudioNode, mergerId: string) {
        const mergerNode = this.manager.getMergerNode(mergerId)
        if (mergerNode && sourceNode) {
            try {
                sourceNode.connect(mergerNode)
                AudioInputCapture.getInstance().captureInput(mergerId, mergerNode)
            } catch (e) {
                console.error(`[AudioNodeRouter] Could not connect source to merger ${mergerId}:`, e)
            }
        }
    }

    public routeInput(inputId: string, inputNode: AudioNode) {
        // Attach capture visualizer to input node
        AudioInputCapture.getInstance().captureInput(inputId, inputNode)

        const targetMergerIds = this.manager.getConnectionsFrom(inputId)
        targetMergerIds.forEach((mergerId) => {
            this.connectSourceToMerger(inputNode, mergerId)
        })
    }
}
