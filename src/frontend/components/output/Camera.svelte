<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { cameraManager } from "../../media/cameraManager"
    import { media } from "../../stores"
    import { getMediaStyle } from "../helpers/media"

    export let id: string
    export let groupId: string
    let videoElem: HTMLVideoElement | undefined

    $: if (id) updateCamera()
    async function updateCamera() {
        const cameraStream = await cameraManager.getCameraStream(id, groupId)
        if (typeof cameraStream === "string" || !videoElem) return

        videoElem.srcObject = cameraStream
        videoElem.onloadedmetadata = loaded
    }

    onDestroy(stopStream)
    function stopStream() {
        if (!videoElem) return
        ;(videoElem.srcObject as MediaStream)?.getTracks()?.forEach(track => track.stop())
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
