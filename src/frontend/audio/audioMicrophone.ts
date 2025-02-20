import { MAIN } from "../../types/Channels"
import { audioStreams } from "../stores"
import { AudioPlayer } from "./audioPlayer"

type AudioMetadata = {
    name: string
}

export class AudioMicrophone {
    static start(id: string, metadata: AudioMetadata) {
        navigator.mediaDevices
            .getUserMedia({
                audio: {
                    deviceId: { exact: id },
                },
            })
            .then((stream: any) => {
                audioStreams[id] = stream

                // let audio = new Audio()
                // audio.srcObject = stream
                // audio.volume = 0

                AudioPlayer.playMicrophone(id, stream, metadata)
            })
            .catch((err) => {
                console.log(err)
                if (err.name === "NotReadableError") {
                    window.api.send(MAIN, { channel: "ACCESS_MICROPHONE_PERMISSION" })
                }
            })
    }
}
