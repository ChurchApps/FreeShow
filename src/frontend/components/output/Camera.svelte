<script lang="ts">
    import { onDestroy, onMount } from "svelte"
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

    $: console.log("CAMERA", id)

    onMount(() => {
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            console.log(stream)

            videoElem.srcObject = stream
            videoElem.play()
        })
    })

    onDestroy(stopStream)
    function stopStream() {
        if (!videoElem) return
        videoElem.srcObject?.getTracks()?.forEach((track: any) => track.stop())
        videoElem.srcObject = null
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
