<script lang="ts">
    import { Item } from "../../../../types/Show"
    import Icon from "../../helpers/Icon.svelte"

    export let item: Item
    export let ratio = 1
</script>

<div class="iconItem" style="display: contents;">
    {#if item.customSvg}
        <div class="customIcon" class:customColor={typeof item?.style === "string" && item.style.includes("color:") && !item.style.includes("color:;")}>
            {@html item.customSvg}
        </div>
    {:else}
        <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
    {/if}
</div>

<style>
    .iconItem :global(svg) {
        position: absolute;
        top: 0;
        left: 0;
    }

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
