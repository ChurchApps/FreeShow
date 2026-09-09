// Control surface for NDI input. The receiving itself — the loops, the frame packing, the preview
// downscale and the delivery to renderers — runs in a utilityProcess, because video must never touch
// the main thread. See ../capture/streamReceiverProcess.

import { StreamReceiverHost } from "../capture/StreamReceiverHost"

export class NdiReceiver {
    static ndiDisabled = false

    static async findStreamsNDI(data: { groups?: string }): Promise<{ name: string; urlAddress: string }[]> {
        if (this.ndiDisabled) return []
        return (await StreamReceiverHost.request("ndi:find", data)) || []
    }

    // low bandwidth reception for drawer cards
    static receiveStreamFrameNDI(data: { source: { name: string; urlAddress: string; id: string } }) {
        if (this.ndiDisabled) return
        StreamReceiverHost.send("ndi:thumbnail", data)
    }

    // full reception for output/background
    static captureStreamNDI(data: { source: { name: string; urlAddress: string; id: string }; outputId: string }) {
        if (this.ndiDisabled) return
        StreamReceiverHost.send("ndi:capture", data)
    }

    static stopReceiversNDI(data: { id: string; outputId?: string } | null = null) {
        StreamReceiverHost.send("ndi:stop", data)
    }
}
