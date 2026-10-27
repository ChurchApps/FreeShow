// Control surface for OMT input. Receiving runs in a utilityProcess (../capture/streamReceiverProcess).

import { StreamReceiverHost } from "../capture/StreamReceiverHost"
import { ownSenderOutput } from "../output/helpers/ownSenders"
import { OmtSender } from "./OmtSender"

type Source = { name: string; urlAddress?: string; id: string }

export class OmtReceiver {
    static omtDisabled = false

    static async findStreamsOMT(): Promise<{ name: string; urlAddress: string; outputId?: string }[]> {
        if (this.omtDisabled) return []
        const sources: { name: string; urlAddress: string }[] = (await StreamReceiverHost.request("omt:find")) || []
        return sources.map((s) => ({ ...s, outputId: ownSenderOutput(s.name, OmtSender.OMT) || undefined }))
    }

    // low bandwidth reception for drawer cards
    static receiveStreamFrameOMT(data: { source: Source }) {
        if (this.omtDisabled) return
        StreamReceiverHost.send("omt:thumbnail", data)
    }

    // take a new snapshot now instead of waiting out the tile's refresh interval
    static refreshStreamOMT(data: { source: Source }) {
        if (this.omtDisabled) return
        StreamReceiverHost.send("omt:refresh", data)
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
