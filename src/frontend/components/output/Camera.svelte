<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { cameraManager } from "../../media/cameraManager"
    import { media } from "../../stores"
    import { getCropState } from "../helpers/cropping"
    import { getMediaStyle } from "../helpers/media"

    export let id: string
    export let groupId: string
    export let preview = false
    export let videoElem: HTMLVideoElement | undefined = undefined

    let isDestroyed = false
    let dispatch = createEventDispatcher()

    let currentAttachedId = ""
    $: if (id && videoElem && (id !== currentAttachedId || !videoElem.srcObject)) updateCamera()
    async function updateCamera() {
        if (!videoElem || !id) return
        currentAttachedId = id
        const res = await cameraManager.attachCamera(videoElem, id, {
            groupId,
            preview,
            isDestroyed: () => isDestroyed || id !== currentAttachedId,
            onLoaded: () => dispatch("loaded", true)
        })
        if (typeof res === "string") {
            dispatch("loaded", true)
        }
    }

    onDestroy(() => {
        isDestroyed = true
        cameraManager.detachCamera(videoElem, id)
    })

    $: mediaStyle = getMediaStyle($media[id], undefined)
    $: cropState = getCropState(mediaStyle.cropping, false, mediaStyle.style)
    $: cameraStyleString = `${cropState.mediaCropGeometry}object-fit: ${cropState.cropHasValues ? (mediaStyle.fit === "cover" ? "cover" : "fill") : (mediaStyle.fit || "contain")};filter: ${mediaStyle.filter};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
</script>

<div class="mediaContainer" style={cropState.mediaContainerStyle}>
    <video class={$$props.class} bind:this={videoElem} style={cameraStyleString}>
        <track kind="captions" />
    </video>
</div>

<style>
    video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        /* -webkit-transform: scaleX(-1);
    transform: scaleX(-1); */
    }
</style>
