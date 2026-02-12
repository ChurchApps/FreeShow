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

    onMount(() => {
        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((stream) => {
                if (!videoElem) return

                videoElem.srcObject = stream
                videoElem.onloadedmetadata = loaded
            })
            .catch((err) => {
                console.error(err.name + ": " + err.message)
            })
    })

    onDestroy(stopStream)
    function stopStream() {
        if (!videoElem) return
        ;(videoElem.srcObject as MediaStream)?.getTracks()?.forEach((track) => track.stop())
        videoElem.srcObject = null
    }

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
