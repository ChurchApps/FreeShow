import { get } from "svelte/store"
import { AUDIO } from "../../../types/Channels"
import { playingAudio } from "../../stores"
import { send } from "../../utils/request"

// NOT IN USE

const ndiEnabled = true
const channelCount = 2
const sampleRate = 48 // kHz
const frameRate = 24 // fps
// const outputDevice = ""

export function captureAudio() {
    try {
        if (!ndiEnabled || channelCount <= 0) return

        /* create offline audio context */
        const ac = new AudioContext({
            latencyHint: "interactive",
            sampleRate: sampleRate * 1000,
        })

        /* create a stereo audio destination */
        const dest = ac.createMediaStreamDestination()
        dest.channelCount = channelCount
        dest.channelCountMode = "explicit"
        dest.channelInterpretation = "speakers"

        /* create media recorder to create an WebM/OPUS stream as the output.
            NOTICE: we could use the Chromium-supported "audio/webm; codecs=\"pcm\"" here
            and receive lossless PCM/interleaved/signed-float32/little-endian and then during
            later processing completely avoid the lossy OPUS to lossless PCM decoding.
            Unfortunately, the MediaEncoder in Chromium (at least until version 90) causes
            noticable distortions in the audio output.. */
        const recorder = new MediaRecorder(dest.stream, {
            // mimeType: 'audio/webm; codecs="opus"',
            mimeType: 'audio/webm; codecs="pcm"',
        })
        recorder.addEventListener("dataavailable", async (ev) => {
            const ab = await ev.data.arrayBuffer()
            const u8 = new Uint8Array(ab, 0, ab.byteLength)
            console.log("CAPTURE")
            send(AUDIO, ["CAPTURE"], u8)
        })

        console.log(get(playingAudio))

        if (!Object.keys(get(playingAudio)).length) {
            recorder.stop()
            return
        }

        Object.values(get(playingAudio)).forEach(({ audio }) => {
            const stream = audio.captureStream()
            const audiotracks = stream.getAudioTracks()
            const source = ac.createMediaStreamSource(new MediaStream(audiotracks))
            console.log(audio, stream, audiotracks, source)

            source.connect(dest)
            if (recorder.state === "recording") return
            if (recorder.state === "paused") return recorder.play()
            recorder.start(Math.round(1000 / frameRate))
        })
    } catch (err) {
        console.log("Audio capture error:", err)
    }
}
