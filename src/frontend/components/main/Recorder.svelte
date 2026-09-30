<script lang="ts">
    import { activeRecording, currentRecordingStream } from "../../stores"
    import { createMediaRecorder } from "../drawer/live/recorder"
    import { clone } from "../helpers/array"

    $: if ($activeRecording !== undefined) toggleRecording()

    let recorderActive = false

    let videoElem: HTMLVideoElement | undefined
    let currentStream: MediaStream | null = null

    $: isOutputRecording = $activeRecording?.isOutput || $activeRecording?.type === "output"

    $: if (videoElem && $currentRecordingStream && !isOutputRecording && videoElem.srcObject !== $currentRecordingStream) {
        videoElem.srcObject = $currentRecordingStream
        videoElem.play().catch(() => {})
    }

    function toggleRecording() {
        if (!$activeRecording) {
            currentStream?.getTracks().forEach((track) => {
                track.stop()
            })
            currentStream = null

            if (videoElem) videoElem.srcObject = null
            recorderActive = false

            return
        }

        if (isOutputRecording) return

        recorderActive = true

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
                if (!videoElem || !$activeRecording) {
                    stream.getTracks().forEach((track) => {
                        track.stop()
                    })
                    return
                }

                currentStream = stream

                currentRecordingStream.set(stream)
                videoElem.srcObject = stream
                videoElem.play().catch(() => {})
                createMediaRecorder(stream)
            })
            .catch(function (err) {
                console.error(err.name + ": " + err.message)
            })
    }
</script>

{#if (recorderActive || $currentRecordingStream) && !isOutputRecording}
    <video class="recorder" bind:this={videoElem} muted autoplay playsinline>
        <track kind="captions" />
    </video>
{/if}

<style>
    video.recorder {
        position: fixed;
        opacity: 0;
        pointer-events: none;
        z-index: -1;
    }
</style>
