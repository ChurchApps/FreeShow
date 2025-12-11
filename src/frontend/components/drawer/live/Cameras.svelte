<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { type CameraData, cameraManager } from "../../../media/cameraManager"
    import { media } from "../../../stores"
    import { sortByName } from "../../helpers/array"
    import { getMediaStyle } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import Cam from "./Cam.svelte"

    export let showPlayOnHover = true

    let cams: CameraData[] = []
    onMount(async () => {
        const cameras = await cameraManager.getCamerasList()
        cams = sortByName(cameras)
    })

    let dispatch = createEventDispatcher()
    function click(event, cam) {
        dispatch("click", { event, cam })
    }

    // get styling
    function getStyle(id: string, _updater: any) {
        const mediaStyle = getMediaStyle($media[id], undefined)
        return `object-fit: ${mediaStyle.fit || "contain"};filter: ${mediaStyle.filter};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
    }
</script>

{#if cams.length}
    {#each cams as cam}
        <Cam {cam} on:click={(e) => click(e.detail, cam)} style={getStyle(cam.id, $media)} {showPlayOnHover} />
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}
