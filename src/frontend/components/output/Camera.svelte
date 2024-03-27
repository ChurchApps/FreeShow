<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { getResolution } from "../helpers/output"

    export let id: string
    export let groupId: string
    let videoElem: any

    $: constraints = {
        video: {
            deviceId: { exact: id },
            groupId,
            width: { ideal: getResolution().width },
            height: { ideal: getResolution().height },
        },
    }

    onMount(() => {
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            if (!videoElem) return

            videoElem.srcObject = stream
            videoElem.onloadedmetadata = loaded
        })
    })

    onDestroy(stopStream)
    function stopStream() {
        if (!videoElem) return

        console.log(videoElem.srcObject, videoElem.srcObject?.getTracks()) // WIP
        videoElem.srcObject?.getTracks()?.forEach((track: any) => track.stop())
        videoElem.srcObject = null
    }

    let dispatch = createEventDispatcher()
    function loaded() {
        videoElem.play()
        dispatch("loaded", true)
    }
</script>

<video class={$$props.class} bind:this={videoElem}>
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
