<script lang="ts">
    import type { MediaStyle } from "../../../types/Main"

    export let path: string
    export let mediaStyle: MediaStyle = {}
</script>

<img class="media" style="object-fit: {mediaStyle.fit};width: 100%;height: 100%;filter: {mediaStyle.filter || ''};{mediaStyle.flipped ? 'transform: scaleX(-1);' : ''}" src={path} alt="" draggable="false" on:error on:load />

<style>
    /* hide alt text */
    img {
        text-indent: 100%;
        white-space: nowrap;
        overflow: hidden;
    }
</style>
