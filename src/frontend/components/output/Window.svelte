<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"

    export let id: string

    let videoElem: HTMLVideoElement | undefined

    let constraints: any = {
        video: {
            // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/cursor
            // hiding the cursor is not yet supported
            // cursor: "never",
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: id,
                maxWidth: 1920,
                maxHeight: 1080,
                // maxAspectRatio: 16/9,
                maxFrameRate: 60
            }
        }
    }

    let currentStream: MediaStream | null = null
    let destroyed = false
    onDestroy(() => {
        destroyed = true
        currentStream?.getTracks().forEach((track) => track.stop())
    })

    onMount(() => {
        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((stream) => {
                if (destroyed || !videoElem) return stream.getTracks().forEach((track) => track.stop())

                currentStream = stream
                videoElem.srcObject = stream
                videoElem.onloadedmetadata = loaded
            })
            .catch((err) => {
                console.error(err.name + ": " + err.message)
            })
    })

    let dispatch = createEventDispatcher()
    function loaded() {
        // WIP not working!!!
        console.log("window loaded")
        if (!videoElem) return

        videoElem.play()
        dispatch("loaded", true)
    }
</script>

<video bind:this={videoElem} class={$$props.class} style={$$props.style}>
    <track kind="captions" />
</video>
