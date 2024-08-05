<script lang="ts">
    import { activeRecording, currentRecordingStream } from "../../stores"
    import { createMediaRecorder } from "../drawer/live/recorder"
    import { clone } from "../helpers/array"

    $: if ($activeRecording !== undefined) toggleRecording()

    let videoElem
    let currentStream
    function toggleRecording() {
        if (!videoElem) return
        if (!$activeRecording) {
            currentStream?.getTracks().forEach((track) => {
                track.stop()
            })
            videoElem.srcObject = null
            return
        }

        let options = clone($activeRecording)
        // https://stackoverflow.com/questions/27420581/get-maximum-video-resolution-with-getusermedia
        // can be 4k if the screen supports it
        options.maxWidth = 4096
        options.maxHeight = 2160
        // options.maxFrameRate = 60 / 144
        // options.maxAspectRatio = 16/9

        navigator.mediaDevices
            .getUserMedia(options)
            .then((stream) => {
                if (!stream) return console.error("Error getting media stream!")
                if (!videoElem) return

                currentStream = stream

                currentRecordingStream.set(stream)
                videoElem.srcObject = stream
                videoElem.play()
                createMediaRecorder(stream)
            })
            .catch(function (err) {
                console.log(err.name + ": " + err.message)
            })
    }
</script>

<video bind:this={videoElem}>
    <track kind="captions" />
</video>

<style>
    video {
        position: fixed;
        opacity: 0;
        pointer-events: none;
        z-index: -1;
    }
</style>
