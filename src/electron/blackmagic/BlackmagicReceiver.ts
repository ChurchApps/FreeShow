// Control surface for Blackmagic (DeckLink) input. The capture itself — the channel, the frame loop,
// the format handling, the preview downscale and the delivery to renderers — runs in the stream
// receive utilityProcess next to NDI and OMT (see ../capture/streamReceiverProcess), because video
// must never touch the main thread. Main only resolves the device from its list and forwards control.

import { StreamReceiverHost } from "../capture/StreamReceiverHost"
import { BlackmagicManager } from "./BlackmagicManager"

export class BlackmagicReceiver {
    private static resolve(deviceId: string, audioChannels = 2) {
        const deviceIndex = BlackmagicManager.getIndexById(deviceId)
        if (deviceIndex < 0) return null

        const device = BlackmagicManager.getDeviceById(deviceId)
        if (!device || !device.inputDisplayModes?.[0]) return null

        const displayModeName = device.inputDisplayModes[0].name // first available
        const pixelFormatName = device.inputDisplayModes[0].videoModes[0] // first available
        return { deviceId, deviceIndex, displayMode: BlackmagicManager.getDisplayMode(displayModeName), pixelFormat: BlackmagicManager.getPixelFormat(pixelFormatName), pixelFormatName, audioChannels }
    }

    /** full capture for an output background */
    static startCapture({ source, outputId }: any) {
        const spec = this.resolve(source?.id)
        if (!spec) return
        StreamReceiverHost.send("bmd:capture", { ...spec, outputId })
    }

    /** a single frame for a drawer card */
    static captureFrame({ source }: any) {
        const spec = this.resolve(source?.id)
        if (!spec) return
        StreamReceiverHost.send("bmd:thumbnail", spec)
    }

    static stopReceiver(data: { id: string; outputId?: string } | null = null) {
        StreamReceiverHost.send("bmd:stop", data)
    }
}
