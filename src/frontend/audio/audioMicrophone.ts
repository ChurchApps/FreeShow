import { get } from "svelte/store"
import { MAIN } from "../../types/Channels"
import { outLocked } from "../stores"
import { AudioPlayer } from "./audioPlayer"

type AudioMetadata = {
    name: string
}
type AudioOptions = {
    pauseIfPlaying?: boolean
}

export class AudioMicrophone {
    static start(id: string, metadata: AudioMetadata, options: AudioOptions = {}) {
        if (get(outLocked)) return

        if (AudioPlayer.audioExists(id)) {
            if (options.pauseIfPlaying) AudioPlayer.stop(id)
            return
        }

        navigator.mediaDevices
            .getUserMedia({ audio: { deviceId: { exact: id } } })
            .then((stream) => {
                AudioPlayer.playStream(id, stream, metadata)
            })
            .catch((err) => {
                console.log(err)
                if (err.name === "NotReadableError") {
                    window.api.send(MAIN, { channel: "ACCESS_MICROPHONE_PERMISSION" })
                }
            })
    }

    static stop(id: string) {
        AudioPlayer.stop(id)
    }
}
