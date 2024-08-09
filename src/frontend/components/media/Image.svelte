<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import { encodeFilePath } from "../helpers/media"

    export let path: string
    export let mediaStyle: MediaStyle = {}

    let dispatch = createEventDispatcher()
    function loaded() {
        dispatch("loaded", true)
    }

    // path starting at "/" auto completes to app root, but should be file:// (src="file://{path}")
    $: if (path[0] === "/") path = `file://${path}`
</script>

<img
    class="media"
    style="width: 100%;height: 100%;object-fit: {mediaStyle.fit || 'contain'};filter: {mediaStyle.filter || ''};transform: scale({mediaStyle.flipped ? '-1' : '1'}, {mediaStyle.flippedY ? '-1' : '1'});"
    src={encodeFilePath(path)}
    alt=""
    draggable="false"
    on:error
    on:load={loaded}
/>

<style>
    /* hide alt text */
    img {
        text-indent: 100%;
        white-space: nowrap;
        overflow: hidden;
    }
</style>
