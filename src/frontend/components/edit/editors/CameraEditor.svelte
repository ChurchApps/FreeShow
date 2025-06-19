<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { activeEdit, media } from "../../../stores"
    import Cam from "../../drawer/live/Cam.svelte"
    import { getMediaStyle } from "../../helpers/media"

    $: mediaId = $activeEdit.id
    $: data = $activeEdit.data

    // get styling
    let mediaStyle: MediaStyle = {}
    $: if (mediaId) mediaStyle = getMediaStyle($media[mediaId], undefined)

    $: cameraStyleString = `object-fit: ${mediaStyle.fit || "contain"};filter: ${mediaStyle.filter};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
</script>

<div class="parent" style="display: flex;flex-direction: column;height: 100%;">
    <div class="media" style="flex: 1;overflow: hidden;position: relative;">
        {#if data}
            <Cam cam={data} item style={cameraStyleString} />
        {/if}
    </div>
</div>
