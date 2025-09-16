<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { getMediaStyle } from "../helpers/media"
    import { cameraManager } from "../helpers/cameraManager"
    import { media } from "../../stores"

    export let id: string
    export let groupId: string
    let videoElem: HTMLVideoElement | undefined

    $: constraints = {
        video: {
            deviceId: { exact: id },
            groupId,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        }
    }

    onMount(() => {
        // Try to get a warmed camera stream first
        const warmStream = cameraManager.getWarmCamera(id)
        if (warmStream) {
            console.info(`Using warmed camera stream for output: ${id}`)
            if (videoElem) {
                videoElem.srcObject = warmStream
                videoElem.onloadedmetadata = loaded
            }
            return
        }

        // Fallback to normal camera initialization
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            if (!videoElem) return

            videoElem.srcObject = stream
            videoElem.onloadedmetadata = loaded
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
        videoElem?.play()
        dispatch("loaded", true)
    }

    $: mediaStyle = getMediaStyle($media[id], undefined)
    $: cameraStyleString = `object-fit: ${mediaStyle.fit || "contain"};filter: ${mediaStyle.filter};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
</script>

<video class={$$props.class} bind:this={videoElem} style={cameraStyleString}>
    <track kind="captions" />
</video>

<style>
    video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        /* -webkit-transform: scaleX(-1);
    transform: scaleX(-1); */
    }
</style>
