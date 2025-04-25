<script lang="ts">
    import { Item } from "../../../../types/Show"
    import Icon from "../../helpers/Icon.svelte"

    export let item: Item
    export let ratio = 1
</script>

{#if item.customSvg}
    <div class="customIcon" class:customColor={item?.style.includes("color:") && !item?.style.includes("color:#FFFFFF;")}>
        {@html item.customSvg}
    </div>
{:else}
    <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
{/if}

<style>
    /* custom svg icon */

    .customIcon,
    .customIcon :global(svg) {
        width: 100%;
        height: 100%;
    }
    .customIcon.customColor :global(svg path) {
        fill: currentColor;
    }
</style>
