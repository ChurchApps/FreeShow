import macadam from "macadam"
import { CaptureChannel, CaptureFrame } from "macadam"

// const FPS = 30
export class BlackmagicCapture {
    capture: CaptureChannel

    constructor(deviceIndex: number, audioChannels: number = 2) {
        this.initializeCapture(deviceIndex, audioChannels)
    }

    // set audioChannels to 0 to disable audio
    async initializeCapture(deviceIndex: number, audioChannels: number = 2) {
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

    async captureFrame(): Promise<CaptureFrame> {
        return await this.capture.frame()
        // for ( let x = 0 ; x < 1000 ; x++ ) {
        //     let frame = await this.capture.frame();
        //     // Do something with the frame
        // }
    }

    stopCapture() {
        this.capture.stop()
    }
}
