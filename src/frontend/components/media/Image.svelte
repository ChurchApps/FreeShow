<script lang="ts">
    import type { MediaStyle } from "../../../types/Main"

    export let path: string
    export let mediaStyle: MediaStyle = {}
</script>

<img
    class="media"
    style="width: 100%;height: 100%;object-fit: {mediaStyle.fit || 'contain'};filter: {mediaStyle.filter || ''};transform: scale({mediaStyle.flipped ? '-1' : '1'}, {mediaStyle.flippedY ? '-1' : '1'});"
    src={path}
    alt=""
    draggable="false"
    on:error
    on:load
/>

<style>
    /* hide alt text */
    img {
        text-indent: 100%;
        white-space: nowrap;
        overflow: hidden;
    }
</style>
