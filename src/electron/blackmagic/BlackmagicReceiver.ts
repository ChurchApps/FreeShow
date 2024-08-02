import macadam from "macadam"
import { CaptureChannel, CaptureFrame } from "macadam"
import { BlackmagicManager } from "./BlackmagicManager"

// const FPS = 30
export class BlackmagicReceiver {
    static capture: CaptureChannel

    // set audioChannels to 0 to disable audio
    static async initialize(deviceIndex: number, audioChannels: number = 2) {
        if (this.capture || deviceIndex < 0) return

        // WIP change mode
        this.capture = await macadam.capture({
            deviceIndex,
            displayMode: macadam.bmdModeHD1080i50,
            pixelFormat: macadam.bmdFormat8BitYUV,
            channels: audioChannels,
            sampleRate: macadam.bmdAudioSampleRate48kHz,
            sampleType: macadam.bmdAudioSampleType16bitInteger,
        })
    }

    static async startCapture(deviceId: string = ""): Promise<CaptureFrame> {
        if (!this.capture) await this.initialize(BlackmagicManager.getIndexById(deviceId))
        return await this.capture.frame()
        // for ( let x = 0 ; x < 1000 ; x++ ) {
        //     let frame = await this.capture.frame();
        //     // Do something with the frame
        // }
    }

    static async captureFrame(deviceId: string = ""): Promise<CaptureFrame> {
        if (!this.capture) await this.initialize(BlackmagicManager.getIndexById(deviceId))
        return await this.capture.frame()
        // for ( let x = 0 ; x < 1000 ; x++ ) {
        //     let frame = await this.capture.frame();
        //     // Do something with the frame
        // }
    }

    static stopCapture() {
        this.capture.stop()
    }
}
