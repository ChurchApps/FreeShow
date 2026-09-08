// Control surface for OMT input. The receiving itself — the loops, the frame packing, the preview
// downscale and the delivery to renderers — runs in a utilityProcess, because video must never touch
// the main thread. See ../capture/streamReceiverProcess.

import { StreamReceiverHost } from "../capture/StreamReceiverHost"

type Source = { name: string; urlAddress?: string; id: string }

export class OmtReceiver {
    static omtDisabled = false

    static async findStreamsOMT(): Promise<{ name: string; urlAddress: string }[]> {
        if (this.omtDisabled) return []
        return (await StreamReceiverHost.request("omt:find")) || []
    }

    // low bandwidth reception for drawer cards
    static receiveStreamFrameOMT(data: { source: Source }) {
        if (this.omtDisabled) return
        StreamReceiverHost.send("omt:thumbnail", data)
    }

    // full reception for output/background
    static captureStreamOMT(data: { source: Source; outputId: string }) {
        if (this.omtDisabled) return
        StreamReceiverHost.send("omt:capture", data)
    }

    static stopReceiversOMT(data: { id: string; outputId?: string } | null = null) {
        StreamReceiverHost.send("omt:stop", data)
    }
}
